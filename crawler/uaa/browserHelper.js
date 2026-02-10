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
  console.log('[BrowserHelper] Chrome路径检测:', {
    platform: process.platform,
    arch: process.arch,
    isPackaged: process.resourcesPath && process.resourcesPath.includes('app.asar')
  });
  
  // 🔥 查找系统已安装的 Chrome
  const systemChromePaths = [
    // macOS 系统路径
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    // 用户自定义安装路径
    path.join(process.env.HOME, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  ];
  
  console.log('[BrowserHelper] 尝试查找系统Chrome...');
  
  for (const chromePath of systemChromePaths) {
    if (fs.existsSync(chromePath)) {
      console.log('[BrowserHelper] ✓ 找到系统Chrome:', chromePath);
      return chromePath;
    }
  }
  
  console.warn('[BrowserHelper] ✗ 未找到系统Chrome，Puppeteer将使用默认配置');
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
 * 初始化浏览器
 */
async function initBrowser() {
  if (browser) {
    return browser;
  }
  
  console.log('[BrowserHelper] 启动浏览器...');
  
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
  
  // 尝试获取自定义Chrome路径
  const chromePath = getChromePath();
  
  if (chromePath) {
    console.log('[BrowserHelper] 使用自定义Chrome路径:', chromePath);
    launchOptions.executablePath = chromePath;
    
    try {
      // 尝试使用自定义Chrome启动
      browser = await puppeteer.launch(launchOptions);
      console.log('[BrowserHelper] ✓ 浏览器启动成功（自定义Chrome）');
      return browser;
    } catch (error) {
      console.error('[BrowserHelper] ✗ 使用自定义Chrome启动失败:', error.message);
      console.log('[BrowserHelper] 尝试使用系统Chrome...');
      // 移除自定义路径，使用系统Chrome重试
      delete launchOptions.executablePath;
    }
  } else {
    console.log('[BrowserHelper] 未找到自定义Chrome，使用系统Chrome');
  }
  
  // 使用系统Chrome或Puppeteer默认Chrome
  try {
    browser = await puppeteer.launch(launchOptions);
    console.log('[BrowserHelper] ✓ 浏览器启动成功（系统Chrome）');
    return browser;
  } catch (error) {
    console.error('[BrowserHelper] ✗ 浏览器启动失败:', error.message);
    throw new Error(`无法启动浏览器: ${error.message}`);
  }
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
