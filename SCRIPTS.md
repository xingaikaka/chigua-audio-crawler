# 脚本使用指南

## 📋 脚本清单

| 脚本 | 功能 | 使用场景 |
|------|------|----------|
| `run.sh` | 快速启动开发模式 | 日常开发和测试 |
| `start.sh` | 智能启动应用 | 启动打包后的应用或开发模式 |
| `stop.sh` | 停止应用 | 停止所有运行中的实例 |
| `build.sh` | 打包应用 | 生成安装包进行分发 |

---

## 🚀 run.sh - 快速启动（开发模式）

### 功能
- 停止旧进程
- 启动 Electron 开发模式
- 后台运行，输出日志到 `/tmp/51chigua-app.log`

### 使用

```bash
./run.sh
```

### 适用场景
- 日常开发
- 快速测试
- 代码调试

### 特点
- ✅ 简单快速
- ✅ 自动清理旧进程
- ✅ 后台运行
- ✅ 日志记录

---

## 🎯 start.sh - 智能启动

### 功能
1. 检测操作系统
2. 查找打包后的应用
3. 移除 macOS 隔离属性 (xattr)
4. 启动应用

### 使用

```bash
./start.sh
```

### 工作流程

```
开始
  ↓
检测操作系统
  ↓
查找打包后的应用
  ↓
找到? ──→ 是 ──→ 移除 xattr ──→ 启动应用
  ↓
  否
  ↓
启动开发模式
```

### 查找顺序
1. `dist/mac/51吃瓜浏览器.app`
2. `dist/mac-arm64/51吃瓜浏览器.app`
3. `dist/mac-universal/51吃瓜浏览器.app`
4. `/Applications/51吃瓜浏览器.app`
5. 开发模式 (如果都找不到)

### macOS xattr 处理

**问题**: macOS Gatekeeper 会标记下载的应用为"隔离"状态

**症状**:
- "无法打开应用，因为无法验证开发者"
- "应用已损坏，无法打开"

**解决**: 脚本自动执行
```bash
xattr -cr /path/to/app
```

### 适用场景
- 首次启动打包后的应用
- macOS 安全警告
- 自动化部署

---

## 🛑 stop.sh - 停止应用

### 功能
- 查找所有相关进程
- 强制停止所有实例

### 使用

```bash
./stop.sh
```

### 查找规则
匹配以下进程：
- `electron.*51chigua-category-viewer`
- `51吃瓜浏览器`

### 适用场景
- 应用无响应
- 端口被占用
- 重启应用前
- 清理僵尸进程

### 示例输出

```
==========================================
  51吃瓜浏览器停止脚本
==========================================

🔍 查找运行中的应用进程...

发现以下进程:
  PID: 12345 - electron ...
  PID: 12346 - 51吃瓜浏览器 ...

🛑 停止进程...
  停止进程 12345...
  停止进程 12346...

✓ 所有进程已停止

==========================================
  ✅ 完成
==========================================
```

---

## 📦 build.sh - 打包应用

### 功能
1. 检查环境（Node.js, npm）
2. 安装/更新依赖
3. 选择打包平台
4. 执行打包
5. 显示结果

### 使用

```bash
./build.sh
```

### 交互式选项

```
请选择打包平台:
  1) macOS (默认)
  2) Windows
  3) Linux
  4) 全平台

请输入选项 [1-4] (默认: 1):
```

### 打包结果

#### macOS
```
dist/
├── mac/
│   └── 51吃瓜浏览器.app          # x64 版本
├── mac-arm64/
│   └── 51吃瓜浏览器.app          # ARM64 版本
├── 51吃瓜浏览器-1.0.0.dmg         # DMG 安装包
└── 51吃瓜浏览器-1.0.0-mac.zip    # ZIP 压缩包
```

#### Windows
```
dist/
├── win-unpacked/
│   └── 51吃瓜浏览器.exe
├── 51吃瓜浏览器 Setup 1.0.0.exe  # 安装包
└── 51吃瓜浏览器-1.0.0-win.zip    # ZIP 压缩包
```

#### Linux
```
dist/
├── 51吃瓜浏览器-1.0.0.AppImage   # AppImage
└── 51吃瓜浏览器_1.0.0_amd64.deb  # Debian 包
```

### 环境检查

脚本会自动检查：
- ✅ Node.js 是否安装
- ✅ npm 版本
- ✅ electron-builder 是否安装
- ✅ 依赖是否完整

### 适用场景
- 生成安装包
- 版本发布
- 应用分发
- 测试打包配置

---

## 🔧 常见使用场景

### 场景 1: 日常开发

```bash
# 启动开发模式
./run.sh

# 修改代码...

# 重启应用
./stop.sh
./run.sh
```

### 场景 2: 测试打包

```bash
# 打包应用
./build.sh
# 选择 1 (macOS)

# 启动打包后的应用
./start.sh
```

### 场景 3: 清理环境

```bash
# 停止所有实例
./stop.sh

# 清理打包结果
rm -rf dist/

# 重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

### 场景 4: 首次部署到新 Mac

```bash
# 1. 解压应用到 Applications
cp -r dist/mac/51吃瓜浏览器.app /Applications/

# 2. 使用启动脚本（自动处理 xattr）
./start.sh
```

或者直接：

```bash
# 手动移除隔离属性
xattr -cr /Applications/51吃瓜浏览器.app

# 启动
open /Applications/51吃瓜浏览器.app
```

---

## 🐛 故障排除

### 问题 1: 脚本无法执行

**错误**: `Permission denied`

**解决**:
```bash
chmod +x *.sh
```

### 问题 2: 端口被占用

**症状**: 应用启动失败，提示端口已被使用

**解决**:
```bash
./stop.sh
./run.sh
```

### 问题 3: macOS 安全警告

**错误**: "无法验证开发者"

**解决**:
```bash
./start.sh
```

或手动：
```bash
xattr -cr /Applications/51吃瓜浏览器.app
```

### 问题 4: 打包失败

**检查**:
1. Node.js 版本 >= 16
2. 磁盘空间充足
3. 依赖完整安装

**解决**:
```bash
# 重新安装依赖
rm -rf node_modules
npm install

# 清理缓存
npm cache clean --force

# 重新打包
./build.sh
```

### 问题 5: 应用无响应

**解决**:
```bash
# 强制停止
./stop.sh

# 查看日志
cat /tmp/51chigua-app.log

# 重新启动
./run.sh
```

---

## 📝 日志查看

### 开发模式日志

```bash
# 实时查看
tail -f /tmp/51chigua-app.log

# 查看全部
cat /tmp/51chigua-app.log

# 清空日志
echo "" > /tmp/51chigua-app.log
```

### 调试技巧

```bash
# 启动应用
./run.sh

# 在另一个终端实时查看日志
tail -f /tmp/51chigua-app.log
```

---

## 🎓 最佳实践

### 开发阶段
1. 使用 `./run.sh` 快速启动
2. 修改代码后用 `./stop.sh && ./run.sh` 重启
3. 定期查看日志 `tail -f /tmp/51chigua-app.log`

### 测试阶段
1. 使用 `./build.sh` 打包测试版本
2. 使用 `./start.sh` 启动打包后的应用
3. 验证所有功能正常

### 发布阶段
1. 更新版本号（package.json）
2. 使用 `./build.sh` 打包正式版本
3. 测试所有平台的安装包
4. 编写发布说明

### 部署阶段
1. 提供安装包（.dmg, .exe, .AppImage）
2. 提供启动脚本（start.sh）
3. 提供使用文档（QUICK_START.md）

---

## 📚 相关文档

- [QUICK_START.md](QUICK_START.md) - 快速开始指南
- [BUILD_README.md](BUILD_README.md) - 完整打包指南
- [README.md](README.md) - 项目文档

---

## ⚡ 快速参考

```bash
# 开发
./run.sh              # 启动开发模式
./stop.sh             # 停止应用

# 打包
./build.sh            # 打包应用

# 部署
./start.sh            # 智能启动
xattr -cr app.app     # 移除隔离属性

# 调试
tail -f /tmp/51chigua-app.log  # 查看日志
ps aux | grep electron          # 查看进程
```
