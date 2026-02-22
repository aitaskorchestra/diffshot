require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./services/db');
const analytics = require('./services/analytics');
const apiRoutes = require('./routes/api');
const billingRoutes = require('./routes/billing');
const userRoutes = require('./routes/users');

const app = express();
app.set('trust proxy', true);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Analytics middleware
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/') {
    analytics.track('pageview', req.path, { referrer: req.get('referer'), ua: req.get('user-agent') });
  }
  next();
});

// Static files
// Clean URL routes
const publicDir = require('path').join(__dirname, 'public');
['dashboard', 'docs'].forEach(page => {
  const f = publicDir + '/' + page + '.html';
  if (require('fs').existsSync(f)) app.get('/' + page, (req, res) => res.sendFile(page + '.html', { root: publicDir }));
});
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/v1', apiRoutes);
app.use('/v1/billing', billingRoutes);
app.use('/v1', userRoutes);

// Health check
app.get('/v1/health', (req, res) => {
  res.json({ status: 'ok', service: 'diffshot', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  if (req.accepts('html')) {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  } else {
    res.status(404).json({ success: false, error: 'Not found' });
  }
});

const PORT = process.env.PORT || 3008;
app.listen(PORT, () => console.log(`DiffShot running on port ${PORT}`));
