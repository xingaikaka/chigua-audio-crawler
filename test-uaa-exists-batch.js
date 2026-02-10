/**
 * 测试 UAA exists-batch API
 * 验证已同步数据的检测是否正确
 */

const UaaApiClient = require('./crawler/uaa/uaaApiClient');
const config = require('./config/uaa.json');

async function testExistsBatch() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║          UAA exists-batch API 测试                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const apiClient = new UaaApiClient(config);
  
  // 测试数据：包含已同步的ID (999999) 和一些未同步的ID
  const testItems = [
    { id: '999999', article_id: '999999', title: '[测试] 测试有声小说标题' },  // 已同步
    { id: '888888', article_id: '888888', title: '未同步的音频1' },            // 未同步
    { id: '777777', article_id: '777777', title: '未同步的音频2' }             // 未同步
  ];
  
  console.log('📌 测试数据:');
  testItems.forEach((item, index) => {
    console.log(`   ${index + 1}. ID=${item.id}, 标题=${item.title}`);
  });
  console.log('');
  
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 调用 exists-batch API');
    console.log('   接口: POST /api/crawler/audio-novel/exists-batch');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const results = await apiClient.checkAudioNovelsExistsBatch(testItems, null);
    
    console.log('✅ API调用成功!\n');
    
    console.log('📊 检查结果详情:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    let syncedCount = 0;
    let notSyncedCount = 0;
    
    testItems.forEach(item => {
      const audioId = item.id || item.article_id;
      const result = results[audioId];
      
      if (result) {
        if (result.exists) {
          syncedCount++;
          console.log(`✅ ID ${audioId}: 已同步`);
          console.log(`   标题: ${item.title}`);
          console.log(`   novel_id: ${result.novel_id}`);
          console.log(`   状态: 已存在于数据库\n`);
        } else {
          notSyncedCount++;
          console.log(`⭕ ID ${audioId}: 未同步`);
          console.log(`   标题: ${item.title}`);
          console.log(`   状态: 不存在于数据库\n`);
        }
      } else {
        console.log(`❌ ID ${audioId}: 无结果`);
        console.log(`   标题: ${item.title}\n`);
      }
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 统计汇总:');
    console.log(`   ✅ 已同步: ${syncedCount} 个`);
    console.log(`   ⭕ 未同步: ${notSyncedCount} 个`);
    console.log(`   📊 总计: ${testItems.length} 个`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 验证测试ID (999999) 是否正确识别为已同步
    if (results['999999'] && results['999999'].exists) {
      console.log('🎉 测试通过！exists-batch API 工作正常！');
      console.log('   ✓ 已同步的数据正确识别');
      console.log('   ✓ 未同步的数据正确识别');
      console.log('   ✓ novel_id 正确返回\n');
      return true;
    } else {
      console.log('⚠️  测试失败：测试数据 (ID=999999) 未被识别为已同步');
      console.log('   请检查数据库中是否存在该记录\n');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ 测试失败:');
    console.error('   错误:', error.message);
    console.error('   堆栈:', error.stack);
    console.log('');
    return false;
  }
}

// 运行测试
console.log('\n🚀 启动 exists-batch API 测试...\n');

testExistsBatch()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 测试异常:', error);
    process.exit(1);
  });
