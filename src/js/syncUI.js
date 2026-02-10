/**
 * 同步UI管理器
 * 负责渲染同步相关的UI元素
 */

/**
 * 渲染带复选框的内容列表
 */
function renderContentListWithCheckbox(items) {
  const contentList = document.getElementById('contentList');
  const toolbarContainer = document.getElementById('toolbarContainer');
  
  // 为51吃瓜添加专属类名，避免样式冲突
  contentList.classList.add('chigua-site');
  contentList.classList.remove('uaa-site');
  
  if (!items || items.length === 0) {
    contentList.innerHTML = '<div class="empty-state"><p>没有找到内容</p></div>';
    toolbarContainer.style.display = 'none';
    return;
  }
  
  // 显示工具栏
  toolbarContainer.style.display = 'flex';
  
  // 渲染列表
  contentList.innerHTML = items.map(item => {
    const isSelected = window.syncStateManager.isSelected(item.id);
    const isSynced = window.syncStateManager.isSynced(item.id);
    const syncStatus = window.syncStateManager.getSyncStatus(item.id);
    
    return `
      <div class="content-card ${isSelected ? 'selected' : ''} ${isSynced ? 'synced' : ''}" data-id="${item.id}" ${item.article_id ? `data-article-id="${item.article_id}"` : ''}>
        <div class="card-cover">
          <div class="card-checkbox-overlay">
            <input type="checkbox" class="item-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''} ${isSynced ? 'disabled' : ''}>
          </div>
          
          ${item.cover ? `
            <img src="" data-src="${item.cover}" alt="${item.title}" class="cover-image loading">
            <div class="image-loading">
              <div class="spinner-small"></div>
            </div>
          ` : `
            <div class="no-cover">
              <span>📄</span>
            </div>
          `}
          
          ${isSynced ? `
            <div class="sync-badge-overlay synced">
              <span class="badge-icon">✓</span>
            </div>
          ` : ''}
        </div>
        
        <div class="card-content">
          <h3 class="card-title">${item.title}</h3>
          <div class="card-meta">
            ${item.date ? `<span class="meta-date">📅 ${item.date}</span>` : ''}
          </div>
        </div>
        
        ${syncStatus && syncStatus.status === 'running' ? `
          <div class="card-sync-progress">
            <div class="sync-progress-bar">
              <div class="sync-progress-fill" style="width: ${syncStatus.progress}%"></div>
            </div>
            <div class="sync-status-text">
              <span class="icon">⏳</span>
              <span>${syncStatus.step || '处理中...'} (${syncStatus.progress}%)</span>
            </div>
          </div>
        ` : ''}
        
        ${syncStatus && syncStatus.status === 'completed' ? `
          <div class="card-sync-progress">
            <div class="sync-status-text success">
              <span class="icon">✓</span>
              <span>同步成功</span>
            </div>
          </div>
        ` : ''}
        
        ${syncStatus && syncStatus.status === 'failed' ? `
          <div class="card-sync-progress">
            <div class="sync-status-text error">
              <span class="icon">✗</span>
              <span>同步失败: ${syncStatus.error || '未知错误'}</span>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  // 加载图片
  loadImagesInView();
  
  // 绑定卡片点击事件（查看详情）
  document.querySelectorAll('.content-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // 如果点击的是复选框或同步状态区域，不打开详情
      if (e.target.closest('.item-checkbox') || 
          e.target.closest('.card-checkbox-overlay') ||
          e.target.closest('.card-sync-progress')) {
        return;
      }
      
      const itemId = card.dataset.id;
      const item = window.currentContentItems.find(i => i.id === itemId);
      
      if (item && item.url) {
        console.log('[DetailView] 打开详情页:', item.url);
        // 调用 Electron API 打开详情窗口
        window.electronAPI.openDetailWindow(item.url, item.title);
      }
    });
    
    // 卡片悬停效果
    card.style.cursor = 'pointer';
  });
  
  // 绑定复选框事件
  document.querySelectorAll('.item-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const itemId = e.target.dataset.id;
      const isSelected = window.syncStateManager.toggleSelection(itemId);
      
      // 更新卡片样式
      const card = document.querySelector(`.content-card[data-id="${itemId}"]`);
      if (card) {
        if (isSelected) {
          card.classList.add('selected');
        } else {
          card.classList.remove('selected');
        }
      }
      
      // 更新工具栏
      updateToolbar();
    });
  });
  
  // 更新工具栏
  updateToolbar();
}

/**
 * 更新工具栏状态
 */
function updateToolbar() {
  const selectedCount = window.syncStateManager.getSelectedCount();
  const selectionInfo = document.getElementById('selectionInfo');
  const syncBtn = document.getElementById('syncBtn');
  const selectAllCheckbox = document.getElementById('selectAll');
  
  // 计算未同步的项目数量
  const allItems = window.currentContentItems || [];
  const unsyncedItems = allItems.filter(item => !window.syncStateManager.isSynced(item.id));
  const unsyncedCount = unsyncedItems.length;
  
  // 更新选中数量（显示未同步的总数）
  selectionInfo.textContent = `已选择 ${selectedCount} 项 / 共 ${unsyncedCount} 项可选`;
  
  // 更新同步按钮状态（如果不在同步中）
  if (!syncBtn.classList.contains('syncing')) {
    if (selectedCount > 0) {
      syncBtn.disabled = false;
      syncBtn.classList.add('active');
    } else {
      syncBtn.disabled = true;
      syncBtn.classList.remove('active');
    }
  }
  
  // 更新全选复选框状态（只考虑未同步的项目）
  
  if (selectedCount === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else if (selectedCount === unsyncedCount && unsyncedCount > 0) {
    // 所有未同步的项目都被选中
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else {
    // 部分未同步的项目被选中
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  }
}

/**
 * 更新卡片同步进度
 */
function updateCardSyncProgress(itemId, progressData) {
  const card = document.querySelector(`.content-card[data-id="${itemId}"]`);
  if (!card) return;
  
  // 更新状态管理器
  window.syncStateManager.updateSyncStatus(itemId, progressData);
  
  // 移除旧的进度元素
  const oldProgress = card.querySelector('.card-sync-progress');
  if (oldProgress) {
    oldProgress.remove();
  }
  
  // 移除已同步徽章
  const oldBadge = card.querySelector('.sync-badge');
  if (oldBadge) {
    oldBadge.remove();
  }
  
  const cardContent = card.querySelector('.card-content');
  
  // 根据状态渲染不同的UI
  if (progressData.status === 'running') {
    const progressHtml = `
      <div class="card-sync-progress">
        <div class="sync-progress-bar">
          <div class="sync-progress-fill" style="width: ${progressData.progress}%"></div>
        </div>
        <div class="sync-status-text">
          <span class="icon">⏳</span>
          <span>${progressData.step || '处理中...'} (${progressData.progress}%)</span>
        </div>
      </div>
    `;
    card.insertAdjacentHTML('beforeend', progressHtml);
  } else if (progressData.status === 'completed') {
    const successHtml = `
      <div class="card-sync-progress">
        <div class="sync-status-text success">
          <span class="icon">✓</span>
          <span>同步成功</span>
        </div>
      </div>
    `;
    card.insertAdjacentHTML('beforeend', successHtml);
    
    // 添加已同步徽章到封面
    const cardCover = card.querySelector('.card-cover');
    const existingBadge = cardCover.querySelector('.sync-badge-overlay');
    if (!existingBadge) {
      const badgeHtml = `
        <div class="sync-badge-overlay synced">
          <span class="badge-icon">✓</span>
        </div>
      `;
      cardCover.insertAdjacentHTML('beforeend', badgeHtml);
    }
    
    // 标记卡片为已同步状态
    card.classList.add('synced');
    
    // 禁用复选框
    const checkbox = card.querySelector('.item-checkbox');
    if (checkbox) {
      checkbox.checked = false;
      checkbox.disabled = true;
    }
    
    // 取消选中
    window.syncStateManager.toggleSelection(itemId);
    card.classList.remove('selected');
    
    // 3秒后自动淡出成功消息（用户无感知）
    setTimeout(() => {
      const progressEl = card.querySelector('.card-sync-progress');
      if (progressEl) {
        progressEl.classList.add('fade-out');
        setTimeout(() => {
          progressEl.remove();
        }, 300); // 等待淡出动画完成后移除
      }
    }, 3000);
    
    // 更新工具栏
    updateToolbar();
  } else if (progressData.status === 'failed') {
    const errorHtml = `
      <div class="card-sync-progress">
        <div class="sync-status-text error">
          <span class="icon">✗</span>
          <span>同步失败: ${progressData.error || '未知错误'}</span>
        </div>
      </div>
    `;
    card.insertAdjacentHTML('beforeend', errorHtml);
  }
}

/**
 * 加载可见区域的图片
 */
function loadImagesInView() {
  const images = document.querySelectorAll('.cover-image.loading');
  
  images.forEach(async (img) => {
    const imageUrl = img.dataset.src;
    if (!imageUrl) return;
    
    try {
      const result = await window.electronAPI.decryptImage(imageUrl);
      
      if (result.success && result.data) {
        img.src = result.data;
        img.classList.remove('loading');
        img.classList.add('loaded');
        
        // 隐藏加载动画
        const loadingEl = img.parentElement.querySelector('.image-loading');
        if (loadingEl) {
          loadingEl.style.display = 'none';
        }
      } else {
        img.classList.remove('loading');
        img.classList.add('error');
        
        // 显示错误图标
        const loadingEl = img.parentElement.querySelector('.image-loading');
        if (loadingEl) {
          loadingEl.innerHTML = '<span style="font-size: 24px;">❌</span>';
        }
      }
    } catch (error) {
      console.error('图片加载失败:', error);
      img.classList.remove('loading');
      img.classList.add('error');
    }
  });
}

// 导出函数
window.renderContentListWithCheckbox = renderContentListWithCheckbox;
window.updateToolbar = updateToolbar;
window.updateCardSyncProgress = updateCardSyncProgress;
window.loadImagesInView = loadImagesInView;
