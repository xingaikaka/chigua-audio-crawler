/**
 * API测试脚本
 * 使用模拟数据测试同步API
 */

const ApiClient = require('./crawler/apiClient');

// 从配置文件读取配置
const config = require('./config/default.json');

// 创建API客户端
const apiClient = new ApiClient({
  apiBaseUrl: process.env.API_BASE_URL || config.apiBaseUrl || 'http://47.239.212.188:8880',
  apiToken: process.env.API_TOKEN || '',
  authUuid: process.env.AUTH_UUID || 'dd7d5b1b9f1348ec58eb3a1b884b93a2',
  crawlerToken: process.env.CRAWLER_TOKEN || 'dd7d5b1b9f1348ec58eb3a1b884b93a2', // X-CRAWLER-TOKEN (使用X-AUTH-UUID的值)
  requestTimeout: 60000
});

// 模拟测试数据
const testData = {
  source_id: 12345, // 测试用的source_id
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

async function testSyncAPI() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    API同步测试开始                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log('📋 测试配置:');
  console.log(`   - API地址: ${apiClient.baseUrl}`);
  console.log(`   - X-AUTH-UUID: ${apiClient.authUuid || '未设置'}`);
  console.log(`   - X-CRAWLER-TOKEN: ${apiClient.crawlerToken ? '已设置' : '未设置'} (必需)`);
  console.log(`   - API Token: ${apiClient.apiToken ? '已设置' : '未设置'}`);
  console.log('');
  
  console.log('📦 测试数据:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('');
  
  try {
    console.log('🚀 开始调用同步API...\n');
    
    const result = await apiClient.syncPost(testData);
    
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    API调用结果                               ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    if (result.success) {
      console.log('✅ API调用成功！');
      console.log(`   - post_id: ${result.post_id}`);
      console.log(`   - is_new: ${result.is_new || false}`);
      console.log(`   - message: ${result.message}`);
      console.log('\n✅ 数据已成功入库！');
    } else {
      console.log('❌ API调用失败！');
      console.log(`   - 错误信息: ${result.message}`);
      console.log('\n❌ 数据未入库！');
    }
    
    console.log('\n完整响应:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    API调用异常                               ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    console.error('❌ API调用异常！');
    console.error(`   - 错误信息: ${error.message}`);
    console.error(`   - 错误堆栈:`, error.stack);
  }
  
  console.log('\n');
}

// 运行测试
testSyncAPI().then(() => {
  console.log('测试完成');
  process.exit(0);
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
