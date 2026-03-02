/**
 * 草榴社区 (t66y.com) 列表解析器
 * 解析帖子列表和帖子详情（含图片 + 视频）
 */

const cheerio = require('cheerio');
const { httpGet } = require('../utils');

const BASE_URL = 'https://t66y.com';

/**
 * 获取版块分类列表
 */
async function getCategories() {
  return [
    {
      id: 'fid7',
      name: '技术讨论区',
      url: null,
      icon: '💬',
      children: [
        { name: '全部帖子', url: `${BASE_URL}/thread0806.php?fid=7` },
        { name: '精华帖', url: `${BASE_URL}/thread0806.php?fid=7&search=digest` },
        { name: '周排行', url: `${BASE_URL}/thread0806.php?fid=7&search=hot` },
        { name: '今日新帖', url: `${BASE_URL}/thread0806.php?fid=7&search=today` }
      ]
    }
  ];
}

/**
 * 获取帖子列表
 * @param {string} listUrl - 版块列表URL
 * @param {number} page - 页码
 */
async function getThreadList(listUrl, page = 1) {
  try {
    let url = listUrl;
    if (page > 1) {
      if (url.includes('&page=')) {
        url = url.replace(/&page=\d+/, `&page=${page}`);
      } else {
        url += `&page=${page}`;
      }
    }

    console.log(`[T66Y-ListParser] 获取列表: ${url}`);
    const html = await httpGet(url);
    const $ = cheerio.load(html);
    const items = [];

    // 解析帖子列表
    const rows = $('table tr').filter((i, el) => {
      const $row = $(el);
      return $row.find('td').length >= 3 && $row.find('a[href*="read.php"], a[href*="htm_data"]').length > 0;
    });

    console.log(`[T66Y-ListParser] 找到 ${rows.length} 条帖子`);

    rows.each((i, el) => {
      try {
        const $row = $(el);

        const titleLink = $row.find('a[href*="read.php"], a[href*="htm_data"]').first();
        const title = titleLink.text().trim();
        let detailUrl = titleLink.attr('href') || '';

        if (!title || !detailUrl) return;

        if (detailUrl.startsWith('/')) {
          detailUrl = BASE_URL + detailUrl;
        } else if (!detailUrl.startsWith('http')) {
          detailUrl = BASE_URL + '/' + detailUrl;
        }

        // 提取tid
        let tid = '';
        const tidMatch = detailUrl.match(/tid=(\d+)/) || detailUrl.match(/\/(\d+)\.html/);
        if (tidMatch) tid = tidMatch[1];
        if (!tid) return;

        const praiseText = $row.find('td').first().text().trim();
        const praise = parseInt(praiseText) || 0;

        const authorLink = $row.find('a[href*="profile.php"]').first();
        const author = authorLink.text().trim() || '未知';

        let replyCount = 0;
        const cells = $row.find('td');
        cells.each((j, cell) => {
          const text = $(cell).text().trim();
          if (/^\d+$/.test(text) && j > 1) replyCount = parseInt(text);
        });

        const lastPost = $row.find('td:last-child').text().trim();
        const isPinned = praiseText.includes('↑') || $row.find('[class*="pin"], [class*="top"]').length > 0;

        items.push({
          id: `t66y-${tid}`,
          tid,
          title,
          url: detailUrl,
          author,
          praise,
          replyCount,
          lastPost,
          isPinned,
          images: [],
          cover: null,
          synced: false
        });
      } catch (err) {
        console.error('[T66Y-ListParser] 解析行失败:', err.message);
      }
    });

    const pagination = parsePagination($, url, page);
    console.log(`[T66Y-ListParser] 解析完成: ${items.length} 条, 共 ${pagination.total} 页`);

    return { items, pagination };
  } catch (error) {
    console.error('[T66Y-ListParser] 获取列表失败:', error);
    throw error;
  }
}

/**
 * 解析分页信息
 */
function parsePagination($, currentUrl, currentPage) {
  let maxPage = currentPage;

  $('a[href*="page="]').each((i, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/page=(\d+)/);
    if (m) {
      const p = parseInt(m[1]);
      if (p > maxPage) maxPage = p;
    }
  });

  const pageText = $('body').text();
  const totalMatch = pageText.match(/共\s*(\d+)\s*頁/) || pageText.match(/(\d+)\s*\/\s*(\d+)/);
  let total = totalMatch ? parseInt(totalMatch[1]) : maxPage;
  if (total < 1) total = 1;

  return {
    current: currentPage,
    total,
    hasNext: currentPage < total,
    hasPrev: currentPage > 1
  };
}

/**
 * 获取帖子详情（含图片 + 视频）
 * @param {string} detailUrl - 帖子详情URL
 * @param {number} maxImages - 最大图片数量
 */
async function getThreadDetail(detailUrl, maxImages = 12) {
  try {
    console.log(`[T66Y-DetailParser] 获取详情: ${detailUrl}`);
    const html = await httpGet(detailUrl);
    const $ = cheerio.load(html);

    // ===== 提取标题 =====
    const title = $('h1, .subject, #subject').first().text().trim() ||
                  $('title').text().replace(/\s*[-|]\s*(技術討論區|草榴社區)[^]*/, '').trim();

    // ===== 提取作者 =====
    const author = $('[class*="author"], [class*="poster"]').first().text().trim() ||
                   $('a[href*="profile.php"]').first().text().trim() || '';

    // ===== 提取发帖时间 =====
    const postTime = $('[class*="time"], [class*="date"]').first().text().trim() || '';

    // ===== 定位第一楼内容区域 =====
    // t66y 帖子正文通常在 id^="post_" 或 .tpc_content 内
    const firstPostSelectors = [
      '[id^="post_"]:first',
      '.tpc_content',
      '#postlist > div:first',
      '.content',
      '[class*="post-content"]'
    ];
    let $firstPost = $();
    for (const sel of firstPostSelectors) {
      $firstPost = $(sel).first();
      if ($firstPost.length > 0) break;
    }
    // 兜底：取第一个包含 img 或 video 的大块元素
    if ($firstPost.length === 0) {
      $firstPost = $('body');
    }

    // ===== 提取纯文字摘要 =====
    const content = $firstPost.text().trim().replace(/\s+/g, ' ').substring(0, 800);

    // ===== 提取图片 =====
    // t66y 使用自定义属性 ess-data 存储真实图片 URL（懒加载防屏蔽机制）
    const images = [];
    $firstPost.find('img').each((i, el) => {
      if (images.length >= maxImages) return false;

      const $img = $(el);
      // 优先读 ess-data（草榴主站专用属性），再尝试常见懒加载属性，最后才是 src
      let src = $img.attr('ess-data') ||
                $img.attr('data-ess') ||
                $img.attr('data-src') ||
                $img.attr('data-original') ||
                $img.attr('data-url') ||
                $img.attr('src') || '';

      if (!src) return;
      // 跳过广告占位图、头像/图标
      if (/avatar|icon|logo|smile|emoji/i.test(src)) return;
      if (src.includes('adblo_ck') || src === 'http://a.d/adblo_ck.jpg') return;
      // 补全URL
      src = resolveUrl(src);
      // 必须是图片格式或附件
      if (!/\.(jpg|jpeg|png|gif|webp|bmp)/i.test(src) && !src.includes('attach')) return;

      if (!images.includes(src)) images.push(src);
    });

    // ===== 提取视频 =====
    const videos = [];

    // 1. <video> 标签
    $firstPost.find('video').each((i, el) => {
      const $video = $(el);
      // src 属性
      const videoSrc = $video.attr('src') || $video.attr('data-src') || '';
      if (videoSrc && isVideoUrl(videoSrc)) {
        videos.push(resolveUrl(videoSrc));
      }
      // <source> 子标签
      $video.find('source').each((j, src) => {
        const s = $(src).attr('src') || '';
        if (s && isVideoUrl(s)) {
          const resolved = resolveUrl(s);
          if (!videos.includes(resolved)) videos.push(resolved);
        }
      });
    });

    // 2. DPlayer / data-xkrkllgl 属性（常见于草榴）
    $firstPost.find('[data-xkrkllgl]').each((i, el) => {
      const v = $(el).attr('data-xkrkllgl') || '';
      if (isVideoUrl(v) && !videos.includes(v)) videos.push(resolveUrl(v));
    });

    // 3. div.dplayer 的 data-src / data-url
    $firstPost.find('div.dplayer, [class*="dplayer"], [class*="player"]').each((i, el) => {
      const $el = $(el);
      ['data-src', 'data-url', 'data-video'].forEach(attr => {
        const v = $el.attr(attr) || '';
        if (isVideoUrl(v) && !videos.includes(v)) videos.push(resolveUrl(v));
      });
    });

    // 4. <a> 附件链接（.mp4/.m3u8）
    $firstPost.find('a[href]').each((i, el) => {
      const href = $(el).attr('href') || '';
      if (isVideoUrl(href)) {
        const resolved = resolveUrl(href);
        if (!videos.includes(resolved)) videos.push(resolved);
      }
    });

    // 5. 从 script/inline JS 中提取视频URL（data-player-src 等）
    $firstPost.find('script').each((i, el) => {
      const scriptText = $(el).html() || '';
      const urlMatches = scriptText.match(/["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*?)["']/gi) || [];
      urlMatches.forEach(m => {
        const url = m.replace(/^["']|["']$/g, '');
        if (!videos.includes(url)) videos.push(url);
      });
    });

    const has_video = videos.length > 0;

    // ===== 构建富文本 HTML =====
    // 保留第一楼的完整 HTML，用于后续替换图片/视频路径
    const content_html = $firstPost.length > 0 ? $firstPost.html() || '' : '';

    console.log(`[T66Y-DetailParser] 解析完成: 标题="${title}", 图片=${images.length}张, 视频=${videos.length}个`);

    return {
      title,
      author,
      postTime,
      content,
      content_html,
      images,
      videos,
      has_video,
      cover: images[0] || null
    };
  } catch (error) {
    console.error('[T66Y-DetailParser] 获取详情失败:', error);
    return {
      title: '',
      author: '',
      postTime: '',
      content: '',
      content_html: '',
      images: [],
      videos: [],
      has_video: false,
      cover: null
    };
  }
}

/**
 * 判断URL是否为视频
 */
function isVideoUrl(url) {
  if (!url) return false;
  return /\.(m3u8|mp4|webm|flv|mov|mkv)([\?#]|$)/i.test(url);
}

/**
 * 补全相对URL
 */
function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return BASE_URL + url;
  if (!url.startsWith('http')) return BASE_URL + '/' + url;
  return url;
}

module.exports = {
  getCategories,
  getThreadList,
  getThreadDetail,
  BASE_URL
};
