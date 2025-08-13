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
        this.preDownloadImagesViaProxy(request.images, sendResponse);
        return true; // Keep message channel open for async response
      }
      
      if (request.action === 'logActivity') {
        // Log activity for debugging
        console.log('Salesonator Activity:', request.data);
        sendResponse({ success: true });
        return; // done
      }

      if (request.action === 'scrapedInventory') {
        this.handleScrapedInventory(request.vehicles, request.source)
          .then(sendResponse)
          .catch(error => {
            console.error('Scraped inventory error:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // async
      }

      if (request.action === 'webAppAuthenticated') {
        // Handle automatic authentication from web app
        this.handleWebAppAuthentication(request.credentials)
          .then(sendResponse)
          .catch(error => {
            console.error('Web app auth error:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // async
      }
      
      if (request.action === 'getStorageData') {
        // Handle storage data requests from content script
        chrome.storage.sync.get([request.key])
          .then(result => {
            sendResponse({ value: result[request.key] });
          })
          .catch(error => {
            console.error('Storage access error:', error);
            sendResponse({ value: null, error: error.message });
          });
        return true; // async
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
        // Check subscription and credits
        const eligibilityCheck = await this.checkUserEligibility(data.access_token);
        
        if (!eligibilityCheck.eligible) {
          throw new Error(eligibilityCheck.reason || 'User not eligible for extension access');
        }

        // Store the token and user info
        await chrome.storage.sync.set({
          userToken: data.access_token,
          userEmail: credentials.email,
          userCredits: eligibilityCheck.credits,
          userSubscribed: eligibilityCheck.subscribed
        });
        
        return { 
          success: true, 
          token: data.access_token,
          credits: eligibilityCheck.credits,
          subscribed: eligibilityCheck.subscribed
        };
      } else {
        throw new Error(data.error_description || 'Authentication failed');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  // Check if user is eligible to use the extension
  async checkUserEligibility(token) {
    try {
      // First check subscription status
      const subscriptionResponse = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/check-subscription', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
        }
      });

      const subscriptionData = await subscriptionResponse.json();
      
      // Then check user profile for credits
      const profileResponse = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/rest/v1/profiles?select=credits,is_active', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
        }
      });

      const profileData = await profileResponse.json();
      const profile = profileData[0];

      if (!profile || !profile.is_active) {
        return {
          eligible: false,
          reason: 'Account is not active or profile not found'
        };
      }

      const hasCredits = profile.credits > 0;
      const hasSubscription = subscriptionData.subscribed;

      if (!hasCredits && !hasSubscription) {
        return {
          eligible: false,
          reason: 'You need either credits or an active subscription to use the extension'
        };
      }

      return {
        eligible: true,
        credits: profile.credits,
        subscribed: hasSubscription
      };

    } catch (error) {
      console.error('Eligibility check error:', error);
      return {
        eligible: false,
        reason: 'Failed to verify account eligibility'
      };
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
          // Store the full base64 data URL (not just the base64 part)
          const base64Data = result.base64 || '';
          if (base64Data) {
            await chrome.storage.local.set({ [storageKey]: base64Data });
            console.log(`Stored image with key: ${storageKey}, size: ${result.size || 'unknown'} bytes`);
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

  // Handle web app authentication
  async handleWebAppAuthentication(credentials) {
    try {
      // Verify the token is still valid by checking user eligibility
      const eligibilityCheck = await this.checkUserEligibility(credentials.token);
      
      if (eligibilityCheck.eligible) {
        // Store the authentication info
        await chrome.storage.sync.set({
          userToken: credentials.token,
          userEmail: credentials.email,
          userCredits: credentials.credits,
          userSubscribed: eligibilityCheck.subscribed,
          webAppAuthenticated: true
        });
        
        console.log('Successfully authenticated via web app for user:', credentials.email);
        return { 
          success: true, 
          message: 'Auto-authenticated via Salesonator web app',
          credits: credentials.credits,
          subscribed: eligibilityCheck.subscribed
        };
      } else {
        throw new Error(eligibilityCheck.reason || 'User not eligible for extension access');
      }
    } catch (error) {
      console.error('Web app authentication failed:', error);
      throw error;
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