/**
 * YouTube 数据映射器
 * 将 YouTube 数据转换为统一格式
 */

class YouTubeDataMapper {
  /**
   * 映射视频列表数据
   * @param {Array} videos - YouTube 视频数组
   * @returns {Array} 映射后的数据数组
   */
  static mapVideoList(videos) {
    if (!Array.isArray(videos)) {
      console.warn('[YouTube-Mapper] 无效的视频列表数据');
      return [];
    }

    return videos.map(video => this.mapSingleVideo(video));
  }

  /**
   * 映射单个视频数据
   * @param {object} video - YouTube 视频对象
   * @returns {object} 映射后的数据
   */
  static mapSingleVideo(video) {
    try {
      return {
        // 基础信息（yt-search使用videoId）
        id: video.videoId || video.id || '',
        video_id: video.videoId || video.id || '',
        title: video.title || '无标题',
        url: video.url || `https://www.youtube.com/watch?v=${video.videoId || video.id}`,
        
        // 缩略图（yt-search使用thumbnail或image）
        thumbnail: video.thumbnail || video.image || this.getThumbnailUrl(video),
        cover: video.thumbnail || video.image || this.getThumbnailUrl(video),
        
        // 频道信息（yt-search使用author）
        channel: {
          id: video.author?.id || '',
          name: video.author?.name || video.author || '未知频道',
          url: video.author?.url || '',
          icon: video.author?.url || ''
        },
        
        // 统计信息
        views: this.parseViewCount(video.views),
        viewCount: this.parseViewCount(video.views),
        viewCountText: this.formatViewCount(video.views),
        
        // 时间信息（yt-search使用seconds和timestamp）
        duration: video.seconds || video.duration?.seconds || 0,
        durationText: video.timestamp || this.formatDuration(video.seconds),
        uploadedAt: video.ago || '',
        publishedAt: video.ago || '',
        
        // 描述
        description: video.description || '',
        
        // 元数据
        source: 'youtube',
        type: 'video'
        
        // 注意：不保存 _raw 原始数据，避免序列化问题
      };
    } catch (error) {
      console.error('[YouTube-Mapper] 映射视频数据失败:', error);
      return null;
    }
  }

  /**
   * 获取缩略图URL（选择最高质量）
   * @param {object} video - 视频对象
   * @returns {string} 缩略图URL
   */
  static getThumbnailUrl(video) {
    if (video.thumbnail) {
      // 如果是对象，尝试获取最高质量
      if (typeof video.thumbnail === 'object' && video.thumbnail.url) {
        return video.thumbnail.url;
      }
      // 如果是字符串，直接返回
      if (typeof video.thumbnail === 'string') {
        return video.thumbnail;
      }
    }
    
    // 尝试从thumbnails数组获取
    if (video.thumbnails && Array.isArray(video.thumbnails) && video.thumbnails.length > 0) {
      // 选择最高质量的缩略图
      const best = video.thumbnails[video.thumbnails.length - 1];
      return best.url;
    }
    
    // 默认缩略图
    return video.id ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : '';
  }

  /**
   * 解析播放量
   * @param {number|string} views - 播放量
   * @returns {number} 数字格式的播放量
   */
  static parseViewCount(views) {
    if (typeof views === 'number') {
      return views;
    }
    
    if (typeof views === 'string') {
      // 移除逗号和非数字字符
      const cleaned = views.replace(/[^\d]/g, '');
      return parseInt(cleaned) || 0;
    }
    
    return 0;
  }

  /**
   * 格式化播放量
   * @param {number|string} views - 播放量
   * @returns {string} 格式化后的播放量
   */
  static formatViewCount(views) {
    const count = this.parseViewCount(views);
    
    if (count >= 1000000000) {
      return `${(count / 1000000000).toFixed(1)}B 次观看`;
    } else if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M 次观看`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K 次观看`;
    }
    
    return `${count} 次观看`;
  }

  /**
   * 格式化时长
   * @param {number} duration - 时长（可能是秒或毫秒）
   * @returns {string} 格式化后的时长
   */
  static formatDuration(duration) {
    if (!duration || duration === 0) {
      return '未知';
    }
    
    // 如果时长大于100000，可能是毫秒，转换为秒
    let seconds = duration;
    if (duration > 100000) {
      seconds = Math.floor(duration / 1000);
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }

  /**
   * 映射搜索结果
   * @param {Array} results - 搜索结果
   * @returns {object} 映射后的搜索结果
   */
  static mapSearchResults(results) {
    return {
      success: true,
      total: results.length,
      items: this.mapVideoList(results)
    };
  }
}

module.exports = YouTubeDataMapper;
