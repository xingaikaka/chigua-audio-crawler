/**
 * 同步状态管理器
 * 管理选中项、同步状态、进度等
 */

class SyncStateManager {
  constructor() {
    this.selectedItems = new Set();
    this.syncStatus = new Map(); // item.id -> {status, progress, step, error}
    this.syncedItems = new Set(); // 已同步的item.id
  }

  /**
   * 选中/取消选中项目
   */
  toggleSelection(itemId) {
    if (this.selectedItems.has(itemId)) {
      this.selectedItems.delete(itemId);
    } else {
      this.selectedItems.add(itemId);
    }
    return this.selectedItems.has(itemId);
  }

  /**
   * 全选/取消全选（忽略已同步的项目）
   */
  toggleSelectAll(items) {
    // 过滤出未同步的项目
    const unsyncedItems = items.filter(item => !this.syncedItems.has(item.id));
    const unsyncedCount = unsyncedItems.length;
    
    // 计算当前有多少未同步项目被选中
    const selectedUnsyncedCount = unsyncedItems.filter(item => this.selectedItems.has(item.id)).length;
    
    if (selectedUnsyncedCount === unsyncedCount && unsyncedCount > 0) {
      // 当前所有未同步项目都被选中，取消全选
      this.selectedItems.clear();
      return false;
    } else {
      // 全选所有未同步的项目
      this.selectedItems.clear();
      unsyncedItems.forEach(item => this.selectedItems.add(item.id));
      return true;
    }
  }

  /**
   * 获取选中的项目
   */
  getSelectedItems(allItems) {
    return allItems.filter(item => this.selectedItems.has(item.id));
  }

  /**
   * 获取选中数量
   */
  getSelectedCount() {
    return this.selectedItems.size;
  }

  /**
   * 是否选中
   */
  isSelected(itemId) {
    return this.selectedItems.has(itemId);
  }

  /**
   * 清空选中
   */
  clearSelection() {
    this.selectedItems.clear();
  }

  /**
   * 更新同步状态
   */
  updateSyncStatus(itemId, status) {
    this.syncStatus.set(itemId, status);
    
    if (status.status === 'completed') {
      this.syncedItems.add(itemId);
    }
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(itemId) {
    return this.syncStatus.get(itemId);
  }

  /**
   * 是否已同步
   */
  isSynced(itemId) {
    return this.syncedItems.has(itemId);
  }

  /**
   * 标记为已同步
   */
  markAsSynced(itemId) {
    this.syncedItems.add(itemId);
  }

  /**
   * 批量标记为已同步
   */
  markMultipleAsSynced(itemIds) {
    itemIds.forEach(id => this.syncedItems.add(id));
  }

  /**
   * 清空同步状态
   */
  clearSyncStatus() {
    this.syncStatus.clear();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      selected: this.selectedItems.size,
      synced: this.syncedItems.size,
      syncing: Array.from(this.syncStatus.values()).filter(s => s.status === 'running').length
    };
  }
}

// 创建全局实例
window.syncStateManager = new SyncStateManager();
