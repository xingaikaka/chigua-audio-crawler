#!/bin/bash

# 51吃瓜浏览器打包脚本
# 用于打包 Electron 应用

set -e

echo "=========================================="
echo "  51吃瓜浏览器打包脚本"
echo "=========================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js 版本: $(node --version)"
echo "✓ npm 版本: $(npm --version)"
echo ""

# 安装依赖
echo "📦 安装/更新依赖..."
npm install
echo ""

# 检查是否安装了 electron-builder
if ! npm list electron-builder &> /dev/null; then
    echo "📦 安装 electron-builder..."
    npm install --save-dev electron-builder
    echo ""
fi

# 选择打包平台
echo "请选择打包平台:"
echo "  1) macOS (默认)"
echo "  2) Windows"
echo "  3) Linux"
echo "  4) 全平台"
echo ""
read -p "请输入选项 [1-4] (默认: 1): " platform
platform=${platform:-1}

echo ""
echo "🔨 开始打包..."
echo ""

case $platform in
    1)
        echo "📦 打包 macOS 版本..."
        npm run build:mac
        ;;
    2)
        echo "📦 打包 Windows 版本..."
        npm run build:win
        ;;
    3)
        echo "📦 打包 Linux 版本..."
        npm run build:linux
        ;;
    4)
        echo "📦 打包全平台版本..."
        npm run build
        ;;
    *)
        echo "❌ 无效选项，使用默认 macOS"
        npm run build:mac
        ;;
esac

echo ""
echo "=========================================="
echo "  ✅ 打包完成！"
echo "=========================================="
echo ""
echo "打包文件位置: $(pwd)/dist"
echo ""

# 列出打包结果
if [ -d "dist" ]; then
    echo "📦 打包结果:"
    ls -lh dist/ | grep -E '\.(dmg|zip|exe|AppImage|deb)$' || echo "  (未找到打包文件)"
    echo ""
fi

# macOS 特殊处理
if [ "$(uname)" = "Darwin" ] && [ "$platform" = "1" ]; then
    echo "📝 macOS 使用说明:"
    echo "  1. 打开 dist 目录"
    echo "  2. 双击 .dmg 文件安装"
    echo "  3. 如果遇到'无法验证开发者'错误，请运行启动脚本"
    echo ""
    echo "  或使用启动脚本: ./start.sh"
    echo ""
fi

echo "✅ 完成！"
