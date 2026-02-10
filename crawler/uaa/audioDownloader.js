/**
 * 音频下载器
 * 支持下载 MP3 音频文件，带进度回调和重试机制
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class AudioDownloader {
  constructor(config = {}) {
    this.timeout = config.timeout || 120000; // 2分钟超时
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 2000;
  }
  
  /**
   * 下载音频文件
   * @param {string} url - 音频URL
   * @param {Function} onProgress - 进度回调 (current, total, percent)
   * @returns {Promise<Buffer>} 音频文件 Buffer
   */
  async downloadAudio(url, onProgress = null) {
    console.log(`[AudioDownloader] 开始下载音频: ${url}`);
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const buffer = await this._download(url, onProgress);
        console.log(`[AudioDownloader] 下载成功: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
        return buffer;
      } catch (error) {
        console.error(`[AudioDownloader] 下载失败 (尝试 ${attempt}/${this.maxRetries}):`, error.message);
        
        if (attempt < this.maxRetries) {
          console.log(`[AudioDownloader] ${this.retryDelay}ms 后重试...`);
          await this.sleep(this.retryDelay);
        } else {
          throw new Error(`下载音频失败（已重试${this.maxRetries}次）: ${error.message}`);
        }
      }
    }
  }
  
  /**
   * 下载图片（封面）
   * @param {string} url - 图片URL
   * @returns {Promise<Buffer>} 图片文件 Buffer
   */
  async downloadImage(url) {
    console.log(`[AudioDownloader] 开始下载图片: ${url}`);
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const buffer = await this._download(url, null);
        console.log(`[AudioDownloader] 图片下载成功: ${(buffer.length / 1024).toFixed(2)} KB`);
        return buffer;
      } catch (error) {
        console.error(`[AudioDownloader] 图片下载失败 (尝试 ${attempt}/${this.maxRetries}):`, error.message);
        
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay);
        } else {
          throw new Error(`下载图片失败（已重试${this.maxRetries}次）: ${error.message}`);
        }
      }
    }
  }
  
  /**
   * 内部下载方法
   */
  _download(url, onProgress) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': '*/*',
          'Accept-Encoding': 'identity', // 不压缩，便于计算进度
          'Referer': `${urlObj.protocol}//${urlObj.hostname}/`,
          'Connection': 'keep-alive'
        },
        timeout: this.timeout
      };
      
      const req = protocol.request(options, (res) => {
        // 处理重定向
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          console.log(`[AudioDownloader] 重定向到: ${redirectUrl}`);
          this._download(redirectUrl, onProgress)
            .then(resolve)
            .catch(reject);
          return;
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        
        const chunks = [];
        let downloaded = 0;
        const total = parseInt(res.headers['content-length'] || '0');
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
          downloaded += chunk.length;
          
          if (onProgress && total > 0) {
            const percent = Math.round((downloaded / total) * 100);
            onProgress(downloaded, total, percent);
          }
        });
        
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          
          if (buffer.length === 0) {
            reject(new Error('下载的文件为空'));
          } else {
            resolve(buffer);
          }
        });
        
        res.on('error', (error) => {
          reject(new Error(`响应错误: ${error.message}`));
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`请求错误: ${error.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('下载超时'));
      });
      
      req.end();
    });
  }
  
  /**
   * 批量下载音频
   * @param {Array} urls - URL数组
   * @param {number} concurrency - 并发数
   * @param {Function} onItemProgress - 单个项目进度回调
   * @returns {Promise<Array<Buffer>>} Buffer数组
   */
  async downloadBatch(urls, concurrency = 3, onItemProgress = null) {
    console.log(`[AudioDownloader] 批量下载: ${urls.length} 个文件，并发数: ${concurrency}`);
    
    const results = [];
    const queue = [...urls];
    let activeCount = 0;
    let completedCount = 0;
    
    return new Promise((resolve, reject) => {
      const processNext = () => {
        if (queue.length === 0 && activeCount === 0) {
          console.log(`[AudioDownloader] 批量下载完成: ${completedCount}/${urls.length}`);
          resolve(results);
          return;
        }
        
        while (queue.length > 0 && activeCount < concurrency) {
          const url = queue.shift();
          const index = urls.indexOf(url);
          activeCount++;
          
          this.downloadAudio(url, (current, total, percent) => {
            if (onItemProgress) {
              onItemProgress(index, current, total, percent);
            }
          })
            .then((buffer) => {
              results[index] = buffer;
              completedCount++;
              activeCount--;
              processNext();
            })
            .catch((error) => {
              console.error(`[AudioDownloader] 下载失败 [${index}]:`, error.message);
              results[index] = null;
              completedCount++;
              activeCount--;
              processNext();
            });
        }
      };
      
      processNext();
    });
  }
  
  /**
   * 延时函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AudioDownloader;
