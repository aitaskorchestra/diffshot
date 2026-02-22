const db = require('./db');

const insert = db.prepare('INSERT INTO analytics_events (type, event, data, user_id) VALUES (?, ?, ?, ?)');

function track(type, event, data = {}, userId = null) {
  try {
    insert.run(type, event, JSON.stringify(data), userId);
  } catch (e) { /* non-critical */ }
}

function summary() {
  const now = new Date();
  const dayAgo = new Date(now - 86400000).toISOString();
  const weekAgo = new Date(now - 604800000).toISOString();
  const monthAgo = new Date(now - 2592000000).toISOString();

  return {
    daily_events: db.prepare('SELECT COUNT(*) as c FROM analytics_events WHERE created_at > ?').get(dayAgo).c,
    weekly_events: db.prepare('SELECT COUNT(*) as c FROM analytics_events WHERE created_at > ?').get(weekAgo).c,
    monthly_events: db.prepare('SELECT COUNT(*) as c FROM analytics_events WHERE created_at > ?').get(monthAgo).c,
    total_users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    paid_users: db.prepare("SELECT COUNT(*) as c FROM users WHERE plan != 'free'").get().c,
    top_events: db.prepare('SELECT event, COUNT(*) as c FROM analytics_events GROUP BY event ORDER BY c DESC LIMIT 10').all()
  };
}

module.exports = { track, summary };
