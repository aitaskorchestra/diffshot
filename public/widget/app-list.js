/**
 * GrabShot App Portfolio Widget
 * 
 * Usage: Add to any page:
 *   <div id="grabshot-apps"></div>
 *   <script src="https://grabshot.dev/widget/app-list.js" async></script>
 * 
 * Options (data attributes on the div):
 *   data-exclude="GrabShot"     — hide current app from list
 *   data-theme="light"          — light theme (default: dark)
 *   data-cols="5"               — grid columns on desktop (default: auto)
 *   data-title="More Developer Tools" — custom heading
 */
(function() {
  'use strict';

  var APPS_URL = '/widget/apps.json';
  var CACHE_KEY = 'grabshot_apps_cache';
  var CACHE_TTL = 3600000; // 1 hour

  function init() {
    var container = document.getElementById('grabshot-apps');
    if (!container) return;

    var exclude = (container.getAttribute('data-exclude') || '').split(',').map(function(s) { return s.trim().toLowerCase(); });
    var theme = container.getAttribute('data-theme') || 'dark';
    var title = container.getAttribute('data-title') || 'More Developer Tools';
    var cols = container.getAttribute('data-cols');

    // Try cache first
    var cached = null;
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Date.now() - parsed.ts < CACHE_TTL) cached = parsed.apps;
      }
    } catch(e) {}

    if (cached) {
      render(container, cached, exclude, theme, title, cols);
    }

    // Always fetch fresh (updates cache for next load)
    fetch(APPS_URL)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), apps: data.apps })); } catch(e) {}
        if (!cached) render(container, data.apps, exclude, theme, title, cols);
      })
      .catch(function() {
        // If fetch fails and no cache, render noscript fallback
        if (!cached) renderFallback(container, exclude, theme, title);
      });
  }

  function render(container, apps, exclude, theme, title, cols) {
    var filtered = apps.filter(function(a) {
      return exclude.indexOf(a.name.toLowerCase()) === -1;
    });

    if (filtered.length === 0) return;

    var isDark = theme === 'dark';
    var gridCols = cols || Math.min(filtered.length, 5);

    var html = '<div style="' + containerStyle(isDark) + '">' +
      '<p style="' + titleStyle(isDark) + '">' + escHtml(title) + '</p>' +
      '<div style="display:grid;grid-template-columns:repeat(' + gridCols + ',1fr);gap:12px;"' +
      ' class="grabshot-apps-grid">' +
      filtered.map(function(app) { return appCard(app, isDark); }).join('') +
      '</div>' +
      '<p style="' + poweredStyle(isDark) + '">Part of the <a href="https://grabshot.dev" style="color:' + (isDark ? '#60a5fa' : '#2563eb') + ';text-decoration:none;display:inline-block;min-height:44px;line-height:44px;" target="_blank">GrabShot</a> developer tools suite</p>' +
      '</div>' +
      '<style>' +
      '@media(max-width:768px){.grabshot-apps-grid{grid-template-columns:repeat(2,1fr)!important}}' +
      '@media(max-width:480px){.grabshot-apps-grid{grid-template-columns:1fr!important}}' +
      '.grabshot-app-card{transition:transform .15s,box-shadow .15s}' +
      '.grabshot-app-card:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,0,0,.15)}' +
      '</style>';

    container.innerHTML = html;
  }

  function appCard(app, isDark) {
    return '<a href="' + escHtml(app.url) + '" target="_blank" rel="noopener" class="grabshot-app-card" style="' +
      'display:block;text-decoration:none;' +
      'background:' + (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)') + ';' +
      'border:1px solid ' + (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)') + ';' +
      'border-radius:12px;padding:16px;text-align:center;' +
      '">' +
      '<div style="font-size:24px;margin-bottom:8px;">' + app.icon + '</div>' +
      '<div style="font-weight:600;font-size:14px;color:' + (isDark ? '#f1f5f9' : '#1e293b') + ';margin-bottom:4px;">' + escHtml(app.name) + '</div>' +
      '<div style="font-size:12px;color:' + (isDark ? '#94a3b8' : '#64748b') + ';line-height:1.4;">' + escHtml(app.description) + '</div>' +
      '</a>';
  }

  function containerStyle(isDark) {
    return 'max-width:900px;margin:0 auto;padding:32px 16px;font-family:Inter,system-ui,-apple-system,sans-serif;';
  }

  function titleStyle(isDark) {
    return 'text-align:center;font-size:16px;font-weight:600;color:' + (isDark ? '#94a3b8' : '#475569') + ';margin:0 0 20px 0;letter-spacing:0.02em;';
  }

  function poweredStyle(isDark) {
    return 'text-align:center;font-size:12px;color:' + (isDark ? '#64748b' : '#94a3b8') + ';margin:20px 0 0 0;';
  }

  function renderFallback(container, exclude, theme, title) {
    // Static fallback if JSON can't load
    container.innerHTML = '<div style="text-align:center;padding:20px;"><p style="color:#94a3b8;font-size:14px;">Explore more tools at <a href="https://grabshot.dev" style="color:#60a5fa;">grabshot.dev</a></p></div>';
  }

  function escHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
