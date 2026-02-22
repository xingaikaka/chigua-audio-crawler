/**
 * YouTube 视频渲染器
 * 使用官方 API v3，支持真实无限分页
 */

class YouTubeRenderer {
  constructor() {
    this.contentList = null;
    this.currentVideos = []; // 当前页显示的视频
    this.currentKeyword = '音乐';
    this.currentSearchType = 'video';
    this.currentOrder = 'relevance';
    this.config = null;
    this.currentPage = 1;
    this.pageSize = 30; // 每页显示30个（平衡性能和体验）
    this.totalResults = 0; // API 返回的总结果数
    this.hasMore = true; // 是否还有更多数据
  }

  /**
   * 设置配置
   */
  setConfig(config) {
    this.config = config;
    console.log('[YouTube-Renderer] 配置已设置');
  }

  /**
   * 渲染内容列表（支持真实 API 分页）
   */
  async renderContentList(items, pagination = {}) {
    console.log('[YouTube-Renderer] 开始渲染视频列表');
    console.log('[YouTube-Renderer] 数据数量:', items ? items.length : 0);
    console.log('[YouTube-Renderer] 分页信息:', pagination);

    this.contentList = document.getElementById('contentList');
    if (!this.contentList) {
      console.error('[YouTube-Renderer] 找不到内容列表容器 #contentList');
      return;
    }

    // 保存分页信息
    this.currentPage = pagination.currentPage || 1;
    this.totalResults = pagination.total || 0;
    this.hasMore = pagination.hasMore || false;
    this.currentVideos = items || [];

    console.log(`[YouTube-Renderer] 第 ${this.currentPage} 页，共 ${this.totalResults} 个结果`);

    // 设置为YouTube站点样式
    this.contentList.className = 'video-list-container youtube-site';
    this.contentList.innerHTML = '';

    // 创建搜索工具栏
    const toolbar = this.createSearchToolbar();
    this.contentList.appendChild(toolbar);

    // 创建分类筛选器
    if (this.config && this.config.categories) {
      const categoryFilter = this.createCategoryFilter();
      this.contentList.appendChild(categoryFilter);
    }

    if (!items || items.length === 0) {
      this.contentList.innerHTML += `
        <div class="empty-state">
          <div style="font-size: 64px; margin-bottom: 20px;">📺</div>
          <p style="font-size: 18px; margin-bottom: 10px;">暂无视频数据</p>
          <p style="color: #999; font-size: 14px;">请尝试搜索其他关键词或检查网络连接</p>
        </div>
      `;
      return;
    }

    // 创建视频网格容器
    const videoGrid = document.createElement('div');
    videoGrid.id = 'youtubeVideoGrid';
    videoGrid.className = 'youtube-video-grid';

    // 渲染视频卡片
    items.forEach(video => {
      const card = this.createVideoCard(video);
      videoGrid.appendChild(card);
    });

    this.contentList.appendChild(videoGrid);

    // 创建分页控件
    const pagination_element = this.createPagination();
    this.contentList.appendChild(pagination_element);

    console.log('[YouTube-Renderer] 渲染完成');
  }

  /**
   * 创建搜索工具栏
   */
  createSearchToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'youtube-toolbar';
    toolbar.innerHTML = `
      <div class="youtube-search-controls">
        <input 
          type="text" 
          id="youtubeSearchInput" 
          placeholder="搜索 YouTube 视频..." 
          value="${this.currentKeyword}"
          class="youtube-search-input"
        />
        
        <select id="youtubeSearchType" class="youtube-select">
          <option value="video" ${this.currentSearchType === 'video' ? 'selected' : ''}>视频</option>
          <option value="channel" ${this.currentSearchType === 'channel' ? 'selected' : ''}>频道</option>
          <option value="playlist" ${this.currentSearchType === 'playlist' ? 'selected' : ''}>播放列表</option>
        </select>
        
        <select id="youtubeSearchOrder" class="youtube-select">
          <option value="relevance" ${this.currentOrder === 'relevance' ? 'selected' : ''}>相关性</option>
          <option value="date" ${this.currentOrder === 'date' ? 'selected' : ''}>最新</option>
          <option value="viewCount" ${this.currentOrder === 'viewCount' ? 'selected' : ''}>观看次数</option>
          <option value="rating" ${this.currentOrder === 'rating' ? 'selected' : ''}>评分</option>
        </select>
        
        <button id="youtubeSearchBtn" class="youtube-search-btn">🔍 搜索</button>
        <button id="youtubeClearBtn" class="youtube-clear-btn">✕ 清除</button>
      </div>
      
      <div class="youtube-results-info">
        <span id="youtubeResultsCount">共 ${this.totalResults.toLocaleString()} 个结果</span>
        <span class="api-badge">YouTube Data API v3</span>
      </div>
    `;

    // 绑定事件
    setTimeout(() => {
      const searchInput = document.getElementById('youtubeSearchInput');
      const searchBtn = document.getElementById('youtubeSearchBtn');
      const clearBtn = document.getElementById('youtubeClearBtn');
      const searchType = document.getElementById('youtubeSearchType');
      const searchOrder = document.getElementById('youtubeSearchOrder');

      if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.handleSearch();
          }
        });
      }

      if (searchBtn) {
        searchBtn.addEventListener('click', () => this.handleSearch());
      }

      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          if (searchInput) searchInput.value = '';
          this.currentKeyword = '音乐';
          this.handleSearch();
        });
      }

      if (searchType) {
        searchType.addEventListener('change', (e) => {
          this.currentSearchType = e.target.value;
          console.log('[YouTube-Renderer] 搜索类型切换为:', this.currentSearchType);
        });
      }

      if (searchOrder) {
        searchOrder.addEventListener('change', (e) => {
          this.currentOrder = e.target.value;
          console.log('[YouTube-Renderer] 排序方式切换为:', this.currentOrder);
        });
      }
    }, 0);

    return toolbar;
  }

  /**
   * 创建分类筛选器
   */
  createCategoryFilter() {
    const filter = document.createElement('div');
    filter.className = 'youtube-category-filter';

    const categories = [
      { name: '音乐', keyword: '音乐', emoji: '🎵' },
      { name: '游戏', keyword: 'gaming', emoji: '🎮' },
      { name: '新闻', keyword: 'news', emoji: '📰' },
      { name: '体育', keyword: 'sports', emoji: '⚽' },
      { name: '科技', keyword: 'technology', emoji: '💻' },
      { name: '教育', keyword: 'education', emoji: '📚' },
      { name: '娱乐', keyword: 'entertainment', emoji: '🎬' },
      { name: '旅行', keyword: 'travel', emoji: '✈️' }
    ];

    filter.innerHTML = '<div class="category-title">快速分类：</div>';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'category-buttons';

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-btn';
      btn.innerHTML = `${cat.emoji} ${cat.name}`;
      btn.addEventListener('click', () => this.handleCategorySearch(cat.keyword));
      buttonContainer.appendChild(btn);
    });

    filter.appendChild(buttonContainer);
    return filter;
  }

  /**
   * 处理搜索
   */
  async handleSearch() {
    const searchInput = document.getElementById('youtubeSearchInput');
    const keyword = searchInput ? searchInput.value.trim() : '';

    if (!keyword) {
      console.log('[YouTube-Renderer] 搜索关键词为空，使用默认关键词');
      this.currentKeyword = '音乐';
    } else {
      this.currentKeyword = keyword;
    }

    console.log(`[YouTube-Renderer] 开始搜索: "${this.currentKeyword}"`);

    // 重置为第一页
    this.currentPage = 1;

    // 调用搜索 API
    try {
      const siteId = window.currentState.currentSiteId || 'youtube';
      const result = await window.electronAPI.getContent(
        siteId,
        'search',
        this.currentPage,
        { 
          keyword: this.currentKeyword,
          order: this.currentOrder,
          type: this.currentSearchType
        }
      );

      if (result && result.success && result.data) {
        await this.renderContentList(result.data.items, result.data.pagination);
      } else {
        console.error('[YouTube-Renderer] 搜索失败:', result.error);
        this.contentList.innerHTML = `
          <div class="empty-state">
            <div style="font-size: 64px; margin-bottom: 20px;">❌</div>
            <p style="font-size: 18px; margin-bottom: 10px;">搜索失败</p>
            <p style="color: #999; font-size: 14px;">${result.error || '未知错误'}</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('[YouTube-Renderer] 搜索异常:', error);
    }
  }

  /**
   * 处理分类搜索
   */
  async handleCategorySearch(keyword) {
    const searchInput = document.getElementById('youtubeSearchInput');
    if (searchInput) {
      searchInput.value = keyword;
    }
    this.currentKeyword = keyword;
    await this.handleSearch();
  }

  /**
   * 创建视频卡片
   */
  createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'youtube-video-card';
    card.dataset.videoId = video.id || video.videoId;

    const thumbnailUrl = video.thumbnail || video.image || '';
    const title = video.title || '无标题';
    const channelName = video.author?.name || video.channel?.name || 'Unknown';
    const views = video.views ? this.formatViews(video.views) : '';
    const duration = video.timestamp || video.duration || '';
    const ago = video.ago || '';

    card.innerHTML = `
      <div class="video-thumbnail">
        <img src="${thumbnailUrl}" alt="${title}" loading="lazy" />
        ${duration ? `<span class="video-duration">${duration}</span>` : ''}
      </div>
      <div class="video-info">
        <h3 class="video-title" title="${title}">${title}</h3>
        <div class="channel-info">
          <span class="channel-name">${channelName}</span>
        </div>
        <div class="video-stats">
          ${views ? `<span class="stat-item">👁 ${views}</span>` : ''}
          ${ago ? `<span class="stat-item">⏰ ${ago}</span>` : ''}
        </div>
      </div>
    `;

    // 点击打开视频
    card.addEventListener('click', () => {
      this.openVideoInBrowser(video);
    });

    return card;
  }

  /**
   * 格式化观看次数
   */
  formatViews(views) {
    if (views >= 1000000000) {
      return (views / 1000000000).toFixed(1) + 'B';
    }
    if (views >= 1000000) {
      return (views / 1000000).toFixed(1) + 'M';
    }
    if (views >= 1000) {
      return (views / 1000).toFixed(1) + 'K';
    }
    return views.toString();
  }

  /**
   * 在浏览器中打开视频
   */
  openVideoInBrowser(video) {
    const url = video.url || `https://www.youtube.com/watch?v=${video.id || video.videoId}`;
    console.log('[YouTube-Renderer] 打开视频:', url);
    
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  }

  /**
   * 创建分页控件（支持真实 API 分页）
   */
  createPagination() {
    const pagination = document.createElement('div');
    pagination.id = 'youtubePagination';
    pagination.className = 'youtube-pagination';

    const isPrevDisabled = this.currentPage <= 1;
    const isNextDisabled = !this.hasMore;

    const startVideo = (this.currentPage - 1) * this.pageSize + 1;
    const endVideo = this.currentPage * this.pageSize;
    
    // 计算可能的总页数（仅供参考，YouTube API 不支持跳到任意页）
    const estimatedTotalPages = Math.ceil(this.totalResults / this.pageSize);

    pagination.innerHTML = `
      <div class="pagination-container">
        <!-- 顶部信息栏 -->
        <div class="pagination-header">
          <div class="pagination-stats">
            <span class="stats-icon">📊</span>
            <span class="stats-text">第 <strong>${this.currentPage}</strong> 页 · 每页 <strong>${this.pageSize}</strong> 个 · 约 <strong>${this.totalResults.toLocaleString()}</strong> 个结果</span>
          </div>
          <div class="api-status-badge">
            <span class="status-icon">✓</span>
            <span class="status-text">YouTube Data API v3</span>
          </div>
        </div>
        
        <!-- 分页控制区 -->
        <div class="pagination-controls-wrapper">
          <button id="youtubePrevPageBtn" class="pagination-btn prev-btn" ${isPrevDisabled ? 'disabled' : ''}>
            <span class="btn-icon">◀</span>
            <span class="btn-text">上一页</span>
          </button>
          
          <div class="pagination-center">
            <div class="pagination-current-info">
              <span class="current-page-display">第 <strong>${this.currentPage}</strong> 页</span>
              ${this.hasMore 
                ? '<span class="has-more-indicator">· 还有更多结果 →</span>' 
                : '<span class="no-more-indicator">· 已到最后一页 (API 限制)</span>'}
            </div>
            ${!this.hasMore ? `
            <div class="api-limit-notice">
              <span class="notice-icon">⚠️</span>
              <span class="notice-text">YouTube API 限制：当前搜索词可访问约 ${this.currentPage * this.pageSize} 个结果</span>
            </div>
            ` : ''}
          </div>
          
          <button id="youtubeNextPageBtn" class="pagination-btn next-btn" ${isNextDisabled ? 'disabled' : ''}>
            <span class="btn-text">下一页</span>
            <span class="btn-icon">▶</span>
          </button>
        </div>
        
        <!-- 底部提示信息 -->
        <div class="pagination-footer">
          <div class="pagination-hints">
            <span class="pagination-hint">💡 YouTube API 限制说明：</span>
            <span class="hint-item">• 使用 token 顺序分页（不支持跳页）</span>
            <span class="hint-item">• 每个搜索词可访问的结果数量有限（通常几百个）</span>
            <span class="hint-item">• 建议：使用更精确的关键词或尝试不同排序方式</span>
          </div>
        </div>
      </div>
    `;

    // 绑定分页事件
    setTimeout(() => {
      this.bindPaginationEvents();
    }, 0);

    return pagination;
  }


  /**
   * 绑定分页事件
   */
  bindPaginationEvents() {
    const prevBtn = document.getElementById('youtubePrevPageBtn');
    const nextBtn = document.getElementById('youtubeNextPageBtn');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.handlePrevPage());
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.handleNextPage());
    }
  }

  /**
   * 上一页
   */
  async handlePrevPage() {
    if (this.currentPage <= 1) return;
    await this.handleGoToPage(this.currentPage - 1);
  }

  /**
   * 下一页
   */
  async handleNextPage() {
    if (!this.hasMore) return;
    await this.handleGoToPage(this.currentPage + 1);
  }

  /**
   * 跳转到指定页
   */
  async handleGoToPage(page) {
    console.log(`[YouTube-Renderer] 跳转到第 ${page} 页`);

    try {
      const siteId = window.currentState.currentSiteId || 'youtube';
      const result = await window.electronAPI.getContent(
        siteId,
        'search',
        page,
        { 
          keyword: this.currentKeyword,
          order: this.currentOrder,
          type: this.currentSearchType
        }
      );

      if (result && result.success && result.data) {
        await this.renderContentList(result.data.items, result.data.pagination);
        // 滚动到顶部
        this.contentList.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        console.error('[YouTube-Renderer] 加载页面失败:', result.error);
      }
    } catch (error) {
      console.error('[YouTube-Renderer] 加载页面异常:', error);
    }
  }

}

// 全局暴露
window.YouTubeRenderer = YouTubeRenderer;
