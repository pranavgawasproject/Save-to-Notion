// ============================================
// NOTION RESEARCH CLIPPER - OPTIONS SCRIPT
// ============================================

import { Storage } from '../utils/storage.js';
import { NotionAPI } from '../utils/notion-api.js';

// ============================================
// STATE
// ============================================

let state = {
  isConnected: false,
  settings: {},
  databases: [],
  defaultTags: []
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  await initialize();
});

async function initialize() {
  setupNavigation();
  await loadConnectionStatus();
  await loadSettings();
  await loadStatistics();
  setupEventListeners();
}

// ============================================
// NAVIGATION
// ============================================

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const sectionId = item.dataset.section;
      
      // Update active state
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Show corresponding section
      document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
      });
      
      document.getElementById(`section-${sectionId}`).style.display = 'block';
    });
  });
}

// ============================================
// CONNECTION
// ============================================

async function loadConnectionStatus() {
  const credentials = await Storage.getNotionCredentials();
  
  const statusIcon = document.querySelector('.status-icon');
  const connectionTitle = document.getElementById('connectionTitle');
  const connectionDesc = document.getElementById('connectionDesc');
  const connectionActions = document.getElementById('connectionActions');
  const connectedInfo = document.getElementById('connectedInfo');
  
  if (credentials.isConnected) {
    state.isConnected = true;
    
    // Verify token is still valid
    const isValid = await NotionAPI.verifyToken(credentials.token);
    
    if (isValid) {
      statusIcon.classList.remove('disconnected');
      statusIcon.classList.add('connected');
      statusIcon.textContent = '✅';
      
      connectionTitle.textContent = 'Connected';
      connectionDesc.textContent = 'Your Notion account is connected';
      
      connectionActions.style.display = 'none';
      connectedInfo.style.display = 'grid';
      
      document.getElementById('workspaceName').textContent = 
        credentials.workspace || 'Your Workspace';
      
      // Load databases
      await loadDatabases();
    } else {
      // Token expired
      await Storage.clearNotionCredentials();
      showDisconnected();
    }
  } else {
    showDisconnected();
  }
}

function showDisconnected() {
  state.isConnected = false;
  
  const statusIcon = document.querySelector('.status-icon');
  statusIcon.classList.remove('connected');
  statusIcon.classList.add('disconnected');
  statusIcon.textContent = '🔌';
  
  document.getElementById('connectionTitle').textContent = 'Not Connected';
  document.getElementById('connectionDesc').textContent = 
    'Connect your Notion account to start clipping';
  
  document.getElementById('connectionActions').style.display = 'block';
  document.getElementById('connectedInfo').style.display = 'none';
}

async function connectToNotion() {
  // In a real implementation, this would open OAuth flow
  // For now, we'll show instructions for manual token entry
  
  const token = prompt(
    'Enter your Notion Integration Token:\n\n' +
    '1. Go to notion.so/my-integrations\n' +
    '2. Create a new integration\n' +
    '3. Copy the Internal Integration Token\n' +
    '4. Share your databases with the integration'
  );
  
  if (!token) return;
  
  // Verify token
  const userInfo = await NotionAPI.getUser(token);
  
  if (userInfo.error) {
    showToast('Invalid token. Please try again.', 'error');
    return;
  }
  
  // Save credentials
  await Storage.setNotionCredentials(
    token,
    userInfo.name || 'Notion Workspace',
    userInfo.id
  );
  
  showToast('Connected to Notion!', 'success');
  await loadConnectionStatus();
}

async function disconnectFromNotion() {
  if (!confirm('Are you sure you want to disconnect from Notion?')) {
    return;
  }
  
  await Storage.clearNotionCredentials();
  await Storage.clearDatabaseCache();
  
  showToast('Disconnected from Notion', 'success');
  showDisconnected();
}

async function loadDatabases() {
  const credentials = await Storage.getNotionCredentials();
  if (!credentials.token) return;
  
  const response = await NotionAPI.searchDatabases(credentials.token);
  
  if (response.success) {
    state.databases = response.results
      .filter(item => item.object === 'database')
      .map(db => ({
        id: db.id,
        title: db.title[0]?.plain_text || 'Untitled',
        icon: db.icon?.emoji || '📁'
      }));
    
    document.getElementById('databaseCount').textContent = 
      `${state.databases.length} databases`;
    
    // Populate database select
    const select = document.getElementById('defaultDatabase');
    select.innerHTML = '<option value="">Select a database...</option>';
    
    state.databases.forEach(db => {
      const option = document.createElement('option');
      option.value = db.id;
      option.textContent = `${db.icon} ${db.title}`;
      select.appendChild(option);
    });
    
    // Set current value
    if (state.settings.lastDatabase) {
      select.value = state.settings.lastDatabase;
    }
  }
}

// ============================================
// SETTINGS
// ============================================

async function loadSettings() {
  state.settings = await Storage.getSettings();
  
  // Apply to UI
  document.getElementById('showQuickClip').checked = state.settings.showQuickClip;
  document.getElementById('autoSave').checked = state.settings.autoSave;
  document.getElementById('notificationSound').checked = state.settings.notificationSound;
  document.getElementById('theme').value = state.settings.theme || 'light';
  
  // Citation format
  const formatRadio = document.querySelector(
    `input[name="citationFormat"][value="${state.settings.citationFormat}"]`
  );
  if (formatRadio) formatRadio.checked = true;
  
  // Default tags
  state.defaultTags = state.settings.defaultTags || [];
  renderDefaultTags();
}

async function saveSetting(key, value) {
  state.settings[key] = value;
  await Storage.updateSettings({ [key]: value });
  showToast('Settings saved', 'success');
}

function renderDefaultTags() {
  const tagsList = document.getElementById('defaultTagsList');
  
  tagsList.innerHTML = state.defaultTags.map(tag => `
    <span class="tag">
      ${escapeHtml(tag)}
      <button class="tag-remove" data-tag="${escapeHtml(tag)}">×</button>
    </span>
  `).join('');
  
  tagsList.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => removeDefaultTag(btn.dataset.tag));
  });
}

function addDefaultTag(tag) {
  tag = tag.trim().toLowerCase();
  if (!tag || state.defaultTags.includes(tag)) return;
  
  state.defaultTags.push(tag);
  saveSetting('defaultTags', state.defaultTags);
  renderDefaultTags();
}

function removeDefaultTag(tag) {
  state.defaultTags = state.defaultTags.filter(t => t !== tag);
  saveSetting('defaultTags', state.defaultTags);
  renderDefaultTags();
}

// ============================================
// STATISTICS
// ============================================

async function loadStatistics() {
  const stats = await Storage.getStats();
  const usage = await Storage.getStorageUsage();
  
  document.getElementById('totalClips').textContent = stats.totalClips;
  document.getElementById('weeklyClips').textContent = stats.weeklyCount;
  document.getElementById('storageUsed').textContent = usage.usedFormatted;
}

// ============================================
// DATA MANAGEMENT
// ============================================

async function exportData() {
  const data = await Storage.exportAllData();
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { 
    type: 'application/json' 
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `notion-clipper-backup-${Date.now()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showToast('Data exported successfully', 'success');
}

async function importData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    await Storage.importData(data);
    
    showToast('Data imported successfully', 'success');
    
    // Reload settings
    await loadSettings();
    await loadStatistics();
    
  } catch (error) {
    showToast('Failed to import data: ' + error.message, 'error');
  }
}

async function clearHistory() {
  if (!confirm('Are you sure you want to clear all clip history?')) return;
  
  await Storage.clearRecentClips();
  showToast('History cleared', 'success');
}

async function resetSettings() {
  if (!confirm('Are you sure you want to reset all settings?')) return;
  
  await Storage.resetSettings();
  await loadSettings();
  showToast('Settings reset to defaults', 'success');
}

async function clearAllData() {
  if (!confirm('This will delete ALL extension data including your Notion connection. Continue?')) {
    return;
  }
  
  if (!confirm('Are you REALLY sure? This cannot be undone.')) {
    return;
  }
  
  await Storage.clearAllData();
  showToast('All data cleared', 'success');
  
  // Reload page
  setTimeout(() => location.reload(), 1000);
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Connection
  document.getElementById('connectBtn').addEventListener('click', connectToNotion);
  document.getElementById('disconnectBtn')?.addEventListener('click', disconnectFromNotion);
  
  // Settings toggles
  document.getElementById('showQuickClip').addEventListener('change', (e) => {
    saveSetting('showQuickClip', e.target.checked);
  });
  
  document.getElementById('autoSave').addEventListener('change', (e) => {
    saveSetting('autoSave', e.target.checked);
  });
  
  document.getElementById('notificationSound').addEventListener('change', (e) => {
    saveSetting('notificationSound', e.target.checked);
  });
  
  document.getElementById('theme').addEventListener('change', (e) => {
    saveSetting('theme', e.target.value);
    applyTheme(e.target.value);
  });
  
  document.getElementById('defaultDatabase').addEventListener('change', (e) => {
    saveSetting('lastDatabase', e.target.value);
  });
  
  // Citation format
  document.querySelectorAll('input[name="citationFormat"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      saveSetting('citationFormat', e.target.value);
    });
  });
  
  // Default tags
  document.getElementById('defaultTagsInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addDefaultTag(e.target.value);
      e.target.value = '';
    }
  });
  
  // Shortcuts
  document.getElementById('openShortcutsBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
  
  // Data management
  document.getElementById('exportBtn').addEventListener('click', exportData);
  
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  
  document.getElementById('importFile').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importData(e.target.files[0]);
    }
  });
  
  document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
  document.getElementById('resetSettingsBtn').addEventListener('click', resetSettings);
  document.getElementById('clearAllBtn').addEventListener('click', clearAllData);
}

// ============================================
// UI HELPERS
// ============================================

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastIcon = document.getElementById('toastIcon');
  const toastMessage = document.getElementById('toastMessage');
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️'
  };
  
  toast.className = 'toast ' + type;
  toastIcon.textContent = icons[type] || icons.success;
  toastMessage.textContent = message;
  
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
  } else if (theme === 'light') {
    document.body.classList.remove('dark-theme');
  } else {
    // System preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
