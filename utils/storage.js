// ============================================
// NOTION RESEARCH CLIPPER - STORAGE UTILITIES
// ============================================

export const Storage = {
  
  // ============================================
  // SYNC STORAGE (Settings - synced across devices)
  // ============================================
  
  async getSync(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  },
  
  async setSync(items) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  // ============================================
  // LOCAL STORAGE (Data - device specific)
  // ============================================
  
  async getLocal(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  },
  
  async setLocal(items) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  async removeLocal(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  // ============================================
  // NOTION CREDENTIALS
  // ============================================
  
  async getNotionCredentials() {
    const { notionToken, notionWorkspace, notionUserId } = 
      await this.getSync(['notionToken', 'notionWorkspace', 'notionUserId']);
    
    return {
      token: notionToken || null,
      workspace: notionWorkspace || null,
      userId: notionUserId || null,
      isConnected: !!notionToken
    };
  },
  
  async setNotionCredentials(token, workspace, userId) {
    await this.setSync({
      notionToken: token,
      notionWorkspace: workspace,
      notionUserId: userId
    });
  },
  
  async clearNotionCredentials() {
    await chrome.storage.sync.remove([
      'notionToken', 
      'notionWorkspace', 
      'notionUserId'
    ]);
  },
  
  // ============================================
  // SETTINGS
  // ============================================
  
  async getSettings() {
    const defaults = {
      citationFormat: 'apa',
      autoSave: false,
      showQuickClip: true,
      notificationSound: true,
      lastDatabase: null,
      defaultTags: [],
      theme: 'light'
    };
    
    const settings = await this.getSync(defaults);
    return { ...defaults, ...settings };
  },
  
  async updateSettings(newSettings) {
    const current = await this.getSettings();
    const updated = { ...current, ...newSettings };
    await this.setSync(updated);
    return updated;
  },
  
  async resetSettings() {
    const defaults = {
      citationFormat: 'apa',
      autoSave: false,
      showQuickClip: true,
      notificationSound: true,
      lastDatabase: null,
      defaultTags: [],
      theme: 'light'
    };
    
    await this.setSync(defaults);
    return defaults;
  },
  
  // ============================================
  // RECENT CLIPS
  // ============================================
  
  async getRecentClips(limit = 20) {
    const { recentClips = [] } = await this.getLocal('recentClips');
    return recentClips.slice(0, limit);
  },
  
  async addRecentClip(clip) {
    const { recentClips = [] } = await this.getLocal('recentClips');
    
    // Add new clip at the beginning
    recentClips.unshift({
      ...clip,
      id: this.generateId(),
      savedAt: new Date().toISOString()
    });
    
    // Keep only last 50 clips
    const trimmed = recentClips.slice(0, 50);
    await this.setLocal({ recentClips: trimmed });
    
    return trimmed;
  },
  
  async clearRecentClips() {
    await this.setLocal({ recentClips: [] });
  },
  
  // ============================================
  // CLIP STATISTICS
  // ============================================
  
  async getStats() {
    const { clipStats = {} } = await this.getLocal('clipStats');
    
    return {
      totalClips: clipStats.totalClips || 0,
      weeklyCount: clipStats.weeklyCount || 0,
      monthlyCount: clipStats.monthlyCount || 0,
      lastReset: clipStats.lastReset || null,
      byType: clipStats.byType || {},
      byDatabase: clipStats.byDatabase || {}
    };
  },
  
  async incrementClipCount(type = 'unknown', databaseId = null) {
    const stats = await this.getStats();
    const now = new Date();
    
    // Check if we need to reset weekly count
    if (stats.lastReset) {
      const lastReset = new Date(stats.lastReset);
      const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);
      
      if (daysSinceReset >= 7) {
        stats.weeklyCount = 0;
        stats.lastReset = now.toISOString();
      }
    } else {
      stats.lastReset = now.toISOString();
    }
    
    // Increment counts
    stats.totalClips++;
    stats.weeklyCount++;
    stats.monthlyCount++;
    
    // Track by type
    stats.byType[type] = (stats.byType[type] || 0) + 1;
    
    // Track by database
    if (databaseId) {
      stats.byDatabase[databaseId] = (stats.byDatabase[databaseId] || 0) + 1;
    }
    
    await this.setLocal({ clipStats: stats });
    return stats;
  },
  
  async resetStats() {
    const stats = {
      totalClips: 0,
      weeklyCount: 0,
      monthlyCount: 0,
      lastReset: new Date().toISOString(),
      byType: {},
      byDatabase: {}
    };
    
    await this.setLocal({ clipStats: stats });
    return stats;
  },
  
  // ============================================
  // CACHED DATABASES
  // ============================================
  
  async getCachedDatabases() {
    const { cachedDatabases = null, databasesCachedAt = null } = 
      await this.getLocal(['cachedDatabases', 'databasesCachedAt']);
    
    // Check if cache is still valid (1 hour)
    if (databasesCachedAt) {
      const cacheAge = Date.now() - new Date(databasesCachedAt).getTime();
      if (cacheAge > 60 * 60 * 1000) {
        return null; // Cache expired
      }
    }
    
    return cachedDatabases;
  },
  
  async setCachedDatabases(databases) {
    await this.setLocal({
      cachedDatabases: databases,
      databasesCachedAt: new Date().toISOString()
    });
  },
  
  async clearDatabaseCache() {
    await this.removeLocal(['cachedDatabases', 'databasesCachedAt']);
  },
  
  // ============================================
  // SAVED TAGS
  // ============================================
  
  async getSavedTags() {
    const { savedTags = [] } = await this.getLocal('savedTags');
    return savedTags;
  },
  
  async addSavedTag(tag) {
    const tags = await this.getSavedTags();
    
    if (!tags.includes(tag)) {
      tags.push(tag);
      // Keep only last 100 tags
      const trimmed = tags.slice(-100);
      await this.setLocal({ savedTags: trimmed });
    }
    
    return tags;
  },
  
  async removeSavedTag(tag) {
    const tags = await this.getSavedTags();
    const filtered = tags.filter(t => t !== tag);
    await this.setLocal({ savedTags: filtered });
    return filtered;
  },
  
  // ============================================
  // EXPORT/IMPORT
  // ============================================
  
  async exportAllData() {
    const [syncData, localData] = await Promise.all([
      this.getSync(null),
      this.getLocal(null)
    ]);
    
    // Remove sensitive data
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings: {
        citationFormat: syncData.citationFormat,
        autoSave: syncData.autoSave,
        showQuickClip: syncData.showQuickClip,
        notificationSound: syncData.notificationSound,
        defaultTags: syncData.defaultTags,
        theme: syncData.theme
      },
      recentClips: localData.recentClips || [],
      savedTags: localData.savedTags || [],
      clipStats: localData.clipStats || {}
    };
    
    return exportData;
  },
  
  async importData(data) {
    if (!data.version) {
      throw new Error('Invalid import data');
    }
    
    // Import settings
    if (data.settings) {
      await this.setSync(data.settings);
    }
    
    // Import local data
    if (data.recentClips) {
      await this.setLocal({ recentClips: data.recentClips });
    }
    
    if (data.savedTags) {
      await this.setLocal({ savedTags: data.savedTags });
    }
    
    if (data.clipStats) {
      await this.setLocal({ clipStats: data.clipStats });
    }
    
    return true;
  },
  
  // ============================================
  // UTILITIES
  // ============================================
  
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },
  
  async getStorageUsage() {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        const maxBytes = chrome.storage.local.QUOTA_BYTES || 5242880;
        resolve({
          used: bytesInUse,
          total: maxBytes,
          percentage: ((bytesInUse / maxBytes) * 100).toFixed(2),
          usedFormatted: this.formatBytes(bytesInUse),
          totalFormatted: this.formatBytes(maxBytes)
        });
      });
    });
  },
  
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  
  async clearAllData() {
    await Promise.all([
      chrome.storage.sync.clear(),
      chrome.storage.local.clear()
    ]);
  }
};

// For non-module usage
if (typeof window !== 'undefined') {
  window.ClipperStorage = Storage;
}
