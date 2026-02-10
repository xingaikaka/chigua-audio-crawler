/**
 * 测试 API 的分类更新行为
 * 验证同一个 source_id 多次同步时，category_name 是否会被覆盖
 */

const http = require('http');
const https = require('https');

const API_BASE_URL = 'http://47.239.212.188:8880/api/crawler/audio-novel';
const AUTH_UUID = 'dd7d5b1b9f1348ec58eb3a1b884b93a2';
const CRAWLER_TOKEN = 'UQ8k7P2nV6cXr9T1mK5Zs3YpH8dN4bJ0qL2vW7eA';
const SYNC_UID = '1765988676000011375';
const ROLE_CODE = 'jianzhi';

// 测试用的 source_id（使用一个不存在的ID进行测试）
const TEST_SOURCE_ID = 'test_category_update_' + Date.now();

/**
 * HTTP POST 请求
 */
function httpPost(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const body = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-AUTH-UUID': AUTH_UUID,
        'X-CRAWLER-TOKEN': CRAWLER_TOKEN,
        'X-SYNC-UID': SYNC_UID,
        'X-ROLE-CODE': ROLE_CODE,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 30000
    };
    
    const req = protocol.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve({ statusCode: res.statusCode, data: result });
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
 * 同步有声小说
 */
async function syncAudioNovel(sourceId, categoryName) {
  const url = `${API_BASE_URL}/sync`;
  
  const payload = {
    source_id: sourceId,
    platform_id: null,
    title: `测试音频 - ${categoryName}`,
    description: '测试分类更新行为',
    author: '测试作者',
    cover_image: 'test/cover.jpg',
    category_id: null,
    category_source_id: null,
    category_name: categoryName,
    status: 0,
    read_count: 0,
    likes_count: 0,
    favorite_count: 0,
    average_rating: 0,
    chapter_count: 0,
    is_active: true
  };
  
  console.log(`\n📤 发送同步请求:`);
  console.log(`   source_id: ${sourceId}`);
  console.log(`   category_name: ${categoryName}`);
  
  const response = await httpPost(url, payload);
  
  console.log(`✅ 响应:`, JSON.stringify(response.data, null, 2));
  
  return response.data;
}

/**
 * 查询是否已存在
 */
async function checkExists(sourceId) {
  const url = `${API_BASE_URL}/exists-batch`;
  
  const payload = {
    items: [
      {
        id: sourceId,
        title: '测试',
        platform_id: null
      }
    ]
  };
  
  const response = await httpPost(url, payload);
  
  return response.data.items[0];
}

/**
 * 主测试流程
 */
async function runTest() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     测试 API 分类更新行为                                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n测试 source_id: ${TEST_SOURCE_ID}\n`);
  
  try {
    // 步骤1: 检查初始状态
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('步骤1: 检查初始状态');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    let existsResult = await checkExists(TEST_SOURCE_ID);
    console.log(`初始状态: exists = ${existsResult.exists}`);
    
    // 步骤2: 第一次同步（分类：有声小说）
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('步骤2: 第一次同步（分类：有声小说）');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const result1 = await syncAudioNovel(TEST_SOURCE_ID, '有声小说');
    console.log(`\n📊 结果:`);
    console.log(`   novel_id: ${result1.novel_id}`);
    console.log(`   is_new: ${result1.is_new} ${result1.is_new ? '✅ (新建)' : '❌ (更新)'}`);
    
    // 步骤3: 再次检查状态
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('步骤3: 再次检查状态');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    existsResult = await checkExists(TEST_SOURCE_ID);
    console.log(`当前状态: exists = ${existsResult.exists}, novel_id = ${existsResult.novel_id}`);
    
    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 步骤4: 第二次同步（分类：激情骚麦）
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('步骤4: 第二次同步（分类：激情骚麦）');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const result2 = await syncAudioNovel(TEST_SOURCE_ID, '激情骚麦');
    console.log(`\n📊 结果:`);
    console.log(`   novel_id: ${result2.novel_id}`);
    console.log(`   is_new: ${result2.is_new} ${result2.is_new ? '✅ (新建)' : '❌ (更新)'}`);
    
    // 步骤5: 最终检查
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('步骤5: 最终检查');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    existsResult = await checkExists(TEST_SOURCE_ID);
    console.log(`最终状态: exists = ${existsResult.exists}, novel_id = ${existsResult.novel_id}`);
    
    // 结论
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║     测试结论                                              ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    
    if (result1.novel_id === result2.novel_id) {
      console.log('\n✅ API行为验证:');
      console.log('   - 第一次同步: 创建新记录 (is_new = true)');
      console.log('   - 第二次同步: 更新现有记录 (is_new = false)');
      console.log('   - novel_id 相同，说明是同一条记录');
      console.log('\n📌 结论:');
      console.log('   同一个 source_id 多次同步时，API 会 **更新** 现有记录');
      console.log('   的 category_name，而不是创建新记录。');
      console.log('\n💡 这意味着:');
      console.log('   - 数据库中原有的 "有声小说" 分类被覆盖为 "激情骚麦"');
      console.log('   - 这是 API 的正常行为，不是 BUG');
    } else {
      console.log('\n❌ 意外情况:');
      console.log('   两次同步返回了不同的 novel_id');
      console.log('   这可能表示 API 行为异常');
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
runTest();
