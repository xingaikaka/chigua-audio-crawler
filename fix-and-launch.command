#!/bin/bash

# 51吃瓜浏览器 - 快速修复启动脚本
# 双击运行即可移除"损坏"标记并启动应用
# 适用于已安装到 Applications 的应用

clear

echo "=========================================="
echo "  51吃瓜浏览器 - 快速启动"
echo "=========================================="
echo ""
echo "正在修复并启动应用..."
echo ""

APP_PATH="/Applications/51吃瓜浏览器.app"

# 检查应用是否存在
if [ ! -d "$APP_PATH" ]; then
    echo "❌ 未找到应用"
    echo ""
    echo "应用应该安装在："
    echo "$APP_PATH"
    echo ""
    echo "请先安装 DMG 文件，然后再运行此脚本。"
    echo ""
    echo "按任意键关闭..."
    read -n 1 -s
    exit 1
fi

echo "✓ 找到应用: $APP_PATH"
echo ""

# 移除隔离属性
echo "🔧 正在移除隔离属性（解决"损坏"问题）..."
xattr -cr "$APP_PATH" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ 隔离属性已移除"
else
    echo "⚠️  需要管理员权限，请输入密码："
    sudo xattr -cr "$APP_PATH"
    
    if [ $? -eq 0 ]; then
        echo "✅ 隔离属性已移除"
    else
        echo "❌ 移除失败"
        echo ""
        echo "请手动运行以下命令："
        echo "xattr -cr $APP_PATH"
        echo ""
        echo "按任意键关闭..."
        read -n 1 -s
        exit 1
    fi
fi

echo ""
echo "🚀 正在启动应用..."
open "$APP_PATH"

if [ $? -eq 0 ]; then
    echo "✅ 应用已启动！"
    echo ""
    echo "=========================================="
    echo "  ✅ 完成！"
    echo "=========================================="
    echo ""
    echo "应用已成功启动。"
    echo "下次可以直接从启动台或 Applications 打开。"
    echo ""
    echo "3 秒后自动关闭..."
    sleep 3
else
    echo "❌ 启动失败"
    echo ""
    echo "请尝试手动打开应用，或联系技术支持。"
    echo ""
    echo "按任意键关闭..."
    read -n 1 -s
    exit 1
fi

exit 0
