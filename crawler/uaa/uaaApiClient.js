/**
 * UAA 有声小说 API 客户端
 * 负责调用后端有声小说同步接口
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class UaaApiClient {
  constructor(config) {
    this.baseUrl = config.apiBaseUrl;
    this.crawlerToken = config.crawlerToken;
    this.authUuid = config.authUuid;
    this.timeout = config.requestTimeout || 60000;
    
    // 转换 API 路径
    this.apiBasePath = this.convertToAudioNovelPath(this.baseUrl);
  }
  
  /**
   * 转换为有声小说 API 路径
   */
  convertToAudioNovelPath(baseUrl) {
    // 如果包含 /api/video/sync-video，替换为 /api/crawler/audio-novel
    if (baseUrl.includes('/api/video/sync-video')) {
      return baseUrl.replace('/api/video/sync-video', '/api/crawler/audio-novel');
    }
    
    // 如果包含 /api/cg51，替换为 /api/crawler/audio-novel
    if (baseUrl.includes('/api/cg51')) {
      return baseUrl.replace(/\/api\/cg51.*$/, '/api/crawler/audio-novel');
    }
    
    // 否则直接追加
    const url = baseUrl.replace(/\/$/, '');
    if (url.includes('/api/')) {
      return url.replace(/\/api\/.*$/, '/api/crawler/audio-novel');
    }
    
    return `${url}/api/crawler/audio-novel`;
  }
  
  /**
   * HTTP POST 请求
   */
  httpPost(url, data, headers = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;
      
      const body = JSON.stringify(data);
      
      const requestHeaders = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ...headers
      };
      
      // 设置认证 Token
      const tokenToUse = this.crawlerToken || this.authUuid;
      if (tokenToUse) {
        requestHeaders['X-CRAWLER-TOKEN'] = tokenToUse;
        requestHeaders['Authorization'] = `Bearer ${tokenToUse}`;
      }
      
      if (this.authUuid) {
        requestHeaders['X-AUTH-UUID'] = this.authUuid;
      }
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: requestHeaders,
        timeout: this.timeout
      };
      
      const req = protocol.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(result);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${result.message || responseData}`));
            }
          } catch (error) {
            reject(new Error(`解析响应失败: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`请求失败: ${error.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      
      req.write(body);
      req.end();
    });
  }
  
  /**
   * 1. 同步分类
   * POST /api/crawler/audio-novel/categories/sync
   */
  async syncCategories(items, platformId = null) {
    try {
      const url = `${this.apiBasePath}/categories/sync`;
      
      console.log(`[UaaApiClient] 同步分类: ${items.length} 个分类`);
      console.log(`[UaaApiClient] URL: ${url}`);
      
      const payload = {
        platform_id: platformId,
        items: items.map(item => ({
          id: String(item.id),
          name: item.name,
          sort_order: item.sort_order || 0
        }))
      };
      
      const result = await this.httpPost(url, payload);
      
      if (result.success) {
        console.log(`[UaaApiClient] 分类同步成功: ${result.items.length} 个分类`);
        
        // 构建分类映射表 { sourceId: categoryId }
        const categoryMap = {};
        result.items.forEach(item => {
          categoryMap[item.id] = item.category_id;
        });
        
        return {
          success: true,
          categoryMap: categoryMap,
          items: result.items
        };
      } else {
        throw new Error(result.message || '分类同步失败');
      }
    } catch (error) {
      console.error(`[UaaApiClient] 同步分类失败:`, error);
      throw error;
    }
  }
  
  /**
   * 2. 批量检查有声小说是否已同步
   * POST /api/crawler/audio-novel/exists-batch
   */
  async checkAudioNovelsExistsBatch(items, platformId = null) {
    try {
      const url = `${this.apiBasePath}/exists-batch`;
      
      console.log(`\n========== [UaaApiClient] 批量检查同步状态 ==========`);
      console.log(`[UaaApiClient] 小说数量: ${items.length}`);
      console.log(`[UaaApiClient] URL: ${url}`);
      
      const payload = {
        items: items.map(item => ({
          id: String(item.id || item.article_id),
          title: item.title,
          crawl_source_id: platformId
        }))
      };
      
      console.log(`[UaaApiClient] 请求数据 (前5条):`);
      payload.items.slice(0, 5).forEach((item, index) => {
        console.log(`  ${index + 1}. id="${item.id}", title="${item.title}"`);
      });
      
      console.log(`[UaaApiClient] 发送请求...`);
      const result = await this.httpPost(url, payload);
      
      if (result.success) {
        console.log(`[UaaApiClient] ✓ 检查完成: ${result.items.length} 个结果`);
        
        // 输出已同步的数据
        const syncedItems = result.items.filter(item => item.exists);
        console.log(`[UaaApiClient] 已同步数量: ${syncedItems.length}`);
        if (syncedItems.length > 0) {
          console.log(`[UaaApiClient] 已同步的数据 (前5条):`);
          syncedItems.slice(0, 5).forEach((item, index) => {
            console.log(`  ${index + 1}. id="${item.id}", novel_id=${item.novel_id}, title="${item.title || ''}"`);
          });
        }
        console.log(`========== [UaaApiClient] 检查完成 ==========\n`);
        
        // 构建结果映射表 { sourceId: { exists, novel_id } }
        const resultsMap = {};
        result.items.forEach(item => {
          resultsMap[item.id] = {
            exists: item.exists,
            novel_id: item.novel_id || null
          };
        });
        
        return resultsMap;
      } else {
        throw new Error(result.message || '批量检查失败');
      }
    } catch (error) {
      console.error(`[UaaApiClient] 批量检查失败:`, error);
      throw error;
    }
  }
  
  /**
   * 3. 同步有声小说
   * POST /api/crawler/audio-novel/sync
   */
  async syncAudioNovel(novelData) {
    try {
      const url = `${this.apiBasePath}/sync`;
      
      console.log(`\n========== [UaaApiClient] 开始同步有声小说 ==========`);
      console.log(`[UaaApiClient] URL: ${url}`);
      console.log(`[UaaApiClient] 标题: ${novelData.title}`);
      console.log(`[UaaApiClient] source_id: ${novelData.source_id}`);
      console.log(`[UaaApiClient] 章节数: ${novelData.chapter_count}`);
      
      const payload = {
        source_id: String(novelData.source_id),
        platform_id: novelData.platform_id || null,
        title: novelData.title,
        description: novelData.description || '',
        author: novelData.author || '',
        cover_image: novelData.cover_image || null,
        category_id: novelData.category_id || null,
        category_source_id: novelData.category_source_id || null,
        category_name: novelData.category_name || '',
        status: novelData.status || 0,
        read_count: novelData.read_count || 0,
        likes_count: novelData.likes_count || 0,
        favorite_count: novelData.favorite_count || 0,
        average_rating: novelData.average_rating || 0,
        chapter_count: novelData.chapter_count || 0,
        is_active: novelData.is_active !== false
      };
      
      console.log(`[UaaApiClient] 请求数据:`, JSON.stringify(payload, null, 2));
      
      const result = await this.httpPost(url, payload);
      
      if (result.success) {
        console.log(`[UaaApiClient] 小说同步成功: novel_id=${result.novel_id}, is_new=${result.is_new}`);
        return {
          success: true,
          novel_id: result.novel_id,
          is_new: result.is_new,
          message: result.message
        };
      } else {
        throw new Error(result.message || '小说同步失败');
      }
    } catch (error) {
      console.error(`[UaaApiClient] 同步小说失败:`, error);
      throw error;
    }
  }
  
  /**
   * 4. 同步章节
   * POST /api/crawler/audio-novel/chapter/sync
   */
  async syncAudioChapter(chapterData) {
    try {
      const url = `${this.apiBasePath}/chapter/sync`;
      
      const payload = {
        novel_id: chapterData.novel_id,
        source_id: String(chapterData.source_id),
        title: chapterData.title,
        chapter_num: chapterData.chapter_num,
        audio_url: chapterData.audio_url,
        contents: chapterData.contents || '',
        duration: chapterData.duration || 0,
        is_free: chapterData.is_free !== false,
        is_active: chapterData.is_active !== false
      };
      
      const result = await this.httpPost(url, payload);
      
      if (result.success) {
        return {
          success: true,
          chapter_id: result.chapter_id,
          is_new: result.is_new,
          message: result.message
        };
      } else {
        throw new Error(result.message || '章节同步失败');
      }
    } catch (error) {
      console.error(`[UaaApiClient] 同步章节失败 [${chapterData.title}]:`, error);
      throw error;
    }
  }
}

module.exports = UaaApiClient;
