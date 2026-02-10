/**
 * 测试R2配置和上传功能
 */

const R2Uploader = require('./crawler/r2Uploader');
const fs = require('fs');
const path = require('path');

// R2配置（从config/default.json读取）
const r2Config = {
  r2WorkerUrl: 'https://khjghjghjjh.xyz/api/upload',
  r2ApiKey: '', // 可选
  r2PreviewDomain: 'https://khjghjghjjh.xyz',
  r2ImageEncryptionKey: 'cYC8lOMnoUnqzeFhYcGCoLqNa44k9RMfmoorxeS7vIo=',
  r2ImageEncryptionIV: 'QuOHSIr6OPbRxShwqkaGQw=='
};

/**
 * 测试用例1: 上传测试图片
 */
async function testImageUpload() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║ 测试用例1: 上传测试图片                                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log('📋 R2配置:');
  console.log(`   Worker URL: ${r2Config.r2WorkerUrl}`);
  console.log(`   预览域名: ${r2Config.r2PreviewDomain}`);
  console.log(`   图片加密Key: ${r2Config.r2ImageEncryptionKey.substring(0, 20)}...`);
  console.log(`   图片加密IV: ${r2Config.r2ImageEncryptionIV.substring(0, 20)}...`);
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
      return false;
    }
  } catch (error) {
    console.error('\n❌ 上传异常:', error.message);
    console.error(error.stack);
    return false;
  }
}

/**
 * 测试用例2: 上传测试视频文件
 */
async function testVideoUpload() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║ 测试用例2: 上传测试视频文件                                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  try {
    const uploader = new R2Uploader(r2Config);
    
    // 创建一个简单的测试视频数据（最小MP4文件）
    // 这里使用一个很小的测试数据
    const testVideoData = Buffer.from('test video data');
    
    console.log('📤 开始上传测试视频...');
    console.log(`   视频大小: ${testVideoData.length} bytes`);
    console.log(`   目标路径: uploads/videos/test/test_video.mp4`);
    
    const result = await uploader.uploadVideoFile(
      testVideoData,
      'uploads/videos/test/test_video.mp4',
      'video/mp4'
    );
    
    console.log('\n📥 上传结果:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ 视频上传成功！');
      console.log(`   Resource Key: ${result.resource_key}`);
      console.log(`   URL: ${result.url || '未返回'}`);
      console.log(`   Filename: ${result.filename}`);
      
      // 构建预览URL
      const previewUrl = result.url || `${r2Config.r2PreviewDomain}/${result.resource_key}`;
      console.log(`\n   预览URL: ${previewUrl}`);
      
      return true;
    } else {
      console.log('\n❌ 视频上传失败！');
      console.log(`   错误: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error('\n❌ 上传异常:', error.message);
    console.error(error.stack);
    return false;
  }
}

/**
 * 测试用例3: 上传TS文件（M3U8视频片段）
 */
async function testTsFileUpload() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║ 测试用例3: 上传TS文件（M3U8视频片段）                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  try {
    const uploader = new R2Uploader(r2Config);
    
    // 创建一个简单的测试TS文件数据
    const testTsData = Buffer.from('test ts file data');
    
    console.log('📤 开始上传测试TS文件...');
    console.log(`   文件大小: ${testTsData.length} bytes`);
    console.log(`   目标路径: uploads/videos/test/segment_001.ts`);
    
    const result = await uploader.uploadVideoFile(
      testTsData,
      'uploads/videos/test/segment_001.ts',
      'video/mp2t'
    );
    
    console.log('\n📥 上传结果:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ TS文件上传成功！');
      console.log(`   Resource Key: ${result.resource_key}`);
      console.log(`   URL: ${result.url || '未返回'}`);
      console.log(`   Filename: ${result.filename}`);
      
      // 构建预览URL
      const previewUrl = result.url || `${r2Config.r2PreviewDomain}/${result.resource_key}`;
      console.log(`\n   预览URL: ${previewUrl}`);
      
      return true;
    } else {
      console.log('\n❌ TS文件上传失败！');
      console.log(`   错误: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error('\n❌ 上传异常:', error.message);
    console.error(error.stack);
    return false;
  }
}

/**
 * 测试用例4: 验证路径格式（确保包含uploads/前缀）
 */
async function testPathFormat() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║ 测试用例4: 验证路径格式                                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  try {
    const uploader = new R2Uploader(r2Config);
    
    const testImageData = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    
    // 测试不同的路径格式
    const testPaths = [
      'uploads/test/path_test.png',  // 正确格式（包含uploads/）
      'test/path_test.png',          // 缺少uploads/前缀
      'uploads/test/path_test2.png'   // 正确格式
    ];
    
    console.log('📋 测试路径格式:');
    for (const testPath of testPaths) {
      console.log(`\n   测试路径: ${testPath}`);
      
      const result = await uploader.uploadImageData(testImageData, testPath);
      
      if (result.success) {
        console.log(`   ✅ 成功`);
        console.log(`   Resource Key: ${result.resource_key}`);
        
        // 验证返回的路径是否包含uploads/前缀
        if (result.resource_key.startsWith('uploads/')) {
          console.log(`   ✅ 路径格式正确（包含uploads/前缀）`);
        } else {
          console.log(`   ⚠️ 路径格式可能不正确（缺少uploads/前缀）`);
        }
      } else {
        console.log(`   ❌ 失败: ${result.error}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('\n❌ 测试异常:', error.message);
    return false;
  }
}

/**
 * 主测试函数
 */
async function runAllTests() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           测试R2配置和上传功能                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const results = [];
  
  // 运行所有测试用例
  results.push(await testImageUpload());
  results.push(await testVideoUpload());
  results.push(await testTsFileUpload());
  results.push(await testPathFormat());
  
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
    console.log('\n✅✅✅ 所有测试用例都通过了！R2配置正确！✅✅✅\n');
  } else {
    console.log('\n⚠️ 部分测试用例失败，请检查R2配置和网络连接\n');
  }
}

// 运行测试
runAllTests().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
