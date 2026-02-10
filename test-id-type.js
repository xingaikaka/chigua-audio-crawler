/**
 * 测试长整数ID的精度问题
 * 验证 exists-batch API 返回的ID类型
 */

const UaaApiClient = require('./crawler/uaa/uaaApiClient');
const config = require('./config/uaa.json');

async function testIdType() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║          长整数ID精度测试                                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const apiClient = new UaaApiClient(config);
  
  // 使用数据库中实际的长整数ID
  const testItems = [
    { id: '1217838527400775680', article_id: '1217838527400775680', title: '姐姐的夜间催眠' },
    { id: '1217838449105702912', article_id: '1217838449105702912', title: '和新婚妻子的洞房之夜' }
  ];
  
  console.log('📌 测试数据（来自数据库）:');
  testItems.forEach((item, index) => {
    console.log(`   ${index + 1}. ID=${item.id} (${item.id.length}位)`);
    console.log(`      标题=${item.title}`);
  });
  console.log('');
  
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 调用 exists-batch API');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const results = await apiClient.checkAudioNovelsExistsBatch(testItems, null);
    
    console.log('✅ API调用成功!\n');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 检查返回的ID类型和精度');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    let allCorrect = true;
    
    testItems.forEach(item => {
      const originalId = item.id;
      const result = results[originalId];
      
      console.log(`📊 ID: ${originalId}`);
      console.log(`   原始ID (发送):  ${originalId}`);
      console.log(`   原始ID类型:     ${typeof originalId}`);
      console.log(`   原始ID长度:     ${originalId.length} 位`);
      
      if (result) {
        console.log(`   ✅ 找到结果`);
        console.log(`   exists:         ${result.exists}`);
        console.log(`   novel_id:       ${result.novel_id || 'null'}`);
        
        // 检查ID是否完全匹配
        const resultKeys = Object.keys(results);
        const matchingKey = resultKeys.find(key => key === originalId);
        
        if (matchingKey) {
          console.log(`   ✅ ID完全匹配: ${matchingKey === originalId ? '是' : '否'}`);
          console.log(`   返回key类型:    ${typeof matchingKey}`);
          console.log(`   返回key长度:    ${matchingKey.length} 位`);
          
          // 逐字符比较
          if (matchingKey !== originalId) {
            console.log(`   ❌ 字符比较失败！`);
            console.log(`      原始: ${originalId}`);
            console.log(`      返回: ${matchingKey}`);
            
            // 找出不同的位置
            for (let i = 0; i < Math.max(originalId.length, matchingKey.length); i++) {
              if (originalId[i] !== matchingKey[i]) {
                console.log(`      位置${i}: '${originalId[i] || '无'}' !== '${matchingKey[i] || '无'}'`);
              }
            }
            allCorrect = false;
          }
        } else {
          console.log(`   ❌ 找不到完全匹配的key`);
          console.log(`   可用的keys: ${resultKeys.join(', ')}`);
          allCorrect = false;
        }
      } else {
        console.log(`   ❌ 未找到结果`);
        console.log(`   results中的keys: ${Object.keys(results).join(', ')}`);
        allCorrect = false;
      }
      
      console.log('');
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔬 精度测试');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    testItems.forEach(item => {
      const id = item.id;
      
      // 测试JavaScript精度问题
      const asNumber = Number(id);
      const backToString = String(asNumber);
      
      console.log(`测试 ID: ${id}`);
      console.log(`  字符串长度:     ${id.length} 位`);
      console.log(`  转为数字:       ${asNumber}`);
      console.log(`  再转回字符串:   ${backToString}`);
      console.log(`  精度是否丢失:   ${id === backToString ? '否 ✅' : '是 ❌'}`);
      
      if (id !== backToString) {
        console.log(`  ⚠️  警告: 数字转换会导致精度丢失！`);
        console.log(`     原始: ${id}`);
        console.log(`     丢失: ${backToString}`);
        console.log(`     差异: ${id.split('').map((c, i) => c !== backToString[i] ? `位置${i}` : null).filter(Boolean).join(', ')}`);
      }
      console.log('');
    });
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                     测试结果                                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    if (allCorrect) {
      console.log('🎉 所有测试通过！ID类型和精度都正确！');
      console.log('   ✓ API返回的ID是字符串类型');
      console.log('   ✓ ID没有精度丢失');
      console.log('   ✓ 前后端ID完全匹配\n');
    } else {
      console.log('❌ 测试失败！发现以下问题:');
      console.log('   • 后端可能返回了数字类型的ID');
      console.log('   • ID发生了精度丢失');
      console.log('   • 前后端ID无法正确匹配\n');
      
      console.log('💡 解决方案:');
      console.log('   1. 确保后端返回字符串类型的ID');
      console.log('   2. 在Python中使用 str(source_id)');
      console.log('   3. 在JSON序列化时确保ID是字符串\n');
    }
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('   堆栈:', error.stack);
  }
}

// 运行测试
console.log('\n🚀 启动ID类型和精度测试...\n');

testIdType()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 测试异常:', error);
    process.exit(1);
  });
