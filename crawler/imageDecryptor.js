/**
 * 图片解密模块
 * 负责下载和解密加密的图片
 */

const CryptoJS = require('crypto-js');
const https = require('https');
const http = require('http');
const config = require('../config/default.json');

/**
 * 解析密钥字符串
 * @param {string} keyString - 格式如 "102_53_100_57..."
 * @returns {string} - 解析后的密钥
 */
function parseKey(keyString) {
  return keyString
    .split('_')
    .map(x => String.fromCharCode(parseInt(x, 10)))
    .join('');
}

/**
 * 解密图片数据
 * @param {Buffer|string} encryptedData - 加密的图片数据
 * @returns {Buffer|null} - 解密后的图片数据
 */
function decryptImage(encryptedData) {
  try {
    const keyStr = config.imageDecryptKey;
    const ivStr = config.imageDecryptIV;
    
    const key = CryptoJS.enc.Utf8.parse(parseKey(keyStr));
    const iv = CryptoJS.enc.Utf8.parse(parseKey(ivStr));
    
    // 转换为 base64
    let encryptedBase64;
    if (Buffer.isBuffer(encryptedData)) {
      encryptedBase64 = encryptedData.toString('base64');
    } else if (typeof encryptedData === 'string') {
      encryptedBase64 = encryptedData;
    } else {
      console.error('❌ [ImageDecryptor] 不支持的加密数据类型');
      return null;
    }
    
    // AES 解密
    const decrypted = CryptoJS.AES.decrypt(encryptedBase64, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // 转换为 base64
    const decryptedBase64 = decrypted.toString(CryptoJS.enc.Base64);
    
    // 转换为 Buffer
    const decryptedBytes = Buffer.from(decryptedBase64, 'base64');
    
    if (decryptedBytes.length === 0) {
      console.error('❌ [ImageDecryptor] 解密后数据为空');
      return null;
    }
    
    return decryptedBytes;
  } catch (error) {
    console.error(`❌ [ImageDecryptor] 解密失败: ${error.message}`);
    return null;
  }
}

/**
 * 检查是否为 JPEG 或 PNG 图片
 * @param {Buffer} bytes - 图片数据
 * @returns {boolean}
 */
function isImageHeader(bytes) {
  if (bytes.length < 4) return false;
  
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return true;
  }
  
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return true;
  }
  
  return false;
}

/**
 * 解密图片字节流（检测是否需要解密）
 * @param {Buffer} encryptedBytes - 可能加密的图片数据
 * @returns {Buffer} - 解密后的图片数据
 */
function decryptImageBytes(encryptedBytes) {
  // 如果已经是有效图片头，直接返回
  if (isImageHeader(encryptedBytes)) {
    console.log('✅ [ImageDecryptor] 图片未加密，直接返回');
    return encryptedBytes;
  }
  
  // 尝试解密
  console.log('🔓 [ImageDecryptor] 开始解密图片...');
  const decrypted = decryptImage(encryptedBytes);
  
  if (decrypted && isImageHeader(decrypted)) {
    console.log('✅ [ImageDecryptor] 图片解密成功');
    return decrypted;
  }
  
  // 解密失败，返回原始数据
  console.warn('⚠️ [ImageDecryptor] 解密失败，返回原始数据');
  return encryptedBytes;
}

/**
 * 下载并解密图片
 * @param {string} imgUrl - 图片URL
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<string|null>} - base64 格式的图片数据 (data:image/jpeg;base64,...)
 */
async function downloadAndDecryptImage(imgUrl, timeout = 30000) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`📥 [ImageDecryptor] 开始下载图片: ${imgUrl}`);
      
      // 解析 URL
      const urlObj = new URL(imgUrl);
      const protocol = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': config.userAgent,
          'Referer': config.baseUrl + '/'
        },
        timeout: timeout,
        rejectUnauthorized: false
      };
      
      const req = protocol.request(options, (res) => {
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          try {
            // 合并所有数据块
            const encryptedData = Buffer.concat(chunks);
            console.log(`✅ [ImageDecryptor] 图片下载完成，大小: ${encryptedData.length} bytes`);
            
            // 解密图片
            const decryptedData = decryptImageBytes(encryptedData);
            
            if (!decryptedData || decryptedData.length === 0) {
              console.error('❌ [ImageDecryptor] 解密后数据为空');
              resolve(null);
              return;
            }
            
            // 检测图片类型
            let mimeType = 'image/jpeg'; // 默认
            if (decryptedData[0] === 0x89 && decryptedData[1] === 0x50) {
              mimeType = 'image/png';
            }
            
            // 转换为 base64
            const base64 = decryptedData.toString('base64');
            const dataUrl = `data:${mimeType};base64,${base64}`;
            
            console.log(`✅ [ImageDecryptor] 图片处理完成，类型: ${mimeType}`);
            resolve(dataUrl);
          } catch (error) {
            console.error(`❌ [ImageDecryptor] 处理图片数据失败: ${error.message}`);
            resolve(null);
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`❌ [ImageDecryptor] 下载图片失败: ${error.message}`);
        resolve(null);
      });
      
      req.on('timeout', () => {
        req.destroy();
        console.error('❌ [ImageDecryptor] 下载图片超时');
        resolve(null);
      });
      
      req.end();
    } catch (error) {
      console.error(`❌ [ImageDecryptor] 下载图片异常: ${error.message}`);
      resolve(null);
    }
  });
}

/**
 * 下载并解密图片（返回Buffer）
 * @param {string} imgUrl - 图片URL
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<Buffer|null>} - 解密后的图片Buffer
 */
async function downloadAndDecryptImageBytes(imgUrl, timeout = 30000) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`📥 [ImageDecryptor] 开始下载图片: ${imgUrl}`);
      
      // 解析 URL
      const urlObj = new URL(imgUrl);
      const protocol = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': config.userAgent,
          'Referer': config.baseUrl + '/'
        },
        timeout: timeout,
        rejectUnauthorized: false
      };
      
      const req = protocol.request(options, (res) => {
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          try {
            // 合并所有数据块
            const encryptedData = Buffer.concat(chunks);
            console.log(`✅ [ImageDecryptor] 图片下载完成，大小: ${encryptedData.length} bytes`);
            
            // 解密图片
            const decryptedData = decryptImageBytes(encryptedData);
            
            if (!decryptedData || decryptedData.length === 0) {
              console.error('❌ [ImageDecryptor] 解密后数据为空');
              resolve(null);
              return;
            }
            
            console.log(`✅ [ImageDecryptor] 图片处理完成`);
            resolve(decryptedData);
          } catch (error) {
            console.error(`❌ [ImageDecryptor] 处理图片数据失败: ${error.message}`);
            resolve(null);
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`❌ [ImageDecryptor] 下载图片失败: ${error.message}`);
        resolve(null);
      });
      
      req.on('timeout', () => {
        req.destroy();
        console.error('❌ [ImageDecryptor] 下载图片超时');
        resolve(null);
      });
      
      req.end();
    } catch (error) {
      console.error(`❌ [ImageDecryptor] 下载图片异常: ${error.message}`);
      resolve(null);
    }
  });
}

module.exports = {
  decryptImage,
  decryptImageBytes,
  downloadAndDecryptImage,
  downloadAndDecryptImageBytes,
  parseKey
};
