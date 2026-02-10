# UAA ID匹配问题排查指南

## 🔍 问题描述

**用户反馈：**
> 数据库保存的 `source_id` 为 `1217838449105702912`，但列表加载时判断是否已经同步可能有问题。

**核心问题：**
- 列表加载后自动调用 `exists-batch` API
- API返回某些数据已同步
- 但前端没有正确标记这些卡片（没有显示绿色✓）
- 可能的原因：ID不匹配

---

## 🎯 快速诊断步骤

### 步骤1: 打开浏览器开发者工具

1. 启动应用（已自动启动）
2. 按 `F12` 或 `Cmd+Option+I`（Mac）打开开发者工具
3. 切换到 **Console** 标签

### 步骤2: 加载UAA列表

1. 点击顶部导航 **"UAA有声小说"**
2. 选择任意分类（例如：有声小说）
3. 等待列表加载完成

### 步骤3: 查看控制台输出

现在会自动输出详细的调试信息：

```
[UAA-Renderer] 自动检查同步状态...
[UAA-Renderer] 当前列表数据示例: [
  { article_id: "1217838449105702912", id: undefined, title: "xxx" },
  { article_id: "1217838722633043968", id: undefined, title: "yyy" }
]

[UaaApiClient] 批量检查同步状态: 30 个小说
[UaaApiClient] URL: http://xxx/api/crawler/audio-novel/exists-batch

[UAA-Renderer] 同步状态检查结果: {
  "1217838449105702912": { exists: true, novel_id: 765 },
  "1217838722633043968": { exists: false, novel_id: null }
}

[UAA-Renderer] 结果keys: ["1217838449105702912", "1217838722633043968", ...]

[UAA-Renderer] 检查 audioId=1217838449105702912, exists=true, novel_id=765
[UAA-Renderer] 标记卡片为已同步: 1217838449105702912 (novel_id=765)
```

**或者看到错误：**

```
[UAA-Renderer] 找不到卡片: audioId=1217838449105702912
[UAA-Renderer] 1 个已同步项在DOM中找不到对应卡片
```

---

## 🐛 可能的问题

### 问题1: article_id 提取失败

**现象：**
```
[UAA-Renderer] 当前列表数据示例: [
  { article_id: undefined, id: undefined, title: "xxx" }
]
```

**原因：**
- URL格式不匹配 `extractIdFromUrl` 的正则表达式

**检查方法：**

在浏览器Console执行：

```javascript
// 复制一个实际的detailUrl
const testUrl = "实际的URL"; // 从列表中复制

// 测试提取
const match1 = testUrl.match(/[?&]id=(\d+)/);
const match2 = testUrl.match(/\/audio\/(\d+)/);

console.log('查询参数匹配:', match1);
console.log('路径匹配:', match2);
```

---

### 问题2: ID类型不匹配

**现象：**
```
// 发送的是字符串
{ "id": "1217838449105702912" }

// 返回的可能是数字（会精度丢失）
{ "id": 1217838449105702912 }
```

**检查方法：**

在 **Network** 标签中：
1. 找到 `exists-batch` 请求
2. 查看 **Request** Payload：
   ```json
   {
     "items": [
       { "id": "1217838449105702912" }  // ✅ 应该带引号（字符串）
     ]
   }
   ```
3. 查看 **Response**：
   ```json
   {
     "items": [
       { "id": "1217838449105702912" }  // ✅ 也应该带引号
     ]
   }
   ```

**如果返回的ID没有引号（数字），说明后端有问题。**

---

### 问题3: DOM查询失败

**现象：**
```
[UAA-Renderer] 找不到卡片: audioId=1217838449105702912
```

**检查方法：**

在浏览器Console执行：

```javascript
// 1. 检查DOM中是否有这个ID
const targetId = "1217838449105702912"; // 替换为实际ID
const cards = document.querySelectorAll('.audio-list-item');
const allIds = Array.from(cards).map(c => c.dataset.audioId);

console.log('DOM中所有IDs (前10个):', allIds.slice(0, 10));
console.log('目标ID是否存在:', allIds.includes(targetId));

// 2. 尝试查询
const card = document.querySelector(`.audio-list-item[data-audio-id="${targetId}"]`);
console.log('查询结果:', card);

// 3. 手动遍历查找
const foundCard = Array.from(cards).find(c => c.dataset.audioId === targetId);
console.log('遍历查找结果:', foundCard);

// 4. 类型检查
console.log('DOM ID类型:', typeof allIds[0]);
console.log('目标ID类型:', typeof targetId);
```

---

### 问题4: API返回的ID和数据库不一致

**现象：**
- 数据库 `source_id` = `1217838449105702912`
- API返回 `exists: false`（应该是`true`）

**检查方法：**

1. 在数据库中查询：
   ```sql
   SELECT id, source_id, title 
   FROM audio_novels 
   WHERE source_id = '1217838449105702912';
   ```

2. 在 Network 标签查看API响应：
   ```json
   {
     "items": [
       {
         "id": "1217838449105702912",
         "exists": true,  // ← 应该是true
         "novel_id": 765
       }
     ]
   }
   ```

3. 如果 `exists: false` 但数据库有记录，说明后端查询逻辑有问题。

---

## 🔧 解决方案

### 解决方案1: 修复ID提取（如果article_id是undefined）

**文件：** `crawler/uaa/audioListParser.js`

检查 `extractIdFromUrl` 函数：

```javascript
function extractIdFromUrl(url) {
  if (!url) return null;
  
  // UAA格式1: /audio/intro?id=1217838722633043968
  const queryMatch = url.match(/[?&]id=(\d+)/);
  if (queryMatch) {
    console.log(`[extractId] 查询参数提取: ${queryMatch[1]}`);
    return queryMatch[1];
  }
  
  // UAA格式2: /audio/1217838722633043968
  const pathMatch = url.match(/\/audio\/(\d+)/);
  if (pathMatch) {
    console.log(`[extractId] 路径提取: ${pathMatch[1]}`);
    return pathMatch[1];
  }
  
  console.warn(`[extractId] 无法提取ID: ${url}`);
  return null;
}
```

**如果URL格式不匹配，需要添加新的匹配规则。**

---

### 解决方案2: 确保ID为字符串

**文件：** `crawler/uaa/uaaApiClient.js`

```javascript
async checkAudioNovelsExistsBatch(items, platformId = null) {
  const payload = {
    items: items.map(item => ({
      id: String(item.id || item.article_id), // ✅ 强制转换为字符串
      title: item.title,
      crawl_source_id: platformId
    }))
  };
  
  // ...
}
```

---

### 解决方案3: 后端API修复（如果需要）

如果后端返回的ID是数字类型，需要修改后端代码：

```python
# Python示例
{
    "id": str(audio_novel.source_id),  # ✅ 转换为字符串
    "exists": True,
    "novel_id": audio_novel.id
}
```

---

## 📊 完整诊断脚本

在浏览器Console中粘贴以下代码，一键诊断所有问题：

```javascript
console.clear();
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║           UAA ID匹配问题诊断工具                       ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// 1. 检查DOM
const cards = document.querySelectorAll('.audio-list-item');
console.log(`✓ 步骤1: 检查DOM`);
console.log(`  - 卡片总数: ${cards.length}`);

if (cards.length > 0) {
  const domIds = Array.from(cards).slice(0, 3).map(card => ({
    id: card.dataset.audioId,
    type: typeof card.dataset.audioId,
    synced: card.classList.contains('synced')
  }));
  console.table(domIds);
} else {
  console.warn('  ⚠️ 没有找到卡片');
}

// 2. 检查列表数据
console.log(`\n✓ 步骤2: 检查列表数据`);
if (window.currentRenderer && window.currentRenderer.currentAudioList) {
  const list = window.currentRenderer.currentAudioList;
  console.log(`  - 列表长度: ${list.length}`);
  
  if (list.length > 0) {
    const listIds = list.slice(0, 3).map(item => ({
      article_id: item.article_id,
      id: item.id,
      type: typeof item.article_id,
      title: item.title ? item.title.substring(0, 20) : ''
    }));
    console.table(listIds);
  }
} else {
  console.warn('  ⚠️ 无法访问列表数据');
}

// 3. 测试查询
console.log(`\n✓ 步骤3: 测试DOM查询`);
if (cards.length > 0) {
  const testId = cards[0].dataset.audioId;
  console.log(`  - 测试ID: ${testId}`);
  console.log(`  - ID类型: ${typeof testId}`);
  
  const bySelector = document.querySelector(`.audio-list-item[data-audio-id="${testId}"]`);
  const byIteration = Array.from(cards).find(c => c.dataset.audioId === testId);
  
  console.log(`  - 属性选择器: ${bySelector ? '✅ 成功' : '❌ 失败'}`);
  console.log(`  - 遍历查找: ${byIteration ? '✅ 成功' : '❌ 失败'}`);
}

// 4. 检查已同步状态
console.log(`\n✓ 步骤4: 检查已同步状态`);
const syncedCards = document.querySelectorAll('.audio-list-item.synced');
console.log(`  - 已同步卡片: ${syncedCards.length} 个`);

if (syncedCards.length > 0) {
  const syncedIds = Array.from(syncedCards).slice(0, 3).map(card => ({
    id: card.dataset.audioId,
    hasBadge: card.querySelector('.sync-badge-overlay') !== null
  }));
  console.table(syncedIds);
}

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║                   诊断完成                              ║');
console.log('╚══════════════════════════════════════════════════════════╝');

console.log('\n📝 接下来：');
console.log('1. 检查上方输出，确认 article_id 是否存在');
console.log('2. 检查 Network 标签的 exists-batch 请求/响应');
console.log('3. 如果有问题，请截图控制台输出');
```

---

## ✅ 预期结果

如果一切正常，控制台应该显示：

```
[UAA-Renderer] 自动检查同步状态...
[UAA-Renderer] 当前列表数据示例: [
  { article_id: "1217838449105702912", id: undefined, title: "xxx" },
  ...
]

[UaaApiClient] 批量检查同步状态: 30 个小说
[UaaApiClient] 检查完成: 30 个结果

[UAA-Renderer] 同步状态检查结果: { ... }
[UAA-Renderer] 结果keys: ["1217838449105702912", ...]

[UAA-Renderer] 检查 audioId=1217838449105702912, exists=true, novel_id=765
[UAA-Renderer] 标记卡片为已同步: 1217838449105702912 (novel_id=765)
[UAA-Renderer] 自动标记了 1 个已同步项 ✅
```

**页面效果：**
- ID为 `1217838449105702912` 的卡片显示绿色✓
- checkbox被禁用
- 无法再次勾选

---

## 📞 需要帮助？

如果诊断后仍有问题，请提供：

1. **控制台完整输出**（从"自动检查同步状态"开始）
2. **Network标签中的 exists-batch 请求/响应截图**
3. **数据库查询结果**：
   ```sql
   SELECT id, source_id, title 
   FROM audio_novels 
   WHERE source_id = '1217838449105702912';
   ```
4. **一键诊断脚本的输出**

---

**创建日期：** 2026-02-09  
**相关文件：** 
- `src/js/renderers/uaaRenderer.js` - 前端渲染和标记逻辑
- `crawler/uaa/audioListParser.js` - ID提取逻辑
- `crawler/uaa/uaaApiClient.js` - API调用逻辑
- `debug-id-matching.md` - 详细诊断指南
