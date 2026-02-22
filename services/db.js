const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const db = new Database(path.join(__dirname, '..', 'db', 'diffshot.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    plan TEXT DEFAULT 'free',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT 'Default',
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    event TEXT NOT NULL,
    data TEXT,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed demo account
const demoEmail = 'demo@diffshot.grabshot.dev';
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail);
if (!existing) {
  const info = db.prepare('INSERT INTO users (email, plan) VALUES (?, ?)').run(demoEmail, 'pro');
  db.prepare('INSERT INTO api_keys (user_id, key) VALUES (?, ?)').run(info.lastInsertRowid, 'ds_demo_qa_key_123456');
}

function generateApiKey() {
  return 'ds_' + crypto.randomBytes(24).toString('hex');
}

module.exports = db;
module.exports.generateApiKey = generateApiKey;
