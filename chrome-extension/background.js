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
      
      // Just log a message instead of showing notification
      console.log('Salesonator Extension Installed - Click the extension icon to get started!');
    }
  }

  onMessage(request, sender, sendResponse) {
    try {
      if (request.action === 'authenticateUser') {
        // Handle user authentication with Salesonator
        this.authenticateUser(request.credentials)
          .then(sendResponse)
          .catch(error => {
            console.error('Auth error:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Will respond asynchronously
      }
      
      if (request.action === 'fetchImage') {
        // Handle CORS-protected image fetching
        console.log('Fetching image with CORS bypass:', request.url);
        
        fetch(request.url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            sendResponse({
              success: true,
              data: reader.result
            });
          };
          reader.onerror = () => {
            sendResponse({
              success: false,
              error: 'Failed to convert blob to base64'
            });
          };
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          console.error('Image fetch failed:', error);
          sendResponse({
            success: false,
            error: error.message
          });
        });
        
        return true; // Keep message channel open for async response
      }
      
      if (request.action === 'logActivity') {
        // Log activity for debugging
        console.log('Salesonator Activity:', request.data);
        sendResponse({ success: true });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  onTabUpdated(tabId, changeInfo, tab) {
    try {
      // Check if we're on Facebook Marketplace
      if (changeInfo.status === 'complete' && tab.url && tab.url.includes('facebook.com/marketplace')) {
        // Update extension badge
        chrome.action.setBadgeText({ text: '✓', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      } else if (changeInfo.status === 'complete') {
        // Clear badge for other pages
        chrome.action.setBadgeText({ text: '', tabId });
      }
    } catch (error) {
      console.error('Tab update error:', error);
    }
  }

  async authenticateUser(credentials) {
    try {
      const response = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password
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
    try {
      const result = await chrome.storage.sync.get(['userToken']);
      return result.userToken;
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  // Utility method to check if user is authenticated
  async isAuthenticated() {
    try {
      const token = await this.getUserToken();
      return !!token;
    } catch (error) {
      console.error('Error checking auth:', error);
      return false;
    }
  }
}

// Initialize background script
try {
  new SalesonatorBackground();
} catch (error) {
  console.error('Failed to initialize background script:', error);
}