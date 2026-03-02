/**
 * 草榴社区 (t66y.com) 同步任务
 *
 * 完整对齐 51吃瓜 taskQueue.js 的同步流程：
 *   Step 1  检查是否已同步
 *   Step 2  获取帖子详情（图片 + 视频）
 *   Step 3  处理封面图（下载 → 上传 R2）
 *   Step 4  处理内容图片（下载 → 上传 R2 → imageMapping）
 *   Step 5  处理视频（M3U8 / MP4 → M3U8Processor → videoResourceKeys）
 *   Step 6  生成富文本（apiClient.generateRichTextContent）
 *   Step 7  组装同步数据（与后端 API 格式完全一致）
 *   Step 8  调用 apiClient.syncPost
 */

const { getThreadDetail } = require('./t66yListParser');
const R2Uploader = require('../r2Uploader');
const M3U8Processor = require('../m3u8Processor');
const ApiClient = require('../apiClient');
const { generateCoverBuffer } = require('../coverGenerator');
const { addWatermarksToImage } = require('../watermark');
const https = require('https');
const http = require('http');

const TaskStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// ─── 辅助：直接下载图片字节（t66y 图片未加密） ───────────────────────

async function downloadImageBytes(imgUrl, timeout = 30000) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(imgUrl);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://t66y.com/',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        },
        timeout,
        rejectUnauthorized: false
      };

      const req = protocol.request(options, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers['location'];
          if (loc) return resolve(downloadImageBytes(loc, timeout));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const data = Buffer.concat(chunks);
          if (data.length < 100) return reject(new Error(`数据太小: ${data.length} bytes`));
          resolve(data);
        });
        res.on('error', reject);
      });

      req.on('timeout', () => { req.destroy(); reject(new Error('下载超时')); });
      req.on('error', reject);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

function getFileExt(url) {
  try {
    const p = new URL(url).pathname.split('/').pop();
    if (p && p.includes('.')) {
      const ext = p.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext;
      }
    }
  } catch (_) {}
  return 'jpg';
}

// ─── 同步任务类 ──────────────────────────────────────────────────────

class T66YSyncTask {
  constructor(item, config) {
    this.id = item.id || `t66y-${item.tid}`;
    this.item = item;
    this.config = config;
    this.status = TaskStatus.PENDING;
    this.progress = 0;
    this.currentStep = '';
    this.error = null;
    this.result = null;
    this.startTime = null;
    this.endTime = null;
    this.onProgress = null;
  }

  updateProgress(step, progress, details = {}) {
    this.currentStep = step;
    this.progress = Math.min(100, Math.max(0, progress));
    if (this.onProgress) {
      this.onProgress({ taskId: this.id, status: this.status, step, progress: this.progress, details });
    }
  }

  async execute() {
    this.status = TaskStatus.RUNNING;
    this.startTime = Date.now();
    this.updateProgress('开始同步', 0);

    const tid = this.item.tid || this.id.replace('t66y-', '');
    console.log(`\n[T66Y-Task ${this.id}] 开始同步: ${this.item.title} (tid=${tid})`);

    try {
      const r2Uploader = new R2Uploader(this.config);
      const apiClient = new ApiClient(this.config);

      // ─── Step 1: 检查是否已同步 ────────────────────────────────────
      this.updateProgress('检查同步状态', 5);
      const tidInt = parseInt(tid);
      if (tidInt && !isNaN(tidInt) && tidInt > 0) {
        try {
          const existsResult = await Promise.race([
            apiClient.checkPostsExistsBatch([String(tidInt)]),
            new Promise((_, rej) => setTimeout(() => rej(new Error('超时')), 5000))
          ]);
          const key = String(tidInt);
          if (existsResult && existsResult[key] && existsResult[key].exists) {
            this.status = TaskStatus.COMPLETED;
            this.progress = 100;
            this.result = { success: true, skipped: true, post_id: existsResult[key].post_id, message: '文章已存在' };
            this.endTime = Date.now();
            this.updateProgress('文章已存在', 100, { skipped: true, completed: true, post_id: existsResult[key].post_id });
            console.log(`[T66Y-Task ${this.id}] 文章已存在，跳过`);
            return this.result;
          }
        } catch (e) {
          console.warn(`[T66Y-Task ${this.id}] 检查同步状态失败（继续）:`, e.message);
        }
      }

      // ─── Step 2: 获取帖子详情（图片 + 视频） ──────────────────────
      this.updateProgress('获取帖子详情', 10);
      const detailData = await getThreadDetail(this.item.url, 20);

      const finalTitle = (detailData.title || this.item.title || '').trim().substring(0, 255);
      if (!finalTitle) throw new Error('无法获取帖子标题');

      console.log(`[T66Y-Task ${this.id}] 详情: 图片=${detailData.images.length}, 视频=${detailData.videos.length}`);

      // source_id = tid（整数）
      const source_id = tidInt && !isNaN(tidInt) && tidInt > 0 ? tidInt : null;
      if (!source_id) throw new Error(`无效的 tid: ${tid}`);

      // ─── Step 3: 处理封面图（最多取前3张合成拼贴封面） ───────────────
      this.updateProgress('处理封面图', 15);
      let coverImageResourceKey = null;

      const coverSourceUrls = detailData.images.length > 0 ? detailData.images : [];
      if (coverSourceUrls.length > 0) {
        try {
          const now = new Date();
          const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;
          const coverFilename = `images/t66y/${dateStr}/${tid}/cover.jpg`;

          console.log(`[T66Y-Task ${this.id}] 生成封面（共 ${coverSourceUrls.length} 张图片，取前 ${Math.min(coverSourceUrls.length, 3)} 张）`);
          const coverBuffer = await generateCoverBuffer(coverSourceUrls);

          if (coverBuffer) {
            const uploadResult = await r2Uploader.uploadImageData(coverBuffer, coverFilename, 'jpg');
            if (uploadResult && uploadResult.success) {
              coverImageResourceKey = uploadResult.resource_key;
              console.log(`[T66Y-Task ${this.id}] 封面上传成功: ${coverImageResourceKey}`);
            }
          }
        } catch (e) {
          console.warn(`[T66Y-Task ${this.id}] 封面处理失败（继续）:`, e.message);
        }
      }

      // ─── Step 4: 处理内容图片（含水印） ──────────────────────────
      this.updateProgress('处理内容图片', 20);
      const imageMapping = {};
      const totalImages = detailData.images.length;
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;

      // 水印配置：过滤出已启用的水印
      const allWatermarks = this.config.watermarks || [];
      const activeWatermarks = allWatermarks.filter(w => w.enabled !== false);
      if (allWatermarks.length > 0 && activeWatermarks.length === 0) {
        console.log(`[T66Y-Task ${this.id}] 已配置 ${allWatermarks.length} 个水印，但均未启用`);
      }

      for (let i = 0; i < detailData.images.length; i++) {
        const imgUrl = detailData.images[i];
        const imgProgress = 20 + Math.floor((i / (totalImages || 1)) * 30);
        this.updateProgress(`处理图片 ${i+1}/${totalImages}`, imgProgress);

        try {
          let imgData = await downloadImageBytes(imgUrl);
          const ext = getFileExt(imgUrl);

          // 加水印（仅对 JPEG/PNG 格式生效，WebP 直接跳过）
          if (activeWatermarks.length > 0) {
            const isJpeg = imgData[0] === 0xFF && imgData[1] === 0xD8;
            const isPng  = imgData[0] === 0x89 && imgData[1] === 0x50 && imgData[2] === 0x4E && imgData[3] === 0x47;
            if (isJpeg || isPng) {
              try {
                console.log(`[T66Y-Task ${this.id}] 图片 ${i+1} 添加水印 (${activeWatermarks.length} 个)...`);
                const watermarked = await addWatermarksToImage(imgData, activeWatermarks);
                if (watermarked) imgData = watermarked;
              } catch (we) {
                console.warn(`[T66Y-Task ${this.id}] 图片 ${i+1} 水印失败（继续）:`, we.message);
              }
            } else {
              console.log(`[T66Y-Task ${this.id}] 图片 ${i+1} 为 WebP 格式，跳过水印`);
            }
          }

          // 文件名格式与 51吃瓜一致
          const ts1 = Date.now();
          const u1 = Math.random().toString(36).substring(2, 10);
          const ts2 = Date.now() - Math.floor(Math.random() * 10000);
          const u2 = Math.random().toString(36).substring(2, 11);
          const imgFilename = `uploads/${ts1}_${u1}_${ts2}_${u2}.${ext}`;

          const uploadResult = await r2Uploader.uploadImageData(imgData, imgFilename, ext);
          if (uploadResult && uploadResult.success) {
            imageMapping[imgUrl] = uploadResult.resource_key;
            console.log(`[T66Y-Task ${this.id}] 图片 ${i+1} 上传成功: ${uploadResult.resource_key}`);
          }
        } catch (e) {
          console.warn(`[T66Y-Task ${this.id}] 图片 ${i+1} 处理失败（继续）:`, e.message);
        }
      }

      // ─── Step 5: 处理视频（M3U8 / MP4，与51吃瓜完全一致） ─────────
      this.updateProgress('处理视频', 55);
      const videoResourceKeys = [];

      if (detailData.has_video && detailData.videos.length > 0) {
        const totalVideos = detailData.videos.length;
        console.log(`[T66Y-Task ${this.id}] 共有 ${totalVideos} 个视频需要处理`);

        for (let vi = 0; vi < totalVideos; vi++) {
          const videoUrl = detailData.videos[vi];
          console.log(`[T66Y-Task ${this.id}] 处理视频 [${vi+1}/${totalVideos}]: ${videoUrl}`);

          const videoSubDir = `video_${vi}`;
          const m3u8Processor = new M3U8Processor(
            r2Uploader,
            String(source_id),
            this.config.maxWorkers || 5,
            videoSubDir
          );

          const progressCallback = (step, current, total) => {
            const base = 55 + Math.floor((vi / totalVideos) * 30);
            let val = base;
            if (step === 'downloading_ts') val = base + Math.floor((current / total) * 12);
            else if (step === 'uploading_ts') val = base + 12 + Math.floor((current / total) * 12);
            this.updateProgress(`处理视频 ${vi+1}/${totalVideos}`, val, { step, current, total });
          };

          const videoUrlLower = videoUrl.toLowerCase().split('?')[0];
          try {
            if (videoUrlLower.includes('.m3u8')) {
              console.log(`[T66Y-Task ${this.id}] 视频 ${vi+1}: M3U8 格式`);
              const m3u8Result = await m3u8Processor.processM3U8(videoUrl, this.config.r2PreviewDomain, progressCallback);
              if (m3u8Result) {
                videoResourceKeys.push({ resource_key: m3u8Result.m3u8_resource_key, poster: null });
                console.log(`[T66Y-Task ${this.id}] ✅ 视频 ${vi+1} M3U8 成功: ${m3u8Result.m3u8_resource_key}`);
              } else {
                videoResourceKeys.push(null);
                console.error(`[T66Y-Task ${this.id}] ❌ 视频 ${vi+1} M3U8 处理失败`);
              }
            } else if (/\.(mp4|mov|webm|flv|mkv)$/.test(videoUrlLower)) {
              // 直链视频文件（mp4/mov/webm/flv/mkv 等格式统一走下载+上传逻辑）
              const extMatch = videoUrlLower.match(/\.(mp4|mov|webm|flv|mkv)$/);
              const videoExt = extMatch ? extMatch[1] : 'mp4';
              console.log(`[T66Y-Task ${this.id}] 视频 ${vi+1}: 直链视频格式(.${videoExt})`);
              const mp4Result = await m3u8Processor.processMp4(videoUrl, progressCallback, videoExt);
              if (mp4Result) {
                videoResourceKeys.push({ resource_key: mp4Result.video_resource_key, poster: mp4Result.cover_resource_key || null });
                console.log(`[T66Y-Task ${this.id}] ✅ 视频 ${vi+1} 成功: ${mp4Result.video_resource_key}`);
              } else {
                videoResourceKeys.push(null);
                console.error(`[T66Y-Task ${this.id}] ❌ 视频 ${vi+1} 处理失败`);
              }
            } else {
              console.warn(`[T66Y-Task ${this.id}] 视频 ${vi+1}: 未识别格式(${videoUrl})，跳过`);
              videoResourceKeys.push(null);
            }
          } catch (e) {
            console.error(`[T66Y-Task ${this.id}] 视频 ${vi+1} 处理异常:`, e.message);
            videoResourceKeys.push(null);
          }
        }
      } else {
        console.log(`[T66Y-Task ${this.id}] 无视频，跳过视频处理`);
      }

      // ─── Step 6: 直接用 R2 key 构建最终富文本 HTML ──────────────────
      // t66y 图片 URL 存储在自定义属性 ess-data 中（img[src] 为空），
      // generateRichTextContent 无法匹配，直接手动构建富文本。
      this.updateProgress('生成富文本', 88);

      let finalContentHtml = '';

      // 文字摘要（去掉 HTML 标签）
      const plainText = (detailData.content || '').replace(/<[^>]*>/g, '').trim();
      if (plainText) {
        finalContentHtml += `<p>${plainText.substring(0, 800)}</p>\n`;
      }

      // 图片：直接用 R2 resource_key 作为 src
      for (const [, r2Key] of Object.entries(imageMapping)) {
        finalContentHtml += `<p><img src="${r2Key}" draggable="true" style="cursor: grab;" /></p>\n`;
      }

      // 图片上传失败时保底：原始 URL 直接写入
      if (Object.keys(imageMapping).length === 0 && detailData.images.length > 0) {
        detailData.images.forEach(imgUrl => {
          finalContentHtml += `<p><img src="${imgUrl}" /></p>\n`;
        });
      }

      // 视频：与51吃瓜完全一致的 <video> 标签格式
      const validVideos = videoResourceKeys.filter(v => v !== null);
      validVideos.forEach((vData) => {
        const isM3U8 = vData.resource_key.includes('.m3u8');
        const mimeType = isM3U8 ? 'application/x-mpegURL' : 'video/mp4';
        const poster = vData.poster || (validVideos.length === 1 && coverImageResourceKey ? coverImageResourceKey : '');
        const posterAttr = poster ? ` poster="${poster}"` : '';
        finalContentHtml += `<video controls="controls" contenteditable="false" data-hls-src="${vData.resource_key}" src="${vData.resource_key}"${posterAttr} style="max-width: 400px; width: auto; height: auto; display: block; margin: 4px 0px; cursor: pointer; border-radius: 4px; transition: box-shadow 0.2s; object-fit: contain; box-shadow: none;">\n<source src="${vData.resource_key}" type="${mimeType}">\n</video>\n`;
      });

      console.log(`[T66Y-Task ${this.id}] 富文本构建完成: 长度=${finalContentHtml.length}, 图片=${Object.keys(imageMapping).length}, 视频=${validVideos.length}`);

      // ─── Step 7: 组装同步数据（与后端 API 完全一致） ─────────────
      this.updateProgress('准备同步数据', 95);

      const has_video = validVideos.length > 0;

      const syncData = {
        source_id,                                         // 整数 tid
        uid: this.config.syncUid,                          // 必需
        title: finalTitle,                                 // 必需，限255字符
        content: finalContentHtml,                         // 直接含 R2 key 的富文本
        description: null,
        cover_image: coverImageResourceKey || null,
        has_video,
        views_count: null,
        likes_count: null,
        comments_count: null,
        shares_count: null,
        purchase_count: null,
        visibility: 'public',
        assigned_role_code: this.config.roleCode || 'jianzhi',
        created_at: null,
        updated_at: null
      };

      console.log(`[T66Y-Task ${this.id}] 同步数据: source_id=${source_id}, has_video=${has_video}, 图片=${Object.keys(imageMapping).length}, 视频=${videoResourceKeys.filter(v=>v).length}`);

      // ─── Step 8: 调用同步 API ─────────────────────────────────────
      this.updateProgress('调用同步API', 98);
      const syncResult = await apiClient.syncPost(syncData);

      if (syncResult && syncResult.success) {
        this.status = TaskStatus.COMPLETED;
        this.progress = 100;
        this.result = syncResult;
        this.endTime = Date.now();
        this.updateProgress('同步完成', 100, { completed: true, post_id: syncResult.post_id });
        console.log(`[T66Y-Task ${this.id}] ✅ 同步成功 post_id=${syncResult.post_id}`);
        return this.result;
      } else {
        throw new Error(syncResult?.message || syncResult?.error || '同步API返回失败');
      }

    } catch (error) {
      this.endTime = Date.now();
      console.error(`[T66Y-Task ${this.id}] ❌ 失败:`, error.message);
      this.status = TaskStatus.FAILED;
      this.error = error.message;
      this.updateProgress('同步失败', this.progress, { error: error.message });
      throw error;
    }
  }
}

module.exports = { T66YSyncTask, TaskStatus };
