/**
 * M3U8处理器模块
 * 下载M3U8和所有TS文件，上传到R2，修改M3U8内容指向R2
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class M3U8Processor {
  constructor(r2Uploader, articleId, maxWorkers = 5, subDir = null) {
    this.r2Uploader = r2Uploader;
    this.articleId = articleId;
    this.maxWorkers = maxWorkers;
    this.timeout = 30000;
    
    // 如果提供了subDir，使用简单路径：videos/{articleId}/{subDir}/
    // 否则使用原来的逻辑：videos/YYYYMM/DD/{articleId}/{随机字符串}/
    if (subDir) {
      this.videoBaseDir = `videos/${articleId}`;
      this.subfolder = subDir;
    } else {
      // 生成视频路径的基础目录（格式：videos/YYYYMM/DD/article_id）
      // 正确格式：videos/202602/06/6985b397cd9fd09939085942
      this.videoBaseDir = this.generateVideoBaseDir(articleId);
      // 生成子文件夹名称（6位随机字符串，如 b6bgf9）
      this.subfolder = Math.random().toString(36).substring(2, 8);
    }
    
    console.log(`[M3U8Processor] 初始化: articleId=${articleId}, subDir=${subDir || '自动生成'}`);
    console.log(`[M3U8Processor] videoBaseDir=${this.videoBaseDir}, subfolder=${this.subfolder}`);
  }
  
  /**
   * 生成视频路径的基础目录
   * 格式：videos/YYYYMM/DD/article_id
   * 例如：videos/202602/06/6985b397cd9fd09939085942
   */
  generateVideoBaseDir(articleId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // 格式：videos/202602/06/article_id
    return `videos/${year}${month}/${day}/${articleId}`;
  }
  
  /**
   * 生成视频文件的完整路径
   * 格式：videos/YYYYMM/DD/article_id/subfolder/index.m3u8
   */
  getVideoPath(filename) {
    return `${this.videoBaseDir}/${this.subfolder}/${filename}`;
  }
  
  /**
   * 生成封面图片的路径
   * 格式：videos/YYYYMM/DD/article_id/cover.jpg
   */
  getCoverPath() {
    return `${this.videoBaseDir}/cover.jpg`;
  }
  
  /**
   * HTTP GET请求
   */
  httpGet(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;
      
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': '*/*',
          'Referer': `${urlObj.protocol}//${urlObj.hostname}/`,
          ...options.headers
        },
        timeout: this.timeout,
        rejectUnauthorized: false // 禁用SSL证书验证（允许自签名证书）
      };
      
      const req = protocol.request(requestOptions, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      
      req.end();
    });
  }
  
  /**
   * 下载并解析M3U8文件
   * @param {string} m3u8Url - M3U8文件URL
   * @returns {Promise<Object|null>} 解析结果
   */
  async downloadAndParseM3U8(m3u8Url) {
    try {
      console.log(`   [M3U8] 下载M3U8文件: ${m3u8Url.substring(0, 80)}...`);
      const buffer = await this.httpGet(m3u8Url);
      
      const m3u8Content = buffer.toString('utf8');
      const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
      
      const lines = m3u8Content.trim().split('\n');
      const tags = [];
      const tsUrls = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        if (trimmed.startsWith('#')) {
          tags.push(trimmed);
        } else {
          if (trimmed.includes('.ts') || trimmed.includes('.ts?')) {
            let tsUrl = trimmed;
            if (!tsUrl.startsWith('http')) {
              tsUrl = new URL(tsUrl, baseUrl).href;
            }
            tsUrls.push(tsUrl);
          }
        }
      }
      
      console.log(`   [M3U8] 解析成功: 找到 ${tsUrls.length} 个TS文件`);
      
      return {
        content: m3u8Content,
        base_url: baseUrl,
        ts_urls: tsUrls,
        tags: tags
      };
    } catch (error) {
      console.error(`   [M3U8] 下载/解析失败: ${error.message}`);
      return null;
    }
  }
  
  /**
   * 下载单个TS文件
   */
  async downloadTsFile(tsUrl, index) {
    try {
      console.log(`   [M3U8] 📥 下载TS文件 [${index}]: ${tsUrl.substring(0, 80)}...`);
      const buffer = await this.httpGet(tsUrl);
      console.log(`   [M3U8] ✅ TS文件下载成功 [${index}], 大小: ${(buffer.length / 1024).toFixed(2)} KB`);
      return { index, data: buffer };
    } catch (error) {
      console.error(`   [M3U8] ❌ TS文件下载失败 [${index}]: ${error.message}`);
      console.error(`   [M3U8]   错误堆栈:`, error.stack);
      return null;
    }
  }
  
  /**
   * 并发下载所有TS文件
   */
  async downloadAllTsFiles(tsUrls, progressCallback = null) {
    const tsFiles = {};
    const failedIndices = [];
    const maxRetries = 3;
    const total = tsUrls.length;
    
    console.log(`   [M3U8] 开始下载 ${total} 个TS文件（并发数: ${this.maxWorkers}）...`);
    
    // 分批下载
    for (let i = 0; i < tsUrls.length; i += this.maxWorkers) {
      const batch = tsUrls.slice(i, i + this.maxWorkers);
      const batchPromises = batch.map((tsUrl, batchIndex) => 
        this.downloadTsFile(tsUrl, i + batchIndex)
      );
      
      const results = await Promise.allSettled(batchPromises);
      
      results.forEach((result, batchIndex) => {
        const index = i + batchIndex;
        if (result.status === 'fulfilled' && result.value && result.value.data) {
          const { data } = result.value;
          if (data && data.length > 0) {
            tsFiles[index] = data;
            console.log(`   [M3U8] ✅ TS文件 [${index}] 下载完成，大小: ${(data.length / 1024).toFixed(2)} KB`);
          } else {
            console.error(`   [M3U8] ❌ TS文件 [${index}] 数据为空`);
            failedIndices.push(index);
          }
        } else {
          console.error(`   [M3U8] ❌ TS文件 [${index}] 下载失败:`, result.reason?.message || '未知错误');
          failedIndices.push(index);
        }
      });
      
      // 更新进度
      if (progressCallback) {
        const downloaded = Object.keys(tsFiles).length;
        console.log(`   [M3U8] 调用progressCallback - downloading_ts: ${downloaded}/${total}`);
        progressCallback('downloading_ts', downloaded, total);
      } else {
        console.log(`   [M3U8] ⚠️  progressCallback未定义，无法更新下载进度`);
      }
    }
    
    console.log(`   [M3U8] TS文件下载完成: 成功 ${Object.keys(tsFiles).length}/${total}`);
    
    // 重试失败的TS文件
    let retryCount = 0;
    while (failedIndices.length > 0 && retryCount < maxRetries) {
      retryCount++;
      console.log(`   [M3U8] 重试失败的TS文件（第 ${retryCount}/${maxRetries} 次）...`);
      const retryFailed = [];
      
      for (const index of failedIndices) {
        if (index < 0 || index >= tsUrls.length) continue;
        const tsUrl = tsUrls[index];
        const result = await this.downloadTsFile(tsUrl, index);
        if (result && result.data && result.data.length > 0) {
          tsFiles[result.index] = result.data;
          console.log(`   [M3U8] 重试成功 [${index}]`);
          
          if (progressCallback) {
            const downloaded = Object.keys(tsFiles).length;
            progressCallback('downloading_ts', downloaded, total);
          }
        } else {
          retryFailed.push(index);
        }
      }
      
      failedIndices.length = 0;
      failedIndices.push(...retryFailed);
      
      if (failedIndices.length > 0) {
        console.log(`   [M3U8] 仍有 ${failedIndices.length} 个TS文件下载失败`);
      }
    }
    
    // 必须保证所有TS文件都下载成功
    if (failedIndices.length > 0) {
      console.error(`   [M3U8] 错误: 有 ${failedIndices.length} 个TS文件下载失败`);
      return null;
    }
    
    const expectedCount = tsUrls.length;
    const actualCount = Object.keys(tsFiles).length;
    if (actualCount !== expectedCount) {
      console.error(`   [M3U8] 错误: TS文件数量不匹配（期望 ${expectedCount}，实际 ${actualCount}）`);
      return null;
    }
    
    console.log(`   [M3U8] 所有TS文件下载成功`);
    return tsFiles;
  }
  
  /**
   * 上传TS文件到R2
   */
  async uploadTsToR2(tsData, index) {
    // 添加 uploads/ 前缀以匹配数据库格式
        // 视频路径格式：videos/YYYYMM/DD/article_id/subfolder/segment_XXX.ts
        // 正确格式：videos/202602/06/6985b397cd9fd09939085942/b6bgf9/segment_001.ts
        const filename = this.getVideoPath(`segment_${String(index).padStart(3, '0')}.ts`);
    console.log(`   [M3U8] 📤 上传TS文件 [${index}] 到R2: ${filename}`);
    console.log(`   [M3U8]   TS文件大小: ${(tsData.length / 1024).toFixed(2)} KB`);
    
    const result = await this.r2Uploader.uploadVideoFile(tsData, filename, 'video/mp2t');
    
    console.log(`   [M3U8]   上传结果:`, JSON.stringify(result, null, 2));
    
    if (result && result.success) {
      // 直接使用R2返回的resource_key，不做额外处理
      const resourceKey = result.resource_key;
      console.log(`   [M3U8] ✅ TS文件上传成功 [${index}]: ${resourceKey}`);
      return resourceKey;
    } else {
      console.error(`   [M3U8] ❌ TS文件上传失败 [${index}]: ${result?.error || '未知错误'}`);
      return null;
    }
  }
  
  /**
   * 并发上传所有TS文件到R2
   */
  async uploadAllTsToR2(tsFiles, progressCallback = null) {
    const r2Keys = {};
    const failedIndices = [];
    const maxRetries = 3;
    const total = Object.keys(tsFiles).length;
    
    console.log(`   [M3U8] 开始上传 ${total} 个TS文件到R2（并发数: ${this.maxWorkers}）...`);
    
    // 分批上传
    const indices = Object.keys(tsFiles).map(k => parseInt(k, 10));
    for (let i = 0; i < indices.length; i += this.maxWorkers) {
      const batch = indices.slice(i, i + this.maxWorkers);
      const uploadPromises = batch.map(index =>
        this.uploadTsToR2(tsFiles[index], index)
          .then(r2Key => ({ index, r2Key }))
          .catch(() => ({ index, r2Key: null }))
      );
      
      const results = await Promise.allSettled(uploadPromises);
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          const { index, r2Key } = result.value;
          if (r2Key) {
            r2Keys[index] = r2Key;
            console.log(`   [M3U8] ✅ TS文件 [${index}] 上传成功: ${r2Key}`);
          } else {
            console.error(`   [M3U8] ❌ TS文件 [${index}] 上传失败: r2Key为空`);
            failedIndices.push(index);
          }
        } else {
          console.error(`   [M3U8] ❌ TS文件上传异常:`, result.reason?.message || '未知错误');
        }
      });
      
      // 更新进度
      if (progressCallback) {
        const uploaded = Object.keys(r2Keys).length;
        console.log(`   [M3U8] 调用progressCallback - uploading_ts: ${uploaded}/${total}`);
        progressCallback('uploading_ts', uploaded, total);
      } else {
        console.log(`   [M3U8] ⚠️  progressCallback未定义，无法更新上传进度`);
      }
    }
    
    console.log(`   [M3U8] TS文件上传完成: 成功 ${Object.keys(r2Keys).length}/${total}`);
    
    // 重试失败的上传
    let retryCount = 0;
    while (failedIndices.length > 0 && retryCount < maxRetries) {
      retryCount++;
      console.log(`   [M3U8] 重试失败的上传（第 ${retryCount}/${maxRetries} 次）...`);
      const retryFailed = [];
      
      for (const index of failedIndices) {
        const r2Key = await this.uploadTsToR2(tsFiles[index], index);
        if (r2Key) {
          r2Keys[index] = r2Key;
          console.log(`   [M3U8] 重试上传成功 [${index}]`);
          
          if (progressCallback) {
            const uploaded = Object.keys(r2Keys).length;
            progressCallback('uploading_ts', uploaded, total);
          }
        } else {
          retryFailed.push(index);
        }
      }
      
      failedIndices.length = 0;
      failedIndices.push(...retryFailed);
    }
    
    if (failedIndices.length > 0) {
      console.error(`   [M3U8] 错误: 有 ${failedIndices.length} 个TS文件上传失败`);
      return null;
    }
    
    if (Object.keys(r2Keys).length !== total) {
      console.error(`   [M3U8] 错误: 上传数量不匹配`);
      return null;
    }
    
    console.log(`   [M3U8] 所有TS文件上传成功`);
    return r2Keys;
  }
  
  /**
   * 生成新的M3U8内容（指向R2的TS文件，使用相对路径）
   */
  generateNewM3U8Content(originalContent, tsUrls, r2Keys, r2PreviewDomain, keyFileName = null) {
    const lines = originalContent.split('\n');
    const newLines = [];
    let tsIndex = 0;
    let hasPlaylistType = false;
    let hasInsertedPlaylistType = false;
    
    console.log(`   [M3U8] 生成新M3U8内容，TS文件数量: ${Object.keys(r2Keys).length}`);
    if (keyFileName) {
      console.log(`   [M3U8] 密钥文件名: ${keyFileName}`);
    }
    
    // 检查原始内容是否包含 #EXT-X-PLAYLIST-TYPE
    hasPlaylistType = originalContent.includes('#EXT-X-PLAYLIST-TYPE');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('#')) {
        // 处理加密密钥行（#EXT-X-KEY）
        if (trimmed.includes('#EXT-X-KEY')) {
          if (keyFileName) {
            // 提取原始的METHOD和IV参数
            const methodMatch = trimmed.match(/METHOD=([^,]+)/);
            const ivMatch = trimmed.match(/IV=([^,]+)/);
            
            const method = methodMatch ? methodMatch[1] : 'AES-128';
            const iv = ivMatch ? ivMatch[1] : '0x00000000000000000000000000000000';
            
            // 使用相对路径指向R2上的密钥文件
            const newKeyLine = `#EXT-X-KEY:METHOD=${method},URI="${keyFileName}",IV=${iv}`;
            console.log(`   [M3U8] 替换加密密钥行: ${newKeyLine}`);
            newLines.push(newKeyLine);
          } else {
            // 如果没有密钥文件，移除加密行（这意味着TS文件应该已经解密）
            console.log(`   [M3U8] 移除加密密钥行（无密钥文件）: ${trimmed.substring(0, 80)}...`);
          }
          continue;
        }
        
        // 保留其他注释行（版本、目标时长、序列号等）
        newLines.push(line);
        
        // 在 #EXT-X-MEDIA-SEQUENCE 后插入 #EXT-X-PLAYLIST-TYPE:VOD（如果原始内容没有）
        if (!hasPlaylistType && !hasInsertedPlaylistType && trimmed.startsWith('#EXT-X-MEDIA-SEQUENCE')) {
          newLines.push('#EXT-X-PLAYLIST-TYPE:VOD');
          hasInsertedPlaylistType = true;
          console.log(`   [M3U8] 添加 #EXT-X-PLAYLIST-TYPE:VOD 标签`);
        }
      } else if (trimmed.includes('.ts') || trimmed.includes('.ts?')) {
        if (tsIndex < tsUrls.length && r2Keys[tsIndex]) {
          const r2Key = r2Keys[tsIndex];
          // 从完整路径中提取文件名（相对于M3U8文件的相对路径）
          // 例如: videos/202602/07/247836/w9bu8k/segment_000.ts -> segment_000.ts
          const filename = r2Key.split('/').pop();
          console.log(`   [M3U8] TS[${tsIndex}]: ${r2Key} -> ${filename}`);
          newLines.push(filename);
        } else {
          console.log(`   [M3U8] ⚠️  TS[${tsIndex}]: 未找到R2 key，保留原始行`);
          newLines.push(line);
        }
        tsIndex++;
      } else {
        newLines.push(line);
      }
    }
    
    console.log(`   [M3U8] M3U8内容生成完成，共 ${newLines.length} 行`);
    return newLines.join('\n');
  }
  
  /**
   * 下载加密密钥文件
   */
  async downloadKeyFile(keyUri, baseUrl) {
    try {
      console.log(`   [M3U8] 📥 下载加密密钥文件: ${keyUri}`);
      
      // 构建完整的密钥文件URL
      let keyUrl = keyUri;
      if (!keyUrl.startsWith('http')) {
        keyUrl = new URL(keyUri, baseUrl).href;
      }
      
      console.log(`   [M3U8]   密钥文件完整URL: ${keyUrl}`);
      const buffer = await this.httpGet(keyUrl);
      console.log(`   [M3U8] ✅ 密钥文件下载成功，大小: ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      console.error(`   [M3U8] ❌ 密钥文件下载失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 处理M3U8视频（完整流程）
   * @param {string} m3u8Url - M3U8 URL
   * @param {string} r2PreviewDomain - R2预览域名
   * @param {Function} progressCallback - 进度回调
   * @returns {Promise<Object|null>} {m3u8_content, m3u8_resource_key, ts_count}
   */
  async processM3U8(m3u8Url, r2PreviewDomain, progressCallback = null) {
    try {
      console.log(`   [M3U8] processM3U8 开始`);
      console.log(`   [M3U8] progressCallback: ${progressCallback ? '已传入' : '未传入'}`);
      
      // 1. 下载并解析M3U8
      const m3u8Data = await this.downloadAndParseM3U8(m3u8Url);
      if (!m3u8Data || m3u8Data.ts_urls.length === 0) {
        console.error('   [M3U8] M3U8解析失败或无TS文件');
        return null;
      }
      
      console.log(`   [M3U8] M3U8解析成功，TS文件数量: ${m3u8Data.ts_urls.length}`);
      
      // 1.5. 检查是否有加密密钥，如果有则下载并上传
      let keyFileName = null;
      const keyMatch = m3u8Data.content.match(/#EXT-X-KEY:.*?URI="?([^",]+)"?/);
      if (keyMatch) {
        const keyUri = keyMatch[1];
        console.log(`   [M3U8] 检测到加密密钥: ${keyUri}`);
        
        // 下载密钥文件
        const keyBuffer = await this.downloadKeyFile(keyUri, m3u8Data.base_url);
        if (keyBuffer) {
          // 上传密钥文件到R2（与M3U8在同一目录）
          keyFileName = 'ts.key'; // 使用固定文件名，便于相对路径引用
          const keyFilePath = this.getVideoPath(keyFileName); // 使用与M3U8相同的目录
          console.log(`   [M3U8] 📤 上传密钥文件到R2: ${keyFilePath}`);
          
          const keyUploadResult = await this.r2Uploader.uploadVideoFile(
            keyBuffer,
            keyFilePath,
            'text/plain' // R2 Worker允许的类型（application/octet-stream不被允许）
          );
          
          if (keyUploadResult && keyUploadResult.success) {
            console.log(`   [M3U8] ✅ 密钥文件上传成功: ${keyUploadResult.resource_key}`);
            // keyFileName 保持为 'ts.key'，在M3U8中使用相对路径
          } else {
            console.error(`   [M3U8] ❌ 密钥文件上传失败，将移除加密信息`);
            keyFileName = null;
          }
        } else {
          console.error(`   [M3U8] ❌ 密钥文件下载失败，将移除加密信息`);
        }
      } else {
        console.log(`   [M3U8] 未检测到加密密钥，视频未加密`);
      }
      
      // 2. 下载所有TS文件
      console.log(`   [M3U8] 开始下载TS文件，progressCallback: ${progressCallback ? 'YES' : 'NO'}`);
      const tsFiles = await this.downloadAllTsFiles(m3u8Data.ts_urls, progressCallback);
      if (!tsFiles) {
        console.error('   [M3U8] TS文件下载失败');
        return null;
      }
      
      console.log(`   [M3U8] TS文件下载完成`);
      
      // 3. 上传所有TS文件到R2
      console.log(`   [M3U8] 开始上传TS文件到R2，progressCallback: ${progressCallback ? 'YES' : 'NO'}`);
      const r2Keys = await this.uploadAllTsToR2(tsFiles, progressCallback);
      if (!r2Keys) {
        console.error('   [M3U8] TS文件上传失败');
        return null;
      }
      
      // 4. 生成新的M3U8内容（传递密钥文件名）
      const newM3u8Content = this.generateNewM3U8Content(
        m3u8Data.content,
        m3u8Data.ts_urls,
        r2Keys,
        r2PreviewDomain,
        keyFileName
      );
      
      // 5. 上传新的M3U8文件到R2（视频路径格式：videos/YYYYMM/DD/article_id/subfolder/index.m3u8）
      // 正确格式：videos/202602/06/6985b397cd9fd09939085942/b6bgf9/index.m3u8
      const m3u8Filename = this.getVideoPath('index.m3u8');
      const m3u8Buffer = Buffer.from(newM3u8Content, 'utf8');
      console.log(`   [M3U8] 📤 上传M3U8文件到R2: ${m3u8Filename}`);
      console.log(`   [M3U8]   M3U8文件大小: ${(m3u8Buffer.length / 1024).toFixed(2)} KB`);
      console.log(`   [M3U8]   M3U8内容预览:`, newM3u8Content.substring(0, 200));
      
      const m3u8UploadResult = await this.r2Uploader.uploadVideoFile(
        m3u8Buffer,
        m3u8Filename,
        'application/vnd.apple.mpegurl'
      );
      
      console.log(`   [M3U8]   M3U8上传结果:`, JSON.stringify(m3u8UploadResult, null, 2));
      
      if (!m3u8UploadResult || !m3u8UploadResult.success) {
        console.error(`   [M3U8] ❌ M3U8文件上传失败: ${m3u8UploadResult?.error || '未知错误'}`);
        return null;
      }
      
      // 直接使用R2返回的resource_key，不做额外处理
      const m3u8ResourceKey = m3u8UploadResult.resource_key;
      console.log(`   [M3U8] ✅ M3U8处理完成: ${m3u8ResourceKey}`);
      console.log(`   [M3U8]   TS文件总数: ${Object.keys(r2Keys).length}`);
      
      return {
        m3u8_content: newM3u8Content,
        m3u8_resource_key: m3u8ResourceKey,
        ts_count: Object.keys(r2Keys).length
      };
      
    } catch (error) {
      console.error(`   [M3U8] 处理失败: ${error.message}`);
      return null;
    }
  }
  
  /**
   * 处理MP4视频（直接下载并上传）
   */
  async processMp4(mp4Url, progressCallback = null) {
    try {
      console.log(`   [MP4] 下载视频: ${mp4Url.substring(0, 80)}...`);
      
      if (progressCallback) {
        progressCallback('downloading_video', 0, 100);
      }
      
      const videoData = await this.httpGet(mp4Url);
      
      if (progressCallback) {
        progressCallback('downloading_video', 100, 100);
      }
      
      console.log(`   [MP4] ✅ 视频下载完成: ${(videoData.length / 1024 / 1024).toFixed(2)} MB`);
      
      // 上传到R2（视频路径格式：videos/... 而不是 uploads/videos/...）
      const filename = `videos/${this.articleId}/video.mp4`;
      console.log(`   [MP4] 📤 上传视频到R2: ${filename}`);
      
      if (progressCallback) {
        progressCallback('uploading_video', 0, 100);
      }
      
      const uploadResult = await this.r2Uploader.uploadVideoFile(videoData, filename, 'video/mp4');
      
      console.log(`   [MP4]   上传结果:`, JSON.stringify(uploadResult, null, 2));
      
      if (progressCallback) {
        progressCallback('uploading_video', 100, 100);
      }
      
      if (!uploadResult || !uploadResult.success) {
        console.error(`   [MP4] ❌ 视频上传失败: ${uploadResult?.error || '未知错误'}`);
        return null;
      }
      
      // 确保返回的路径包含 uploads/ 前缀
      // 视频路径格式：videos/... 而不是 uploads/videos/...
      let videoResourceKey = uploadResult.resource_key;
      // 如果R2返回的路径包含uploads/前缀，移除它
      if (videoResourceKey.startsWith('uploads/videos/')) {
        videoResourceKey = videoResourceKey.replace('uploads/', '');
      } else if (videoResourceKey.startsWith('uploads/')) {
        videoResourceKey = videoResourceKey.replace('uploads/', '');
      }
      
      console.log(`   [MP4] ✅ 视频处理完成: ${videoResourceKey}`);
      
      return {
        video_resource_key: videoResourceKey,
        video_url: uploadResult.url
      };
      
    } catch (error) {
      console.error(`   [MP4] 处理失败: ${error.message}`);
      return null;
    }
  }
}

module.exports = M3U8Processor;
