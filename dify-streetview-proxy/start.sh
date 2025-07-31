#!/bin/bash

echo "🚀 Starting Dify Street View Proxy Server..."
echo "📍 This server injects street view images into Dify API requests"
echo ""

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

echo "🔧 Starting proxy server on http://localhost:8090"
echo "💡 Usage: Set your TEN Framework Dify base_url to http://localhost:8090"
echo "🎯 Real Dify API: https://api.dify.ai/v1"
echo "📱 Playground should run on: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=========================================="

# 启动服务器并输出日志到文件
echo "📝 Logs will be saved to: proxy.log"
echo "📖 To view logs in real-time: tail -f proxy.log"
echo ""

# 启动服务器，输出到文件和控制台
node server.js 2>&1 | tee proxy.log