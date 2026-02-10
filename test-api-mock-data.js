/**
 * 使用模拟数据测试同步帖子API
 * Token: UQ8k7P2nV6cXr9T1mK5Zs3YpH8dN4bJ0qL2vW7eA
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// 配置
const config = {
  apiBaseUrl: 'http://47.239.212.188:8880',
  authUuid: 'dd7d5b1b9f1348ec58eb3a1b884b93a2',
  crawlerToken: 'UQ8k7P2nV6cXr9T1mK5Zs3YpH8dN4bJ0qL2vW7eA',
  syncUid: '1765988676000011375',
  roleCode: 'jianzhi',
  timeout: 30000
};

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
      'X-CRAWLER-TOKEN': config.crawlerToken,
      'X-AUTH-UUID': config.authUuid,
      ...headers
    };
    
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
    console.log(`   请求头:`);
    console.log(`     X-CRAWLER-TOKEN: ${config.crawlerToken.substring(0, 20)}...`);
    console.log(`     X-AUTH-UUID: ${config.authUuid.substring(0, 20)}...`);
    console.log(`   请求体:`, JSON.stringify(data, null, 2));
    
    const req = protocol.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: responseData,
          headers: res.headers
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
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
 * 测试用例1: 基本帖子数据（最小必需字段）
 */
async function testCase1() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║ 测试用例1: 基本帖子数据（最小必需字段）                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  const testData = {
    source_id: 10001,
    uid: config.syncUid,
    title: '测试帖子1 - 基本数据'
  };
  
  try {
    const response = await httpPost(`${config.apiBaseUrl}/api/crawler/post/sync`, testData);
    console.log(`\n📊 结果: HTTP ${response.status}`);
    
    if (response.status === 200) {
      const result = JSON.parse(response.data);
      console.log(`✅ 成功！`, JSON.stringify(result, null, 2));
      return result.success;
    } else {
      const result = JSON.parse(response.data);
      console.log(`❌ 失败: ${result.message}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 异常: ${error.message}`);
    return false;
  }
}

/**
 * 测试用例2: 完整帖子数据（包含所有字段）
 */
async function testCase2() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║ 测试用例2: 完整帖子数据（包含所有字段）                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  const testData = {
    source_id: 10002,
    uid: config.syncUid,
    title: '测试帖子2 - 完整数据',
    content: '<p>这是完整的富文本内容</p><p>包含<strong>HTML</strong>标签</p><img src="uploads/test/image1.jpg" />',
    description: '这是测试描述信息',
    cover_image: 'uploads/covers/test_cover.jpg',
    has_video: false,
    views_count: 1000,
    likes_count: 50,
    comments_count: 10,
    shares_count: 5,
    purchase_count: 0,
    visibility: 'public',
    assigned_role_code: config.roleCode,
    is_shared: false,
    created_at: now,
    updated_at: now
  };
  
  try {
    const response = await httpPost(`${config.apiBaseUrl}/api/crawler/post/sync`, testData);
    console.log(`\n📊 结果: HTTP ${response.status}`);
    
    if (response.status === 200) {
      const result = JSON.parse(response.data);
      console.log(`✅ 成功！`, JSON.stringify(result, null, 2));
      return result.success;
    } else {
      const result = JSON.parse(response.data);
      console.log(`❌ 失败: ${result.message}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 异常: ${error.message}`);
    return false;
  }
}

/**
 * 测试用例3: 带视频的帖子
 */
async function testCase3() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║ 测试用例3: 带视频的帖子                                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  const testData = {
    source_id: 10003,
    uid: config.syncUid,
    title: '测试帖子3 - 带视频',
    content: '<p>这是带视频的帖子内容</p><video controls><source src="uploads/videos/test_video.mp4" /></video>',
    description: '包含视频的测试帖子',
    cover_image: 'uploads/covers/video_cover.jpg',
    has_video: true,
    views_count: 5000,
    likes_count: 200,
    comments_count: 30,
    shares_count: 10,
    purchase_count: 0,
    visibility: 'public',
    assigned_role_code: config.roleCode,
    is_shared: false,
    created_at: now,
    updated_at: now
  };
  
  try {
    const response = await httpPost(`${config.apiBaseUrl}/api/crawler/post/sync`, testData);
    console.log(`\n📊 结果: HTTP ${response.status}`);
    
    if (response.status === 200) {
      const result = JSON.parse(response.data);
      console.log(`✅ 成功！`, JSON.stringify(result, null, 2));
      return result.success;
    } else {
      const result = JSON.parse(response.data);
      console.log(`❌ 失败: ${result.message}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 异常: ${error.message}`);
    return false;
  }
}

/**
 * 测试用例4: 私有帖子
 */
async function testCase4() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║ 测试用例4: 私有帖子                                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  const testData = {
    source_id: 10004,
    uid: config.syncUid,
    title: '测试帖子4 - 私有帖子',
    content: '<p>这是私有帖子的内容</p>',
    description: '私有帖子测试',
    cover_image: 'uploads/covers/private_cover.jpg',
    has_video: false,
    views_count: 100,
    likes_count: 10,
    comments_count: 2,
    shares_count: 0,
    purchase_count: 0,
    visibility: 'private',
    assigned_role_code: config.roleCode,
    is_shared: false,
    created_at: now,
    updated_at: now
  };
  
  try {
    const response = await httpPost(`${config.apiBaseUrl}/api/crawler/post/sync`, testData);
    console.log(`\n📊 结果: HTTP ${response.status}`);
    
    if (response.status === 200) {
      const result = JSON.parse(response.data);
      console.log(`✅ 成功！`, JSON.stringify(result, null, 2));
      return result.success;
    } else {
      const result = JSON.parse(response.data);
      console.log(`❌ 失败: ${result.message}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 异常: ${error.message}`);
    return false;
  }
}

/**
 * 测试用例5: 长标题和长内容
 */
async function testCase5() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║ 测试用例5: 长标题和长内容                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  const longTitle = '这是一个非常长的标题，用来测试API对长标题的处理能力，看看是否能够正确保存和显示，标题长度超过了正常范围，包含了各种字符和标点符号！';
  const longContent = '<p>这是非常长的内容</p>'.repeat(50) + '<p>包含大量HTML标签和文本内容</p>'.repeat(50);
  
  const testData = {
    source_id: 10005,
    uid: config.syncUid,
    title: longTitle,
    content: longContent,
    description: '这是一个非常长的描述信息，用来测试API对长描述的处理能力。'.repeat(10),
    cover_image: 'uploads/covers/long_content_cover.jpg',
    has_video: false,
    views_count: 2000,
    likes_count: 100,
    comments_count: 20,
    shares_count: 5,
    purchase_count: 0,
    visibility: 'public',
    assigned_role_code: config.roleCode,
    is_shared: false,
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };
  
  try {
    const response = await httpPost(`${config.apiBaseUrl}/api/crawler/post/sync`, testData);
    console.log(`\n📊 结果: HTTP ${response.status}`);
    
    if (response.status === 200) {
      const result = JSON.parse(response.data);
      console.log(`✅ 成功！`, JSON.stringify(result, null, 2));
      return result.success;
    } else {
      const result = JSON.parse(response.data);
      console.log(`❌ 失败: ${result.message}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 异常: ${error.message}`);
    return false;
  }
}

/**
 * 主测试函数
 */
async function runAllTests() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           使用模拟数据测试同步帖子API                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log('📋 测试配置:');
  console.log(`   API地址: ${config.apiBaseUrl}`);
  console.log(`   Token: ${config.crawlerToken.substring(0, 20)}...`);
  console.log(`   UID: ${config.syncUid}`);
  console.log(`   角色代码: ${config.roleCode}`);
  console.log('');
  
  const results = [];
  
  // 运行所有测试用例
  results.push(await testCase1());
  results.push(await testCase2());
  results.push(await testCase3());
  results.push(await testCase4());
  results.push(await testCase5());
  
  // 统计结果
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                   测试结果统计                               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const successCount = results.filter(r => r === true).length;
  const totalCount = results.length;
  
  console.log(`总测试数: ${totalCount}`);
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${totalCount - successCount}`);
  console.log(`成功率: ${((successCount / totalCount) * 100).toFixed(1)}%`);
  
  if (successCount === totalCount) {
    console.log('\n✅✅✅ 所有测试用例都通过了！✅✅✅\n');
  } else {
    console.log('\n⚠️ 部分测试用例失败，请检查错误信息\n');
  }
}

// 运行测试
runAllTests().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
