/**
 * Plan Picker Widget — shared upgrade/downgrade UI for all apps
 * Uses inline styles only (no Tailwind dependency for dynamic content)
 */
(function() {
  'use strict';

  var PLAN_ORDER = ['free', 'starter', 'pro', 'business', 'enterprise'];
  var COLORS = {
    blue:   { accent: '#3b82f6', accentBg: 'rgba(59,130,246,0.15)', accentBorder: 'rgba(59,130,246,0.4)', btn: '#2563eb', btnHover: '#1d4ed8' },
    orange: { accent: '#f97316', accentBg: 'rgba(249,115,22,0.15)', accentBorder: 'rgba(249,115,22,0.4)', btn: '#ea580c', btnHover: '#c2410c' },
    green:  { accent: '#22c55e', accentBg: 'rgba(34,197,94,0.15)',  accentBorder: 'rgba(34,197,94,0.4)',  btn: '#16a34a', btnHover: '#15803d' },
    purple: { accent: '#a855f7', accentBg: 'rgba(168,85,247,0.15)', accentBorder: 'rgba(168,85,247,0.4)', btn: '#9333ea', btnHover: '#7e22ce' }
  };

  function planRank(id) { var i = PLAN_ORDER.indexOf(id); return i >= 0 ? i : 99; }
  function cfg(k) { return (window.PLAN_PICKER || {})[k]; }
  function colors() { return COLORS[cfg('accentColor') || 'blue'] || COLORS.blue; }

  var cardBase = 'border-radius:12px;padding:16px;display:flex;flex-direction:column;backdrop-filter:blur(8px);transition:all .15s;';
  var gridBase = 'display:grid;gap:12px;';
  var btnBase = 'width:100%;padding:6px 0;border-radius:8px;font-size:12px;font-weight:500;border:none;cursor:pointer;transition:all .15s;';

  function render() {
    var container = document.getElementById('plan-picker-container');
    if (!container) return;

    var plans = cfg('plans') || [];
    var current = cfg('currentPlan') || 'free';
    var currentRank = planRank(current);
    var c = colors();
    var showDowngrade = cfg('showDowngrade') !== false;
    var cols = Math.min(plans.length, 3);

    var html = '<div style="' + gridBase + 'grid-template-columns:repeat(' + cols + ',1fr);">';

    plans.forEach(function(plan) {
      var isCurrent = plan.id === current;
      var isHigher = planRank(plan.id) > currentRank;
      var isLower = planRank(plan.id) < currentRank;

      var bg = plan.popular && !isCurrent ? c.accentBg : 'rgba(255,255,255,0.04)';
      var border = isCurrent
        ? '2px solid ' + c.accentBorder
        : '1px solid rgba(255,255,255,0.08)';

      html += '<div style="' + cardBase + 'background:' + bg + ';border:' + border + ';">';
      html += '<div style="font-weight:700;color:' + (plan.popular ? c.accent : '#fff') + ';font-size:14px;">' + plan.name + '</div>';
      html += '<div style="color:#94a3b8;font-size:13px;margin-top:4px;">$' + plan.price + '/mo</div>';

      if (plan.limit) {
        html += '<div style="color:#64748b;font-size:11px;margin-top:4px;">' + plan.limit + '</div>';
      }

      if (plan.features && plan.features.length) {
        html += '<ul style="margin-top:12px;list-style:none;padding:0;flex:1;">';
        plan.features.forEach(function(f) {
          html += '<li style="font-size:11px;color:#94a3b8;margin-bottom:4px;">✓ ' + f + '</li>';
        });
        html += '</ul>';
      }

      html += '<div style="margin-top:12px;">';
      if (isCurrent) {
        html += '<span style="display:inline-block;font-size:12px;color:' + c.accent + ';font-weight:500;padding:6px 0;">✓ Current Plan</span>';
      } else if (isHigher) {
        html += '<button onclick="window._planPickerAction(\'' + plan.id + '\')" style="' + btnBase + 'background:' + c.btn + ';color:#fff;" onmouseover="this.style.background=\'' + c.btnHover + '\'" onmouseout="this.style.background=\'' + c.btn + '\'">Upgrade</button>';
      } else if (isLower && showDowngrade) {
        html += '<button onclick="window._planPickerManage()" style="' + btnBase + 'background:rgba(255,255,255,0.08);color:#cbd5e1;" onmouseover="this.style.background=\'rgba(255,255,255,0.12)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.08)\'">Downgrade</button>';
      }
      html += '</div>';
      html += '</div>';
    });

    html += '</div>';

    if (currentRank > 0) {
      html += '<div style="margin-top:16px;">';
      html += '<button onclick="window._planPickerManage()" style="background:none;border:none;color:#64748b;font-size:13px;cursor:pointer;padding:0;transition:color .15s;" onmouseover="this.style.color=\'#cbd5e1\'" onmouseout="this.style.color=\'#64748b\'">Manage Subscription →</button>';
      html += '</div>';
    }

    container.innerHTML = html;
  }

  window._planPickerAction = function(planId) {
    var endpoint = cfg('checkoutEndpoint') || '/v1/billing/checkout';
    var keyField = cfg('apiKeyField') || 'api_key';
    var getKey = cfg('getApiKey');
    var key = getKey ? getKey() : '';
    if (!key) { alert('Please log in first.'); return; }

    var planField = cfg('planField') || 'plan';
    var body = {};
    body[planField] = planId;
    var headers = { 'Content-Type': 'application/json' };
    var authMode = cfg('authMode') || 'body';
    if (authMode === 'bearer') { headers['Authorization'] = 'Bearer ' + key; }
    else { body[keyField] = key; }

    fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(body) })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.url) { if (cfg('onCheckout')) cfg('onCheckout')(data.url); else window.location.href = data.url; }
      else { alert(data.error || 'Checkout not available'); }
    })
    .catch(function() { alert('Connection error'); });
  };

  window._planPickerManage = function() {
    var endpoint = cfg('portalEndpoint') || '/v1/billing/portal';
    var keyField = cfg('apiKeyField') || 'api_key';
    var getKey = cfg('getApiKey');
    var key = getKey ? getKey() : '';
    if (!key) { alert('Please log in first.'); return; }

    var body = {};
    var headers = { 'Content-Type': 'application/json' };
    var authMode = cfg('authMode') || 'body';
    if (authMode === 'bearer') { headers['Authorization'] = 'Bearer ' + key; }
    else { body[keyField] = key; }

    fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(body) })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.url) window.location.href = data.url;
      else alert(data.error || 'No billing account found. Subscribe first.');
    })
    .catch(function() { alert('Connection error'); });
  };

  window.planPicker = {
    render: render,
    setCurrentPlan: function(plan) {
      if (window.PLAN_PICKER) window.PLAN_PICKER.currentPlan = plan;
      render();
    }
  };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', render); }
  else { render(); }
})();
