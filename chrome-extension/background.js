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
        this.fetchImageViaProxy(request.url, sendResponse);
        return true; // Keep message channel open for async response
      }
      
      if (request.action === 'preDownloadImages') {
        this.preDownloadImagesViaProxy(request.imageUrls, sendResponse);
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

  // Pre-download images and store them in extension storage
  async preDownloadImages(imageUrls) {
    try {
      console.log('Starting pre-download of', imageUrls.length, 'images');
      const results = [];
      
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        // Use same key generation as content script
        const storageKey = `img_${this.hashString(imageUrl)}`;
        
        try {
          console.log(`Pre-downloading image ${i + 1}:`, imageUrl, 'Key:', storageKey);
          
          const response = await fetch(imageUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'image/*',
              'Cache-Control': 'no-cache',
              'Referer': 'https://www.facebook.com/'
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const blob = await response.blob();
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          
          // Store in chrome storage
          await chrome.storage.local.set({
            [storageKey]: base64
          });
          
          console.log(`Successfully pre-downloaded and stored image ${i + 1}`);
          results.push({ index: i, success: true, storageKey });
          
        } catch (error) {
          console.error(`Failed to pre-download image ${i + 1}:`, error);
          results.push({ index: i, success: false, error: error.message });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      console.log(`Pre-download completed: ${successCount}/${imageUrls.length} images successful`);
      
      return {
        success: true,
        results,
        successCount,
        totalCount: imageUrls.length
      };
      
    } catch (error) {
      console.error('Pre-download process failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Fetch single image via Supabase proxy
  async fetchImageViaProxy(url, sendResponse) {
    try {
      console.log('Fetching image via Supabase proxy:', url);
      const endpoint = 'https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/image-proxy';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
      };
      const body = JSON.stringify({ imageUrls: [url] });
      const response = await fetch(endpoint, { method: 'POST', headers, body });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Proxy request failed: ${response.status}${text ? ` - ${text}` : ''}`);
      }

      const data = await response.json();
      if (data.results && data.results[0] && data.results[0].success) {
        const result = data.results[0];
        console.log('Successfully fetched image via proxy, size:', result.size);
        sendResponse({ success: true, data: result.base64 });
      } else {
        const error = data.results?.[0]?.error || data.error || 'Unknown proxy error';
        console.error('Proxy returned error:', error);
        sendResponse({ success: false, error });
      }
    } catch (error) {
      console.error('Error fetching image via proxy:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Pre-download multiple images via Supabase proxy
  async preDownloadImagesViaProxy(imageUrls, sendResponse) {
    try {
      console.log('Pre-downloading images via Supabase proxy...');

      const images = Array.isArray(imageUrls) ? imageUrls : [];
      if (images.length === 0) {
        console.warn('No image URLs provided to proxy.');
        sendResponse({ success: true, results: [], successCount: 0, totalCount: 0 });
        return;
      }
      
      const endpoint = 'https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/image-proxy';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageUrls: images })
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Proxy request failed: ${response.status}${text ? ` - ${text}` : ''}`);
      }

      const data = await response.json();
      
      // Store successful downloads in chrome storage
      for (const result of data.results || []) {
        if (result.success) {
          const storageKey = `img_${this.hashString(result.url)}`;
          const base64Data = (result.base64 || '').split(',')[1] || result.base64 || '';
          if (base64Data) {
            await chrome.storage.local.set({ [storageKey]: base64Data });
            console.log(`Stored image with key: ${storageKey}`);
          }
        }
      }
      
      console.log(`Pre-download complete: ${data.summary?.successful || 0}/${data.summary?.total || images.length} successful`);
      sendResponse({ 
        success: true, 
        results: data.results || [],
        successCount: data.summary?.successful || 0,
        totalCount: data.summary?.total || images.length
      });
    } catch (error) {
      console.error('Error pre-downloading images:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Simple hash function for consistent storage keys (same as content script)
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

// Initialize background script
try {
  new SalesonatorBackground();
} catch (error) {
  console.error('Failed to initialize background script:', error);
}