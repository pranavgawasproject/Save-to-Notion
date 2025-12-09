// ============================================
// NOTION API WRAPPER
// ============================================

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export const NotionAPI = {
  
  /**
   * Make a request to Notion API
   */
  async request(endpoint, method = 'GET', body = null, token = null) {
    try {
      // Get token from storage if not provided
      if (!token) {
        const { notionToken } = await chrome.storage.sync.get('notionToken');
        token = notionToken;
      }
      
      if (!token) {
        return { error: 'No Notion token found' };
      }
      
      const options = {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json'
        }
      };
      
      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(`${NOTION_API_BASE}${endpoint}`, options);
      const data = await response.json();
      
      if (!response.ok) {
        return {
          error: data.message || `API error: ${response.status}`,
          code: data.code
        };
      }
      
      return { success: true, ...data };
      
    } catch (error) {
      return { error: error.message };
    }
  },
  
  /**
   * Get current user info
   */
  async getUser(token) {
    return await this.request('/users/me', 'GET', null, token);
  },
  
  /**
   * Search for databases
   */
  async searchDatabases(token) {
    return await this.request('/search', 'POST', {
      filter: {
        property: 'object',
        value: 'database'
      },
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      }
    }, token);
  },
  
  /**
   * Get database schema
   */
  async getDatabase(token, databaseId) {
    return await this.request(`/databases/${databaseId}`, 'GET', null, token);
  },
  
  /**
   * Create a page in a database
   */
  async createPage(token, databaseId, properties, children = []) {
    return await this.request('/pages', 'POST', {
      parent: {
        database_id: databaseId
      },
      properties: properties,
      children: children
    }, token);
  },
  
  /**
   * Update a page
   */
  async updatePage(token, pageId, properties) {
    return await this.request(`/pages/${pageId}`, 'PATCH', {
      properties: properties
    }, token);
  },
  
  /**
   * Append blocks to a page
   */
  async appendBlocks(token, pageId, children) {
    return await this.request(`/blocks/${pageId}/children`, 'PATCH', {
      children: children
    }, token);
  },
  
  /**
   * Upload file to Notion (via external URL)
   * Note: Notion doesn't support direct file upload via API
   * You need to host the file externally first
   */
  async addImageBlock(token, pageId, imageUrl, caption = '') {
    const block = {
      object: 'block',
      type: 'image',
      image: {
        type: 'external',
        external: {
          url: imageUrl
        },
        caption: caption ? [
          {
            type: 'text',
            text: { content: caption }
          }
        ] : []
      }
    };
    
    return await this.appendBlocks(token, pageId, [block]);
  },
  
  /**
   * Create a bookmark block
   */
  async addBookmarkBlock(token, pageId, url, caption = '') {
    const block = {
      object: 'block',
      type: 'bookmark',
      bookmark: {
        url: url,
        caption: caption ? [
          {
            type: 'text',
            text: { content: caption }
          }
        ] : []
      }
    };
    
    return await this.appendBlocks(token, pageId, [block]);
  },
  
  /**
   * Verify token is valid
   */
  async verifyToken(token) {
    const result = await this.getUser(token);
    return !result.error;
  }
};

// For non-module usage
if (typeof window !== 'undefined') {
  window.NotionAPI = NotionAPI;
}
