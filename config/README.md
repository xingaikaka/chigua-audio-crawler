# 站点配置说明

## 📁 配置文件结构

每个站点都有独立的配置文件，确保不同站点之间配置隔离清晰。

```
config/
├── sites.json          # 站点列表和总配置
├── 51chigua.json       # 51吃瓜站点配置
├── tianya.json         # 天涯社区站点配置
├── uaa.json            # UAA有声小说站点配置
└── README.md           # 本说明文档
```

---

## 🔧 通用配置项说明

### 基础配置

```json
{
  "crawlerModule": "站点爬虫模块名称",
  "siteType": "站点类型（video/audio/forum等）",
  "baseUrl": "站点基础URL",
  "timeout": 10000,
  "userAgent": "浏览器User-Agent",
  "pageSize": 20,
  "maxConcurrent": 3,
  "maxWorkers": 5,
  "requestTimeout": 60000
}
```

### 🍪 Cookie登录配置（重要）

每个站点都可以独立配置登录状态：

```json
{
  "loginRequired": false,
  "loginUrl": "https://example.com/login",
  "cookies": {},
  "cookieString": ""
}
```

#### 配置项说明：

- **`loginRequired`** (boolean)
  - `true`: 启用登录状态，请求时自动携带Cookie
  - `false`: 不需要登录（默认）

- **`loginUrl`** (string)
  - 站点的登录页面URL（仅供参考）

- **`cookies`** (object)
  - Cookie键值对对象格式
  - 例如：`{ "token": "xxx", "SESSION": "yyy" }`
  - 适合结构化管理Cookie

- **`cookieString`** (string)
  - 完整的Cookie字符串（优先使用）
  - 例如：`"token=xxx; SESSION=yyy; _ga=zzz"`
  - 可以直接从浏览器开发者工具复制

---

## 📋 如何配置Cookie

### 方法1：使用cookieString（推荐）

1. **打开目标站点**（例如：`https://www.uaa.com`）
2. **登录您的账号**
3. **打开浏览器开发者工具** (F12)
4. **进入Network标签**
5. **随便点击一个请求**
6. **查看Request Headers**
7. **复制Cookie字段的完整内容**

在配置文件中：

```json
{
  "loginRequired": true,
  "cookieString": "粘贴完整的Cookie内容"
}
```

### 方法2：使用cookies对象

如果您想结构化管理Cookie：

```json
{
  "loginRequired": true,
  "cookies": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "SESSION": "OTcwNzE3MDMtZTc3Ni00ZmNmLTg2YTMtYjdhMTY5Yzg3MjJj",
    "_ga": "GA1.1.650150967.1770612776"
  }
}
```

---

## 🎯 各站点配置示例

### 51chigua.json（51吃瓜）

```json
{
  "crawlerModule": "51chigua",
  "siteType": "video",
  "baseUrl": "https://51cg1.com",
  
  "loginRequired": false,
  "cookies": {},
  "cookieString": "",
  
  "excludeCategories": ["官方活动", "官方信息"],
  "imageDecryptKey": "...",
  "imageDecryptIV": "..."
}
```

### uaa.json（UAA有声小说）

```json
{
  "crawlerModule": "uaa",
  "siteType": "audio",
  "baseUrl": "https://www.uaa.com",
  
  "loginRequired": true,
  "loginUrl": "https://www.uaa.com/login",
  "cookieString": "token=xxx; SESSION=yyy; ...",
  
  "categories": [...],
  "selectors": {...}
}
```

### tianya.json（天涯社区）

```json
{
  "crawlerModule": "tianya",
  "siteType": "forum",
  "baseUrl": "https://tianya.example.com",
  
  "loginRequired": false,
  "cookies": {},
  "cookieString": ""
}
```

---

## 🔒 安全注意事项

⚠️ **重要提醒：**

1. **不要将包含真实Cookie的配置文件提交到公开仓库**
2. **Cookie包含您的登录凭证，泄露可能导致账号被盗**
3. **建议在`.gitignore`中添加：**
   ```
   config/*-private.json
   config/*.local.json
   ```
4. **定期检查Cookie有效期，过期后需重新获取**

---

## 🛠️ 工作原理

1. **站点识别**：系统根据请求URL自动识别站点
2. **配置加载**：加载对应站点的配置文件
3. **Cookie注入**：如果`loginRequired=true`，自动在HTTP请求头中添加Cookie
4. **日志输出**：在控制台输出Cookie使用情况

```
[Cookie] 使用 uaa 站点的Cookie
[HTTP] 携带Cookie (token=eyJhbGciOiJIUzI1NiJ9...)
```

---

## 🎨 添加新站点

1. **创建配置文件**：`config/newsite.json`
2. **填写基础配置**
3. **配置Cookie（如需要）**
4. **在`sites.json`中注册站点**
5. **在`crawler/utils.js`的`SITE_URL_MAP`中添加URL映射**

示例：

```javascript
// crawler/utils.js
const SITE_URL_MAP = {
  'uaa.com': 'uaa',
  '51cg': '51chigua',
  'tianya': 'tianya',
  'newsite.com': 'newsite'  // 新增
};
```

---

## 📞 问题排查

### Cookie不生效？

1. 检查`loginRequired`是否为`true`
2. 检查`cookieString`或`cookies`是否配置正确
3. 查看控制台是否有`[Cookie]`开头的日志
4. 确认Cookie未过期

### 请求返回401/403？

1. Cookie可能已过期，重新获取
2. 站点可能检测到自动化访问
3. 检查`User-Agent`是否设置正确

---

## 📚 更多信息

如有问题，请查看：
- 项目主README.md
- 控制台日志输出
- 浏览器Network面板

最后更新：2026-02-09
