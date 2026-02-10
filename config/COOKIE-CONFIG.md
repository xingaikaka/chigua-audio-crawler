# Cookie配置完整指南

## 📋 配置概览

本系统已为每个站点配置独立的Cookie管理，支持登录状态维持和Cloudflare保护绕过。

---

## 🎯 各站点Cookie配置状态

### ✅ UAA有声小说 (uaa.json)

**状态**：已配置完整Cookie

```json
{
  "loginRequired": true,
  "cloudflareProtection": true,
  "useBrowserMode": false,
  
  "cookieString": "完整Cookie（已配置）",
  
  "cookies": {
    "token": "eyJhbGciOiJIUzI1NiJ9... (JWT认证令牌)",
    "SESSION": "OTcwNzE3MDMtZTc3Ni00ZmNmLTg2YTMtYjdhMTY5Yzg3MjJj",
    "_ga": "Google Analytics Cookie",
    "Hm_*": "百度统计Cookie"
  }
}
```

**Token信息**：
- 用户ID: `11837969870410260048`
- 类型: `customer`
- 过期时间: `2026年2月17日`

**特殊说明**：
- ⚠️ UAA站点受Cloudflare保护，可能仍然返回403
- 如果403错误持续，建议启用 `useBrowserMode: true`（需要安装puppeteer）

---

### ⚪ 51吃瓜 (51chigua.json)

**状态**：不需要登录

```json
{
  "loginRequired": false,
  "cookies": {},
  "cookieString": ""
}
```

**说明**：
- 51吃瓜站点无需登录即可访问
- 如果将来需要登录，按照下面的方法配置即可

---

### ⚪ 天涯社区 (tianya.json)

**状态**：待开发，暂不需要Cookie

```json
{
  "loginRequired": false,
  "cookies": {},
  "cookieString": ""
}
```

---

## 🔧 配置项说明

### loginRequired (boolean)

- `true`：启用登录状态，自动在所有请求中携带Cookie
- `false`：不携带Cookie（默认）

### cloudflareProtection (boolean)

- `true`：站点受Cloudflare保护，需要额外处理
- `false`：普通站点

### useBrowserMode (boolean)

- `true`：使用真实浏览器(puppeteer)绕过Cloudflare
- `false`：使用HTTP请求（默认，更快但可能被拦截）

### cookies (object)

结构化的Cookie键值对：

```json
{
  "key1": "value1",
  "key2": "value2"
}
```

### cookieString (string)

完整的Cookie字符串（**优先使用**）：

```
"key1=value1; key2=value2; key3=value3"
```

---

## 📝 如何获取Cookie

### 方法1：从浏览器Network面板（推荐）

1. 打开目标网站并登录
2. 按F12打开开发者工具
3. 切换到 **Network** 标签
4. 刷新页面
5. 点击任意一个请求
6. 找到 **Request Headers**
7. 复制 `Cookie:` 后面的完整内容
8. 粘贴到配置文件的 `cookieString` 字段

### 方法2：从Application面板

1. 打开目标网站并登录
2. 按F12打开开发者工具
3. 切换到 **Application** 标签
4. 展开左侧 **Cookies**
5. 点击对应域名
6. 手动复制每个Cookie的Name和Value
7. 按格式填入配置文件：`name1=value1; name2=value2`

---

## 🔍 Cookie工作原理

### 自动识别站点

系统根据URL自动识别站点：

```javascript
// crawler/utils.js
const SITE_URL_MAP = {
  'uaa.com': 'uaa',
  '51cg': '51chigua',
  'tianya': 'tianya'
};
```

### 自动注入Cookie

当访问UAA站点时：

1. 系统检测URL包含 `uaa.com`
2. 加载 `config/uaa.json`
3. 检查 `loginRequired` 是否为 `true`
4. 在HTTP请求头中自动添加Cookie
5. 输出日志：`[Cookie] 使用 uaa 站点的Cookie`

### 控制台输出

成功携带Cookie时：

```
[Cookie] 使用 uaa 站点的Cookie
[HTTP] 请求: https://www.uaa.com/audio/list (尝试 1/3)
[Cookie] 使用站点Cookie (Hm_tf_v3ixeqe37a6=1770612774; Hm_lvt_v3ixe...)
[HTTP] 成功: https://www.uaa.com/audio/list
```

---

## ⚠️ 常见问题

### Q1: 403 Forbidden错误

**现象**：即使携带Cookie，仍然返回403

**原因**：
- Cloudflare检测到自动化请求
- Cookie已过期
- 缺少必要的请求头

**解决方案**：
1. 确认Cookie未过期（查看token的exp字段）
2. 尝试启用 `useBrowserMode: true`
3. 更新Cookie（重新登录获取）
4. 检查IP是否被封禁

### Q2: 401 Unauthorized错误

**现象**：返回401未授权

**原因**：
- Token已过期
- Token无效

**解决方案**：
1. 重新登录获取新Cookie
2. 更新配置文件中的 `cookieString`

### Q3: Cookie不生效

**检查清单**：
- [ ] `loginRequired` 设置为 `true`
- [ ] `cookieString` 不为空
- [ ] Cookie格式正确（使用分号和空格分隔）
- [ ] 控制台有 `[Cookie]` 日志输出
- [ ] Cookie未过期

---

## 🔒 安全建议

### ⚠️ 严重警告

1. **不要将真实Cookie提交到公开仓库**
2. **不要与他人分享您的Cookie**
3. **定期更新Cookie（建议每周）**
4. **使用`.gitignore`排除敏感配置**

### 推荐做法

创建私有配置文件：

```bash
# 复制配置文件
cp config/uaa.json config/uaa.local.json

# 在.gitignore中添加
echo "config/*.local.json" >> .gitignore
```

---

## 📊 配置状态总结

| 站点 | 配置状态 | Cookie状态 | Cloudflare | 备注 |
|------|---------|-----------|-----------|------|
| UAA有声 | ✅ | ✅ 已配置 | ⚠️ 保护中 | Token到期:2026-02-17 |
| 51吃瓜 | ✅ | ⚪ 不需要 | ❌ 无保护 | 正常工作 |
| 天涯社区 | 🚧 | ⚪ 不需要 | ❓ 未知 | 待开发 |

---

## 🎯 添加新站点Cookie

### 步骤

1. 编辑站点配置文件：`config/newsite.json`
2. 设置 `loginRequired: true`
3. 获取Cookie并填入 `cookieString`
4. 在 `crawler/utils.js` 的 `SITE_URL_MAP` 中添加URL映射
5. 重启应用

### 示例

```json
{
  "loginRequired": true,
  "loginUrl": "https://newsite.com/login",
  "cookieString": "sessionid=xxx; csrftoken=yyy; ...",
  "cloudflareProtection": false
}
```

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

## 📞 技术支持

如遇问题，请检查：
1. 控制台日志（搜索 `[Cookie]` 和 `[HTTP]`）
2. 配置文件格式是否正确
3. Cookie是否过期
4. 网络连接是否正常

---

**最后更新**: 2026-02-09  
**配置版本**: v1.0
