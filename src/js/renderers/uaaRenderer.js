/**
 * UAA有声小说渲染器
 * 使用横向列表布局
 */

class UAAAudioRenderer {
  constructor() {
    this.contentList = null;
    this.currentAudioList = []; // 保存当前列表数据
    this.syncInProgress = false; // 同步进度标识
    this.selectedItems = new Set(); // 选中的项目ID集合
    this.currentCategory = ''; // 当前选中的题材
    this.currentCategoryUrl = '/audio/list'; // 当前分类URL
    
    // 题材列表
    this.categories = [
      { name: '全部题材', value: '' },
      { name: '有声小说', value: '有声小说' },
      { name: '淫词艳曲', value: '淫词艳曲' },
      { name: '激情骚麦', value: '激情骚麦' },
      { name: '寸止训练', value: '寸止训练' },
      { name: 'ASMR', value: 'ASMR' }
    ];
  }
  
  /**
   * 设置当前分类URL（供外部调用）
   */
  setCurrentCategoryUrl(url) {
    this.currentCategoryUrl = url || '/audio/list';
    console.log('[UAA-Renderer] 设置当前分类URL:', this.currentCategoryUrl);
  }
  
  /**
   * 渲染内容列表
   */
  renderContentList(items) {
    console.log('\n\n========================================');
    console.log('======== [UAA-Renderer] 开始渲染列表 ========');
    console.log('========================================');
    console.log('[UAA-Renderer] 接收到的数据数量:', items ? items.length : 0);
    console.log('[UAA-Renderer] 数据类型:', typeof items);
    console.log('[UAA-Renderer] 是否是数组:', Array.isArray(items));
    
    this.contentList = document.getElementById('contentList');
    if (!this.contentList) {
      console.error('[UAA-Renderer] ✗ 找不到内容列表容器 #contentList');
      return;
    }
    console.log('[UAA-Renderer] ✓ 找到内容列表容器');
    
    // 保存当前列表数据（用于同步）
    this.currentAudioList = items || [];
    console.log('[UAA-Renderer] ✓ 保存列表数据:', this.currentAudioList.length, '条');
    
    // 切换为卡片网格布局样式（添加uaa-site标识避免影响51吃瓜）
    this.contentList.className = 'audio-list-container uaa-site';
    this.contentList.innerHTML = '';
    
    if (!items || items.length === 0) {
      this.contentList.innerHTML = '<div class="empty-state"><p>暂无音频数据</p></div>';
      return;
    }
    
    // 创建同步工具栏
    const toolbar = this.createSyncToolbar();
    this.contentList.appendChild(toolbar);
    
    // 创建题材筛选器
    const categoryFilter = this.createCategoryFilter();
    this.contentList.appendChild(categoryFilter);
    
    // 创建网格容器
    const gridContainer = document.createElement('div');
    gridContainer.className = 'audio-list';
    gridContainer.id = 'audioGridContainer';
    
    // 渲染每个音频项
    items.forEach((audio, index) => {
      try {
        const item = this.createAudioListItem(audio, index);
        gridContainer.appendChild(item);
      } catch (error) {
        console.error(`[UAA-Renderer] 渲染音频项失败 [${audio.title}]:`, error);
      }
    });
    
    this.contentList.appendChild(gridContainer);
    
    console.log('[UAA-Renderer] 渲染完成');
    
    // 绑定checkbox事件
    this.bindCheckboxEvents();
    
    // 初始化同步进度监听
    this.initSyncListeners();
    
    // ✅ 自动检查同步状态（异步执行，不阻塞UI）
    console.log('[UAA-Renderer] ========== 准备自动检查同步状态 ==========');
    console.log('[UAA-Renderer] 列表数据数量:', this.currentAudioList.length);
    this.autoCheckSyncStatus();
  }
  
  /**
   * 绑定checkbox事件
   */
  bindCheckboxEvents() {
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation(); // 阻止事件冒泡
        const audioId = e.target.dataset.id;
        const isChecked = e.target.checked;
        
        if (isChecked) {
          this.selectedItems.add(audioId);
        } else {
          this.selectedItems.delete(audioId);
        }
        
        // 更新卡片样式
        const card = e.target.closest('.audio-list-item');
        if (card) {
          if (isChecked) {
            card.classList.add('selected');
          } else {
            card.classList.remove('selected');
          }
        }
        
        // 更新工具栏
        this.updateToolbar();
      });
      
      // 阻止checkbox点击冒泡到卡片
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });
  }
  
  /**
   * 处理全选/取消全选
   */
  handleSelectAll(isSelectAll) {
    console.log(`[UAA-Renderer] 全选操作: ${isSelectAll ? '全选' : '取消全选'}`);
    
    this.selectedItems.clear();
    
    let skippedCount = 0;
    let selectedCount = 0;
    
    // 更新所有checkbox和卡片样式
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
      const card = checkbox.closest('.audio-list-item');
      
      // ✅ 检查卡片是否已同步（有 .synced 类）
      const isSynced = card && card.classList.contains('synced');
      
      // ✅ 检查checkbox是否已禁用
      const isDisabled = checkbox.disabled;
      
      if (isSelectAll) {
        // 全选时：跳过已同步和已禁用的项
        if (isSynced || isDisabled) {
          checkbox.checked = false;
          if (card) {
            card.classList.remove('selected');
          }
          skippedCount++;
          console.log(`[UAA-Renderer]   跳过已同步项: ${checkbox.dataset.id}`);
        } else {
          checkbox.checked = true;
          if (card) {
            card.classList.add('selected');
          }
          const audioId = checkbox.dataset.id;
          if (audioId) {
            this.selectedItems.add(audioId);
            selectedCount++;
          }
        }
      } else {
        // 取消全选：清空所有选中状态（除了已禁用的）
        if (!isDisabled) {
          checkbox.checked = false;
          if (card) {
            card.classList.remove('selected');
          }
        }
      }
    });
    
    if (isSelectAll) {
      console.log(`[UAA-Renderer] 全选完成: 已选${selectedCount}项, 跳过${skippedCount}个已同步项`);
      if (skippedCount > 0) {
        showToast(`已选择 ${selectedCount} 项（跳过 ${skippedCount} 个已同步项）`, 'info');
      }
    }
    
    // 更新工具栏
    this.updateToolbar();
  }
  
  /**
   * 更新工具栏状态
   */
  updateToolbar() {
    const selectedCount = this.selectedItems.size;
    const selectionInfo = document.getElementById('uaaSelectionInfo');
    const syncBtn = document.getElementById('uaaSyncBtn');
    const selectAllCheckbox = document.getElementById('uaaSelectAll');
    
    if (selectionInfo) {
      selectionInfo.textContent = `已选择 ${selectedCount} 项`;
    }
    
    if (syncBtn) {
      syncBtn.disabled = selectedCount === 0;
    }
    
    // 更新全选checkbox的状态
    if (selectAllCheckbox) {
      const totalCount = this.currentAudioList.length;
      selectAllCheckbox.checked = selectedCount > 0 && selectedCount === totalCount;
      selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalCount;
    }
  }
  
  /**
   * 创建同步工具栏（参考51吃瓜样式）
   */
  createSyncToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar-container uaa-toolbar';
    toolbar.id = 'uaaToolbarContainer';
    toolbar.innerHTML = `
      <div class="toolbar-left">
        <label class="checkbox-label">
          <input type="checkbox" id="uaaSelectAll">
          <span>全选</span>
        </label>
        <span class="selection-info" id="uaaSelectionInfo">已选择 0 项</span>
      </div>
      <div class="toolbar-right">
        <button class="action-btn" id="uaaCheckStatusBtn">
          <span class="icon">🔍</span>
          <span class="text">检查同步状态</span>
        </button>
        <button class="action-btn primary" id="uaaSyncBtn" disabled>
          <span class="icon">🔄</span>
          <span class="text">同步选中项</span>
        </button>
      </div>
    `;
    
    // 绑定按钮事件
    setTimeout(() => {
      const selectAllCheckbox = document.getElementById('uaaSelectAll');
      const syncBtn = document.getElementById('uaaSyncBtn');
      const checkStatusBtn = document.getElementById('uaaCheckStatusBtn');
      
      if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => this.handleSelectAll(e.target.checked));
      }
      
      if (syncBtn) {
        syncBtn.addEventListener('click', () => this.handleBatchSync());
      }
      
      if (checkStatusBtn) {
        checkStatusBtn.addEventListener('click', () => this.handleCheckStatus());
      }
    }, 100);
    
    return toolbar;
  }
  
  /**
   * 创建题材筛选器
   */
  createCategoryFilter() {
    const filterContainer = document.createElement('div');
    filterContainer.className = 'category-filter-container';
    filterContainer.id = 'uaaCategoryFilter';
    
    const filterHTML = `
      <div class="category-filter">
        <span class="filter-label">题材筛选：</span>
        <div class="filter-buttons">
          ${this.categories.map(cat => `
            <button class="category-btn ${cat.value === this.currentCategory ? 'active' : ''}" 
                    data-category="${cat.value}">
              ${cat.name}
            </button>
          `).join('')}
        </div>
      </div>
    `;
    
    filterContainer.innerHTML = filterHTML;
    
    // 绑定点击事件
    setTimeout(() => {
      const buttons = filterContainer.querySelectorAll('.category-btn');
      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          const category = btn.dataset.category;
          this.handleCategoryChange(category);
        });
      });
    }, 100);
    
    return filterContainer;
  }
  
  /**
   * 处理题材切换
   */
  async handleCategoryChange(category) {
    console.log('[UAA-Renderer] 切换题材:', category || '全部');
    
    this.currentCategory = category;
    
    // 保存到全局状态，供分页使用
    if (window.currentState) {
      window.currentState.currentOptions = category ? { category } : {};
    }
    
    // 更新按钮状态
    const buttons = document.querySelectorAll('.category-btn');
    buttons.forEach(btn => {
      if (btn.dataset.category === category) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // 重新加载数据
    showToast('加载中...', 'info');
    
    try {
      const options = category ? { category } : {};
      const result = await window.electronAPI.getContent('uaa', this.currentCategoryUrl, 1, options);
      
      if (result.success && result.data) {
        const items = result.data.items || result.data;
        const pagination = result.data.pagination;
        
        console.log('[UAA-Renderer] 加载成功:', items.length, '条数据');
        console.log('[UAA-Renderer] 分页信息:', pagination);
        
        // 渲染列表
        this.renderContentList(items);
        
        // 渲染分页器
        if (pagination && window.renderPagination) {
          window.renderPagination(pagination);
          window.currentState.pagination = pagination;
          window.currentState.currentPage = 1;
        }
        
        showToast(`加载完成，共 ${items.length} 条`, 'success');
      } else {
        console.error('[UAA-Renderer] 加载失败:', result.error);
        showToast('加载失败: ' + (result.error || '未知错误'), 'error');
      }
    } catch (error) {
      console.error('[UAA-Renderer] 加载异常:', error);
      showToast('加载异常: ' + error.message, 'error');
    }
  }
  
  /**
   * 处理批量同步（只同步选中的项目）
   */
  async handleBatchSync() {
    if (this.syncInProgress) {
      showToast('同步正在进行中...', 'warning');
      return;
    }
    
    const selectedCount = this.selectedItems.size;
    
    if (selectedCount === 0) {
      showToast('请先选择要同步的项目', 'warning');
      return;
    }
    
    try {
      this.syncInProgress = true;
      
      // 获取选中的音频项
      const selectedAudios = this.currentAudioList.filter(audio => {
        const audioId = audio.article_id || audio.id;
        return this.selectedItems.has(audioId);
      });
      
      console.log('[UAA-Renderer] 准备同步选中项:', selectedAudios.length);
      showToast(`开始同步 ${selectedAudios.length} 个有声小说...`, 'info');
      
      // 调用同步API
      const result = await window.electronAPI.uaaStartSync(selectedAudios);
      
      if (result.success) {
        console.log('[UAA-Renderer] 同步已启动:', result);
        showToast(`同步已启动，待处理: ${result.addResult.needSync} 个`, 'success');
        
        // 不再显示弹出层，改为卡片底部进度
        // this.showSyncProgressPanel(result.stats);
      } else {
        throw new Error(result.error || '启动同步失败');
      }
      
    } catch (error) {
      console.error('[UAA-Renderer] 批量同步失败:', error);
      showToast(`同步失败: ${error.message}`, 'error');
      this.syncInProgress = false;
    }
  }
  
  /**
   * 自动检查同步状态（列表加载后自动执行）
   */
  async autoCheckSyncStatus() {
    console.log('[UAA-Renderer] >>>>>> autoCheckSyncStatus 开始执行 <<<<<<');
    
    if (this.currentAudioList.length === 0) {
      console.log('[UAA-Renderer] ⚠️ 列表为空，跳过检查');
      return;
    }
    
    try {
      console.log('[UAA-Renderer] ✓ 自动检查同步状态...');
      console.log('[UAA-Renderer] ✓ 列表总数:', this.currentAudioList.length);
      console.log('[UAA-Renderer] ✓ 当前列表数据示例 (前3条):', this.currentAudioList.slice(0, 3).map(item => ({
        article_id: item.article_id,
        id: item.id,
        title: item.title
      })));
      
      console.log('[UAA-Renderer] >>> 调用 electronAPI.uaaCheckSyncStatus...');
      const result = await window.electronAPI.uaaCheckSyncStatus(this.currentAudioList);
      console.log('[UAA-Renderer] <<< electronAPI.uaaCheckSyncStatus 返回');
      
      if (result.success) {
        console.log('[UAA-Renderer] ✓ 检查成功！');
        console.log('[UAA-Renderer] ✓ 结果数量:', Object.keys(result.results).length);
        console.log('[UAA-Renderer] ✓ 前3个结果:', 
          Object.entries(result.results).slice(0, 3).map(([id, data]) => ({
            id, 
            exists: data.exists, 
            novel_id: data.novel_id
          }))
        );
        
        // 统计已同步的数量
        let syncedCount = 0;
        let notFoundCount = 0;
        let notSyncedCount = 0;
        
        console.log('[UAA-Renderer] >>> 开始遍历结果并标记卡片...');
        
        // 更新每个卡片的同步状态
        Object.entries(result.results).forEach(([audioId, item]) => {
          if (item.exists) {
            console.log(`[UAA-Renderer] ✓ audioId=${audioId}, exists=true, novel_id=${item.novel_id}`);
            syncedCount++;
            
            // 标记卡片为已同步
            const card = document.querySelector(`.audio-list-item[data-audio-id="${audioId}"]`);
            if (card) {
              console.log(`[UAA-Renderer]   → 找到DOM卡片，开始标记...`);
              this.markCardAsSynced(audioId, item.novel_id);
            } else {
              notFoundCount++;
              console.warn(`[UAA-Renderer]   ✗ 找不到DOM卡片: audioId=${audioId}`);
            }
          } else {
            notSyncedCount++;
          }
        });
        
        console.log('[UAA-Renderer] <<< 遍历完成');
        console.log(`[UAA-Renderer] 统计: 已同步=${syncedCount}, 未同步=${notSyncedCount}, 找不到卡片=${notFoundCount}`);
        
        // 更新工具栏统计
        this.updateToolbar();
        
        if (syncedCount > 0) {
          console.log(`[UAA-Renderer] ========== ✓ 自动标记了 ${syncedCount} 个已同步项 ==========`);
        } else {
          console.log(`[UAA-Renderer] ========== ⚠️ 没有需要标记的已同步项 ==========`);
        }
        if (notFoundCount > 0) {
          console.warn(`[UAA-Renderer] ⚠️ ${notFoundCount} 个已同步项在DOM中找不到对应卡片`);
        }
      } else {
        console.error('[UAA-Renderer] ✗ 检查失败:', result.error);
      }
      
    } catch (error) {
      console.error('[UAA-Renderer] ✗✗✗ 自动检查状态失败 ✗✗✗');
      console.error('[UAA-Renderer] 错误类型:', error.name);
      console.error('[UAA-Renderer] 错误信息:', error.message);
      console.error('[UAA-Renderer] 错误堆栈:', error.stack);
      // 静默失败，不影响用户体验
    }
    
    console.log('[UAA-Renderer] <<<<<< autoCheckSyncStatus 结束 >>>>>>');
  }
  
  /**
   * 处理检查状态（手动点击按钮）
   */
  async handleCheckStatus() {
    if (this.currentAudioList.length === 0) {
      showToast('没有可检查的数据', 'warning');
      return;
    }
    
    try {
      showToast('正在检查同步状态...', 'info');
      
      const result = await window.electronAPI.uaaCheckSyncStatus(this.currentAudioList);
      
      if (result.success) {
        console.log('[UAA-Renderer] 同步状态检查结果:', result.results);
        
        // 统计已同步和未同步的数量
        let syncedCount = 0;
        let notSyncedCount = 0;
        
        // 更新每个卡片的同步状态
        Object.entries(result.results).forEach(([audioId, item]) => {
          if (item.exists) {
            syncedCount++;
            // 标记卡片为已同步
            this.markCardAsSynced(audioId, item.novel_id);
          } else {
            notSyncedCount++;
          }
        });
        
        // 更新工具栏统计
        this.updateToolbar();
        
        showToast(`已同步: ${syncedCount} 个，未同步: ${notSyncedCount} 个`, 'success');
      } else {
        throw new Error(result.error || '检查状态失败');
      }
      
    } catch (error) {
      console.error('[UAA-Renderer] 检查状态失败:', error);
      showToast(`检查失败: ${error.message}`, 'error');
    }
  }
  
  /**
   * 显示同步进度面板
   */
  showSyncProgressPanel(stats) {
    // 检查是否已存在面板
    let panel = document.getElementById('uaa-sync-progress-panel');
    
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'uaa-sync-progress-panel';
      panel.className = 'sync-progress-panel';
      document.body.appendChild(panel);
    }
    
    panel.innerHTML = `
      <div class="panel-header">
        <h3>同步进度</h3>
        <button class="close-btn" onclick="this.parentElement.parentElement.style.display='none'">✖</button>
      </div>
      <div class="panel-body">
        <div class="stats-row">
          <div class="stat-item">
            <span class="stat-label">总计:</span>
            <span class="stat-value" id="uaa-stat-total">${stats.total || 0}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">待处理:</span>
            <span class="stat-value" id="uaa-stat-pending">${stats.pending || 0}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">进行中:</span>
            <span class="stat-value running" id="uaa-stat-running">${stats.running || 0}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">已完成:</span>
            <span class="stat-value completed" id="uaa-stat-completed">${stats.completed || 0}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">失败:</span>
            <span class="stat-value failed" id="uaa-stat-failed">${stats.failed || 0}</span>
          </div>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" id="uaa-progress-bar" style="width: 0%"></div>
        </div>
        <div class="current-task" id="uaa-current-task">准备中...</div>
      </div>
      <div class="panel-footer">
        <button class="btn-stop" id="uaa-stop-sync-btn">停止同步</button>
      </div>
    `;
    
    panel.style.display = 'block';
    
    // 绑定停止按钮
    setTimeout(() => {
      const stopBtn = document.getElementById('uaa-stop-sync-btn');
      if (stopBtn) {
        stopBtn.addEventListener('click', () => this.handleStopSync());
      }
    }, 100);
  }
  
  /**
   * 处理停止同步
   */
  async handleStopSync() {
    try {
      const result = await window.electronAPI.uaaStopSync();
      
      if (result.success) {
        showToast('同步已停止', 'info');
        this.syncInProgress = false;
      } else {
        throw new Error(result.error || '停止失败');
      }
    } catch (error) {
      console.error('[UAA-Renderer] 停止同步失败:', error);
      showToast(`停止失败: ${error.message}`, 'error');
    }
  }
  
  /**
   * 初始化同步进度监听
   */
  initSyncListeners() {
    // 监听同步进度
    window.electronAPI.onUaaSyncProgress((data) => {
      console.log('[UAA-Renderer] 同步进度:', data);
      this.updateSyncProgress(data);
    });
    
    // 监听同步完成
    window.electronAPI.onUaaSyncCompleted((data) => {
      console.log('[UAA-Renderer] 同步完成:', data);
      this.syncInProgress = false;
      showToast('同步完成！', 'success');
      this.updateSyncProgress({ type: 'queue-completed', stats: data.stats });
    });
    
    // 监听同步错误
    window.electronAPI.onUaaSyncError((data) => {
      console.error('[UAA-Renderer] 同步错误:', data);
      this.syncInProgress = false;
      showToast(`同步错误: ${data.error}`, 'error');
    });
    
    // 监听跳过的已同步数据
    window.electronAPI.onUaaSyncSkipped((data) => {
      console.log('[UAA-Renderer] 收到已同步数据通知:', data.skippedItems);
      
      // 标记这些卡片为已同步
      if (data.skippedItems && data.skippedItems.length > 0) {
        data.skippedItems.forEach(item => {
          this.markCardAsSynced(item.audioId, item.novelId);
        });
        
        showToast(`已跳过 ${data.skippedItems.length} 个已同步项`, 'info');
      }
    });
  }
  
  /**
   * 更新同步进度（改为更新卡片底部进度）
   */
  updateSyncProgress(data) {
    console.log('[UAA-Renderer] 更新同步进度:', data);
    
    // 如果是任务进度更新，更新对应卡片的进度
    if (data.taskId || data.data?.taskId) {
      const taskId = data.taskId || data.data?.taskId;
      const progressData = {
        status: data.status || data.data?.status,
        step: data.step || data.data?.step,
        progress: data.progress || data.data?.progress || 0,
        error: data.error || data.data?.error,
        details: data.details || data.data?.details, // 传递details（包含novelId）
        novelId: data.details?.novelId || data.data?.details?.novelId // 直接提取novelId
      };
      
      // 更新卡片底部进度
      this.updateCardSyncProgress(taskId, progressData);
    }
    
    // 如果是队列统计更新，可以在控制台输出或工具栏显示总体进度
    if (data.stats || data.data?.stats) {
      const stats = data.stats || data.data?.stats;
      const total = stats.total || 0;
      const completed = stats.completed || 0;
      const failed = stats.failed || 0;
      
      console.log(`[UAA-Renderer] 队列进度: ${completed + failed}/${total} (完成${completed}, 失败${failed})`);
      
      // 可选：在工具栏显示整体进度
      const selectionInfo = document.getElementById('selectionInfo');
      if (selectionInfo && total > 0) {
        selectionInfo.textContent = `同步进度: ${completed + failed}/${total} (完成${completed}, 失败${failed})`;
      }
    }
    
    // 处理遗留代码（兼容旧的右侧面板，如果需要）
    if (data.type === 'task-progress' && data.data) {
      const currentTaskEl = document.getElementById('uaa-current-task');
      if (currentTaskEl) {
        currentTaskEl.textContent = `${data.data.step} (${data.data.progress}%)`;
      }
    }
  }
  
  /**
   * 创建音频列表项（整合详情数据）
   */
  createAudioListItem(audio, index) {
    const item = document.createElement('div');
    item.className = 'audio-list-item';
    item.dataset.audioId = audio.article_id || audio.id;
    item.dataset.index = index;
    
    // 检查是否已选中
    const isSelected = this.selectedItems.has(audio.article_id || audio.id);
    if (isSelected) {
      item.classList.add('selected');
    }
    
    // 封面部分（添加 checkbox）
    const coverHtml = `
      <div class="audio-cover">
        <div class="card-checkbox-overlay">
          <input type="checkbox" 
                 class="item-checkbox" 
                 data-id="${audio.article_id || audio.id}" 
                 ${isSelected ? 'checked' : ''}>
        </div>
        
        <img src="${audio.coverUrl || ''}" 
             alt="${audio.title}" 
             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'120\\' height=\\'120\\'%3E%3Crect fill=\\'%232d2d2d\\' width=\\'120\\' height=\\'120\\'/%3E%3Ctext fill=\\'%23666\\' x=\\'50%25\\' y=\\'50%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'40\\'%3E🎵%3C/text%3E%3C/svg%3E'" />
        ${audio.totalDuration ? `<div class="audio-duration">${audio.totalDuration}</div>` : ''}
        ${audio.episodeCount ? `<div class="audio-episodes">${audio.episodeCount}集</div>` : ''}
      </div>
    `;
    
    // 构建描述文本（整合列表和详情）
    const description = audio.description || '';
    const shortDesc = description.length > 80 ? description.substring(0, 80) + '...' : description;
    
    // 信息部分（优化布局）
    const infoHtml = `
      <div class="audio-info">
        <div class="audio-title" title="${audio.title || '未知标题'}">${audio.title || '未知标题'}</div>
        
        <div class="audio-meta-group">
          <div class="meta-row-1">
            <span class="meta-category">${audio.category || '有声小说'}</span>
            ${audio.updateTime ? `<span class="stat-time">${audio.updateTime}</span>` : ''}
          </div>
          
          <div class="meta-row-2">
            ${audio.listenCount ? `<span class="stat-listen">🎧 ${audio.listenCount}</span>` : ''}
            ${audio.collectCount && audio.collectCount !== '0' ? `<span class="stat-collect">❤️ ${audio.collectCount}</span>` : audio.likeCount && audio.likeCount !== '0' ? `<span class="stat-collect">❤️ ${audio.likeCount}</span>` : ''}
          </div>
        </div>
      </div>
    `;
    
    // 操作按钮部分
    const hasAudio = audio.audioUrls && audio.audioUrls.length > 0;
    const hasEpisodes = audio.episodes && audio.episodes.length > 0;
    
    const actionsHtml = `
      <div class="audio-actions">
        <button class="audio-btn btn-detail" data-action="detail" title="访问原站">
          <span class="btn-icon">🔗</span>
          <span class="btn-text">原站</span>
        </button>
      </div>
    `;
    
    // 同步进度区域（默认隐藏）
    const syncProgressHtml = `
      <div class="card-sync-progress" style="display: none;">
        <div class="sync-progress-bar">
          <div class="sync-progress-fill" style="width: 0%;"></div>
        </div>
        <div class="sync-status-text">
          <span class="step">准备同步...</span>
          <span class="percentage">0%</span>
        </div>
      </div>
    `;
    
    item.innerHTML = coverHtml + infoHtml + actionsHtml + syncProgressHtml;
    
    // 绑定事件
    this.bindItemEvents(item, audio);
    
    return item;
  }
  
  /**
   * 绑定列表项事件
   */
  bindItemEvents(item, audio) {
    // 详情按钮
    const detailBtn = item.querySelector('[data-action="detail"]');
    if (detailBtn) {
      detailBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleDetail(audio);
      });
    }
    
    // 阻止checkbox区域的点击冒泡
    const checkboxOverlay = item.querySelector('.card-checkbox-overlay');
    if (checkboxOverlay) {
      checkboxOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
    
    // 点击整行也可以查看详情
    item.addEventListener('click', (e) => {
      // 如果点击的是checkbox或按钮，不触发详情
      if (e.target.closest('.item-checkbox') || 
          e.target.closest('.card-checkbox-overlay') ||
          e.target.closest('.audio-actions')) {
        return;
      }
      // 只有在没有点击按钮的情况下才触发
      if (!event.target.closest('button')) {
        this.handlePlay(audio);
      }
    });
  }
  
  /**
   * 获取音频详情
   */
  async fetchAudioDetail(audio) {
    try {
      console.log('[UAA-Renderer] 获取详情:', audio.article_id, audio.detailUrl);
      
      // 调用后端IPC获取详情
      const result = await window.electronAPI.getAudioDetail('uaa', audio.article_id || audio.id, audio.detailUrl);
      
      if (result.success && result.data) {
        console.log('[UAA-Renderer] 详情获取成功:', result.data.title);
        return result.data;
      } else {
        console.error('[UAA-Renderer] 获取详情失败:', result.error);
        return null;
      }
    } catch (error) {
      console.error('[UAA-Renderer] 获取详情异常:', error);
      return null;
    }
  }
  
  /**
   * 处理章节列表
   */
  handleEpisodes(audio) {
    console.log('[UAA-Renderer] 显示章节列表:', audio.title, audio.episodes.length);
    
    if (!audio.episodes || audio.episodes.length === 0) {
      showToast('暂无章节信息', 'warning');
      return;
    }
    
    // 显示章节选择对话框
    this.showEpisodesDialog(audio);
  }
  
  /**
   * 处理详情 - 直接打开原站页面
   */
  handleDetail(audio) {
    console.log('[UAA-Renderer] 打开原站详情:', audio.title, audio.detailUrl);
    
    if (audio.detailUrl) {
      // 使用 Electron 的 shell 打开外部链接
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(audio.detailUrl);
      } else {
        // 降级方案：使用 window.open
        window.open(audio.detailUrl, '_blank');
      }
      showToast(`正在打开: ${audio.title}`, 'info');
    } else {
      showToast('详情链接不可用', 'error');
    }
  }
  
  /**
   * 标记卡片为已同步
   * @param {string} audioId - 音频ID
   * @param {number} novelId - 服务端novel_id
   */
  markCardAsSynced(audioId, novelId) {
    console.log(`[UAA-Renderer] >>> markCardAsSynced 开始: audioId=${audioId}, novelId=${novelId}`);
    
    const card = document.querySelector(`.audio-list-item[data-audio-id="${audioId}"]`);
    if (!card) {
      console.warn(`[UAA-Renderer] ✗ 找不到卡片: ${audioId}`);
      // 列出所有卡片的ID供调试
      const allCards = document.querySelectorAll('.audio-list-item');
      const allIds = Array.from(allCards).map(c => c.dataset.audioId);
      console.warn(`[UAA-Renderer] 当前DOM中的所有卡片ID (前5个):`, allIds.slice(0, 5));
      return;
    }
    
    console.log(`[UAA-Renderer] ✓ 找到卡片，开始标记: ${audioId} (novel_id=${novelId})`);
    
    // 添加已同步样式
    console.log(`[UAA-Renderer]   → 添加 .synced 样式`);
    card.classList.add('synced');
    
    // 移除选中状态
    console.log(`[UAA-Renderer]   → 移除选中状态`);
    card.classList.remove('selected');
    this.selectedItems.delete(audioId);
    
    // 禁用checkbox
    const checkbox = card.querySelector('.item-checkbox');
    if (checkbox) {
      console.log(`[UAA-Renderer]   → 禁用checkbox`);
      checkbox.checked = false;
      checkbox.disabled = true;
    } else {
      console.warn(`[UAA-Renderer]   ✗ 找不到checkbox`);
    }
    
    // 添加已同步标记到封面
    const cover = card.querySelector('.audio-cover');
    if (cover && !cover.querySelector('.sync-badge-overlay')) {
      console.log(`[UAA-Renderer]   → 添加绿色✓标记`);
      const badge = document.createElement('div');
      badge.className = 'sync-badge-overlay synced';
      badge.innerHTML = '<span class="badge-icon">✓</span>';
      cover.appendChild(badge);
    } else if (!cover) {
      console.warn(`[UAA-Renderer]   ✗ 找不到封面元素`);
    } else {
      console.log(`[UAA-Renderer]   ℹ 标记已存在，跳过`);
    }
    
    console.log(`[UAA-Renderer] <<< markCardAsSynced 完成: ${audioId}`);
  }
  
  /**
   * 更新卡片底部同步进度
   * @param {string} itemId - 项目ID
   * @param {object} progressData - 进度数据 { status, step, progress, error }
   */
  updateCardSyncProgress(itemId, progressData) {
    const card = document.querySelector(`.audio-list-item[data-audio-id="${itemId}"]`);
    if (!card) return;
    
    let progressDiv = card.querySelector('.card-sync-progress');
    if (!progressDiv) return;
    
    const { status, step, progress, error } = progressData;
    
    // 显示进度区域
    progressDiv.style.display = 'block';
    card.classList.add('syncing');
    
    // 更新进度条
    const progressBar = progressDiv.querySelector('.sync-progress-fill');
    if (progressBar) {
      progressBar.style.width = `${progress || 0}%`;
    }
    
    // 更新文本
    const statusText = progressDiv.querySelector('.sync-status-text');
    const stepSpan = progressDiv.querySelector('.step');
    const percentageSpan = progressDiv.querySelector('.percentage');
    
    if (stepSpan) {
      stepSpan.textContent = step || '同步中...';
    }
    
    if (percentageSpan) {
      percentageSpan.textContent = `${Math.round(progress || 0)}%`;
    }
    
    // 根据状态设置样式
    if (statusText) {
      statusText.className = 'sync-status-text';
      if (status === 'completed') {
        statusText.classList.add('success');
        stepSpan.textContent = '✓ 同步成功';
        progressBar.style.width = '100%';
        
        // 标记卡片为已同步（获取novel_id从progressData）
        const novelId = progressData.novelId || progressData.details?.novelId;
        if (novelId) {
          // 3秒后隐藏进度条并标记为已同步
          setTimeout(() => {
            progressDiv.classList.add('fade-out');
            setTimeout(() => {
              progressDiv.style.display = 'none';
              progressDiv.classList.remove('fade-out');
              card.classList.remove('syncing');
              
              // 标记为已同步
              this.markCardAsSynced(itemId, novelId);
            }, 300);
          }, 3000);
        } else {
          // 如果没有novelId，也要隐藏进度条
          setTimeout(() => {
            progressDiv.classList.add('fade-out');
            setTimeout(() => {
              progressDiv.style.display = 'none';
              progressDiv.classList.remove('fade-out');
              card.classList.remove('syncing');
            }, 300);
          }, 3000);
        }
      } else if (status === 'failed' || error) {
        statusText.classList.add('error');
        stepSpan.textContent = `✗ ${error || '同步失败'}`;
        
        // 5秒后隐藏进度条
        setTimeout(() => {
          progressDiv.classList.add('fade-out');
          setTimeout(() => {
            progressDiv.style.display = 'none';
            progressDiv.classList.remove('fade-out');
            card.classList.remove('syncing');
          }, 300);
        }, 5000);
      }
    }
  }
  
  /**
   * 显示详情对话框
   */
  async showDetailDialog(audio) {
    // 如果没有完整详情，先获取
    if (!audio.rating && !audio.collectCount) {
      showToast('正在加载详情...', 'info');
      const detail = await this.fetchAudioDetail(audio);
      if (detail) {
        Object.assign(audio, detail);
      }
    }
    
    const dialog = document.createElement('div');
    dialog.className = 'audio-detail-dialog';
    
    // 构建评分星星
    const ratingHtml = audio.rating && audio.rating !== '暂无评分' 
      ? `<div class="rating-stars">${this.buildRatingStars(audio.rating)}</div>`
      : '<span class="no-rating">暂无评分</span>';
    
    dialog.innerHTML = `
      <div class="dialog-overlay"></div>
      <div class="dialog-content detail-dialog-content">
        <div class="dialog-header">
          <h2 class="dialog-title">${audio.title}</h2>
          <button class="dialog-close">×</button>
        </div>
        <div class="dialog-body detail-body">
          <div class="detail-main">
            <div class="detail-cover">
              <img src="${audio.coverUrl || ''}" alt="${audio.title}">
              ${audio.status ? `<div class="cover-badge badge-${audio.status === '完结' ? 'completed' : 'ongoing'}">${audio.status}</div>` : ''}
            </div>
            <div class="detail-meta">
              ${audio.cv ? `
                <div class="meta-row">
                  <span class="meta-label">CV:</span>
                  <span class="meta-value">${audio.cv}</span>
                </div>
              ` : ''}
              ${audio.category ? `
                <div class="meta-row">
                  <span class="meta-label">分类:</span>
                  <span class="meta-value">${audio.category}</span>
                </div>
              ` : ''}
              ${audio.status ? `
                <div class="meta-row">
                  <span class="meta-label">状态:</span>
                  <span class="meta-value status-${audio.status === '完结' ? 'completed' : 'ongoing'}">${audio.status}</span>
                </div>
              ` : ''}
              ${audio.latestEpisode ? `
                <div class="meta-row">
                  <span class="meta-label">最新:</span>
                  <span class="meta-value">${audio.latestEpisode}</span>
                </div>
              ` : audio.updateTime ? `
                <div class="meta-row">
                  <span class="meta-label">最新:</span>
                  <span class="meta-value">${audio.updateTime}更新</span>
                </div>
              ` : ''}
            </div>
          </div>
          <div class="detail-stats">
            ${audio.listenCount ? `
              <div class="stat-item">
                <span class="stat-label">收听量:</span>
                <span class="stat-value">${audio.listenCount}</span>
              </div>
            ` : ''}
            ${audio.collectCount ? `
              <div class="stat-item">
                <span class="stat-label">收藏量:</span>
                <span class="stat-value">${audio.collectCount}</span>
              </div>
            ` : ''}
            ${audio.episodeCount ? `
              <div class="stat-item">
                <span class="stat-label">章节数:</span>
                <span class="stat-value">${audio.episodeCount}集</span>
              </div>
            ` : ''}
          </div>
          ${audio.rating ? `
            <div class="detail-rating">
              <span class="rating-label">评分:</span>
              ${ratingHtml}
            </div>
          ` : ''}
          ${audio.description ? `
            <div class="detail-description">
              <h4>简介</h4>
              <p>${audio.description}</p>
            </div>
          ` : ''}
        </div>
        <div class="dialog-footer">
          ${audio.episodes && audio.episodes.length > 0 ? `
            <button class="btn btn-secondary btn-episodes-detail">
              <span class="btn-icon">📋</span> 章节列表
            </button>
          ` : ''}
          <button class="btn btn-link" onclick="window.open('${audio.detailUrl}', '_blank')">访问原站</button>
          <button class="btn dialog-close">关闭</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // 绑定事件
    dialog.querySelectorAll('.dialog-close').forEach(btn => {
      btn.addEventListener('click', () => dialog.remove());
    });
    
    dialog.querySelector('.dialog-overlay').addEventListener('click', () => dialog.remove());
    
    const episodesBtn = dialog.querySelector('.btn-episodes-detail');
    if (episodesBtn) {
      episodesBtn.addEventListener('click', () => {
        this.handleEpisodes(audio);
        dialog.remove();
      });
    }
  }
  
  /**
   * 构建评分星星
   */
  buildRatingStars(rating) {
    const score = parseFloat(rating);
    if (isNaN(score)) return '<span class="rating-text">暂无评分</span>';
    
    const fullStars = Math.floor(score);
    const hasHalfStar = score % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let html = '';
    for (let i = 0; i < fullStars; i++) html += '⭐';
    if (hasHalfStar) html += '✨';
    for (let i = 0; i < emptyStars; i++) html += '☆';
    
    html += ` <span class="rating-text">${score.toFixed(1)}</span>`;
    return html;
  }
  
  /**
   * 显示章节选择对话框
   */
  showEpisodesDialog(audio) {
    const dialog = document.createElement('div');
    dialog.className = 'audio-episodes-dialog';
    
    const episodesHtml = audio.episodes.map((ep, index) => `
      <div class="episode-item" data-index="${index}">
        <span class="episode-number">${ep.index || index + 1}</span>
        <span class="episode-title">${ep.title}</span>
        ${ep.duration ? `<span class="episode-duration">${ep.duration}</span>` : ''}
      </div>
    `).join('');
    
    dialog.innerHTML = `
      <div class="dialog-overlay"></div>
      <div class="dialog-content episodes-content">
        <div class="dialog-header">
          <h2>${audio.title} - 章节列表</h2>
          <button class="dialog-close">×</button>
        </div>
        <div class="dialog-body episodes-list">
          ${episodesHtml}
        </div>
        <div class="dialog-footer">
          <button class="btn btn-secondary dialog-close">关闭</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // 绑定关闭事件
    dialog.querySelectorAll('.dialog-close').forEach(btn => {
      btn.addEventListener('click', () => {
        dialog.remove();
      });
    });
    
    dialog.querySelector('.dialog-overlay').addEventListener('click', () => {
      dialog.remove();
    });
  }
}

// 导出为全局实例（如果在浏览器环境）
if (typeof window !== 'undefined') {
  window.UAAAudioRenderer = UAAAudioRenderer;
}
