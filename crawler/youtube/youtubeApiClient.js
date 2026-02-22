/**
 * YouTube API 客户端
 * 使用 yt-search 进行搜索和数据获取
 */

const yts = require('yt-search');

class YouTubeApiClient {
  constructor(config) {
    this.config = config;
    this.searchLimit = config.searchLimit || 20;
    console.log('[YouTube-API] 初始化 YouTube API 客户端');
  }

  /**
   * 搜索视频
   * @param {string} keyword - 搜索关键词
   * @param {object} options - 搜索选项
   * @returns {Promise<Array>} 视频列表
   */
  async searchVideos(keyword, options = {}) {
    try {
      console.log(`[YouTube-API] 搜索视频: "${keyword}"`);
      
      // yt-search 返回对象，包含 all、videos、live 等数组
      const searchResults = await yts(keyword);
      
      console.log(`[YouTube-API] 搜索成功，原始结果类型:`, typeof searchResults);
      
      // 优先使用 all 数组（包含所有类型的结果，数量最多）
      let allResults = [];
      if (searchResults && searchResults.all && Array.isArray(searchResults.all)) {
        allResults = searchResults.all;
        console.log(`[YouTube-API] all 数组包含 ${allResults.length} 个结果`);
      } else if (searchResults && searchResults.videos && Array.isArray(searchResults.videos)) {
        allResults = searchResults.videos;
        console.log(`[YouTube-API] videos 数组包含 ${allResults.length} 个结果`);
      } else if (searchResults && Array.isArray(searchResults)) {
        allResults = searchResults;
      }
      
      // 过滤出视频类型（排除频道、播放列表等）
      const videos = allResults.filter(item => {
        // yt-search 中视频有 videoId 字段
        return item && (item.type === 'video' || item.videoId || item.video_id);
      });
      
      console.log(`[YouTube-API] 找到 ${videos.length} 个视频（过滤后）`);
      
      // 如果需要限制数量，在这里截取
      if (options.limit && videos.length > options.limit) {
        const limited = videos.slice(0, options.limit);
        console.log(`[YouTube-API] 限制为 ${options.limit} 个视频`);
        return limited;
      }
      
      return videos;
    } catch (error) {
      console.error('[YouTube-API] 搜索失败:', error.message);
      console.error('[YouTube-API] 错误堆栈:', error.stack);
      // 返回空数组而不是抛出错误
      return [];
    }
  }

  /**
   * 获取视频详情
   * @param {string} videoId - 视频ID或URL
   * @returns {Promise<object>} 视频详情
   */
  async getVideoInfo(videoId) {
    try {
      console.log(`[YouTube-API] 获取视频详情: ${videoId}`);
      
      // yt-search 通过搜索视频ID获取详情
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const result = await yts({ videoId: videoId });
      
      if (result) {
        console.log(`[YouTube-API] 视频详情获取成功`);
        return result;
      }
      
      throw new Error('未找到视频');
    } catch (error) {
      console.error('[YouTube-API] 获取视频详情失败:', error.message);
      return null;
    }
  }

  /**
   * 获取频道视频（通过搜索频道名称）
   * @param {string} channelName - 频道名称
   * @param {object} options - 选项
   * @returns {Promise<Array>} 视频列表
   */
  async getChannelVideos(channelName, options = {}) {
    try {
      const limit = options.limit || this.searchLimit;
      console.log(`[YouTube-API] 搜索频道: ${channelName}, 限制: ${limit}`);
      
      // 通过搜索获取频道视频
      const searchResults = await yts(channelName);
      let videos = [];
      
      if (searchResults && searchResults.videos && Array.isArray(searchResults.videos)) {
        videos = searchResults.videos.slice(0, limit);
      }
      
      console.log(`[YouTube-API] 找到 ${videos.length} 个视频`);
      return videos;
    } catch (error) {
      console.error('[YouTube-API] 搜索频道失败:', error.message);
      return [];
    }
  }

  /**
   * 获取热门视频（通过搜索模拟）
   * @param {string} category - 分类关键词
   * @param {object} options - 选项
   * @returns {Promise<Array>} 视频列表
   */
  async getTrendingVideos(category = 'trending', options = {}) {
    try {
      const limit = options.limit || this.searchLimit;
      console.log(`[YouTube-API] 获取热门视频: ${category}`);
      
      // 使用分类关键词搜索
      return await this.searchVideos(category, { limit });
    } catch (error) {
      console.error('[YouTube-API] 获取热门视频失败:', error.message);
      return [];
    }
  }
}

module.exports = YouTubeApiClient;
