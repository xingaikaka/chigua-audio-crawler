/**
 * UAA有声小说列表解析器
 */

const cheerio = require('cheerio');
const { httpGet, cleanText, buildUrl } = require('../utils');
const config = require('../../config/uaa.json');
const { getAudioDetail } = require('./audioDetailParser');
const { fetchWithBrowser } = require('./browserHelper');

/**
 * 获取分类列表
 */
async function getCategories() {
  try {
    console.log('[UAA-AudioListParser] 开始获取分类列表...');
    
    // UAA的分类结构（从配置文件读取）
    const categories = config.categories.map(cat => {
      const category = {
        id: cat.id,
        name: cat.name,
        url: cat.url || null,
        highlight: cat.highlight || false,
        children: []
      };
      
      // 如果有子分类，递归处理
      if (cat.children && cat.children.length > 0) {
        category.children = cat.children.map(subCat => ({
          id: subCat.id,
          name: subCat.name,
          url: subCat.url,
          highlight: subCat.highlight || false
        }));
      }
      
      return category;
    });
    
    console.log(`[UAA-AudioListParser] 分类获取成功: ${categories.length} 个一级分类`);
    return categories;
    
  } catch (error) {
    console.error('[UAA-AudioListParser] 获取分类失败:', error);
    throw error;
  }
}

/**
 * 获取音频列表（整合详情数据）
 */
async function getAudioList(categoryUrl, page = 1, options = {}) {
  try {
    // 确保categoryUrl有效
    if (!categoryUrl || categoryUrl === 'undefined') {
      categoryUrl = '/audio/list'; // 默认列表页
    }
    
    // 构建完整URL
    let fullUrl = categoryUrl.startsWith('http') 
      ? categoryUrl 
      : `${config.baseUrl}${categoryUrl.startsWith('/') ? categoryUrl : '/' + categoryUrl}`;
    
    // 添加题材筛选参数
    if (options.category) {
      const separator = fullUrl.includes('?') ? '&' : '?';
      const encodedCategory = encodeURIComponent(options.category);
      fullUrl = `${fullUrl}${separator}keyword=&searchType=1&category=${encodedCategory}&author=&sort=2`;
      console.log(`[UAA-AudioListParser] 题材筛选: ${options.category}`);
    }
    
    // 添加分页参数
    if (page > 1) {
      const separator = fullUrl.includes('?') ? '&' : '?';
      fullUrl = `${fullUrl}${separator}page=${page}`;
    }
    
    console.log(`[UAA-AudioListParser] 获取音频列表: ${fullUrl} (页码: ${page})`);
    
    // 根据配置选择使用浏览器模式或普通HTTP请求
    let html;
    if (config.useBrowserMode) {
      console.log(`[UAA-AudioListParser] 使用浏览器模式 (puppeteer)`);
      html = await fetchWithBrowser(fullUrl, {
        maxRetries: 3,
        retryDelay: 2000
      });
    } else {
      console.log(`[UAA-AudioListParser] 使用HTTP请求模式`);
      html = await httpGet(fullUrl);
    }
    
    if (!html || html.length < 100) {
      throw new Error('返回的HTML内容为空或过短，可能请求失败');
    }
    
    console.log(`[UAA-AudioListParser] 获取HTML长度: ${html.length} 字符`);
    
    // 调试：保存HTML到文件（仅首次）
    if (page === 1 && process.env.DEBUG_HTML) {
      const fs = require('fs');
      const path = require('path');
      const debugPath = path.join(__dirname, '../../debug-uaa-list.html');
      try {
        fs.writeFileSync(debugPath, html, 'utf8');
        console.log(`[UAA-AudioListParser] HTML已保存到: ${debugPath}`);
      } catch (e) {
        console.error(`[UAA-AudioListParser] 保存HTML失败:`, e.message);
      }
    }
    
    const $ = cheerio.load(html);
    
    const audioList = [];
    const listSelector = config.selectors.list;
    
    // 输出调试信息
    console.log(`[UAA-AudioListParser] 使用选择器: ${listSelector.container}`);
    const containerCount = $(listSelector.container).length;
    console.log(`[UAA-AudioListParser] 找到容器数量: ${containerCount}`);
    
    if (containerCount === 0) {
      // 尝试备用选择器
      console.warn('[UAA-AudioListParser] 未找到列表容器，尝试备用选择器...');
      const alternativeSelectors = [
        '.audio-item',
        '[class*="audio"]',
        '[class*="list-item"]',
        'article',
        '.item'
      ];
      
      for (const selector of alternativeSelectors) {
        const count = $(selector).length;
        if (count > 0) {
          console.log(`[UAA-AudioListParser] 备用选择器 ${selector} 找到 ${count} 个项目`);
        }
      }
    }
    
    // 查找列表项
    $(listSelector.container).each((i, element) => {
      try {
        const $item = $(element);
        
        // 提取标题和链接
        const titleLink = $item.find(listSelector.title).first();
        const title = cleanText(titleLink.text() || titleLink.attr('title') || '');
        
        if (!title) {
          console.log('[UAA-AudioListParser] 跳过空标题项');
          return;
        }
        
        // 提取链接和ID
        const detailUrl = titleLink.attr('href') || '';
        const audioId = extractIdFromUrl(detailUrl);
        
        // 提取封面
        const coverUrl = $item.find(listSelector.cover).first().attr('src') || '';
        
        // 提取CV/作者
        const cv = cleanText($item.find(listSelector.cv).first().text());
        
        // 提取分类
        const category = cleanText($item.find(listSelector.category).first().text());
        
        // 提取更新时间
        const updateTime = cleanText($item.find(listSelector.updateTime).first().text());
        
        // 提取收听量
        const listenCount = cleanText($item.find(listSelector.listenCount).first().text());
        
        // 构建音频对象（列表基础信息）
        const audio = {
          id: audioId || `temp-${i}`,  // 移除 "audio-" 前缀，使用纯数字ID
          article_id: audioId,
          title: title,
          coverUrl: coverUrl.startsWith('http') ? coverUrl : (config.baseUrl + (coverUrl.startsWith('/') ? coverUrl : '/' + coverUrl)),
          detailUrl: detailUrl.startsWith('http') ? detailUrl : (config.baseUrl + (detailUrl.startsWith('/') ? detailUrl : '/' + detailUrl)),
          
          // 从列表中解析的元数据
          cv: cv,
          category: options.category || category, // 如果有筛选题材，优先使用筛选的题材
          updateTime: updateTime,
          listenCount: listenCount,
          status: '完结', // 默认状态
          
          // 音频特有字段
          type: 'audio',
          duration: null,
          episodeCount: null,
          episodeInfo: '',
          description: '',
          episodes: [],
          audioUrls: []
        };
        
        audioList.push(audio);
        
      } catch (error) {
        console.error('[UAA-AudioListParser] 解析单项失败:', error);
      }
    });
    
    console.log(`[UAA-AudioListParser] 成功解析 ${audioList.length} 条音频（列表基础信息）`);
    
    // 如果没有解析到任何数据，返回空列表
    if (audioList.length === 0) {
      console.warn('[UAA-AudioListParser] 未解析到任何音频数据');
      return {
        items: [],
        pagination: {
          current: page,
          total: 1,
          hasNext: false,
          hasPrev: false,
          pageSize: config.pageSize || 20
        }
      };
    }
    
    // 整合详情数据（可配置是否获取）
    let integratedList = audioList; // 默认使用列表数据
    
    if (config.skipDetailFetch) {
      console.log(`[UAA-AudioListParser] 跳过详情获取（配置已禁用）`);
      integratedList = audioList;
    } else {
      console.log(`[UAA-AudioListParser] 开始获取详情数据...`);
      try {
        integratedList = await integrateDetails(audioList);
      } catch (error) {
        console.error('[UAA-AudioListParser] 详情整合失败，使用列表数据:', error.message);
        integratedList = audioList;
      }
    }
    
    // 解析分页信息
    const pagination = parsePagination($, page, integratedList.length);
    
    return {
      items: integratedList,
      pagination: pagination
    };
    
  } catch (error) {
    console.error('[UAA-AudioListParser] 获取音频列表失败:', error);
    throw error;
  }
}

/**
 * 整合列表和详情数据
 */
async function integrateDetails(audioList) {
  const maxConcurrent = config.maxConcurrent || 2;
  const results = [];
  
  // 分批并发获取详情
  for (let i = 0; i < audioList.length; i += maxConcurrent) {
    const batch = audioList.slice(i, i + maxConcurrent);
    
    const detailPromises = batch.map(async (audio) => {
      try {
        // 获取详情数据
        const detail = await getAudioDetail(audio.article_id, audio.detailUrl);
        
        // 整合列表和详情数据
        return {
          ...audio,
          ...detail,
          // 保留列表中的收听量（详情页可能不准确）
          listenCount: audio.listenCount || detail.listenCount,
          // 整合后的章节信息
          episodeInfo: detail.episodeCount ? `共${detail.episodeCount}集` : '',
        };
      } catch (error) {
        console.error(`[UAA-AudioListParser] 获取详情失败 [${audio.title}]:`, error);
        // 失败时返回列表数据
        return audio;
      }
    });
    
    const batchResults = await Promise.all(detailPromises);
    results.push(...batchResults);
    
    console.log(`[UAA-AudioListParser] 已整合 ${results.length}/${audioList.length} 条`);
  }
  
  console.log(`[UAA-AudioListParser] 详情整合完成，共 ${results.length} 条`);
  return results;
}

/**
 * 从URL提取ID
 */
function extractIdFromUrl(url) {
  if (!url) return null;
  
  // UAA格式: /audio/intro?id=1217838722633043968
  const queryMatch = url.match(/[?&]id=(\d+)/);
  if (queryMatch) {
    return queryMatch[1];
  }
  
  // 路径格式: /audio/1217838722633043968
  const pathMatch = url.match(/\/audio\/(\d+)/);
  if (pathMatch) {
    return pathMatch[1];
  }
  
  return null;
}

/**
 * 提取CV（配音演员）
 */
function extractCV(text) {
  // 匹配 "CV: xxx" 或 "xxx 有声小说" 前面的名字
  const cvMatch = text.match(/([^\s]+)\s+有声小说/);
  if (cvMatch) {
    return cvMatch[1];
  }
  
  // 尝试其他模式
  const match = text.match(/CV[:：]\s*([^\s]+)/);
  return match ? match[1] : '';
}

/**
 * 提取分类
 */
function extractCategory(text) {
  const categories = ['有声小说', 'ASMR', '激情骚麦', '寸止训练'];
  for (const cat of categories) {
    if (text.includes(cat)) {
      return cat;
    }
  }
  return '有声小说';
}

/**
 * 提取更新时间
 */
function extractUpdateTime(text) {
  const match = text.match(/(\d+天前|\d+小时前|\d+分钟前|刚刚)/);
  return match ? match[1] : '';
}

/**
 * 提取收听量
 */
function extractListenCount(text) {
  // 匹配数字+单位格式：5.50K, 18.9K, 1.80M 等
  const match = text.match(/([\d.]+[KMW]?)\s*$/);
  if (match) {
    return match[1];
  }
  
  // 匹配纯数字
  const numMatch = text.match(/(\d+)\s*$/);
  return numMatch ? numMatch[1] : '0';
}

/**
 * 提取状态
 */
function extractStatus(text) {
  if (text.includes('完结')) return '完结';
  if (text.includes('连载')) return '连载';
  if (text.includes('更新')) return '连载';
  return '完结';
}

/**
 * 解析分页信息
 */
function parsePagination($, currentPage, itemCount) {
  const pageSize = config.pageSize || 48; // 从配置读取每页数量
  
  // 从分页链接中解析总页数
  let totalPages = currentPage; // 默认值
  
  try {
    // 查找所有包含page=参数的链接
    const pageLinks = $('a[href*="page="]');
    const pageNumbers = [];
    
    pageLinks.each((i, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/page=(\d+)/);
      if (match) {
        pageNumbers.push(parseInt(match[1]));
      }
    });
    
    // 也查找纯数字的链接（可能是分页按钮）
    $('a').each((i, el) => {
      const text = $(el).text().trim();
      if (/^\d+$/.test(text)) {
        const num = parseInt(text);
        if (num > 0 && num < 1000) { // 合理的页码范围
          pageNumbers.push(num);
        }
      }
    });
    
    // 最大的页码就是总页数
    if (pageNumbers.length > 0) {
      totalPages = Math.max(...pageNumbers);
      console.log(`[UAA-AudioListParser] 从页面解析到的页码:`, pageNumbers.slice(0, 10), '最大页码:', totalPages);
    }
  } catch (error) {
    console.error(`[UAA-AudioListParser] 解析分页失败:`, error.message);
  }
  
  // 判断是否有下一页
  const hasNext = currentPage < totalPages;
  
  console.log(`[UAA-AudioListParser] 分页信息: 当前页=${currentPage}, 总页数=${totalPages}, 数据量=${itemCount}, 每页=${pageSize}`);
  
  return {
    current: currentPage,
    total: totalPages,
    hasNext: hasNext,
    hasPrev: currentPage > 1,
    pageSize: pageSize
  };
}

module.exports = {
  getCategories,
  getAudioList
};
