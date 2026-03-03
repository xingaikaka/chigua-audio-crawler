/**
 * UAA有声小说详情解析器
 */

const cheerio = require('cheerio');
const { httpGet, cleanText, buildUrl } = require('../utils');
const config = require('../../config/uaa.json');
const { fetchWithBrowser } = require('./browserHelper');

/**
 * 获取音频详情
 * @param {string} audioId 音频ID
 * @param {string} detailUrl 详情页URL
 */
async function getAudioDetail(audioId, detailUrl) {
  try {
    console.log(`[UAA-AudioDetailParser] 获取音频详情: ${audioId}, URL: ${detailUrl}`);
    
    // 使用传入的detailUrl，如果没有则构建
    let url;
    if (detailUrl && detailUrl.includes('http')) {
      url = detailUrl;
    } else if (detailUrl && detailUrl.startsWith('/')) {
      url = buildUrl(config.baseUrl, detailUrl);
    } else {
      url = buildUrl(config.baseUrl, `/audio/intro?id=${audioId}`);
    }
    
    console.log(`[UAA-AudioDetailParser] 访问URL: ${url}`);
    
    // 使用浏览器模式获取详情页
    let html;
    if (config.useBrowserMode) {
      console.log(`[UAA-AudioDetailParser] 使用浏览器模式获取详情（等待JS执行）`);
      // ✅ 详情页需要等待JS执行，确保音频URL被正确生成
      html = await fetchWithBrowser(url, { 
        maxRetries: 2, 
        retryDelay: 1000,
        waitForAudio: true  // 标记需要等待音频元素
      });
    } else {
      html = await httpGet(url);
    }
    
    const $ = cheerio.load(html);
    
    const detail = {
      id: audioId,
      
      // 基本信息
      title: extractTitle($),
      coverUrl: extractCover($),
      description: extractDescription($),
      
      // CV和分类信息
      cv: extractCV($),
      cvAvatar: extractCVAvatar($),
      category: extractCategory($),
      tags: extractTags($),
      
      // 状态信息
      status: extractStatus($),
      updateTime: extractUpdateTime($),
      latestEpisode: extractLatestEpisode($),
      listenCount: extractListenCount($),
      likeCount: extractLikeCount($),
      collectCount: extractCollectCount($),
      rating: extractRating($),
      
      // 章节信息
      episodes: extractEpisodes($),
      episodeCount: 0,
      totalDuration: null,
      
      // 音频播放信息
      audioUrls: extractAudioUrls($),
      
      // 原始URL
      detailUrl: url
    };
    
    detail.episodeCount = detail.episodes.length;
    
    // 🎯 兼容处理：确保单音频和多音频都能正确同步
    
    // 情况1: 有章节列表，且提取到了audio标签的真实URL
    if (detail.episodes.length > 0 && detail.audioUrls.length > 0) {
      // ✅ 单集：直接用audio标签的真实URL替换构造的URL
      if (detail.episodes.length === 1) {
        const realAudioUrl = detail.audioUrls[0];
        const constructedUrl = detail.episodes[0].audioUrl;
        
        if (realAudioUrl !== constructedUrl) {
          console.log(`[UAA-AudioDetailParser] 🔄 单集检测到URL不一致，使用真实URL`);
          console.log(`[UAA-AudioDetailParser]   构造的URL: ${constructedUrl}`);
          console.log(`[UAA-AudioDetailParser]   真实URL: ${realAudioUrl}`);
          detail.episodes[0].audioUrl = realAudioUrl;
        }
      }
      // ✅ 多集：从audio标签真实URL中提取日期目录，修正所有章节的URL
      // 真实URL格式: https://cdn.uameta.ai/file/bucket-media/audio/{dateDir}/{index}.mp3
      // 构造URL格式（错误）: https://cdn.uameta.ai/file/bucket-media/audio/{chapterId}.mp3
      else {
        const realAudioUrl = detail.audioUrls[0];
        const dateDirMatch = realAudioUrl.match(/\/audio\/(\d+)\/\d+\.mp3/);
        
        if (dateDirMatch) {
          const dateDir = dateDirMatch[1];
          console.log(`[UAA-AudioDetailParser] 🔄 多集URL修正: 提取到日期目录 "${dateDir}"，重构所有章节URL`);
          
          detail.episodes.forEach((episode, index) => {
            const correctUrl = `https://cdn.uameta.ai/file/bucket-media/audio/${dateDir}/${index + 1}.mp3`;
            console.log(`[UAA-AudioDetailParser]   章节 ${index + 1}: ${episode.audioUrl} → ${correctUrl}`);
            episode.audioUrl = correctUrl;
          });
        } else {
          console.warn(`[UAA-AudioDetailParser] ⚠️ 多集：无法从真实URL解析日期目录，章节URL可能不正确`);
          console.warn(`[UAA-AudioDetailParser]   真实URL: ${realAudioUrl}`);
        }
      }
    }
    
    // 情况2: 有章节列表（多集），但没有提取到audioUrls
    else if (detail.episodes.length > 0 && detail.audioUrls.length === 0) {
      // 从第一个章节提取audioUrl作为备用
      if (detail.episodes[0].audioUrl) {
        detail.audioUrls.push(detail.episodes[0].audioUrl);
        console.log(`[UAA-AudioDetailParser] 从章节列表补充audioUrls: ${detail.audioUrls[0]}`);
      }
    }
    
    // 情况3: 没有章节列表（单音频），但有audioUrls
    else if (detail.episodes.length === 0 && detail.audioUrls.length > 0) {
      console.log(`[UAA-AudioDetailParser] 检测到单音频（无章节列表），audioUrls: ${detail.audioUrls.length} 个`);
      // ✅ 这种情况会由 uaaSyncTask.js 的虚拟章节逻辑处理
    }
    
    // 情况4: 既没有章节列表，也没有audioUrls（需要警告）
    else if (detail.episodes.length === 0 && detail.audioUrls.length === 0) {
      console.warn(`[UAA-AudioDetailParser] ⚠️ 未提取到任何音频数据（无章节，无audioUrls）`);
    }
    
    console.log(`[UAA-AudioDetailParser] 详情解析成功: ${detail.title}, 章节数: ${detail.episodeCount}, 音频URL数: ${detail.audioUrls.length}`);
    return detail;
    
  } catch (error) {
    console.error(`[UAA-AudioDetailParser] 获取详情失败 [${audioId}]:`, error);
    // 返回基本信息，避免整个列表加载失败
    return {
      id: audioId,
      title: '解析失败',
      error: error.message
    };
  }
}

/**
 * 提取标题
 */
function extractTitle($) {
  // 尝试多个选择器
  const selectors = [
    'h1.title',
    'h1',
    '.audio-title',
    '.detail-title',
    'title'
  ];
  
  for (const selector of selectors) {
    const title = $(selector).first().text().trim();
    if (title && !title.includes('UAA')) {
      return cleanText(title);
    }
  }
  
  return '未知标题';
}

/**
 * 提取封面
 */
function extractCover($) {
  const cover = $('img.cover, .audio-cover img, .detail-cover img').first().attr('src');
  return cover || '';
}

/**
 * 提取描述
 */
function extractDescription($) {
  const desc = $('.description, .intro, .summary').first().text().trim();
  return cleanText(desc) || '';
}

/**
 * 提取CV
 */
function extractCV($) {
  // 查找CV相关的文本
  const cvText = $('.cv, .author, .voice-actor').first().text().trim();
  if (cvText) {
    return cleanText(cvText.replace(/CV[:：]\s*/, ''));
  }
  
  // 尝试从链接中提取
  const cvLink = $('a[href*="/cv/"]').first().text().trim();
  return cleanText(cvLink) || '';
}

/**
 * 提取CV头像
 */
function extractCVAvatar($) {
  const avatar = $('.cv-avatar img, .author-avatar img').first().attr('src');
  return avatar || '';
}

/**
 * 提取分类
 */
function extractCategory($) {
  const category = $('.category, .tag, .genre').first().text().trim();
  return cleanText(category) || '有声小说';
}

/**
 * 提取标签
 */
function extractTags($) {
  const tags = [];
  $('.tags a, .tag-list a, [class*="tag"]').each((i, el) => {
    const tag = $(el).text().trim();
    if (tag) {
      tags.push(cleanText(tag));
    }
  });
  return tags.slice(0, 10); // 最多10个标签
}

/**
 * 提取状态
 */
function extractStatus($) {
  const text = $('body').text();
  if (text.includes('完结') || text.includes('已完结')) {
    return '完结';
  }
  if (text.includes('连载') || text.includes('更新中')) {
    return '连载';
  }
  return '完结';
}

/**
 * 提取更新时间
 */
function extractUpdateTime($) {
  const bodyText = $('body').text();
  
  // 查找"最新: xxx更新"格式
  const latestMatch = bodyText.match(/最新[：:]\s*(\d+(?:天|小时|分钟|秒)前更新|[\d-]+)/);
  if (latestMatch) return latestMatch[1];
  
  // 查找"更新时间: xxx"格式
  const updateMatch = bodyText.match(/更新(?:时间)?[：:]\s*(\d+(?:天|小时|分钟|秒)前|\d{4}-\d{2}-\d{2})/);
  if (updateMatch) return updateMatch[1];
  
  const timeText = $('.update-time, .time, [class*="time"]').first().text();
  const match = timeText.match(/(\d+天前|\d+小时前|\d+分钟前|\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

/**
 * 提取最新章节
 */
function extractLatestEpisode($) {
  const bodyText = $('body').text();
  
  // 查找"最新: xxx - 第x集"格式
  const match = bodyText.match(/最新[：:]\s*(\d+(?:天|小时|分钟)前更新\s*-\s*第\d+集)/);
  if (match) return match[1];
  
  // 查找"第x集"
  const epMatch = bodyText.match(/第(\d+)集/);
  if (epMatch) return `第${epMatch[1]}集`;
  
  return '';
}

/**
 * 提取评分
 */
function extractRating($) {
  const bodyText = $('body').text();
  
  // 查找"评分: x分"或"x.x分"
  const ratingMatch = bodyText.match(/评分[：:]\s*([\d.]+)分?|(\d+\.\d+)分/);
  if (ratingMatch) return ratingMatch[1] || ratingMatch[2];
  
  // 查找星级评分
  const stars = $('.rating [class*="star"]').length;
  if (stars > 0) return stars.toString();
  
  return '暂无评分';
}

/**
 * 提取收听量
 */
function extractListenCount($) {
  const text = $('body').text();
  
  // 查找"收听量: xxx"格式
  let match = text.match(/收听量[：:]\s*(\d+(?:\.\d+)?[KMW]?)/);
  if (match) return match[1];
  
  // 查找"收听: xxx"格式
  match = text.match(/收听[：:]\s*(\d+(?:\.\d+)?[KMW]?)/);
  if (match) return match[1];
  
  // 查找"播放"格式
  match = text.match(/(\d+(?:\.\d+)?[KMW]?)\s*(?:次)?(?:收听|播放)/i);
  return match ? match[1] : '0';
}

/**
 * 提取点赞数
 */
function extractLikeCount($) {
  const likeText = $('.like-count, .likes, [class*="like"]').first().text();
  const match = likeText.match(/(\d+(?:\.\d+)?[KMW]?)/);
  return match ? match[1] : '0';
}

/**
 * 提取收藏数
 */
function extractCollectCount($) {
  // 在详情页中查找收藏相关的图标和文本
  const bodyText = $('body').text();
  
  // 查找img标签后面的数字（UAA格式）
  $('img[src*="collect"]').each((i, el) => {
    const $el = $(el);
    const nextText = $el.parent().text() || $el.next().text();
    const match = nextText.match(/(\d+(?:\.\d+)?[KMW]?)/);
    if (match) {
      return match[1];
    }
  });
  
  // 备用方案：查找纯文本
  const match = bodyText.match(/收藏[：:]\s*(\d+(?:\.\d+)?[KMW]?)/);
  if (match) return match[1];
  
  const collectText = $('.collect-count, .collects, [class*="collect"]').first().text();
  const textMatch = collectText.match(/(\d+(?:\.\d+)?[KMW]?)/);
  return textMatch ? textMatch[1] : '0';
}

/**
 * 提取音频播放URL
 */
function extractAudioUrls($) {
  const audioUrls = [];
  
  // 方法1: 从audio标签的src属性
  $('audio').each((i, el) => {
    const src = $(el).attr('src');
    if (src) {
      const fullUrl = src.startsWith('http') ? src : buildUrl(config.baseUrl, src);
      audioUrls.push(fullUrl);
      console.log(`[UAA-AudioDetailParser] 找到audio src: ${fullUrl}`);
    }
  });
  
  // 方法2: 从source标签
  $('audio source, source').each((i, el) => {
    const src = $(el).attr('src');
    if (src) {
      const fullUrl = src.startsWith('http') ? src : buildUrl(config.baseUrl, src);
      if (!audioUrls.includes(fullUrl)) {
        audioUrls.push(fullUrl);
        console.log(`[UAA-AudioDetailParser] 找到source src: ${fullUrl}`);
      }
    }
  });
  
  // 方法3: 从data-src属性
  $('[data-src*="mp3"], [data-src*="m4a"], [data-src*="audio"]').each((i, el) => {
    const src = $(el).attr('data-src');
    if (src) {
      const fullUrl = src.startsWith('http') ? src : buildUrl(config.baseUrl, src);
      if (!audioUrls.includes(fullUrl)) {
        audioUrls.push(fullUrl);
        console.log(`[UAA-AudioDetailParser] 找到data-src: ${fullUrl}`);
      }
    }
  });
  
  console.log(`[UAA-AudioDetailParser] 提取到 ${audioUrls.length} 个音频URL`);
  return audioUrls;
}

/**
 * 提取章节列表
 */
function extractEpisodes($) {
  const episodes = [];
  
  // 🎯 方案A：优先从详情页的章节列表直接提取（包含章节ID和音频URL）
  console.log('[UAA-AudioDetailParser] 尝试从catalog_ul提取章节列表...');
  $('.catalog_ul li.menu div[data-id]').each((i, el) => {
    const $el = $(el);
    const chapterId = $el.attr('data-id');
    const title = $el.text().trim();
    
    if (chapterId && title) {
      // ✅ 直接构造音频URL，无需访问章节页
      const audioUrl = `https://cdn.uameta.ai/file/bucket-media/audio/${chapterId}.mp3`;
      
      episodes.push({
        id: chapterId,  // 章节ID
        index: i + 1,
        title: cleanText(title),
        url: buildUrl(config.baseUrl, `/audio/chapter?id=${chapterId}`),
        audioUrl: audioUrl,  // ✅ 直接可用的音频URL
        duration: null
      });
      
      console.log(`[UAA-AudioDetailParser]   章节 ${i + 1}: ${title} (ID: ${chapterId})`);
    }
  });
  
  // 如果方案A成功提取到章节，直接返回
  if (episodes.length > 0) {
    console.log(`[UAA-AudioDetailParser] ✓ 从catalog_ul提取到 ${episodes.length} 个章节`);
    return episodes;
  }
  
  // 🔄 备用方案：使用原有的多选择器查找逻辑
  console.log('[UAA-AudioDetailParser] catalog_ul未找到章节，尝试其他选择器...');
  
  const selectors = [
    '.episode-list .episode-item',
    '.chapter-list .chapter-item',
    '.chapter-item',
    '[class*="episode"] a',
    '[class*="chapter"] a'
  ];
  
  for (const selector of selectors) {
    $(selector).each((i, el) => {
      const $el = $(el);
      const title = $el.text().trim();
      const url = $el.attr('href');
      
      if (title && url) {
        episodes.push({
          index: i + 1,
          title: cleanText(title),
          url: buildUrl(config.baseUrl, url),
          audioUrl: null, // 需要进一步解析获取实际音频URL
          duration: null
        });
      }
    });
    
    if (episodes.length > 0) {
      console.log(`[UAA-AudioDetailParser] ✓ 使用选择器 ${selector} 提取到 ${episodes.length} 个章节`);
      break;
    }
  }
  
  console.log(`[UAA-AudioDetailParser] 最终提取到 ${episodes.length} 个章节`);
  return episodes;
}

module.exports = {
  getAudioDetail
};
