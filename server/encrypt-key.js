const crypto = require('crypto');
const readline = require('readline');

const algorithm = 'aes-256-gcm';
const ivLength = 16;
const saltLength = 64;
const tagLength = 16;

function encrypt(text, key) {
    const salt = crypto.randomBytes(saltLength);
    const iv = crypto.randomBytes(ivLength);

    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512');
    const cipher = crypto.createCipheriv(algorithm, derivedKey, iv);
    
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('私钥加密工具\n');

rl.question('请输入要加密的私钥: ', (privateKey) => {
    rl.question('请输入加密密钥: ', (encryptionKey) => {
        try {
            const encryptedKey = encrypt(privateKey, encryptionKey);
            console.log('\n加密后的私钥:');
            console.log(encryptedKey);
            console.log('\n请将加密密钥(ENCRYPTION_KEY)和加密后的私钥(ENCRYPTED_PRIVATE_KEY)添加到.env文件中');
        } catch (error) {
            console.error('加密失败:', error);
        }
        rl.close();
    });
});
