#!/bin/bash

# 快速启动脚本 - 开发模式
# 用于日常开发和测试

cd "$(dirname "$0")"

# 停止旧进程
pkill -f "electron.*51chigua-category-viewer" 2>/dev/null || true
sleep 1

# 启动应用
echo "🚀 启动 51吃瓜浏览器（开发模式）..."
nohup npm run dev > /tmp/51chigua-app.log 2>&1 &

sleep 3
echo "✅ 应用已启动"
echo "📝 日志文件: /tmp/51chigua-app.log"
echo ""
echo "使用 ./stop.sh 停止应用"
