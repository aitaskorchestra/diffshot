/**
 * Shared Auth Widget — configurable login/register/persist
 *
 * Configure via window.SHARED_AUTH before loading this script.
 * Renders into #auth-container (if exists) or works with existing
 * #login-section / #dashboard-section elements.
 *
 * Exports: window.sharedAuth.login(key), .logout(), .getKey(), .isLoggedIn()
 */
(function () {
  'use strict';

  var defaults = {
    storageKey: 'api_key',
    registerEndpoint: '/v1/register',
    registerEmailField: 'email',
    registerKeyField: 'api_key',
    usageEndpoint: '/v1/usage',
    usageKeyParam: 'api_key',
    loginValidateEndpoint: '/v1/usage',
    loginKeyParam: 'api_key',
    recoverEndpoint: '/v1/recover',
    keyPrefix: '',
    appName: 'App',
    gsDismissedKey: 'gs_dismissed',
    onLogin: null,
    onLogout: null
  };

  function cfg(k) {
    var c = window.SHARED_AUTH || {};
    return c[k] !== undefined ? c[k] : defaults[k];
  }

  var currentKey = '';

  // ── helpers ──
  function $(id) { return document.getElementById(id); }

  function showEl(id) { var e = $(id); if (e) { e.classList.remove('hidden'); e.style.display = ''; } }
  function hideEl(id) { var e = $(id); if (e) { e.classList.add('hidden'); e.style.display = 'none'; } }

  // ── public API ──
  function getKey() { return currentKey || localStorage.getItem(cfg('storageKey')) || ''; }
  function isLoggedIn() { return !!getKey(); }

  function login(key) {
    currentKey = key;
    localStorage.setItem(cfg('storageKey'), key);
    validate(key);
  }

  function logout() {
    currentKey = '';
    localStorage.removeItem(cfg('storageKey'));
    if (typeof cfg('onLogout') === 'function') cfg('onLogout')();
    hideEl('dashboard-section');
    showEl('login-section');
  }

  // ── validation ──
  function validate(key) {
    var ep = cfg('loginValidateEndpoint');
    var param = cfg('loginKeyParam');
    fetch(ep + '?' + encodeURIComponent(param) + '=' + encodeURIComponent(key))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.success) throw new Error(data.error || 'Invalid key');
        currentKey = key;
        localStorage.setItem(cfg('storageKey'), key);
        hideEl('login-section');
        showEl('dashboard-section');
        if (typeof cfg('onLogin') === 'function') cfg('onLogin')(data, key);
      })
      .catch(function () {
        // validation failed — clear and show login
        currentKey = '';
        localStorage.removeItem(cfg('storageKey'));
        hideEl('dashboard-section');
        showEl('login-section');
      });
  }

  // ── tab switching ──
  function switchTab(tab) {
    var isRegister = tab === 'register';
    var fr = $('form-register'), fl = $('form-login');
    var tr = $('tab-register'), tl = $('tab-login');
    if (fr) fr.classList.toggle('hidden', !isRegister);
    if (fl) fl.classList.toggle('hidden', isRegister);
    if (tr) tr.className = 'flex-1 py-2.5 text-sm font-medium transition ' + (isRegister ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white');
    if (tl) tl.className = 'flex-1 py-2.5 text-sm font-medium transition ' + (!isRegister ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white');
    hideEl('auth-result');
  }

  // ── register ──
  function register() {
    var email = $('reg-email') ? $('reg-email').value.trim() : '';
    if (!email) return;
    var btn = $('reg-btn');
    if (btn) { btn.textContent = 'Creating...'; btn.disabled = true; }
    var body = {};
    body[cfg('registerEmailField')] = email;
    fetch(cfg('registerEndpoint'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var result = $('auth-result');
        if (result) result.classList.remove('hidden');
        if (data.success) {
          var key = data[cfg('registerKeyField')];
          currentKey = key;
          localStorage.setItem(cfg('storageKey'), key);
          if (result) result.innerHTML = '<div class="bg-green-900/30 border border-green-700 rounded-lg p-4">' +
            '<p class="text-green-400 font-medium mb-2">✅ Account created!</p>' +
            '<p class="text-sm text-slate-400 mb-2">Your API key:</p>' +
            '<div class="bg-slate-950 rounded p-3 font-mono text-sm text-yellow-300 break-all select-all">' + key + '</div>' +
            '<p class="text-xs text-slate-500 mt-2">⚠️ Save this key! It won\'t be shown in full again.</p>' +
            '<button onclick="sharedAuth.login(\'' + key + '\')" class="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">Go to Dashboard →</button></div>';
        } else {
          if (result) result.innerHTML = '<p class="text-red-400 text-sm">' + (data.error || 'Registration failed') + '</p>';
        }
      })
      .catch(function () {
        var result = $('auth-result');
        if (result) { result.classList.remove('hidden'); result.innerHTML = '<p class="text-red-400 text-sm">Network error</p>'; }
      })
      .finally(function () {
        if (btn) { btn.textContent = 'Get API Key →'; btn.disabled = false; }
      });
  }

  // ── recover ──
  function recoverKey() {
    var email = $('recover-email') ? $('recover-email').value.trim() : '';
    if (!email) return;
    fetch(cfg('recoverEndpoint'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var result = $('auth-result');
        if (result) result.classList.remove('hidden');
        if (data.success) {
          if (result) result.innerHTML = '<div class="bg-blue-900/30 border border-blue-700 rounded-lg p-4">' +
            '<p class="text-blue-400 font-medium mb-2">Found your key:</p>' +
            '<div class="bg-slate-950 rounded p-3 font-mono text-sm text-yellow-300 break-all select-all">' + data[cfg('registerKeyField')] + '</div></div>';
        } else {
          if (result) result.innerHTML = '<p class="text-red-400 text-sm">' + (data.error || 'Not found') + '</p>';
        }
      })
      .catch(function () {
        var result = $('auth-result');
        if (result) { result.classList.remove('hidden'); result.innerHTML = '<p class="text-red-400 text-sm">Network error</p>'; }
      });
  }

  // ── login from form ──
  function loginFromForm() {
    var keyInput = $('key-input');
    var key = keyInput ? keyInput.value.trim() : '';
    if (key) login(key);
  }

  // ── init ──
  function init() {

    // Wire up buttons if they exist (for pages using existing HTML)
    // Attach global handlers
    window.sharedAuth = {
      login: login,
      logout: logout,
      getKey: getKey,
      isLoggedIn: isLoggedIn,
      switchTab: switchTab,
      register: register,
      recoverKey: recoverKey,
      loginFromForm: loginFromForm
    };

    // Also expose as globals for onclick handlers
    window.switchTab = switchTab;
    window.register = register;
    window.recoverKey = recoverKey;
    window.logout = logout;

    // Wire login button
    var loginBtn = document.querySelector('#form-login button');
    if (loginBtn && !loginBtn.getAttribute('data-shared-auth')) {
      loginBtn.setAttribute('data-shared-auth', '1');
      loginBtn.setAttribute('onclick', 'sharedAuth.loginFromForm()');
    }

    // Auto-login from stored key
    var storedKey = localStorage.getItem(cfg('storageKey'));
    if (storedKey) {
      validate(storedKey);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
