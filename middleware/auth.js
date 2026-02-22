const db = require('../services/db');

const rateBuckets = {};
const LIMITS = { free: 5, starter: 20, pro: 40, business: 80 };

function rateLimit(plan, userId) {
  const key = `${userId}`;
  const now = Date.now();
  const limit = LIMITS[plan] || LIMITS.free;
  if (!rateBuckets[key] || rateBuckets[key].reset < now) {
    rateBuckets[key] = { count: 1, reset: now + 60000 };
    return true;
  }
  rateBuckets[key].count++;
  return rateBuckets[key].count <= limit;
}

const MONTHLY_LIMITS = { free: 30, starter: 500, pro: 5000, business: 50000 };

function checkMonthlyUsage(userId, plan) {
  const limit = MONTHLY_LIMITS[plan] || MONTHLY_LIMITS.free;
  const start = new Date();
  start.setDate(1); start.setHours(0, 0, 0, 0);
  const count = db.prepare('SELECT COUNT(*) as c FROM usage WHERE user_id = ? AND created_at >= ?').get(userId, start.toISOString()).c;
  return count < limit;
}

function auth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.key;
  if (!key) return res.status(401).json({ success: false, error: 'API key required. Pass via x-api-key header or key query parameter.' });

  const row = db.prepare(`
    SELECT ak.id as key_id, ak.user_id, u.email, u.plan 
    FROM api_keys ak JOIN users u ON ak.user_id = u.id 
    WHERE ak.key = ? AND ak.active = 1
  `).get(key);

  if (!row) return res.status(401).json({ success: false, error: 'Invalid API key' });

  if (!rateLimit(row.plan, row.user_id)) {
    return res.status(429).json({ success: false, error: 'Rate limit exceeded. Please slow down.' });
  }

  if (!checkMonthlyUsage(row.user_id, row.plan)) {
    return res.status(429).json({ success: false, error: 'Monthly usage limit reached. Please upgrade your plan.' });
  }

  req.user = row;
  next();
}

function optionalAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.key;
  if (key) {
    const row = db.prepare(`
      SELECT ak.id as key_id, ak.user_id, u.email, u.plan 
      FROM api_keys ak JOIN users u ON ak.user_id = u.id 
      WHERE ak.key = ? AND ak.active = 1
    `).get(key);
    if (row) req.user = row;
  }
  next();
}

module.exports = { auth, optionalAuth };
