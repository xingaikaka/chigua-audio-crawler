/**
 * 图片水印处理工具模块
 * 支持多水印、自定义尺寸和位置（使用 jimp）
 * @param {Buffer} imageData - 原始图片字节数据
 * @param {Array} watermarks - 水印配置数组 [{ imageData: base64, width, height, xRatio, yRatio }]
 * @returns {Promise<Buffer|null>} 添加水印后的图片字节数据
 */

const Jimp = require('jimp');
// Jimp v1.6+ 主 API 在 Jimp.Jimp 下
const J = Jimp.Jimp || Jimp;

/**
 * 为图片添加多个水印
 * @param {Buffer} imageData - 原始图片的字节数据
 * @param {Array} watermarks - 水印配置数组，每项包含:
 *   - imageData: string (base64 格式，含 data:image/xxx;base64, 前缀)
 *   - width: number 水印显示宽度（像素）
 *   - height: number 水印显示高度（像素）
 *   - xRatio: number 0-1，水印左上角 X 位置占原图宽度的比例
 *   - yRatio: number 0-1，水印左上角 Y 位置占原图高度的比例
 * @returns {Promise<Buffer|null>} 添加水印后的图片 Buffer，失败返回 null
 */
async function addWatermarksToImage(imageData, watermarks) {
  if (!watermarks || !Array.isArray(watermarks) || watermarks.length === 0) {
    return imageData;
  }

  try {
    const originalImage = await J.read(imageData);
    const { width, height } = originalImage.bitmap;

    for (const wm of watermarks) {
      if (!wm.imageData || !wm.width || !wm.height) continue;

      let base64Data = wm.imageData;
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }
      const wmBuffer = Buffer.from(base64Data, 'base64');

      const watermarkImage = await J.read(wmBuffer);
      const wmWidth = Math.min(Math.max(1, parseInt(wm.width) || 50), width);
      const wmHeight = Math.min(Math.max(1, parseInt(wm.height) || 50), height);

      const xRatio = Math.max(0, Math.min(1, parseFloat(wm.xRatio) ?? 0.8));
      const yRatio = Math.max(0, Math.min(1, parseFloat(wm.yRatio) ?? 0.8));

      // 位置选择器存储的是水印左上角占画布宽高的比例，此处按相同比例映射到原图
      const rawX = width * xRatio;
      const rawY = height * yRatio;
      const watermarkX = Math.floor(Math.max(0, Math.min(width - wmWidth, rawX)));
      const watermarkY = Math.floor(Math.max(0, Math.min(height - wmHeight, rawY)));

      watermarkImage.resize({ w: wmWidth, h: wmHeight });

      originalImage.composite(watermarkImage, watermarkX, watermarkY, {
        mode: Jimp.BlendMode.SRC_OVER,
        opacitySource: 1.0,
        opacityDest: 1.0
      });
    }

    const isJpeg = imageData[0] === 0xFF && imageData[1] === 0xD8;
    const ext = isJpeg ? 'jpeg' : 'png';
    const mime = ext === 'jpeg' ? Jimp.JimpMime.jpeg : Jimp.JimpMime.png;
    const options = ext === 'jpeg' ? { quality: 95 } : {};

    const watermarkedBuffer = await originalImage.getBuffer(mime, options);

    return watermarkedBuffer;
  } catch (error) {
    console.error('[Watermark] 添加水印失败:', error.message);
    return null;
  }
}

module.exports = {
  addWatermarksToImage
};
