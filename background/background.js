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
    .catch(error => {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    });
  
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  console.log('📎 Received message:', message.type);
  
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
    
    case 'GET_DATABASE_SCHEMA':
      return await getDatabaseSchema(message.databaseId);
    
    case 'SAVE_TO_NOTION':
      return await saveToNotion(message.data);
    
    // Citation
    case 'GENERATE_CITATION':
      return generateCitation(message.pageInfo, message.format);
    
    // Screenshot
    case 'CAPTURE_SCREENSHOT':
      return await captureVisibleTab();
    
    case 'CAPTURE_VISIBLE_TAB':
      return await captureVisibleTab();
    
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
    console.error('getDatabases error:', error);
    return { success: false, error: error.message };
  }
}

async function getDatabaseSchema(databaseId) {
  try {
    const { notionToken } = await chrome.storage.sync.get('notionToken');
    
    if (!notionToken) {
      return { success: false, error: 'Not connected to Notion' };
    }
    
    const response = await NotionAPI.getDatabase(notionToken, databaseId);
    
    if (response.error) {
      return { success: false, error: response.error };
    }
    
    return { success: true, properties: response.properties };
    
  } catch (error) {
    console.error('getDatabaseSchema error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// SAVE TO NOTION (DYNAMIC PROPERTIES)
// ============================================

async function saveToNotion(data) {
  try {
    const { notionToken } = await chrome.storage.sync.get('notionToken');
    
    if (!notionToken) {
      return { success: false, error: 'Not connected to Notion. Please go to Settings and connect your Notion account.' };
    }
    
    if (!data.databaseId) {
      return { success: false, error: 'No database selected. Please select a database first.' };
    }
    
    // IMPORTANT: Get database schema to know what properties exist
    const schemaResponse = await getDatabaseSchema(data.databaseId);
    
    if (!schemaResponse.success) {
      return { success: false, error: 'Could not fetch database schema: ' + schemaResponse.error };
    }
    
    const dbProperties = schemaResponse.properties;
    console.log('📎 Database properties:', Object.keys(dbProperties));
    
    // Build page properties based on what actually exists in the database
    const properties = buildNotionProperties(data, dbProperties);
    
    // Build page content
    const children = buildNotionContent(data);
    
    console.log('📎 Creating page with properties:', Object.keys(properties));
    
    // Create page in database
    const response = await NotionAPI.createPage(
      notionToken,
      data.databaseId,
      properties,
      children
    );
    
    if (response.error) {
      console.error('📎 Notion API error:', response.error);
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
    console.error('saveToNotion error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Build Notion properties dynamically based on what exists in the database
 */
function buildNotionProperties(data, dbProperties) {
  const properties = {};
  
  // Find the title property (required, every database has one)
  const titlePropName = Object.keys(dbProperties).find(
    key => dbProperties[key].type === 'title'
  ) || 'Name';
  
  properties[titlePropName] = {
    title: [
      {
        text: {
          content: (data.title || 'Untitled Clip').substring(0, 2000)
        }
      }
    ]
  };
  
  // URL property - check various common names
  const urlPropName = findProperty(dbProperties, 'url', ['URL', 'Url', 'Link', 'Source', 'Source URL']);
  if (urlPropName && data.url) {
    properties[urlPropName] = {
      url: data.url
    };
  }
  
  // Tags property (multi-select) - check various common names
  const tagsPropName = findProperty(dbProperties, 'multi_select', ['Tags', 'Tag', 'Labels', 'Categories']);
  if (tagsPropName && data.tags && data.tags.length > 0) {
    properties[tagsPropName] = {
      multi_select: data.tags.map(tag => ({ name: tag }))
    };
  }
  
  // Type property (select) - check various common names
  const typePropName = findProperty(dbProperties, 'select', ['Type', 'Category', 'Kind']);
  if (typePropName) {
    const typeValue = data.type === 'screenshot' ? 'Screenshot' :
                      data.type === 'selection' ? 'Quote' :
                      data.type === 'page' ? 'Article' :
                      data.type === 'image' ? 'Image' :
                      data.type === 'link' ? 'Link' : 'Note';
    properties[typePropName] = {
      select: { name: typeValue }
    };
  }
  
  // Date property - check various common names
  const datePropName = findProperty(dbProperties, 'date', ['Clipped', 'Date', 'Created', 'Added', 'Saved']);
  if (datePropName) {
    properties[datePropName] = {
      date: {
        start: new Date().toISOString()
      }
    };
  }
  
  // Notes property (rich_text) - check various common names  
  const notesPropName = findProperty(dbProperties, 'rich_text', ['Notes', 'Description', 'Summary', 'Content']);
  if (notesPropName && data.notes) {
    properties[notesPropName] = {
      rich_text: [
        {
          text: {
            content: data.notes.substring(0, 2000)
          }
        }
      ]
    };
  }
  
  return properties;
}

/**
 * Find a property in the database by type and possible names
 */
function findProperty(dbProperties, type, possibleNames) {
  // First try exact matches
  for (const name of possibleNames) {
    if (dbProperties[name] && dbProperties[name].type === type) {
      return name;
    }
  }
  
  // Then try case-insensitive
  const lowerNames = possibleNames.map(n => n.toLowerCase());
  for (const key of Object.keys(dbProperties)) {
    if (dbProperties[key].type === type && lowerNames.includes(key.toLowerCase())) {
      return key;
    }
  }
  
  return null;
}

function buildNotionContent(data) {
  const children = [];
  
  // Source callout with link
  if (data.url) {
    children.push({
      object: 'block',
      type: 'callout',
      callout: {
        icon: { emoji: '🔗' },
        rich_text: [
          {
            type: 'text',
            text: {
              content: 'Source: '
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
  }
  
  // Citation block
  if (data.citation && data.citation.formatted) {
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
  if ((data.type === 'selection' || data.type === 'quote') && data.content) {
    // Quote block for selection
    children.push({
      object: 'block',
      type: 'quote',
      quote: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: data.content.substring(0, 2000)
            }
          }
        ]
      }
    });
  }
  
  if (data.type === 'screenshot') {
    children.push({
      object: 'block',
      type: 'callout',
      callout: {
        icon: { emoji: '📸' },
        rich_text: [
          {
            type: 'text',
            text: {
              content: 'Screenshot captured from this page'
            }
          }
        ]
      }
    });
  }
  
  if (data.type === 'image' && data.imageUrl) {
    // External image
    children.push({
      object: 'block',
      type: 'image',
      image: {
        type: 'external',
        external: {
          url: data.imageUrl
        }
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
            text: { content: data.notes.substring(0, 2000) }
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
  try {
    return CitationGenerator.generate(pageInfo, format);
  } catch (error) {
    console.error('Citation generation error:', error);
    return { formatted: '', error: error.message };
  }
}

// ============================================
// SCREENSHOT CAPTURE
// ============================================

async function captureVisibleTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      return { success: false, error: 'No active tab found' };
    }
    
    // Check if we can capture this tab
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return { success: false, error: 'Cannot capture browser internal pages' };
    }
    
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png'
    });
    
    return {
      success: true,
      imageData: dataUrl
    };
    
  } catch (error) {
    console.error('Screenshot error:', error);
    return {
      success: false,
      error: 'Failed to capture screenshot: ' + error.message
    };
  }
}

// ============================================
// QUICK CLIP
// ============================================

async function quickClip(data) {
  try {
    const { lastDatabase } = await chrome.storage.sync.get('lastDatabase');
    
    if (!lastDatabase) {
      return { success: false, error: 'Please select a default database in Settings first' };
    }
    
    const result = await saveToNotion({
      ...data,
      databaseId: lastDatabase,
      type: data.type || 'selection'
    });
    
    if (result.success) {
      // Show notification
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: '✅ Clipped to Notion',
          message: `"${(data.title || data.selection || 'Content').substring(0, 50)}..." saved successfully`
        });
      } catch (e) {
        console.log('Notification error (non-critical):', e);
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('quickClip error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// CLIP HANDLERS
// ============================================

async function handleSelectionClip(selectionText, tab) {
  if (!selectionText) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '⚠️ No Selection',
      message: 'Please select some text first'
    });
    return;
  }
  
  let metadata = {};
  try {
    metadata = await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_PAGE_METADATA'
    });
  } catch (e) {
    console.log('Could not get metadata:', e);
  }
  
  await quickClip({
    content: selectionText,
    selection: selectionText,
    title: tab.title,
    url: tab.url,
    type: 'selection',
    ...metadata
  });
}

async function handlePageClip(tab) {
  let content = null;
  
  try {
    content = await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_PAGE_CONTENT'
    });
  } catch (e) {
    console.log('Could not get page content:', e);
  }
  
  await quickClip({
    type: 'page',
    content: content?.content || '',
    summary: content?.summary || '',
    title: tab.title,
    url: tab.url
  });
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
  try {
    const { clipStats = {} } = await chrome.storage.local.get('clipStats');
    
    clipStats.totalClips = (clipStats.totalClips || 0) + 1;
    clipStats.weeklyCount = (clipStats.weeklyCount || 0) + 1;
    
    await chrome.storage.local.set({ clipStats });
  } catch (e) {
    console.error('Stats update error:', e);
  }
}

async function addToRecentClips(clip) {
  try {
    const { recentClips = [] } = await chrome.storage.local.get('recentClips');
    
    recentClips.unshift(clip);
    const trimmed = recentClips.slice(0, 20);
    
    await chrome.storage.local.set({ recentClips: trimmed });
  } catch (e) {
    console.error('Recent clips update error:', e);
  }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

chrome.commands.onCommand.addListener(async (command) => {
  console.log('📎 Command received:', command);
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    console.log('No active tab');
    return;
  }
  
  switch (command) {
    case 'quick-clip':
      // Get selection and clip
      try {
        const selection = await chrome.tabs.sendMessage(tab.id, {
          type: 'GET_SELECTION'
        });
        
        if (selection?.selection) {
          await quickClip({
            selection: selection.selection,
            content: selection.selection,
            title: tab.title,
            url: tab.url,
            type: 'selection'
          });
        } else {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: '⚠️ No Selection',
            message: 'Please select some text first'
          });
        }
      } catch (e) {
        console.error('Quick clip error:', e);
      }
      break;
    
    case 'screenshot-clip':
      const screenshot = await captureVisibleTab();
      if (screenshot.success) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: '📸 Screenshot Captured',
          message: 'Screenshot saved (open popup to save to Notion)'
        });
      } else {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: '❌ Screenshot Failed',
          message: screenshot.error
        });
      }
      break;
  }
});

console.log('📎 Notion Research Clipper background service started');
