// ============================================
// NOTION RESEARCH CLIPPER - POPUP SCRIPT
// ============================================

// ============================================
// STATE
// ============================================

const state = {
  isConnected: false,
  currentPage: null,
  citation: null,
  databases: [],
  selectedDatabase: null,
  tags: [],
  recentClips: []
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  await initialize();
});

async function initialize() {
  try {
    // Check Notion connection
    await checkConnection();
    
    // Get current tab info
    await getCurrentPageInfo();
    
    // Load settings and data
    await loadDatabases();
    await loadRecentClips();
    await generateCitation();
    
    // Setup event listeners
    setupEventListeners();
    
    // Update stats
    updateStats();
    
  } catch (error) {
    console.error('Initialization error:', error);
    showToast('Failed to initialize', 'error');
  }
}

// ============================================
// CONNECTION MANAGEMENT
// ============================================

async function checkConnection() {
  const statusBar = document.getElementById('statusBar');
  const statusText = document.getElementById('statusText');
  const connectPrompt = document.getElementById('connectPrompt');
  const mainContent = document.getElementById('mainContent');
  const recentSection = document.getElementById('recentSection');
  
  try {
    const { notionToken, notionWorkspace } = await chrome.storage.sync.get([
      'notionToken',
      'notionWorkspace'
    ]);
    
    if (notionToken) {
      // Verify token is still valid
      const isValid = await verifyNotionToken(notionToken);
      
      if (isValid) {
        state.isConnected = true;
        statusBar.classList.remove('error', 'warning');
        statusText.textContent = `Connected to ${notionWorkspace || 'Notion'}`;
        
        connectPrompt.style.display = 'none';
        mainContent.style.display = 'block';
        recentSection.style.display = 'block';
      } else {
        throw new Error('Token invalid');
      }
    } else {
      throw new Error('Not connected');
    }
  } catch (error) {
    state.isConnected = false;
    statusBar.classList.add('warning');
    statusText.textContent = 'Not connected to Notion';
    
    connectPrompt.style.display = 'flex';
    mainContent.style.display = 'none';
    recentSection.style.display = 'none';
  }
}

async function verifyNotionToken(token) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'NOTION_API_REQUEST',
      endpoint: '/users/me',
      method: 'GET',
      token: token
    });
    
    return response.success;
  } catch {
    return false;
  }
}

async function connectToNotion() {
  // Open options page for OAuth flow
  chrome.runtime.openOptionsPage();
  window.close();
}

// ============================================
// PAGE INFO
// ============================================

async function getCurrentPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    state.currentPage = {
      title: tab.title || 'Untitled',
      url: tab.url,
      favIconUrl: tab.favIconUrl
    };
    
    // Extract additional metadata from page
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_PAGE_METADATA'
      });
      
      if (response) {
        state.currentPage = {
          ...state.currentPage,
          ...response
        };
      }
    } catch {
      // Content script might not be loaded
    }
    
    // Update UI
    document.getElementById('pageTitle').textContent = state.currentPage.title;
    document.getElementById('pageUrl').textContent = state.currentPage.url;
    
  } catch (error) {
    console.error('Error getting page info:', error);
  }
}

// ============================================
// CITATION GENERATION
// ============================================

async function generateCitation() {
  if (!state.currentPage) return;
  
  const format = document.getElementById('citationFormat').value;
  const citationText = document.getElementById('citationText');
  
  try {
    const citation = await chrome.runtime.sendMessage({
      type: 'GENERATE_CITATION',
      pageInfo: state.currentPage,
      format: format
    });
    
    state.citation = citation;
    citationText.textContent = citation.formatted;
    
  } catch (error) {
    citationText.textContent = 'Unable to generate citation';
  }
}

// ============================================
// DATABASE MANAGEMENT
// ============================================

async function loadDatabases() {
  if (!state.isConnected) return;
  
  const select = document.getElementById('databaseSelect');
  const refreshBtn = document.getElementById('refreshDatabasesBtn');
  
  try {
    refreshBtn.classList.add('spinning');
    
    const response = await chrome.runtime.sendMessage({
      type: 'GET_NOTION_DATABASES'
    });
    
    if (response.success) {
      state.databases = response.databases;
      
      // Populate select
      select.innerHTML = '<option value="">Select a database...</option>';
      
      state.databases.forEach(db => {
        const option = document.createElement('option');
        option.value = db.id;
        option.textContent = db.title;
        option.dataset.icon = db.icon;
        select.appendChild(option);
      });
      
      // Restore last selected database
      const { lastDatabase } = await chrome.storage.sync.get('lastDatabase');
      if (lastDatabase && state.databases.some(db => db.id === lastDatabase)) {
        select.value = lastDatabase;
        state.selectedDatabase = lastDatabase;
      }
    }
    
  } catch (error) {
    console.error('Error loading databases:', error);
  } finally {
    refreshBtn.classList.remove('spinning');
  }
}

// ============================================
// CLIPPING FUNCTIONS
// ============================================

async function clipSelection() {
  showLoading('Getting selection...');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_SELECTION'
    });
    
    if (response && response.selection) {
      await saveToNotion({
        type: 'selection',
        content: response.selection,
        ...state.currentPage
      });
    } else {
      hideLoading();
      showToast('No text selected', 'warning');
    }
    
  } catch (error) {
    hideLoading();
    showToast('Failed to get selection', 'error');
  }
}

async function takeScreenshot() {
  showLoading('Capturing screenshot...');
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CAPTURE_SCREENSHOT'
    });
    
    if (response.success) {
      await saveToNotion({
        type: 'screenshot',
        imageData: response.imageData,
        ...state.currentPage
      });
    } else {
      throw new Error(response.error);
    }
    
  } catch (error) {
    hideLoading();
    showToast('Failed to capture screenshot', 'error');
  }
}

async function clipFullPage() {
  showLoading('Clipping page...');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_PAGE_CONTENT'
    });
    
    if (response) {
      await saveToNotion({
        type: 'page',
        content: response.content,
        summary: response.summary,
        ...state.currentPage
      });
    }
    
  } catch (error) {
    hideLoading();
    showToast('Failed to clip page', 'error');
  }
}

async function saveToNotion(clipData) {
  const databaseId = document.getElementById('databaseSelect').value;
  const notes = document.getElementById('notesInput').value;
  
  if (!databaseId) {
    hideLoading();
    showToast('Please select a database', 'warning');
    return;
  }
  
  showLoading('Saving to Notion...');
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_TO_NOTION',
      data: {
        ...clipData,
        databaseId: databaseId,
        tags: state.tags,
        notes: notes,
        citation: state.citation
      }
    });
    
    if (response.success) {
      hideLoading();
      showToast('Saved to Notion!', 'success');
      
      // Save to recent clips
      await addToRecentClips({
        title: clipData.title,
        type: clipData.type,
        notionUrl: response.notionUrl,
        savedAt: new Date().toISOString()
      });
      
      // Update stats
      await updateClipCount();
      
      // Clear form
      document.getElementById('notesInput').value = '';
      state.tags = [];
      renderTags();
      
    } else {
      throw new Error(response.error);
    }
    
  } catch (error) {
    hideLoading();
    showToast('Failed to save: ' + error.message, 'error');
  }
}

// ============================================
// TAGS MANAGEMENT
// ============================================

function addTag(tagText) {
  const tag = tagText.trim().toLowerCase();
  
  if (!tag || state.tags.includes(tag)) return;
  
  if (state.tags.length >= 10) {
    showToast('Maximum 10 tags allowed', 'warning');
    return;
  }
  
  state.tags.push(tag);
  renderTags();
}

function removeTag(tag) {
  state.tags = state.tags.filter(t => t !== tag);
  renderTags();
}

function renderTags() {
  const tagsList = document.getElementById('tagsList');
  
  tagsList.innerHTML = state.tags.map(tag => `
    <span class="tag">
      ${escapeHtml(tag)}
      <button class="tag-remove" data-tag="${escapeHtml(tag)}">×</button>
    </span>
  `).join('');
  
  // Add click handlers
  tagsList.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      removeTag(btn.dataset.tag);
    });
  });
}

// ============================================
// RECENT CLIPS
// ============================================

async function loadRecentClips() {
  const { recentClips = [] } = await chrome.storage.local.get('recentClips');
  state.recentClips = recentClips.slice(0, 5);
  renderRecentClips();
}

function renderRecentClips() {
  const recentList = document.getElementById('recentList');
  
  if (state.recentClips.length === 0) {
    recentList.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 16px; color: #888;">
        No recent clips yet
      </div>
    `;
    return;
  }
  
  recentList.innerHTML = state.recentClips.map(clip => {
    const icon = clip.type === 'screenshot' ? '📸' : 
                 clip.type === 'selection' ? '📝' : '📄';
    
    return `
      <div class="recent-item" data-url="${clip.notionUrl || '#'}">
        <span class="recent-icon">${icon}</span>
        <div class="recent-content">
          <div class="recent-title">${escapeHtml(clip.title)}</div>
          <div class="recent-meta">${formatRelativeTime(clip.savedAt)}</div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  recentList.querySelectorAll('.recent-item').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.dataset.url;
      if (url && url !== '#') {
        chrome.tabs.create({ url });
      }
    });
  });
}

async function addToRecentClips(clip) {
  state.recentClips.unshift(clip);
  state.recentClips = state.recentClips.slice(0, 10);
  
  await chrome.storage.local.set({ recentClips: state.recentClips });
  renderRecentClips();
}

// ============================================
// STATISTICS
// ============================================

async function updateStats() {
  const { clipStats = { weeklyCount: 0, lastReset: null } } = 
    await chrome.storage.local.get('clipStats');
  
  // Reset weekly count if needed
  const now = new Date();
  const lastReset = clipStats.lastReset ? new Date(clipStats.lastReset) : null;
  
  if (!lastReset || isNewWeek(lastReset, now)) {
    clipStats.weeklyCount = 0;
    clipStats.lastReset = now.toISOString();
    await chrome.storage.local.set({ clipStats });
  }
  
  document.getElementById('stats').innerHTML = 
    `<span>📊 ${clipStats.weeklyCount} clips this week</span>`;
}

async function updateClipCount() {
  const { clipStats = { weeklyCount: 0, lastReset: null } } = 
    await chrome.storage.local.get('clipStats');
  
  clipStats.weeklyCount++;
  await chrome.storage.local.set({ clipStats });
  await updateStats();
}

function isNewWeek(date1, date2) {
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return (date2 - date1) > oneWeek;
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Connect button
  document.getElementById('connectNotionBtn')?.addEventListener('click', connectToNotion);
  
  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Quick action buttons
  document.getElementById('clipSelectionBtn').addEventListener('click', clipSelection);
  document.getElementById('screenshotBtn').addEventListener('click', takeScreenshot);
  document.getElementById('clipPageBtn').addEventListener('click', clipFullPage);
  
  // Citation format change
  document.getElementById('citationFormat').addEventListener('change', generateCitation);
  
  // Copy citation
  document.getElementById('copyCitationBtn').addEventListener('click', async () => {
    const citationText = document.getElementById('citationText').textContent;
    await navigator.clipboard.writeText(citationText);
    showToast('Citation copied!', 'success');
  });
  
  // Database selection
  document.getElementById('databaseSelect').addEventListener('change', async (e) => {
    state.selectedDatabase = e.target.value;
    await chrome.storage.sync.set({ lastDatabase: e.target.value });
  });
  
  // Refresh databases
  document.getElementById('refreshDatabasesBtn').addEventListener('click', loadDatabases);
  
  // Tags input
  const tagsInput = document.getElementById('tagsInput');
  tagsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagsInput.value);
      tagsInput.value = '';
    }
  });
  
  // Save button
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const notes = document.getElementById('notesInput').value;
    
    if (!notes && state.tags.length === 0) {
      // If no notes or tags, just clip the current page
      await clipFullPage();
    } else {
      // Save with notes and tags
      await saveToNotion({
        type: 'note',
        ...state.currentPage
      });
    }
  });
  
  // View in Notion link
  document.getElementById('viewInNotionLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://notion.so' });
  });
  
  // Help link
  document.getElementById('helpLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ 
      url: 'https://github.com/yourusername/notion-research-clipper#readme' 
    });
  });
}

// ============================================
// UI HELPERS
// ============================================

function showLoading(message = 'Loading...') {
  const overlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  
  loadingText.textContent = message;
  overlay.style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const toastIcon = document.getElementById('toastIcon');
  const toastMessage = document.getElementById('toastMessage');
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  toast.className = 'toast ' + type;
  toastIcon.textContent = icons[type] || icons.info;
  toastMessage.textContent = message;
  
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLIP_SAVED') {
    hideLoading();
    showToast('Saved to Notion!', 'success');
    loadRecentClips();
  }
  
  if (message.type === 'CLIP_ERROR') {
    hideLoading();
    showToast(message.error, 'error');
  }
});
