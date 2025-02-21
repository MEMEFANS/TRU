const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const BigNumber = require('bignumber.js');
const TronWeb = require('tronweb');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 配置对象
const config = {
    PORT: process.env.PORT || 8080,
    TRU_CONTRACT: process.env.TRU_CONTRACT,
    EXCHANGE_RATE: parseFloat(process.env.EXCHANGE_RATE) || 20,
    FEE_LIMIT: parseInt(process.env.FEE_LIMIT) || 1000000,
    API_KEY: process.env.API_KEY,
    MAX_REQUESTS_PER_MINUTE: parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 60,
    TRU_DECIMALS: 8,
    TRU_RECEIVER: process.env.TRU_RECEIVER,
    ADMIN_ADDRESS: process.env.ADMIN_ADDRESS,
    TRONGRID_API_KEY: process.env.TRONGRID_API_KEY
};

// API密钥验证中间件
function validateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    console.log('Received API key:', apiKey);
    console.log('Expected API key:', process.env.API_KEY);
    
    if (!apiKey || apiKey !== process.env.API_KEY) {
        console.error('API key validation failed');
        return res.status(401).json({ error: 'Invalid API key' });
    }
    next();
}

// Express 应用配置
const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 添加速率限制
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1分钟
    max: config.MAX_REQUESTS_PER_MINUTE
});
app.use(limiter);

// 请求日志
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    if (req.method === 'POST') {
        console.log('Request body:', req.body);
    }
    next();
});

// API 路由
app.get('/', (req, res) => {
    res.send('TRX-TRU Exchange Server Running');
});

app.get('/rate', (req, res) => {
    res.json({ rate: config.EXCHANGE_RATE });
});

// 兑换接口
app.post('/exchange', validateApiKey, async (req, res) => {
    try {
        const { userAddress, trxAmount, transactionId } = req.body;
        
        if (!userAddress || !trxAmount || !transactionId) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        console.log('Exchange request:', {
            userAddress,
            trxAmount,
            transactionId,
            apiKey: req.headers['x-api-key']
        });

        // 验证地址格式
        const tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io',
            privateKey: process.env.PRIVATE_KEY
        });

        if (!tronWeb.isAddress(userAddress)) {
            return res.status(400).json({ error: '无效的用户地址' });
        }

        // 验证交易ID
        try {
            console.log('Checking transaction:', transactionId);
            const txInfo = await tronWeb.trx.getTransactionInfo(transactionId);
            console.log('Transaction info:', JSON.stringify(txInfo, null, 2));

            if (!txInfo) {
                console.error('Transaction not found');
                return res.status(400).json({ error: '找不到TRX交易' });
            }

            // 获取原始交易数据
            const tx = await tronWeb.trx.getTransaction(transactionId);
            console.log('Original transaction:', JSON.stringify(tx, null, 2));

            if (!tx || !tx.raw_data || !tx.raw_data.contract || tx.raw_data.contract.length === 0) {
                console.error('Invalid transaction data');
                return res.status(400).json({ error: '无效的交易数据' });
            }

            const rawData = tx.raw_data.contract[0].parameter.value;
            console.log('Transaction raw data:', JSON.stringify(rawData, null, 2));

            const txAmount = rawData.amount / 1000000; // Convert from SUN to TRX
            const toAddress = tronWeb.address.fromHex(rawData.to_address);

            console.log('Transaction validation:', {
                expectedAmount: trxAmount,
                actualAmount: txAmount,
                expectedAddress: config.ADMIN_ADDRESS,
                actualAddress: toAddress
            });

            if (Math.abs(txAmount - trxAmount) > 0.01) {
                console.error('Amount mismatch:', { expected: trxAmount, actual: txAmount });
                return res.status(400).json({ error: '交易金额不匹配' });
            }

            if (toAddress !== config.ADMIN_ADDRESS) {
                console.error('Address mismatch:', { expected: config.ADMIN_ADDRESS, actual: toAddress });
                return res.status(400).json({ error: '接收地址不匹配' });
            }
        } catch (error) {
            console.error('Error validating TRX transaction:', error.response ? error.response.data : error);
            return res.status(400).json({ error: '无法验证TRX交易: ' + (error.response ? JSON.stringify(error.response.data) : error.message) });
        }

        // 计算TRU数量（考虑精度）
        const exchangeRate = 20; // 1 TRX = 20 TRU
        const truAmount = new BigNumber(trxAmount).times(exchangeRate).times(Math.pow(10, config.TRU_DECIMALS));

        console.log('Attempting TRU transfer:', {
            to: userAddress,
            amount: truAmount.toString(),
            contract: process.env.TRU_CONTRACT
        });

        try {
            // 获取TRU合约实例
            const contract = await tronWeb.contract().at(process.env.TRU_CONTRACT);
            console.log('Got contract instance');

            // 检查合约余额
            const balance = await contract.balanceOf(config.ADMIN_ADDRESS).call();
            console.log('Admin TRU balance:', balance.toString());

            if (new BigNumber(balance.toString()).lt(truAmount)) {
                console.error('Insufficient TRU balance:', {
                    required: truAmount.toString(),
                    available: balance.toString()
                });
                return res.status(400).json({ error: 'TRU余额不足' });
            }

            // 发送TRU
            const result = await contract.transfer(
                userAddress,
                truAmount.toString()
            ).send({
                feeLimit: 100000000,  // 100 TRX
                callValue: 0,
                shouldPollResponse: true,
                bypassEnergyCheck: true  // 强制使用 TRX 支付费用
            });

            console.log('TRU transfer result:', result);
            res.json({ success: true, transactionId: result });
        } catch (error) {
            console.error('Error sending TRU:', error);
            return res.status(500).json({ error: 'TRU转账失败: ' + error.message });
        }
    } catch (error) {
        console.error('Exchange error:', error);
        res.status(500).json({ 
            error: '兑换失败',
            details: error.message
        });
    }
});

// 启动服务器
app.listen(config.PORT, () => {
    console.log(`Server is running on port ${config.PORT}`);
});
