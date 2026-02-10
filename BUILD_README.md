# 51吃瓜浏览器 - 打包和部署指南

## 📋 目录

- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [打包应用](#打包应用)
- [启动应用](#启动应用)
- [故障排除](#故障排除)

## 环境要求

### 基础环境
- **Node.js**: >= 16.x
- **npm**: >= 8.x
- **操作系统**: macOS / Windows / Linux

### macOS 额外要求
- Xcode Command Line Tools (打包 macOS 版本需要)

### Windows 额外要求
- Visual Studio Build Tools (打包 Windows 版本需要)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式运行

```bash
npm run dev
```

或使用启动脚本：

```bash
chmod +x start.sh
./start.sh
```

## 打包应用

### 使用打包脚本（推荐）

```bash
# 给脚本添加执行权限
chmod +x build.sh

# 运行打包脚本
./build.sh
```

脚本会提示选择打包平台：
- **选项 1**: macOS (生成 .dmg 和 .zip)
- **选项 2**: Windows (生成 .exe 安装包和 .zip)
- **选项 3**: Linux (生成 AppImage 和 .deb)
- **选项 4**: 全平台

### 使用 npm 命令

```bash
# 打包 macOS 版本
npm run build:mac

# 打包 Windows 版本
npm run build:win

# 打包 Linux 版本
npm run build:linux

# 打包全平台
npm run build
```

### 打包结果

打包完成后，文件会生成在 `dist/` 目录：

```
dist/
├── mac/                    # macOS x64 版本
│   └── 51吃瓜浏览器.app
├── mac-arm64/              # macOS ARM64 版本
│   └── 51吃瓜浏览器.app
├── 51吃瓜浏览器-1.0.0.dmg    # macOS 安装包
├── 51吃瓜浏览器-1.0.0.zip    # macOS 压缩包
├── win-unpacked/           # Windows 未打包版本
└── 51吃瓜浏览器 Setup 1.0.0.exe  # Windows 安装包
```

## 启动应用

### 方法 1: 使用启动脚本（推荐 - macOS）

启动脚本会自动处理 macOS 的隔离属性 (xattr) 问题：

```bash
# 给脚本添加执行权限
chmod +x start.sh

# 运行启动脚本
./start.sh
```

**脚本功能**：
- ✅ 自动查找打包后的应用
- ✅ 移除 macOS 隔离属性 (xattr)
- ✅ 启动应用
- ✅ 如果未找到打包版本，自动使用开发模式

### 方法 2: 手动启动（macOS）

如果遇到"无法验证开发者"错误：

```bash
# 移除隔离属性
xattr -cr /Applications/51吃瓜浏览器.app

# 或者对 dist 目录中的应用
xattr -cr ./dist/mac/51吃瓜浏览器.app

# 然后启动
open /Applications/51吃瓜浏览器.app
```

### 方法 3: 开发模式

```bash
npm run dev
```

## 停止应用

### 使用停止脚本

```bash
# 给脚本添加执行权限
chmod +x stop.sh

# 停止所有运行中的实例
./stop.sh
```

### 手动停止

```bash
# 查找进程
ps aux | grep "51吃瓜浏览器"

# 停止进程
killall -9 "51吃瓜浏览器"
# 或
pkill -f "electron.*51chigua-category-viewer"
```

## 故障排除

### macOS: "无法打开应用，因为无法验证开发者"

**原因**: macOS Gatekeeper 安全机制

**解决方案**:

1. 使用启动脚本（自动处理）:
   ```bash
   ./start.sh
   ```

2. 或手动移除隔离属性:
   ```bash
   xattr -cr /Applications/51吃瓜浏览器.app
   ```

3. 或在系统偏好设置中允许:
   - 打开"系统偏好设置" > "安全性与隐私"
   - 点击"仍要打开"

### macOS: "应用已损坏"

**解决方案**:

```bash
# 移除所有扩展属性
sudo xattr -cr /Applications/51吃瓜浏览器.app

# 如果还不行，重新签名
codesign --force --deep --sign - /Applications/51吃瓜浏览器.app
```

### Windows: SmartScreen 警告

**解决方案**:
- 点击"更多信息"
- 点击"仍要运行"

### 打包失败: "electron-builder not found"

**解决方案**:

```bash
npm install --save-dev electron-builder
```

### 依赖安装失败

**解决方案**:

```bash
# 清理缓存
npm cache clean --force

# 删除 node_modules
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

### 端口被占用

**解决方案**:

```bash
# 停止所有相关进程
./stop.sh

# 或手动查找并停止
lsof -ti:端口号 | xargs kill -9
```

## 脚本说明

### build.sh
打包脚本，用于生成各平台的安装包。

**功能**:
- 检查环境依赖
- 安装/更新 npm 包
- 选择打包平台
- 执行打包
- 显示打包结果

### start.sh
启动脚本，智能启动应用。

**功能**:
- 检测操作系统
- 查找打包后的应用
- 移除 macOS 隔离属性
- 启动应用或开发模式

### stop.sh
停止脚本，停止所有运行中的应用实例。

**功能**:
- 查找所有相关进程
- 停止所有进程

## 配置文件

### package.json - build 配置

```json
{
  "build": {
    "appId": "com.51chigua.viewer",
    "productName": "51吃瓜浏览器",
    "mac": {
      "category": "public.app-category.utilities",
      "target": ["dmg", "zip"]
    },
    "win": {
      "target": ["nsis", "zip"]
    }
  }
}
```

## 分发应用

### macOS
- 分发 `.dmg` 文件（推荐）
- 或分发 `.zip` 文件
- 提醒用户运行启动脚本或手动移除隔离属性

### Windows
- 分发 `.exe` 安装包
- 或分发 `.zip` 压缩包

### Linux
- 分发 `.AppImage` (通用)
- 或分发 `.deb` (Debian/Ubuntu)

## 技术支持

如有问题，请检查：
1. Node.js 和 npm 版本是否符合要求
2. 所有依赖是否正确安装
3. 是否有足够的磁盘空间
4. 防火墙/安全软件是否阻止
5. 日志文件: `/tmp/51chigua-app.log` (开发模式)

## 更新日志

### v1.0.0
- ✅ 初始版本
- ✅ 支持 macOS/Windows/Linux 打包
- ✅ 自动处理 macOS xattr 问题
- ✅ 多视频支持
- ✅ 智能全选（忽略已同步）
- ✅ 同步按钮状态锁定
