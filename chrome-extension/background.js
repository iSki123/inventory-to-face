// Background script for Salesonator Chrome Extension

class SalesonatorBackground {
  constructor() {
    this.init();
  }

  init() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
    
    // Handle messages from content scripts and popup
    chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
    
    // Handle tab updates
    chrome.tabs.onUpdated.addListener(this.onTabUpdated.bind(this));
  }

  onInstalled(details) {
    if (details.reason === 'install') {
      console.log('Salesonator extension installed');
      
      // Set default settings
      chrome.storage.sync.set({
        delay: 30,
        apiUrl: 'https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/facebook-poster'
      });
      
      // Show console message instead of notification since we don't have icons
      console.log('Salesonator Extension Installed - Click the extension icon to get started!');
    }
  }

  onMessage(request, sender, sendResponse) {
    if (request.action === 'authenticateUser') {
      // Handle user authentication with Salesonator
      this.authenticateUser(request.credentials)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Will respond asynchronously
    }
    
    if (request.action === 'logActivity') {
      // Log activity for debugging
      console.log('Salesonator Activity:', request.data);
    }
  }

  onTabUpdated(tabId, changeInfo, tab) {
    // Check if we're on Facebook Marketplace
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('facebook.com/marketplace')) {
      // Update extension badge
      chrome.action.setBadgeText({ text: '✓', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    } else if (changeInfo.status === 'complete') {
      // Clear badge for other pages
      chrome.action.setBadgeText({ text: '', tabId });
    }
  }

  async authenticateUser(credentials) {
    try {
      const response = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/auth/v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          grant_type: 'password'
        })
      });

      const data = await response.json();
      
      if (data.access_token) {
        // Store the token
        await chrome.storage.sync.set({
          userToken: data.access_token,
          userEmail: credentials.email
        });
        
        return { success: true, token: data.access_token };
      } else {
        throw new Error(data.error_description || 'Authentication failed');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  // Utility method to get stored user token
  async getUserToken() {
    const result = await chrome.storage.sync.get(['userToken']);
    return result.userToken;
  }

  // Utility method to check if user is authenticated
  async isAuthenticated() {
    const token = await this.getUserToken();
    return !!token;
  }
}

// Initialize background script
new SalesonatorBackground();