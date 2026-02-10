const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const categoryParser = require('../crawler/categoryParser');
const contentParser = require('../crawler/contentParser');
const imageDecryptor = require('../crawler/imageDecryptor');
const { TaskQueue } = require('../crawler/taskQueue');
const ApiClient = require('../crawler/apiClient');
const CrawlerFactory = require('../crawler/base/CrawlerFactory');

// 爬虫实例缓存
const crawlerInstances = new Map();

let mainWindow;

/**
 * 获取用户配置目录路径
 */
function getUserConfigDir() {
  const userDataPath = app.getPath('userData');
  const configDir = path.join(userDataPath, 'config');
  
  // 确保配置目录存在
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  return configDir;
}

/**
 * 获取站点配置文件路径（优先用户目录，否则使用默认配置）
 */
function getSiteConfigPath(siteId) {
  const userConfigDir = getUserConfigDir();
  const userConfigPath = path.join(userConfigDir, `${siteId}.json`);
  
  // 如果用户配置存在，使用用户配置
  if (fs.existsSync(userConfigPath)) {
    return userConfigPath;
  }
  
  // 否则使用默认配置（app.asar中的）
  const defaultConfigPath = path.join(__dirname, '../config', `${siteId}.json`);
  
  // 首次运行：复制默认配置到用户目录
  if (fs.existsSync(defaultConfigPath)) {
    try {
      const defaultConfig = fs.readFileSync(defaultConfigPath, 'utf8');
      fs.writeFileSync(userConfigPath, defaultConfig, 'utf8');
      console.log(`[Main] 已复制默认配置到用户目录: ${siteId}`);
      return userConfigPath;
    } catch (error) {
      console.warn(`[Main] 复制默认配置失败，使用只读配置: ${siteId}`);
      return defaultConfigPath;
    }
  }
  
  throw new Error(`站点配置文件不存在: ${siteId}.json`);
}

/**
 * 加载站点配置（辅助函数）
 */
function loadSiteConfig(siteId) {
  try {
    const configPath = getSiteConfigPath(siteId);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`站点配置文件不存在: ${siteId}.json`);
    }
    
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    console.log(`[Main] 成功加载站点配置: ${siteId} (${configPath})`);
    return config;
  } catch (error) {
    console.error(`[Main] 加载站点配置失败 [${siteId}]:`, error);
    throw error;
  }
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    },
    title: '51吃瓜分类浏览器',
    backgroundColor: '#1a1a1a'
  });

  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));

  // 开发模式下打开开发者工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用准备就绪
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用（macOS除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC处理：获取站点列表
ipcMain.handle('get-sites-list', async () => {
  try {
    console.log('[Main] 加载站点列表...');
    const sitesPath = path.join(__dirname, '../config/sites.json');
    const sitesData = fs.readFileSync(sitesPath, 'utf8');
    const sites = JSON.parse(sitesData);
    console.log('[Main] 站点列表加载成功:', sites.sites.length, '个站点');
    return {
      success: true,
      data: sites
    };
  } catch (error) {
    console.error('[Main] 加载站点列表失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC处理：获取站点配置
ipcMain.handle('get-site-config', async (event, siteId) => {
  try {
    console.log('[Main] 加载站点配置:', siteId);
    
    // 使用统一的配置路径获取函数
    const configPath = getSiteConfigPath(siteId);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`站点配置文件不存在: ${siteId}.json`);
    }
    
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    console.log('[Main] 站点配置加载成功:', configPath);
    return {
      success: true,
      data: config
    };
  } catch (error) {
    console.error('[Main] 加载站点配置失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 保存站点配置
ipcMain.handle('save-site-config', async (event, { siteId, config }) => {
  try {
    console.log('[Main] 保存站点配置:', siteId);
    
    // 获取用户配置路径（确保可写）
    const userConfigDir = getUserConfigDir();
    const configPath = path.join(userConfigDir, `${siteId}.json`);
    
    // 读取原配置（如果存在）
    let originalConfig = {};
    if (fs.existsSync(configPath)) {
      const originalData = fs.readFileSync(configPath, 'utf8');
      originalConfig = JSON.parse(originalData);
      
      // 备份原配置
      const backupPath = path.join(userConfigDir, `${siteId}.json.backup`);
      fs.writeFileSync(backupPath, originalData, 'utf8');
    } else {
      // 首次保存：从默认配置加载
      const defaultConfigPath = path.join(__dirname, '../config', `${siteId}.json`);
      if (fs.existsSync(defaultConfigPath)) {
        const defaultData = fs.readFileSync(defaultConfigPath, 'utf8');
        originalConfig = JSON.parse(defaultData);
      }
    }
    
    // 合并配置（保留未修改的字段）
    const mergedConfig = { ...originalConfig, ...config };
    
    // 保存新配置到用户目录
    fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2), 'utf8');
    
    // 🔥 关键修复：清除爬虫实例缓存，使新配置生效
    if (crawlerInstances.has(siteId)) {
      console.log(`[Main] 清除 ${siteId} 爬虫实例缓存，下次将使用新配置`);
      crawlerInstances.delete(siteId);
    }
    
    console.log('[Main] 站点配置保存成功:', configPath);
    return {
      success: true,
      data: mergedConfig
    };
  } catch (error) {
    console.error('[Main] 保存站点配置失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * 获取爬虫实例
 */
function getCrawlerInstance(siteId) {
  if (!siteId || siteId === 'default') {
    siteId = '51chigua'; // 默认使用51吃瓜
  }
  
  if (!crawlerInstances.has(siteId)) {
    try {
      const configPath = path.join(__dirname, '../config', `${siteId}.json`);
      const siteConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const crawler = CrawlerFactory.create(siteConfig);
      crawlerInstances.set(siteId, crawler);
      console.log(`[Main] 创建爬虫实例: ${siteId}`);
    } catch (error) {
      console.error(`[Main] 创建爬虫实例失败 [${siteId}]:`, error);
      throw error;
    }
  }
  
  return crawlerInstances.get(siteId);
}

// IPC处理：获取分类列表（支持多站点）
ipcMain.handle('get-categories', async (event, siteId) => {
  try {
    const currentSiteId = siteId || '51chigua';
    console.log('[Main] 开始获取分类列表, 站点:', currentSiteId);
    
    const crawler = getCrawlerInstance(currentSiteId);
    const categories = await crawler.getCategories();
    
    console.log('[Main] 分类获取成功:', categories.length, '个分类');
    return {
      success: true,
      data: categories
    };
  } catch (error) {
    console.error('[Main] 获取分类失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC处理：获取分类内容（支持多站点）
ipcMain.handle('get-content', async (event, { siteId, categoryUrl, page = 1, options = {} }) => {
  try {
    const currentSiteId = siteId || '51chigua';
    console.log('[Main] 获取内容, 站点:', currentSiteId, '分类:', categoryUrl, '页码:', page, '选项:', options);
    
    const crawler = getCrawlerInstance(currentSiteId);
    const content = await crawler.getContent(categoryUrl, page, options);
    
    console.log('[Main] 内容获取成功:', content.items.length, '条');
    return {
      success: true,
      data: content
    };
  } catch (error) {
    console.error('[Main] 获取内容失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC处理：获取音频详情（UAA站点）
ipcMain.handle('get-audio-detail', async (event, { siteId, audioId, detailUrl }) => {
  try {
    console.log('[Main] 获取音频详情, 站点:', siteId, '音频ID:', audioId);
    
    // 目前只支持UAA站点
    if (siteId === 'uaa') {
      const { getAudioDetail } = require('../crawler/uaa/audioDetailParser');
      const detail = await getAudioDetail(audioId, detailUrl);
      
      console.log('[Main] 音频详情获取成功:', detail.title);
      return {
        success: true,
        data: detail
      };
    } else {
      throw new Error(`站点 ${siteId} 不支持获取音频详情`);
    }
  } catch (error) {
    console.error('[Main] 获取音频详情失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 图片缓存
const imageCache = new Map();

// IPC处理：下载并解密图片
ipcMain.handle('decrypt-image', async (event, imageUrl) => {
  try {
    if (!imageUrl) {
      return {
        success: false,
        error: '图片URL为空'
      };
    }

    // 检查缓存
    if (imageCache.has(imageUrl)) {
      console.log('[Main] 从缓存获取图片:', imageUrl);
      return {
        success: true,
        data: imageCache.get(imageUrl)
      };
    }

    console.log('[Main] 开始处理图片:', imageUrl);
    const base64Data = await imageDecryptor.downloadAndDecryptImage(imageUrl);
    
    if (!base64Data) {
      return {
        success: false,
        error: '图片解密失败'
      };
    }

    // 缓存图片
    imageCache.set(imageUrl, base64Data);
    
    // 限制缓存大小（最多缓存100张图片）
    if (imageCache.size > 100) {
      const firstKey = imageCache.keys().next().value;
      imageCache.delete(firstKey);
    }

    console.log('[Main] 图片处理成功');
    return {
      success: true,
      data: base64Data
    };
  } catch (error) {
    console.error('[Main] 处理图片失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 当前任务队列实例
let currentTaskQueue = null;

// IPC处理：检查文章同步状态（批量）
ipcMain.handle('check-sync-status', async (event, { articleIds, config }) => {
  try {
    console.log('[Main] 检查同步状态:', articleIds.length, '条');
    const apiClient = new ApiClient(config);
    const result = await apiClient.checkPostsExistsBatch(articleIds);
    
    if (result) {
      console.log('[Main] 状态检查完成');
      return {
        success: true,
        data: result
      };
    } else {
      return {
        success: false,
        error: '检查失败'
      };
    }
  } catch (error) {
    console.error('[Main] 检查状态失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC处理：开始同步任务
ipcMain.handle('start-sync', async (event, { items, config }) => {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║ [Main] 开始同步任务');
    console.log(`║ 任务数量: ${items.length} 条`);
    console.log(`║ API地址: ${config.apiBaseUrl || '未设置'}`);
    console.log(`║ authUuid: ${config.authUuid || '未设置'}`);
    console.log(`║ crawlerToken: ${config.crawlerToken ? config.crawlerToken.substring(0, 20) + '...' : '未设置'}`);
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    // 创建任务队列
    const maxConcurrent = config.maxConcurrent || 3;
    console.log(`[Main] 创建任务队列，最大并发: ${maxConcurrent}`);
    currentTaskQueue = new TaskQueue(config, maxConcurrent);
    
    // 添加任务
    console.log(`[Main] 添加 ${items.length} 个任务到队列...`);
    const tasks = currentTaskQueue.addTasks(items);
    console.log(`[Main] ✅ 任务添加完成`);
    
    // 设置进度回调
    console.log(`[Main] 设置进度回调...`);
    tasks.forEach(task => {
      task.onProgress = (progressData) => {
        // 发送进度更新到渲染进程
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sync-progress', progressData);
        }
      };
    });
    console.log(`[Main] ✅ 进度回调设置完成`);
    
    // 开始处理队列（不等待完成，立即返回）
    console.log(`[Main] 启动队列处理...`);
    currentTaskQueue.start().then(stats => {
      console.log('\n╔══════════════════════════════════════════════════════════════╗');
      console.log('[Main] ✅ 同步任务完成');
      console.log(`   - 成功: ${stats.completed}`);
      console.log(`   - 失败: ${stats.failed}`);
      console.log('╚══════════════════════════════════════════════════════════════╝\n');
      // 发送完成通知
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync-completed', stats);
      }
    }).catch(error => {
      console.error('\n╔══════════════════════════════════════════════════════════════╗');
      console.error('[Main] ❌ 同步任务异常');
      console.error(`   错误: ${error.message}`);
      console.error(`   堆栈:`, error.stack);
      console.error('╚══════════════════════════════════════════════════════════════╝\n');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync-error', { error: error.message });
      }
    });
    
    console.log(`[Main] ✅ 同步任务已启动，正在后台处理...`);
    return {
      success: true,
      message: '同步任务已启动'
    };
    
  } catch (error) {
    console.error('\n╔══════════════════════════════════════════════════════════════╗');
    console.error('[Main] ❌ 启动同步任务失败');
    console.error(`   错误: ${error.message}`);
    console.error(`   堆栈:`, error.stack);
    console.error('╚══════════════════════════════════════════════════════════════╝\n');
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC处理：获取任务队列状态
ipcMain.handle('get-queue-stats', async () => {
  try {
    if (!currentTaskQueue) {
      return {
        success: true,
        data: {
          total: 0,
          pending: 0,
          running: 0,
          completed: 0,
          failed: 0
        }
      };
    }
    
    const stats = currentTaskQueue.getStats();
    return {
      success: true,
      data: stats
    };
  } catch (error) {
    console.error('[Main] 获取队列状态失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC处理：获取单个任务详情
ipcMain.handle('get-task-detail', async (event, taskId) => {
  try {
    if (!currentTaskQueue) {
      return {
        success: false,
        error: '没有活动的任务队列'
      };
    }
    
    const task = currentTaskQueue.getTask(taskId);
    if (!task) {
      return {
        success: false,
        error: '任务不存在'
      };
    }
    
    return {
      success: true,
      data: {
        id: task.id,
        status: task.status,
        progress: task.progress,
        currentStep: task.currentStep,
        error: task.error,
        result: task.result,
        startTime: task.startTime,
        endTime: task.endTime
      }
    };
  } catch (error) {
    console.error('[Main] 获取任务详情失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC处理：打开详情窗口
ipcMain.on('open-detail-window', (event, { url, title }) => {
  console.log('[Main] 打开详情窗口:', title, url);
  
  try {
    // 创建详情窗口
    const detailWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      title: title || '详情',
      backgroundColor: '#ffffff',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true // 启用 web 安全，允许加载外部网页
      }
    });
    
    // 加载原站点 URL
    detailWindow.loadURL(url);
    
    // 开发模式下打开开发者工具
    if (process.argv.includes('--dev')) {
      detailWindow.webContents.openDevTools();
    }
    
    // 窗口关闭时清理
    detailWindow.on('closed', () => {
      console.log('[Main] 详情窗口已关闭');
    });
    
    console.log('[Main] 详情窗口已创建');
  } catch (error) {
    console.error('[Main] 创建详情窗口失败:', error);
  }
});

// IPC处理：打开外部链接
ipcMain.handle('open-external', async (event, url) => {
  console.log('[Main] 打开外部链接:', url);
  
  try {
    if (!url || typeof url !== 'string') {
      throw new Error('无效的URL');
    }
    
    // 使用默认浏览器打开链接
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('[Main] 打开外部链接失败:', error);
    return { success: false, error: error.message };
  }
});

// ============ UAA 有声小说同步相关 IPC ============

// UAA 任务队列实例
let uaaTaskQueue = null;

// IPC处理：批量检查 UAA 同步状态
ipcMain.handle('uaa-check-sync-status', async (event, { items }) => {
  try {
    console.log('[Main] UAA 批量检查同步状态:', items.length);
    
    const uaaConfig = loadSiteConfig('uaa');
    const UaaApiClient = require('../crawler/uaa/uaaApiClient');
    const apiClient = new UaaApiClient(uaaConfig);
    
    const results = await apiClient.checkAudioNovelsExistsBatch(items, null);
    
    console.log('[Main] UAA 检查完成');
    return { success: true, results };
  } catch (error) {
    console.error('[Main] UAA 检查同步状态失败:', error);
    return { success: false, error: error.message };
  }
});

// IPC处理：开始 UAA 同步
ipcMain.handle('uaa-start-sync', async (event, { items }) => {
  try {
    console.log('[Main] 开始 UAA 同步:', items.length);
    
    const uaaConfig = loadSiteConfig('uaa');
    const UaaTaskQueue = require('../crawler/uaa/uaaTaskQueue');
    
    // 创建新的任务队列
    uaaTaskQueue = new UaaTaskQueue(uaaConfig);
    
    // 设置进度回调
    uaaTaskQueue.onProgress((progressData) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('uaa-sync-progress', progressData);
      }
    });
    
    // 添加任务
    const addResult = await uaaTaskQueue.addTasks(items);
    console.log('[Main] UAA 任务添加完成:', addResult);
    
    // 如果有跳过的数据（已同步），立即通知前端标记这些卡片
    if (addResult.skippedItems && addResult.skippedItems.length > 0) {
      console.log('[Main] 通知前端标记已同步的卡片:', addResult.skippedItems.length);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('uaa-sync-skipped', {
          skippedItems: addResult.skippedItems
        });
      }
    }
    
    // 开始执行（异步）
    uaaTaskQueue.start().then(() => {
      console.log('[Main] UAA 同步队列执行完成');
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('uaa-sync-completed', {
          stats: uaaTaskQueue.getStats()
        });
      }
    }).catch((error) => {
      console.error('[Main] UAA 同步队列执行失败:', error);
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('uaa-sync-error', {
          error: error.message
        });
      }
    });
    
    return {
      success: true,
      stats: uaaTaskQueue.getStats(),
      addResult: addResult
    };
  } catch (error) {
    console.error('[Main] UAA 启动同步失败:', error);
    return { success: false, error: error.message };
  }
});

// IPC处理：获取 UAA 队列统计信息
ipcMain.handle('uaa-get-queue-stats', async (event) => {
  try {
    if (!uaaTaskQueue) {
      return { success: true, stats: null };
    }
    
    const stats = uaaTaskQueue.getStats();
    return { success: true, stats };
  } catch (error) {
    console.error('[Main] 获取 UAA 队列统计失败:', error);
    return { success: false, error: error.message };
  }
});

// IPC处理：获取 UAA 任务详情
ipcMain.handle('uaa-get-task-detail', async (event, { taskId }) => {
  try {
    if (!uaaTaskQueue) {
      return { success: false, error: '队列未初始化' };
    }
    
    const detail = uaaTaskQueue.getTaskDetail(taskId);
    return { success: true, detail };
  } catch (error) {
    console.error('[Main] 获取 UAA 任务详情失败:', error);
    return { success: false, error: error.message };
  }
});

// IPC处理：停止 UAA 同步
ipcMain.handle('uaa-stop-sync', async (event) => {
  try {
    if (!uaaTaskQueue) {
      return { success: false, error: '队列未初始化' };
    }
    
    console.log('[Main] 停止 UAA 同步队列');
    uaaTaskQueue.stop();
    
    return { success: true };
  } catch (error) {
    console.error('[Main] 停止 UAA 同步失败:', error);
    return { success: false, error: error.message };
  }
});

// ============ End of UAA 同步相关 IPC ============

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('[Main] 未捕获的异常:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[Main] 未处理的Promise拒绝:', error);
});
