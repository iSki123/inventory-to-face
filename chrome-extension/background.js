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
    
    // Initialize posting state detection
    this.initializePostingStateDetection();
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
        const urls = request.imageUrls || request.images;
        this.preDownloadImagesViaProxy(urls, sendResponse);
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


  // Fetch single image via Supabase proxy with timeout and fallback
  async fetchImageViaProxy(url, sendResponse) {
    try {
      console.log('🔄 Background: Starting image fetch via Supabase proxy:', url);
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Image fetch timeout after 30 seconds')), 30000);
      });
      
      // Fallback to direct fetch if proxy fails (bypasses CORS in background context)
      const directFetchPromise = this.fetchImageDirect(url);
      
      // Try proxy first, then direct fetch if it fails
      const fetchPromise = this.fetchViaProxy(url).catch(async (proxyError) => {
        console.warn('⚠️ Background: Proxy failed, trying direct fetch:', proxyError.message);
        return await directFetchPromise;
      });
      
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      sendResponse(result);
      
    } catch (error) {
      console.error('💥 Background: Error fetching image:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  async fetchViaProxy(url) {
    const endpoint = 'https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/image-proxy';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
    };
    
    const response = await fetch(endpoint, { 
      method: 'POST', 
      headers, 
      body: JSON.stringify({ imageUrls: [url] })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Proxy request failed: ${response.status}${text ? ` - ${text}` : ''}`);
    }

    const data = await response.json();
    
    if (data.results && data.results[0] && data.results[0].success) {
      const result = data.results[0];
      console.log('✅ Background: Successfully fetched image via proxy, size:', result.size);
      return { success: true, data: result.base64 };
    } else {
      const error = data.results?.[0]?.error || data.error || 'Unknown proxy error';
      throw new Error(`Proxy error: ${error}`);
    }
  }
  
  async fetchImageDirect(url) {
    console.log('🔄 Background: Attempting direct fetch (CORS bypass):', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Direct fetch failed: ${response.status}`);
    }
    
    const blob = await response.blob();
    const base64 = await this.blobToBase64(blob);
    
    console.log('✅ Background: Successfully fetched image directly, size:', blob.size);
    return { success: true, data: base64 };
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

  // Pre-download multiple images via Supabase proxy in chunks
  async preDownloadImagesViaProxy(imageUrls, sendResponse) {
    try {
      console.log('🔄 Background: Pre-downloading images via Supabase proxy...');

      const images = Array.isArray(imageUrls) ? imageUrls : [];
      if (images.length === 0) {
        console.warn('⚠️ Background: No image URLs provided to proxy.');
        sendResponse({ success: true, results: [], successCount: 0, totalCount: 0 });
        return;
      }
      
      const CHUNK_SIZE = 20; // Process 20 images at a time
      const totalImages = images.length;
      let totalStoredCount = 0;
      let totalSuccessCount = 0;
      let allResults = [];
      
      console.log(`📊 Background: Starting chunked download of ${totalImages} images (${CHUNK_SIZE} per chunk)`);
      
      // Process images in chunks
      for (let i = 0; i < images.length; i += CHUNK_SIZE) {
        const chunk = images.slice(i, i + CHUNK_SIZE);
        const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;
        const totalChunks = Math.ceil(images.length / CHUNK_SIZE);
        
        console.log(`📦 Background: Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} images)`);
        
        try {
          const chunkResult = await this.downloadImageChunk(chunk, chunkNumber, totalChunks);
          
          allResults.push(...(chunkResult.results || []));
          totalSuccessCount += chunkResult.successCount || 0;
          totalStoredCount += chunkResult.storedCount || 0;
          
          // Send progress update to popup
          chrome.runtime.sendMessage({
            type: 'imageDownloadProgress',
            data: {
              completed: i + chunk.length,
              total: totalImages,
              stored: totalStoredCount,
              successful: totalSuccessCount,
              chunk: chunkNumber,
              totalChunks: totalChunks
            }
          }).catch(() => {}); // Ignore if popup is closed
          
          // Small delay between chunks to prevent overwhelming the server
          if (i + CHUNK_SIZE < images.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (chunkError) {
          console.error(`💥 Background: Error processing chunk ${chunkNumber}:`, chunkError);
          // Continue with next chunk even if one fails
        }
      }
      
      console.log(`✅ Background: All chunks complete: ${totalSuccessCount}/${totalImages} downloaded, ${totalStoredCount} stored`);
      
      sendResponse({ 
        success: true, 
        results: allResults,
        successCount: totalSuccessCount,
        totalCount: totalImages,
        storedCount: totalStoredCount
      });
    } catch (error) {
      console.error('💥 Background: Error pre-downloading images:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Download a single chunk of images
  async downloadImageChunk(images, chunkNumber, totalChunks) {
    const endpoint = 'https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/image-proxy';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
    };

    // Timeout for each chunk (30 seconds should be enough for 20 images)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Chunk ${chunkNumber} timeout after 30 seconds`)), 30000);
    });

    const fetchPromise = fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ imageUrls: images })
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Proxy request failed for chunk ${chunkNumber}: ${response.status}${text ? ` - ${text}` : ''}`);
    }

    const data = await response.json();
    console.log(`📦 Background: Received proxy response for chunk ${chunkNumber}: ${data.results?.length || 0} images`);
    
    // Store successful downloads in chrome storage
    let storedCount = 0;
    for (const result of data.results || []) {
      if (result.success) {
        try {
          const storageKey = `img_${this.hashString(result.url)}`;
          const base64Data = result.base64 || '';
          if (base64Data) {
            await chrome.storage.local.set({ [storageKey]: base64Data });
            storedCount++;
          }
        } catch (storageError) {
          console.warn(`⚠️ Background: Failed to store image ${result.url}:`, storageError);
        }
      } else {
        console.warn(`❌ Background: Failed to download image ${result.url}: ${result.error}`);
      }
    }
    
    const successCount = data.summary?.successful || 0;
    console.log(`✅ Background: Chunk ${chunkNumber} complete: ${successCount}/${images.length} downloaded, ${storedCount} stored`);
    
    return {
      results: data.results || [],
      successCount: successCount,
      storedCount: storedCount
    };
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

// Initialize background script
try {
  new SalesonatorBackground();
} catch (error) {
  console.error('Failed to initialize background script:', error);
}