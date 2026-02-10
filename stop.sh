#!/bin/bash

# 51吃瓜浏览器停止脚本
# 停止所有运行中的应用实例

echo "=========================================="
echo "  51吃瓜浏览器停止脚本"
echo "=========================================="
echo ""

echo "🔍 查找运行中的应用进程..."
echo ""

# 查找并停止 Electron 进程
PIDS=$(ps aux | grep -E "electron.*51chigua-category-viewer|51吃瓜浏览器" | grep -v grep | awk '{print $2}')

if [ -z "$PIDS" ]; then
    echo "✓ 没有发现运行中的应用进程"
else
    echo "发现以下进程:"
    ps aux | grep -E "electron.*51chigua-category-viewer|51吃瓜浏览器" | grep -v grep | awk '{print "  PID: " $2 " - " $11 " " $12 " " $13}'
    echo ""
    
    echo "🛑 停止进程..."
    for PID in $PIDS; do
        echo "  停止进程 $PID..."
        kill -9 $PID 2>/dev/null || true
    done
    
    echo ""
    echo "✓ 所有进程已停止"
fi

echo ""
echo "=========================================="
echo "  ✅ 完成"
echo "=========================================="
