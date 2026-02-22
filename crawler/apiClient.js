/**
 * 同步API客户端
 * 负责与后端API通信：检查文章是否已存在、同步文章数据
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class ApiClient {
  constructor(config) {
    this.baseUrl = config.apiBaseUrl;
    this.apiToken = config.apiToken;
    this.authUuid = config.authUuid; // X-AUTH-UUID
    this.crawlerToken = config.crawlerToken; // X-CRAWLER-TOKEN
    this.timeout = config.requestTimeout || 60000;
  }
  
  /**
   * HTTP POST请求
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
      
      // 优先使用 crawlerToken（必需），如果没有则使用 authUuid 作为 token
      const tokenToUse = this.crawlerToken || this.authUuid;
      
      if (tokenToUse) {
        // 设置 X-CRAWLER-TOKEN（中间件必需）
        requestHeaders['X-CRAWLER-TOKEN'] = tokenToUse;
        // 同时设置 Authorization: Bearer（中间件支持两种方式）
        requestHeaders['Authorization'] = `Bearer ${tokenToUse}`;
      }
      
      // 设置 X-AUTH-UUID（可选，但建议设置）
      if (this.authUuid) {
        requestHeaders['X-AUTH-UUID'] = this.authUuid;
      }
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: requestHeaders,
        timeout: this.timeout
      };
      
      console.log(`[ApiClient] HTTP请求详情:`);
      console.log(`  - 方法: ${options.method}`);
      console.log(`  - URL: ${url}`);
      console.log(`  - Hostname: ${options.hostname}`);
      console.log(`  - Port: ${options.port}`);
      console.log(`  - Path: ${options.path}`);
      console.log(`  - 请求头:`, JSON.stringify(requestHeaders, null, 2));
      console.log(`  - Body长度: ${body.length} bytes`);
      
      console.log(`[ApiClient] 📡 创建HTTP请求对象...`);
      
      // 先定义 timeoutId，确保在所有回调中都能访问
      let timeoutId = null;
      
      const req = protocol.request(options, (res) => {
        console.log(`[ApiClient] ✅ 收到响应: HTTP ${res.statusCode}`);
        console.log(`[ApiClient] 响应头:`, JSON.stringify(res.headers, null, 2));
        
        let responseData = '';
        let chunkCount = 0;
        
        res.on('data', (chunk) => {
          chunkCount++;
          responseData += chunk;
          if (chunkCount % 10 === 0) {
            console.log(`[ApiClient]   已接收 ${chunkCount} 个数据块，当前数据长度: ${responseData.length} bytes`);
          }
        });
        
        res.on('end', () => {
          if (timeoutId) clearTimeout(timeoutId);
          console.log(`[ApiClient] ✅ 响应接收完成`);
          console.log(`[ApiClient]   总数据块数: ${chunkCount}`);
          console.log(`[ApiClient]   数据长度: ${responseData.length} bytes`);
          if (responseData.length < 1000) {
            console.log(`[ApiClient]   响应内容预览: ${responseData.substring(0, 500)}`);
          } else {
            console.log(`[ApiClient]   响应内容预览（前500字符）: ${responseData.substring(0, 500)}...`);
          }
          resolve({
            status: res.statusCode,
            data: responseData,
            headers: res.headers
          });
        });
        
        res.on('error', (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          console.error(`[ApiClient] ❌ 响应流错误:`, error);
          reject(error);
        });
      });
      
      // 添加额外的超时保护（使用 setTimeout，作为备用）
      timeoutId = setTimeout(() => {
        console.error(`[ApiClient] ❌ 请求超时（额外保护）: ${this.timeout}ms`);
        console.error(`[ApiClient] URL: ${url}`);
        req.destroy();
        reject(new Error(`请求超时: ${this.timeout}ms`));
      }, this.timeout);
      
      req.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        console.error(`[ApiClient] ❌ 请求错误:`, error);
        console.error(`[ApiClient] 错误类型:`, error.constructor.name);
        console.error(`[ApiClient] 错误消息:`, error.message);
        console.error(`[ApiClient] 错误堆栈:`, error.stack);
        reject(error);
      });
      
      req.on('timeout', () => {
        if (timeoutId) clearTimeout(timeoutId);
        console.error(`[ApiClient] ❌ 请求超时 (${this.timeout}ms)`);
        console.error(`[ApiClient] URL: ${url}`);
        req.destroy();
        reject(new Error('请求超时'));
      });
      
      console.log(`[ApiClient] 📤 开始发送请求数据...`);
      req.write(body);
      console.log(`[ApiClient] ✅ 请求数据已发送`);
      req.end();
      console.log(`[ApiClient] ✅ 请求已结束，等待响应...`);
    });
  }
  
  /**
   * 批量检查文章是否已同步
   * @param {Array<string>} articleIds - 文章ID列表
   * @returns {Promise<Object>} {article_id: {exists: true/false, post_id: xxx}}
   */
  async checkPostsExistsBatch(articleIds) {
    try {
      console.log(`\n========== [ApiClient] 批量检查文章状态 ==========`);
      console.log(`[ApiClient] 📍 开始执行 checkPostsExistsBatch`);
      console.log(`[ApiClient] 输入参数 articleIds:`, articleIds);
      
      const url = `${this.baseUrl}/api/crawler/post/exists-batch`;
      console.log(`[ApiClient] 构建URL: ${url}`);
      
      // 后端期望格式: {items: [{id: integer, title: string}]}
      const payload = {
        items: articleIds.map(id => ({
          id: parseInt(id) || 0,
          title: '' // 可选字段
        }))
      };
      
      console.log(`[ApiClient] 检查数量: ${articleIds.length} 条`);
      console.log(`[ApiClient] 请求数据:`, JSON.stringify(payload, null, 2));
      console.log(`[ApiClient] ⏳ 准备调用 httpPost...`);
      
      const response = await this.httpPost(url, payload);
      
      console.log(`[ApiClient] ✅ httpPost 调用完成`);
      console.log(`[ApiClient] HTTP状态码: ${response.status}`);
      console.log(`[ApiClient] 响应数据长度: ${response.data ? response.data.length : 0} bytes`);
      console.log(`[ApiClient] 响应数据:`, response.data);
      
      if (response.status === 200) {
        let result;
        try {
          result = JSON.parse(response.data);
        } catch (e) {
          console.error('[ApiClient] 响应解析失败');
          return null;
        }
        
        // 后端响应格式: {success: true, items: [{id: string, exists: bool, post_id: integer}]}
        if (result.success && result.items) {
          console.log(`[ApiClient] ✅ 检查完成`);
          // 转换为 {article_id: {exists: bool, post_id: xxx}} 格式
          const resultMap = {};
          result.items.forEach(item => {
            resultMap[String(item.id)] = {
              exists: item.exists || false,
              post_id: item.post_id || null
            };
          });
          return resultMap;
        } else {
          console.error(`[ApiClient] 检查失败: ${result.message || '未知错误'}`);
          return null;
        }
      } else {
        console.error(`[ApiClient] HTTP请求失败: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error(`[ApiClient] 检查异常: ${error.message}`);
      return null;
    }
  }
  
  /**
   * 同步文章数据
   * @param {Object} postData - 文章数据
   * @returns {Promise<Object>} {success: bool, post_id: xxx, message: xxx}
   */
  async syncPost(postData) {
    try {
      const url = `${this.baseUrl}/api/crawler/post/sync`;
      
      console.log(`\n========== [ApiClient] 开始同步文章 ==========`);
      console.log(`[ApiClient] URL: ${url}`);
      console.log(`[ApiClient] 标题: ${postData.title}`);
      console.log(`[ApiClient] source_id: ${postData.source_id}`);
      console.log(`[ApiClient] uid: ${postData.uid}`);
      console.log(`[ApiClient] cover_image: ${postData.cover_image || 'null'}`);
      console.log(`[ApiClient] has_video: ${postData.has_video}`);
      console.log(`[ApiClient] content长度: ${postData.content ? postData.content.length : 0}`);
      const tokenToUse = this.crawlerToken || this.authUuid;
      console.log(`[ApiClient] 请求头:`);
      console.log(`  - X-AUTH-UUID: ${this.authUuid || '未设置'}`);
      console.log(`  - X-CRAWLER-TOKEN: ${tokenToUse || '未设置'} (实际值: ${tokenToUse ? tokenToUse.substring(0, 20) + '...' : '无'})`);
      console.log(`  - Authorization: ${tokenToUse ? `Bearer ${tokenToUse.substring(0, 20)}...` : '未设置'}`);
      console.log(`[ApiClient] 完整请求数据:`, JSON.stringify(postData, null, 2));
      
      const response = await this.httpPost(url, postData);
      
      console.log(`[ApiClient] HTTP状态码: ${response.status}`);
      console.log(`[ApiClient] 响应头:`, JSON.stringify(response.headers, null, 2));
      console.log(`[ApiClient] 响应数据:`, response.data);
      
      // 尝试解析响应数据（无论状态码是什么）
      let result = null;
      try {
        result = JSON.parse(response.data);
        console.log(`[ApiClient] 解析后的响应:`, JSON.stringify(result, null, 2));
      } catch (e) {
        console.error(`[ApiClient] ❌ 响应解析失败:`, e.message);
        console.error(`[ApiClient] 原始响应数据:`, response.data);
      }
      
      if (response.status === 200) {
        // 后端响应格式: {success: true, message: '帖子同步成功', post_id: integer, is_new: bool}
        console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
        console.log(`║              API调用结果判断                                  ║`);
        console.log(`╚══════════════════════════════════════════════════════════════╝`);
        console.log(`[ApiClient] 响应success字段: ${result?.success}`);
        console.log(`[ApiClient] 响应message: ${result?.message || '无'}`);
        console.log(`[ApiClient] 响应post_id: ${result?.post_id || '无'}`);
        console.log(`[ApiClient] 响应is_new: ${result?.is_new || false}`);
        
        if (result && result.success) {
          console.log(`\n✅✅✅ API调用成功！数据已入库！✅✅✅`);
          console.log(`   - post_id: ${result.post_id}`);
          console.log(`   - is_new: ${result.is_new || false}`);
          console.log(`   - message: ${result.message || '同步成功'}`);
          console.log(`========== [ApiClient] 同步完成 ==========\n`);
          return {
            success: true,
            post_id: result.post_id,
            message: result.message || '同步成功',
            is_new: result.is_new || false
          };
        } else {
          console.log(`\n❌❌❌ API调用失败！数据未入库！❌❌❌`);
          console.error(`   - 错误信息: ${result?.message || '未知错误'}`);
          console.error(`   - 完整响应:`, JSON.stringify(result, null, 2));
          console.log(`========== [ApiClient] 同步失败 ==========\n`);
          return {
            success: false,
            message: result?.message || '同步失败'
          };
        }
      } else {
        // HTTP状态码不是200，尝试解析错误消息
        const errorMessage = result?.message || `HTTP ${response.status}`;
        console.error(`\n╔══════════════════════════════════════════════════════════════╗`);
        console.error(`║              API调用失败 (HTTP ${response.status})            ║`);
        console.error(`╚══════════════════════════════════════════════════════════════╝`);
        console.error(`[ApiClient] ❌ HTTP请求失败: ${response.status}`);
        console.error(`[ApiClient] 错误消息: ${errorMessage}`);
        console.error(`[ApiClient] 响应数据:`, response.data);
        if (result) {
          console.error(`[ApiClient] 解析后的错误响应:`, JSON.stringify(result, null, 2));
        }
        console.log(`========== [ApiClient] HTTP错误 ==========\n`);
        return {
          success: false,
          message: errorMessage
        };
      }
    } catch (error) {
      console.error(`[ApiClient] ❌ 同步异常:`, error);
      console.error(`[ApiClient] 错误堆栈:`, error.stack);
      console.log(`========== [ApiClient] 异常结束 ==========\n`);
      return {
        success: false,
        message: error.message
      };
    }
  }
  
  /**
   * 处理标签列表：清理、去重、验证
   */
  processTags(tags, addDefaultIfEmpty = true) {
    const defaultTags = ['天涯吃瓜'];
    const invalidTags = new Set(['网黄合集', '', null, undefined]);
    
    if (!tags || tags.length === 0) {
      return addDefaultIfEmpty ? defaultTags : [];
    }
    
    const processedTags = [];
    const seenTags = new Set();
    
    for (const tag of tags) {
      if (!tag) continue;
      
      let tagStr = String(tag).trim();
      
      if (tagStr.startsWith('#')) {
        tagStr = tagStr.substring(1).trim();
      }
      
      if (!tagStr || invalidTags.has(tagStr)) {
        continue;
      }
      
      if (tagStr.length > 50) {
        tagStr = tagStr.substring(0, 50);
      }
      
      const tagLower = tagStr.toLowerCase();
      if (!seenTags.has(tagLower)) {
        seenTags.add(tagLower);
        processedTags.push(tagStr);
      }
    }
    
    if (processedTags.length === 0 && addDefaultIfEmpty) {
      return defaultTags;
    }
    
    return processedTags;
  }
  
  /**
   * 生成视频播放器HTML
   */
  generateVideoPlayerHtml(videoUrl, posterUrl = '', videoData = {}) {
    const escapeHtml = (text) => {
      if (text == null) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    
    let mimeType = 'video/mp4';
    if (videoUrl.toLowerCase().includes('.m3u8')) {
      mimeType = 'application/x-mpegURL';
    }
    
    const htmlParts = ['<video controls="controls" width="100%"'];
    
    if (videoData.video_id) htmlParts.push(` data-video-id="${escapeHtml(videoData.video_id)}"`);
    if (posterUrl) htmlParts.push(` poster="${escapeHtml(posterUrl)}"`);
    
    htmlParts.push(' style="max-width: 600px; display: block; margin: 10px 0px; width: 100%;"');
    htmlParts.push('>');
    htmlParts.push(`<source src="${escapeHtml(videoUrl)}" type="${mimeType}">`);
    htmlParts.push('</video>');
    
    return htmlParts.join('');
  }
  
  /**
   * 生成富文本内容（替换视频和图片为相对路径，匹配数据库格式）
   * @param {string} contentHtml - 原始HTML内容
   * @param {string} videoResourceKey - 视频R2资源key（M3U8或MP4）
   * @param {Object} imageMapping - 图片URL映射 {原始URL: R2资源key（已包含uploads/前缀）}
   * @param {string} r2PreviewDomain - R2预览域名（不再使用，改为相对路径）
   * @param {string} coverImageResourceKey - 封面图R2资源key（用于video的poster属性）
   * @returns {string} 处理后的HTML内容
   */
  generateRichTextContent(contentHtml, videoResourceKeys, imageMapping, r2PreviewDomain, coverImageResourceKey = null) {
    if (!contentHtml) return '';
    
    console.log(`[ApiClient] ===== generateRichTextContent 开始 =====`);
    console.log(`[ApiClient] contentHtml长度: ${contentHtml.length}`);
    console.log(`[ApiClient] contentHtml前500字符:`, contentHtml.substring(0, 500));
    console.log(`[ApiClient] videoResourceKeys数量: ${videoResourceKeys ? videoResourceKeys.length : 0}`);
    console.log(`[ApiClient] videoResourceKeys:`, videoResourceKeys);
    console.log(`[ApiClient] coverImageResourceKey: ${coverImageResourceKey || 'null'}`);
    
    const cheerio = require('cheerio');
    const $ = cheerio.load(contentHtml);
    
    console.log(`[ApiClient] cheerio加载完成`);
    console.log(`[ApiClient] HTML中找到 ${$('div.dplayer').length} 个 div.dplayer`);
    console.log(`[ApiClient] HTML中找到 ${$('video').length} 个 video标签`);
    
    // 替换视频（支持多视频）
    if (videoResourceKeys && videoResourceKeys.length > 0) {
      console.log(`[ApiClient] ===== 开始替换视频（共${videoResourceKeys.length}个） =====`);
      
      let videoIndex = 0; // 当前处理的视频索引
      
      // 先处理所有 div.dplayer
      $('div.dplayer').each((i, div) => {
        if (videoIndex < videoResourceKeys.length) {
          const videoData = videoResourceKeys[videoIndex];
          
          if (videoData && videoData.resource_key) {
            const videoRelativePath = videoData.resource_key;
            const isM3U8 = videoRelativePath.includes('.m3u8');
            const mimeType = isM3U8 ? 'application/x-mpegURL' : 'video/mp4';
            
            // 使用视频自己的poster，或使用coverImageResourceKey（如果只有一个视频）
            let posterAttr = '';
            if (videoData.poster) {
              posterAttr = ` poster="${videoData.poster}"`;
            } else if (videoResourceKeys.length === 1 && coverImageResourceKey) {
              posterAttr = ` poster="${coverImageResourceKey}"`;
            }
            
            const videoHtml = `<video controls="controls" contenteditable="false" data-hls-src="${videoRelativePath}" src="${videoRelativePath}"${posterAttr} style="max-width: 400px; width: auto; height: auto; display: block; margin: 4px 0px; cursor: pointer; border-radius: 4px; transition: box-shadow 0.2s; object-fit: contain; box-shadow: none;">
<source src="${videoRelativePath}" type="${mimeType}">
</video>`;
            
            console.log(`[ApiClient] 替换dplayer ${i + 1} -> 视频${videoIndex + 1}: ${videoRelativePath}`);
            $(div).replaceWith(videoHtml);
          } else {
            console.log(`[ApiClient] ⚠️  dplayer ${i + 1} 对应的视频${videoIndex + 1}处理失败，跳过`);
          }
          
          videoIndex++;
        } else {
          console.log(`[ApiClient] ⚠️  dplayer ${i + 1} 没有对应的视频，移除`);
          $(div).remove();
        }
      });
      
      // 再处理现有的 video 标签（如果还有剩余的视频）
      $('video').each((i, video) => {
        if (videoIndex < videoResourceKeys.length) {
          const videoData = videoResourceKeys[videoIndex];
          
          if (videoData && videoData.resource_key) {
            const videoRelativePath = videoData.resource_key;
            const isM3U8 = videoRelativePath.includes('.m3u8');
            const mimeType = isM3U8 ? 'application/x-mpegURL' : 'video/mp4';
            
            let posterAttr = '';
            if (videoData.poster) {
              posterAttr = ` poster="${videoData.poster}"`;
            } else if (videoResourceKeys.length === 1 && coverImageResourceKey) {
              posterAttr = ` poster="${coverImageResourceKey}"`;
            }
            
            const videoHtml = `<video controls="controls" contenteditable="false" data-hls-src="${videoRelativePath}" src="${videoRelativePath}"${posterAttr} style="max-width: 400px; width: auto; height: auto; display: block; margin: 4px 0px; cursor: pointer; border-radius: 4px; transition: box-shadow 0.2s; object-fit: contain; box-shadow: none;">
<source src="${videoRelativePath}" type="${mimeType}">
</video>`;
            
            console.log(`[ApiClient] 替换video标签 ${i + 1} -> 视频${videoIndex + 1}: ${videoRelativePath}`);
            $(video).replaceWith(videoHtml);
            videoIndex++;
          }
        }
      });
      
      console.log(`[ApiClient] ===== 视频替换完成，共替换${videoIndex}个视频 =====`);
    } else {
      console.log(`[ApiClient] ⚠️  videoResourceKeys 为空，跳过视频替换`);
    }
    
    // 替换图片（参考51吃瓜桌面版的工作逻辑）
    if (imageMapping && Object.keys(imageMapping).length > 0) {
      console.log(`[ApiClient] ===== 开始替换图片 =====`);
      console.log(`[ApiClient] 图片映射表:`, JSON.stringify(imageMapping, null, 2));
      
      $('img').each((i, img) => {
        const $img = $(img);
        let originalUrl = $img.attr('data-xkrkllgl') || $img.attr('src') || $img.attr('data-src');
        
        if (originalUrl) {
          // 构建完整的原始URL（参考51吃瓜桌面版）
          if (!originalUrl.startsWith('http')) {
            try {
              originalUrl = new URL(originalUrl, 'https://51cg1.com').href;
            } catch (e) {
              console.log(`[ApiClient] URL构建失败: ${originalUrl}`);
            }
          }
          
          console.log(`[ApiClient] 图片${i + 1}: 原始URL=${originalUrl.substring(0, 80)}...`);
          
          // 查找对应的R2资源键
          let r2Key = imageMapping[originalUrl];
          
          // 尝试匹配（去掉query参数）
          if (!r2Key && originalUrl.includes('?')) {
            const baseUrlWithoutQuery = originalUrl.split('?')[0];
            r2Key = imageMapping[baseUrlWithoutQuery];
            if (r2Key) {
              console.log(`[ApiClient] 通过去除query参数匹配成功`);
            }
          }
          
          // 尝试匹配（只匹配文件名）
          if (!r2Key) {
            const filename = originalUrl.split('/').pop().split('?')[0];
            for (const [origUrl, mappedKey] of Object.entries(imageMapping)) {
              if (origUrl.includes(filename)) {
                r2Key = mappedKey;
                console.log(`[ApiClient] 通过文件名匹配成功: ${filename}`);
                break;
              }
            }
          }
          
          if (r2Key) {
            console.log(`[ApiClient] ✅ 找到映射: ${r2Key}`);
            // 直接使用R2的resource_key（相对路径）
            $img.attr('src', r2Key);
            // 添加模板要求的属性
            $img.attr('draggable', 'true');
            $img.attr('style', 'cursor: grab;');
            $img.removeAttr('data-src');
            $img.removeAttr('data-xkrkllgl');
            $img.removeAttr('data-original');
            $img.removeAttr('data-xuid');
            $img.removeAttr('alt');
            $img.removeAttr('title');
          } else {
            console.log(`[ApiClient] ⚠️  未找到映射`);
          }
        }
      });
      
      console.log(`[ApiClient] ===== 图片替换完成 =====`);
    }
    
    // 规范化HTML结构：移除嵌套的 <p> 标签，确保格式正确
    // 1. 递归移除所有嵌套的 <p> 标签
    while ($('p p').length > 0) {
      $('p p').each((i, nestedP) => {
        const $nestedP = $(nestedP);
        // 用内容替换嵌套的p标签（不保留p标签本身）
        $nestedP.replaceWith($nestedP.html());
      });
    }
    
    // 2. 确保所有img、video标签都在p标签内
    $('img').each((i, img) => {
      const $img = $(img);
      if (!$img.parent('p').length) {
        $img.wrap('<p></p>');
      }
    });
    
    // 3. 在每个包含img的p标签后添加 <p><br></p>
    $('p:has(img)').each((i, p) => {
      const $p = $(p);
      const $next = $p.next();
      // 如果下一个元素不是 <p><br></p>，添加它
      if (!$next.length || $next.html() !== '<br>') {
        $p.after('<p><br></p>');
      }
    });
    
    // 4. 在video标签后添加 <p><br></p>
    $('video').each((i, video) => {
      const $video = $(video);
      const $next = $video.next();
      // 如果下一个元素不是 <p><br></p>，添加它
      if (!$next.length || $next.html() !== '<br>') {
        $video.after('<p><br></p>');
      }
    });
    
    // 5. 移除连续的 <p><br></p>
    $('p').each((i, p) => {
      const $p = $(p);
      if ($p.html() === '<br>') {
        const $next = $p.next();
        if ($next.length && $next.html() === '<br>') {
          $next.remove();
        }
      }
    });
    
    // 6. 移除空的p标签（除了 <p><br></p>）
    $('p').each((i, p) => {
      const $p = $(p);
      const html = $p.html();
      if (html && html.trim() === '' && !$p.find('br').length) {
        $p.remove();
      }
    });
    
    const finalHtml = $('body').html() || '';
    
    console.log(`[ApiClient] ===== generateRichTextContent 完成 =====`);
    console.log(`[ApiClient] 最终HTML长度: ${finalHtml.length}`);
    console.log(`[ApiClient] 最终HTML中video标签数量: ${(finalHtml.match(/<video/g) || []).length}`);
    console.log(`[ApiClient] 最终HTML前1000字符:`, finalHtml.substring(0, 1000));
    
    return finalHtml;
  }
}

module.exports = ApiClient;
