const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 站点管理
  getSitesList: () => ipcRenderer.invoke('get-sites-list'),
  getSiteConfig: (siteId) => ipcRenderer.invoke('get-site-config', siteId),
  saveSiteConfig: (siteId, config) => ipcRenderer.invoke('save-site-config', { siteId, config }),
  
  // 分类和内容
  getCategories: (siteId) => ipcRenderer.invoke('get-categories', siteId),
  getContent: (siteId, categoryUrl, page, options) => ipcRenderer.invoke('get-content', { siteId, categoryUrl, page, options }),
  getAudioDetail: (siteId, audioId, detailUrl) => ipcRenderer.invoke('get-audio-detail', { siteId, audioId, detailUrl }),
  decryptImage: (imageUrl) => ipcRenderer.invoke('decrypt-image', imageUrl),
  
  // 同步相关
  checkSyncStatus: (articleIds, config) => ipcRenderer.invoke('check-sync-status', { articleIds, config }),
  startSync: (items, config) => ipcRenderer.invoke('start-sync', { items, config }),
  getQueueStats: () => ipcRenderer.invoke('get-queue-stats'),
  getTaskDetail: (taskId) => ipcRenderer.invoke('get-task-detail', taskId),
  
  // 同步进度监听
  onSyncProgress: (callback) => {
    ipcRenderer.on('sync-progress', (event, data) => callback(data));
  },
  onSyncCompleted: (callback) => {
    ipcRenderer.on('sync-completed', (event, data) => callback(data));
  },
  onSyncError: (callback) => {
    ipcRenderer.on('sync-error', (event, data) => callback(data));
  },
  
  // UAA 有声小说同步
  uaaCheckSyncStatus: (items) => ipcRenderer.invoke('uaa-check-sync-status', { items }),
  uaaStartSync: (items) => ipcRenderer.invoke('uaa-start-sync', { items }),
  uaaGetQueueStats: () => ipcRenderer.invoke('uaa-get-queue-stats'),
  uaaGetTaskDetail: (taskId) => ipcRenderer.invoke('uaa-get-task-detail', { taskId }),
  uaaStopSync: () => ipcRenderer.invoke('uaa-stop-sync'),
  
  // UAA 同步进度监听
  onUaaSyncProgress: (callback) => {
    ipcRenderer.on('uaa-sync-progress', (event, data) => callback(data));
  },
  onUaaSyncCompleted: (callback) => {
    ipcRenderer.on('uaa-sync-completed', (event, data) => callback(data));
  },
  onUaaSyncError: (callback) => {
    ipcRenderer.on('uaa-sync-error', (event, data) => callback(data));
  },
  onUaaSyncSkipped: (callback) => {
    ipcRenderer.on('uaa-sync-skipped', (event, data) => callback(data));
  },
  
  // 详情页面
  openDetailWindow: (url, title) => ipcRenderer.send('open-detail-window', { url, title }),
  
  // 打开外部链接
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});

console.log('[Preload] 预加载脚本已执行');
