const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const results = [];
  const dir = '/tmp/diffshot-qa-desktop';
  fs.mkdirSync(dir, { recursive: true });

  for (const pg of ['/', '/dashboard.html', '/docs.html']) {
    await page.goto('http://localhost:3008' + pg, { waitUntil: 'networkidle0', timeout: 15000 });
    
    // Screenshot
    await page.screenshot({ path: path.join(dir, pg.replace(/\//g, '_') + '.png'), fullPage: true });
    
    // Check horizontal scroll
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await page.evaluate(() => document.documentElement.clientWidth);
    if (scrollW > clientW + 5) results.push(`FAIL: ${pg} horizontal scroll (${scrollW} > ${clientW})`);
    else results.push(`PASS: ${pg} no horizontal scroll`);
    
    // Check text overflow
    const overflows = await page.evaluate(() => {
      const o = [];
      document.querySelectorAll('*').forEach(el => {
        if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
          const s = getComputedStyle(el);
          if (s.overflow === 'visible' && s.overflowX === 'visible') {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && el.scrollWidth > el.clientWidth + 10) {
              o.push({ tag: el.tagName, cls: el.className?.toString().slice(0, 50), text: el.textContent?.slice(0, 40) });
            }
          }
        }
      });
      return o;
    });
    if (overflows.length) results.push(`WARN: ${pg} overflows: ${JSON.stringify(overflows.slice(0,3))}`);
    else results.push(`PASS: ${pg} no overflows`);
    
    // Console errors
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    
    // Check images
    const brokenImgs = await page.evaluate(() => {
      return [...document.querySelectorAll('img')].filter(i => !i.naturalWidth && i.src).map(i => i.src);
    });
    if (brokenImgs.length) results.push(`FAIL: ${pg} broken images: ${brokenImgs}`);
    else results.push(`PASS: ${pg} images OK`);
    
    // Font check
    const fontOk = await page.evaluate(() => document.fonts.check('16px Inter'));
    results.push(fontOk ? `PASS: ${pg} Inter font loaded` : `WARN: ${pg} Inter font not loaded`);
  }
  
  console.log(results.join('\n'));
  await browser.close();
})();
