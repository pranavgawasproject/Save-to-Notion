// ============================================
// NOTION RESEARCH CLIPPER - BACKGROUND SERVICE WORKER
// ============================================

import { NotionAPI } from '../utils/notion-api.js';
import { CitationGenerator } from '../utils/citation.js';

// ============================================
// INITIALIZATION
// ============================================

chrome.runtime.onInstalled.addListener((details) => {
  console.log('📎 Notion Research Clipper installed');
  
  if (details.reason === 'install') {
    initializeExtension();
  }
  
  // Setup context menus
  setupContextMenus();
});

async function initializeExtension() {
  // Set default settings
  await chrome.storage.sync.set({
    citationFormat: 'apa',
    autoSave: false,
    showQuickClip: true,
    notificationSound: true
  });
  
  await chrome.storage.local.set({
    recentClips: [],
    clipStats: {
      totalClips: 0,
      weeklyCount: 0,
      lastReset: new Date().toISOString()
    }
  });
}

// ============================================
// CONTEXT MENUS
// ============================================

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'clip-selection',
      title: '📎 Clip selection to Notion',
      contexts: ['selection']
    });
    
    chrome.contextMenus.create({
      id: 'clip-page',
      title: '📄 Clip page to Notion',
      contexts: ['page']
    });
    
    chrome.contextMenus.create({
      id: 'clip-image',
      title: '🖼️ Clip image to Notion',
      contexts: ['image']
    });
    
    chrome.contextMenus.create({
      id: 'clip-link',
      title: '🔗 Clip link to Notion',
      contexts: ['link']
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'clip-selection':
      await handleSelectionClip(info.selectionText, tab);
      break;
    
    case 'clip-page':
      await handlePageClip(tab);
      break;
    
    case 'clip-image':
      await handleImageClip(info.srcUrl, tab);
      break;
    
    case 'clip-link':
      await handleLinkClip(info.linkUrl, info.selectionText, tab);
      break;
  }
});

// ============================================
// MESSAGE HANDLERS
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(response => sendResponse(response))
    .catch(error => sendResponse({ success: false, error: error.message }));
  
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    
    // Notion API
    case 'NOTION_API_REQUEST':
      return await NotionAPI.request(
        message.endpoint,
        message.method,
        message.body,
        message.token
      );
    
    case 'GET_NOTION_DATABASES':
      return await getDatabases();
    
    case 'SAVE_TO_NOTION':
      return await saveToNotion(message.data);
    
    // Citation
    case 'GENERATE_CITATION':
      return generateCitation(message.pageInfo, message.format);
    
    // Screenshot
    case 'CAPTURE_SCREENSHOT':
      return await captureScreenshot(sender.tab);
    
    case 'TRIGGER_SCREENSHOT':
      return await triggerScreenshot(sender.tab);
    
    // Quick clip
    case 'QUICK_CLIP':
      return await quickClip(message.data);
    
    // Settings
    case 'GET_SETTINGS':
      return await chrome.storage.sync.get(null);
    
    case 'SAVE_SETTINGS':
      await chrome.storage.sync.set(message.settings);
      return { success: true };
    
    default:
      throw new Error('Unknown message type: ' + message.type);
  }
}

// ============================================
// NOTION DATABASE FUNCTIONS
// ============================================

async function getDatabases() {
  try {
    const { notionToken } = await chrome.storage.sync.get('notionToken');
    
    if (!notionToken) {
      return { success: false, error: 'Not connected to Notion' };
    }
    
    const response = await NotionAPI.searchDatabases(notionToken);
    
    if (response.error) {
      return { success: false, error: response.error };
    }
    
    const databases = response.results
      .filter(item => item.object === 'database')
      .map(db => ({
        id: db.id,
        title: db.title[0]?.plain_text || 'Untitled',
        icon: db.icon?.emoji || '📁',
        url: db.url
      }));
    
    return { success: true, databases };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// SAVE TO NOTION
// ============================================

async function saveToNotion(data) {
  try {
    const { notionToken } = await chrome.storage.sync.get('notionToken');
    
    if (!notionToken) {
      return { success: false, error: 'Not connected to Notion' };
    }
    
    // Build page properties based on data type
    const properties = buildNotionProperties(data);
    
    // Build page content
    const children = buildNotionContent(data);
    
    // Create page in database
    const response = await NotionAPI.createPage(
      notionToken,
      data.databaseId,
      properties,
      children
    );
    
    if (response.error) {
      return { success: false, error: response.error };
    }
    
    // Update stats
    await updateClipStats();
    
    // Add to recent clips
    await addToRecentClips({
      title: data.title,
      type: data.type,
      notionUrl: response.url,
      savedAt: new Date().toISOString()
    });
    
    return {
      success: true,
      notionUrl: response.url,
      pageId: response.id
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function buildNotionProperties(data) {
  const properties = {
    // Title property (required)
    'Name': {
      title: [
        {
          text: {
            content: data.title || 'Untitled Clip'
          }
        }
      ]
    }
  };
  
  // URL property
  if (data.url) {
    properties['URL'] = {
      url: data.url
    };
  }
  
  // Tags property (multi-select)
  if (data.tags && data.tags.length > 0) {
    properties['Tags'] = {
      multi_select: data.tags.map(tag => ({ name: tag }))
    };
  }
  
  // Type property (select)
  properties['Type'] = {
    select: {
      name: data.type === 'screenshot' ? 'Screenshot' :
            data.type === 'selection' ? 'Quote' :
            data.type === 'page' ? 'Article' : 'Note'
    }
  };
  
  // Date property
  properties['Clipped'] = {
    date: {
      start: new Date().toISOString()
    }
  };
  
  return properties;
}

function buildNotionContent(data) {
  const children = [];
  
  // Source callout
  children.push({
    object: 'block',
    type: 'callout',
    callout: {
      icon: { emoji: '🔗' },
      rich_text: [
        {
          type: 'text',
          text: {
            content: 'Source: ',
          }
        },
        {
          type: 'text',
          text: {
            content: data.url,
            link: { url: data.url }
          }
        }
      ]
    }
  });
  
  // Citation block
  if (data.citation) {
    children.push({
      object: 'block',
      type: 'quote',
      quote: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: data.citation.formatted
            },
            annotations: {
              italic: true
            }
          }
        ]
      }
    });
  }
  
  // Divider
  children.push({
    object: 'block',
    type: 'divider',
    divider: {}
  });
  
  // Content based on type
  if (data.type === 'selection' && data.content) {
    // Quote block for selection
    children.push({
      object: 'block',
      type: 'quote',
      quote: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: data.content
            }
          }
        ]
      }
    });
  }
  
  if (data.type === 'screenshot' && data.imageData) {
    // Note: For images, you'd need to upload to external service
    // Notion API doesn't accept base64 images directly
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: '📸 Screenshot captured (image upload pending)'
            }
          }
        ]
      }
    });
  }
  
  if (data.type === 'page' && data.content) {
    // Split content into paragraphs
    const paragraphs = data.content.split('\n\n').slice(0, 20);
    
    paragraphs.forEach(para => {
      if (para.trim()) {
        children.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: para.substring(0, 2000) // Notion limit
                }
              }
            ]
          }
        });
      }
    });
  }
  
  // Notes section
  if (data.notes) {
    children.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [
          {
            type: 'text',
            text: { content: '📝 Notes' }
          }
        ]
      }
    });
    
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: data.notes }
          }
        ]
      }
    });
  }
  
  return children;
}

// ============================================
// CITATION GENERATION
// ============================================

function generateCitation(pageInfo, format = 'apa') {
  return CitationGenerator.generate(pageInfo, format);
}

// ============================================
// SCREENSHOT CAPTURE
// ============================================

async function captureScreenshot(tab) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 100
    });
    
    return {
      success: true,
      imageData: dataUrl
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function triggerScreenshot(tab) {
  // Notify content script to start area selection
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'START_AREA_SCREENSHOT'
    });
    
    if (response.success && response.area) {
      // Capture the visible tab
      const screenshot = await captureScreenshot(tab);
      
      if (screenshot.success) {
        // Crop to selected area (would need canvas processing)
        return screenshot;
      }
    }
    
    return response;
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// QUICK CLIP
// ============================================

async function quickClip(data) {
  try {
    const { lastDatabase } = await chrome.storage.sync.get('lastDatabase');
    
    if (!lastDatabase) {
      // Open popup to select database
      return { success: false, error: 'Please select a database first' };
    }
    
    const result = await saveToNotion({
      ...data,
      databaseId: lastDatabase,
      type: 'selection'
    });
    
    if (result.success) {
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Clipped to Notion',
        message: `"${data.selection?.substring(0, 50)}..." saved successfully`
      });
    }
    
    return result;
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// CLIP HANDLERS
// ============================================

async function handleSelectionClip(selectionText, tab) {
  if (!selectionText) return;
  
  const metadata = await chrome.tabs.sendMessage(tab.id, {
    type: 'GET_PAGE_METADATA'
  }).catch(() => ({}));
  
  await quickClip({
    selection: selectionText,
    title: tab.title,
    url: tab.url,
    ...metadata
  });
}

async function handlePageClip(tab) {
  const content = await chrome.tabs.sendMessage(tab.id, {
    type: 'GET_PAGE_CONTENT'
  }).catch(() => null);
  
  if (content) {
    await quickClip({
      type: 'page',
      content: content.content,
      summary: content.summary,
      title: tab.title,
      url: tab.url
    });
  }
}

async function handleImageClip(imageUrl, tab) {
  await quickClip({
    type: 'image',
    imageUrl: imageUrl,
    title: `Image from ${tab.title}`,
    url: tab.url
  });
}

async function handleLinkClip(linkUrl, linkText, tab) {
  await quickClip({
    type: 'link',
    content: linkText || linkUrl,
    linkUrl: linkUrl,
    title: linkText || 'Link',
    url: tab.url
  });
}

// ============================================
// STATISTICS
// ============================================

async function updateClipStats() {
  const { clipStats = {} } = await chrome.storage.local.get('clipStats');
  
  clipStats.totalClips = (clipStats.totalClips || 0) + 1;
  clipStats.weeklyCount = (clipStats.weeklyCount || 0) + 1;
  
  await chrome.storage.local.set({ clipStats });
}

async function addToRecentClips(clip) {
  const { recentClips = [] } = await chrome.storage.local.get('recentClips');
  
  recentClips.unshift(clip);
  const trimmed = recentClips.slice(0, 20);
  
  await chrome.storage.local.set({ recentClips: trimmed });
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  switch (command) {
    case 'quick-clip':
      // Get selection and clip
      const selection = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_SELECTION'
      }).catch(() => null);
      
      if (selection?.selection) {
        await quickClip({
          selection: selection.selection,
          title: tab.title,
          url: tab.url
        });
      }
      break;
    
    case 'screenshot-clip':
      await triggerScreenshot(tab);
      break;
  }
});

console.log('📎 Notion Research Clipper background service started');
