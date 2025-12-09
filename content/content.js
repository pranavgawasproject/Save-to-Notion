// ============================================
// NOTION RESEARCH CLIPPER - CONTENT SCRIPT
// ============================================

(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.notionClipperLoaded) return;
  window.notionClipperLoaded = true;
  
  console.log('📎 Notion Research Clipper loaded');
  
  // ============================================
  // MESSAGE HANDLER
  // ============================================
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ error: error.message }));
    
    return true; // Keep channel open for async response
  });
  
  async function handleMessage(message) {
    switch (message.type) {
      case 'GET_PAGE_METADATA':
        return getPageMetadata();
      
      case 'GET_SELECTION':
        return getSelection();
      
      case 'GET_PAGE_CONTENT':
        return getPageContent();
      
      case 'START_AREA_SCREENSHOT':
        return startAreaScreenshot();
      
      case 'HIGHLIGHT_CLIPPED':
        highlightClipped(message.text);
        return { success: true };
      
      default:
        return { error: 'Unknown message type' };
    }
  }
  
  // ============================================
  // PAGE METADATA EXTRACTION
  // ============================================
  
  function getPageMetadata() {
    const metadata = {
      title: document.title || 'Untitled',
      url: window.location.href,
      siteName: null,
      author: null,
      publishedDate: null,
      description: null,
      image: null
    };
    
    // Open Graph tags
    metadata.siteName = getMetaContent('og:site_name');
    metadata.description = getMetaContent('og:description') || 
                          getMetaContent('description');
    metadata.image = getMetaContent('og:image');
    
    // Author extraction
    metadata.author = getMetaContent('author') ||
                     getMetaContent('article:author') ||
                     extractAuthorFromPage();
    
    // Date extraction
    metadata.publishedDate = getMetaContent('article:published_time') ||
                            getMetaContent('datePublished') ||
                            getMetaContent('date') ||
                            extractDateFromPage();
    
    // Try to get canonical URL
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      metadata.canonicalUrl = canonical.href;
    }
    
    return metadata;
  }
  
  function getMetaContent(name) {
    // Check various meta tag formats
    const selectors = [
      `meta[name="${name}"]`,
      `meta[property="${name}"]`,
      `meta[itemprop="${name}"]`
    ];
    
    for (const selector of selectors) {
      const meta = document.querySelector(selector);
      if (meta && meta.content) {
        return meta.content;
      }
    }
    
    return null;
  }
  
  function extractAuthorFromPage() {
    // Common author selectors
    const authorSelectors = [
      '[rel="author"]',
      '.author',
      '.author-name',
      '.byline',
      '.post-author',
      '.article-author',
      '[itemprop="author"]',
      '.entry-author'
    ];
    
    for (const selector of authorSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        // Clean up common prefixes
        return text.replace(/^(by|written by|author:)\s*/i, '');
      }
    }
    
    return null;
  }
  
  function extractDateFromPage() {
    // Common date selectors
    const dateSelectors = [
      'time[datetime]',
      '[itemprop="datePublished"]',
      '.date',
      '.post-date',
      '.publish-date',
      '.entry-date'
    ];
    
    for (const selector of dateSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Try datetime attribute first
        if (element.dateTime) {
          return element.dateTime;
        }
        
        // Try to parse text content
        const text = element.textContent.trim();
        const parsed = Date.parse(text);
        if (!isNaN(parsed)) {
          return new Date(parsed).toISOString();
        }
      }
    }
    
    return null;
  }
  
  // ============================================
  // SELECTION HANDLING
  // ============================================
  
  function getSelection() {
    const selection = window.getSelection();
    
    if (!selection || selection.isCollapsed) {
      return { selection: null };
    }
    
    const text = selection.toString().trim();
    
    if (!text) {
      return { selection: null };
    }
    
    // Get the context (surrounding text)
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    
    // Get parent element for context
    let parentElement = container;
    if (container.nodeType === Node.TEXT_NODE) {
      parentElement = container.parentElement;
    }
    
    // Try to get some context
    let context = '';
    if (parentElement && parentElement.closest) {
      const article = parentElement.closest('article, .content, .post, main');
      if (article) {
        context = article.querySelector('h1, h2')?.textContent || '';
      }
    }
    
    // Get position for potential highlight
    const rect = range.getBoundingClientRect();
    
    return {
      selection: text,
      context: context,
      position: {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height
      }
    };
  }
  
  // ============================================
  // PAGE CONTENT EXTRACTION
  // ============================================
  
  function getPageContent() {
    // Find main content area
    const contentSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      '#content'
    ];
    
    let contentElement = null;
    
    for (const selector of contentSelectors) {
      contentElement = document.querySelector(selector);
      if (contentElement) break;
    }
    
    if (!contentElement) {
      contentElement = document.body;
    }
    
    // Clone and clean content
    const clone = contentElement.cloneNode(true);
    
    // Remove unwanted elements
    const removeSelectors = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      '.sidebar',
      '.advertisement',
      '.ads',
      '.comments',
      '.social-share',
      '.related-posts',
      'iframe'
    ];
    
    removeSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    // Get clean text
    const content = cleanText(clone.textContent);
    
    // Generate summary (first 500 characters)
    const summary = content.substring(0, 500).trim() + 
                   (content.length > 500 ? '...' : '');
    
    // Get all headings for structure
    const headings = Array.from(contentElement.querySelectorAll('h1, h2, h3, h4'))
      .map(h => ({
        level: parseInt(h.tagName.charAt(1)),
        text: h.textContent.trim()
      }))
      .slice(0, 10);
    
    // Get all images
    const images = Array.from(contentElement.querySelectorAll('img'))
      .filter(img => img.src && img.naturalWidth > 100)
      .map(img => ({
        src: img.src,
        alt: img.alt
      }))
      .slice(0, 5);
    
    return {
      content: content,
      summary: summary,
      headings: headings,
      images: images,
      wordCount: content.split(/\s+/).length
    };
  }
  
  function cleanText(text) {
    return text
      .replace(/\s+/g, ' ')           // Multiple spaces to single
      .replace(/\n\s*\n/g, '\n\n')    // Multiple newlines to double
      .trim();
  }
  
  // ============================================
  // AREA SCREENSHOT
  // ============================================
  
  let screenshotOverlay = null;
  let screenshotStartX = 0;
  let screenshotStartY = 0;
  let isSelecting = false;
  
  function startAreaScreenshot() {
    return new Promise((resolve) => {
      // Create overlay
      screenshotOverlay = document.createElement('div');
      screenshotOverlay.id = 'notion-clipper-screenshot-overlay';
      screenshotOverlay.innerHTML = `
        <div class="screenshot-instructions">
          Click and drag to select area • ESC to cancel
        </div>
        <div class="screenshot-selection"></div>
      `;
      document.body.appendChild(screenshotOverlay);
      
      const selection = screenshotOverlay.querySelector('.screenshot-selection');
      
      // Mouse events
      screenshotOverlay.addEventListener('mousedown', (e) => {
        isSelecting = true;
        screenshotStartX = e.clientX;
        screenshotStartY = e.clientY;
        
        selection.style.left = screenshotStartX + 'px';
        selection.style.top = screenshotStartY + 'px';
        selection.style.width = '0';
        selection.style.height = '0';
        selection.style.display = 'block';
      });
      
      screenshotOverlay.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        
        const currentX = e.clientX;
        const currentY = e.clientY;
        
        const left = Math.min(screenshotStartX, currentX);
        const top = Math.min(screenshotStartY, currentY);
        const width = Math.abs(currentX - screenshotStartX);
        const height = Math.abs(currentY - screenshotStartY);
        
        selection.style.left = left + 'px';
        selection.style.top = top + 'px';
        selection.style.width = width + 'px';
        selection.style.height = height + 'px';
      });
      
      screenshotOverlay.addEventListener('mouseup', (e) => {
        if (!isSelecting) return;
        isSelecting = false;
        
        const rect = selection.getBoundingClientRect();
        
        // Clean up
        screenshotOverlay.remove();
        screenshotOverlay = null;
        
        if (rect.width > 10 && rect.height > 10) {
          resolve({
            success: true,
            area: {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height
            }
          });
        } else {
          resolve({ success: false, error: 'Selection too small' });
        }
      });
      
      // ESC to cancel
      document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
          if (screenshotOverlay) {
            screenshotOverlay.remove();
            screenshotOverlay = null;
          }
          document.removeEventListener('keydown', escHandler);
          resolve({ success: false, error: 'Cancelled' });
        }
      });
    });
  }
  
  // ============================================
  // HIGHLIGHT CLIPPED TEXT
  // ============================================
  
  function highlightClipped(text) {
    if (!text || text.length < 10) return;
    
    // Create highlight style if not exists
    if (!document.getElementById('notion-clipper-highlight-style')) {
      const style = document.createElement('style');
      style.id = 'notion-clipper-highlight-style';
      style.textContent = `
        .notion-clipper-highlight {
          background: rgba(35, 131, 226, 0.2) !important;
          border-bottom: 2px solid #2383e2 !important;
          padding: 2px 0 !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Find and highlight the text
    // This is a simplified version - for production, use a proper text highlighter
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.includes(text.substring(0, 50))) {
        const span = document.createElement('span');
        span.className = 'notion-clipper-highlight';
        node.parentNode.insertBefore(span, node);
        span.appendChild(node);
        break;
      }
    }
  }
  
  // ============================================
  // QUICK CLIP FLOATING BUTTON
  // ============================================
  
  function showQuickClipButton(selection) {
    // Remove existing button
    const existing = document.getElementById('notion-clipper-quick-btn');
    if (existing) existing.remove();
    
    if (!selection.position) return;
    
    const button = document.createElement('button');
    button.id = 'notion-clipper-quick-btn';
    button.innerHTML = '📎 Clip';
    button.style.cssText = `
      position: absolute;
      left: ${selection.position.left}px;
      top: ${selection.position.top - 40}px;
      background: #2383e2;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      z-index: 999999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    `;
    
    button.addEventListener('click', async () => {
      button.innerHTML = '⏳ Saving...';
      button.disabled = true;
      
      try {
        await chrome.runtime.sendMessage({
          type: 'QUICK_CLIP',
          data: {
            selection: selection.selection,
            context: selection.context,
            url: window.location.href,
            title: document.title
          }
        });
        
        button.innerHTML = '✅ Saved!';
        setTimeout(() => button.remove(), 1500);
        
      } catch (error) {
        button.innerHTML = '❌ Error';
        setTimeout(() => button.remove(), 1500);
      }
    });
    
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
    });
    
    document.body.appendChild(button);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(button)) {
        button.style.opacity = '0';
        button.style.transform = 'translateY(-10px)';
        setTimeout(() => button.remove(), 200);
      }
    }, 5000);
  }
  
  // Listen for text selection
  document.addEventListener('mouseup', () => {
    setTimeout(() => {
      const selection = getSelection();
      if (selection.selection && selection.selection.length > 20) {
        showQuickClipButton(selection);
      }
    }, 100);
  });
  
  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================
  
  document.addEventListener('keydown', (e) => {
    // Alt + Shift + S = Quick clip selection
    if (e.altKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      const selection = getSelection();
      if (selection.selection) {
        chrome.runtime.sendMessage({
          type: 'QUICK_CLIP',
          data: {
            selection: selection.selection,
            url: window.location.href,
            title: document.title
          }
        });
        showNotification('Selection clipped!');
      } else {
        showNotification('No text selected', 'warning');
      }
    }
    
    // Alt + Shift + C = Screenshot
    if (e.altKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'TRIGGER_SCREENSHOT' });
    }
  });
  
  // ============================================
  // NOTIFICATION
  // ============================================
  
  function showNotification(message, type = 'success') {
    // Remove existing
    const existing = document.getElementById('notion-clipper-notification');
    if (existing) existing.remove();
    
    const colors = {
      success: '#4dab9a',
      error: '#eb5757',
      warning: '#ffa344'
    };
    
    const notification = document.createElement('div');
    notification.id = 'notion-clipper-notification';
    notification.innerHTML = `
      <span style="margin-right: 8px;">${type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️'}</span>
      ${message}
    `;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999999;
      display: flex;
      align-items: center;
      animation: notionClipperSlideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'notionClipperSlideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
  
  // ============================================
  // INJECT STYLES
  // ============================================
  
  function injectStyles() {
    if (document.getElementById('notion-clipper-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'notion-clipper-styles';
    style.textContent = `
      @keyframes notionClipperSlideIn {
        from {
          opacity: 0;
          transform: translateX(100px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      
      @keyframes notionClipperSlideOut {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100px);
        }
      }
      
      #notion-clipper-screenshot-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.3);
        cursor: crosshair;
        z-index: 999999;
      }
      
      #notion-clipper-screenshot-overlay .screenshot-instructions {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }
      
      #notion-clipper-screenshot-overlay .screenshot-selection {
        position: fixed;
        border: 2px dashed #2383e2;
        background: rgba(35, 131, 226, 0.1);
        display: none;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Initialize
  injectStyles();
  
})();
