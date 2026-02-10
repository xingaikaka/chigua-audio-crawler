#!/bin/bash

# 51吃瓜浏览器启动脚本
# 处理 macOS 隔离属性 (xattr) 并启动应用

set -e

echo "=========================================="
echo "  51吃瓜浏览器启动脚本"
echo "=========================================="
echo ""

# 检测操作系统
OS="$(uname)"

# 应用路径配置
APP_NAME="51吃瓜浏览器.app"
DIST_DIR="$(pwd)/dist/mac"
DIST_DIR_ARM="$(pwd)/dist/mac-arm64"
DIST_DIR_UNIVERSAL="$(pwd)/dist/mac-universal"

# 查找应用路径
APP_PATH=""
if [ -d "$DIST_DIR/$APP_NAME" ]; then
    APP_PATH="$DIST_DIR/$APP_NAME"
elif [ -d "$DIST_DIR_ARM/$APP_NAME" ]; then
    APP_PATH="$DIST_DIR_ARM/$APP_NAME"
elif [ -d "$DIST_DIR_UNIVERSAL/$APP_NAME" ]; then
    APP_PATH="$DIST_DIR_UNIVERSAL/$APP_NAME"
elif [ -d "/Applications/$APP_NAME" ]; then
    APP_PATH="/Applications/$APP_NAME"
fi

# macOS 特殊处理
if [ "$OS" = "Darwin" ]; then
    echo "检测到 macOS 系统"
    echo ""
    
    # 检查是否找到应用
    if [ -n "$APP_PATH" ] && [ -d "$APP_PATH" ]; then
        echo "✓ 找到应用: $APP_PATH"
        echo ""
        
        # 移除隔离属性
        echo "🔧 移除隔离属性 (xattr)..."
        xattr -cr "$APP_PATH" 2>/dev/null || true
        echo "✓ 隔离属性已移除"
        echo ""
        
        # 启动应用
        echo "🚀 启动应用..."
        open "$APP_PATH"
        echo "✓ 应用已启动"
    else
        echo "⚠️  未找到打包后的应用"
        echo ""
        echo "使用开发模式启动..."
        echo ""
        
        # 检查依赖
        if [ ! -d "node_modules" ]; then
            echo "📦 安装依赖..."
            npm install
            echo ""
        fi
        
        # 开发模式启动
        echo "🚀 启动开发模式..."
        npm run dev &
        
        DEV_PID=$!
        echo "✓ 应用已启动 (PID: $DEV_PID)"
        echo ""
        echo "按 Ctrl+C 停止应用"
        
        # 等待进程
        wait $DEV_PID
    fi
else
    echo "检测到非 macOS 系统: $OS"
    echo ""
    echo "🚀 启动开发模式..."
    
    # 检查依赖
    if [ ! -d "node_modules" ]; then
        echo "📦 安装依赖..."
        npm install
        echo ""
    fi
    
    npm run dev
fi

echo ""
echo "=========================================="
echo "  ✅ 完成"
echo "=========================================="
