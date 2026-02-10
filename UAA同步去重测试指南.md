# UAA 同步去重测试指南

## 📋 测试目标

验证 UAA 有声小说同步功能的以下特性：
1. ✅ `exists-batch` API 能正确检测已同步数据
2. ✅ 同步完成后，卡片能正确标记为"已同步"状态
3. ✅ 已同步的数据不会被重复同步
4. ✅ 前端UI能正确显示已同步状态

---

## 🧪 测试步骤

### 步骤1: API 测试 - 验证 exists-batch

```bash
cd /Users/lee/project/tiktok_pachong/51chigua-category-viewer
node test-uaa-exists-batch.js
```

**预期结果：**
```
✅ 测试通过！exists-batch API 工作正常！
   ✓ 已同步的数据正确识别 (ID=999999)
   ✓ 未同步的数据正确识别
   ✓ novel_id 正确返回
```

---

### 步骤2: 启动应用并同步一条数据

```bash
cd /Users/lee/project/tiktok_pachong/51chigua-category-viewer
npm start
```

**操作步骤：**
1. 切换到 **UAA有声小说** 站点
2. 选择任意分类
3. **勾选第1条数据**的checkbox
4. 点击 **"同步选中项"** 按钮
5. 等待同步完成（观察卡片底部进度条）

**预期结果：**
- 同步进度条显示：
  - ✅ 提取音频ID (5%)
  - ✅ 获取详情页 (10%)
  - ✅ 处理封面 (20%)
  - ✅ 同步小说信息 (30%)
  - ✅ 同步章节 X/Y (30-95%)
  - ✅ 完成 (100%)
- 进度条3秒后消失
- **卡片自动标记为"已同步"状态**：
  - 封面变灰（filter: grayscale(0.3)）
  - 封面上显示绿色圆形✓标记
  - checkbox被隐藏
  - 卡片不能再被选中

---

### 步骤3: 测试"检查同步状态"按钮

**操作步骤：**
1. 刷新页面或重新加载内容
2. 点击工具栏的 **"🔍 检查同步状态"** 按钮

**预期结果：**
- 显示Toast提示：`已同步: 1 个，未同步: N 个`
- **刚才同步的第1条数据自动标记为"已同步"**：
  - 封面变灰
  - 显示绿色✓标记
  - checkbox被隐藏

---

### 步骤4: 测试重复同步保护

**操作步骤：**
1. **勾选第2条和第3条数据**
2. 尝试勾选已同步的第1条数据（**应该无法勾选**）
3. 点击 **"同步选中项"** 按钮

**预期结果：**
- 第1条数据（已同步）无法被勾选
- 只有第2、3条数据被同步
- 控制台输出显示跳过已同步数据：
  ```
  [UaaTaskQueue] 跳过已同步: 第1条数据标题 (novel_id=XXX)
  [UaaTaskQueue] 实际需要同步: 2 个
  ```

---

### 步骤5: 验证数据库

连接数据库，执行以下SQL：

```sql
-- 查看最近同步的有声小说
SELECT 
  id AS novel_id,
  source_id,
  title,
  author,
  chapter_count,
  created_at
FROM audio_novels
ORDER BY created_at DESC
LIMIT 5;

-- 查看章节数据
SELECT 
  id AS chapter_id,
  novel_id,
  source_id,
  title,
  chapter_num,
  duration,
  created_at
FROM audio_novel_chapters
WHERE novel_id IN (
  SELECT id FROM audio_novels ORDER BY created_at DESC LIMIT 3
)
ORDER BY novel_id, chapter_num
LIMIT 20;
```

**预期结果：**
- `audio_novels` 表包含同步的小说数据（`source_id` = UAA音频ID）
- `audio_novel_chapters` 表包含对应的章节数据
- `chapter_count` 与实际章节数一致

---

## 🔍 关键代码逻辑

### 1. exists-batch API 调用

**文件：** `crawler/uaa/uaaTaskQueue.js`

```javascript
// 批量检查哪些已同步
const checkResults = await apiClient.checkAudioNovelsExistsBatch(items, null);

// 过滤已同步的项目
const needSyncItems = items.filter(item => {
  const audioId = item.article_id || item.id;
  const checkResult = checkResults[audioId];
  
  if (checkResult && checkResult.exists) {
    console.log(`跳过已同步: ${item.title} (novel_id=${checkResult.novel_id})`);
    return false; // 不需要同步
  }
  
  return true; // 需要同步
});
```

---

### 2. 前端检查状态并更新UI

**文件：** `src/js/renderers/uaaRenderer.js`

```javascript
async handleCheckStatus() {
  const result = await window.electronAPI.uaaCheckSyncStatus(this.currentAudioList);
  
  if (result.success) {
    // 更新每个卡片的同步状态
    Object.entries(result.results).forEach(([audioId, item]) => {
      if (item.exists) {
        // 标记卡片为已同步
        this.markCardAsSynced(audioId, item.novel_id);
      }
    });
  }
}
```

---

### 3. 同步完成后标记卡片

**文件：** `src/js/renderers/uaaRenderer.js`

```javascript
updateCardSyncProgress(itemId, progressData) {
  // ...
  
  if (status === 'completed') {
    const novelId = progressData.novelId || progressData.details?.novelId;
    
    if (novelId) {
      // 3秒后标记为已同步
      setTimeout(() => {
        this.markCardAsSynced(itemId, novelId);
      }, 3000);
    }
  }
}
```

---

### 4. 标记卡片样式

**文件：** `src/js/renderers/uaaRenderer.js`

```javascript
markCardAsSynced(audioId, novelId) {
  const card = document.querySelector(`.audio-list-item[data-audio-id="${audioId}"]`);
  
  // 添加已同步样式
  card.classList.add('synced');
  
  // 移除选中状态
  card.classList.remove('selected');
  this.selectedItems.delete(audioId);
  
  // 禁用checkbox
  const checkbox = card.querySelector('.item-checkbox');
  checkbox.checked = false;
  checkbox.disabled = true;
  
  // 添加绿色✓标记
  const badge = document.createElement('div');
  badge.className = 'sync-badge-overlay synced';
  badge.innerHTML = '<span class="badge-icon">✓</span>';
  cover.appendChild(badge);
}
```

---

## ✅ 测试检查清单

- [ ] **API测试通过** - `test-uaa-exists-batch.js` 返回成功
- [ ] **首次同步成功** - 第1条数据同步完成
- [ ] **卡片自动标记** - 同步完成后3秒，卡片显示绿色✓
- [ ] **检查状态正确** - 点击"检查同步状态"后，已同步卡片被正确标记
- [ ] **无法重复选中** - 已同步卡片的checkbox被禁用
- [ ] **批量同步去重** - 同时选择已同步和未同步数据时，已同步数据被自动跳过
- [ ] **控制台日志正确** - 显示 `[UaaTaskQueue] 跳过已同步: ...`
- [ ] **数据库验证** - `audio_novels` 和 `audio_novel_chapters` 表数据完整

---

## 🐛 常见问题排查

### 问题1: 同步完成后卡片没有标记为已同步

**排查步骤：**
1. 打开浏览器开发者工具（F12）
2. 查看Console日志，搜索关键字：`novelId`
3. 确认 `updateProgress` 是否传递了 `details: { novelId: XXX }`

**解决方案：**
检查 `crawler/uaa/uaaSyncTask.js` 最后的 `updateProgress` 调用：
```javascript
this.updateProgress('完成', 100, { novelId: novelId });
```

---

### 问题2: 检查状态后没有标记卡片

**排查步骤：**
1. 检查 `handleCheckStatus` 是否调用了 `markCardAsSynced`
2. 确认 `result.results[audioId].exists` 为 `true`
3. 检查 `data-audio-id` 是否正确匹配

**解决方案：**
在 `handleCheckStatus` 中添加日志：
```javascript
console.log('[UAA-Renderer] 检查结果:', result.results);
```

---

### 问题3: 已同步卡片仍然可以被勾选

**排查步骤：**
1. 检查CSS是否加载：`.audio-list-item.synced .item-checkbox`
2. 确认 `markCardAsSynced` 正确设置了 `checkbox.disabled = true`

**解决方案：**
强制刷新CSS缓存（Ctrl+F5）

---

## 📊 成功标准

✅ **所有测试通过**  
✅ **UI反馈清晰**  
✅ **无重复同步**  
✅ **数据库数据正确**

---

## 🎉 测试完成后

清理测试数据（可选）：
```sql
-- 删除测试数据
DELETE FROM audio_novel_chapters WHERE novel_id IN (
  SELECT id FROM audio_novels WHERE source_id IN ('999999', '888888', '777777')
);
DELETE FROM audio_novels WHERE source_id IN ('999999', '888888', '777777');
```

---

**测试人员：** _____________  
**测试日期：** _____________  
**测试结果：** ✅ 通过 / ❌ 失败  
**备注：** _______________________________
