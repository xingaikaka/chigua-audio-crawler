# 51吃瓜浏览器 - 快速开始

## 🚀 一键启动（开发模式）

```bash
./run.sh
```

## 🛑 停止应用

```bash
./stop.sh
```

## 📦 打包应用

```bash
./build.sh
```

按提示选择打包平台（macOS/Windows/Linux）

## 🎯 启动打包后的应用

```bash
./start.sh
```

自动处理 macOS 隔离属性 (xattr) 问题

---

## 详细文档

- **完整打包指南**: [BUILD_README.md](BUILD_README.md)
- **项目文档**: [README.md](README.md)

## 常用命令

| 命令 | 说明 |
|------|------|
| `./run.sh` | 快速启动（开发模式） |
| `./start.sh` | 智能启动（自动选择开发/打包版本） |
| `./stop.sh` | 停止所有实例 |
| `./build.sh` | 打包应用 |
| `npm run dev` | 开发模式 |
| `npm run build:mac` | 打包 macOS 版本 |

## 故障排除

### macOS: "无法验证开发者"

```bash
# 方法 1: 使用启动脚本（推荐）
./start.sh

# 方法 2: 手动移除隔离属性
xattr -cr /Applications/51吃瓜浏览器.app
```

### 端口被占用

```bash
./stop.sh
```

### 查看日志

```bash
tail -f /tmp/51chigua-app.log
```

## 脚本说明

- **run.sh**: 快速启动开发模式
- **start.sh**: 智能启动，自动处理 xattr
- **stop.sh**: 停止所有运行实例
- **build.sh**: 交互式打包脚本

## 技术支持

遇到问题？检查日志：

```bash
cat /tmp/51chigua-app.log
```
