/**
 * Auto Copy Button — adds a "Copy" button to every <pre> block
 * 
 * If the <pre> is inside a "mac window" (container with red/yellow/green dots),
 * the button goes in the title bar aligned right. Otherwise floats top-right of <pre>.
 *
 * Usage: <script src="/widget/copy-btn.js" async></script>
 */
(function() {
  'use strict';

  var btnCSS = 'padding:10px 12px;font-size:12px;min-width:44px;min-height:44px;background:rgba(255,255,255,0.08);' +
    'border:1px solid rgba(255,255,255,0.12);color:#94a3b8;border-radius:6px;cursor:pointer;' +
    'font-family:system-ui,sans-serif;transition:all .15s;line-height:1.4;white-space:nowrap;';

  function createBtn(pre) {
    var btn = document.createElement('button');
    btn.className = 'gs-copy-btn';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy to clipboard');

    btn.addEventListener('mouseenter', function() {
      btn.style.background = 'rgba(255,255,255,0.15)';
      btn.style.color = '#e2e8f0';
    });
    btn.addEventListener('mouseleave', function() {
      if (btn.textContent === 'Copy') {
        btn.style.background = 'rgba(255,255,255,0.08)';
        btn.style.color = '#94a3b8';
      }
    });

    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var text = pre.textContent || pre.innerText;
      navigator.clipboard.writeText(text.trim()).then(function() {
        btn.textContent = 'Copied!';
        btn.style.background = 'rgba(34,197,94,0.15)';
        btn.style.color = '#4ade80';
        btn.style.borderColor = 'rgba(34,197,94,0.25)';
        setTimeout(function() {
          btn.textContent = 'Copy';
          btn.style.background = 'rgba(255,255,255,0.08)';
          btn.style.color = '#94a3b8';
          btn.style.borderColor = 'rgba(255,255,255,0.12)';
        }, 1500);
      });
    });

    return btn;
  }

  function findTitleBar(pre) {
    var ancestor = pre.parentElement;
    for (var depth = 0; depth < 4 && ancestor; depth++) {
      var redDot = ancestor.querySelector('[class*="bg-red-5"]');
      if (redDot) {
        var bar = redDot;
        while (bar.parentElement && bar.parentElement !== ancestor) {
          bar = bar.parentElement;
        }
        if (bar !== pre && bar.tagName !== 'PRE') return bar;
      }
      ancestor = ancestor.parentElement;
    }
    return null;
  }

  function init() {
    // First pass: find all title bars and place buttons there
    // Second pass: add floating buttons to remaining pres
    var handledPres = [];

    document.querySelectorAll('pre').forEach(function(pre) {
      var titleBar = findTitleBar(pre);
      if (titleBar && !titleBar.querySelector('.gs-copy-btn')) {
        var btn = createBtn(pre);
        btn.style.cssText = btnCSS + 'margin-left:auto;flex-shrink:0;';
        titleBar.style.display = 'flex';
        titleBar.style.alignItems = 'center';
        titleBar.appendChild(btn);
        handledPres.push(pre);
      }
    });

    // Second pass: floating buttons for pres without a title bar
    document.querySelectorAll('pre').forEach(function(pre) {
      if (handledPres.indexOf(pre) !== -1) return;
      if (pre.querySelector('.gs-copy-btn')) return;
      // Skip if parent already has a manual copy button
      var parent = pre.parentElement;
      if (parent) {
        var existing = parent.querySelectorAll('button');
        for (var i = 0; i < existing.length; i++) {
          var txt = (existing[i].textContent || '').trim().toLowerCase();
          if ((txt === 'copy' || txt === 'copied!') && !existing[i].classList.contains('gs-copy-btn')) return;
        }
      }

      var btn = createBtn(pre);
      btn.style.cssText = btnCSS + 'position:absolute;top:8px;right:8px;z-index:5;';
      pre.style.position = 'relative';
      pre.appendChild(btn);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
