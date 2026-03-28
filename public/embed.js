/**
 * DipperAI Embed Widget
 * Drop-in floating chat button for any website.
 * Usage: <script src="https://yourdomain.com/embed.js" data-token="YOUR_TOKEN"></script>
 */
(function () {
  'use strict';

  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var token = script.getAttribute('data-token');
  if (!token) { console.warn('[DipperAI] No data-token provided.'); return; }

  // Derive the base URL from the script src
  var scriptSrc = script.src || '';
  var baseUrl = scriptSrc ? scriptSrc.replace(/\/embed\.js.*$/, '') : '';

  var embedUrl = baseUrl + '/embed/' + token;

  var CHAT_W = 380;
  var CHAT_H = 600;
  var BTN_SIZE = 56;
  var MARGIN = 20;
  var ANIM_MS = 220;

  var open = false;
  var container, iframe, closeBtn, btn;

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '#dipperai-btn{',
        'position:fixed;',
        'bottom:' + MARGIN + 'px;',
        'right:' + MARGIN + 'px;',
        'width:' + BTN_SIZE + 'px;',
        'height:' + BTN_SIZE + 'px;',
        'border-radius:50%;',
        'background:linear-gradient(135deg,#7c3aed,#6d28d9);',
        'border:none;',
        'cursor:pointer;',
        'display:flex;',
        'align-items:center;',
        'justify-content:center;',
        'box-shadow:0 4px 20px rgba(124,58,237,0.45);',
        'z-index:99998;',
        'transition:transform 0.15s,box-shadow 0.15s;',
      '}',
      '#dipperai-btn:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(124,58,237,0.6);}',
      '#dipperai-chat-container{',
        'position:fixed;',
        'bottom:' + (MARGIN + BTN_SIZE + 12) + 'px;',
        'right:' + MARGIN + 'px;',
        'width:' + CHAT_W + 'px;',
        'height:' + CHAT_H + 'px;',
        'border-radius:16px;',
        'overflow:hidden;',
        'box-shadow:0 16px 60px rgba(0,0,0,0.6);',
        'z-index:99999;',
        'transform-origin:bottom right;',
        'transition:transform ' + ANIM_MS + 'ms cubic-bezier(0.4,0,0.2,1), opacity ' + ANIM_MS + 'ms ease;',
        'transform:scale(0.85);',
        'opacity:0;',
        'pointer-events:none;',
        'border:1px solid rgba(124,58,237,0.25);',
      '}',
      '#dipperai-chat-container.dipperai-open{transform:scale(1);opacity:1;pointer-events:auto;}',
      '#dipperai-iframe{width:100%;height:100%;border:none;display:block;}',
      '#dipperai-close{',
        'position:absolute;',
        'top:10px;',
        'right:10px;',
        'width:26px;',
        'height:26px;',
        'border-radius:50%;',
        'background:rgba(0,0,0,0.5);',
        'border:1px solid rgba(255,255,255,0.1);',
        'color:#fff;',
        'font-size:14px;',
        'line-height:1;',
        'cursor:pointer;',
        'display:flex;',
        'align-items:center;',
        'justify-content:center;',
        'z-index:1;',
        'transition:background 0.15s;',
      '}',
      '#dipperai-close:hover{background:rgba(124,58,237,0.7);}',
      '@media(max-width:430px){',
        '#dipperai-chat-container{',
          'width:calc(100vw - ' + (MARGIN * 2) + 'px);',
          'right:' + MARGIN + 'px;',
        '}',
      '}',
    ].join('');
    document.head.appendChild(style);
  }

  function chatIcon() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  }

  function closeIcon() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  }

  function buildUI() {
    injectStyles();

    // Chat container
    container = document.createElement('div');
    container.id = 'dipperai-chat-container';

    // Close button
    closeBtn = document.createElement('button');
    closeBtn.id = 'dipperai-close';
    closeBtn.innerHTML = closeIcon();
    closeBtn.setAttribute('aria-label', 'Close chat');
    closeBtn.addEventListener('click', toggleChat);

    // iframe — lazy loaded on first open
    iframe = document.createElement('iframe');
    iframe.id = 'dipperai-iframe';
    iframe.setAttribute('title', 'DipperAI Chat');
    iframe.setAttribute('allow', 'clipboard-write');

    container.appendChild(closeBtn);
    container.appendChild(iframe);
    document.body.appendChild(container);

    // Floating button
    btn = document.createElement('button');
    btn.id = 'dipperai-btn';
    btn.innerHTML = chatIcon();
    btn.setAttribute('aria-label', 'Open chat');
    btn.addEventListener('click', toggleChat);
    document.body.appendChild(btn);
  }

  var iframeLoaded = false;

  function toggleChat() {
    open = !open;
    if (open) {
      if (!iframeLoaded) {
        iframe.src = embedUrl;
        iframeLoaded = true;
      }
      container.classList.add('dipperai-open');
    } else {
      container.classList.remove('dipperai-open');
    }
  }

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) toggleChat();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }
})();
