const puppeteer = require('puppeteer');
const sharp = require('sharp');

let browser = null;

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
  }
  return browser;
}

async function takeScreenshot(url, width = 1280, height = 800) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width, height });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const buf = await page.screenshot({ type: 'png', fullPage: false });
    return buf;
  } finally {
    await page.close();
  }
}

async function computeDiff(img1Buf, img2Buf) {
  // Normalize both images to the same dimensions
  const meta1 = await sharp(img1Buf).metadata();
  const meta2 = await sharp(img2Buf).metadata();
  const w = Math.max(meta1.width, meta2.width);
  const h = Math.max(meta1.height, meta2.height);

  const raw1 = await sharp(img1Buf).resize(w, h, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).raw().toBuffer();
  const raw2 = await sharp(img2Buf).resize(w, h, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).raw().toBuffer();

  const channels = 3;
  const totalPixels = w * h;
  let changedPixels = 0;
  const diffBuf = Buffer.alloc(w * h * 4); // RGBA output

  const threshold = 30; // per-channel difference threshold

  for (let i = 0; i < totalPixels; i++) {
    const si = i * channels;
    const di = i * 4;
    const dr = Math.abs(raw1[si] - raw2[si]);
    const dg = Math.abs(raw1[si + 1] - raw2[si + 1]);
    const db = Math.abs(raw1[si + 2] - raw2[si + 2]);

    if (dr > threshold || dg > threshold || db > threshold) {
      changedPixels++;
      // Red overlay for changed pixels
      diffBuf[di] = 255;     // R
      diffBuf[di + 1] = 50;  // G
      diffBuf[di + 2] = 50;  // B
      diffBuf[di + 3] = 200; // A
    } else {
      // Dimmed original
      diffBuf[di] = Math.round(raw2[si] * 0.3);
      diffBuf[di + 1] = Math.round(raw2[si + 1] * 0.3);
      diffBuf[di + 2] = Math.round(raw2[si + 2] * 0.3);
      diffBuf[di + 3] = 255;
    }
  }

  const diffImage = await sharp(diffBuf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  const diffPercent = Math.round((changedPixels / totalPixels) * 10000) / 100;

  return {
    diffImage,
    diffPercent,
    changedPixels,
    totalPixels,
    width: w,
    height: h,
  };
}

module.exports = { takeScreenshot, computeDiff };
