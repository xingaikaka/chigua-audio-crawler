/**
 * YouTube 搜索解析器
 * 使用 YouTube Data API v3 官方 API，支持真实分页
 */

const YouTubeOfficialApiClient = require('./youtubeOfficialApiClient');
const YouTubeOfficialDataMapper = require('./youtubeOfficialDataMapper');

class YouTubeSearchParser {
  constructor(config) {
    this.config = config;
    this.apiClient = new YouTubeOfficialApiClient();
    this.currentKeyword = config.searchDefaultKeyword || '音乐';
    
    // 存储每个搜索查询的分页信息
    this.pageTokenCache = new Map(); // key: searchKey, value: {pageTokens, totalResults}
    
    console.log('[YouTube-Parser] 初始化 YouTube 搜索解析器（官方 API v3）');
  }

  /**
   * 生成搜索缓存键
   * @param {string} keyword - 搜索关键词
   * @param {object} options - 搜索选项
   * @returns {string} 缓存键
   */
  _getSearchKey(keyword, options = {}) {
    return `${keyword}-${options.order || 'relevance'}-${options.type || 'video'}`;
  }

  /**
   * 获取或创建分页缓存
   * @param {string} searchKey - 搜索键
   * @returns {object} 分页缓存对象
   */
  _getPageCache(searchKey) {
    if (!this.pageTokenCache.has(searchKey)) {
      this.pageTokenCache.set(searchKey, {
        pageTokens: [null], // 第一页的 token 是 null
        totalResults: 0
      });
    }
    return this.pageTokenCache.get(searchKey);
  }

  /**
   * 搜索视频（支持真实分页）
   * @param {string} keyword - 搜索关键词
   * @param {number} page - 页码（从 1 开始）
   * @param {object} options - 搜索选项
   * @returns {Promise<object>} 搜索结果
   */
  async search(keyword, page = 1, options = {}) {
    try {
      console.log(`[YouTube-Parser] 搜索视频: "${keyword}", 页码: ${page}`);
      
      // 保存当前关键词
      this.currentKeyword = keyword || this.currentKeyword;
      
      const searchKey = this._getSearchKey(this.currentKeyword, options);
      const pageCache = this._getPageCache(searchKey);
      
      // 确定要使用的 pageToken
      let pageToken = null;
      
      if (page > 1) {
        // 如果请求的页码超出已缓存的范围，需要逐步获取
        while (pageCache.pageTokens.length < page && pageCache.pageTokens[pageCache.pageTokens.length - 1] !== undefined) {
          const lastPageToken = pageCache.pageTokens[pageCache.pageTokens.length - 1];
          console.log(`[YouTube-Parser] 预加载第 ${pageCache.pageTokens.length + 1} 页的 token`);
          
          const preloadResult = await this.apiClient.searchVideos(this.currentKeyword, {
            maxResults: this.config.pageSize || 50,
            pageToken: lastPageToken,
            order: options.order || 'relevance',
            type: options.type || 'video'
          });
          
          if (preloadResult.nextPageToken) {
            pageCache.pageTokens.push(preloadResult.nextPageToken);
          } else {
            // 没有更多页面了
            pageCache.pageTokens.push(undefined);
            break;
          }
        }
        
        pageToken = pageCache.pageTokens[page - 1];
        
        // 如果请求的页码不存在
        if (pageToken === undefined) {
          console.warn(`[YouTube-Parser] 页码 ${page} 已超出可用范围`);
          return {
            success: true,
            data: {
              items: [],
              pagination: {
                currentPage: page,
                totalPages: pageCache.pageTokens.length - 1,
                pageSize: 0,
                total: pageCache.totalResults,
                hasMore: false
              },
              keyword: this.currentKeyword
            }
          };
        }
      }
      
      // 调用官方 API 搜索
      const apiResult = await this.apiClient.searchVideos(this.currentKeyword, {
        maxResults: this.config.pageSize || 50,
        pageToken: pageToken,
        order: options.order || 'relevance',
        type: options.type || 'video'
      });
      
      // 更新缓存
      if (apiResult.totalResults) {
        pageCache.totalResults = apiResult.totalResults;
      }
      
      // 保存下一页的 token
      if (apiResult.nextPageToken && pageCache.pageTokens[page] !== apiResult.nextPageToken) {
        pageCache.pageTokens[page] = apiResult.nextPageToken;
      }
      
      // 获取视频 ID 列表，用于获取详细信息（播放量、时长等）
      const videoIds = apiResult.items.map(item => item.id?.videoId || item.id).filter(id => id);
      
      // 获取视频详情
      let videoDetails = [];
      if (videoIds.length > 0) {
        videoDetails = await this.apiClient.getVideoDetails(videoIds);
      }
      
      // 映射数据
      const mappedVideos = YouTubeOfficialDataMapper.mapSearchResults(apiResult).items;
      
      // 增强数据（添加播放量、时长等）
      const enhancedVideos = YouTubeOfficialDataMapper.enhanceVideosWithDetails(mappedVideos, videoDetails);
      
      // 构造返回结果
      const result = {
        success: true,
        data: {
          items: enhancedVideos,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(pageCache.totalResults / (this.config.pageSize || 50)),
            pageSize: enhancedVideos.length,
            total: pageCache.totalResults,
            hasMore: !!apiResult.nextPageToken
          },
          keyword: this.currentKeyword,
          nextPageToken: apiResult.nextPageToken,
          prevPageToken: apiResult.prevPageToken
        }
      };
      
      console.log(`[YouTube-Parser] 搜索成功，返回 ${enhancedVideos.length} 个视频，总结果: ${pageCache.totalResults}`);
      return result;
      
    } catch (error) {
      console.error('[YouTube-Parser] 搜索失败:', error);
      return {
        success: false,
        error: error.message,
        data: {
          items: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            pageSize: 0,
            total: 0,
            hasMore: false
          }
        }
      };
    }
  }

  /**
   * 获取分类视频（通过关键词搜索）
   * @param {string} categoryKeyword - 分类关键词
   * @param {number} page - 页码
   * @returns {Promise<object>} 视频列表
   */
  async getCategoryVideos(categoryKeyword, page = 1) {
    return this.search(categoryKeyword, page);
  }

  /**
   * 获取热门视频
   * @param {string} category - 分类
   * @param {number} page - 页码
   * @returns {Promise<object>} 视频列表
   */
  async getTrending(category = 'trending', page = 1) {
    // 使用搜索关键词模拟热门
    const trendingKeywords = {
      'trending': 'trending music 2026',
      'music': 'popular music',
      'gaming': 'trending gaming',
      'news': 'latest news'
    };
    
    const keyword = trendingKeywords[category] || 'trending';
    return this.search(keyword, page, { order: 'viewCount' });
  }

  /**
   * 获取视频详情
   * @param {string} videoId - 视频ID
   * @returns {Promise<object>} 视频详情
   */
  async getVideoDetail(videoId) {
    try {
      console.log(`[YouTube-Parser] 获取视频详情: ${videoId}`);
      
      const videoDetails = await this.apiClient.getVideoDetails([videoId]);
      
      if (videoDetails && videoDetails.length > 0) {
        const mappedVideo = YouTubeOfficialDataMapper.mapSingleVideo(videoDetails[0]);
        const enhancedVideo = YouTubeOfficialDataMapper.enhanceVideosWithDetails([mappedVideo], videoDetails)[0];
        
        return {
          success: true,
          data: enhancedVideo
        };
      }
      
      return {
        success: false,
        error: 'Video not found'
      };
      
    } catch (error) {
      console.error('[YouTube-Parser] 获取视频详情失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取内容（统一接口，用于与其他站点兼容）
   * @param {string} categoryUrl - 分类 URL 或搜索关键词
   * @param {number} page - 页码
   * @param {object} options - 选项
   * @returns {Promise<object>} 内容数据
   */
  async getContent(categoryUrl, page = 1, options = {}) {
    console.log(`[YouTube-Parser] getContent 调用: category=${categoryUrl}, page=${page}, options=`, options);
    
    // 如果 categoryUrl 是 'search'，使用 options.keyword
    const keyword = categoryUrl === 'search' ? (options.keyword || this.currentKeyword) : categoryUrl;
    
    return this.search(keyword, page, options);
  }

  /**
   * 清除分页缓存
   * @param {string} keyword - 关键词（可选，不传则清除所有）
   */
  clearPageCache(keyword = null) {
    if (keyword) {
      const searchKey = this._getSearchKey(keyword, {});
      this.pageTokenCache.delete(searchKey);
      console.log(`[YouTube-Parser] 已清除关键词 "${keyword}" 的分页缓存`);
    } else {
      this.pageTokenCache.clear();
      console.log('[YouTube-Parser] 已清除所有分页缓存');
    }
  }
}

module.exports = YouTubeSearchParser;
