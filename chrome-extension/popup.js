// Store auth token when popup loads
async function storeAuthToken() {
  try {
    // Try to get token from localStorage (set by web app)
    const token = localStorage.getItem('sb-urdkaedsfnscgtyvcwlf-auth-token');
    if (token) {
      const authData = JSON.parse(token);
      if (authData?.access_token) {
        chrome.runtime.sendMessage({
          action: 'SET_AUTH_TOKEN',
          token: authData.access_token
        });
        console.log('Auth token sent to background script');
      }
    }
  } catch (error) {
    console.log('No auth token found or error:', error);
  }
}

class SalesonatorExtension {
  constructor() {
    this.isPosting = false;
    this.vehicles = [];
    this.currentVehicleIndex = 0;
    this.credits = 0;
    this.init();
    this.setupMessageListener();
    this.setupCreditUpdateListener();
  }

  async init() {
    console.log('Initializing Salesonator Extension...');
    
    // Store auth token when popup opens
    await storeAuthToken();
    
    try {
      // Load saved settings
      const settings = await chrome.storage.sync.get(['apiUrl', 'delay', 'userToken']);
      
      if (settings.apiUrl) {
        document.getElementById('apiUrl').value = settings.apiUrl;
      }
      if (settings.delay) {
        document.getElementById('delay').value = settings.delay;
      }

      // Set up event listeners
      document.getElementById('startPosting').addEventListener('click', () => this.startPosting());
      document.getElementById('stopPosting').addEventListener('click', () => this.stopPosting());
      document.getElementById('delay').addEventListener('change', () => this.saveSettings());
      document.getElementById('login').addEventListener('click', () => this.showLoginForm());
      document.getElementById('openDashboard').addEventListener('click', () => this.openDashboard());
      document.getElementById('debugCreditDeduction').addEventListener('click', () => this.debugCreditDeduction());
      document.getElementById('debugTestComm').addEventListener('click', () => this.testContentScriptCommunication());

      // Show initial status - but only if element exists
      const statusEl = document.getElementById('status');
      if (statusEl) {
        statusEl.textContent = 'Checking authentication...';
      }

      // Check for existing web app authentication first
      console.log('🔍 Starting web app authentication check...');
      const webAppAuth = await this.checkWebAppAuthentication();
      if (webAppAuth) {
        console.log('✅ Found web app authentication, using it for extension');
        console.log('🔐 Storing token in extension storage...');
        await chrome.storage.sync.set({ userToken: webAppAuth.token });
        console.log('✅ Token stored successfully');
        
        // Also store in background script for console logging
        chrome.runtime.sendMessage({
          action: 'SET_AUTH_TOKEN',
          token: webAppAuth.token
        });
        
        // Show success immediately and skip further checks
        this.showWebAppAuthSuccess();
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('mainSection').style.display = 'block';
        
        // Check for existing posting state after authentication
        await this.checkPostingState();
        
        // Automatically fetch vehicles when authenticated
        setTimeout(async () => {
          await this.fetchVehicles();
        }, 100);
        
        return; // Exit early, don't run checkAuthentication
      } else {
        console.log('❌ No web app authentication found');
      }
      
      // Check authentication status (only if web app auth wasn't found)
      console.log('🔍 Checking stored authentication...');
      await this.checkAuthentication();
      
      // Check connection status
      this.checkConnection();
      
      // Check for existing posting state
      await this.checkPostingState();
    } catch (error) {
      console.error('Error during initialization:', error);
      const statusEl = document.getElementById('status');
      if (statusEl) {
        statusEl.textContent = 'Initialization error: ' + error.message;
      }
    }
  }

  async checkWebAppAuthentication() {
    try {
      console.log('Checking for web app authentication...');
      
      // Show connecting status - but only if element exists
      const statusEl = document.getElementById('status');
      if (statusEl) {
        statusEl.textContent = 'Connecting to Salesonator...';
      }
      
      // Check all open tabs for Salesonator (much broader search)
      const allTabs = await chrome.tabs.query({});
      console.log('Found tabs:', allTabs.length);
      
      for (const tab of allTabs) {
        if (tab.url && 
            (tab.url.includes('lovableproject.com') || 
             tab.url.includes('localhost') ||
             tab.url.includes('salesonator') ||
             tab.url.includes('inventory-to-face') ||
             tab.url.includes('7163d240-f16f-476c-b2aa-a96bf0373743'))) {
          
          console.log('Checking Salesonator tab:', tab.url);
          
          try {
            // Inject and execute a script to check for authentication
            const results = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                console.log('Checking localStorage for auth data...');
                
                // Log all localStorage keys for debugging
                const allKeys = Object.keys(localStorage);
                console.log('All localStorage keys:', allKeys);
                
                // Check for multiple possible auth key patterns (broader search)
                const authKeys = allKeys.filter(key => 
                  key.startsWith('sb-') ||
                  key.includes('supabase') ||
                  key.includes('auth') ||
                  key.includes('token') ||
                  key.includes('session')
                );
                
                console.log('Found potential auth keys:', authKeys);
                
                for (const authKey of authKeys) {
                  const authData = localStorage.getItem(authKey);
                  console.log('Checking key:', authKey, 'Data length:', authData?.length);
                  
                  if (authData) {
                    try {
                      const parsed = JSON.parse(authData);
                      console.log('Parsed auth data keys:', Object.keys(parsed));
                      
                      if (parsed.access_token && parsed.user) {
                        console.log('Found valid auth data with access_token');
                        return {
                          token: parsed.access_token,
                          user: parsed.user,
                          expires_at: parsed.expires_at
                        };
                      }
                    } catch (e) {
                      console.log('Failed to parse auth data for key:', authKey, e);
                    }
                  }
                }
                
                console.log('No valid auth data found');
                return null;
              }
            });
            
            const authData = results[0]?.result;
            console.log('Script execution result:', authData);
            
            if (authData && authData.token) {
              console.log('Found authentication data in tab:', tab.url);
              console.log('User ID:', authData.user.id);
              
              // Check if token is still valid and user has credits
              console.log('Starting eligibility verification for user:', authData.user.id);
              
              try {
                const profileUrl = `https://urdkaedsfnscgtyvcwlf.supabase.co/rest/v1/profiles?select=credits,is_active,role&user_id=eq.${authData.user.id}`;
                console.log('Checking profile at:', profileUrl);
                console.log('Using token:', authData.token.substring(0, 20) + '...');
                
                console.log('Making fetch request...');
                const response = await fetch(profileUrl, {
                  headers: {
                    'Authorization': `Bearer ${authData.token}`,
                    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
                  }
                });
                
                console.log('✅ Fetch completed, response status:', response.status);
                console.log('Response ok:', response.ok);
                
                if (response.ok) {
                  const profileData = await response.json();
                  console.log('✅ Profile data received:', profileData);
                  console.log('Profile data length:', profileData.length);
                  const profile = profileData[0];
                  console.log('Extracted profile:', profile);
                  
                  if (profile && profile.is_active) {
                    console.log('✅ User is eligible with credits:', profile.credits);
                    console.log('Setting up auto-authentication...');
                    this.credits = profile.credits;
                    this.updateCreditDisplay();
                    return { token: authData.token, user: authData.user, credits: profile.credits };
                  } else {
                    console.log('❌ User is not eligible - Active:', profile?.is_active, 'Credits:', profile?.credits);
                    if (statusEl) statusEl.textContent = 'Account not active - please contact support';
                    return null;
                  }
                } else {
                  const errorText = await response.text();
                  console.log('❌ Failed to verify user eligibility, status:', response.status);
                  console.log('❌ Error response:', errorText);
                  if (statusEl) statusEl.textContent = 'Failed to verify user eligibility';
                  return null;
                }
              } catch (error) {
                console.error('❌ Error verifying user eligibility:', error);
                console.error('❌ Error details:', error.message, error.stack);
                if (statusEl) statusEl.textContent = 'Error checking user eligibility: ' + error.message;
                return null;
              }
            }
          } catch (error) {
            console.log('Script injection failed for tab:', tab.url, error);
            continue;
          }
        }
      }
      
      console.log('No web app authentication found');
      if (statusEl) statusEl.textContent = 'No authentication found in web app';
      return null;
    } catch (error) {
      console.warn('Error checking web app authentication:', error);
      const statusEl = document.getElementById('status');
      if (statusEl) statusEl.textContent = 'Error checking web app authentication';
      return null;
    }
  }

  showWebAppAuthSuccess() {
    const statusEl = document.getElementById('status');
    statusEl.className = 'status connected';
    statusEl.innerHTML = 'Auto-authenticated via Salesonator web app!';
    document.getElementById('creditBalance').style.display = 'block';
  }

  showError(message) {
    const statusEl = document.getElementById('status');
    statusEl.className = 'status disconnected';
    statusEl.textContent = message;
  }

  async checkAuthentication() {
    const { userToken } = await chrome.storage.sync.get(['userToken']);
    const loginSection = document.getElementById('loginSection');
    const mainSection = document.getElementById('mainSection');
    
    if (!userToken) {
      loginSection.style.display = 'block';
      mainSection.style.display = 'none';
    } else {
      // Verify token is still valid
      try {
        const response = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/auth/v1/user', {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
          }
        });
        
        if (response.ok) {
          loginSection.style.display = 'none';
          mainSection.style.display = 'block';
          // Automatically fetch vehicles when authenticated
          setTimeout(async () => {
            await this.fetchVehicles();
          }, 100);
        } else {
          // Token is invalid, show login
          await chrome.storage.sync.remove(['userToken']);
          loginSection.style.display = 'block';
          mainSection.style.display = 'none';
        }
      } catch (error) {
        console.error('Error verifying token:', error);
        loginSection.style.display = 'block';
        mainSection.style.display = 'none';
      }
    }
  }

  async openDashboard() {
    try {
      // Try to find existing Salesonator tab first
      const tabs = await chrome.tabs.query({});
      const salesonatorTab = tabs.find(tab => 
        tab.url && (
          tab.url.includes('salesonator.com') ||
          tab.url.includes('lovable.app') ||
          tab.url.includes('lovableproject.com')
        )
      );
      
      let dashboardUrl;
      if (salesonatorTab) {
        // Use the same domain as existing tab
        const url = new URL(salesonatorTab.url);
        dashboardUrl = `${url.protocol}//${url.host}/`;
      } else {
        // Default to the custom domain
        dashboardUrl = 'https://salesonator.com/';
      }
      
      await chrome.tabs.create({ url: dashboardUrl, active: true });
      
      // Show message that we're waiting for auto-login
      const statusEl = document.getElementById('status');
      statusEl.textContent = 'Dashboard opened. Please log in to enable auto-authentication.';
      
      // Start checking for authentication every 2 seconds
      this.startAuthCheckInterval();
    } catch (error) {
      console.error('Error opening dashboard:', error);
    }
  }

  startAuthCheckInterval() {
    // Clear any existing interval
    if (this.authCheckInterval) {
      clearInterval(this.authCheckInterval);
    }
    
    // Check every 2 seconds for authentication
    this.authCheckInterval = setInterval(async () => {
      const webAppAuth = await this.checkWebAppAuthentication();
      if (webAppAuth) {
        clearInterval(this.authCheckInterval);
        console.log('✅ Auto-authentication detected!');
        await chrome.storage.sync.set({ userToken: webAppAuth.token });
        this.credits = webAppAuth.credits || 0;
        this.updateCreditDisplay();
        
        // Also store in background script for console logging
        chrome.runtime.sendMessage({
          action: 'SET_AUTH_TOKEN',
          token: webAppAuth.token
        });
        this.showWebAppAuthSuccess();
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('mainSection').style.display = 'block';
        // Automatically fetch vehicles when authenticated
        setTimeout(async () => {
          await this.fetchVehicles();
        }, 100);
      }
    }, 2000);
    
    // Stop checking after 2 minutes
    setTimeout(() => {
      if (this.authCheckInterval) {
        clearInterval(this.authCheckInterval);
        this.authCheckInterval = null;
      }
    }, 120000);
  }

  showLoginForm() {
    const email = prompt('Enter your Salesonator email:');
    const password = prompt('Enter your Salesonator password:');
    
    if (email && password) {
      this.authenticate(email, password);
    }
  }

  async authenticate(email, password) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = 'Authenticating...';
    
    try {
      const response = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
        },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      const data = await response.json();
      
      if (data.access_token) {
        // Store the token
        await chrome.storage.sync.set({
          userToken: data.access_token,
          userEmail: email
        });
        
        // Also store in background script for console logging
        chrome.runtime.sendMessage({
          action: 'SET_AUTH_TOKEN',
          token: data.access_token
        });
        
        statusEl.textContent = 'Authentication successful!';
        await this.checkAuthentication(); // Refresh the UI
        // Automatically fetch vehicles after manual authentication
        setTimeout(async () => {
          await this.fetchVehicles();
        }, 100);
      } else {
        throw new Error(data.error_description || 'Authentication failed');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      statusEl.textContent = `Authentication failed: ${error.message}`;
    }
  }

  async checkConnection() {
    const statusEl = document.getElementById('status');
    
    try {
      // Check if we're on Facebook
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isFacebook = tab.url.includes('facebook.com');
      
      if (!isFacebook) {
        statusEl.className = 'status disconnected';
        statusEl.textContent = 'Please navigate to Facebook Marketplace';
        return;
      }

      // Check if user is logged in (this will be checked by content script)
      chrome.tabs.sendMessage(tab.id, { action: 'checkLogin' }, (response) => {
        if (chrome.runtime.lastError) {
          statusEl.className = 'status disconnected';
          statusEl.textContent = 'Please navigate to Facebook Marketplace';
        } else if (response && response.loggedIn) {
          statusEl.className = 'status connected';
          statusEl.textContent = 'Connected to Facebook';
        } else {
          statusEl.className = 'status disconnected';
          statusEl.textContent = 'Please log in to Facebook';
        }
      });
      
    } catch (error) {
      statusEl.className = 'status disconnected';
      statusEl.textContent = 'Connection error';
    }
  }

  async fetchVehicles() {
    const statusEl = document.getElementById('status');
    const startBtn = document.getElementById('startPosting');

    try {
      statusEl.textContent = 'Fetching vehicles...';
      
      // Get user token from storage
      const { userToken } = await chrome.storage.sync.get(['userToken']);
      
      if (!userToken) {
        throw new Error('User not authenticated. Please log in to Salesonator first.');
      }

      const response = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/get-pending-vehicles', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const allVehicles = data.vehicles || [];
        
        // Filter out vehicles that are already marked as posted locally
        const { postedVehicles = [] } = await chrome.storage.local.get(['postedVehicles']);
        
        this.vehicles = allVehicles.filter(vehicle => {
          const vehicleKey = `${vehicle.id}_${vehicle.year}_${vehicle.make}_${vehicle.model}`;
          const isPostedLocally = postedVehicles.includes(vehicleKey);
          
          if (isPostedLocally) {
            console.log(`🚫 Filtering out locally posted vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
          }
          
          return !isPostedLocally;
        });
        
        console.log(`📊 Found ${allVehicles.length} vehicles from database, ${this.vehicles.length} after filtering posted ones`);
        
        startBtn.disabled = this.vehicles.length === 0;
        statusEl.className = 'status connected';
        
        if (this.vehicles.length === 0) {
          statusEl.innerHTML = 'Connected to Salesonator<br>No vehicles ready to post';
        } else {
          statusEl.innerHTML = 'Connected to Salesonator<br>' + this.vehicles.length + ' vehicles ready to post';
        }
        
        console.log('🔧 Images will be downloaded per-vehicle before posting');
        
        // Enable start button immediately - no pre-downloading
        startBtn.disabled = this.vehicles.length === 0;
      } else {
        throw new Error(data.error || 'Failed to fetch vehicles');
      }

    } catch (error) {
      console.error('Error fetching vehicles:', error);
      statusEl.className = 'status disconnected';
      statusEl.textContent = `Error: ${error.message}`;
      startBtn.disabled = true;
      
      // If authentication failed, show login
      if (error.message.includes('not authenticated')) {
        await chrome.storage.sync.remove(['userToken']);
        await this.checkAuthentication();
      }
    }
  }

  async startPosting() {
    if (this.vehicles.length === 0) {
      try {
        document.getElementById('status').textContent = 'Fetching vehicles before starting...';
        await this.fetchVehicles();
      } catch (e) {
        console.error('Auto-fetch failed:', e);
      }
    }

    if (this.vehicles.length === 0) {
      alert('No vehicles ready to post. Please fetch vehicles first.');
      return;
    }

    // Limit posting to prevent rate limiting - max 10 vehicles per session
    const maxVehiclesPerSession = 10;
    let vehiclesToPost = this.vehicles;
    
    if (this.vehicles.length > maxVehiclesPerSession) {
      const proceed = confirm(`You have ${this.vehicles.length} vehicles ready to post. To avoid Facebook rate limiting, this session will post the first ${maxVehiclesPerSession} vehicles. Continue?`);
      if (!proceed) return;
      
      vehiclesToPost = this.vehicles.slice(0, maxVehiclesPerSession);
    }

    // Check if we're on the right page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Current tab URL:', tab.url);
    
    if (!tab.url.includes('facebook.com')) {
      alert('Please navigate to Facebook first.');
      return;
    }

    // Check if we're on the correct vehicle creation URL
    const targetUrl = 'https://www.facebook.com/marketplace/create/vehicle';
    
    if (tab.url !== targetUrl) {
      document.getElementById('status').textContent = 'Redirecting to Facebook Marketplace vehicle creation page...';
      
      try {
        // Navigate to the correct URL
        await chrome.tabs.update(tab.id, { url: targetUrl });
        
        // Wait for the page to load completely
        await this.waitForPageLoad(tab.id, targetUrl);
        
        document.getElementById('status').textContent = 'Page loaded successfully...';
      } catch (error) {
        console.error('Error redirecting to vehicle creation page:', error);
        document.getElementById('status').textContent = 'Error: Unable to navigate to vehicle creation page';
        return;
      }
    }

    // Store posting state in Chrome Storage for persistence across redirects
    await chrome.storage.local.set({
      isPosting: true,
      postingQueue: vehiclesToPost,
      currentVehicleIndex: 0,
      postingStartTime: Date.now(),
      totalVehiclesInSession: vehiclesToPost.length,
      rateLimitingEnabled: true,
      lastPostingActivity: Date.now()
    });

    this.isPosting = true;
    this.currentVehicleIndex = 0;
    
    document.getElementById('startPosting').style.display = 'none';
    document.getElementById('stopPosting').style.display = 'inline-block';
    document.getElementById('status').textContent = `Starting posting process for ${vehiclesToPost.length} vehicles with rate limiting...`;
    
    // Start with a longer initial delay to ensure clean start
    setTimeout(() => {
      this.postNextVehicle();
    }, 2000);
  }

  async stopPosting() {
    this.isPosting = false;
    
    // Clear posting state from storage
    await chrome.storage.local.remove(['isPosting', 'postingQueue', 'currentVehicleIndex', 'postingStartTime', 'lastPostingActivity']);
    
    document.getElementById('startPosting').style.display = 'inline-block';
    document.getElementById('stopPosting').style.display = 'none';
    document.getElementById('status').textContent = 'Posting stopped';
  }

  async postNextVehicle() {
    // Get current state from storage (in case of reload/redirect)
    const state = await chrome.storage.local.get(['isPosting', 'postingQueue', 'currentVehicleIndex', 'postedVehicles']);
    
    // Update last activity timestamp to prevent stale state detection
    await chrome.storage.local.set({ lastPostingActivity: Date.now() });
    
    if (!state.isPosting || !state.postingQueue || state.currentVehicleIndex >= state.postingQueue.length) {
      await this.stopPosting();
      document.getElementById('status').textContent = 'All vehicles posted!';
      return;
    }

    const vehicle = state.postingQueue[state.currentVehicleIndex];
    const vehicleKey = `${vehicle.id}_${vehicle.year}_${vehicle.make}_${vehicle.model}`;
    const postedVehicles = state.postedVehicles || [];
    
    // Check if this vehicle has already been posted successfully
    if (postedVehicles.includes(vehicleKey)) {
      console.log('⏭️ Skipping already posted vehicle:', vehicle.year, vehicle.make, vehicle.model);
      document.getElementById('status').textContent = `Skipping already posted: ${vehicle.year} ${vehicle.make} ${vehicle.model}`;
      
      // Move to next vehicle immediately
      setTimeout(() => {
        this.moveToNextVehicle();
      }, 1000);
      return;
    }
    
    console.log('🚗 Posting vehicle', state.currentVehicleIndex + 1, 'of', state.postingQueue.length, ':', vehicle.year, vehicle.make, vehicle.model);
    
    // Update UI
    document.getElementById('status').textContent = `Posting ${state.currentVehicleIndex + 1} of ${state.postingQueue.length}: ${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    
    try {
      // Step 1: Download images for this vehicle first
      const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
      
      if (vehicle.images && Array.isArray(vehicle.images) && vehicle.images.length > 0) {
        console.log(`📸 Downloading images for ${vehicleLabel} (${vehicle.images.length} images)...`);
        document.getElementById('status').textContent = `Downloading images for ${vehicleLabel}...`;
        
        try {
          await this.downloadImagesForVehicle(vehicle);
          console.log(`📸 ✅ All images downloaded for ${vehicleLabel}`);
        } catch (imageError) {
          console.warn(`📸 ⚠️ Image download failed for ${vehicleLabel}:`, imageError.message, '- continuing with post anyway');
          await this.sendLogToContent(`📸 ⚠️ Image download failed: ${imageError.message} - continuing anyway`, { vehicle: vehicleLabel });
        }
      } else {
        console.log(`📸 No images to download for ${vehicleLabel}`);
      }
      
      // Step 2: Check and deduct credits BEFORE posting
      await this.sendLogToContent('🔍 Checking credits before posting...', { vehicle: vehicleLabel });
      console.log('🔍 Checking credits before posting...');
      
      // Check current credits before attempting to post
      if (this.credits <= 0) {
        this.stopPosting();
        this.showBuyCreditsMessage();
        throw new Error('Insufficient credits to post vehicle');
      }
      
      // Step 3: Send vehicle to content script for posting
      await this.sendVehicleToContentScript(vehicle);
    } catch (error) {
      console.error('Error posting vehicle:', error);
      await this.sendErrorToContent('❌ Error posting vehicle', { error: error?.message, vehicle });
      document.getElementById('status').textContent = `Error posting vehicle ${state.currentVehicleIndex + 1}: ${error.message}`;
      
      // Continue to next vehicle after error
      setTimeout(() => {
        this.moveToNextVehicle();
      }, 3000);
    }
  }

  // Method to check credits before posting (without deducting)
  async checkCreditsBeforePosting() {
    // Check current credits before attempting to post
    if (this.credits <= 0) {
      this.stopPosting();
      this.showBuyCreditsMessage();
      throw new Error('Insufficient credits to post vehicle');
    }
    
    return true;
  }

  // Method to mark vehicle as posted and deduct credit
  async markVehiclePosted(vehicleId, facebookPostId) {
    try {
      console.log('💰 Marking vehicle as posted and deducting credit:', vehicleId);
      
      // Get user token from storage
      const { userToken } = await chrome.storage.sync.get(['userToken']);
      if (!userToken) {
        throw new Error('User not authenticated - no token found');
      }
      
      const apiUrl = 'https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/facebook-poster';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          action: 'update_vehicle_status',
          vehicleId: vehicleId,
          status: 'posted',
          facebookPostId: facebookPostId
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Vehicle marked as posted and credit deducted:', result);
      
      // Update local credit count
      if (result.credits !== undefined) {
        this.credits = result.credits;
        this.updateCreditDisplay();
      }
      
      return {
        success: true,
        credits: result.credits,
        message: 'Vehicle posted and credit deducted successfully'
      };
      
    } catch (error) {
      console.error('❌ Error marking vehicle posted:', error);
      throw error;
    }
  }

  // New method to show buy credits message and redirect
  showBuyCreditsMessage() {
    const statusEl = document.getElementById('status');
    statusEl.className = 'status disconnected';
    statusEl.innerHTML = `
      <div style="text-align: center; padding: 10px;">
        <div style="margin-bottom: 10px;">❌ No credits remaining!</div>
        <div style="margin-bottom: 15px; font-size: 14px;">You need credits to post vehicles to Facebook Marketplace.</div>
        <button id="buyCreditsBtn" style="
          background: #10b981;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
        ">Buy Credits</button>
      </div>
    `;
    
    // Add click handler for buy credits button
    const buyCreditsBtn = document.getElementById('buyCreditsBtn');
    if (buyCreditsBtn) {
      buyCreditsBtn.addEventListener('click', () => {
        // Open Salesonator billing page in new tab
        chrome.tabs.create({ 
          url: 'https://7163d240-f16f-476c-b2aa-a96bf0373743.lovableproject.com/billing' 
        });
      });
    }
  }

  // Download images for a specific vehicle before posting
  async downloadImagesForVehicle(vehicle) {
    if (!vehicle.images || !Array.isArray(vehicle.images) || vehicle.images.length === 0) {
      console.log('📸 No images to download for vehicle');
      return;
    }

    const vehicleKey = `vehicle_images_${vehicle.id}`;
    const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    
    // Check if already cached
    const { [vehicleKey]: existingCache } = await chrome.storage.local.get([vehicleKey]);
    if (existingCache && existingCache.length > 0) {
      console.log(`📸 Images already cached for ${vehicleLabel} (${existingCache.length} images)`);
      return;
    }

    console.log(`📸 Starting download of ${vehicle.images.length} images for ${vehicleLabel}...`);
    
    return new Promise((resolve, reject) => {
      // Set a timeout for the entire download process
      const downloadTimeout = setTimeout(() => {
        console.warn(`📸 ⏰ Image download timeout (30s) for ${vehicleLabel} - continuing anyway`);
        resolve(); // Don't reject, just continue
      }, 30000);

      chrome.runtime.sendMessage({
        action: 'preDownloadImagesViaProxy',
        imageUrls: vehicle.images,
        vehicleId: vehicle.id,
        vehicleLabel: vehicleLabel
      }, (response) => {
        clearTimeout(downloadTimeout);
        
        if (chrome.runtime.lastError) {
          console.error(`📸 Runtime error downloading images for ${vehicleLabel}:`, chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response && response.success) {
          const successCount = response.successfulImages || 0;
          const totalCount = vehicle.images.length;
          
          if (successCount > 0) {
            console.log(`📸 ✅ Downloaded ${successCount}/${totalCount} images for ${vehicleLabel}`);
            document.getElementById('status').textContent = `Downloaded ${successCount}/${totalCount} images for ${vehicleLabel}`;
            resolve();
          } else {
            console.warn(`📸 ⚠️ No images downloaded for ${vehicleLabel} - continuing anyway`);
            resolve(); // Don't fail the entire process for image issues
          }
        } else {
          const error = response?.error || 'Unknown error';
          console.error(`📸 ❌ Failed to download images for ${vehicleLabel}:`, error);
          reject(new Error(error));
        }
      });
    });
  }

  // New method to move to next vehicle and update storage
  async moveToNextVehicle() {
    const state = await chrome.storage.local.get(['currentVehicleIndex', 'postingQueue']);
    const newIndex = (state.currentVehicleIndex || 0) + 1;
    
    // Update storage with persistence timestamp
    await chrome.storage.local.set({ 
      currentVehicleIndex: newIndex,
      lastPostingActivity: Date.now()
    });
    this.currentVehicleIndex = newIndex;
    
    // Check if we have reached the end of the queue
    if (newIndex >= state.postingQueue.length) {
      console.log('✅ All vehicles have been processed');
      document.getElementById('status').textContent = '✅ All vehicles posted successfully!';
      this.stopPosting();
      return;
    }
    
    // Check credits before proceeding to next vehicle
    if (this.credits <= 0) {
      console.log('❌ No credits remaining, stopping posting process');
      this.stopPosting();
      this.showBuyCreditsMessage();
      return;
    }
    
    // Enhanced delay with rate limiting - minimum 30 seconds between posts
    const baseDelay = parseInt(document.getElementById('delay').value) || 5;
    const rateLimitDelay = Math.max(baseDelay, 30); // Minimum 30 seconds
    
    console.log(`⏱️ Waiting ${rateLimitDelay} seconds before next vehicle to avoid rate limiting...`);
    document.getElementById('status').textContent = `Waiting ${rateLimitDelay} seconds before next vehicle...`;
    
    setTimeout(() => {
      this.postNextVehicle();
    }, rateLimitDelay * 1000);
  }

  async sendVehicleToContentScript(vehicle) {
    return new Promise(async (resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (chrome.runtime.lastError) {
          return reject(new Error('Could not get current tab'));
        }

        if (!tabs || tabs.length === 0) {
          return reject(new Error('No active tab found'));
        }

        const currentTab = tabs[0];
        
        // Add a small delay to ensure content script is fully loaded
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // First, ensure content script is ready with ping-pong
        let retries = 0;
        const maxRetries = 10;
        
        const checkContentScript = () => {
          console.log(`🔄 DEBUG: Attempting to ping content script (attempt ${retries + 1}/${maxRetries})...`);
          console.log('🔄 DEBUG: Current tab:', currentTab.url, 'Tab ID:', currentTab.id);
          console.log('🔄 DEBUG: Tab active?', currentTab.active, 'URL valid?', currentTab.url?.includes('facebook.com'));
          
          // Try to inject content script if not already present
          if (retries === 0) {
            console.log('🔄 DEBUG: Attempting to inject content script...');
            chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              files: ['content.js']
            }).then(result => {
              console.log('🔄 DEBUG: Content script injection result:', result);
            }).catch(err => {
              console.log('🔄 DEBUG: Content script injection failed (may already be injected):', err.message);
            });
          }
          
          console.log('🔄 DEBUG: Sending ping message to tab ID:', currentTab.id);
          chrome.tabs.sendMessage(currentTab.id, { action: 'ping' }, (response) => {
            if (chrome.runtime.lastError) {
              console.log(`🔄 DEBUG: Ping failed with error: ${chrome.runtime.lastError.message}`);
              console.log('🔄 DEBUG: Runtime error details:', chrome.runtime.lastError);
              retries++;
              if (retries < maxRetries) {
                console.log(`🔄 DEBUG: Content script not ready, retrying... (${retries}/${maxRetries})`);
                setTimeout(checkContentScript, 1000);
              } else {
                console.log('🔄 DEBUG: Max retries reached, failing');
                reject(new Error(`Content script not responding after multiple attempts. Current page: ${currentTab.url}. Please reload the extension and refresh the Facebook page.`));
              }
            } else if (!response) {
              console.log('🔄 DEBUG: Ping returned no response (response is falsy)');
              console.log('🔄 DEBUG: Response value:', response);
              retries++;
              if (retries < maxRetries) {
                console.log(`🔄 DEBUG: No response from content script, retrying... (${retries}/${maxRetries})`);
                setTimeout(checkContentScript, 1000);
              } else {
                console.log('🔄 DEBUG: Max retries reached with no response, failing');
                reject(new Error(`Content script not responding after multiple attempts. Current page: ${currentTab.url}. Please reload the extension and refresh the Facebook page.`));
              }
            } else {
              console.log('🔄 DEBUG: ✅ Content script is ready, received response:', response);
              console.log('🔄 DEBUG: About to send postVehicle message with vehicle:', vehicle?.id);
              // Content script is ready, now send the actual message
              chrome.tabs.sendMessage(currentTab.id, {
                action: 'postVehicle',
                vehicle: vehicle
              }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('🔄 DEBUG: Error sending postVehicle message:', chrome.runtime.lastError.message);
                  console.error('🔄 DEBUG: PostVehicle error details:', chrome.runtime.lastError);
                  return reject(new Error(chrome.runtime.lastError.message));
                }
                
                // Don't wait for response - the content script will notify us via message when done
                console.log('🔄 DEBUG: ✅ Vehicle posting command sent successfully, waiting for notification...');
                console.log('🔄 DEBUG: PostVehicle response:', response);
                document.getElementById('status').textContent = 'Posting vehicle...';
                resolve({ success: true, message: 'Posting initiated' });
              });
            }
          });
        };
        
        // Start the check
        checkContentScript();
      });
    });
  }

  async saveSettings() {
    const delay = document.getElementById('delay').value;
    await chrome.storage.sync.set({ delay });
  }

  async logout() {
    await chrome.storage.sync.remove(['userToken', 'userEmail']);
    await this.checkAuthentication();
  }

  async preDownloadAllImages() {
    try {
      console.log('📸 Starting image pre-download for', this.vehicles.length, 'vehicles...');
      
      // Collect all unique image URLs from all vehicles
      const allImageUrls = [];
      
      this.vehicles.forEach((vehicle, index) => {
        if (vehicle.images && Array.isArray(vehicle.images)) {
          vehicle.images.forEach(imageUrl => {
            if (imageUrl && !allImageUrls.includes(imageUrl)) {
              allImageUrls.push(imageUrl);
            }
          });
        }
      });
      
      console.log('📸 Found', allImageUrls.length, 'unique images to pre-download');
      
      if (allImageUrls.length === 0) {
        console.log('📸 No images to pre-download');
        return { success: true, successCount: 0, totalCount: 0 };
      }
      
      // Update UI to show pre-download progress
      const statusEl = document.getElementById('status');
      const startBtn = document.getElementById('startPosting');
      const fetchBtn = document.getElementById('fetchVehicles');
      
      // Disable buttons during pre-download
      startBtn.disabled = true;
      fetchBtn.disabled = true;
      statusEl.textContent = `Pre-downloading images: 0/${allImageUrls.length} (0%)`;
      statusEl.className = 'status';
      statusEl.style.background = '#fff3cd';
      statusEl.style.color = '#856404';
      statusEl.style.border = '1px solid #ffeaa7';
      
      // Use background script to pre-download images with timeout
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          statusEl.textContent = 'Image pre-download timed out. You can still try posting.';
          statusEl.className = 'status disconnected';
          startBtn.disabled = false;
          fetchBtn.disabled = false;
          reject(new Error('Pre-download timeout after 60 seconds'));
        }, 60000);
        
        chrome.runtime.sendMessage({
          action: 'preDownloadImages',
          imageUrls: allImageUrls
        }, (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            statusEl.textContent = 'Pre-download failed. You can still try posting.';
            statusEl.className = 'status disconnected';
            startBtn.disabled = false;
            fetchBtn.disabled = false;
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.success) {
            const successCount = response.successCount || 0;
            const totalCount = response.totalCount || allImageUrls.length;
            const percentage = Math.round((successCount / totalCount) * 100);
            
            console.log(`✅ Pre-download completed: ${successCount}/${totalCount} images (${percentage}%)`);
            
            if (successCount === totalCount) {
              statusEl.textContent = `✅ All ${totalCount} images downloaded successfully!`;
              statusEl.className = 'status connected';
            } else if (successCount > 0) {
              statusEl.textContent = `⚠️ ${successCount}/${totalCount} images downloaded (${percentage}%). You can still post.`;
              statusEl.className = 'status';
              statusEl.style.background = '#fff3cd';
              statusEl.style.color = '#856404';
              statusEl.style.border = '1px solid #ffeaa7';
            } else {
              statusEl.textContent = '❌ No images downloaded. Posts may fail without images.';
              statusEl.className = 'status disconnected';
            }
            
            // Re-enable buttons
            startBtn.disabled = this.vehicles.length === 0;
            fetchBtn.disabled = false;
            
            resolve(response);
          } else {
            console.error('Pre-download failed:', response?.error);
            statusEl.textContent = `Pre-download failed: ${response?.error || 'Unknown error'}`;
            statusEl.className = 'status disconnected';
            startBtn.disabled = false;
            fetchBtn.disabled = false;
            reject(new Error(response?.error || 'Pre-download failed'));
          }
        });
      });
      
    } catch (error) {
      console.error('Error pre-downloading images:', error);
      throw error;
    }
  }

  // Wait for page to load completely
  async waitForPageLoad(tabId, expectedUrl) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Page load timeout'));
      }, 15000); // 15 second timeout

      const checkComplete = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            clearTimeout(timeout);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (tab.status === 'complete' && tab.url === expectedUrl) {
            clearTimeout(timeout);
            // Additional delay to ensure DOM is ready for Facebook's dynamic content
            setTimeout(resolve, 3000);
          } else {
            setTimeout(checkComplete, 500);
          }
        });
      };
      
      checkComplete();
    });
  }

  updateCreditDisplay() {
    const creditEl = document.getElementById('creditCount');
    if (creditEl) {
      creditEl.textContent = this.credits;
    }
  }

  updateStatusMessage(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    
    // Apply styling based on type
    if (type === 'info') {
      statusEl.className = 'status';
      statusEl.style.background = '#fff3cd';
      statusEl.style.color = '#856404';
      statusEl.style.border = '1px solid #ffeaa7';
    } else if (type === 'success') {
      statusEl.className = 'status connected';
    } else if (type === 'error') {
      statusEl.className = 'status disconnected';
    }
  }

  // Helper: send a lightweight log to the active Facebook tab's content script
  async sendToContent(action, payload) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      chrome.tabs.sendMessage(tab.id, { action, ...payload }, () => void 0);
    } catch {}
  }

  async sendLogToContent(message, data) {
    await this.sendToContent('popupLog', { message, data });
  }

  async sendErrorToContent(message, data) {
    await this.sendToContent('popupError', { message, data });
  }

  setupMessageListener() {
    // Listen for messages from the background script and content script
      chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
      console.log('📨 Popup received message:', message);
      
      if (message.action === 'extensionReloaded') {
        document.getElementById('status').textContent = 'Extension reloaded. Please refresh this popup.';
      } else if (message.action === 'imagesPreDownloaded') {
        console.log('✅ All images pre-downloaded successfully');
      } else if (message.type === 'imageDownloadProgress') {
        // Handle real-time progress updates from chunked download
        const data = message.data;
        const percentage = Math.round((data.completed / data.total) * 100);
        this.updateStatusMessage(`Pre-downloading images: ${data.stored}/${data.total} (${percentage}%) - Chunk ${data.chunk}/${data.totalChunks}`, 'info');
      } else if (message.action === 'vehiclePosted') {
        console.log('🎉 Vehicle posted successfully, continuing with next...');
        
        // Deduct credit and mark as posted
        try {
          const vehicleId = message.vehicleId || message.vehicle?.id;
          const facebookPostId = message.facebookPostId || `fb_${Date.now()}`;
          
          if (vehicleId) {
            await this.markVehiclePosted(vehicleId, facebookPostId);
            console.log('✅ Credit deducted successfully after posting');
          }
          
        } catch (error) {
          console.error('❌ Error deducting credit after posting:', error);
          this.updateStatusMessage(`Posted but credit error: ${error.message}`, 'error');
        }
        
        // Check if database recording failed
        if (message.recordingFailed || message.databaseError) {
          console.error('⚠️ Database recording failed for vehicle:', message.vehicleId);
          document.getElementById('status').textContent = `Vehicle posted but DB update failed: ${message.error}`;
          this.updateStatusMessage(`Posted but database error: ${message.error}`, 'error');
          
          // Still mark locally to prevent immediate reposting, but show warning
          const state = await chrome.storage.local.get(['postingQueue', 'currentVehicleIndex']);
          if (state.postingQueue && state.currentVehicleIndex < state.postingQueue.length) {
            const vehicle = state.postingQueue[state.currentVehicleIndex];
            await this.markVehicleAsPosted(vehicle);
            console.log('⚠️ Marked vehicle as posted locally despite database error');
          }
        } else {
          document.getElementById('status').textContent = 'Vehicle posted! Moving to next...';
          
          // Mark vehicle as posted before moving to next
          const state = await chrome.storage.local.get(['postingQueue', 'currentVehicleIndex']);
          if (state.postingQueue && state.currentVehicleIndex < state.postingQueue.length) {
            const vehicle = state.postingQueue[state.currentVehicleIndex];
            await this.markVehicleAsPosted(vehicle);
          }
        }
        
        // Don't call moveToNextVehicle here - wait for continueWithNextVehicle message
      } else if (message.action === 'recordingError') {
        console.error('💥 Recording error received:', message.error);
        document.getElementById('status').textContent = `Database error: ${message.error}`;
        this.updateStatusMessage(`Critical: Database recording failed - ${message.error}`, 'error');
      } else if (message.action === 'continueWithNextVehicle') {
        console.log('🚀 Content script signaling to continue with next vehicle immediately');
        document.getElementById('status').textContent = 'Preparing next vehicle...';
        // Move to next vehicle and continue posting - moveToNextVehicle already calls postNextVehicle
        this.moveToNextVehicle();
      } else if (message.action === 'readyForNextVehicle') {
        console.log('🚀 Content script ready for next vehicle');
        document.getElementById('status').textContent = 'Ready for next vehicle...';
        // Longer delay to ensure page is fully loaded before posting next vehicle
        setTimeout(() => {
          this.postNextVehicle();
        }, 4000);
      }
    });
  }

  async markVehicleAsPosted(vehicle) {
    try {
      const vehicleKey = `${vehicle.id}_${vehicle.year}_${vehicle.make}_${vehicle.model}`;
      const state = await chrome.storage.local.get(['postedVehicles']);
      const postedVehicles = state.postedVehicles || [];
      
      if (!postedVehicles.includes(vehicleKey)) {
        postedVehicles.push(vehicleKey);
        await chrome.storage.local.set({ postedVehicles });
        console.log('✅ Marked vehicle as posted:', vehicleKey);
      }
    } catch (error) {
      console.error('Error marking vehicle as posted:', error);
    }
  }

  async checkPostingState() {
    try {
      const state = await chrome.storage.local.get(['isPosting', 'postingQueue', 'currentVehicleIndex', 'postingStartTime', 'lastPostingActivity']);
      
      if (state.isPosting && state.postingQueue && state.postingQueue.length > 0) {
        console.log('Found existing posting state:', state);
        
        // Check if the last activity was recent (within 10 minutes) to avoid stale states
        const lastActivity = state.lastPostingActivity || 0;
        const timeDifference = Date.now() - lastActivity;
        const maxIdleTime = 10 * 60 * 1000; // 10 minutes
        
        if (timeDifference > maxIdleTime) {
          console.log('Posting state is stale, clearing it');
          await this.clearPostingState();
          return;
        }
        
        // Restore the posting state
        this.isPosting = true;
        this.vehicles = state.postingQueue;
        this.currentVehicleIndex = state.currentVehicleIndex || 0;
        
        // Update UI to reflect posting state
        document.getElementById('startPosting').style.display = 'none';
        document.getElementById('stopPosting').style.display = 'inline-block';
        
        console.log('Resuming posting from vehicle index:', this.currentVehicleIndex);
        
        // Resume posting (but only if we're on Facebook and there are more vehicles)
        if (this.currentVehicleIndex < this.vehicles.length) {
          document.getElementById('status').textContent = `Resuming posting from vehicle ${this.currentVehicleIndex + 1} of ${this.vehicles.length}`;
          setTimeout(() => {
            this.checkConnectionAndResume();
          }, 2000);
        } else {
          // All vehicles have been processed, clear the state
          console.log('All vehicles processed, clearing posting state');
          await this.clearPostingState();
        }
      }
    } catch (error) {
      console.error('Error checking posting state:', error);
    }
  }

  async clearPostingState() {
    await chrome.storage.local.remove(['isPosting', 'postingQueue', 'currentVehicleIndex', 'postingStartTime', 'lastPostingActivity']);
    this.isPosting = false;
    this.vehicles = [];
    this.currentVehicleIndex = 0;
    
    // Reset UI
    document.getElementById('startPosting').style.display = 'inline-block';
    document.getElementById('stopPosting').style.display = 'none';
    document.getElementById('status').textContent = 'Ready to start posting';
  }

  async debugCreditDeduction() {
    console.log('🐛 DEBUG: Testing credit deduction...');
    
    try {
      // Get user token
      const settings = await chrome.storage.sync.get(['userToken']);
      if (!settings.userToken) {
        alert('❌ No user token found. Please login first.');
        return;
      }

      console.log('🐛 DEBUG: User token found:', settings.userToken.substring(0, 20) + '...');

      // Get first draft vehicle for testing
      await this.fetchVehicles();
      const draftVehicle = this.vehicles.find(v => v.facebook_post_status === 'draft');
      
      if (!draftVehicle) {
        alert('❌ No draft vehicles found to test with.');
        return;
      }

      console.log('🐛 Found vehicle for testing:', draftVehicle.id, draftVehicle.year, draftVehicle.make, draftVehicle.model);
      
      // Get API URL
      const apiUrl = document.getElementById('apiUrl').value;
      console.log('🐛 DEBUG: API URL:', apiUrl);
      
      // Prepare request payload
      const requestPayload = {
        action: 'update_vehicle_status',
        vehicleId: draftVehicle.id,
        status: 'posted',
        facebookPostId: 'debug_test_' + Date.now(),
        updateData: {
          facebook_post_status: 'posted',
          last_posted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };
      
      console.log('🐛 DEBUG: Request payload:', JSON.stringify(requestPayload, null, 2));
      
      // Call the edge function to deduct credit and update status
      console.log('🐛 DEBUG: Making fetch request...');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.userToken}`
        },
        body: JSON.stringify(requestPayload)
      });

      console.log('🐛 DEBUG: Response status:', response.status);
      console.log('🐛 DEBUG: Response headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('🐛 DEBUG: Raw response text:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('🐛 DEBUG: Failed to parse response as JSON:', parseError);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
      
      console.log('🐛 DEBUG: Parsed result:', result);
      
      if (result.success) {
        console.log('🐛 DEBUG SUCCESS:', result);
        alert(`✅ DEBUG SUCCESS!\n\nVehicle: ${draftVehicle.year} ${draftVehicle.make} ${draftVehicle.model}\nCredits Remaining: ${result.credits}\nStatus: ${result.status || 'posted'}`);
        
        // Update credit display
        this.updateCreditDisplay(result.credits);
        
        // Refresh vehicles to see updated status
        setTimeout(() => {
          this.fetchVehicles();
        }, 1000);
      } else {
        console.error('🐛 DEBUG ERROR:', result);
        alert(`❌ DEBUG FAILED!\n\nError: ${result.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('🐛 DEBUG EXCEPTION:', error);
      alert(`❌ DEBUG EXCEPTION!\n\nError: ${error.message}`);
    }
  }

  async checkConnectionAndResume() {
    try {
      // Check if we're on Facebook
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isFacebook = tab.url && tab.url.includes('facebook.com');
      
      if (!isFacebook) {
        document.getElementById('status').textContent = 'Please navigate to Facebook Marketplace to resume posting';
        
        // Keep checking every 5 seconds until user navigates to Facebook
        setTimeout(() => {
          if (this.isPosting && this.currentVehicleIndex < this.vehicles.length) {
            this.checkConnectionAndResume();
          }
        }, 5000);
        return;
      }
    } catch (error) {
      console.error('Error in resume check:', error);
    }
  }

  // Debug method to test content script communication
  async testContentScriptCommunication() {
    try {
      console.log('🐛 DEBUG: Testing content script communication...');
      
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });
      
      if (!tabs || tabs.length === 0) {
        console.log('🐛 DEBUG: No active tab found');
        alert('No active tab found');
        return;
      }
      
      const currentTab = tabs[0];
      console.log('🐛 DEBUG: Testing with tab:', currentTab.url, 'ID:', currentTab.id);
      
      // Test 1: Simple ping
      chrome.tabs.sendMessage(currentTab.id, { action: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('🐛 DEBUG: Ping test FAILED:', chrome.runtime.lastError.message);
          alert(`Ping test FAILED: ${chrome.runtime.lastError.message}`);
        } else {
          console.log('🐛 DEBUG: Ping test SUCCESS:', response);
          
          // Test 2: Send a test message to content script
          chrome.tabs.sendMessage(currentTab.id, { 
            action: 'debugTest',
            timestamp: new Date().toISOString()
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('🐛 DEBUG: Debug test message FAILED:', chrome.runtime.lastError.message);
              alert(`Debug test FAILED: ${chrome.runtime.lastError.message}`);
            } else {
              console.log('🐛 DEBUG: Debug test message SUCCESS:', response);
              alert(`✅ Content script communication working!\nPing: ${JSON.stringify(response)}`);
            }
          });
        }
      });
      
    } catch (error) {
      console.error('🐛 DEBUG: Error in test:', error);
      alert(`Test error: ${error.message}`);
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SalesonatorExtension();
});
