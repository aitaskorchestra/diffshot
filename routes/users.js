const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { generateApiKey } = db;
const { auth } = require('../middleware/auth');
const analytics = require('../services/analytics');

router.post('/register', (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ success: false, error: 'Email already registered.' });

    const key = generateApiKey();
    const info = db.prepare('INSERT INTO users (email) VALUES (?)').run(email);
    db.prepare('INSERT INTO api_keys (user_id, key) VALUES (?, ?)').run(info.lastInsertRowid, key);
    analytics.track('signup', 'register', { email }, info.lastInsertRowid);
    res.json({ success: true, email, api_key: key, plan: 'free', message: 'Save your API key! You will need it to sign in.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

router.post('/login', (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ success: false, error: 'API key is required' });
    const row = db.prepare(`
      SELECT u.id, u.email, u.plan, u.created_at, ak.key
      FROM api_keys ak JOIN users u ON ak.user_id = u.id
      WHERE ak.key = ? AND ak.active = 1
    `).get(key);
    if (!row) return res.status(401).json({ success: false, error: 'Invalid API key' });

    const usage = db.prepare(`
      SELECT COUNT(*) as c FROM usage WHERE user_id = ? AND created_at >= date('now', 'start of month')
    `).get(row.id).c;

    res.json({ success: true, user: { email: row.email, plan: row.plan, created_at: row.created_at, usage_this_month: usage } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.post('/recover', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
    const row = db.prepare(`
      SELECT ak.key FROM api_keys ak JOIN users u ON ak.user_id = u.id
      WHERE u.email = ? AND ak.active = 1 ORDER BY ak.created_at DESC LIMIT 1
    `).get(email);
    if (!row) return res.status(404).json({ success: false, error: 'No account found with that email' });
    res.json({ success: true, api_key: row.key, message: 'Here is your API key. Keep it safe!' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Recovery failed' });
  }
});

router.get('/account', auth, (req, res) => {
  const usage = db.prepare(`
    SELECT COUNT(*) as c FROM usage WHERE user_id = ? AND created_at >= date('now', 'start of month')
  `).get(req.user.user_id).c;

  const limits = { free: 30, starter: 500, pro: 5000, business: 50000 };
  res.json({
    success: true,
    user: {
      email: req.user.email,
      plan: req.user.plan,
      usage_this_month: usage,
      monthly_limit: limits[req.user.plan] || 30
    }
  });
});

router.post('/keys', auth, (req, res) => {
  const { name = 'New Key' } = req.body;
  const key = generateApiKey();
  db.prepare('INSERT INTO api_keys (user_id, key, name) VALUES (?, ?, ?)').run(req.user.user_id, key, name);
  res.json({ success: true, key, name });
});

router.get('/keys', auth, (req, res) => {
  const keys = db.prepare('SELECT id, key, name, active, created_at FROM api_keys WHERE user_id = ?').all(req.user.user_id);
  res.json({ success: true, keys });
});

router.delete('/keys/:id', auth, (req, res) => {
  const result = db.prepare('UPDATE api_keys SET active = 0 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.user_id);
  if (result.changes === 0) return res.status(404).json({ success: false, error: 'Key not found' });
  res.json({ success: true, message: 'Key revoked' });
});

module.exports = router;
