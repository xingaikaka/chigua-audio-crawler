# Content字段格式调整说明

## 📋 调整目标

根据用户提供的模板，调整生成的 `content` 字段格式，使其能够正常显示。

## 🎯 模板格式分析

### 1. 图片标签格式

**模板格式**:
```html
<img src="uploads/1770439953952_6a092732_1770439949656_46qhzw0fh.png" draggable="true" style="cursor: grab;">
```

**特点**:
- 路径格式: `uploads/{timestamp}_{uuid}_{original_filename}`
- 必需属性: `draggable="true"`
- 样式: `style="cursor: grab;"`

### 2. 视频标签格式

**模板格式**:
```html
<video controls="controls" contenteditable="false" data-hls-src="videos/202602/06/6985b397cd9fd09939085942/b6bgf9/index.m3u8" src="videos/202602/06/6985b397cd9fd09939085942/b6bgf9/index.m3u8" poster="videos/202602/06/6985b397cd9fd09939085942/cover.jpg" style="max-width: 400px; width: auto; height: auto; display: block; margin: 4px 0px; cursor: pointer; border-radius: 4px; transition: box-shadow 0.2s; object-fit: contain; box-shadow: none;">
<source src="videos/202602/06/6985b397cd9fd09939085942/b6bgf9/index.m3u8" type="application/x-mpegURL">
</video>
```

**特点**:
- 必需属性:
  - `controls="controls"`
  - `contenteditable="false"`
  - `data-hls-src` (与src相同，用于HLS视频)
  - `src` (视频路径)
  - `poster` (封面图路径，可选)
- 样式: `max-width: 400px; width: auto; height: auto; display: block; margin: 4px 0px; cursor: pointer; border-radius: 4px; transition: box-shadow 0.2s; object-fit: contain; box-shadow: none;`
- source标签: `type="application/x-mpegURL"` (M3U8) 或 `type="video/mp4"`

## ✅ 已完成的调整

### 1. 图片标签调整 (`crawler/apiClient.js`)

**修改前**:
```javascript
$img.attr('src', newSrc);
```

**修改后**:
```javascript
$img.attr('src', newSrc);
$img.attr('draggable', 'true');
$img.attr('style', 'cursor: grab;');
```

### 2. 视频标签调整 (`crawler/apiClient.js`)

**修改前**:
```html
<video controls="controls" width="100%" style="max-width: 600px; display: block; margin: 10px 0px; width: 100%;">
  <source src="..." type="...">
</video>
```

**修改后**:
```html
<video controls="controls" contenteditable="false" data-hls-src="..." src="..." poster="..." style="max-width: 400px; width: auto; height: auto; display: block; margin: 4px 0px; cursor: pointer; border-radius: 4px; transition: box-shadow 0.2s; object-fit: contain; box-shadow: none;">
  <source src="..." type="application/x-mpegURL">
</video>
```

**新增功能**:
- 添加 `contenteditable="false"` 属性
- 添加 `data-hls-src` 属性（与src相同）
- 添加 `poster` 属性（如果有封面图）
- 调整样式以匹配模板
- 视频位置改为在内容末尾（匹配模板）

### 3. 封面图传递 (`crawler/taskQueue.js`)

**修改**:
- `generateRichTextContent` 方法新增 `coverImageResourceKey` 参数
- 在调用时传递封面图资源key，用于video的poster属性

## 📝 代码变更位置

1. **`crawler/apiClient.js`**:
   - `generateRichTextContent` 方法
   - 图片标签属性添加
   - 视频标签格式调整

2. **`crawler/taskQueue.js`**:
   - 调用 `generateRichTextContent` 时传递封面图参数

## 🎯 效果

调整后的HTML格式将完全匹配用户提供的模板，确保：
- ✅ 图片可以正常显示和拖拽
- ✅ 视频可以正常播放（包括M3U8格式）
- ✅ 视频封面图可以正常显示
- ✅ 样式和交互效果匹配模板
