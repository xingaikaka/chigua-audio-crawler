/**
 * 草榴社区 (t66y.com) 渲染器
 * 每行一条帖子，显示标题、图片缩略图、作者、赞数、回复数
 * 支持多选、分页、同步
 */

class T66YRenderer {
  constructor() {
    this.contentList = null;
    this.currentItems = [];
    this.selectedIds = new Set();
    this.isSyncing = false;
    this.syncStats = null;

    // 分页状态
    this.currentPage = 1;
    this.totalPages = 1;
    this.currentCategoryUrl = 'https://t66y.com/thread0806.php?fid=7';

    // 图片加载缓存（tid => images数组）
    this.imageCache = new Map();
    this.loadingImages = new Set();

    this._progressListenerAdded = false;
  }

  /**
   * 渲染内容列表（由 renderer.js 调用）
   */
  renderContentList(items, pagination) {
    console.log('[T66Y-Renderer] 渲染帖子列表:', items ? items.length : 0, '条');

    this.contentList = document.getElementById('contentList');
    if (!this.contentList) return;

    this.currentItems = items || [];
    this.selectedIds.clear();

    // 更新分页状态
    if (pagination) {
      this.currentPage = pagination.current || 1;
      this.totalPages = pagination.total || 1;
    }

    // 设置容器
    this.contentList.className = 't66y-container';
    this.contentList.innerHTML = '';

    if (!items || items.length === 0) {
      this.contentList.innerHTML = '<div class="t66y-empty"><div class="icon">📭</div><p>暂无帖子数据</p></div>';
      return;
    }

    // 工具栏
    this.contentList.appendChild(this._createToolbar());

    // 同步统计行（隐藏，同步时显示）
    const statsBar = this._createStatsBar();
    statsBar.style.display = 'none';
    this.contentList.appendChild(statsBar);

    // 帖子列表
    const listEl = document.createElement('div');
    listEl.className = 't66y-list';
    listEl.id = 't66yPostList';

    items.forEach((item, i) => {
      listEl.appendChild(this._createPostRow(item, i));
    });

    this.contentList.appendChild(listEl);

    // 分页
    this.contentList.appendChild(this._createPagination());

    // 全局保存当前items（供syncController使用）
    window.currentContentItems = items;

    // 初始化同步监听
    this._initSyncListeners();

    // 自动加载图片（异步，不阻塞UI）
    this._autoLoadImages(items);
  }

  /**
   * 创建工具栏
   */
  _createToolbar() {
    const bar = document.createElement('div');
    bar.className = 't66y-toolbar';
    bar.innerHTML = `
      <div class="t66y-toolbar-left">
        <label class="t66y-select-all-label">
          <input type="checkbox" id="t66ySelectAll" />
          <span>全选</span>
        </label>
        <span class="t66y-selection-info" id="t66ySelectionInfo">已选择 0 项</span>
      </div>
      <div class="t66y-toolbar-right">
        <button class="t66y-btn t66y-btn-check" id="t66yCheckBtn">
          🔍 检查同步状态
        </button>
        <button class="t66y-btn t66y-btn-sync" id="t66ySyncBtn" disabled>
          🔄 同步选中项
        </button>
        <button class="t66y-btn t66y-btn-stop" id="t66yStopBtn" style="display:none">
          ⏹ 停止同步
        </button>
      </div>
    `;

    // 全选
    bar.querySelector('#t66ySelectAll').addEventListener('change', (e) => {
      this._toggleSelectAll(e.target.checked);
    });

    // 检查状态
    bar.querySelector('#t66yCheckBtn').addEventListener('click', () => {
      this._checkSyncStatus();
    });

    // 同步
    bar.querySelector('#t66ySyncBtn').addEventListener('click', () => {
      this._startSync();
    });

    // 停止
    bar.querySelector('#t66yStopBtn').addEventListener('click', () => {
      this._stopSync();
    });

    return bar;
  }

  /**
   * 创建同步统计栏
   */
  _createStatsBar() {
    const bar = document.createElement('div');
    bar.className = 't66y-sync-stats';
    bar.id = 't66ySyncStats';
    bar.innerHTML = `
      <span class="t66y-stat-item t66y-stat-pending">⏳ 等待: <span class="val" id="t66yStatPending">0</span></span>
      <span class="t66y-stat-item t66y-stat-running">🔄 同步中: <span class="val" id="t66yStatRunning">0</span></span>
      <span class="t66y-stat-item t66y-stat-done">✅ 完成: <span class="val" id="t66yStatDone">0</span></span>
      <span class="t66y-stat-item t66y-stat-failed">❌ 失败: <span class="val" id="t66yStatFailed">0</span></span>
    `;
    return bar;
  }

  /**
   * 创建帖子行
   */
  _createPostRow(item, index) {
    const row = document.createElement('div');
    row.className = 't66y-post-row';
    row.dataset.id = item.id;
    row.dataset.tid = item.tid || '';

    if (item.isPinned) {
      row.classList.add('pinned');
    }

    row.innerHTML = `
      <div class="t66y-post-checkbox">
        <input type="checkbox" class="t66y-item-checkbox" data-id="${item.id}" />
      </div>
      <div class="t66y-post-images" id="t66yImages_${item.tid || index}">
        <div class="t66y-post-images-loading">加载中...</div>
      </div>
      <div class="t66y-post-content">
        <div class="t66y-post-title" title="${this._escHtml(item.title)}"
          onclick="window.electronAPI && window.electronAPI.openExternal('${this._escHtml(item.url)}')"
        >${this._escHtml(item.title)}</div>
        <div class="t66y-post-meta">
          ${item.isPinned ? '<span class="pinned-badge">📌 置顶</span>' : ''}
          <span class="author">👤 ${this._escHtml(item.author || '未知')}</span>
          <span class="praise">👍 ${item.praise || 0}</span>
          <span class="replies">💬 ${item.replyCount || 0}</span>
          ${item.lastPost ? `<span>🕐 ${this._escHtml(item.lastPost)}</span>` : ''}
        </div>
        <div class="t66y-post-progress" id="t66yProgress_${item.id}">
          <div class="t66y-post-progress-bar" id="t66yProgressBar_${item.id}" style="width:0%"></div>
        </div>
        <div class="t66y-post-step" id="t66yStep_${item.id}"></div>
      </div>
    `;

    // 复选框事件
    const checkbox = row.querySelector('.t66y-item-checkbox');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        this.selectedIds.add(item.id);
        row.classList.add('selected');
      } else {
        this.selectedIds.delete(item.id);
        row.classList.remove('selected');
      }
      this._updateSelectionUI();
    });

    return row;
  }

  /**
   * 异步加载帖子图片
   */
  async _autoLoadImages(items) {
    // 限制并发加载
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await Promise.all(batch.map(item => this._loadItemImages(item)));
    }
  }

  async _loadItemImages(item) {
    const key = item.tid || item.id;
    const container = document.getElementById(`t66yImages_${key}`);
    if (!container) return;

    try {
      // 检查缓存
      let images = this.imageCache.get(key);

      if (!images) {
        // 调用后端获取详情图片
        const result = await window.electronAPI.t66yGetThreadDetail(item.url, 4);
        if (result && result.success && result.data) {
          images = result.data.images || [];
          // 同时更新item的数据
          item.images = images;
          item.cover = images[0] || null;
          item.detail = result.data;
          this.imageCache.set(key, images);
        } else {
          images = [];
        }
      }

      this._renderImageThumbs(container, images);
    } catch (e) {
      console.warn(`[T66Y-Renderer] 加载图片失败 (${item.tid}):`, e.message);
      if (container) {
        container.innerHTML = '<div class="t66y-no-image">🚫</div>';
      }
    }
  }

  _renderImageThumbs(container, images) {
    if (!container) return;

    if (!images || images.length === 0) {
      container.innerHTML = '<div class="t66y-no-image">📷</div>';
      return;
    }

    const maxShow = 3; // 最多显示3张缩略图
    const html = [];

    images.slice(0, maxShow).forEach(src => {
      html.push(`<img class="t66y-thumb" src="${this._escHtml(src)}" 
        onerror="this.style.display='none'" 
        loading="lazy" alt="图片" />`);
    });

    if (images.length > maxShow) {
      html.push(`<div class="t66y-thumb-more">+${images.length - maxShow}</div>`);
    }

    container.innerHTML = html.join('');
  }

  /**
   * 创建分页
   */
  _createPagination() {
    const pag = document.createElement('div');
    pag.className = 't66y-pagination';

    pag.innerHTML = `
      <button class="t66y-page-btn" id="t66yFirstPage" ${this.currentPage <= 1 ? 'disabled' : ''}>«« 首页</button>
      <button class="t66y-page-btn" id="t66yPrevPage" ${this.currentPage <= 1 ? 'disabled' : ''}>« 上页</button>
      <span class="t66y-page-info">第 ${this.currentPage} 页，共 ${this.totalPages} 页</span>
      <button class="t66y-page-btn" id="t66yNextPage" ${this.currentPage >= this.totalPages ? 'disabled' : ''}>下页 »</button>
      <button class="t66y-page-btn" id="t66yLastPage" ${this.currentPage >= this.totalPages ? 'disabled' : ''}>尾页 »»</button>
      <div class="t66y-page-jump">
        <span>跳转</span>
        <input type="number" id="t66yPageInput" min="1" max="${this.totalPages}" value="${this.currentPage}" />
        <button class="t66y-page-btn" id="t66yJumpBtn">GO</button>
      </div>
    `;

    pag.querySelector('#t66yFirstPage').addEventListener('click', () => this._goPage(1));
    pag.querySelector('#t66yPrevPage').addEventListener('click', () => this._goPage(this.currentPage - 1));
    pag.querySelector('#t66yNextPage').addEventListener('click', () => this._goPage(this.currentPage + 1));
    pag.querySelector('#t66yLastPage').addEventListener('click', () => this._goPage(this.totalPages));
    pag.querySelector('#t66yJumpBtn').addEventListener('click', () => {
      const val = parseInt(pag.querySelector('#t66yPageInput').value);
      if (val >= 1 && val <= this.totalPages) this._goPage(val);
    });

    return pag;
  }

  /**
   * 跳转到指定页
   */
  async _goPage(page) {
    if (page < 1 || page > this.totalPages) return;

    const siteId = window.currentState && window.currentState.currentSiteId;
    if (siteId !== 't66y') return;

    try {
      showLoading && showLoading();
      const result = await window.electronAPI.getContent('t66y', this.currentCategoryUrl, page, {});
      if (result && result.success) {
        const data = result.data;
        const items = data.items || [];
        const pagination = data.pagination || { current: page, total: this.totalPages };
        this.renderContentList(items, pagination);
      }
    } catch (e) {
      console.error('[T66Y-Renderer] 翻页失败:', e);
    } finally {
      hideLoading && hideLoading();
    }
  }

  /**
   * 设置当前分类URL
   */
  setCurrentCategoryUrl(url) {
    this.currentCategoryUrl = url || 'https://t66y.com/thread0806.php?fid=7';
  }

  /**
   * 全选/取消全选
   */
  _toggleSelectAll(checked) {
    this.selectedIds.clear();

    document.querySelectorAll('.t66y-item-checkbox').forEach(cb => {
      if (!cb.disabled) {
        cb.checked = checked;
        const row = cb.closest('.t66y-post-row');
        if (row) {
          if (checked) {
            this.selectedIds.add(row.dataset.id);
            row.classList.add('selected');
          } else {
            row.classList.remove('selected');
          }
        }
      }
    });

    this._updateSelectionUI();
  }

  _updateSelectionUI() {
    const count = this.selectedIds.size;

    const info = document.getElementById('t66ySelectionInfo');
    if (info) {
      info.textContent = `已选择 ${count} 项`;
      info.className = `t66y-selection-info ${count > 0 ? 'has-selected' : ''}`;
    }

    const syncBtn = document.getElementById('t66ySyncBtn');
    if (syncBtn) {
      syncBtn.disabled = count === 0 || this.isSyncing;
    }
  }

  /**
   * 检查同步状态
   */
  async _checkSyncStatus() {
    const btn = document.getElementById('t66yCheckBtn');
    if (btn) btn.disabled = true;

    try {
      // 获取所有帖子的tid
      const tids = this.currentItems
        .filter(item => item.tid && !isNaN(parseInt(item.tid)))
        .map(item => String(item.tid));

      if (tids.length === 0) return;

      // 使用通用的check-sync-status（传tid作为articleIds）
      const config = await this._getConfig();
      if (!config) return;

      const result = await window.electronAPI.checkSyncStatus(tids, config);

      if (result && result.success && result.data) {
        const existsMap = result.data;

        this.currentItems.forEach(item => {
          if (!item.tid) return;
          const tidStr = String(item.tid);
          const syncInfo = existsMap[tidStr];

          if (syncInfo && syncInfo.exists) {
            this._markItemSynced(item.id);
          }
        });

        showToast && showToast('同步状态检查完成', 'success');
      }
    } catch (e) {
      console.error('[T66Y-Renderer] 检查同步状态失败:', e);
      showToast && showToast('检查失败: ' + e.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  _markItemSynced(itemId) {
    const row = document.querySelector(`.t66y-post-row[data-id="${itemId}"]`);
    if (row) {
      row.classList.add('synced');
      const cb = row.querySelector('.t66y-item-checkbox');
      if (cb) {
        cb.checked = false;
        cb.disabled = true;
      }
      this.selectedIds.delete(itemId);
    }
    this._updateSelectionUI();
  }

  /**
   * 开始同步
   */
  async _startSync() {
    if (this.isSyncing) return;
    if (this.selectedIds.size === 0) return;

    // 收集选中的items（带图片信息）
    const selectedItems = this.currentItems.filter(item => this.selectedIds.has(item.id));
    if (selectedItems.length === 0) return;

    console.log('[T66Y-Renderer] 开始同步:', selectedItems.length, '条');

    this.isSyncing = true;
    this._setSyncButtonState(true);

    // 显示统计栏
    const statsBar = document.getElementById('t66ySyncStats');
    if (statsBar) statsBar.style.display = 'flex';

    try {
      const result = await window.electronAPI.t66yStartSync(selectedItems);
      if (!result.success) {
        throw new Error(result.error || '同步启动失败');
      }

      console.log('[T66Y-Renderer] 同步任务已启动:', result.addResult);
    } catch (e) {
      console.error('[T66Y-Renderer] 同步启动失败:', e);
      showToast && showToast('同步失败: ' + e.message, 'error');
      this.isSyncing = false;
      this._setSyncButtonState(false);
    }
  }

  async _stopSync() {
    try {
      await window.electronAPI.t66yStopSync();
      this.isSyncing = false;
      this._setSyncButtonState(false);
      showToast && showToast('同步已停止', 'info');
    } catch (e) {
      console.error('[T66Y-Renderer] 停止同步失败:', e);
    }
  }

  _setSyncButtonState(syncing) {
    const syncBtn = document.getElementById('t66ySyncBtn');
    const stopBtn = document.getElementById('t66yStopBtn');
    const checkBtn = document.getElementById('t66yCheckBtn');

    if (syncBtn) {
      if (syncing) {
        syncBtn.classList.add('syncing');
        syncBtn.disabled = true;
        syncBtn.textContent = '⏳ 同步中...';
      } else {
        syncBtn.classList.remove('syncing');
        syncBtn.disabled = this.selectedIds.size === 0;
        syncBtn.textContent = '🔄 同步选中项';
      }
    }

    if (stopBtn) {
      stopBtn.style.display = syncing ? 'flex' : 'none';
    }

    if (checkBtn) {
      checkBtn.disabled = syncing;
    }
  }

  /**
   * 初始化同步进度监听
   */
  _initSyncListeners() {
    if (this._progressListenerAdded) return;
    this._progressListenerAdded = true;

    // 进度更新
    window.electronAPI.onT66YSyncProgress((data) => {
      this._handleProgress(data);
    });

    // 同步完成
    window.electronAPI.onT66YSyncCompleted((data) => {
      console.log('[T66Y-Renderer] 同步完成:', data);
      this.isSyncing = false;
      this._setSyncButtonState(false);

      const stats = data.stats || {};
      const msg = `同步完成 - 成功: ${stats.completed || 0}, 失败: ${stats.failed || 0}`;
      showToast && showToast(msg, 'success');
      this._updateStatsBar(stats);
    });

    // 同步错误
    window.electronAPI.onT66YSyncError((data) => {
      console.error('[T66Y-Renderer] 同步错误:', data);
      this.isSyncing = false;
      this._setSyncButtonState(false);
      showToast && showToast('同步错误: ' + (data.error || '未知错误'), 'error');
    });

    // 已跳过（已同步）
    window.electronAPI.onT66YSyncSkipped((data) => {
      if (data.skippedItems) {
        data.skippedItems.forEach(s => {
          this._markItemSynced(s.taskId || s.id);
        });
      }
    });
  }

  _handleProgress(data) {
    const { taskId, status, step, progress, details } = data;

    // 更新进度条
    const progressEl = document.getElementById(`t66yProgress_${taskId}`);
    const barEl = document.getElementById(`t66yProgressBar_${taskId}`);
    const stepEl = document.getElementById(`t66yStep_${taskId}`);
    const row = document.querySelector(`.t66y-post-row[data-id="${taskId}"]`);

    if (progressEl) {
      progressEl.classList.add('visible');
    }

    if (barEl) {
      barEl.style.width = `${progress}%`;
      if (status === 'failed' || (details && details.error)) {
        barEl.classList.add('error');
      } else {
        barEl.classList.remove('error');
      }
    }

    if (stepEl) {
      stepEl.classList.add('visible');
      stepEl.textContent = step || '';
    }

    if (row) {
      row.classList.remove('syncing-in-progress', 'sync-failed');
      if (status === 'running') {
        row.classList.add('syncing-in-progress');
      } else if (status === 'failed' || (details && details.error)) {
        row.classList.add('sync-failed');
      } else if (status === 'completed' || (details && details.completed)) {
        row.classList.add('synced');
        row.classList.remove('syncing-in-progress');
        const cb = row.querySelector('.t66y-item-checkbox');
        if (cb) { cb.checked = false; cb.disabled = true; }
        this.selectedIds.delete(taskId);
        this._updateSelectionUI();
      }
    }

    // 更新统计
    this._refreshStats();
  }

  async _refreshStats() {
    try {
      const result = await window.electronAPI.t66yGetQueueStats();
      if (result && result.success && result.stats) {
        this._updateStatsBar(result.stats);
      }
    } catch (e) {}
  }

  _updateStatsBar(stats) {
    if (!stats) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('t66yStatPending', stats.pending || 0);
    set('t66yStatRunning', stats.running || 0);
    set('t66yStatDone', stats.completed || 0);
    set('t66yStatFailed', stats.failed || 0);
  }

  async _getConfig() {
    try {
      const result = await window.electronAPI.getSiteConfig('t66y');
      if (result && result.success) return result.data;
    } catch (e) {}
    return null;
  }

  _escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

window.T66YRenderer = T66YRenderer;
