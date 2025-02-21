let tronWeb;
let contract;
const CONTRACT_ADDRESS = 'TRCb1h2CT82YtJSUnzywERrenEStKtEpce';
const EXCHANGE_RATE = 20;
const ADMIN_ADDRESS = 'TSTTzbC8RbqEgLvbCvudKd5rZ6Chg8GN7o'; // 管理员钱包地址，用于接收用户的TRX
const API_KEY = 'your-secure-api-key-2025'; // 从.env文件中获取API密钥
const API_URL = 'http://localhost:8080'; // 确保这里的端口与后端一致

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
        // 请求连接钱包
        await window.tronLink.request({ method: 'tron_requestAccounts' });
        // 等待连接完成
        const connected = await waitForTronWeb();
        if (!connected) {
            alert('请确保解锁 TronLink 钱包');
        }
    } catch (error) {
        console.error('连接钱包失败:', error);
        alert('连接钱包失败，请重试');
    }
}

// 更新钱包信息
async function updateWalletInfo() {
    if (!window.tronWeb || !window.tronWeb.ready) return;

    const walletAddress = window.tronWeb.defaultAddress.base58;
    if (!walletAddress) return;

    // 更新地址显示
    const addressElem = document.querySelector('.wallet-address');
    if (addressElem) {
        const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
        addressElem.textContent = shortAddress;
        addressElem.title = walletAddress;
    }
}

// 初始化合约
async function initContract() {
    try {
        if (!window.tronWeb) {
            console.error('TronWeb not found');
            return false;
        }

        if (!window.tronWeb.ready) {
            console.error('TronWeb not ready');
            return false;
        }

        // 确保TronWeb已经完全初始化
        if (!window.tronWeb.defaultAddress.base58) {
            console.error('No wallet address found');
            return false;
        }

        try {
            contract = await window.tronWeb.contract().at(CONTRACT_ADDRESS);
            if (!contract) {
                console.error('Contract initialization failed');
                return false;
            }

            // 验证合约是否正确初始化
            const contractMethods = await contract.methods;
            if (!contractMethods) {
                console.error('Contract methods not found');
                return false;
            }

            console.log('Contract initialized successfully');
            console.log('Contract address:', CONTRACT_ADDRESS);
            console.log('User address:', window.tronWeb.defaultAddress.base58);
            return true;
        } catch (error) {
            console.error('Contract initialization error:', error);
            return false;
        }
    } catch (error) {
        console.error('TronWeb error:', error);
        return false;
    }
}

// 计算兑换数量
function calculateExchange() {
    const trxAmount = document.getElementById('trxAmount').value;
    const truAmount = trxAmount * EXCHANGE_RATE;
    document.getElementById('truAmount').value = truAmount;
}

// 检查余额
async function checkBalance(amount) {
    try {
        const balance = await window.tronWeb.trx.getBalance(window.tronWeb.defaultAddress.base58);
        const balanceInTrx = window.tronWeb.fromSun(balance);
        console.log('Current balance:', balanceInTrx, 'TRX');
        return parseFloat(balanceInTrx) >= parseFloat(amount);
    } catch (error) {
        console.error('Failed to check balance:', error);
        return false;
    }
}

// 显示成功弹窗
function showSuccess(message) {
    Swal.fire({
        title: '兑换成功！',
        text: message,
        icon: 'success',
        confirmButtonText: '确定'
    });
}

// 显示错误弹窗
function showError(message) {
    Swal.fire({
        title: '出错了',
        text: message,
        icon: 'error',
        confirmButtonText: '确定'
    });
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

        // 检查用户地址和管理员地址是否相同
        if (userAddress.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
            throw new Error('不能使用管理员钱包进行兑换');
        }

        const trxAmount = document.getElementById('trxAmount').value;
        if (!trxAmount || trxAmount <= 0) {
            throw new Error('请输入有效的TRX数量');
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
            
            // 发送TRX到管理员地址
            const transaction = await window.tronWeb.trx.sendTransaction(
                ADMIN_ADDRESS,
                window.tronWeb.toSun(trxAmount),
                {
                    shouldPollResponse: true,
                    callValue: 0
                }
            );

            if (transaction.result || transaction.txid) {
                console.log('TRX transaction successful:', transaction);
                
                // TRX发送成功后立即弹窗，等弹窗关闭后恢复按钮状态
                await Swal.fire({
                    title: '兑换成功！',
                    icon: 'success',
                    confirmButtonText: '确定'
                });
                
                // 弹窗关闭后恢复按钮状态
                exchangeButton.disabled = false;
                exchangeButton.innerHTML = originalText;
                
                // 计算TRU数量
                const truAmount = trxAmount * EXCHANGE_RATE;
                
                // 调用后端API处理TRU转账
                const response = await fetch(`${API_URL}/exchange`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': API_KEY
                    },
                    body: JSON.stringify({
                        userAddress: userAddress,
                        trxAmount: parseFloat(trxAmount),
                        truAmount: truAmount,
                        transactionId: transaction.txid || transaction.transaction_id
                    })
                });

                if (!response.ok) {
                    throw new Error('后端API请求失败');
                }

                const result = await response.json();
                if (result.success) {
                    // showSuccess('兑换成功！TRU将很快到达您的钱包');
                    
                    // 清空输入框
                    document.getElementById('trxAmount').value = '';
                    document.getElementById('truAmount').value = '';
                    
                    // 更新钱包信息
                    updateWalletInfo();
                } else {
                    throw new Error(result.message || '兑换失败，请稍后重试');
                }
            } else {
                throw new Error('TRX交易失败');
            }
        } catch (error) {
            console.error('Exchange error:', error);
            throw new Error(error.message || '兑换过程中发生错误');
        }
    } catch (error) {
        console.error('Exchange error:', error);
        showError(error.message || '兑换失败，请重试');
    } finally {
        // exchangeButton.disabled = false;
        // exchangeButton.innerHTML = originalText;
    }
}

// 更新实时数据
async function updateLiveStats() {
    try {
        // 这里应该调用后端 API 获取实际数据
        // 现在使用模拟数据
        const stats = {
            circulatingSupply: '8,756,432 TRU',
            dailyVolume: '1,234,567 TRX',
            holdersCount: '12,345'
        };

        document.getElementById('circulatingSupply').textContent = stats.circulatingSupply;
        document.getElementById('dailyVolume').textContent = stats.dailyVolume;
        document.getElementById('holdersCount').textContent = stats.holdersCount;
    } catch (error) {
        console.error('Failed to update live stats:', error);
    }
}

// 定期更新实时数据
setInterval(updateLiveStats, 30000); // 每30秒更新一次
updateLiveStats(); // 初始更新

// 事件监听
document.getElementById('connectWallet').addEventListener('click', connectWallet);
document.getElementById('trxAmount').addEventListener('input', calculateExchange);
document.getElementById('exchangeButton').addEventListener('click', performExchange);

// 检查TronLink是否已安装
window.addEventListener('load', async () => {
    await checkWalletStatus();
});
