/**
 * 同步控制器
 * 负责处理同步相关的用户交互和业务逻辑
 */

class SyncController {
  constructor() {
    this.isSyncing = false;
    this.initEvents();
    this.initProgressListener();
  }

  /**
   * 初始化事件监听
   */
  initEvents() {
    // 全选/取消全选
    document.getElementById('selectAll').addEventListener('change', (e) => {
      const allItems = window.currentContentItems || [];
      const isSelectAll = window.syncStateManager.toggleSelectAll(allItems);
      
      // 更新所有复选框（跳过已同步的项目）
      document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        // 跳过已禁用的复选框（已同步的项目）
        if (checkbox.disabled) {
          return;
        }
        
        checkbox.checked = isSelectAll;
        const card = checkbox.closest('.content-card');
        if (card) {
          if (isSelectAll) {
            card.classList.add('selected');
          } else {
            card.classList.remove('selected');
          }
        }
      });
      
      // 更新工具栏
      window.updateToolbar();
    });

    // 检查同步状态
    document.getElementById('checkStatusBtn').addEventListener('click', async () => {
      await this.checkSyncStatus();
    });

    // 同步选中项
    document.getElementById('syncBtn').addEventListener('click', async () => {
      await this.handleSyncClick();
    });
  }

  /**
   * 初始化进度监听
   */
  initProgressListener() {
    // 监听同步进度
    window.electronAPI.onSyncProgress((progressData) => {
      console.log('同步进度:', progressData);
      
      // 更新卡片进度
      window.updateCardSyncProgress(progressData.taskId, {
        status: progressData.status,
        progress: progressData.progress,
        step: progressData.step,
        error: progressData.details?.error
      });
    });

    // 监听同步完成
    window.electronAPI.onSyncCompleted((stats) => {
      console.log('同步完成:', stats);
      this.isSyncing = false;
      
      // 恢复同步按钮
      this.setSyncButtonState(false);
      
      // 更新统计信息
      this.updateStats();
      
      // 显示完成提示
      this.showToast(`✅ 同步完成！成功: ${stats.completed}, 失败: ${stats.failed}`, 'success');
    });

    // 监听同步错误
    window.electronAPI.onSyncError((errorData) => {
      console.error('同步错误:', errorData);
      this.isSyncing = false;
      
      // 恢复同步按钮
      this.setSyncButtonState(false);
      
      this.showToast(`❌ 同步失败: ${errorData.error}`, 'error');
    });
  }

  /**
   * 设置同步按钮状态
   * @param {boolean} isSyncing - 是否正在同步
   */
  setSyncButtonState(isSyncing) {
    const syncBtn = document.getElementById('syncBtn');
    if (!syncBtn) return;
    
    if (isSyncing) {
      // 禁用按钮
      syncBtn.disabled = true;
      syncBtn.classList.add('syncing');
      syncBtn.innerHTML = '<span class="icon">⏳</span><span class="text">同步中...</span>';
    } else {
      // 恢复按钮（根据选中数量决定是否可用）
      const selectedCount = window.syncStateManager.getSelectedCount();
      syncBtn.disabled = selectedCount === 0;
      syncBtn.classList.remove('syncing');
      syncBtn.innerHTML = '<span class="icon">🔄</span><span class="text">同步选中项</span>';
      
      if (selectedCount > 0) {
        syncBtn.classList.add('active');
      } else {
        syncBtn.classList.remove('active');
      }
    }
  }

  /**
   * 检查同步状态
   */
  async checkSyncStatus() {
    const allItems = window.currentContentItems || [];
    if (allItems.length === 0) {
      this.showToast('没有可检查的内容', 'warning');
      return;
    }
    
    try {
      this.showToast('正在检查同步状态...', 'info');
      
      // 提取article_id（优先使用item.article_id，如果不存在则从item.id中提取）
      const articleIds = allItems
        .map(item => {
          // 优先使用item.article_id
          if (item.article_id) {
            return String(item.article_id);
          }
          // 如果不存在，尝试从item.id中提取（格式：item-12345）
          const idMatch = item.id.match(/item-(\d+)/);
          return idMatch ? idMatch[1] : null;
        })
        .filter(id => id !== null && !isNaN(parseInt(id)) && parseInt(id) > 0); // 过滤无效ID
      
      if (articleIds.length === 0) {
        this.showToast('没有有效的article_id可检查', 'warning');
        return;
      }
      
      // 获取配置
      const config = window.configManager.getAll();
      
      // 调用API检查
      const result = await window.electronAPI.checkSyncStatus(articleIds, config);
      
      if (result.success && result.data) {
        // 标记已同步的项目
        let syncedCount = 0;
        Object.entries(result.data).forEach(([articleId, status]) => {
          if (status.exists) {
            // 找到对应的item并标记为已同步
            const matchedItem = allItems.find(item => {
              if (item.article_id && String(item.article_id) === String(articleId)) {
                return true;
              }
              const idMatch = item.id.match(/item-(\d+)/);
              return idMatch && idMatch[1] === String(articleId);
            });
            
            if (matchedItem) {
              window.syncStateManager.markAsSynced(matchedItem.id);
              syncedCount++;
            }
          }
        });
        
        // 重新渲染列表
        window.renderContentListWithCheckbox(allItems);
        
        this.showToast(`✅ 检查完成！已同步: ${syncedCount} 条`, 'success');
        
        // 更新统计
        this.updateStats();
      } else {
        this.showToast(`❌ 检查失败: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('检查状态失败:', error);
      this.showToast(`❌ 检查失败: ${error.message}`, 'error');
    }
  }

  /**
   * 处理同步点击
   */
  async handleSyncClick() {
    if (this.isSyncing) {
      this.showToast('正在同步中，请稍候...', 'warning');
      return;
    }
    
    const allItems = window.currentContentItems || [];
    const selectedItems = window.syncStateManager.getSelectedItems(allItems);
    
    if (selectedItems.length === 0) {
      this.showToast('请先选择要同步的内容', 'warning');
      return;
    }
    
    // 确认同步
    if (!confirm(`确定要同步选中的 ${selectedItems.length} 条内容吗？\n\n这可能需要较长时间，请耐心等待。`)) {
      return;
    }
    
    try {
      this.isSyncing = true;
      
      // 禁用同步按钮
      this.setSyncButtonState(true);
      
      this.showToast(`开始同步 ${selectedItems.length} 条内容...`, 'info');
      
      // 获取配置：51吃瓜需确保使用最新站点配置（含水印）
      let config = window.configManager.getAll();
      const siteId = window.currentState?.currentSiteId;
      if (siteId === '51chigua') {
        try {
          const siteConfigResult = await window.electronAPI.getSiteConfig(siteId);
          if (siteConfigResult.success && siteConfigResult.data) {
            config = { ...config, ...siteConfigResult.data };
          }
        } catch (e) {
          console.warn('[Sync] 获取51吃瓜站点配置失败，使用缓存配置:', e);
        }
      }
      
      // 调用同步API
      const result = await window.electronAPI.startSync(selectedItems, config);
      
      if (result.success) {
        this.showToast('✅ 同步任务已启动，正在后台处理...', 'success');
      } else {
        this.isSyncing = false;
        // 恢复同步按钮
        this.setSyncButtonState(false);
        this.showToast(`❌ 启动同步失败: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('同步失败:', error);
      this.isSyncing = false;
      // 恢复同步按钮
      this.setSyncButtonState(false);
      this.showToast(`❌ 同步失败: ${error.message}`, 'error');
    }
  }

  /**
   * 更新统计信息
   */
  updateStats() {
    const stats = window.syncStateManager.getStats();
    
    // 更新同步统计
    document.getElementById('syncedCount').textContent = stats.synced;
    
    // 更新今日统计（从localStorage读取）
    const today = new Date().toISOString().split('T')[0];
    const todayStats = JSON.parse(localStorage.getItem('sync_stats_' + today) || '{}');
    document.getElementById('todayCount').textContent = todayStats.count || 0;
  }

  /**
   * 显示提示消息
   */
  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}

// 创建全局实例
window.syncController = new SyncController();
