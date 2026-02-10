/**
 * 测试R2上传（使用正确的端点）
 */

const R2Uploader = require('./crawler/r2Uploader');

// R2配置 - 使用 /upload 端点而不是 /api/upload
const r2Config = {
  r2WorkerUrl: 'https://khjghjghjjh.xyz/upload', // 注意：使用 /upload 而不是 /api/upload
  r2ApiKey: '',
  r2PreviewDomain: 'https://khjghjghjjh.xyz',
  r2ImageEncryptionKey: 'cYC8lOMnoUnqzeFhYcGCoLqNa44k9RMfmoorxeS7vIo=',
  r2ImageEncryptionIV: 'QuOHSIr6OPbRxShwqkaGQw=='
};

async function testUpload() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           测试R2上传（使用正确的端点）                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log('📋 R2配置:');
  console.log(`   Worker URL: ${r2Config.r2WorkerUrl}`);
  console.log(`   预览域名: ${r2Config.r2PreviewDomain}`);
  console.log('');
  
  try {
    const uploader = new R2Uploader(r2Config);
    
    // 创建一个简单的测试图片数据（1x1像素的PNG）
    const testImageData = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    
    console.log('📤 开始上传测试图片...');
    console.log(`   图片大小: ${testImageData.length} bytes`);
    console.log(`   目标路径: uploads/test/test_image.png`);
    
    const result = await uploader.uploadImageData(
      testImageData,
      'uploads/test/test_image.png'
    );
    
    console.log('\n📥 上传结果:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ 图片上传成功！');
      console.log(`   Resource Key: ${result.resource_key}`);
      console.log(`   URL: ${result.url || '未返回'}`);
      console.log(`   Filename: ${result.filename}`);
      
      // 构建预览URL
      const previewUrl = result.url || `${r2Config.r2PreviewDomain}/${result.resource_key}`;
      console.log(`\n   预览URL: ${previewUrl}`);
      
      return true;
    } else {
      console.log('\n❌ 图片上传失败！');
      console.log(`   错误: ${result.error}`);
      if (result.responseData) {
        console.log(`   响应数据: ${result.responseData.substring(0, 500)}`);
      }
      return false;
    }
  } catch (error) {
    console.error('\n❌ 上传异常:', error.message);
    console.error(error.stack);
    return false;
  }
}

testUpload().then((success) => {
  if (success) {
    console.log('\n✅✅✅ R2上传测试成功！✅✅✅\n');
  } else {
    console.log('\n❌ R2上传测试失败\n');
  }
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
