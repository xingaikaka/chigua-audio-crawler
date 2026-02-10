/**
 * 任务队列管理器
 * 支持多任务并发处理，每个任务处理一条记录
 */

const { parseDetail } = require('./detailParser');
const imageDecryptor = require('./imageDecryptor');
const R2Uploader = require('./r2Uploader');
const M3U8Processor = require('./m3u8Processor');
const ApiClient = require('./apiClient');

/**
 * 任务状态枚举
 */
const TaskStatus = {
  PENDING: 'pending',           // 等待中
  RUNNING: 'running',           // 运行中
  COMPLETED: 'completed',       // 已完成
  FAILED: 'failed',             // 失败
  CANCELLED: 'cancelled'        // 已取消
};

/**
 * 同步任务类
 */
class SyncTask {
  constructor(item, config) {
    this.id = item.id;
    this.item = item;
    this.config = config;
    this.status = TaskStatus.PENDING;
    this.progress = 0;
    this.currentStep = '';
    this.error = null;
    this.result = null;
    this.startTime = null;
    this.endTime = null;
  }
  
  /**
   * 更新进度
   */
  updateProgress(step, progress, details = {}) {
    this.currentStep = step;
    this.progress = Math.min(100, Math.max(0, progress));
    
    // 触发进度回调
    if (this.onProgress) {
      this.onProgress({
        taskId: this.id,
        status: this.status,
        step: step,
        progress: this.progress,
        details: details
      });
    }
  }
  
  /**
   * 执行任务
   */
  async execute() {
    this.status = TaskStatus.RUNNING;
    this.startTime = Date.now();
    this.updateProgress('开始同步', 0);
    
    console.log(`\n\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║ [Task ${this.id}] 开始执行同步任务`);
    console.log(`║ 文章URL: ${this.item.url}`);
    console.log(`║ 文章标题: ${this.item.title || '未知'}`);
    console.log(`║ article_id: ${this.item.article_id || '未设置'}`);
    console.log(`║ 配置信息:`);
    console.log(`║   - apiBaseUrl: ${this.config.apiBaseUrl}`);
    console.log(`║   - syncUid: ${this.config.syncUid}`);
    console.log(`║   - roleCode: ${this.config.roleCode}`);
    console.log(`║   - authUuid: ${this.config.authUuid || '未设置'}`);
    console.log(`║   - apiToken: ${this.config.apiToken ? '已设置' : '未设置'}`);
    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
    
    try {
      // 初始化各模块
      console.log(`[Task ${this.id}] 初始化模块...`);
      const r2Uploader = new R2Uploader(this.config);
      const apiClient = new ApiClient(this.config);
      console.log(`[Task ${this.id}] 模块初始化完成`);
      
      // Step 1: 检查是否已同步
      this.updateProgress('检查同步状态', 5);
      console.log(`[Task ${this.id}] 📍 步骤1: 开始检查同步状态`);
      console.log(`[Task ${this.id}]   步骤1开始时间: ${new Date().toISOString()}`);
      
      // 从item中提取article_id（优先使用item中的article_id，如果不存在则从URL提取）
      let articleId = this.item.article_id;
      console.log(`[Task ${this.id}]   从item获取article_id: ${articleId || '未设置'}`);
      
      if (!articleId && this.item.url) {
        const { extractArticleIdFromUrl } = require('./detailParser');
        articleId = extractArticleIdFromUrl(this.item.url);
        console.log(`[Task ${this.id}]   从URL提取article_id: ${articleId || '未提取到'}`);
      }
      
      // 如果仍然没有article_id，使用item.id（可能是临时ID）
      if (!articleId) {
        const idMatch = this.item.id.match(/item-(\d+)/);
        articleId = idMatch ? idMatch[1] : this.item.id.replace('item-', '');
        console.log(`[Task ${this.id}]   从item.id提取article_id: ${articleId}`);
      }
      
      // 验证article_id是否为有效数字
      const articleIdInt = parseInt(articleId);
      console.log(`[Task ${this.id}]   解析后的article_id: ${articleIdInt} (原始值: ${articleId})`);
      
      if (!articleIdInt || isNaN(articleIdInt) || articleIdInt <= 0) {
        console.warn(`[Task ${this.id}] ⚠️  警告：无效的article_id: ${articleId}，将在解析详情页后重试检查`);
        console.log(`[Task ${this.id}]   跳过批量检查，继续执行下一步...`);
        // 不在这里抛出错误，继续执行，在解析详情页后再检查
      } else {
        // 只有有效的article_id才进行批量检查
        console.log(`[Task ${this.id}]   准备调用 checkPostsExistsBatch，article_id: ${articleIdInt}`);
        console.log(`[Task ${this.id}]   API客户端配置:`);
        console.log(`[Task ${this.id}]     - baseUrl: ${apiClient.baseUrl}`);
        console.log(`[Task ${this.id}]     - authUuid: ${apiClient.authUuid || '未设置'}`);
        console.log(`[Task ${this.id}]     - crawlerToken: ${apiClient.crawlerToken ? apiClient.crawlerToken.substring(0, 20) + '...' : '未设置'}`);
        
        try {
          console.log(`[Task ${this.id}]   ⏳ 开始调用 checkPostsExistsBatch...`);
          console.log(`[Task ${this.id}]   调用前时间戳: ${new Date().toISOString()}`);
          
          // 添加超时保护（5秒，进一步缩短超时时间）
          const checkTimeout = 5000;
          const checkPromise = apiClient.checkPostsExistsBatch([String(articleIdInt)]);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error(`检查同步状态超时 (${checkTimeout}ms)`));
            }, checkTimeout);
          });
          
          console.log(`[Task ${this.id}]   设置超时保护: ${checkTimeout}ms`);
          const existsResult = await Promise.race([checkPromise, timeoutPromise]);
          console.log(`[Task ${this.id}]   调用后时间戳: ${new Date().toISOString()}`);
          console.log(`[Task ${this.id}]   ✅ checkPostsExistsBatch 调用完成`);
          console.log(`[Task ${this.id}]   返回结果:`, JSON.stringify(existsResult, null, 2));
          
          // 检查结果格式: {article_id: {exists: bool, post_id: integer}}
          const articleIdStr = String(articleIdInt);
          if (existsResult && existsResult[articleIdStr] && existsResult[articleIdStr].exists) {
            console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
            console.log(`║ [Task ${this.id}] ✅ 文章已存在，跳过同步`);
            console.log(`║ article_id: ${articleIdInt}`);
            console.log(`║ post_id: ${existsResult[articleIdStr].post_id}`);
            console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
            
            // 更新进度，让用户知道文章已存在
            // 标记为已完成
            this.status = TaskStatus.COMPLETED;
            this.progress = 100;
            this.result = {
              success: true,
              skipped: true,
              post_id: existsResult[articleIdStr].post_id,
              message: '文章已存在'
            };
            
            // 通知前端文章已存在（视为完成）
            this.updateProgress('文章已存在', 100, {
              skipped: true,
              completed: true,
              post_id: existsResult[articleIdStr].post_id,
              message: '文章已存在'
            });
            
            this.status = TaskStatus.COMPLETED;
            this.progress = 100;
            this.result = {
              skipped: true,
              post_id: existsResult[articleIdStr].post_id,
              message: '文章已存在'
            };
            this.endTime = Date.now();
            return this.result;
          } else {
            console.log(`[Task ${this.id}]   ✅ 文章不存在，继续同步流程`);
          }
        } catch (error) {
          console.error(`[Task ${this.id}]   ❌ checkPostsExistsBatch 调用异常:`, error);
          console.error(`[Task ${this.id}]   错误消息: ${error.message}`);
          console.error(`[Task ${this.id}]   错误堆栈:`, error.stack);
          console.log(`[Task ${this.id}]   继续执行同步流程（忽略检查错误）`);
          // 不抛出错误，继续执行
        }
      }
      
      console.log(`[Task ${this.id}] 📍 步骤1完成，继续执行步骤2...`);
      console.log(`[Task ${this.id}]   步骤1完成时间: ${new Date().toISOString()}`);
      console.log(`[Task ${this.id}]   当前articleId: ${articleId || '未设置'}`);
      console.log(`[Task ${this.id}]   当前articleIdInt: ${articleIdInt || '未设置'}`);
      
      // Step 2: 下载并解密封面图
      console.log(`[Task ${this.id}] 📍 步骤2: 开始处理封面图片`);
      console.log(`[Task ${this.id}]   封面图URL: ${this.item.cover || '未设置'}`);
      this.updateProgress('处理封面图片', 10);
      let coverImageResourceKey = null;
      if (this.item.cover) {
        try {
          const coverImageData = await imageDecryptor.downloadAndDecryptImageBytes(this.item.cover);
          if (coverImageData) {
            // 使用article_id作为文件名（如果还没有有效的article_id，使用临时ID）
            const tempArticleId = articleId && !isNaN(parseInt(articleId)) && parseInt(articleId) > 0
              ? parseInt(articleId)
              : null;
            
            // 封面图路径格式：videos/YYYYMM/DD/article_id/cover.jpg
            // 正确格式：videos/202602/06/6985b397cd9fd09939085942/cover.jpg
            // 与视频路径格式保持一致（在同一article_id目录下）
            let coverFilename;
            if (articleId) {
              const now = new Date();
              const year = now.getFullYear();
              const month = String(now.getMonth() + 1).padStart(2, '0');
              const day = String(now.getDate()).padStart(2, '0');
              // 格式：videos/202602/06/article_id/cover.jpg
              coverFilename = `videos/${year}${month}/${day}/${String(articleId)}/cover.jpg`;
            } else {
              coverFilename = `videos/temp_${Date.now()}/cover.jpg`;
            }
            
            console.log(`[Task ${this.id}]   准备上传封面图片，文件名: ${coverFilename}`);
            const uploadResult = await r2Uploader.uploadImageData(coverImageData, coverFilename, 'jpg');
            console.log(`[Task ${this.id}]   封面上传结果:`, JSON.stringify(uploadResult, null, 2));
            
            if (uploadResult && uploadResult.success) {
              // 直接使用R2返回的resource_key，不做额外处理
              coverImageResourceKey = uploadResult.resource_key;
              console.log(`[Task ${this.id}]   ✅ 封面图片上传成功: ${coverImageResourceKey}`);
            } else {
              console.error(`[Task ${this.id}]   ❌ 封面图片上传失败: ${uploadResult?.error || '未知错误'}`);
            }
          }
        } catch (error) {
          console.error(`[Task ${this.id}] 封面图片处理失败: ${error.message}`);
        }
      }
      
      // Step 3: 解析详情页
      this.updateProgress('解析详情页', 20);
      const detailData = await parseDetail(this.item.url);
      console.log(`[Task ${this.id}] 详情页解析完成: ${detailData.title}`);
      
      // 如果之前没有有效的article_id，现在使用详情页解析出的article_id
      if (!articleId || isNaN(parseInt(articleId)) || parseInt(articleId) <= 0) {
        if (detailData.article_id) {
          articleId = detailData.article_id;
          console.log(`[Task ${this.id}] 使用详情页解析的article_id: ${articleId}`);
          
          // 重新检查同步状态
          const articleIdInt = parseInt(articleId);
          if (articleIdInt && !isNaN(articleIdInt) && articleIdInt > 0) {
            const existsResult = await apiClient.checkPostsExistsBatch([String(articleIdInt)]);
            const articleIdStr = String(articleIdInt);
            if (existsResult && existsResult[articleIdStr] && existsResult[articleIdStr].exists) {
              console.log(`[Task ${this.id}] 文章已存在（详情页检查），跳过同步`);
              this.status = TaskStatus.COMPLETED;
              this.progress = 100;
              this.result = {
                skipped: true,
                post_id: existsResult[articleIdStr].post_id,
                message: '文章已存在'
              };
              this.endTime = Date.now();
              return this.result;
            }
          }
        }
      }
      
      // 确保articleId是有效的整数
      const finalArticleId = parseInt(detailData.article_id || articleId) || null;
      if (!finalArticleId || isNaN(finalArticleId) || finalArticleId <= 0) {
        throw new Error(`无法获取有效的article_id: ${detailData.article_id || articleId}`);
      }
      
      // Step 4: 处理内容中的图片
      this.updateProgress('处理内容图片', 30);
      const imageMapping = {};
      const totalImages = detailData.images.length;
      
      console.log(`\n========== [Task ${this.id}] 开始处理详情图片 ==========`);
      console.log(`[Task ${this.id}] 图片总数: ${totalImages}`);
      
      for (let i = 0; i < detailData.images.length; i++) {
        const imageUrl = detailData.images[i];
        console.log(`\n[Task ${this.id}] 📷 处理图片 [${i + 1}/${totalImages}]`);
        console.log(`[Task ${this.id}]   原始URL: ${imageUrl}`);
        
        try {
          console.log(`[Task ${this.id}]   开始下载图片...`);
          const imageData = await imageDecryptor.downloadAndDecryptImageBytes(imageUrl);
          
          if (imageData) {
            console.log(`[Task ${this.id}]   ✅ 图片下载成功，大小: ${(imageData.length / 1024).toFixed(2)} KB`);
            
            // 生成图片文件名（匹配模板格式：uploads/{timestamp1}_{uuid1}_{timestamp2}_{uuid2}.{ext}）
            // 正确格式：uploads/1770439953952_6a092732_1770439949656_46qhzw0fh.png
            // 分析：timestamp1_uuid1_timestamp2_uuid2.ext（四段）
            const timestamp1 = Date.now();
            const uuid1 = Math.random().toString(36).substring(2, 10); // 8位
            const timestamp2 = Date.now() - Math.floor(Math.random() * 10000); // 比timestamp1小的随机时间戳
            const uuid2 = Math.random().toString(36).substring(2, 11); // 9位
            
            // 从原始URL提取文件扩展名
            let fileExt = 'jpg';
            try {
              const urlObj = new URL(imageUrl);
              const pathParts = urlObj.pathname.split('/');
              const lastPart = pathParts[pathParts.length - 1];
              if (lastPart && lastPart.includes('.')) {
                const ext = lastPart.split('.').pop().toLowerCase();
                if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                  fileExt = ext === 'jpeg' ? 'jpg' : ext;
                }
              }
            } catch (e) {
              // URL解析失败，使用默认值
              console.log(`[Task ${this.id}]   URL解析失败，使用默认扩展名: ${fileExt}`);
            }
            
            // 生成文件名：{timestamp1}_{uuid1}_{timestamp2}_{uuid2}.{ext}
            // 格式：1770439953952_6a092732_1770439949656_46qhzw0fh.png（四段）
            const imageFilename = `${timestamp1}_${uuid1}_${timestamp2}_${uuid2}.${fileExt}`;
            // 上传路径：uploads/{filename}
            const uploadPath = `uploads/${imageFilename}`;
            
            console.log(`[Task ${this.id}]   上传到R2，文件名: ${uploadPath}`);
            
            const uploadResult = await r2Uploader.uploadImageData(imageData, uploadPath, fileExt);
            
            console.log(`[Task ${this.id}]   上传结果:`, JSON.stringify(uploadResult, null, 2));
            
            if (uploadResult && uploadResult.success) {
              // 直接使用R2返回的resource_key，不做额外处理
              const resourceKey = uploadResult.resource_key;
              imageMapping[imageUrl] = resourceKey;
              console.log(`[Task ${this.id}]   ✅ 图片处理完成 [${i + 1}/${totalImages}]`);
              console.log(`[Task ${this.id}]   映射: ${imageUrl.substring(0, 60)}... -> ${resourceKey}`);
            } else {
              console.error(`[Task ${this.id}]   ❌ 图片上传失败: ${uploadResult?.error || '未知错误'}`);
            }
          } else {
            console.error(`[Task ${this.id}]   ❌ 图片下载失败: 数据为空`);
          }
        } catch (error) {
          console.error(`[Task ${this.id}]   ❌ 图片处理异常 [${i + 1}/${totalImages}]:`, error);
          console.error(`[Task ${this.id}]   错误堆栈:`, error.stack);
        }
        
        // 更新进度 (30% - 60%)
        const imageProgress = 30 + Math.floor((i + 1) / totalImages * 30);
        this.updateProgress('处理内容图片', imageProgress, { current: i + 1, total: totalImages });
      }
      
      console.log(`[Task ${this.id}] 图片处理完成，成功: ${Object.keys(imageMapping).length}/${totalImages}`);
      console.log(`[Task ${this.id}] 图片映射表:`, JSON.stringify(imageMapping, null, 2));
      console.log(`========== [Task ${this.id}] 详情图片处理完成 ==========\n`);
      
      // Step 5: 处理视频（支持多视频）
      this.updateProgress('处理视频', 65);
      console.log(`\n========== [Task ${this.id}] 开始处理视频 ==========`);
      console.log(`[Task ${this.id}] has_video: ${detailData.has_video}`);
      console.log(`[Task ${this.id}] videos数组长度: ${detailData.videos ? detailData.videos.length : 0}`);
      console.log(`[Task ${this.id}] videos数组:`, detailData.videos);
      
      let videoResourceKeys = []; // 改为数组，存储所有视频的resource_key
      
      if (detailData.has_video && detailData.videos.length > 0) {
        const totalVideos = detailData.videos.length;
        console.log(`[Task ${this.id}] 共有 ${totalVideos} 个视频需要处理`);
        
        for (let videoIndex = 0; videoIndex < totalVideos; videoIndex++) {
          const videoUrl = detailData.videos[videoIndex];
          console.log(`[Task ${this.id}] 处理视频 [${videoIndex + 1}/${totalVideos}]: ${videoUrl}`);
          
          // 为每个视频创建唯一的子目录：videos/{articleId}/video_{index}/
          const videoSubDir = `video_${videoIndex}`;
          const m3u8Processor = new M3U8Processor(
            r2Uploader, 
            String(finalArticleId), 
            this.config.maxWorkers || 5,
            videoSubDir // 传递子目录名
          );
          
          const progressCallback = (step, current, total) => {
            console.log(`[Task ${this.id}] 视频${videoIndex + 1} progressCallback: step=${step}, current=${current}, total=${total}`);
            let baseProgress = 65 + Math.floor((videoIndex / totalVideos) * 25);
            let progressValue = baseProgress;
            if (step === 'downloading_ts') {
              progressValue = baseProgress + Math.floor((current / total) * 12);
            } else if (step === 'uploading_ts') {
              progressValue = baseProgress + 12 + Math.floor((current / total) * 13);
            }
            console.log(`[Task ${this.id}] 视频${videoIndex + 1} 计算进度值: ${progressValue}%`);
            this.updateProgress(`处理视频 ${videoIndex + 1}/${totalVideos}`, progressValue, { step, current, total });
          };
          
          try {
            if (videoUrl.toLowerCase().includes('.m3u8')) {
              // M3U8视频处理
              console.log(`[Task ${this.id}] 视频${videoIndex + 1}: 检测到M3U8格式`);
              const m3u8Result = await m3u8Processor.processM3U8(
                videoUrl,
                this.config.r2PreviewDomain,
                progressCallback
              );
              
              if (m3u8Result) {
                videoResourceKeys.push({
                  resource_key: m3u8Result.m3u8_resource_key,
                  poster: null // M3U8暂不支持poster
                });
                console.log(`[Task ${this.id}] ✅ 视频${videoIndex + 1} M3U8处理成功: ${m3u8Result.m3u8_resource_key}`);
              } else {
                console.error(`[Task ${this.id}] ❌ 视频${videoIndex + 1} M3U8处理失败`);
                videoResourceKeys.push(null); // 占位，保持索引对应
              }
            } else if (videoUrl.toLowerCase().includes('.mp4')) {
              // MP4视频处理
              console.log(`[Task ${this.id}] 视频${videoIndex + 1}: 检测到MP4格式`);
              const mp4Result = await m3u8Processor.processMp4(videoUrl, progressCallback);
              
              if (mp4Result) {
                videoResourceKeys.push({
                  resource_key: mp4Result.video_resource_key,
                  poster: mp4Result.cover_resource_key || null
                });
                console.log(`[Task ${this.id}] ✅ 视频${videoIndex + 1} MP4处理成功: ${mp4Result.video_resource_key}`);
              } else {
                console.error(`[Task ${this.id}] ❌ 视频${videoIndex + 1} MP4处理失败`);
                videoResourceKeys.push(null); // 占位，保持索引对应
              }
            } else {
              console.log(`[Task ${this.id}] ⚠️  视频${videoIndex + 1}: 未识别的格式`);
              videoResourceKeys.push(null); // 占位，保持索引对应
            }
          } catch (error) {
            console.error(`[Task ${this.id}] ❌ 视频${videoIndex + 1} 处理异常:`, error);
            console.error(`[Task ${this.id}] 错误堆栈:`, error.stack);
            videoResourceKeys.push(null); // 占位，保持索引对应
          }
        }
      } else {
        console.log(`[Task ${this.id}] ⚠️  跳过视频处理 - has_video=${detailData.has_video}, videos长度=${detailData.videos ? detailData.videos.length : 0}`);
      }
      
      console.log(`[Task ${this.id}] 视频处理完成，成功: ${videoResourceKeys.filter(v => v !== null).length}/${detailData.videos ? detailData.videos.length : 0}`);
      console.log(`[Task ${this.id}] videoResourceKeys:`, videoResourceKeys);
      console.log(`========== [Task ${this.id}] 视频处理完成 ==========\n`);
      
      // Step 6: 生成富文本内容
      this.updateProgress('生成富文本', 92);
      console.log(`\n========== [Task ${this.id}] 开始生成富文本 ==========`);
      console.log(`[Task ${this.id}] 传入参数:`);
      console.log(`  - content_html长度: ${detailData.content_html ? detailData.content_html.length : 0}`);
      console.log(`  - videoResourceKeys数量: ${videoResourceKeys.length}`);
      console.log(`  - videoResourceKeys:`, videoResourceKeys);
      console.log(`  - imageMapping数量: ${Object.keys(imageMapping).length}`);
      console.log(`  - coverImageResourceKey: ${coverImageResourceKey || 'null'}`);
      
      const richTextContent = apiClient.generateRichTextContent(
        detailData.content_html,
        videoResourceKeys, // 改为传递视频数组
        imageMapping,
        this.config.r2PreviewDomain,
        coverImageResourceKey // 传递封面图用于video的poster属性
      );
      
      console.log(`[Task ${this.id}] 富文本生成完成，长度: ${richTextContent ? richTextContent.length : 0}`);
      console.log(`========== [Task ${this.id}] 富文本生成完成 ==========\n`);
      
      // Step 7: 组装同步数据（符合后端API格式）
      this.updateProgress('准备同步数据', 95);
      
      console.log(`\n========== [Task ${this.id}] 开始组装同步数据 ==========`);
      
      // 将富文本内容合并到content中（后端只接受content字段）
      const finalContent = richTextContent || detailData.content || '';
      
      // 使用最终的article_id作为source_id（已在上面验证过）
      const sourceId = finalArticleId;
      
      // 验证必需字段
      if (!detailData.title || detailData.title.trim() === '') {
        throw new Error('标题不能为空');
      }
      
      console.log(`[Task ${this.id}] 数据组装详情:`);
      console.log(`  - source_id: ${sourceId} (类型: ${typeof sourceId})`);
      console.log(`  - uid: ${this.config.syncUid} (类型: ${typeof this.config.syncUid})`);
      console.log(`  - title: ${detailData.title.substring(0, 50)}... (长度: ${detailData.title.length})`);
      console.log(`  - content长度: ${finalContent.length}`);
      console.log(`  - description: ${detailData.description ? detailData.description.substring(0, 50) + '...' : 'null'}`);
      console.log(`  - cover_image: ${coverImageResourceKey || 'null'}`);
      console.log(`  - has_video: ${detailData.has_video || false}`);
      console.log(`  - 图片数量: ${Object.keys(imageMapping).length}`);
      console.log(`  - 视频数量: ${videoResourceKeys.length}`);
      console.log(`  - views_count: ${detailData.views_count || 'null'}`);
      console.log(`  - likes_count: ${detailData.likes_count || 'null'}`);
      console.log(`  - comments_count: ${detailData.comments_count || 'null'}`);
      console.log(`  - assigned_role_code: ${this.config.roleCode || 'jianzhi'}`);
      console.log(`  - created_at: ${detailData.published_at || detailData.created_at || 'null'}`);
      console.log(`  - API配置:`);
      console.log(`    - apiBaseUrl: ${this.config.apiBaseUrl}`);
      console.log(`    - authUuid: ${this.config.authUuid || '未设置'}`);
      console.log(`    - apiToken: ${this.config.apiToken ? '已设置' : '未设置'}`);
      
      const syncData = {
        source_id: sourceId, // 必需字段，整数
        uid: this.config.syncUid, // 必需字段，字符串
        title: detailData.title.trim().substring(0, 255), // 必需字段，字符串，限制255字符
        content: finalContent, // 使用富文本内容
        description: null, // 强制插入 null，不使用原始描述
        cover_image: coverImageResourceKey || null,
        has_video: detailData.has_video || false,
        views_count: detailData.views_count || null,
        likes_count: detailData.likes_count || null,
        comments_count: detailData.comments_count || null,
        shares_count: detailData.shares_count || null,
        purchase_count: detailData.purchase_count || null,
        visibility: 'public', // 默认公开
        assigned_role_code: this.config.roleCode || 'jianzhi',
        created_at: detailData.published_at || detailData.created_at || null,
        updated_at: detailData.updated_at || null
      };
      
      console.log(`[Task ${this.id}] 完整同步数据:`, JSON.stringify(syncData, null, 2));
      console.log(`========== [Task ${this.id}] 数据组装完成 ==========\n`);
      
      // Step 8: 调用同步API
      this.updateProgress('调用同步API', 98);
      console.log(`[Task ${this.id}] 准备调用同步API...`);
      const syncResult = await apiClient.syncPost(syncData);
      
      console.log(`[Task ${this.id}] 同步API返回结果:`, JSON.stringify(syncResult, null, 2));
      
      if (syncResult.success) {
        console.log(`[Task ${this.id}] ✅ 同步成功: post_id=${syncResult.post_id}, is_new=${syncResult.is_new || false}`);
        this.status = TaskStatus.COMPLETED;
        this.progress = 100;
        this.result = syncResult;
        
        // 通知前端同步成功
        this.updateProgress('同步完成', 100, { 
          completed: true,
          post_id: syncResult.post_id 
        });
      } else {
        console.error(`[Task ${this.id}] ❌ 同步失败: ${syncResult.message}`);
        console.error(`[Task ${this.id}] 失败详情:`, JSON.stringify(syncResult, null, 2));
        this.status = TaskStatus.FAILED;
        this.error = syncResult.message;
        
        // 通知前端同步失败
        this.updateProgress('同步失败', this.progress, { 
          error: syncResult.message 
        });
      }
      
      this.endTime = Date.now();
      const duration = ((this.endTime - this.startTime) / 1000).toFixed(2);
      console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
      console.log(`║ [Task ${this.id}] ✅ 任务执行完成`);
      console.log(`║ 耗时: ${duration} 秒`);
      console.log(`║ 状态: ${this.status}`);
      console.log(`║ 结果:`, JSON.stringify(this.result, null, 2));
      console.log(`╚══════════════════════════════════════════════════════════════╝\n\n`);
      
      return this.result;
      
    } catch (error) {
      this.endTime = Date.now();
      const duration = ((this.endTime - this.startTime) / 1000).toFixed(2);
      console.error(`\n╔══════════════════════════════════════════════════════════════╗`);
      console.error(`║ [Task ${this.id}] ❌ 任务执行异常`);
      console.error(`║ 耗时: ${duration} 秒`);
      console.error(`║ 错误: ${error.message}`);
      console.error(`║ 堆栈:`, error.stack);
      console.error(`╚══════════════════════════════════════════════════════════════╝\n\n`);
      this.status = TaskStatus.FAILED;
      this.error = error.message;
      
      // 通知前端任务异常
      this.updateProgress('执行失败', this.progress, { 
        error: error.message 
      });
      throw error;
    }
  }
}

/**
 * 任务队列管理器
 */
class TaskQueue {
  constructor(config, maxConcurrent = 3) {
    this.config = config;
    this.maxConcurrent = maxConcurrent;
    this.tasks = new Map();
    this.runningTasks = new Set();
    this.completedTasks = new Set();
    this.failedTasks = new Set();
  }
  
  /**
   * 添加任务
   */
  addTask(item) {
    const task = new SyncTask(item, this.config);
    this.tasks.set(task.id, task);
    return task;
  }
  
  /**
   * 添加多个任务
   */
  addTasks(items) {
    return items.map(item => this.addTask(item));
  }
  
  /**
   * 获取任务
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }
  
  /**
   * 获取所有任务
   */
  getAllTasks() {
    return Array.from(this.tasks.values());
  }
  
  /**
   * 获取等待中的任务
   */
  getPendingTasks() {
    return this.getAllTasks().filter(task => task.status === TaskStatus.PENDING);
  }
  
  /**
   * 执行单个任务
   */
  async executeTask(task) {
    console.log(`[TaskQueue] 📍 开始执行任务: ${task.id}`);
    this.runningTasks.add(task.id);
    
    try {
      console.log(`[TaskQueue]   调用 task.execute()...`);
      await task.execute();
      console.log(`[TaskQueue]   task.execute() 完成，任务状态: ${task.status}`);
      
      if (task.status === TaskStatus.COMPLETED) {
        this.completedTasks.add(task.id);
        console.log(`[TaskQueue]   ✅ 任务完成: ${task.id}`);
      } else if (task.status === TaskStatus.FAILED) {
        this.failedTasks.add(task.id);
        console.log(`[TaskQueue]   ❌ 任务失败: ${task.id}, 错误: ${task.error || '未知错误'}`);
      }
    } catch (error) {
      console.error(`[TaskQueue]   ❌ 任务执行异常: ${task.id}`);
      console.error(`[TaskQueue]   错误消息: ${error.message}`);
      console.error(`[TaskQueue]   错误堆栈:`, error.stack);
      this.failedTasks.add(task.id);
      task.status = TaskStatus.FAILED;
      task.error = error.message;
    } finally {
      this.runningTasks.delete(task.id);
      console.log(`[TaskQueue]   任务执行结束: ${task.id}，当前运行中任务数: ${this.runningTasks.size}`);
    }
  }
  
  /**
   * 开始处理队列（支持并发）
   */
  async start() {
    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║ [TaskQueue] 开始处理队列`);
    console.log(`║ 最大并发: ${this.maxConcurrent}`);
    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
    
    const pendingTasks = this.getPendingTasks();
    console.log(`[TaskQueue] 待处理任务数: ${pendingTasks.length}`);
    
    if (pendingTasks.length === 0) {
      console.log(`[TaskQueue] ⚠️  没有待处理的任务`);
      return {
        total: this.tasks.size,
        completed: this.completedTasks.size,
        failed: this.failedTasks.size
      };
    }
    
    // 并发执行任务
    const executeNext = async () => {
      console.log(`[TaskQueue] 📍 执行器启动`);
      while (true) {
        // 获取下一个待处理任务
        const nextTask = this.getPendingTasks()[0];
        if (!nextTask) {
          console.log(`[TaskQueue] 📍 执行器：没有更多待处理任务，退出`);
          break;
        }
        
        // 等待有空闲槽位
        while (this.runningTasks.size >= this.maxConcurrent) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 执行任务（使用 await 确保错误被正确处理）
        console.log(`[TaskQueue] 📍 执行器：准备执行任务 ${nextTask.id}`);
        try {
          await this.executeTask(nextTask);
          console.log(`[TaskQueue] 📍 执行器：任务 ${nextTask.id} 执行完成`);
        } catch (error) {
          console.error(`[TaskQueue] 📍 执行器：任务 ${nextTask.id} 执行异常:`, error);
        }
      }
      console.log(`[TaskQueue] 📍 执行器结束`);
    };
    
    // 启动多个执行器
    console.log(`[TaskQueue] 启动 ${this.maxConcurrent} 个执行器...`);
    const executors = [];
    for (let i = 0; i < this.maxConcurrent; i++) {
      executors.push(executeNext());
    }
    
    // 等待所有执行器完成
    console.log(`[TaskQueue] 等待所有执行器完成...`);
    await Promise.all(executors);
    
    // 等待所有运行中的任务完成
    console.log(`[TaskQueue] 等待所有运行中的任务完成...`);
    while (this.runningTasks.size > 0) {
      console.log(`[TaskQueue]   当前运行中任务数: ${this.runningTasks.size}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║ [TaskQueue] ✅ 队列处理完成`);
    console.log(`║  - 成功: ${this.completedTasks.size}`);
    console.log(`║  - 失败: ${this.failedTasks.size}`);
    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
    
    return {
      total: this.tasks.size,
      completed: this.completedTasks.size,
      failed: this.failedTasks.size
    };
  }
  
  /**
   * 获取队列统计信息
   */
  getStats() {
    return {
      total: this.tasks.size,
      pending: this.getPendingTasks().length,
      running: this.runningTasks.size,
      completed: this.completedTasks.size,
      failed: this.failedTasks.size
    };
  }
  
  /**
   * 清空队列
   */
  clear() {
    this.tasks.clear();
    this.runningTasks.clear();
    this.completedTasks.clear();
    this.failedTasks.clear();
  }
}

module.exports = {
  TaskQueue,
  SyncTask,
  TaskStatus
};
