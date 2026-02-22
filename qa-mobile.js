const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3008';
const PAGES = ['/', '/dashboard.html', '/docs.html'];
const VIEWPORTS = [
  { width: 375, height: 667, label: '375x667' },
  { width: 390, height: 844, label: '390x844' },
  { width: 412, height: 915, label: '412x915' },
];

const SCREENSHOT_DIR = path.join(__dirname, 'qa-screenshots-mobile');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'] });

  for (const vp of VIEWPORTS) {
    for (const pg of PAGES) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true });
      const url = BASE + pg;
      const tag = `${vp.label} ${pg}`;
      const r = { tag, issues: [] };

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } catch (e) {
        r.issues.push(`LOAD FAIL: ${e.message}`);
        results.push(r);
        await page.close();
        continue;
      }

      // Screenshot
      const ssName = `${vp.label}_${pg.replace(/\//g, '_').replace(/\.html/, '')}.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, ssName), fullPage: true });

      // 1. Horizontal scroll check
      const scrollCheck = await page.evaluate(() => {
        const sw = document.documentElement.scrollWidth;
        const cw = window.innerWidth;
        if (sw > cw) {
          // Find offending element
          const all = document.querySelectorAll('*');
          let worst = null, worstW = 0;
          for (const el of all) {
            const rect = el.getBoundingClientRect();
            if (rect.right > cw && rect.right > worstW) {
              worstW = rect.right;
              worst = { tag: el.tagName, id: el.id, class: el.className, right: rect.right, width: rect.width };
            }
          }
          return { overflow: true, scrollWidth: sw, clientWidth: cw, offender: worst };
        }
        return { overflow: false };
      });
      if (scrollCheck.overflow) {
        r.issues.push(`HORIZONTAL SCROLL: scrollWidth=${scrollCheck.scrollWidth} > clientWidth=${scrollCheck.clientWidth}. Offender: ${JSON.stringify(scrollCheck.offender)}`);
      }

      // 2. Code blocks overflow-x
      const codeBlockIssues = await page.evaluate(() => {
        const blocks = document.querySelectorAll('pre, code, .code-block');
        const bad = [];
        for (const b of blocks) {
          const style = getComputedStyle(b);
          if (style.overflowX !== 'auto' && style.overflowX !== 'scroll' && style.overflowX !== 'hidden') {
            bad.push({ tag: b.tagName, class: b.className, overflowX: style.overflowX });
          }
        }
        return bad;
      });
      if (codeBlockIssues.length > 0) {
        r.issues.push(`CODE BLOCKS NO OVERFLOW-X: ${JSON.stringify(codeBlockIssues)}`);
      }

      // 3. Touch targets < 44x44
      const smallTargets = await page.evaluate(() => {
        const els = document.querySelectorAll('a, button, input, select, textarea, [role="button"]');
        const bad = [];
        for (const el of els) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue; // hidden
          if (rect.width < 44 || rect.height < 44) {
            bad.push({ tag: el.tagName, text: (el.textContent || '').slice(0, 30).trim(), w: Math.round(rect.width), h: Math.round(rect.height), class: el.className });
          }
        }
        return bad;
      });
      if (smallTargets.length > 0) {
        r.issues.push(`SMALL TOUCH TARGETS (${smallTargets.length}): ${JSON.stringify(smallTargets.slice(0, 5))}`);
      }

      // 4. Text smaller than 12px
      const smallText = await page.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const bad = new Set();
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (!node.textContent.trim()) continue;
          const el = node.parentElement;
          if (!el) continue;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs < 12) {
            bad.add(`${el.tagName}.${el.className}:${fs}px`);
          }
        }
        return [...bad];
      });
      if (smallText.length > 0) {
        r.issues.push(`SMALL TEXT (<12px): ${JSON.stringify(smallText)}`);
      }

      results.push(r);
      await page.close();
    }
  }

  await browser.close();

  // Report
  console.log('\n=== MOBILE QA RESULTS ===\n');
  let allPass = true;
  for (const r of results) {
    if (r.issues.length === 0) {
      console.log(`✅ PASS: ${r.tag}`);
    } else {
      allPass = false;
      console.log(`❌ FAIL: ${r.tag}`);
      for (const i of r.issues) console.log(`   - ${i}`);
    }
  }
  console.log(allPass ? '\nAll checks passed!' : '\nSome checks failed.');
  
  // Write JSON for parsing
  fs.writeFileSync(path.join(__dirname, 'qa-mobile-results.json'), JSON.stringify(results, null, 2));
})();
