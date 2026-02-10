/**
 * UAA站点浏览器辅助工具（使用puppeteer绕过Cloudflare）
 */

const puppeteer = require('puppeteer');
const config = require('../../config/uaa.json');
const path = require('path');
const fs = require('fs');

let browser = null;

/**
 * 获取 Chrome 可执行文件路径
 * 优先使用系统Chrome，更可靠且体积小
 */
function getChromePath() {
  console.log('[BrowserHelper] ========== Chrome路径检测开始 ==========');
  console.log('[BrowserHelper] 系统信息:', {
    platform: process.platform,
    arch: process.arch,
    home: process.env.HOME,
    isPackaged: process.resourcesPath && process.resourcesPath.includes('app.asar')
  });
  
  // 🔥 查找系统已安装的 Chrome（根据平台）
  let systemChromePaths = [];
  
  if (process.platform === 'darwin') {
    // macOS 路径
    systemChromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      path.join(process.env.HOME, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
      path.join(process.env.HOME, '/Library/Application Support/Google/Chrome/Google Chrome.app/Contents/MacOS/Google Chrome'),
    ];
  } else if (process.platform === 'win32') {
    // Windows 路径
    systemChromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env.PROGRAMFILES, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
    ];
  } else {
    // Linux 路径
    systemChromePaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    ];
  }
  
  console.log('[BrowserHelper] 将检测以下路径:');
  systemChromePaths.forEach((p, i) => console.log(`  [${i + 1}] ${p}`));
  
  for (let i = 0; i < systemChromePaths.length; i++) {
    const chromePath = systemChromePaths[i];
    console.log(`[BrowserHelper] [${i + 1}/${systemChromePaths.length}] 检查: ${chromePath}`);
    
    try {
      if (fs.existsSync(chromePath)) {
        const stats = fs.statSync(chromePath);
        if (stats.isFile()) {
          console.log(`[BrowserHelper] ✅ 找到可用Chrome: ${chromePath}`);
          console.log('[BrowserHelper] ========== Chrome路径检测成功 ==========');
          return chromePath;
        } else {
          console.log(`[BrowserHelper]    ⚠️  路径存在但不是文件（可能是目录）`);
        }
      } else {
        console.log(`[BrowserHelper]    ❌ 路径不存在`);
      }
    } catch (err) {
      console.log(`[BrowserHelper]    ❌ 检查失败: ${err.message}`);
    }
  }
  
  console.warn('[BrowserHelper] ========== 未找到系统Chrome ==========');
  return null;
}

// 以下代码保留作为备用（如果需要使用打包的Chrome）
/* 
function getChromePath_OLD() {
  const isPackaged = process.resourcesPath && process.resourcesPath.includes('app.asar');
  
  if (isPackaged) {
    // 打包后的 chromium 目录
    const chromiumDir = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'chromium'
    );
    
    console.log('[BrowserHelper] Chromium 目录:', chromiumDir);
    
    // 直接尝试已知的 Chrome 路径（避免在 asar.unpacked 中使用 readdirSync）
    const knownVersion = 'mac_arm-145.0.7632.46';
    const possiblePaths = [
      // ARM64
      path.join(chromiumDir, 'chrome', knownVersion, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
      // x64
      path.join(chromiumDir, 'chrome', knownVersion, 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
    ];
    
    console.log('[BrowserHelper] 尝试的Chrome路径:', possiblePaths);
    
    for (const chromePath of possiblePaths) {
      console.log('[BrowserHelper] 检查路径:', chromePath);
      if (fs.existsSync(chromePath)) {
        // 验证是否为可执行文件
        try {
          const stats = fs.statSync(chromePath);
          if (stats.isFile()) {
            console.log('[BrowserHelper] ✓ 找到Chrome (打包):', chromePath);
            return chromePath;
          } else {
            console.warn('[BrowserHelper] 路径存在但不是文件:', chromePath);
          }
        } catch (e) {
          console.warn('[BrowserHelper] 检查文件失败:', e.message);
        }
      } else {
        console.log('[BrowserHelper] 路径不存在:', chromePath);
      }
    }
    
    console.warn('[BrowserHelper] ✗ 打包的Chrome不存在，尝试动态查找...');
    
    // 尝试动态查找（作为备选）
    try {
      if (fs.existsSync(path.join(chromiumDir, 'chrome'))) {
        const chromeDirs = fs.readdirSync(path.join(chromiumDir, 'chrome'));
        console.log('[BrowserHelper] 找到的Chrome版本:', chromeDirs);
        
        for (const chromeVersion of chromeDirs) {
          const paths = [
            path.join(chromiumDir, 'chrome', chromeVersion, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
            path.join(chromiumDir, 'chrome', chromeVersion, 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
          ];
          
          for (const p of paths) {
            if (fs.existsSync(p) && fs.statSync(p).isFile()) {
              console.log('[BrowserHelper] ✓ 动态找到Chrome:', p);
              return p;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[BrowserHelper] 动态查找失败:', e.message);
    }
  }
  
  // 开发环境：尝试使用项目本地的Chrome
  const devChromiumDir = path.join(__dirname, '../../chromium');
  console.log('[BrowserHelper] 开发环境Chromium目录:', devChromiumDir);
  
  if (fs.existsSync(devChromiumDir)) {
    // 直接尝试已知版本
    const knownVersion = 'mac_arm-145.0.7632.46';
    const possiblePaths = [
      path.join(devChromiumDir, 'chrome', knownVersion, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
      path.join(devChromiumDir, 'chrome', knownVersion, 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
    ];
    
    for (const chromePath of possiblePaths) {
      if (fs.existsSync(chromePath) && fs.statSync(chromePath).isFile()) {
        console.log('[BrowserHelper] ✓ 找到开发环境Chrome:', chromePath);
        return chromePath;
      }
    }
    
    // 动态查找作为备选
    try {
      if (fs.existsSync(path.join(devChromiumDir, 'chrome'))) {
        const chromeDirs = fs.readdirSync(path.join(devChromiumDir, 'chrome'));
        console.log('[BrowserHelper] 开发环境Chrome版本:', chromeDirs);
        
        for (const chromeVersion of chromeDirs) {
          const paths = [
            path.join(devChromiumDir, 'chrome', chromeVersion, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
            path.join(devChromiumDir, 'chrome', chromeVersion, 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
          ];
          
          for (const p of paths) {
            if (fs.existsSync(p) && fs.statSync(p).isFile()) {
              console.log('[BrowserHelper] ✓ 动态找到开发环境Chrome:', p);
              return p;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[BrowserHelper] 开发环境Chrome动态查找失败:', e.message);
    }
  } else {
    console.log('[BrowserHelper] 开发环境Chromium目录不存在');
  }
  
  // 使用系统Chrome或让Puppeteer自动查找
  console.log('[BrowserHelper] 使用系统Chrome或Puppeteer默认路径');
  return null;
}
*/

/**
 * 下载并获取 Chrome
 */
async function ensureChrome() {
  console.log('[BrowserHelper] ========== 准备下载Chrome ==========');
  
  const { app } = require('electron');
  const userDataPath = app.getPath('userData');
  const chromeCachePath = path.join(userDataPath, '.chrome-cache');
  
  console.log('[BrowserHelper] 应用数据目录:', userDataPath);
  console.log('[BrowserHelper] Chrome缓存目录:', chromeCachePath);
  
  // 确保缓存目录存在
  try {
    if (!fs.existsSync(chromeCachePath)) {
      console.log('[BrowserHelper] 创建Chrome缓存目录...');
      fs.mkdirSync(chromeCachePath, { recursive: true });
      console.log('[BrowserHelper] ✓ 目录创建成功');
    } else {
      console.log('[BrowserHelper] Chrome缓存目录已存在');
    }
  } catch (err) {
    console.error('[BrowserHelper] ✗ 创建缓存目录失败:', err.message);
    return null;
  }
  
  try {
    console.log('[BrowserHelper] 初始化Puppeteer BrowserFetcher...');
    
    // 使用 Puppeteer 的 BrowserFetcher 下载 Chrome
    const browserFetcher = puppeteer.createBrowserFetcher({
      path: chromeCachePath,
    });
    
    const revision = puppeteer.PUPPETEER_REVISIONS.chromium;
    console.log('[BrowserHelper] Chrome版本:', revision);
    
    // 先检查是否已经下载过
    const localRevisions = await browserFetcher.localRevisions();
    console.log('[BrowserHelper] 已下载的Chrome版本:', localRevisions);
    
    if (localRevisions.includes(revision)) {
      const revisionInfo = browserFetcher.revisionInfo(revision);
      if (fs.existsSync(revisionInfo.executablePath)) {
        console.log('[BrowserHelper] ✅ Chrome已存在，无需下载');
        console.log('[BrowserHelper] Chrome路径:', revisionInfo.executablePath);
        console.log('[BrowserHelper] ========== Chrome准备完成 ==========');
        return revisionInfo.executablePath;
      } else {
        console.log('[BrowserHelper] ⚠️  本地记录存在但文件丢失，重新下载...');
      }
    }
    
    console.log('[BrowserHelper] 📥 开始下载Chrome（首次运行需要时间，请耐心等待）...');
    
    // 下载Chrome并显示进度
    let lastProgress = 0;
    const revisionInfo = await browserFetcher.download(revision, (downloadBytes, totalBytes) => {
      const percent = Math.floor((downloadBytes / totalBytes) * 100);
      if (percent - lastProgress >= 10 || percent === 100) {
        console.log(`[BrowserHelper] 下载进度: ${percent}% (${Math.floor(downloadBytes / 1024 / 1024)}MB / ${Math.floor(totalBytes / 1024 / 1024)}MB)`);
        lastProgress = percent;
      }
    });
    
    console.log('[BrowserHelper] ✅ Chrome下载完成:', revisionInfo.executablePath);
    console.log('[BrowserHelper] ========== Chrome准备完成 ==========');
    return revisionInfo.executablePath;
  } catch (error) {
    console.error('[BrowserHelper] ========== Chrome下载失败 ==========');
    console.error('[BrowserHelper] 错误详情:', error.message);
    console.error('[BrowserHelper] 错误堆栈:', error.stack);
    console.error('[BrowserHelper] 提示: 请检查网络连接，或手动安装Google Chrome浏览器');
    return null;
  }
}

/**
 * 初始化浏览器
 */
async function initBrowser() {
  if (browser) {
    console.log('[BrowserHelper] 浏览器已存在，直接返回');
    return browser;
  }
  
  console.log('[BrowserHelper] ========================================');
  console.log('[BrowserHelper] 开始初始化浏览器...');
  console.log('[BrowserHelper] ========================================');
  
  const launchOptions = {
    headless: 'new', // 使用新的headless模式
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  };
  
  const errors = []; // 收集所有错误信息
  
  // 🔍 方案1: 尝试使用系统安装的Chrome
  console.log('\n[BrowserHelper] 🔍 方案1: 检测系统Chrome...');
  const systemChromePath = getChromePath();
  
  if (systemChromePath) {
    console.log('[BrowserHelper] 使用系统Chrome:', systemChromePath);
    launchOptions.executablePath = systemChromePath;
    
    try {
      console.log('[BrowserHelper] 正在启动浏览器...');
      browser = await puppeteer.launch(launchOptions);
      console.log('[BrowserHelper] ✅ 浏览器启动成功（系统Chrome）');
      console.log('[BrowserHelper] ========================================\n');
      return browser;
    } catch (error) {
      const errorMsg = `系统Chrome启动失败: ${error.message}`;
      console.error('[BrowserHelper] ❌', errorMsg);
      errors.push(errorMsg);
      delete launchOptions.executablePath;
    }
  } else {
    const errorMsg = '未找到系统安装的Chrome';
    console.log('[BrowserHelper] ⚠️ ', errorMsg);
    errors.push(errorMsg);
  }
  
  // 🔍 方案2: 尝试使用Puppeteer自带的Chrome
  console.log('\n[BrowserHelper] 🔍 方案2: 尝试Puppeteer自带Chrome...');
  try {
    console.log('[BrowserHelper] 正在启动浏览器...');
    browser = await puppeteer.launch(launchOptions);
    console.log('[BrowserHelper] ✅ 浏览器启动成功（Puppeteer自带Chrome）');
    console.log('[BrowserHelper] ========================================\n');
    return browser;
  } catch (error) {
    const errorMsg = `Puppeteer自带Chrome启动失败: ${error.message}`;
    console.log('[BrowserHelper] ❌', errorMsg);
    errors.push(errorMsg);
  }
  
  // 🔍 方案3: 自动下载Chrome到应用数据目录
  console.log('\n[BrowserHelper] 🔍 方案3: 自动下载Chrome...');
  console.log('[BrowserHelper] 提示: 首次运行需要下载Chrome（约150MB），请耐心等待...');
  
  const downloadedChromePath = await ensureChrome();
  
  if (downloadedChromePath) {
    launchOptions.executablePath = downloadedChromePath;
    
    try {
      console.log('[BrowserHelper] 正在启动浏览器...');
      browser = await puppeteer.launch(launchOptions);
      console.log('[BrowserHelper] ✅ 浏览器启动成功（已下载Chrome）');
      console.log('[BrowserHelper] ========================================\n');
      return browser;
    } catch (error) {
      const errorMsg = `已下载Chrome启动失败: ${error.message}`;
      console.error('[BrowserHelper] ❌', errorMsg);
      errors.push(errorMsg);
    }
  } else {
    const errorMsg = 'Chrome下载失败';
    console.error('[BrowserHelper] ❌', errorMsg);
    errors.push(errorMsg);
  }
  
  // ❌ 所有方案都失败，输出详细错误信息
  console.error('\n[BrowserHelper] ========================================');
  console.error('[BrowserHelper] ❌ 所有Chrome启动方案都失败！');
  console.error('[BrowserHelper] ========================================');
  console.error('[BrowserHelper] 尝试的方案及错误:');
  errors.forEach((err, index) => {
    console.error(`  ${index + 1}. ${err}`);
  });
  console.error('\n[BrowserHelper] 💡 解决方案:');
  console.error('  1. 请安装Google Chrome浏览器: https://www.google.com/chrome/');
  console.error('  2. 确保网络连接正常（用于自动下载Chrome）');
  console.error('  3. 关闭杀毒软件/防火墙后重试');
  console.error('  4. 以管理员权限运行应用');
  console.error('[BrowserHelper] ========================================\n');
  
  throw new Error(`无法启动浏览器。已尝试${errors.length}种方案均失败。请安装Google Chrome或检查网络连接。`);
}

/**
 * 创建新的页面实例（每次调用创建新page，避免并发冲突）
 */
async function createNewPage() {
  if (!browser) {
    await initBrowser();
  }
  
  // ✅ 每次创建新的page实例，避免并发冲突
  const page = await browser.newPage();
  
  // 设置视口
  await page.setViewport({
    width: 1920,
    height: 1080
  });
  
  // 设置User-Agent
  await page.setUserAgent(config.userAgent);
  
  // 注入Cookie
  if (config.loginRequired && config.cookieString) {
    const cookies = parseCookieString(config.cookieString);
    await page.setCookie(...cookies);
    console.log('[BrowserHelper] Cookie已注入');
  }
  
  // 设置超时
  page.setDefaultTimeout(config.requestTimeout || 60000);
  page.setDefaultNavigationTimeout(config.requestTimeout || 60000);
  
  return page;
}

/**
 * 解析Cookie字符串为puppeteer格式
 */
function parseCookieString(cookieString) {
  const cookies = [];
  const parts = cookieString.split(';');
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    const [name, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=');
    
    cookies.push({
      name: name.trim(),
      value: value.trim(),
      domain: '.uaa.com',
      path: '/'
    });
  }
  
  return cookies;
}

/**
 * 使用浏览器获取页面HTML
 */
async function fetchWithBrowser(url, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 2000;
  let currentPage = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[BrowserHelper] 访问: ${url} (尝试 ${attempt}/${maxRetries})`);
      
      // ✅ 每次请求创建新的page实例
      currentPage = await createNewPage();
      
      // 访问页面
      const response = await currentPage.goto(url, {
        waitUntil: 'networkidle2',
        timeout: config.requestTimeout || 60000
      });
      
      // 检查响应状态
      const status = response.status();
      console.log(`[BrowserHelper] 响应状态: ${status}`);
      
      if (status === 403 || status === 503) {
        console.warn(`[BrowserHelper] Cloudflare检测，等待${retryDelay}ms后重试...`);
        
        // 等待可能的Cloudflare挑战完成
        await sleep(5000);
        
        // 检查是否还在Cloudflare页面
        const title = await currentPage.title();
        if (title.includes('Just a moment') || title.includes('Cloudflare')) {
          console.log('[BrowserHelper] 检测到Cloudflare挑战，等待通过...');
          await sleep(10000);
        }
      }
      
      if (status >= 400) {
        throw new Error(`HTTP ${status}`);
      }
      
      // 等待页面加载完成
      await sleep(2000);
      
      // 获取HTML
      const html = await currentPage.content();
      
      console.log(`[BrowserHelper] 成功获取页面 (${html.length} 字符)`);
      
      // ✅ 使用完立即关闭page
      await currentPage.close();
      currentPage = null;
      
      return html;
      
    } catch (error) {
      console.error(`[BrowserHelper] 获取失败 (尝试 ${attempt}/${maxRetries}):`, error.message);
      
      // ✅ 出错时也要关闭page
      if (currentPage) {
        try {
          await currentPage.close();
        } catch (e) {
          // 忽略关闭错误
        }
        currentPage = null;
      }
      
      if (attempt === maxRetries) {
        throw new Error(`浏览器请求失败: ${url} - ${error.message}`);
      }
      
      // 等待后重试
      await sleep(retryDelay * attempt);
    }
  }
}

/**
 * 关闭浏览器
 */
async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    console.log('[BrowserHelper] 浏览器已关闭');
  }
}

/**
 * 睡眠函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  initBrowser,
  fetchWithBrowser,
  closeBrowser
};
