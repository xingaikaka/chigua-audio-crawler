/**
 * 根据 post-sync-api.md 文档测试同步帖子API
 * 
 * 文档分析：
 * 1. 地址计算逻辑：
 *    - 若 syncApiUrl 含 `/api/video/sync-video` => `/api/crawler/post/sync`
 *    - 若 syncApiUrl 含 `/sync-video` => `/crawler/post/sync`
 *    - 其它 => `<syncApiUrl>/crawler/post/sync`
 * 
 * 2. 请求头：
 *    - Content-Type: application/json
 *    - X-CRAWLER-TOKEN（可选）
 *    - X-AUTH-UUID（可选）
 * 
 * 3. 请求体字段（必需）：
 *    - source_id: integer (required)
 *    - uid: string (required)
 *    - title: string (required)
 * 
 * 4. 请求体字段（可选）：
 *    - content, description, cover_image, has_video, views_count, likes_count,
 *      comments_count, shares_count, purchase_count, visibility, assigned_role_code,
 *      platform_id, is_shared, created_at, updated_at
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// 配置
const config = {
  // 根据文档，syncApiUrl 可能是基础URL
  syncApiUrl: 'http://47.239.212.188:8880', // 基础URL
  syncAuthUuid: 'dd7d5b1b9f1348ec58eb3a1b884b93a2', // X-AUTH-UUID
  syncApiKey: 'UQ8k7P2nV6cXr9T1mK5Zs3YpH8dN4bJ0qL2vW7eA', // X-CRAWLER-TOKEN
  postSyncUid: '1765988676000011375', // uid
  postRoleCode: 'jianzhi', // assigned_role_code
  timeout: 30000
};

/**
 * 根据文档计算同步API地址
 */
function calculateSyncApiUrl(syncApiUrl) {
  if (syncApiUrl.includes('/api/video/sync-video')) {
    // 替换为 /api/crawler/post/sync
    return syncApiUrl.replace('/api/video/sync-video', '/api/crawler/post/sync');
  } else if (syncApiUrl.includes('/sync-video')) {
    // 替换为 /crawler/post/sync
    return syncApiUrl.replace('/sync-video', '/crawler/post/sync');
  } else {
    // 其它情况，追加 /crawler/post/sync
    const baseUrl = syncApiUrl.endsWith('/') ? syncApiUrl.slice(0, -1) : syncApiUrl;
    return `${baseUrl}/api/crawler/post/sync`;
  }
}

/**
 * 发送HTTP POST请求
 */
function httpPost(url, data, headers = {}) {
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
    
    // 根据文档，添加可选请求头
    // 注意：虽然文档说可选，但实际可能需要至少一个
    if (config.syncAuthUuid) {
      requestHeaders['X-AUTH-UUID'] = config.syncAuthUuid;
      // 如果 syncApiKey 未设置，使用 syncAuthUuid 作为 X-CRAWLER-TOKEN
      if (!config.syncApiKey) {
        requestHeaders['X-CRAWLER-TOKEN'] = config.syncAuthUuid;
      }
    }
    if (config.syncApiKey) {
      requestHeaders['X-CRAWLER-TOKEN'] = config.syncApiKey;
    }
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: requestHeaders,
      timeout: config.timeout
    };
    
    console.log('\n📤 发送请求:');
    console.log(`   URL: ${url}`);
    console.log(`   方法: ${options.method}`);
    console.log(`   Hostname: ${options.hostname}`);
    console.log(`   Port: ${options.port}`);
    console.log(`   Path: ${options.path}`);
    console.log(`   请求头:`);
    Object.entries(requestHeaders).forEach(([key, value]) => {
      if (key === 'Authorization' || key === 'X-CRAWLER-TOKEN' || key === 'X-AUTH-UUID') {
        const displayValue = String(value).length > 30 ? String(value).substring(0, 30) + '...' : value;
        console.log(`     ${key}: ${displayValue}`);
      } else {
        console.log(`     ${key}: ${value}`);
      }
    });
    console.log(`   请求体长度: ${body.length} bytes`);
    console.log(`   请求体内容:`);
    console.log(JSON.stringify(data, null, 2));
    
    const req = protocol.request(options, (res) => {
      let responseData = '';
      
      console.log(`\n📥 收到响应:`);
      console.log(`   HTTP状态码: ${res.statusCode}`);
      console.log(`   响应头:`, JSON.stringify(res.headers, null, 2));
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`   响应数据长度: ${responseData.length} bytes`);
        console.log(`   响应内容: ${responseData}`);
        
        resolve({
          status: res.statusCode,
          data: responseData,
          headers: res.headers
        });
      });
    });
    
    req.on('error', (error) => {
      console.error(`\n❌ 请求错误:`, error);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.error(`\n❌ 请求超时`);
      req.destroy();
      reject(new Error('请求超时'));
    });
    
    req.write(body);
    req.end();
  });
}

async function testSyncApi() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           根据文档测试同步帖子API                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  // 计算API地址
  const apiUrl = calculateSyncApiUrl(config.syncApiUrl);
  
  console.log('📋 配置信息:');
  console.log(`   syncApiUrl: ${config.syncApiUrl}`);
  console.log(`   计算后的API地址: ${apiUrl}`);
  console.log(`   syncAuthUuid: ${config.syncAuthUuid}`);
  console.log(`   syncApiKey: ${config.syncApiKey || '未设置'}`);
  console.log(`   postSyncUid: ${config.postSyncUid}`);
  console.log(`   postRoleCode: ${config.postRoleCode}`);
  console.log('');
  
  // 根据文档构建测试数据（使用文档中的示例格式）
  const testData = {
    // 必需字段
    source_id: 45869, // 文档示例值
    uid: config.postSyncUid,
    title: `测试帖子标题 - ${new Date().toISOString()}`,
    
    // 可选字段（根据文档示例）
    content: '<p>这是测试富文本内容</p><p>包含一些HTML标签</p>',
    description: '这是测试描述',
    cover_image: 'r2/path/cover.jpg', // 文档示例格式
    has_video: false,
    views_count: 123,
    likes_count: 10,
    comments_count: 2,
    shares_count: 0,
    purchase_count: 0,
    visibility: 'public',
    is_shared: false,
    assigned_role_code: config.postRoleCode,
    // created_at 和 updated_at 可选
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };
  
  console.log('📦 测试数据（根据文档格式）:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('');
  
  try {
    const response = await httpPost(apiUrl, testData);
    
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    API调用结果                               ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    console.log(`📊 HTTP状态码: ${response.status}`);
    
    if (response.status === 200) {
      try {
        const result = JSON.parse(response.data);
        console.log(`\n✅ API调用成功！`);
        console.log(`   响应数据:`, JSON.stringify(result, null, 2));
        
        if (result.success) {
          console.log(`\n✅✅✅ 数据已成功入库！`);
          if (result.post_id) {
            console.log(`   Post ID: ${result.post_id}`);
          }
          if (result.is_new !== undefined) {
            console.log(`   是否为新文章: ${result.is_new ? '是' : '否'}`);
          }
          if (result.message) {
            console.log(`   消息: ${result.message}`);
          }
        } else {
          console.log(`\n⚠️ API返回失败: ${result.message || '未知错误'}`);
        }
      } catch (e) {
        console.log(`\n⚠️ 响应解析失败: ${e.message}`);
        console.log(`   原始响应: ${response.data}`);
      }
    } else {
      try {
        const result = JSON.parse(response.data);
        console.log(`\n❌ API调用失败！`);
        console.log(`   错误信息: ${result.message || '未知错误'}`);
        console.log(`   完整响应:`, JSON.stringify(result, null, 2));
      } catch (e) {
        console.log(`\n❌ API调用失败！`);
        console.log(`   HTTP状态码: ${response.status}`);
        console.log(`   原始响应: ${response.data}`);
      }
    }
  } catch (error) {
    console.error(`\n❌ 请求异常: ${error.message}`);
    console.error(error.stack);
  }
  
  console.log('\n');
}

// 运行测试
testSyncApi().then(() => {
  console.log('测试完成');
  process.exit(0);
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
