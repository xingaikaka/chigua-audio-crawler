/**
 * 简单的API测试脚本
 * 使用模拟数据测试同步API
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// 测试配置
const config = {
  apiBaseUrl: 'http://47.239.212.188:8880',
  token: 'dd7d5b1b9f1348ec58eb3a1b884b93a2', // X-AUTH-UUID 的值作为 token
  timeout: 30000
};

// 模拟测试数据
const testData = {
  source_id: 12345,
  uid: '1765988676000011375',
  title: '测试文章标题 - ' + new Date().toISOString(),
  content: '<p>这是测试内容</p><p>包含一些HTML标签</p>',
  description: '这是测试描述',
  cover_image: 'uploads/covers/test_12345.jpg',
  has_video: false,
  views_count: 100,
  likes_count: 10,
  comments_count: 5,
  shares_count: 2,
  purchase_count: 0,
  visibility: 'public',
  assigned_role_code: 'jianzhi',
  created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
  updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
};

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
        console.log(`     ${key}: ${value.substring(0, 30)}...`);
      } else {
        console.log(`     ${key}: ${value}`);
      }
    });
    console.log(`   请求体长度: ${body.length} bytes`);
    
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

async function testAPI() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    API测试开始                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log('📋 测试配置:');
  console.log(`   API地址: ${config.apiBaseUrl}`);
  console.log(`   Token: ${config.token}`);
  console.log('');
  
  console.log('📦 测试数据:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('');
  
  const url = `${config.apiBaseUrl}/api/crawler/post/sync`;
  
  // 测试1: 只使用 X-CRAWLER-TOKEN
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('测试1: 只使用 X-CRAWLER-TOKEN');
  console.log('═══════════════════════════════════════════════════════════════');
  
  try {
    const response1 = await httpPost(url, testData, {
      'X-CRAWLER-TOKEN': config.token
    });
    
    console.log('\n📊 测试1结果:');
    console.log(`   HTTP状态码: ${response1.status}`);
    
    if (response1.status === 200) {
      try {
        const result = JSON.parse(response1.data);
        console.log(`   ✅ 成功！响应:`, JSON.stringify(result, null, 2));
        if (result.success) {
          console.log(`\n✅✅✅ API调用成功！数据已入库！post_id=${result.post_id} ✅✅✅\n`);
          return;
        }
      } catch (e) {
        console.log(`   ⚠️ 响应解析失败: ${e.message}`);
      }
    } else {
      try {
        const result = JSON.parse(response1.data);
        console.log(`   ❌ 失败！错误: ${result.message || '未知错误'}`);
      } catch (e) {
        console.log(`   ❌ 失败！响应: ${response1.data}`);
      }
    }
  } catch (error) {
    console.error(`   ❌ 异常: ${error.message}`);
  }
  
  // 测试2: 只使用 Authorization: Bearer
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('测试2: 只使用 Authorization: Bearer');
  console.log('═══════════════════════════════════════════════════════════════');
  
  try {
    const response2 = await httpPost(url, testData, {
      'Authorization': `Bearer ${config.token}`
    });
    
    console.log('\n📊 测试2结果:');
    console.log(`   HTTP状态码: ${response2.status}`);
    
    if (response2.status === 200) {
      try {
        const result = JSON.parse(response2.data);
        console.log(`   ✅ 成功！响应:`, JSON.stringify(result, null, 2));
        if (result.success) {
          console.log(`\n✅✅✅ API调用成功！数据已入库！post_id=${result.post_id} ✅✅✅\n`);
          return;
        }
      } catch (e) {
        console.log(`   ⚠️ 响应解析失败: ${e.message}`);
      }
    } else {
      try {
        const result = JSON.parse(response2.data);
        console.log(`   ❌ 失败！错误: ${result.message || '未知错误'}`);
      } catch (e) {
        console.log(`   ❌ 失败！响应: ${response2.data}`);
      }
    }
  } catch (error) {
    console.error(`   ❌ 异常: ${error.message}`);
  }
  
  // 测试3: 同时使用 X-CRAWLER-TOKEN 和 Authorization: Bearer
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('测试3: 同时使用 X-CRAWLER-TOKEN 和 Authorization: Bearer');
  console.log('═══════════════════════════════════════════════════════════════');
  
  try {
    const response3 = await httpPost(url, testData, {
      'X-CRAWLER-TOKEN': config.token,
      'Authorization': `Bearer ${config.token}`
    });
    
    console.log('\n📊 测试3结果:');
    console.log(`   HTTP状态码: ${response3.status}`);
    
    if (response3.status === 200) {
      try {
        const result = JSON.parse(response3.data);
        console.log(`   ✅ 成功！响应:`, JSON.stringify(result, null, 2));
        if (result.success) {
          console.log(`\n✅✅✅ API调用成功！数据已入库！post_id=${result.post_id} ✅✅✅\n`);
          return;
        }
      } catch (e) {
        console.log(`   ⚠️ 响应解析失败: ${e.message}`);
      }
    } else {
      try {
        const result = JSON.parse(response3.data);
        console.log(`   ❌ 失败！错误: ${result.message || '未知错误'}`);
      } catch (e) {
        console.log(`   ❌ 失败！响应: ${response3.data}`);
      }
    }
  } catch (error) {
    console.error(`   ❌ 异常: ${error.message}`);
  }
  
  // 测试4: 使用 X-AUTH-UUID 作为 X-CRAWLER-TOKEN
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('测试4: 使用 X-AUTH-UUID 和 X-CRAWLER-TOKEN (相同值)');
  console.log('═══════════════════════════════════════════════════════════════');
  
  try {
    const response4 = await httpPost(url, testData, {
      'X-AUTH-UUID': config.token,
      'X-CRAWLER-TOKEN': config.token,
      'Authorization': `Bearer ${config.token}`
    });
    
    console.log('\n📊 测试4结果:');
    console.log(`   HTTP状态码: ${response4.status}`);
    
    if (response4.status === 200) {
      try {
        const result = JSON.parse(response4.data);
        console.log(`   ✅ 成功！响应:`, JSON.stringify(result, null, 2));
        if (result.success) {
          console.log(`\n✅✅✅ API调用成功！数据已入库！post_id=${result.post_id} ✅✅✅\n`);
          return;
        }
      } catch (e) {
        console.log(`   ⚠️ 响应解析失败: ${e.message}`);
      }
    } else {
      try {
        const result = JSON.parse(response4.data);
        console.log(`   ❌ 失败！错误: ${result.message || '未知错误'}`);
        console.log(`\n❌❌❌ 所有测试都失败了！请检查Token值是否正确！❌❌❌\n`);
      } catch (e) {
        console.log(`   ❌ 失败！响应: ${response4.data}`);
      }
    }
  } catch (error) {
    console.error(`   ❌ 异常: ${error.message}`);
  }
  
  console.log('\n');
}

// 运行测试
testAPI().then(() => {
  console.log('测试完成');
  process.exit(0);
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
