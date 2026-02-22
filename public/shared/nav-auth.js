/**
 * Nav Auth — Updates nav CTA based on login state
 * 
 * Checks localStorage for an API key and updates the nav CTA link.
 * Also auto-syncs billing on dashboard pages.
 *
 * Configure via data attributes on the CTA element:
 *   <a href="/dashboard.html" data-nav-auth="true" data-storage-key="mp_api_key">Get API Key</a>
 *
 * Or via window.NAV_AUTH = { storageKey: 'mp_api_key', syncEndpoint: '/v1/billing/sync', syncKeyField: 'api_key' }
 */
(function() {
  'use strict';

  function init() {
    var cfg = window.NAV_AUTH || {};
    var storageKey = cfg.storageKey || (window.SHARED_AUTH && window.SHARED_AUTH.storageKey) || 'api_key';
    var key = localStorage.getItem(storageKey);

    // Update all nav CTAs
    var links = document.querySelectorAll('a[href*="dashboard"]');
    links.forEach(function(link) {
      // Only update links that say "Get API Key" or similar
      var text = (link.textContent || '').trim().toLowerCase();
      if (key && (text.includes('get') && text.includes('key')) || text === 'get api key' || text === 'get free key') {
        link.textContent = 'Dashboard';
      }
    });

    // Auto-sync billing on dashboard page
    if (key && cfg.syncEndpoint && window.location.pathname.includes('dashboard')) {
      var body = {};
      body[cfg.syncKeyField || 'api_key'] = key;
      fetch(cfg.syncEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).catch(function() {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
