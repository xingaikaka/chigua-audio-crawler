/**
 * 封面图生成器（基于 sharp，支持 WebP / JPEG / PNG 等所有格式）
 *
 * 规则：
 *   1 张图片 → 直接缩放/裁剪到 1300×640
 *   2 张图片 → 左右各 650×640 拼接
 *   3 张及以上 → 左侧大图 866×640 + 右侧两张各 434×320 上下叠放
 */

const sharp = require('sharp');
const https = require('https');
const http = require('http');

const COVER_W = 1300;
const COVER_H = 640;

// ─── 下载图片字节 ──────────────────────────────────────────────────────────

async function fetchImageBuffer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://t66y.com/',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        },
        timeout,
        rejectUnauthorized: false
      };
      const req = protocol.request(options, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers['location'];
          if (loc) return resolve(fetchImageBuffer(loc, timeout));
          return reject(new Error('重定向无目标'));
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (buf.length < 100) return reject(new Error(`图片数据太小: ${buf.length} bytes`));
          resolve(buf);
        });
        res.on('error', reject);
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('下载超时')); });
      req.on('error', reject);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ─── 下载并调整图片尺寸（cover 模式：保持比例，裁剪填满目标区域） ─────────

async function loadAndResize(url, w, h) {
  const buf = await fetchImageBuffer(url);
  return sharp(buf)
    .resize(w, h, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 85 })
    .toBuffer();
}

// ─── 主函数：根据图片数量生成封面 Buffer ──────────────────────────────────

/**
 * @param {string[]} imageUrls  可用的图片 URL 列表（取前3张）
 * @returns {Promise<Buffer|null>}  JPEG buffer，失败时返回 null
 */
async function generateCoverBuffer(imageUrls) {
  if (!imageUrls || imageUrls.length === 0) return null;

  const urls = imageUrls.slice(0, 3);

  try {
    if (urls.length === 1) {
      // ── 1 张：缩放裁剪到全画布 ──────────────────────────────────
      return await loadAndResize(urls[0], COVER_W, COVER_H);
    }

    if (urls.length === 2) {
      // ── 2 张：左右各半 ───────────────────────────────────────────
      const halfW = Math.floor(COVER_W / 2);
      const [leftBuf, rightBuf] = await Promise.all([
        loadAndResize(urls[0], halfW, COVER_H),
        loadAndResize(urls[1], COVER_W - halfW, COVER_H)
      ]);

      return sharp({
        create: { width: COVER_W, height: COVER_H, channels: 3, background: { r: 17, g: 17, b: 17 } }
      })
        .composite([
          { input: leftBuf,  left: 0,      top: 0 },
          { input: rightBuf, left: halfW,  top: 0 }
        ])
        .jpeg({ quality: 85 })
        .toBuffer();
    }

    // ── 3 张：左侧大图 + 右侧两张上下叠 ────────────────────────────
    const leftW  = Math.floor(COVER_W * 2 / 3);  // 866
    const rightW = COVER_W - leftW;               // 434
    const halfH  = Math.floor(COVER_H / 2);       // 320

    const [imgL, imgRT, imgRB] = await Promise.all([
      loadAndResize(urls[0], leftW,  COVER_H),
      loadAndResize(urls[1], rightW, halfH),
      loadAndResize(urls[2], rightW, COVER_H - halfH)
    ]);

    return sharp({
      create: { width: COVER_W, height: COVER_H, channels: 3, background: { r: 17, g: 17, b: 17 } }
    })
      .composite([
        { input: imgL,  left: 0,      top: 0     },
        { input: imgRT, left: leftW,  top: 0     },
        { input: imgRB, left: leftW,  top: halfH }
      ])
      .jpeg({ quality: 85 })
      .toBuffer();

  } catch (err) {
    console.warn('[CoverGenerator] 生成封面失败:', err.message);
    return null;
  }
}

module.exports = { generateCoverBuffer };
