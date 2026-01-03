(function() {
  'use strict';

  var WIDGET_ORIGIN = 'https://multi-tenant-chat-app.pages.dev';
  var NAMESPACE = 'mychat-widget';
  var VERSION = 1;

  // Find the script tag that loaded this file
  var currentScript = document.currentScript;
  if (!currentScript) {
    console.error('[ChatWidget] Cannot find script tag');
    return;
  }

  // Read configuration from data attributes
  var config = {
    agentId: currentScript.getAttribute('data-agent-id'),
    color: currentScript.getAttribute('data-color') || '#4F46E5',
    position: currentScript.getAttribute('data-position') || 'bottom-right',
    icon: currentScript.getAttribute('data-icon') || 'chat'
  };

  if (!config.agentId) {
    console.error('[ChatWidget] data-agent-id is required');
    return;
  }

  // State
  var isOpen = false;
  var isReady = false;
  var launcher = null;
  var iframe = null;
  var iframeContainer = null;

  // Check for auto-open via URL parameter
  function shouldAutoOpen() {
    try {
      var urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('chat') === 'open';
    } catch (e) {
      return false;
    }
  }

  // Detect mobile viewport
  function isMobile() {
    return window.innerWidth <= 768;
  }

  // Create launcher button
  function createLauncher() {
    launcher = document.createElement('button');
    launcher.id = 'mychat-widget-launcher';
    launcher.setAttribute('aria-label', 'Open chat');
    
    // Position styles
    var positionStyles = config.position === 'bottom-left'
      ? 'left: 24px;'
      : 'right: 24px;';
    
    launcher.style.cssText = 
      'position: fixed;' +
      'bottom: 24px;' +
      positionStyles +
      'width: 56px;' +
      'height: 56px;' +
      'border-radius: 50%;' +
      'background-color: ' + config.color + ';' +
      'border: none;' +
      'cursor: pointer;' +
      'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);' +
      'z-index: 2147483646;' +
      'display: flex;' +
      'align-items: center;' +
      'justify-content: center;' +
      'transition: transform 0.2s, box-shadow 0.2s;';

    // Icon SVGs
    var icons = {
      chat: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
      help: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      message: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>'
    };

    launcher.innerHTML = icons[config.icon] || icons.chat;

    // Hover effects
    launcher.addEventListener('mouseenter', function() {
      launcher.style.transform = 'scale(1.05)';
      launcher.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
    });
    launcher.addEventListener('mouseleave', function() {
      launcher.style.transform = 'scale(1)';
      launcher.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    });

    // Click handler
    launcher.addEventListener('click', function() {
      toggleWidget();
    });

    document.body.appendChild(launcher);
  }

  // Create iframe container and iframe
  function createIframe() {
    iframeContainer = document.createElement('div');
    iframeContainer.id = 'mychat-widget-container';
    
    // Position styles
    var positionStyles = config.position === 'bottom-left'
      ? 'left: 24px;'
      : 'right: 24px;';
    
    var mobileStyles = isMobile()
      ? 'width: 100%; height: 100%; bottom: 0; right: 0; left: 0; border-radius: 0;'
      : 'width: 380px; height: 600px; bottom: 88px; border-radius: 16px;';
    
    iframeContainer.style.cssText = 
      'position: fixed;' +
      positionStyles +
      mobileStyles +
      'z-index: 2147483647;' +
      'display: none;' +
      'overflow: hidden;' +
      'box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);';

    iframe = document.createElement('iframe');
    iframe.id = 'mychat-widget-iframe';
    iframe.src = WIDGET_ORIGIN + '/?agent=' + encodeURIComponent(config.agentId);
    iframe.style.cssText = 
      'width: 100%;' +
      'height: 100%;' +
      'border: none;';
    iframe.setAttribute('allow', 'microphone');

    iframeContainer.appendChild(iframe);
    document.body.appendChild(iframeContainer);

    // Handle window resize for mobile responsiveness
    window.addEventListener('resize', handleResize);
  }

  // Handle resize for responsive behavior
  function handleResize() {
    if (!iframeContainer) return;
    
    var positionStyles = config.position === 'bottom-left'
      ? 'left: 24px;'
      : 'right: 24px;';
    
    if (isMobile()) {
      iframeContainer.style.cssText = 
        'position: fixed;' +
        'width: 100%;' +
        'height: 100%;' +
        'bottom: 0;' +
        'right: 0;' +
        'left: 0;' +
        'border-radius: 0;' +
        'z-index: 2147483647;' +
        'overflow: hidden;' +
        'box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);' +
        'display: ' + (isOpen ? 'block' : 'none') + ';';
    } else {
      iframeContainer.style.cssText = 
        'position: fixed;' +
        positionStyles +
        'width: 380px;' +
        'height: 600px;' +
        'bottom: 88px;' +
        'border-radius: 16px;' +
        'z-index: 2147483647;' +
        'overflow: hidden;' +
        'box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);' +
        'display: ' + (isOpen ? 'block' : 'none') + ';';
    }
  }

  // Toggle widget open/closed
  function toggleWidget() {
    isOpen = !isOpen;
    
    if (isOpen) {
      openWidget();
    } else {
      closeWidget();
    }
  }

  // Open the widget
  function openWidget() {
    isOpen = true;
    iframeContainer.style.display = 'block';
    
    // Hide launcher on mobile when open
    if (isMobile()) {
      launcher.style.display = 'none';
    }

    // Update launcher icon to close
    launcher.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    launcher.setAttribute('aria-label', 'Close chat');

    // Send OPEN message to iframe
    sendMessage({ type: 'OPEN' });
  }

  // Close the widget
  function closeWidget() {
    isOpen = false;
    iframeContainer.style.display = 'none';
    
    // Show launcher
    launcher.style.display = 'flex';

    // Restore launcher icon
    var icons = {
      chat: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
      help: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      message: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>'
    };
    launcher.innerHTML = icons[config.icon] || icons.chat;
    launcher.setAttribute('aria-label', 'Open chat');

    // Send CLOSE message to iframe
    sendMessage({ type: 'CLOSE' });
  }

  // Send postMessage to iframe
  function sendMessage(msg) {
    if (!iframe || !iframe.contentWindow) return;
    
    var message = {
      source: NAMESPACE,
      version: VERSION,
      type: msg.type,
      payload: msg.payload
    };
    
    iframe.contentWindow.postMessage(message, WIDGET_ORIGIN);
  }

  // Handle messages from iframe
  function handleMessage(event) {
    // Security: only accept messages from widget origin
    if (event.origin !== WIDGET_ORIGIN) return;
    
    var data = event.data;
    if (!data || data.source !== NAMESPACE) return;

    switch (data.type) {
      case 'WIDGET_READY':
        isReady = true;
        // Send initial config to iframe
        sendMessage({
          type: 'INIT',
          payload: {
            agentId: config.agentId,
            color: config.color
          }
        });
        // Auto-open if URL param says so
        if (shouldAutoOpen()) {
          openWidget();
        }
        break;
      
      case 'REQUEST_CLOSE':
        closeWidget();
        break;
    }
  }

  // Initialize
  function init() {
    createLauncher();
    createIframe();
    window.addEventListener('message', handleMessage);
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
