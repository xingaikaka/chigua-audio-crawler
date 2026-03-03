/**
 * UAA 有声小说同步任务
 * 负责单个有声小说的完整同步流程
 */

const { getAudioDetail } = require('./audioDetailParser');
const UaaApiClient = require('./uaaApiClient');
const AudioDownloader = require('./audioDownloader');
const R2Uploader = require('../r2Uploader');
const {
  parseStatus,
  parseCount,
  parseRating,
  generateCoverPath,
  generateChapterPath,
  mapAudioNovelData,
  mapChapterData,
  extractAudioId
} = require('./uaaDataMapper');
const { fetchWithBrowser } = require('./browserHelper');
const cheerio = require('cheerio');

/**
 * 任务状态枚举
 */
const TaskStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

class UaaSyncTask {
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
    console.log(`║ [UAA-Task ${this.id}] 开始同步有声小说`);
    console.log(`║ 标题: ${this.item.title || '未知'}`);
    console.log(`║ 音频ID: ${this.item.article_id || '未设置'}`);
    console.log(`║ 详情URL: ${this.item.detailUrl || '未设置'}`);
    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
    
    try {
      // 初始化模块
      const apiClient = new UaaApiClient(this.config);
      const audioDownloader = new AudioDownloader(this.config);
      const r2Uploader = new R2Uploader(this.config);
      
      // Step 1: 提取音频ID
      this.updateProgress('提取音频ID', 5);
      const audioId = this.item.article_id || extractAudioId(this.item.detailUrl);
      
      if (!audioId) {
        throw new Error('无法提取音频ID');
      }
      
      console.log(`[UAA-Task ${this.id}] 音频ID: ${audioId}`);
      
      // ✅ 生成带分类标识的 source_id
      // 格式: {分类名称}_{原始ID}
      // 这样不同题材下的同一个音频会被视为不同的记录
      const categoryPrefix = this.item.category || '全部有声';
      const sourceIdWithCategory = `${categoryPrefix}_${audioId}`;
      
      console.log(`[UAA-Task ${this.id}] 📂 分类: ${categoryPrefix}`);
      console.log(`[UAA-Task ${this.id}] 🆔 带分类的source_id: ${sourceIdWithCategory}`);
      
      // ✅ 二次检查：避免并发竞态条件导致重复同步
      this.updateProgress('检查是否已同步', 8);
      console.log(`[UAA-Task ${this.id}] 📍 二次检查: 是否已同步（防止并发重复）`);
      
      const checkResult = await apiClient.checkAudioNovelsExistsBatch([{
        id: audioId,
        title: this.item.title
      }], null);
      
      if (checkResult[audioId] && checkResult[audioId].exists) {
        const existingNovelId = checkResult[audioId].novel_id;
        console.log(`[UAA-Task ${this.id}] ⚠️ 数据已存在（novel_id=${existingNovelId}），跳过同步`);
        console.log(`[UAA-Task ${this.id}] 可能原因：并发任务已完成同步`);
        
        this.status = TaskStatus.COMPLETED;
        this.endTime = Date.now();
        this.result = {
          success: true,
          novelId: existingNovelId,
          title: this.item.title,
          message: '已存在（跳过）'
        };
        
        this.updateProgress('已存在，跳过', 100, { novelId: existingNovelId });
        
        return this.result;
      }
      
      console.log(`[UAA-Task ${this.id}] ✅ 未同步，继续执行`);
      
      // Step 2: 获取详情数据
      this.updateProgress('获取详情页', 10);
      console.log(`[UAA-Task ${this.id}] 📍 步骤2: 获取详情数据`);
      
      const detailData = await getAudioDetail(audioId, this.item.detailUrl);
      
      if (!detailData || !detailData.title || detailData.title === '解析失败') {
        throw new Error(`详情数据解析失败: audioId=${audioId}, title=${detailData?.title || 'null'}`);
      }
      
      console.log(`[UAA-Task ${this.id}] 详情获取成功:`);
      console.log(`  - 标题: ${detailData.title}`);
      console.log(`  - 章节数: ${detailData.episodeCount}`);
      console.log(`  - CV: ${detailData.cv}`);
      console.log(`  - 状态: ${detailData.status}`);
      
      // Step 3: 下载并上传封面
      this.updateProgress('处理封面', 20);
      console.log(`[UAA-Task ${this.id}] 📍 步骤3: 下载并上传封面`);
      
      let coverR2Path = null;
      
      if (detailData.coverUrl) {
        try {
          console.log(`[UAA-Task ${this.id}] 开始下载封面: ${detailData.coverUrl}`);
          const coverBuffer = await audioDownloader.downloadImage(detailData.coverUrl);
          
          const coverPath = generateCoverPath(audioId, detailData.coverUrl);
          console.log(`[UAA-Task ${this.id}] 上传封面到R2: ${coverPath}`);
          
          const uploadResult = await r2Uploader.uploadCoverImage(coverBuffer, coverPath);
          
          if (uploadResult.success) {
            coverR2Path = uploadResult.resource_key;
            console.log(`[UAA-Task ${this.id}] 封面上传成功: ${coverR2Path}`);
          } else {
            console.warn(`[UAA-Task ${this.id}] 封面上传失败，继续执行: ${uploadResult.error}`);
          }
        } catch (error) {
          console.warn(`[UAA-Task ${this.id}] 封面处理失败，继续执行: ${error.message}`);
        }
      }
      
      // Step 4: 验证音频可用性（防止同步空壳小说）
      this.updateProgress('验证音频', 25);
      console.log(`[UAA-Task ${this.id}] 📍 步骤4: 验证音频可用性`);
      
      // 准备章节数据
      let episodes = detailData.episodes || [];
      const totalEpisodes = episodes.length;
      console.log(`[UAA-Task ${this.id}]   初始章节数: ${totalEpisodes}`);
      console.log(`[UAA-Task ${this.id}]   audioUrls 数量: ${detailData.audioUrls ? detailData.audioUrls.length : 0}`);
      
      // 如果没有章节列表，但有音频URL，创建虚拟章节
      if (totalEpisodes === 0 && detailData.audioUrls && detailData.audioUrls.length > 0) {
        console.log(`[UAA-Task ${this.id}] 没有章节列表，创建虚拟章节`);
        
        episodes = detailData.audioUrls.map((audioUrl, index) => {
          let chapterId = `audio_${audioId}_${index + 1}`;
          const audioIdMatch = audioUrl.match(/\/audio\/(\d+)\.mp3/);
          if (audioIdMatch) {
            chapterId = audioIdMatch[1];
          }
          
          return {
            id: chapterId,
            index: index + 1,
            title: index === 0 ? detailData.title : `${detailData.title} - 第${index + 1}集`,
            audioUrl: audioUrl,
            contents: '',
            duration: 0
          };
        });
        
        console.log(`[UAA-Task ${this.id}] 创建了 ${episodes.length} 个虚拟章节`);
      }
      
      const finalEpisodeCount = episodes.length;
      console.log(`[UAA-Task ${this.id}]   最终章节数: ${finalEpisodeCount}`);
      
      if (finalEpisodeCount === 0) {
        throw new Error('没有章节也没有音频URL，无法同步');
      }
      
      // ✅ 关键：验证第一个章节的音频是否可访问（使用 HEAD 请求，不下载整个文件）
      const firstEpisode = episodes[0];
      const firstAudioUrl = firstEpisode.audioUrl;
      
      if (!firstAudioUrl) {
        throw new Error('第一个章节没有音频URL');
      }
      
      const MAX_AUDIO_SIZE = 99 * 1024 * 1024; // 99 MB，Cloudflare Worker 上传限制
      
      console.log(`[UAA-Task ${this.id}]   验证音频可访问性: ${firstAudioUrl}`);
      try {
        const audioChecker = new AudioDownloader(this.config);
        const checkResult = await audioChecker.checkAudioAccessible(firstAudioUrl);
        
        if (!checkResult.accessible) {
          throw new Error(checkResult.error || 'URL 不可访问');
        }
        
        const sizeInfo = checkResult.contentLength != null
          ? `${(checkResult.contentLength / 1024 / 1024).toFixed(2)} MB`
          : '大小未知';
        
        // 文件超过 99MB，无法上传到 Cloudflare Worker，跳过整条数据
        if (checkResult.contentLength && checkResult.contentLength > MAX_AUDIO_SIZE) {
          const errorMsg = `音频文件过大 (${sizeInfo})，超过 99MB 上传限制，跳过同步`;
          console.warn(`[UAA-Task ${this.id}]   ⚠️ ${errorMsg}`);
          this.updateProgress('文件过大，跳过', 0, { error: errorMsg });
          throw new Error(errorMsg);
        }
        
        console.log(`[UAA-Task ${this.id}]   ✅ 音频验证成功 (${sizeInfo})`);
      } catch (error) {
        const errorMsg = error.message.startsWith('音频文件过大')
          ? error.message
          : `音频验证失败，跳过同步: ${error.message}`;
        console.error(`[UAA-Task ${this.id}]   ❌ ${errorMsg}`);
        this.updateProgress('音频验证失败', 0, { error: errorMsg });
        throw new Error(errorMsg);
      }
      
      // Step 5: 同步小说基本信息（音频已验证可用）
      this.updateProgress('同步小说信息', 30);
      console.log(`[UAA-Task ${this.id}] 📍 步骤5: 同步小说基本信息`);
      
      // ✅ 生成唯一的分类 source_id，格式：uaa_{题材名称}
      const categoryName = this.item.category || detailData.category || '全部有声';
      const categorySourceId = `uaa_${categoryName}`;
      
      console.log(`[UAA-Task ${this.id}] 📂 分类名称: ${categoryName}`);
      console.log(`[UAA-Task ${this.id}] 🔖 分类source_id: ${categorySourceId}`);
      
      const novelData = mapAudioNovelData(
        {
          ...detailData,
          article_id: audioId,
          id: audioId,
          // ✅ 确保使用列表页的题材分类（如果用户选择了题材筛选）
          category: categoryName
        },
        coverR2Path,
        null, // categoryId 暂不处理，后续可扩展
        categorySourceId // ✅ 传入唯一的分类source_id
      );
      
      console.log(`[UAA-Task ${this.id}] 小说数据:`, JSON.stringify(novelData, null, 2));
      
      // ✅ 第三次检查：在实际插入数据库前最后一次检查
      console.log(`[UAA-Task ${this.id}] 📍 第三次检查: 插入前最后验证`);
      const finalCheck = await apiClient.checkAudioNovelsExistsBatch([{
        id: audioId,
        title: detailData.title
      }], null);
      
      if (finalCheck[audioId] && finalCheck[audioId].exists) {
        const existingNovelId = finalCheck[audioId].novel_id;
        console.log(`[UAA-Task ${this.id}] ⚠️ 最后检查发现数据已存在（novel_id=${existingNovelId}）`);
        console.log(`[UAA-Task ${this.id}] → 可能是并发任务在处理封面时完成了同步，使用现有ID`);
        
        // 使用现有的 novel_id，不再调用 syncAudioNovel
        const novelId = existingNovelId;
        
        // 跳转到章节同步（如果需要）
        this.status = TaskStatus.COMPLETED;
        this.endTime = Date.now();
        this.result = {
          success: true,
          novelId: novelId,
          title: detailData.title,
          message: '已存在（最后检查发现）'
        };
        
        this.updateProgress('完成（已存在）', 100, { novelId: novelId });
        console.log(`[UAA-Task ${this.id}] ✅ 任务完成（使用现有数据）`);
        
        return this.result;
      }
      
      console.log(`[UAA-Task ${this.id}] ✅ 最后检查通过，开始插入数据库`);
      
      const syncResult = await apiClient.syncAudioNovel(novelData);
      
      if (!syncResult.success || !syncResult.novel_id) {
        throw new Error('小说同步失败');
      }
      
      const novelId = syncResult.novel_id;
      console.log(`[UAA-Task ${this.id}] 小说同步成功: novel_id=${novelId}, is_new=${syncResult.is_new}`);
      
      // Step 6: 同步章节（episodes 已在步骤4准备并验证）
      console.log(`[UAA-Task ${this.id}] 📍 步骤6: 开始同步 ${finalEpisodeCount} 个章节`);
      
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < finalEpisodeCount; i++) {
        const episode = episodes[i];
        const chapterNum = i + 1;
        const stepProgress = 30 + Math.round((i / finalEpisodeCount) * 65);
        
        this.updateProgress(`同步章节 ${chapterNum}/${finalEpisodeCount}`, stepProgress);
        
        try {
          console.log(`\n[UAA-Task ${this.id}] --- 章节 ${chapterNum}/${finalEpisodeCount} ---`);
          console.log(`[UAA-Task ${this.id}]   章节ID: ${episode.id || 'N/A'}`);
          console.log(`[UAA-Task ${this.id}]   标题: ${episode.title}`);
          console.log(`[UAA-Task ${this.id}]   所属小说ID: ${novelId}`);
          
          // 5a: 获取音频URL
          let audioUrl = episode.audioUrl;
          
          // ✅ 方案A：audioUrl已在详情页提取，直接使用
          if (audioUrl) {
            console.log(`[UAA-Task ${this.id}]   ✓ 使用已提取的音频URL: ${audioUrl}`);
          }
          // 🔄 备用方案：访问章节页提取音频URL
          else if (episode.url) {
            console.log(`[UAA-Task ${this.id}]   未找到音频URL，尝试访问章节页: ${episode.url}`);
            
            try {
              const episodeHtml = await fetchWithBrowser(episode.url, { 
                maxRetries: 2,
                waitForAudio: true  // 等待音频元素
              });
              const $ = cheerio.load(episodeHtml);
              
              // 从<audio>标签提取
              const audioSrc = $('audio[src]').attr('src') || $('audio source[src]').attr('src');
              if (audioSrc) {
                audioUrl = audioSrc.startsWith('http') 
                  ? audioSrc 
                  : `${this.config.baseUrl}${audioSrc}`;
                console.log(`[UAA-Task ${this.id}]   ✓ 从章节页提取到音频URL: ${audioUrl}`);
              }
            } catch (error) {
              console.error(`[UAA-Task ${this.id}]   ✗ 访问章节页失败: ${error.message}`);
            }
          }
          
          if (!audioUrl) {
            console.warn(`[UAA-Task ${this.id}]   ⚠️  未找到音频URL，跳过该章节`);
            failCount++;
            continue;
          }
          
          // 5b: 下载前检查文件大小，超过 99MB 跳过该章节
          console.log(`[UAA-Task ${this.id}]   检查音频文件大小...`);
          const sizeCheck = await audioDownloader.checkAudioAccessible(audioUrl);
          if (sizeCheck.accessible && sizeCheck.contentLength && sizeCheck.contentLength > MAX_AUDIO_SIZE) {
            const sizeMB = (sizeCheck.contentLength / 1024 / 1024).toFixed(2);
            console.warn(`[UAA-Task ${this.id}]   ⚠️ 章节 ${chapterNum} 文件过大 (${sizeMB} MB)，超过 99MB 限制，跳过`);
            failCount++;
            continue;
          }
          if (!sizeCheck.accessible) {
            console.warn(`[UAA-Task ${this.id}]   ⚠️ 章节 ${chapterNum} 音频不可访问 (${sizeCheck.error})，跳过`);
            failCount++;
            continue;
          }
          
          // 5c: 下载音频
          console.log(`[UAA-Task ${this.id}]   下载音频...`);
          const audioBuffer = await audioDownloader.downloadAudio(
            audioUrl,
            (current, total, percent) => {
              // 进度回调
              if (percent % 10 === 0) {
                console.log(`[UAA-Task ${this.id}]   下载进度: ${percent}%`);
              }
            }
          );
          
          // 5d: 上传到R2
          const audioR2Path = generateChapterPath(audioId, chapterNum);
          console.log(`[UAA-Task ${this.id}]   上传音频到R2: ${audioR2Path}`);
          
          const audioUploadResult = await r2Uploader.uploadAudioFile(audioBuffer, audioR2Path);
          
          if (!audioUploadResult.success) {
            throw new Error(`音频上传失败: ${audioUploadResult.error}`);
          }
          
          const audioResourceKey = audioUploadResult.resource_key;
          console.log(`[UAA-Task ${this.id}]   音频上传成功: ${audioResourceKey}`);
          
          // 5e: 同步章节数据
          const chapterData = mapChapterData(novelId, episode, chapterNum, audioResourceKey);
          console.log(`[UAA-Task ${this.id}]   同步章节数据到服务器...`);
          
          const chapterSyncResult = await apiClient.syncAudioChapter(chapterData);
          
          if (chapterSyncResult.success) {
            console.log(`[UAA-Task ${this.id}]   ✅ 章节同步成功: chapter_id=${chapterSyncResult.chapter_id}`);
            successCount++;
          } else {
            console.error(`[UAA-Task ${this.id}]   ❌ 章节同步失败`);
            failCount++;
          }
          
        } catch (error) {
          console.error(`[UAA-Task ${this.id}]   ❌ 章节处理失败: ${error.message}`);
          console.error(`[UAA-Task ${this.id}]   错误堆栈:`, error.stack);
          console.error(`[UAA-Task ${this.id}]   章节信息:`, {
            id: episode.id,
            title: episode.title,
            audioUrl: episode.audioUrl,
            chapterNum: chapterNum
          });
          failCount++;
          
          // 单个章节失败不中断整体流程，继续下一章节
        }
      }
      
      // Step 6: 完成
      console.log(`\n[UAA-Task ${this.id}] ========================================`);
      console.log(`[UAA-Task ${this.id}] 📊 章节同步统计:`);
      console.log(`[UAA-Task ${this.id}]   总数: ${finalEpisodeCount}`);
      console.log(`[UAA-Task ${this.id}]   成功: ${successCount}`);
      console.log(`[UAA-Task ${this.id}]   失败: ${failCount}`);
      if (failCount > 0) {
        console.warn(`[UAA-Task ${this.id}] ⚠️⚠️⚠️ 有 ${failCount} 个章节同步失败，请检查上面的错误日志！`);
      }
      console.log(`[UAA-Task ${this.id}] ========================================\n`);
      
      this.status = TaskStatus.COMPLETED;
      this.endTime = Date.now();
      this.result = {
        success: true,
        novelId: novelId,
        title: detailData.title,
        chapterCount: successCount,
        totalChapters: finalEpisodeCount,
        failedChapters: failCount,
        message: `同步完成 (${successCount}/${finalEpisodeCount})`
      };
      
      // 最后的进度更新，传递novelId
      this.updateProgress('完成', 100, { novelId: novelId });
      
      console.log(`\n[UAA-Task ${this.id}] ========== 同步完成 ==========`);
      console.log(`[UAA-Task ${this.id}]   成功: ${successCount}/${finalEpisodeCount}`);
      console.log(`[UAA-Task ${this.id}]   失败: ${failCount}/${finalEpisodeCount}`);
      console.log(`[UAA-Task ${this.id}]   novel_id: ${novelId}`);
      
      return this.result;
      
    } catch (error) {
      console.error(`\n[UAA-Task ${this.id}] ❌ 任务失败:`, error);
      
      this.status = TaskStatus.FAILED;
      this.endTime = Date.now();
      this.error = error.message;
      this.result = {
        success: false,
        error: error.message,
        title: this.item.title
      };
      
      // 通知 UI 该任务已失败（确保卡片显示失败状态）
      if (this.onProgress) {
        this.onProgress({
          taskId: this.id,
          status: TaskStatus.FAILED,
          step: '同步失败',
          progress: 0,
          details: { error: error.message }
        });
      }
      
      throw error;
    }
  }
  
  /**
   * 取消任务
   */
  cancel() {
    if (this.status === TaskStatus.RUNNING) {
      this.status = TaskStatus.CANCELLED;
      this.error = '任务已取消';
      console.log(`[UAA-Task ${this.id}] 任务已取消`);
    }
  }
}

module.exports = {
  UaaSyncTask,
  TaskStatus
};
