const cheerio = require('cheerio');
const { httpGet, cleanText, buildUrl, parsePagination } = require('./utils');
const { extractArticleIdFromUrl } = require('./detailParser');

/**
 * 获取分类内容列表
 * @param {string} categoryUrl - 分类URL
 * @param {number} page - 页码
 */
async function getContent(categoryUrl, page = 1) {
  try {
    // 构建分页URL
    let url = categoryUrl;
    if (page > 1) {
      // 处理分页URL格式：https://51cg1.com/category/xsxy/2/
      if (url.includes('?')) {
        url += `&page=${page}`;
      } else if (url.endsWith('/')) {
        url += `${page}/`;
      } else {
        url += `/${page}/`;
      }
    }
    
    console.log(`[ContentParser] 获取内容: ${url}`);
    
    const html = await httpGet(url);
    const $ = cheerio.load(html);
    
    const items = [];
    
    // 查找文章列表容器
    const articleSelectors = [
      'article',
      '.post',
      '.item',
      '.content-item',
      '.list-item',
      '.video-item',
      '.entry'
    ];
    
    let articles = $();
    for (const selector of articleSelectors) {
      articles = $(selector);
      if (articles.length > 0) {
        console.log(`[ContentParser] 使用选择器: ${selector}, 找到 ${articles.length} 个项目`);
        break;
      }
    }
    
    if (articles.length === 0) {
      console.log('[ContentParser] 未找到文章列表，返回空结果');
      return {
        items: [],
        pagination: {
          current: page,
          total: 1,
          hasNext: false,
          hasPrev: false
        }
      };
    }
    
    // 解析每个文章项
    articles.each((i, element) => {
      const $article = $(element);
      
      // 获取标题
      const titleElement = $article.find('h2, h3, .title, .post-title, .entry-title').first();
      const title = cleanText(titleElement.text());
      
      // 获取链接
      let link = titleElement.find('a').attr('href') || $article.find('a').first().attr('href');
      
      // 获取封面图（尝试多种方式）
      let cover = null;
      
      // 方式1：从JavaScript代码中提取（loadBannerDirect函数）
      const scriptContent = $article.find('script').text();
      if (scriptContent && scriptContent.includes('loadBannerDirect')) {
        const match = scriptContent.match(/loadBannerDirect\(['"]([^'"]+)['"]/);
        if (match && match[1]) {
          cover = match[1];
        }
      }
      
      // 方式2：从img标签提取
      if (!cover) {
        const $img = $article.find('img').first();
        if ($img.length > 0) {
          cover = $img.attr('src') || 
                  $img.attr('data-src') ||
                  $img.attr('data-lazy') ||
                  $img.attr('data-original') ||
                  $img.attr('data-url');
        }
      }
      
      // 方式3：从背景图提取
      if (!cover) {
        const $coverDiv = $article.find('.post-thumbnail, .entry-thumbnail, .thumbnail, .cover, .featured-image, .post-card, .blog-background').first();
        if ($coverDiv.length > 0) {
          const bgStyle = $coverDiv.css('background-image') || $coverDiv.attr('style');
          if (bgStyle && bgStyle.includes('url(')) {
            const match = bgStyle.match(/url\(['"]?(.*?)['"]?\)/);
            if (match) {
              cover = match[1];
            }
          }
        }
      }
      
      // 获取时间
      const dateElement = $article.find('time, .date, .post-date, .entry-date, .meta-date').first();
      let date = cleanText(dateElement.text() || dateElement.attr('datetime'));
      
      // 如果没有找到日期，尝试其他方式
      if (!date) {
        const metaText = $article.find('.meta, .post-meta').text();
        const dateMatch = metaText.match(/\d{4}.\d{1,2}.\d{1,2}|\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
          date = dateMatch[0];
        }
      }
      
      // 只添加有效的项目
      if (title && link) {
        const fullUrl = buildUrl(link);
        // 从URL中提取article_id
        const articleId = extractArticleIdFromUrl(fullUrl);
        
        const item = {
          id: articleId ? `item-${articleId}` : `item-${i}`, // 优先使用article_id作为ID
          article_id: articleId, // 添加article_id字段
          title: title,
          url: fullUrl,
          cover: cover ? buildUrl(cover) : null,
          date: date || ''
        };
        
        // 调试：记录图片URL和article_id
        if (cover) {
          console.log(`[ContentParser] 图片URL: ${item.cover.substring(0, 80)}...`);
        } else {
          console.log(`[ContentParser] 警告：未找到图片 - ${title.substring(0, 30)}`);
        }
        if (articleId) {
          console.log(`[ContentParser] 提取到article_id: ${articleId} (${title.substring(0, 30)})`);
        } else {
          console.warn(`[ContentParser] 警告：无法从URL提取article_id: ${fullUrl}`);
        }
        
        items.push(item);
      }
    });
    
    // 解析分页信息
    const pagination = parsePagination($, page);
    
    console.log(`[ContentParser] 解析完成: ${items.length} 个项目`);
    
    return {
      items,
      pagination
    };
    
  } catch (error) {
    console.error('[ContentParser] 解析失败:', error);
    throw error;
  }
}

module.exports = {
  getContent
};
