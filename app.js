let tronWeb;
let contract;
const CONTRACT_ADDRESS = 'TDh764XBtebnEjADfcP6sW8mRWU4Xa7ymE';
const EXCHANGE_RATE = 20; // 兑换比例: 20 TRX = 1 TRU

// 检查钱包状态
async function checkWalletStatus() {
    console.log('Checking wallet status...');
    console.log('TronLink exists:', !!window.tronLink);
    console.log('TronWeb exists:', !!window.tronWeb);
    
    if (window.tronWeb && window.tronWeb.ready) {
        console.log('TronWeb is ready');
        tronWeb = window.tronWeb;
        
        if (tronWeb.defaultAddress.base58) {
            console.log('Wallet connected:', tronWeb.defaultAddress.base58);
            updateWalletUI(true);
            await updateWalletInfo();
            await initContract();
            return true;
        } else {
            console.log('No wallet address found');
        }
    } else if (window.tronLink) {
        console.log('TronLink found but not ready');
        try {
            // 尝试请求连接
            await window.tronLink.request({ method: 'tron_requestAccounts' });
            // 等待TronWeb就绪
            return await waitForTronWeb();
        } catch (error) {
            console.error('Failed to request accounts:', error);
        }
    }
    
    console.log('Wallet not connected');
    updateWalletUI(false);
    return false;
}

// 等待TronWeb就绪
function waitForTronWeb(retries = 10) {
    return new Promise((resolve) => {
        let attempts = 0;
        const checkTronWeb = async () => {
            attempts++;
            console.log(`Checking TronWeb attempt ${attempts}`);
            
            if (window.tronWeb && window.tronWeb.ready && window.tronWeb.defaultAddress.base58) {
                console.log('TronWeb is now ready');
                tronWeb = window.tronWeb;
                updateWalletUI(true);
                await updateWalletInfo();
                await initContract();
                resolve(true);
            } else if (attempts < retries) {
                setTimeout(checkTronWeb, 500);
            } else {
                console.log('TronWeb not ready after maximum attempts');
                updateWalletUI(false);
                resolve(false);
            }
        };
        checkTronWeb();
    });
}

// 更新钱包UI状态
function updateWalletUI(isConnected) {
    const connectBtn = document.getElementById('connectWallet');
    const walletInfo = document.getElementById('wallet-info');
    const installAlert = document.getElementById('install-alert');
    const exchangeForm = document.querySelector('.exchange-form');
    
    if (isConnected) {
        connectBtn.textContent = '已连接';
        connectBtn.classList.add('connected');
        walletInfo?.classList.remove('d-none');
        installAlert?.classList.add('d-none');
        exchangeForm?.classList.remove('d-none');
    } else {
        connectBtn.textContent = '连接钱包';
        connectBtn.classList.remove('connected');
        walletInfo?.classList.add('d-none');
        installAlert?.classList.remove('d-none');
        exchangeForm?.classList.add('d-none');
    }
}

// 连接钱包
async function connectWallet() {
    console.log('Connecting wallet...');
    if (!window.tronLink) {
        alert('请安装 TronLink 钱包');
        return;
    }
    
    try {
        await window.tronLink.request({ method: 'tron_requestAccounts' });
        return await waitForTronWeb();
    } catch (error) {
        console.error('Failed to connect wallet:', error);
        return false;
    }
}

// 更新钱包信息
async function updateWalletInfo() {
    if (!window.tronWeb || !window.tronWeb.ready) return;

    const walletAddress = window.tronWeb.defaultAddress.base58;
    if (!walletAddress) return;

    try {
        // 获取TRX余额
        const balance = await window.tronWeb.trx.getBalance(walletAddress);
        const trxBalance = window.tronWeb.fromSun(balance);

        // 更新显示
        document.querySelector('.wallet-address').textContent = 
            `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
    } catch (error) {
        console.error('Failed to update wallet info:', error);
    }
}

// 初始化合约
async function initContract() {
    try {
        if (!window.tronWeb) {
            throw new Error('TronWeb not found');
        }

        // Exchange合约ABI
        const exchangeABI = [
            {
                "inputs": [
                    {
                        "name": "_truToken",
                        "type": "address"
                    },
                    {
                        "name": "_trxReceiver",
                        "type": "address"
                    }
                ],
                "stateMutability": "nonpayable",
                "type": "constructor"
            },
            {
                "inputs": [],
                "name": "exchangeTRXForTRU",
                "outputs": [],
                "stateMutability": "payable",
                "type": "function"
            }
        ];

        contract = await window.tronWeb.contract(exchangeABI, CONTRACT_ADDRESS);
        console.log('Contract initialized:', contract);
        return true;
    } catch (error) {
        console.error('Failed to initialize contract:', error);
        return false;
    }
}

// 计算兑换数量
function calculateExchange() {
    const trxInput = document.getElementById('trxAmount');
    const truOutput = document.getElementById('truAmount');
    
    const trxAmount = parseFloat(trxInput.value) || 0;
    const truAmount = trxAmount / EXCHANGE_RATE; // 20 TRX = 1 TRU
    
    truOutput.value = truAmount.toFixed(8);
}

// 检查余额
async function checkBalance(amount) {
    if (!window.tronWeb || !window.tronWeb.ready) return false;

    try {
        const balance = await window.tronWeb.trx.getBalance(window.tronWeb.defaultAddress.base58);
        const trxBalance = window.tronWeb.fromSun(balance);
        return parseFloat(trxBalance) >= parseFloat(amount);
    } catch (error) {
        console.error('Failed to check balance:', error);
        return false;
    }
}

// 执行兑换
async function performExchange() {
    const exchangeButton = document.getElementById('exchangeButton');
    const originalText = exchangeButton.innerHTML;
    
    try {
        exchangeButton.disabled = true;
        exchangeButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
        
        if (!window.tronWeb || !window.tronWeb.ready) {
            throw new Error('请先连接钱包');
        }

        const userAddress = window.tronWeb.defaultAddress.base58;
        if (!userAddress) {
            throw new Error('未检测到钱包地址');
        }

        const trxAmount = document.getElementById('trxAmount').value;
        if (!trxAmount || trxAmount <= 0) {
            throw new Error('请输入有效的TRX数量');
        }

        if (trxAmount < 20) {
            throw new Error('最少需要20 TRX');
        }

        // 检查余额
        const hasEnoughBalance = await checkBalance(trxAmount);
        if (!hasEnoughBalance) {
            throw new Error('TRX余额不足');
        }

        try {
            console.log('Starting exchange process...');
            console.log('User address:', userAddress);
            console.log('TRX amount:', trxAmount);
            
            // 调用Exchange合约的exchangeTRXForTRU函数
            const transaction = await contract.exchangeTRXForTRU().send({
                callValue: window.tronWeb.toSun(trxAmount),
                shouldPollResponse: false  // 改为 false，不等待交易确认
            });

            console.log('Exchange transaction sent:', transaction);
            
            // 清空输入框
            document.getElementById('trxAmount').value = '';
            document.getElementById('truAmount').value = '';
            
            // 显示成功消息
            await Swal.fire({
                title: '兑换成功！',
                text: '请在钱包中查看代币',
                icon: 'success',
                confirmButtonText: '确定'
            });
            
            // 更新钱包信息
            await updateWalletInfo();
            
        } catch (error) {
            console.error('Exchange error:', error);
            throw new Error(error.message || '兑换过程中发生错误');
        }
    } catch (error) {
        console.error('Exchange error:', error);
        showError(error.message || '兑换失败，请重试');
    } finally {
        exchangeButton.disabled = false;
        exchangeButton.innerHTML = originalText;
    }
}

// 显示成功消息
function showSuccess(message) {
    Swal.fire({
        title: '成功',
        text: message,
        icon: 'success',
        confirmButtonText: '确定'
    });
}

// 显示错误消息
function showError(message) {
    Swal.fire({
        title: '错误',
        text: message,
        icon: 'error',
        confirmButtonText: '确定'
    });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 连接钱包按钮事件
    document.getElementById('connectWallet')?.addEventListener('click', connectWallet);
    
    // 输入框事件监听
    document.getElementById('trxAmount')?.addEventListener('input', calculateExchange);
    
    // 兑换按钮事件
    document.getElementById('exchangeButton')?.addEventListener('click', performExchange);
    
    // 检查钱包状态
    await checkWalletStatus();
});
