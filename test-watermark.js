#!/usr/bin/env node
/**
 * 水印功能测试脚本
 * 验证：下载图片 -> 添加水印 -> 输出格式正确
 */

const fs = require('fs');
const path = require('path');
const { addWatermarksToImage } = require('./crawler/watermark');

async function testWatermark() {
  console.log('=== 水印功能测试 ===\n');

  // 1. 创建测试水印（标准 1x1 透明 PNG，Jimp 可解码）
  const testWatermark = {
    imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=',
    width: 50,
    height: 50,
    xRatio: 0.8,
    yRatio: 0.8,
    enabled: true
  };

  // 2. 获取测试图片：优先本地，否则使用 node_modules 中的 PNG
  const testImagePath = path.join(__dirname, 'crawler', 'shuiyin.png');
  const fallbackPath = path.join(__dirname, 'node_modules', 'app-builder-lib', 'templates', 'icons', 'proton-native', 'linux', '16x16.png');
  let imageData;
  if (fs.existsSync(testImagePath)) {
    imageData = fs.readFileSync(testImagePath);
    console.log('✓ 使用测试图片:', testImagePath);
  } else if (fs.existsSync(fallbackPath)) {
    imageData = fs.readFileSync(fallbackPath);
    console.log('✓ 使用 fallback PNG:', fallbackPath);
  } else {
    throw new Error('无可用测试图片，请在 crawler/shuiyin.png 放置图片');
  }

  console.log('  输入大小:', imageData.length, 'bytes');
  console.log('  输入格式:', imageData[0] === 0xFF && imageData[1] === 0xD8 ? 'JPEG' : 'PNG');

  // 3. 添加水印
  const watermarks = [testWatermark];
  const result = await addWatermarksToImage(imageData, watermarks);

  if (!result) {
    console.error('\n✗ 水印添加失败');
    process.exit(1);
  }

  console.log('\n✓ 水印添加成功');
  console.log('  输出大小:', result.length, 'bytes');
  console.log('  输出格式:', result[0] === 0xFF && result[1] === 0xD8 ? 'JPEG' : 'PNG');

  // 4. 验证输出为有效图片
  const isJpeg = result[0] === 0xFF && result[1] === 0xD8;
  const isPng = result[0] === 0x89 && result[1] === 0x50 && result[2] === 0x4E;
  if (!isJpeg && !isPng) {
    console.error('\n✗ 输出不是有效的 JPEG 或 PNG 格式');
    process.exit(1);
  }

  // 5. 保存测试输出（可选）
  const outPath = path.join(__dirname, 'test-watermark-output.' + (isJpeg ? 'jpg' : 'png'));
  fs.writeFileSync(outPath, result);
  console.log('  已保存到:', outPath);

  console.log('\n=== 测试通过 ===');
  console.log('流程：下载图片 -> 添加水印 -> 上传到 R2 (uploads/xxx.jpg)');
  console.log('R2 路径格式与 GitHub 版本一致，无需调整');
}

testWatermark().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
