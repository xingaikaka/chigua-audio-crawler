#!/bin/bash

# 51吃瓜浏览器 - 自动安装脚本
# 双击运行即可自动安装并启动

clear

echo "=========================================="
echo "  51吃瓜浏览器 - 自动安装"
echo "=========================================="
echo ""

APP_NAME="51吃瓜浏览器.app"
APPS_DIR="/Applications"
TARGET_APP="$APPS_DIR/$APP_NAME"

# 函数：移除隔离属性
remove_quarantine() {
    local app_path="$1"
    echo "🔧 正在移除隔离属性..."
    xattr -cr "$app_path" 2>/dev/null || sudo xattr -cr "$app_path"
    
    if [ $? -eq 0 ]; then
        echo "✅ 隔离属性已移除"
        return 0
    else
        echo "⚠️  移除隔离属性失败"
        return 1
    fi
}

# 函数：启动应用
launch_app() {
    local app_path="$1"
    echo ""
    echo "🚀 正在启动应用..."
    open "$app_path"
    
    if [ $? -eq 0 ]; then
        echo "✅ 应用已启动"
        echo ""
        echo "=========================================="
        echo "  ✅ 安装完成！"
        echo "=========================================="
        echo ""
        echo "应用已成功安装到："
        echo "$app_path"
        echo ""
        echo "下次可以直接从启动台或 Applications 打开。"
        echo ""
        return 0
    else
        echo "❌ 启动失败"
        return 1
    fi
}

# 检查应用是否已在 Applications 目录
if [ -d "$TARGET_APP" ]; then
    echo "✓ 检测到应用已安装在 Applications"
    echo ""
    
    # 检查是否有隔离属性
    if xattr -l "$TARGET_APP" 2>/dev/null | grep -q "com.apple.quarantine"; then
        echo "⚠️  检测到隔离属性，需要移除"
        remove_quarantine "$TARGET_APP"
    else
        echo "✓ 应用状态正常"
    fi
    
    # 启动应用
    launch_app "$TARGET_APP"
    
else
    echo "⚠️  未检测到应用安装"
    echo ""
    
    # 查找当前目录或 DMG 挂载点中的应用
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    LOCAL_APP=""
    
    # 检查脚本所在目录
    if [ -d "$SCRIPT_DIR/$APP_NAME" ]; then
        LOCAL_APP="$SCRIPT_DIR/$APP_NAME"
        echo "✓ 在当前目录找到应用"
    else
        # 查找 DMG 挂载点
        for volume in /Volumes/*; do
            if [ -d "$volume/$APP_NAME" ]; then
                LOCAL_APP="$volume/$APP_NAME"
                echo "✓ 在 DMG 挂载点找到应用: $volume"
                break
            fi
        done
    fi
    
    if [ -n "$LOCAL_APP" ]; then
        echo ""
        echo "📦 准备安装应用..."
        echo ""
        echo "源位置: $LOCAL_APP"
        echo "目标位置: $TARGET_APP"
        echo ""
        
        # 询问是否安装
        read -p "是否安装到 Applications 文件夹？[Y/n] " -n 1 -r
        echo ""
        
        if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
            echo ""
            echo "📋 正在复制应用..."
            
            # 复制应用
            cp -R "$LOCAL_APP" "$APPS_DIR/" 2>/dev/null || \
            sudo cp -R "$LOCAL_APP" "$APPS_DIR/"
            
            if [ $? -eq 0 ]; then
                echo "✅ 应用已复制到 Applications"
                echo ""
                
                # 移除隔离属性
                remove_quarantine "$TARGET_APP"
                
                # 启动应用
                launch_app "$TARGET_APP"
            else
                echo "❌ 复制失败"
                echo ""
                echo "请手动拖动应用到 Applications 文件夹"
                echo "然后再次运行此脚本"
            fi
        else
            echo ""
            echo "安装已取消"
            echo ""
            echo "你可以手动拖动应用到 Applications 文件夹"
            echo "然后再次运行此脚本来移除隔离属性"
        fi
    else
        echo "❌ 未找到应用文件"
        echo ""
        echo "请确保："
        echo "  1. 已挂载 DMG 文件"
        echo "  2. 或将此脚本放在应用旁边"
        echo ""
        echo "然后再次运行此脚本"
    fi
fi

echo ""
echo "按任意键关闭..."
read -n 1 -s

# 完成
exit 0
