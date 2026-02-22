const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { takeScreenshot, computeDiff } = require('../services/differ');
const analytics = require('../services/analytics');
const db = require('../services/db');

function trackUsage(userId, endpoint) {
  db.prepare('INSERT INTO usage (user_id, endpoint) VALUES (?, ?)').run(userId, endpoint);
}

// POST /v1/diff — compare two URLs or URL + baseline
router.post('/diff', auth, async (req, res) => {
  const start = Date.now();
  try {
    const { url1, url2, url, baseline, width, height } = req.body;
    const w = width || 1280;
    const h = height || 800;

    let img1, img2;

    if (url1 && url2) {
      try { new URL(url1); new URL(url2); } catch { return res.status(400).json({ success: false, error: 'Invalid URL format' }); }
      [img1, img2] = await Promise.all([takeScreenshot(url1, w, h), takeScreenshot(url2, w, h)]);
    } else if (url && baseline) {
      try { new URL(url); } catch { return res.status(400).json({ success: false, error: 'Invalid URL format' }); }
      img1 = Buffer.from(baseline, 'base64');
      img2 = await takeScreenshot(url, w, h);
    } else {
      return res.status(400).json({ success: false, error: 'Provide {url1, url2} or {url, baseline} (base64)' });
    }

    const result = await computeDiff(img1, img2);
    trackUsage(req.user.user_id, '/v1/diff');
    analytics.track('api_call', '/v1/diff', { ms: Date.now() - start, diffPercent: result.diffPercent }, req.user.user_id);

    res.json({
      success: true,
      diff: {
        diffPercent: result.diffPercent,
        changedPixels: result.changedPixels,
        totalPixels: result.totalPixels,
        width: result.width,
        height: result.height,
        diffImage: 'data:image/png;base64,' + result.diffImage.toString('base64'),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Diff failed: ' + err.message });
  }
});

// GET /v1/screenshot — take a single screenshot
router.get('/screenshot', auth, async (req, res) => {
  const start = Date.now();
  try {
    const { url, width, height } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'url parameter is required' });
    try { new URL(url); } catch { return res.status(400).json({ success: false, error: 'Invalid URL format' }); }

    const buf = await takeScreenshot(url, parseInt(width) || 1280, parseInt(height) || 800);
    trackUsage(req.user.user_id, '/v1/screenshot');
    analytics.track('api_call', '/v1/screenshot', { url, ms: Date.now() - start }, req.user.user_id);

    res.json({
      success: true,
      screenshot: 'data:image/png;base64,' + buf.toString('base64'),
      width: parseInt(width) || 1280,
      height: parseInt(height) || 800,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Screenshot failed: ' + err.message });
  }
});

// GET /v1/demo/diff — no-auth demo
router.get('/demo/diff', async (req, res) => {
  const start = Date.now();
  try {
    const url1 = req.query.url1 || 'https://example.com';
    const url2 = req.query.url2 || 'https://www.iana.org/domains/reserved';
    const [img1, img2] = await Promise.all([takeScreenshot(url1), takeScreenshot(url2)]);
    const result = await computeDiff(img1, img2);
    analytics.track('api_call', '/v1/demo/diff', { ms: Date.now() - start });

    res.json({
      success: true,
      demo: true,
      urls: { url1, url2 },
      diff: {
        diffPercent: result.diffPercent,
        changedPixels: result.changedPixels,
        totalPixels: result.totalPixels,
        width: result.width,
        height: result.height,
        diffImage: 'data:image/png;base64,' + result.diffImage.toString('base64'),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Demo diff failed: ' + err.message });
  }
});

// Analytics summary
router.get('/analytics/summary', auth, (req, res) => {
  res.json({ success: true, ...analytics.summary() });
});

module.exports = router;
