# 有声小说同步接口

本文档整理有声小说同步相关接口，用于爬虫侧向服务端写入数据与查询爬取状态。

## 统一说明

- Base：`{syncApiUrl}`（工具内配置的同步地址）
- 认证：使用 `crawler.ingest` 中间件，需携带配置的 Token（同现有爬虫接口一致）
- Content-Type：`application/json`
- 响应字段：`success` 为布尔值，`message` 为提示信息

工具内会自动把 `syncApiUrl` 替换为以下路径：
- `.../api/crawler/audio-novel/*`（`syncApiUrl` 形如 `.../api/video/sync-video`）
- `.../crawler/audio-novel/*`（其他情况）

---

## 1) 同步分类

**POST** `/api/crawler/audio-novel/categories/sync`

### Body
```json
{
  "platform_id": 1,
  "items": [
    {
      "id": "188",
      "name": "群交",
      "sort_order": 0
    }
  ]
}
```

### 响应示例
```json
{
  "success": true,
  "items": [
    {
      "id": "188",
      "category_id": 12
    }
  ]
}
```

---

## 2) 同步有声小说

**POST** `/api/crawler/audio-novel/sync`

### Body
```json
{
  "source_id": "97",
  "platform_id": 1,
  "title": "夫妻网管",
  "description": "夫妻网管",
  "author": "匿名",
  "cover_image": "audio-novels/202602/07/97/cover.jpg",
  "category_id": 12,
  "category_source_id": "188",
  "category_name": "群交",
  "status": 0,
  "read_count": 345,
  "likes_count": 0,
  "favorite_count": 2,
  "average_rating": 0,
  "chapter_count": 26,
  "is_active": true
}
```

### 响应示例
```json
{
  "success": true,
  "novel_id": 1001,
  "is_new": true,
  "message": "有声小说同步成功"
}
```

---

## 3) 同步章节

**POST** `/api/crawler/audio-novel/chapter/sync`

### Body
```json
{
  "novel_id": 1001,
  "source_id": "314",
  "title": "第一章  白大叔的欢爱前奏：亲吻小白兔的小嫩穴1",
  "chapter_num": 1,
  "audio_url": "audio-novels/202602/07/97/chapter_001.mp3",
  "contents": "",
  "duration": 0,
  "is_free": true,
  "is_active": true
}
```

### 响应示例
```json
{
  "success": true,
  "chapter_id": 5001,
  "is_new": true,
  "message": "章节同步成功"
}
```

---

## 4) 批量查询是否已爬取

**POST** `/api/crawler/audio-novel/exists-batch`

### Body
```json
{
  "items": [
    {
      "id": "97",
      "title": "夫妻网管",
      "crawl_source_id": 1
    }
  ]
}
```

### 响应示例
```json
{
  "success": true,
  "items": [
    {
      "id": "97",
      "exists": true,
      "novel_id": 1001
    }
  ]
}
```

---

## 字段说明

- `source_id`：来源站小说/章节 ID（字符串化）
- `platform_id`：平台 ID（可选）
- `category_source_id`/`category_name`：分类来源 ID/名称（可选）
- `cover_image`/`audio_url`：R2 路径（由前端上传后回填）
- `chapter_num`：章节序号（可选）
- `is_free`/`is_active`：是否免费/是否上架（可选）

