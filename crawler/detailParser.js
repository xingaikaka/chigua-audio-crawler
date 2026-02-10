/**
 * 详情页解析模块
 * 负责解析文章详情页的所有内容：标题、正文、图片、视频等
 */

const cheerio = require('cheerio');
const { httpGet, cleanText, buildUrl } = require('./utils');

/**
 * 判断是否是预加载图片
 */
function isPreloadImage(url) {
  if (!url) return true;
  
  const urlLower = url.toLowerCase();
  const preloadKeywords = [
    'zw.png', 'banner.png', 'loading', 'placeholder', 'spinner',
    'lazy', 'preload', 'thumb', 'thumbnail', 'default', 'empty',
    'no-image', 'noimage', 'blank', 'transparent', '1x1', 'pixel'
  ];
  
  if (urlLower.includes('zw.png')) return true;
  if (url.startsWith('data:image')) return true;
  
  return preloadKeywords.some(keyword => urlLower.includes(keyword));
}

/**
 * 从URL中提取article_id
 */
function extractArticleIdFromUrl(url) {
  if (!url) return null;
  // 尝试多种URL格式
  const patterns = [
    /\/archives\/(\d+)/,           // /archives/12345
    /\/post\/(\d+)/,               // /post/12345
    /\/article\/(\d+)/,            // /article/12345
    /\/\d+\/(\d+)/,                // /2024/12345
    /[?&]id=(\d+)/,                // ?id=12345
    /[?&]post_id=(\d+)/,           // ?post_id=12345
    /[?&]article_id=(\d+)/         // ?article_id=12345
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * 将文本中的"51"替换为"天涯"
 */
function replace51ToTianya(text) {
  if (!text) return text;
  
  // 如果文本看起来像URL或文件路径，不进行替换
  if (/https?:\/\/|\/[a-zA-Z0-9_\-\./]+\.(jpg|jpeg|png|gif|mp4|m3u8|ts|key)/i.test(text)) {
    return text;
  }
  
  // 如果文本是纯数字或包含时间戳模式，不替换
  if (/^\d+$/.test(text.trim()) || /\d{13,}/.test(text)) {
    return text;
  }
  
  // 如果文本包含日期格式，保护日期部分
  const datePattern = /\d{4}\/\d{2}\/\d{2}/g;
  const dates = text.match(datePattern);
  if (dates) {
    let protectedText = text;
    dates.forEach((date, i) => {
      protectedText = protectedText.replace(date, `__DATE_${i}__`);
    });
    
    let replacedText = protectedText.replace(/51/g, '天涯');
    
    dates.forEach((date, i) => {
      replacedText = replacedText.replace(`__DATE_${i}__`, date);
    });
    
    return replacedText;
  }
  
  // 普通文本，直接替换
  return text.replace(/51/g, '天涯');
}

/**
 * 解析文章详情页
 * @param {string} detailUrl - 详情页URL
 * @returns {Promise<Object>} 解析后的详情数据
 */
async function parseDetail(detailUrl) {
  try {
    console.log(`[DetailParser] 开始解析详情页: ${detailUrl}`);
    
    const html = await httpGet(detailUrl);
    const $ = cheerio.load(html);
    
    const data = {
      article_id: null,
      title: '',
      cover_image: null,
      content: '',
      content_html: '',
      description: '',
      images: [],
      videos: [],
      has_video: false,
      published_at: null,
      categories: [],
      views_count: 0,
      likes_count: 0,
      comments_count: 0
    };
    
    // 1. 从URL中提取article_id
    data.article_id = extractArticleIdFromUrl(detailUrl);
    
    if (!data.article_id) {
      console.warn(`[DetailParser] 警告：无法从URL中提取article_id: ${detailUrl}`);
    } else {
      console.log(`[DetailParser] 从URL提取到article_id: ${data.article_id}`);
    }
    
    // 2. 提取标题
    const titleElem = $('h1.post-title, h1, .post-title, [class*="post-title"]').first();
    if (titleElem.length > 0) {
      data.title = replace51ToTianya(cleanText(titleElem.text()));
    }
    
    // 3. 提取封面图
    const coverImageElem = $('meta[property="og:image"]').first();
    if (coverImageElem.length > 0) {
      const coverUrl = coverImageElem.attr('content');
      if (coverUrl && !isPreloadImage(coverUrl)) {
        data.cover_image = buildUrl(coverUrl);
      }
    }
    
    // 如果没有og:image，尝试从文章内容中提取第一张图片
    if (!data.cover_image) {
      const firstImg = $('div.post-content img, article.post img').first();
      if (firstImg.length > 0) {
        let src = firstImg.attr('src') || firstImg.attr('data-src') || firstImg.attr('data-xkrkllgl');
        if (src && !isPreloadImage(src)) {
          data.cover_image = buildUrl(src);
        }
      }
    }
    
    // 4. 提取发布时间
    const dateElem = $('[itemprop="datePublished"]').first();
    if (dateElem.length > 0) {
      const content = dateElem.attr('content');
      if (content) {
        try {
          const dt = new Date(content.replace('Z', '+00:00'));
          data.published_at = dt.toISOString().replace('T', ' ').substring(0, 19);
        } catch (e) {
          data.published_at = cleanText(dateElem.text());
        }
      } else {
        data.published_at = cleanText(dateElem.text());
      }
    }
    
    // 5. 提取分类
    const postCardInfo = $('.post-card-info, .post-info, [class*="post-info"]').first();
    if (postCardInfo.length > 0) {
      postCardInfo.find('span').each((j, span) => {
        const $span = $(span);
        if (['datePublished', 'author'].includes($span.attr('itemprop'))) {
          return;
        }
        
        const spanText = cleanText($span.text());
        if (spanText.includes(',') && spanText.length > 2 && spanText.length < 100) {
          const spanCategories = spanText.split(',').map(cat => replace51ToTianya(cat.trim()));
          spanCategories.forEach(cat => {
            if (cat.length >= 2 && cat.length <= 20 && !data.categories.includes(cat)) {
              data.categories.push(cat);
            }
          });
        }
      });
    }
    
    // 6. 提取内容
    const contentElem = $('div.post-content, article.post, .post-content, [class*="post-content"]').first();
    if (contentElem.length > 0) {
      let contentHtml = contentElem.html() || '';
      
      // 查找第一个blockquote标签的结束位置
      const blockquoteEndPos = contentHtml.indexOf('</blockquote>');
      let afterBlockquoteHtml = contentHtml;
      if (blockquoteEndPos > 0) {
        afterBlockquoteHtml = contentHtml.substring(blockquoteEndPos + '</blockquote>'.length);
      }
      
      // 查找所有视频标签
      const $temp = cheerio.load(afterBlockquoteHtml);
      const allVideos = [];
      
      $temp('div.dplayer').each((i, el) => allVideos.push(el));
      $temp('video').each((i, el) => allVideos.push(el));
      
      if (allVideos.length > 0) {
        // 找到最后一个视频
        const lastVideo = allVideos[allVideos.length - 1];
        const lastVideoHtml = $temp.html(lastVideo);
        const lastVideoPos = afterBlockquoteHtml.lastIndexOf(lastVideoHtml);
        
        if (lastVideoPos >= 0) {
          const videoEndPos = lastVideoPos + lastVideoHtml.length;
          afterBlockquoteHtml = afterBlockquoteHtml.substring(0, videoEndPos);
        }
      }
      
      // 提取纯文本内容
      const $tempForContent = cheerio.load(afterBlockquoteHtml);
      data.content = replace51ToTianya(cleanText($tempForContent.text()));
      
      // 替换HTML中的文本节点
      const $tempForText = cheerio.load(afterBlockquoteHtml);
      $tempForText('*').each((i, el) => {
        const $el = $tempForText(el);
        if (el.tagName === 'script' || el.tagName === 'style') {
          return;
        }
        
        $el.contents().each((j, node) => {
          if (node.type === 'text' && node.data && node.data.trim()) {
            const newText = replace51ToTianya(node.data);
            $tempForText(node).replaceWith(newText);
          }
        });
      });
      
      data.content_html = $tempForText.html() || '';
      
      // 提取描述（取前200个字符）
      data.description = data.content.substring(0, 200).trim();
      if (data.content.length > 200) {
        data.description += '...';
      }
    }
    
    // 7. 提取所有图片URL
    if (contentElem.length > 0) {
      const images = [];
      
      // 优先使用data-xkrkllgl属性
      contentElem.find('img[data-xkrkllgl]').each((i, img) => {
        const $img = $(img);
        let src = $img.attr('data-xkrkllgl');
        if (src && !src.startsWith('data:') && !isPreloadImage(src)) {
          images.push(buildUrl(src));
        }
      });
      
      // 如果没有找到，使用src
      if (images.length === 0) {
        contentElem.find('img[src]').each((i, img) => {
          const $img = $(img);
          let src = $img.attr('src');
          if (src && !src.startsWith('data:') && !isPreloadImage(src)) {
            images.push(buildUrl(src));
          }
        });
      }
      
      // 去重
      data.images = [...new Set(images)];
    }
    
    // 8. 提取视频URL
    const m3u8Candidates = [];
    const mp4Candidates = [];
    
    if (contentElem.length > 0) {
      // 从dplayer中提取
      contentElem.find('div.dplayer').each((i, div) => {
        const $div = $(div);
        const dataConfig = $div.attr('data-config');
        
        if (dataConfig) {
          try {
            const configStr = dataConfig.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
            const config = JSON.parse(configStr);
            if (config && config.video && config.video.url) {
              const videoUrl = config.video.url;
              if (videoUrl.toLowerCase().includes('.m3u8')) {
                m3u8Candidates.push(buildUrl(videoUrl));
              } else if (videoUrl.toLowerCase().includes('.mp4')) {
                mp4Candidates.push(buildUrl(videoUrl));
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      });
      
      // 从video标签中提取
      contentElem.find('video source, video').each((i, el) => {
        const $el = $(el);
        const src = $el.attr('src');
        if (src) {
          if (src.toLowerCase().includes('.m3u8')) {
            m3u8Candidates.push(buildUrl(src));
          } else if (src.toLowerCase().includes('.mp4')) {
            mp4Candidates.push(buildUrl(src));
          }
        }
      });
    }
    
    // 优先使用m3u8，其次mp4
    if (m3u8Candidates.length > 0) {
      data.videos = [...new Set(m3u8Candidates)];
      data.has_video = true;
    } else if (mp4Candidates.length > 0) {
      data.videos = [...new Set(mp4Candidates)];
      data.has_video = true;
    }
    
    // 9. 提取统计数据（浏览量、点赞数、评论数）
    const statsElem = $('.post-stats, .post-meta, [class*="post-stats"]').first();
    if (statsElem.length > 0) {
      const statsText = statsElem.text();
      
      // 提取浏览量
      const viewsMatch = statsText.match(/(\d+)\s*(?:浏览|阅读|views?)/i);
      if (viewsMatch) {
        data.views_count = parseInt(viewsMatch[1], 10);
      }
      
      // 提取点赞数
      const likesMatch = statsText.match(/(\d+)\s*(?:点赞|喜欢|likes?)/i);
      if (likesMatch) {
        data.likes_count = parseInt(likesMatch[1], 10);
      }
      
      // 提取评论数
      const commentsMatch = statsText.match(/(\d+)\s*(?:评论|comments?)/i);
      if (commentsMatch) {
        data.comments_count = parseInt(commentsMatch[1], 10);
      }
    }
    
    console.log(`[DetailParser] 解析完成: ${data.title}`);
    console.log(`  - 图片: ${data.images.length} 张`);
    console.log(`  - 视频: ${data.videos.length} 个`);
    console.log(`  - 分类: ${data.categories.join(', ')}`);
    
    return data;
    
  } catch (error) {
    console.error('[DetailParser] 解析失败:', error);
    throw error;
  }
}

module.exports = {
  parseDetail,
  extractArticleIdFromUrl,
  replace51ToTianya,
  isPreloadImage
};
