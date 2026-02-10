# 帖子同步接口文档

本文档整理帖子同步相关接口与前端调用参数方法，来源于当前工程实现。

## 1. 源站接口

### 1.1 帖子列表

- 方法: `POST`
- 地址: `postApiUrl`（默认 `https://.../BBS/PostList`）
- 请求头:
  - `Content-Type: application/x-www-form-urlencoded; charset=UTF-8`
  - `X-AUTH-UUID: <postAuthUuid>`（可选）
- 请求体: URL 编码字符串（`postRequestData`）

参数结构（由前端面板组装）:

```
PageIndex=1
&PageSize=10
&SortType=1
&ChannelId=
&SubChannelId=
&ActressId=
&KeyWord=
```

前端参数方法:
- 解析请求体到面板: `applyPostParamsFromRequest()`
- 组装请求参数: `buildPostParamsFromInputs()`
- 回写 URL 编码: `updatePostRequestDataFromParams()`

### 1.2 帖子详情

- 方法: `POST`
- 地址: `postDetailApiUrl`（默认 `https://.../BBS/PostDetail`）
- 请求头: 与列表一致，含 `X-AUTH-UUID`（来自列表配置）
- 请求体:

```
id=<帖子ID>
```

前端方法:
- `updatePostDetailRequestDataFromId(id)`
- 爬取使用: `fetchPostDetailForCrawl(item)`

## 2. 同步接口

### 2.1 同步帖子

- 方法: `POST`
- 地址: 根据 `syncApiUrl` 计算
  - 若含 `/api/video/sync-video` => `/api/crawler/post/sync`
  - 若含 `/sync-video` => `/crawler/post/sync`
  - 其它 => `<syncApiUrl>/crawler/post/sync`

请求头:
- `Content-Type: application/json`
- `X-CRAWLER-TOKEN`（可选）
- `X-AUTH-UUID`（可选）

请求体字段（后端校验）:

```
source_id: integer (required)
uid: string (required)
title: string (required)
content: string (nullable)
description: string (nullable)
cover_image: string (nullable)
has_video: boolean (nullable)
views_count: integer (nullable)
likes_count: integer (nullable)
comments_count: integer (nullable)
shares_count: integer (nullable)
purchase_count: integer (nullable)
visibility: public | followers | private (nullable)
assigned_role_code: string (nullable)
platform_id: integer (nullable)
is_shared: boolean (nullable)
created_at: date (nullable)
updated_at: date (nullable)
```

前端实际同步 payload:

```
{
  "source_id": 45869,
  "uid": "1765988676000011375",
  "title": "帖子标题",
  "content": "<p>富文本内容</p>",
  "description": "简介",
  "cover_image": "r2/path/cover.jpg",
  "has_video": false,
  "views_count": 123,
  "likes_count": 10,
  "comments_count": 2,
  "shares_count": 0,
  "purchase_count": 0,
  "visibility": "public",
  "is_shared": false,
  "assigned_role_code": "jianzhi"
}
```

说明:
- `uid` 与 `assigned_role_code` 由面板输入（`postSyncUid` / `postRoleCode`）。
- `content` 由 `buildPostRichContent()` 生成，会把图片替换为 R2 路径。

### 2.2 批量查询是否已同步

- 方法: `POST`
- 地址: 根据 `syncApiUrl` 计算
  - 若含 `/api/video/sync-video` => `/api/crawler/post/exists-batch`
  - 若含 `/sync-video` => `/crawler/post/exists-batch`
  - 其它 => `<syncApiUrl>/crawler/post/exists-batch`

请求体:

```
{
  "items": [
    { "id": "45869", "title": "标题可选" }
  ]
}
```

响应:

```
{
  "success": true,
  "items": [
    { "id": "45869", "exists": true, "post_id": 123 }
  ]
}
```

## 3. 前端面板配置项

- `postApiUrl` / `postAuthUuid` / `postRequestData`
- `postDetailApiUrl` / `postDetailRequestData`
- `postSyncUid` / `postRoleCode`
- `syncApiUrl` / `syncApiKey` / `syncAuthUuid`

## 4. 同步流程概要

1. 列表接口取帖子
2. 详情接口取详情 + 图片列表
3. 图片上传到 R2
4. 生成富文本内容（替换图片路径）
5. 调用 `/api/crawler/post/sync` 写入

如需补充完整请求/响应示例或测试用例，请告诉我具体格式要求。
