const https = require('https');
const http = require('http');
const zlib = require('zlib');
const config = require('../config/default.json');

/**
 * 发起HTTP GET请求
 * @param {string} url - 请求URL
 * @param {number} retries - 重试次数
 */
async function httpGet(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[HTTP] 请求: ${url} (尝试 ${i + 1}/${retries})`);
      const data = await makeRequest(url);
      console.log(`[HTTP] 成功: ${url}`);
      return data;
    } catch (error) {
      console.error(`[HTTP] 失败: ${url} (尝试 ${i + 1}/${retries})`, error.message);
      
      if (i === retries - 1) {
        throw new Error(`请求失败: ${url} - ${error.message}`);
      }
      
      // 等待后重试
      await sleep(1000 * (i + 1));
    }
  }
}

/**
 * 站点URL映射表（用于快速匹配站点配置）
 */
const SITE_URL_MAP = {
  'uaa.com': 'uaa',
  '51cg': '51chigua',
  'tianya': 'tianya'
};

/**
 * 获取站点配置的Cookie（通用方法）
 * @param {string} url - 请求URL
 * @returns {string|null} - Cookie字符串或null
 */
function getSiteCookies(url) {
  try {
    // 遍历站点映射表，查找匹配的站点
    for (const [urlPattern, siteId] of Object.entries(SITE_URL_MAP)) {
      if (url.includes(urlPattern)) {
        const configPath = `../config/${siteId}.json`;
        
        // 清除require缓存，确保获取最新配置
        delete require.cache[require.resolve(configPath)];
        const siteConfig = require(configPath);
        
        // 检查是否启用登录且有Cookie
        if (siteConfig.loginRequired) {
          // 优先使用cookieString
          if (siteConfig.cookieString) {
            console.log(`[Cookie] 使用 ${siteId} 站点的Cookie`);
            return siteConfig.cookieString;
          }
          
          // 如果没有cookieString，尝试从cookies对象构建
          if (siteConfig.cookies && Object.keys(siteConfig.cookies).length > 0) {
            const cookieStr = Object.entries(siteConfig.cookies)
              .map(([key, value]) => `${key}=${value}`)
              .join('; ');
            console.log(`[Cookie] 使用 ${siteId} 站点的Cookies对象`);
            return cookieStr;
          }
          
          console.warn(`[Cookie] ${siteId} 站点启用了登录但未配置Cookie`);
        }
        
        // 找到匹配的站点就返回（即使没有Cookie）
        return null;
      }
    }
    
    // 未匹配到任何站点
    return null;
  } catch (error) {
    console.error('[Cookie] 获取站点Cookie失败:', error.message);
    return null;
  }
}

/**
 * 使用原生 https 模块发起请求
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    // 获取站点Cookie
    const siteCookies = getSiteCookies(url);
    
    const headers = {
      'User-Agent': config.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    };
    
    // 添加Referer（除了首次访问）
    if (url.includes('/audio/') || url.includes('/detail/')) {
      const urlObj = new URL(url);
      headers['Referer'] = `${urlObj.protocol}//${urlObj.host}/`;
    }
    
    // 添加Cookie
    if (siteCookies) {
      headers['Cookie'] = siteCookies;
      console.log(`[Cookie] 使用站点Cookie (${siteCookies.substring(0, 50)}...)`);
    }
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: headers,
      timeout: config.timeout
    };
    
    const req = protocol.request(options, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return makeRequest(res.headers.location).then(resolve).catch(reject);
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      let stream = res;
      
      // 处理压缩
      const encoding = res.headers['content-encoding'];
      if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      } else if (encoding === 'br') {
        stream = res.pipe(zlib.createBrotliDecompress());
      }
      
      let data = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => data += chunk);
      stream.on('end', () => resolve(data));
      stream.on('error', reject);
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    
    req.end();
  });
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 清理文本（去除多余空白）
 */
function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * 构建完整URL
 */
function buildUrl(path) {
  if (path.startsWith('http')) {
    return path;
  }
  return `${config.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
}

/**
 * 解析分页信息
 */
function parsePagination($, currentPage = 1) {
  const pagination = {
    current: currentPage,
    total: 1,
    hasNext: false,
    hasPrev: false
  };

  // 查找分页容器 - 多种可能的选择器
  const paginationSelectors = [
    '.pagination',
    '.page-navigator', 
    '.wp-pagenavi',
    '.page-numbers',
    '.pagenavi',
    'nav[role="navigation"]',
    '.pager',
    '.pages'
  ];
  
  let paginationContainer = $();
  for (const selector of paginationSelectors) {
    paginationContainer = $(selector);
    if (paginationContainer.length > 0) {
      console.log(`[Pagination] 使用选择器: ${selector}`);
      break;
    }
  }
  
  if (paginationContainer.length > 0) {
    // 方法1: 查找所有链接中的最大页码
    paginationContainer.find('a, span.page-numbers').each((i, el) => {
      const text = $(el).text().trim();
      const pageNum = parseInt(text);
      if (!isNaN(pageNum) && pageNum > pagination.total) {
        pagination.total = pageNum;
      }
      
      // 检查链接中的页码参数
      const href = $(el).attr('href') || '';
      const pageMatch = href.match(/page[\/=](\d+)|paged=(\d+)|p=(\d+)/i);
      if (pageMatch) {
        const num = parseInt(pageMatch[1] || pageMatch[2] || pageMatch[3]);
        if (num > pagination.total) {
          pagination.total = num;
        }
      }
    });
    
    // 方法2: 查找类似"第X页"、"共X页"的文本
    const pageText = paginationContainer.text();
    const totalPageMatch = pageText.match(/共\s*(\d+)\s*页|总计\s*(\d+)\s*页|total\s*(\d+)/i);
    if (totalPageMatch) {
      const num = parseInt(totalPageMatch[1] || totalPageMatch[2] || totalPageMatch[3]);
      if (num > pagination.total) {
        pagination.total = num;
      }
    }

    // 检查是否有下一页链接
    const hasNextSelectors = [
      '.next',
      '.next-page', 
      'a:contains("下一页")',
      'a:contains("Next")',
      'a[rel="next"]',
      '.page-numbers.next'
    ];
    
    for (const selector of hasNextSelectors) {
      if (paginationContainer.find(selector).length > 0) {
        pagination.hasNext = true;
        break;
      }
    }
    
    // 检查是否有上一页
    pagination.hasPrev = currentPage > 1;
    
    // 如果找到下一页，但总页数还是1，说明至少有2页
    if (pagination.hasNext && pagination.total === 1) {
      pagination.total = currentPage + 1;
    }
  }
  
  console.log(`[Pagination] 解析结果: 当前第${currentPage}页，共${pagination.total}页，hasNext:${pagination.hasNext}`);

  return pagination;
}

module.exports = {
  httpGet,
  sleep,
  cleanText,
  buildUrl,
  parsePagination
};
