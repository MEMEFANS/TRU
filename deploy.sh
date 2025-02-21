#!/bin/bash

echo "开始部署 TRU DApp..."

# 更新系统
echo "1. 更新系统..."
sudo apt update
sudo apt upgrade -y

# 安装必要软件
echo "2. 安装必要软件..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs nginx git

# 安装 PM2
echo "3. 安装 PM2..."
sudo npm install -g pm2

# 配置 Nginx
echo "4. 配置 Nginx..."
sudo cat > /etc/nginx/sites-available/tru-dapp << 'EOL'
server {
    listen 80;
    server_name $YOUR_DOMAIN;  # 替换为您的域名

    location / {
        root /var/www/tru-dapp;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOL

# 创建符号链接
sudo ln -s /etc/nginx/sites-available/tru-dapp /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# 创建网站目录
echo "5. 创建网站目录..."
sudo mkdir -p /var/www/tru-dapp
sudo chown -R $USER:$USER /var/www/tru-dapp

# 复制项目文件
echo "6. 复制项目文件..."
cp -r ./* /var/www/tru-dapp/

# 安装项目依赖
echo "7. 安装项目依赖..."
cd /var/www/tru-dapp
npm install

# 启动后端服务
echo "8. 启动后端服务..."
pm2 start server.js --name "tru-backend"

# 重启 Nginx
echo "9. 重启 Nginx..."
sudo nginx -t
sudo systemctl restart nginx

# 配置防火墙
echo "10. 配置防火墙..."
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo "部署完成！"
echo "请访问 http://您的服务器IP 查看网站"
