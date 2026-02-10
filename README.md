# 51吃瓜分类浏览器

基于 Electron + Node.js 的桌面应用，用于浏览和查看 51吃瓜网站的分类内容。

## 功能特性

✅ **分类导航** - 自动获取网站分类，支持一级和二级分类  
✅ **内容展示** - 卡片式布局展示内容列表，包含标题、封面图、发布时间  
✅ **分页浏览** - 完整的分页功能，支持页码跳转  
✅ **响应式设计** - 适配不同屏幕尺寸  
✅ **现代化UI** - 深色主题，紫色渐变配色

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **Node.js** - 后端运行环境
- **Axios** - HTTP 请求库
- **Cheerio** - HTML 解析库
- **原生 JavaScript** - 前端逻辑

## 项目结构

```
51chigua-category-viewer/
├── package.json              # 项目依赖配置
├── .gitignore               # Git 忽略文件
├── README.md                # 项目说明文档
├── electron/                # Electron 主进程
│   ├── main.js             # 主进程入口
│   └── preload.js          # 预加载脚本（安全通信桥梁）
├── src/                    # 渲染进程（前端）
│   ├── index.html          # 主页面
│   ├── css/
│   │   └── style.css       # 样式文件
│   ├── js/
│   │   ├── renderer.js     # 渲染进程主逻辑
│   │   ├── ui.js          # UI 渲染模块
│   │   └── pagination.js  # 分页逻辑
│   └── assets/            # 静态资源
├── crawler/               # Node.js 爬虫模块
│   ├── categoryParser.js  # 分类解析器
│   ├── contentParser.js   # 内容解析器
│   └── utils.js          # 工具函数
└── config/               # 配置文件
    └── default.json      # 默认配置
```

## 快速开始

### 1. 安装依赖

```bash
cd /Users/lee/project/tiktok_pachong/51chigua-category-viewer
npm install
```

### 2. 运行应用

**开发模式**（带开发者工具）：
```bash
npm run dev
```

**生产模式**：
```bash
npm start
```

## 使用说明

1. **启动应用** - 应用会自动加载网站分类
2. **选择分类** - 点击顶部导航栏的分类名称
3. **查看内容** - 下方列表会显示该分类的内容
4. **翻页浏览** - 使用底部分页器切换页码
5. **点击卡片** - 点击内容卡片可查看更多信息（待扩展）

## 配置说明

配置文件位于 `config/default.json`：

```json
{
  "baseUrl": "https://51cg1.com",           // 网站基础URL
  "timeout": 10000,                         // 请求超时时间（毫秒）
  "userAgent": "Mozilla/5.0...",           // 请求User-Agent
  "pageSize": 20,                          // 每页显示数量
  "excludeCategories": [                   // 排除的分类
    "官方活动",
    "官方信息",
    "精品应用"
  ]
}
```

## 核心功能模块

### 1. 分类解析器 (`crawler/categoryParser.js`)

- 自动解析网站导航菜单
- 提取一级和二级分类
- 过滤不需要的分类
- 返回结构化的分类树

### 2. 内容解析器 (`crawler/contentParser.js`)

- 根据分类URL获取内容列表
- 解析标题、封面图、时间等信息
- 支持分页参数
- 智能识别多种HTML结构

### 3. UI渲染模块 (`src/js/ui.js`)

- 动态渲染分类导航
- 卡片式内容列表展示
- 分页器渲染
- Toast 提示和加载状态

### 4. 主逻辑模块 (`src/js/renderer.js`)

- 应用初始化
- 分类切换逻辑
- IPC 通信管理
- 全局状态管理

## 开发说明

### 安全机制

本项目遵循 Electron 安全最佳实践：

- ✅ `contextIsolation: true` - 启用上下文隔离
- ✅ `nodeIntegration: false` - 禁用 Node 集成
- ✅ 通过 `preload.js` 暴露安全的 API
- ✅ 渲染进程与主进程通过 IPC 通信

### IPC 通信接口

**获取分类列表**：
```javascript
window.electronAPI.getCategories()
```

**获取分类内容**：
```javascript
window.electronAPI.getContent(categoryUrl, page)
```

### 调试技巧

1. 使用 `npm run dev` 启动应用，自动打开开发者工具
2. 主进程日志会输出到终端
3. 渲染进程日志在开发者工具的 Console 中查看

## 常见问题

### Q1: 无法加载分类？

**原因**：网络问题或网站结构变化  
**解决**：
- 检查网络连接
- 查看终端错误日志
- 确认网站是否可访问

### Q2: 图片无法显示？

**原因**：图片链接失效或防盗链  
**解决**：
- 检查图片URL是否正确
- 可能需要设置 Referer 头

### Q3: 分页不工作？

**原因**：分页HTML结构变化  
**解决**：
- 检查 `utils.js` 中的 `parsePagination` 函数
- 根据实际网站结构调整选择器

## 后续扩展功能

虽然当前未实现，但预留了扩展空间：

- 📄 内容详情页查看
- 🔍 搜索功能
- ⭐ 收藏和历史记录
- 💾 下载功能
- 🪟 多窗口管理
- ⚙️ 配置界面

## 注意事项

1. 本应用仅用于学习和研究目的
2. 请遵守网站的 robots.txt 和使用条款
3. 不要过于频繁地请求，避免给网站服务器造成压力
4. 建议设置合理的请求间隔

## 更新日志

### v1.0.0 (2026-02-07)

- ✅ 实现分类导航功能
- ✅ 实现内容列表展示
- ✅ 实现分页浏览功能
- ✅ 完成基础UI设计
- ✅ 实现错误处理和用户反馈

## 许可证

MIT License

## 作者

Created with ❤️ by AI Assistant

---

**如有问题或建议，欢迎提出 Issue！**
