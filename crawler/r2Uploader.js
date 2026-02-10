/**
 * R2上传器模块
 * 用于上传图片和视频文件到Cloudflare R2存储
 */

const axios = require('axios');
const FormData = require('form-data');
const config = require('../config/default.json');

class R2Uploader {
  constructor() {
    this.uploadUrl = config.r2WorkerUrl;
    this.timeout = 300000; // 5分钟超时
    this.client = axios.create({
      timeout: this.timeout,
      headers: {
        'User-Agent': config.userAgent
      }
    });
  }
  
  /**
   * 上传图片数据到R2
   * @param {Buffer} imageData - 图片二进制数据
   * @param {string} filename - 文件名（包含路径），如 "uploads/xxx.jpg"
   * @param {string} fileExtension - 文件扩展名
   * @returns {Promise<Object>} 上传结果
   */
  async uploadImageData(imageData, filename = null, fileExtension = 'jpg') {
    try {
      // 生成文件名
      if (!filename) {
        const timestamp = Date.now();
        const uuid = Math.random().toString(36).substring(2, 10);
        filename = `uploads/${timestamp}_${uuid}.${fileExtension}`;
      }
      
      // 准备表单数据
      const formData = new FormData();
      const baseFilename = filename.split('/').pop();
      formData.append('file', imageData, {
        filename: baseFilename,
        contentType: fileExtension === 'jpg' ? 'image/jpeg' : `image/${fileExtension}`
      });
      formData.append('type', 'image');
      formData.append('key', filename); // 传入完整路径作为key
      
      console.log(`[R2Uploader] 📤 开始上传图片: ${filename} (${imageData.length} bytes)`);
      
      const response = await this.client.post(this.uploadUrl, formData, {
        headers: formData.getHeaders()
      });
      
      if (response.status === 200) {
        const result = response.data;
        
        if (result.success) {
          // 解析响应格式
          let resourceKey = null;
          let previewUrl = '';
          
          if (result.data && typeof result.data === 'object') {
            resourceKey = result.data.filePath || result.data.resourceKey || result.data.fileName || result.data.key;
            previewUrl = result.data.previewUrl || result.data.url || '';
          } else if (result.key) {
            resourceKey = result.key;
            previewUrl = result.url || '';
          }
          
          // 如果R2没有返回路径，使用我们传入的filename
          if (!resourceKey) {
            resourceKey = filename;
          }
          
          console.log(`[R2Uploader] ✅ 图片上传成功: ${resourceKey}`);
          
          return {
            success: true,
            resource_key: resourceKey,
            url: previewUrl,
            filename: filename
          };
        } else {
          const errorMsg = result.message || '上传失败';
          console.error(`[R2Uploader] ❌ 上传失败: ${errorMsg}`);
          return {
            success: false,
            error: errorMsg
          };
        }
      } else {
        console.error(`[R2Uploader] ❌ HTTP请求失败: ${response.status}`);
        return {
          success: false,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      console.error(`[R2Uploader] ❌ 上传异常: ${error.message}`);
      if (error.response) {
        console.error(`[R2Uploader] ❌ HTTP状态: ${error.response.status}`);
        console.error(`[R2Uploader] ❌ 响应数据:`, JSON.stringify(error.response.data, null, 2));
      }
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * 上传视频文件到R2
   * @param {Buffer} videoData - 视频文件二进制数据
   * @param {string} filename - 文件名（包含路径），如 "videos/123/video.mp4"
   * @param {string} contentType - 文件MIME类型
   * @returns {Promise<Object>} 上传结果
   */
  async uploadVideoFile(videoData, filename, contentType = 'video/mp4') {
    try {
      // 从filename提取文件扩展名
      let fileExtension = 'mp4';
      if (filename.includes('.')) {
        fileExtension = filename.split('.').pop();
      }
      
      // TS文件特殊处理
      let actualContentType = contentType;
      if (fileExtension.toLowerCase() === 'ts') {
        actualContentType = contentType === 'video/mp4' ? 'video/mp2t' : contentType;
      } else if (fileExtension.toLowerCase() === 'm3u8') {
        actualContentType = 'application/x-mpegURL';
      }
      
      // 准备表单数据
      const formData = new FormData();
      const baseFilename = filename.split('/').pop();
      formData.append('file', videoData, {
        filename: baseFilename,
        contentType: actualContentType
      });
      formData.append('type', 'video');
      formData.append('key', filename); // 传入完整路径作为key
      
      const sizeMB = (videoData.length / 1024 / 1024).toFixed(2);
      console.log(`[R2Uploader] 📤 开始上传视频: ${filename} (${sizeMB} MB)`);
      
      const response = await this.client.post(this.uploadUrl, formData, {
        headers: formData.getHeaders(),
        timeout: this.timeout * 3
      });
      
      if (response.status === 200) {
        const result = response.data;
        
        if (result.success) {
          console.log(`[R2Uploader] ===== 开始解析R2视频响应 =====`);
          console.log(`[R2Uploader] 完整响应数据:`, JSON.stringify(result, null, 2));
          console.log(`[R2Uploader] 传入的filename: ${filename}`);
          
          // 解析响应格式
          let resourceKey = null;
          let previewUrl = '';
          
          if (result.data && typeof result.data === 'object') {
            console.log(`[R2Uploader] result.data 存在，开始解析字段...`);
            console.log(`[R2Uploader]   - result.data.filePath: ${result.data.filePath || 'null'}`);
            console.log(`[R2Uploader]   - result.data.resourceKey: ${result.data.resourceKey || 'null'}`);
            console.log(`[R2Uploader]   - result.data.fileName: ${result.data.fileName || 'null'}`);
            console.log(`[R2Uploader]   - result.data.key: ${result.data.key || 'null'}`);
            
            resourceKey = result.data.filePath || result.data.resourceKey || result.data.fileName || result.data.key;
            previewUrl = result.data.previewUrl || result.data.url || '';
          } else if (result.key) {
            console.log(`[R2Uploader] result.key 存在: ${result.key}`);
            resourceKey = result.key;
            previewUrl = result.url || '';
          }
          
          console.log(`[R2Uploader] 第一步解析出的resourceKey: ${resourceKey || 'null'}`);
          
          // 如果R2返回的路径不包含videos/，使用我们传入的filename
          if (!resourceKey || !resourceKey.startsWith('videos/')) {
            console.log(`[R2Uploader] resourceKey不包含videos/，使用传入的filename: ${filename}`);
            resourceKey = filename;
          } else {
            console.log(`[R2Uploader] resourceKey已包含videos/，直接使用`);
          }
          
          console.log(`[R2Uploader] ===== 最终resourceKey: ${resourceKey} =====`);
          console.log(`[R2Uploader] ✅ 视频上传成功`);
          
          return {
            success: true,
            resource_key: resourceKey,
            url: previewUrl,
            filename: filename
          };
        } else {
          const errorMsg = result.message || '上传失败';
          console.error(`[R2Uploader] ❌ 上传失败: ${errorMsg}`);
          return {
            success: false,
            error: errorMsg
          };
        }
      } else {
        console.error(`[R2Uploader] ❌ HTTP请求失败: ${response.status}`);
        return {
          success: false,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      console.error(`[R2Uploader] ❌ 上传异常: ${error.message}`);
      if (error.response) {
        console.error(`[R2Uploader] ❌ HTTP状态: ${error.response.status}`);
        console.error(`[R2Uploader] ❌ 响应数据:`, JSON.stringify(error.response.data, null, 2));
      }
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * 上传音频文件到R2（用于有声小说）
   * @param {Buffer} audioData - 音频文件二进制数据
   * @param {string} filename - 文件名（包含路径），如 "audio-novels/202602/08/97/chapter_001.mp3"
   * @returns {Promise<Object>} 上传结果
   */
  async uploadAudioFile(audioData, filename) {
    try {
      // 从filename提取文件扩展名
      let fileExtension = 'mp3';
      if (filename.includes('.')) {
        fileExtension = filename.split('.').pop().toLowerCase();
      }
      
      // 确定 Content-Type
      let contentType = 'audio/mpeg';
      if (fileExtension === 'm4a') {
        contentType = 'audio/mp4';
      } else if (fileExtension === 'wav') {
        contentType = 'audio/wav';
      } else if (fileExtension === 'ogg') {
        contentType = 'audio/ogg';
      }
      
      // 准备表单数据
      const formData = new FormData();
      const baseFilename = filename.split('/').pop();
      formData.append('file', audioData, {
        filename: baseFilename,
        contentType: contentType
      });
      formData.append('type', 'audio');
      formData.append('key', filename); // 传入完整路径作为key
      
      const sizeMB = (audioData.length / 1024 / 1024).toFixed(2);
      console.log(`[R2Uploader] 📤 开始上传音频: ${filename} (${sizeMB} MB)`);
      
      const response = await this.client.post(this.uploadUrl, formData, {
        headers: formData.getHeaders(),
        timeout: this.timeout * 2 // 音频文件可能较大，给更长超时时间
      });
      
      if (response.status === 200) {
        const result = response.data;
        
        if (result.success) {
          // 解析响应格式
          let resourceKey = null;
          let previewUrl = '';
          
          if (result.data && typeof result.data === 'object') {
            resourceKey = result.data.filePath || result.data.resourceKey || result.data.fileName || result.data.key;
            previewUrl = result.data.previewUrl || result.data.url || '';
          } else if (result.key) {
            resourceKey = result.key;
            previewUrl = result.url || '';
          }
          
          // 如果R2没有返回路径或不包含audio-novels/，使用我们传入的filename
          if (!resourceKey || !resourceKey.startsWith('audio-novels/')) {
            resourceKey = filename;
          }
          
          console.log(`[R2Uploader] ✅ 音频上传成功: ${resourceKey}`);
          
          return {
            success: true,
            resource_key: resourceKey,
            url: previewUrl,
            filename: filename
          };
        } else {
          const errorMsg = result.message || '上传失败';
          console.error(`[R2Uploader] ❌ 音频上传失败: ${errorMsg}`);
          return {
            success: false,
            error: errorMsg
          };
        }
      } else {
        console.error(`[R2Uploader] ❌ HTTP请求失败: ${response.status}`);
        return {
          success: false,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      console.error(`[R2Uploader] ❌ 音频上传异常: ${error.message}`);
      if (error.response) {
        console.error(`[R2Uploader] ❌ HTTP状态: ${error.response.status}`);
        console.error(`[R2Uploader] ❌ 响应数据:`, JSON.stringify(error.response.data, null, 2));
      }
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * 上传封面图片到R2（用于有声小说）
   * @param {Buffer} imageData - 图片二进制数据
   * @param {string} filename - 文件名（包含路径），如 "audio-novels/202602/08/97/cover.jpg"
   * @returns {Promise<Object>} 上传结果
   */
  async uploadCoverImage(imageData, filename) {
    try {
      // 从filename提取文件扩展名
      let fileExtension = 'jpg';
      if (filename.includes('.')) {
        fileExtension = filename.split('.').pop().toLowerCase();
      }
      
      // 准备表单数据
      const formData = new FormData();
      const baseFilename = filename.split('/').pop();
      formData.append('file', imageData, {
        filename: baseFilename,
        contentType: fileExtension === 'jpg' ? 'image/jpeg' : `image/${fileExtension}`
      });
      formData.append('type', 'image');
      formData.append('key', filename);
      
      const sizeKB = (imageData.length / 1024).toFixed(2);
      console.log(`[R2Uploader] 📤 开始上传封面: ${filename} (${sizeKB} KB)`);
      
      const response = await this.client.post(this.uploadUrl, formData, {
        headers: formData.getHeaders()
      });
      
      if (response.status === 200) {
        const result = response.data;
        
        if (result.success) {
          // 解析响应格式
          let resourceKey = null;
          let previewUrl = '';
          
          if (result.data && typeof result.data === 'object') {
            resourceKey = result.data.filePath || result.data.resourceKey || result.data.fileName || result.data.key;
            previewUrl = result.data.previewUrl || result.data.url || '';
          } else if (result.key) {
            resourceKey = result.key;
            previewUrl = result.url || '';
          }
          
          // 如果R2没有返回路径，使用我们传入的filename
          if (!resourceKey) {
            resourceKey = filename;
          }
          
          console.log(`[R2Uploader] ✅ 封面上传成功: ${resourceKey}`);
          
          return {
            success: true,
            resource_key: resourceKey,
            url: previewUrl,
            filename: filename
          };
        } else {
          const errorMsg = result.message || '上传失败';
          console.error(`[R2Uploader] ❌ 封面上传失败: ${errorMsg}`);
          return {
            success: false,
            error: errorMsg
          };
        }
      } else {
        console.error(`[R2Uploader] ❌ HTTP请求失败: ${response.status}`);
        return {
          success: false,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      console.error(`[R2Uploader] ❌ 封面上传异常: ${error.message}`);
      if (error.response) {
        console.error(`[R2Uploader] ❌ HTTP状态: ${error.response.status}`);
        console.error(`[R2Uploader] ❌ 响应数据:`, JSON.stringify(error.response.data, null, 2));
      }
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = R2Uploader;
