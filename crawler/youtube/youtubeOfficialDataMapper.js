/**
 * YouTube Data API v3 数据映射器
 * 将官方 API 返回的数据转换为应用统一格式
 */

class YouTubeOfficialDataMapper {
  /**
   * 映射搜索结果列表
   * @param {object} apiResponse - API 响应对象
   * @returns {object} 映射后的数据
   */
  static mapSearchResults(apiResponse) {
    if (!apiResponse || !apiResponse.items) {
      return {
        items: [],
        nextPageToken: null,
        prevPageToken: null,
        totalResults: 0,
        hasMore: false
      };
    }

    return {
      items: apiResponse.items.map(item => this.mapSingleVideo(item)),
      nextPageToken: apiResponse.nextPageToken || null,
      prevPageToken: apiResponse.prevPageToken || null,
      totalResults: apiResponse.totalResults || 0,
      hasMore: !!apiResponse.nextPageToken
    };
  }

  /**
   * 映射单个视频对象
   * @param {object} apiItem - API 返回的视频项
   * @returns {object} 映射后的视频对象
   */
  static mapSingleVideo(apiItem) {
    if (!apiItem || !apiItem.snippet) {
      return null;
    }

    const snippet = apiItem.snippet;
    const videoId = apiItem.id?.videoId || apiItem.id;

    return {
      // 基本信息
      type: 'video',
      id: videoId,
      videoId: videoId,
      video_id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      
      // 标题和描述
      title: snippet.title || '',
      description: snippet.description || '',
      
      // 缩略图
      image: this.getBestThumbnail(snippet.thumbnails),
      thumbnail: this.getBestThumbnail(snippet.thumbnails),
      
      // 时间信息
      publishedAt: snippet.publishedAt || '',
      publishTime: snippet.publishedAt || '',
      ago: this.formatTimeAgo(snippet.publishedAt),
      
      // 频道信息
      author: {
        name: snippet.channelTitle || 'Unknown',
        url: `https://www.youtube.com/channel/${snippet.channelId}`,
        channelId: snippet.channelId || ''
      },
      channel: {
        name: snippet.channelTitle || 'Unknown',
        id: snippet.channelId || '',
        url: `https://www.youtube.com/channel/${snippet.channelId}`
      },
      
      // 其他信息（可能需要额外 API 调用才有）
      views: 0, // 需要调用 videos API 获取
      duration: null, // 需要调用 videos API 获取
      timestamp: null,
      seconds: null
    };
  }

  /**
   * 获取最佳质量的缩略图
   * @param {object} thumbnails - 缩略图对象
   * @returns {string} 缩略图 URL
   */
  static getBestThumbnail(thumbnails) {
    if (!thumbnails) {
      return '';
    }

    // 按优先级选择：maxres > high > medium > default
    if (thumbnails.maxres) return thumbnails.maxres.url;
    if (thumbnails.high) return thumbnails.high.url;
    if (thumbnails.medium) return thumbnails.medium.url;
    if (thumbnails.default) return thumbnails.default.url;

    return '';
  }

  /**
   * 格式化时间为"多久以前"
   * @param {string} publishedAt - ISO 8601 时间字符串
   * @returns {string} 格式化的时间
   */
  static formatTimeAgo(publishedAt) {
    if (!publishedAt) return '';

    try {
      const now = new Date();
      const published = new Date(publishedAt);
      const diffMs = now - published;
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);
      const diffMonths = Math.floor(diffDays / 30);
      const diffYears = Math.floor(diffDays / 365);

      if (diffYears > 0) {
        return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
      }
      if (diffMonths > 0) {
        return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
      }
      if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      }
      if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      }
      if (diffMinutes > 0) {
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
      }
      return 'just now';
    } catch (error) {
      return '';
    }
  }

  /**
   * 增强视频数据（添加播放量、时长等）
   * @param {Array} videos - 视频列表
   * @param {Array} videoDetails - 视频详情列表（来自 videos API）
   * @returns {Array} 增强后的视频列表
   */
  static enhanceVideosWithDetails(videos, videoDetails) {
    if (!videoDetails || videoDetails.length === 0) {
      return videos;
    }

    const detailsMap = new Map();
    videoDetails.forEach(detail => {
      detailsMap.set(detail.id, detail);
    });

    return videos.map(video => {
      const detail = detailsMap.get(video.id);
      if (!detail) return video;

      return {
        ...video,
        views: parseInt(detail.statistics?.viewCount || 0),
        likes: parseInt(detail.statistics?.likeCount || 0),
        duration: detail.contentDetails?.duration || null,
        timestamp: this.parseDuration(detail.contentDetails?.duration),
        seconds: this.parseISO8601Duration(detail.contentDetails?.duration)
      };
    });
  }

  /**
   * 解析 ISO 8601 时长为可读格式
   * @param {string} duration - ISO 8601 时长字符串 (如 PT1H2M10S)
   * @returns {string} 格式化的时长 (如 1:02:10)
   */
  static parseDuration(duration) {
    if (!duration) return '';

    try {
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return '';

      const hours = parseInt(match[1] || 0);
      const minutes = parseInt(match[2] || 0);
      const seconds = parseInt(match[3] || 0);

      if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
      return `${minutes}:${String(seconds).padStart(2, '0')}`;
    } catch (error) {
      return '';
    }
  }

  /**
   * 解析 ISO 8601 时长为秒数
   * @param {string} duration - ISO 8601 时长字符串
   * @returns {number} 总秒数
   */
  static parseISO8601Duration(duration) {
    if (!duration) return 0;

    try {
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return 0;

      const hours = parseInt(match[1] || 0);
      const minutes = parseInt(match[2] || 0);
      const seconds = parseInt(match[3] || 0);

      return hours * 3600 + minutes * 60 + seconds;
    } catch (error) {
      return 0;
    }
  }
}

module.exports = YouTubeOfficialDataMapper;
