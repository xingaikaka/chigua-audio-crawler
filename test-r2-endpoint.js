/**
 * 测试R2 Worker的不同端点和方法
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const r2WorkerUrl = 'https://khjghjghjjh.xyz/api/upload';

/**
 * 测试不同的HTTP方法和端点
 */
async function testEndpoint(method, path = '/api/upload') {
  return new Promise((resolve) => {
    const urlObj = new URL(r2WorkerUrl);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: path,
      method: method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 10000
    };
    
    console.log(`\n测试: ${method} ${path}`);
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`  状态码: ${res.statusCode}`);
        console.log(`  响应: ${data.substring(0, 200)}`);
        resolve({ status: res.statusCode, data });
      });
    });
    
    req.on('error', (error) => {
      console.log(`  错误: ${error.message}`);
      resolve({ status: 0, error: error.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log(`  超时`);
      resolve({ status: 0, error: 'timeout' });
    });
    
    if (method === 'POST' || method === 'PUT') {
      req.write('test');
    }
    req.end();
  });
}

async function testAllEndpoints() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           测试R2 Worker端点和方法                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log(`R2 Worker URL: ${r2WorkerUrl}\n`);
  
  // 测试不同的方法和路径
  const tests = [
    { method: 'GET', path: '/api/upload' },
    { method: 'POST', path: '/api/upload' },
    { method: 'PUT', path: '/api/upload' },
    { method: 'GET', path: '/upload' },
    { method: 'POST', path: '/upload' },
    { method: 'PUT', path: '/upload' },
  ];
  
  for (const test of tests) {
    await testEndpoint(test.method, test.path);
    await new Promise(resolve => setTimeout(resolve, 500)); // 避免请求过快
  }
  
  console.log('\n测试完成\n');
}

testAllEndpoints();
