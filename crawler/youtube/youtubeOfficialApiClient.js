/**
 * YouTube Data API v3 官方客户端
 * 支持真正的分页和无限制搜索
 */

const axios = require('axios');
const apiConfig = require('../../config/youtube-api-config');

class YouTubeOfficialApiClient {
  constructor() {
    this.apiKey = apiConfig.apiKey;
    this.baseURL = apiConfig.baseURL;
    this.defaultMaxResults = apiConfig.defaultMaxResults;
    console.log('[YouTube-Official-API] 初始化 YouTube Data API v3 客户端');
  }

  /**
   * 搜索视频
   * @param {string} keyword - 搜索关键词
   * @param {object} options - 搜索选项
   * @returns {Promise<object>} 搜索结果和分页信息
   */
  async searchVideos(keyword, options = {}) {
    try {
      const {
        maxResults = this.defaultMaxResults,
        pageToken = null,
        order = 'relevance', // relevance, date, rating, viewCount, title
        type = 'video'
      } = options;

      console.log(`[YouTube-Official-API] 搜索视频: "${keyword}", 页码标记: ${pageToken || '首页'}`);

      const params = {
        part: 'snippet',
        q: keyword,
        type: type,
        maxResults: maxResults,
        order: order,
        key: this.apiKey,
        regionCode: 'US', // 地区代码
        relevanceLanguage: 'zh' // 相关语言
      };

      // 如果有 pageToken，添加到参数中
      if (pageToken) {
        params.pageToken = pageToken;
      }

      const response = await axios.get(`${this.baseURL}/search`, {
        params: params,
        timeout: 10000
      });

      if (response.data && response.data.items) {
        console.log(`[YouTube-Official-API] 搜索成功: ${response.data.items.length} 个结果`);
        
        return {
          items: response.data.items,
          nextPageToken: response.data.nextPageToken || null,
          prevPageToken: response.data.prevPageToken || null,
          pageInfo: response.data.pageInfo || {},
          totalResults: response.data.pageInfo?.totalResults || 0
        };
      }

      console.warn('[YouTube-Official-API] 搜索返回空数据');
      return {
        items: [],
        nextPageToken: null,
        prevPageToken: null,
        pageInfo: {},
        totalResults: 0
      };

    } catch (error) {
      console.error('[YouTube-Official-API] 搜索失败:', error.message);
      
      if (error.response) {
        console.error('[YouTube-Official-API] API 错误响应:', {
          status: error.response.status,
          data: error.response.data
        });
        
        // 处理配额超限错误
        if (error.response.status === 403) {
          throw new Error('YouTube API 配额已用完，请明天再试');
        }
        
        // 处理 API Key 错误
        if (error.response.status === 400) {
          throw new Error('YouTube API Key 无效或请求参数错误');
        }
      }
      
      throw error;
    }
  }

  /**
   * 获取视频详情
   * @param {Array<string>} videoIds - 视频ID数组
   * @returns {Promise<Array>} 视频详情列表
   */
  async getVideoDetails(videoIds) {
    try {
      if (!videoIds || videoIds.length === 0) {
        return [];
      }

      console.log(`[YouTube-Official-API] 获取视频详情: ${videoIds.length} 个视频`);

      const response = await axios.get(`${this.baseURL}/videos`, {
        params: {
          part: 'snippet,contentDetails,statistics',
          id: videoIds.join(','),
          key: this.apiKey
        },
        timeout: 10000
      });

      if (response.data && response.data.items) {
        console.log(`[YouTube-Official-API] 获取详情成功: ${response.data.items.length} 个`);
        return response.data.items;
      }

      return [];
    } catch (error) {
      console.error('[YouTube-Official-API] 获取视频详情失败:', error.message);
      return [];
    }
  }

  /**
   * 获取频道信息
   * @param {string} channelId - 频道ID
   * @returns {Promise<object>} 频道信息
   */
  async getChannelInfo(channelId) {
    try {
      console.log(`[YouTube-Official-API] 获取频道信息: ${channelId}`);

      const response = await axios.get(`${this.baseURL}/channels`, {
        params: {
          part: 'snippet,statistics',
          id: channelId,
          key: this.apiKey
        },
        timeout: 10000
      });

      if (response.data && response.data.items && response.data.items[0]) {
        return response.data.items[0];
      }

      return null;
    } catch (error) {
      console.error('[YouTube-Official-API] 获取频道信息失败:', error.message);
      return null;
    }
  }
}

module.exports = YouTubeOfficialApiClient;
