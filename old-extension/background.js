// Background script for Salesonator Chrome Extension

// Store authentication token - persist to chrome.storage
let authToken = null;

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
    
    // Initialize posting state detection
    this.initializePostingStateDetection();
    
    // Load persisted auth token on startup
    this.loadAuthToken();
  }

  async loadAuthToken() {
    try {
      const result = await chrome.storage.local.get(['authToken']);
      authToken = result.authToken || null;
      console.log('📋 Auth token loaded:', authToken ? 'present' : 'not found');
    } catch (error) {
      console.error('Error loading auth token:', error);
    }
  }

  async saveAuthToken(token) {
    try {
      await chrome.storage.local.set({ authToken: token });
      authToken = token;
      console.log('💾 Auth token saved to storage');
    } catch (error) {
      console.error('Error saving auth token:', error);
    }
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
      if (request.action === 'SET_AUTH_TOKEN') {
        this.saveAuthToken(request.token).then(() => {
          sendResponse({ success: true });
        }).catch(error => {
          console.error('Error setting auth token:', error);
          sendResponse({ success: false, error: error.message });
        });
        return true;
      }
      
      if (request.action === 'GET_AUTH_TOKEN') {
        sendResponse({ token: authToken });
        return true;
      }
      
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
        console.log('🔄 Background: Received fetchImage request for:', request.url);
        // Direct image fetch bypassing CORS
        this.fetchImageDirect(request.url, sendResponse);
        return true; // Will respond asynchronously
      }
      
      if (request.action === 'preDownloadImagesViaProxy') {
        // Batch download images directly
        this.preDownloadImagesViaProxy(request.imageUrls, sendResponse);
        return true; // Will respond asynchronously
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

  // Direct image fetch using Chrome extension CORS bypass
  async fetchImageDirect(url, sendResponse) {
    try {
      console.log('🔄 Background: Starting direct image fetch:', url);
      
      // Create timeout promise (15 seconds per image)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Image fetch timeout after 15 seconds')), 15000);
      });
      
      // Fetch promise with enhanced headers to mimic real browser
      const fetchPromise = fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'cross-site'
        }
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
          throw new Error(`Invalid content type: ${contentType}`);
        }
        
        const blob = await response.blob();
        
        // Size check (max 10MB per image)
        if (blob.size > 10 * 1024 * 1024) {
          throw new Error(`Image too large: ${(blob.size / 1024 / 1024).toFixed(1)}MB (max 10MB)`);
        }
        
        const base64 = await this.blobToBase64(blob);
        
        console.log(`✅ Background: Successfully fetched image directly, size: ${(blob.size / 1024).toFixed(1)}KB`);
        return { success: true, data: base64, size: blob.size, contentType };
      });
      
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (sendResponse) {
        sendResponse(result);
      }
      return result;
      
    } catch (error) {
      console.error('❌ Background: Error fetching image directly:', error.message);
      const errorResult = { success: false, error: error.message };
      
      if (sendResponse) {
        sendResponse(errorResult);
      }
      return errorResult;
    }
  }
  
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]; // Remove data:image/... prefix
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Direct batch image download using Chrome extension capabilities
  async preDownloadImagesViaProxy(imageUrls, sendResponse) {
    try {
      console.log('🔄 Background: Pre-downloading images directly (bypassing proxy)...');

      const images = Array.isArray(imageUrls) ? imageUrls : [];
      if (images.length === 0) {
        console.warn('⚠️ Background: No image URLs provided.');
        sendResponse({ success: true, results: [], successCount: 0, totalCount: 0 });
        return;
      }

      console.log(`📸 Background: Starting download of ${images.length} images...`);

      const results = [];
      let successCount = 0;

      // Download images sequentially to avoid overwhelming the server
      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i];
        
        if (!imageUrl) {
          console.warn(`⚠️ Background: Skipping empty URL at index ${i}`);
          results.push({ success: false, url: imageUrl, error: 'Empty URL' });
          continue;
        }

        console.log(`📸 Background: Downloading image ${i + 1}/${images.length}: ${imageUrl}`);

        try {
          const result = await this.fetchImageDirect(imageUrl);
          
          if (result.success) {
            // Store in chrome.storage.local with URL hash as key
            const imageKey = this.hashString(imageUrl);
            await chrome.storage.local.set({
              [imageKey]: {
                base64: result.data,
                url: imageUrl,
                size: result.size,
                contentType: result.contentType,
                downloadedAt: Date.now()
              }
            });
            
            successCount++;
            console.log(`✅ Background: Stored image ${i + 1} in cache (${(result.size / 1024).toFixed(1)}KB)`);
            
            results.push({
              success: true,
              url: imageUrl,
              size: result.size,
              cached: true
            });
          } else {
            console.error(`❌ Background: Failed to download image ${i + 1}: ${result.error}`);
            results.push({
              success: false,
              url: imageUrl,
              error: result.error
            });
          }
        } catch (error) {
          console.error(`❌ Background: Error downloading image ${i + 1}:`, error.message);
          results.push({
            success: false,
            url: imageUrl,
            error: error.message
          });
        }

        // Small delay between downloads to be respectful to servers
        if (i < images.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const response = {
        success: true,
        results: results,
        successfulImages: successCount,
        totalImages: images.length,
        summary: {
          total: images.length,
          successful: successCount,
          failed: images.length - successCount
        }
      };

      console.log(`✅ Background: Batch download complete: ${successCount}/${images.length} successful`);
      sendResponse(response);

    } catch (error) {
      console.error('💥 Background: Error in preDownloadImagesViaProxy:', error);
      sendResponse({ 
        success: false, 
        error: error.message,
        results: [],
        successfulImages: 0,
        totalImages: imageUrls?.length || 0
      });
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

  // Initialize posting state detection on extension load
  async initializePostingStateDetection() {
    try {
      console.log('🔍 Initializing posting state detection...');
      
      // Check for existing posting state in storage
      const postingState = await chrome.storage.local.get([
        'isPosting', 
        'currentVehicleIndex', 
        'vehicleQueue', 
        'lastPostedVehicle',
        'postingStartTime',
        'totalVehiclesToPost'
      ]);
      
      console.log('📊 Current posting state:', postingState);
      
      // Detect if posting was in progress
      if (postingState.isPosting) {
        const currentIndex = postingState.currentVehicleIndex || 0;
        const totalVehicles = postingState.totalVehiclesToPost || 0;
        const startTime = postingState.postingStartTime;
        
        console.log(`🚀 Detected active posting session: ${currentIndex}/${totalVehicles}`);
        
        if (startTime) {
          const elapsedMinutes = (Date.now() - startTime) / (1000 * 60);
          console.log(`⏱️ Session has been running for ${elapsedMinutes.toFixed(1)} minutes`);
        }
        
        // Check if posting session completed
        if (currentIndex >= totalVehicles && totalVehicles > 0) {
          console.log('✅ Posting session appears to be completed');
          await this.handlePostingCompletion(postingState);
        } else {
          console.log('⏸️ Posting session appears to be in progress or paused');
          await this.handleInProgressPosting(postingState);
        }
      } else {
        console.log('💤 No active posting session detected');
      }
      
      // Set up periodic state monitoring
      this.setupPostingStateMonitoring();
      
    } catch (error) {
      console.error('❌ Error initializing posting state detection:', error);
    }
  }
  
  // Handle completed posting session
  async handlePostingCompletion(postingState) {
    console.log('🎉 Processing completed posting session...');
    
    const completionData = {
      completedAt: Date.now(),
      totalPosted: postingState.currentVehicleIndex || 0,
      totalPlanned: postingState.totalVehiclesToPost || 0,
      lastVehicle: postingState.lastPostedVehicle,
      duration: postingState.postingStartTime ? 
        (Date.now() - postingState.postingStartTime) / (1000 * 60) : 0
    };
    
    // Store completion record
    await chrome.storage.local.set({
      lastCompletedSession: completionData,
      isPosting: false
    });
    
    console.log('📈 Posting session completion recorded:', completionData);
    
    // Update extension badge to show completion
    this.updateBadgeForCompletion(completionData);
  }
  
  // Handle in-progress posting session
  async handleInProgressPosting(postingState) {
    console.log('⚠️ Processing in-progress posting session...');
    
    const progressData = {
      current: postingState.currentVehicleIndex || 0,
      total: postingState.totalVehiclesToPost || 0,
      lastVehicle: postingState.lastPostedVehicle,
      elapsedTime: postingState.postingStartTime ? 
        (Date.now() - postingState.postingStartTime) / (1000 * 60) : 0
    };
    
    console.log('📊 Progress data:', progressData);
    
    // Update extension badge to show progress
    this.updateBadgeForProgress(progressData);
  }
  
  // Set up periodic monitoring of posting state
  setupPostingStateMonitoring() {
    // Check posting state every 30 seconds
    setInterval(async () => {
      const postingState = await chrome.storage.local.get(['isPosting', 'currentVehicleIndex', 'totalVehiclesToPost']);
      
      if (postingState.isPosting) {
        const current = postingState.currentVehicleIndex || 0;
        const total = postingState.totalVehiclesToPost || 0;
        
        // Check for completion
        if (current >= total && total > 0) {
          await this.handlePostingCompletion(postingState);
        }
      }
    }, 30000); // 30 seconds
  }
  
  // Update extension badge for completed session
  updateBadgeForCompletion(completionData) {
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    chrome.action.setTitle({ 
      title: `Salesonator - Last session: ${completionData.totalPosted} vehicles posted in ${completionData.duration.toFixed(1)} minutes`
    });
  }
  
  // Update extension badge for progress
  updateBadgeForProgress(progressData) {
    const percentage = progressData.total > 0 ? 
      Math.round((progressData.current / progressData.total) * 100) : 0;
    
    chrome.action.setBadgeText({ text: `${percentage}%` });
    chrome.action.setBadgeBackgroundColor({ color: '#2196F3' });
    chrome.action.setTitle({ 
      title: `Salesonator - Posting in progress: ${progressData.current}/${progressData.total} (${percentage}%)`
    });
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