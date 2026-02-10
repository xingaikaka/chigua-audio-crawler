/**
 * UAA 数据映射工具
 * 用于转换原站数据格式为 API 所需格式
 */

/**
 * 解析状态文本
 * @param {string} statusText - 如 "连载中"、"已完结"、"更新至第26集"
 * @returns {number} 0=连载中, 1=已完结
 */
function parseStatus(statusText) {
  if (!statusText) return 0;
  
  const text = String(statusText).toLowerCase();
  
  if (text.includes('完结') || text.includes('完本') || text.includes('已完成')) {
    return 1;
  }
  
  return 0;
}

/**
 * 解析数量文本
 * @param {string} countText - 如 "42K"、"1.5M"、"999"
 * @returns {number} 解析后的数字
 */
function parseCount(countText) {
  if (!countText) return 0;
  
  const text = String(countText).trim();
  
  // 移除非数字和单位之外的字符
  const cleanText = text.replace(/[^0-9.KMW]/gi, '');
  
  if (cleanText.includes('W') || cleanText.includes('w')) {
    return Math.round(parseFloat(cleanText) * 10000);
  }
  
  if (cleanText.includes('M') || cleanText.includes('m')) {
    return Math.round(parseFloat(cleanText) * 1000000);
  }
  
  if (cleanText.includes('K') || cleanText.includes('k')) {
    return Math.round(parseFloat(cleanText) * 1000);
  }
  
  return parseInt(cleanText) || 0;
}

/**
 * 解析评分
 * @param {string|number} ratingText - 如 "9.5分"、"9.5"、"暂无评分"
 * @returns {number} 评分数值，0-10
 */
function parseRating(ratingText) {
  if (!ratingText) return 0;
  
  const text = String(ratingText);
  
  if (text.includes('暂无') || text.includes('无评分')) {
    return 0;
  }
  
  const match = text.match(/([\d.]+)/);
  if (match) {
    const rating = parseFloat(match[1]);
    return Math.min(10, Math.max(0, rating));
  }
  
  return 0;
}

/**
 * 生成 R2 路径日期前缀
 * @returns {string} 如 "202602/08"
 */
function generateDatePrefix() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  return `${year}${month}/${day}`;
}

/**
 * 生成封面 R2 路径
 * @param {string} audioId - 音频ID
 * @param {string} originalUrl - 原始封面URL
 * @returns {string} R2路径，如 "audio-novels/202602/08/97/cover.jpg"
 */
function generateCoverPath(audioId, originalUrl) {
  const datePrefix = generateDatePrefix();
  
  // 提取文件扩展名
  let ext = 'jpg';
  if (originalUrl) {
    const urlMatch = originalUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i);
    if (urlMatch) {
      ext = urlMatch[1].toLowerCase();
    }
  }
  
  return `audio-novels/${datePrefix}/${audioId}/cover.${ext}`;
}

/**
 * 生成章节音频 R2 路径
 * @param {string} audioId - 音频ID
 * @param {number} chapterNum - 章节序号
 * @returns {string} R2路径，如 "audio-novels/202602/08/97/chapter_001.mp3"
 */
function generateChapterPath(audioId, chapterNum) {
  const datePrefix = generateDatePrefix();
  const chapterNumStr = String(chapterNum).padStart(3, '0');
  
  return `audio-novels/${datePrefix}/${audioId}/chapter_${chapterNumStr}.mp3`;
}

/**
 * 映射小说数据到 API 格式
 * @param {Object} audioData - 原站音频数据
 * @param {string} coverR2Path - 封面 R2 路径
 * @param {number} categoryId - 服务端分类ID
 * @param {string} categorySourceId - 原站分类ID（用于区分不同题材）
 * @returns {Object} API 所需的数据格式
 */
function mapAudioNovelData(audioData, coverR2Path, categoryId = null, categorySourceId = null) {
  return {
    source_id: String(audioData.article_id || audioData.id),
    platform_id: null, // 按用户要求设置为 NULL
    title: (audioData.title || '未知标题').substring(0, 255),
    description: (audioData.description || '').substring(0, 1000),
    author: audioData.cv || audioData.author || '未知',
    cover_image: coverR2Path,
    category_id: categoryId,
    category_source_id: categorySourceId, // ✅ 使用传入的分类source_id
    category_name: audioData.category || '有声小说',
    status: parseStatus(audioData.status),
    read_count: parseCount(audioData.listenCount),
    likes_count: parseCount(audioData.likeCount),
    favorite_count: parseCount(audioData.collectCount),
    average_rating: parseRating(audioData.rating),
    chapter_count: audioData.episodeCount || 0,
    is_active: true
  };
}

/**
 * 映射章节数据到 API 格式
 * @param {number} novelId - 小说ID
 * @param {Object} episode - 章节数据
 * @param {number} chapterNum - 章节序号
 * @param {string} audioR2Path - 音频 R2 路径
 * @returns {Object} API 所需的章节数据格式
 */
function mapChapterData(novelId, episode, chapterNum, audioR2Path) {
  return {
    novel_id: novelId,
    source_id: String(episode.id || episode.index || chapterNum),
    title: (episode.title || `第${chapterNum}章`).substring(0, 255),
    chapter_num: chapterNum,
    audio_url: audioR2Path,
    contents: episode.contents || '',
    duration: episode.duration || 0,
    is_free: episode.is_free !== false,
    is_active: true
  };
}

/**
 * 提取音频 ID
 * @param {string} url - 音频详情URL
 * @returns {string|null} 音频ID
 */
function extractAudioId(url) {
  if (!url) return null;
  
  // 匹配 /audio/intro?id=123
  const match1 = url.match(/\/audio\/intro\?id=(\d+)/);
  if (match1) return match1[1];
  
  // 匹配 /audio/123
  const match2 = url.match(/\/audio\/(\d+)/);
  if (match2) return match2[1];
  
  return null;
}

module.exports = {
  parseStatus,
  parseCount,
  parseRating,
  generateDatePrefix,
  generateCoverPath,
  generateChapterPath,
  mapAudioNovelData,
  mapChapterData,
  extractAudioId
};
