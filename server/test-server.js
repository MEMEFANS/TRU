const express = require('express');
const cors = require('cors');
const app = express();

// 基础配置
app.use(cors());
app.use(express.json());

// 测试路由
app.get('/', (req, res) => {
    res.json({ message: 'Server is running' });
});

app.post('/test', (req, res) => {
    console.log('Received POST request:', req.body);
    res.json({
        message: 'POST request received',
        data: req.body
    });
});

// 启动服务器
const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
