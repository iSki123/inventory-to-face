class SalesonatorExtension {
  constructor() {
    this.isPosting = false;
    this.vehicles = [];
    this.currentVehicleIndex = 0;
    this.credits = 0;
    this.init();
    this.setupMessageListener();
  }

  async init() {
    console.log('Initializing Salesonator Extension...');
    
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
      document.getElementById('fetchVehicles').addEventListener('click', () => this.fetchVehicles());
      document.getElementById('startPosting').addEventListener('click', () => this.startPosting());
      document.getElementById('stopPosting').addEventListener('click', () => this.stopPosting());
      document.getElementById('delay').addEventListener('change', () => this.saveSettings());
      document.getElementById('login').addEventListener('click', () => this.showLoginForm());
      document.getElementById('openDashboard').addEventListener('click', () => this.openDashboard());

      // Show initial status
      this.updateStatusMessage('Checking authentication...', 'info');

      // Check for existing web app authentication first
      console.log('🔍 Starting web app authentication check...');
      const webAppAuth = await this.checkWebAppAuthentication();
      if (webAppAuth) {
        console.log('✅ Found web app authentication, using it for extension');
        console.log('🔐 Storing token in extension storage...');
        await chrome.storage.sync.set({ userToken: webAppAuth.token });
        console.log('✅ Token stored successfully');
        
        // Show success immediately and skip further checks
        this.showWebAppAuthSuccess();
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('mainSection').style.display = 'block';
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
      this.updateStatusMessage('Initialization error: ' + error.message, 'error');
    }
  }

  async checkWebAppAuthentication() {
    try {
      console.log('Checking for web app authentication...');
      
      // Show connecting status
      this.updateStatusMessage('Connecting to Salesonator...', 'info');
      
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
                    this.updateStatusMessage('Account not active - please contact support', 'error');
                    return null;
                  }
                } else {
                  const errorText = await response.text();
                  console.log('❌ Failed to verify user eligibility, status:', response.status);
                  console.log('❌ Error response:', errorText);
                  this.updateStatusMessage('Failed to verify user eligibility', 'error');
                  return null;
                }
              } catch (error) {
                console.error('❌ Error verifying user eligibility:', error);
                console.error('❌ Error details:', error.message, error.stack);
                this.updateStatusMessage('Error checking user eligibility: ' + error.message, 'error');
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
      this.updateStatusMessage('No authentication found in web app', 'warning');
      return null;
    } catch (error) {
      console.warn('Error checking web app authentication:', error);
      this.updateStatusMessage('Error checking web app authentication', 'error');
      return null;
    }
  }

  showWebAppAuthSuccess() {
    const statusEl = document.getElementById('status');
    statusEl.className = 'status connected';
    statusEl.textContent = '✅ Auto-authenticated via Salesonator web app!';
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
        this.showWebAppAuthSuccess();
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('mainSection').style.display = 'block';
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
        
        statusEl.textContent = 'Authentication successful!';
        await this.checkAuthentication(); // Refresh the UI
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
    const countEl = document.getElementById('vehicleCount');
    const startBtn = document.getElementById('startPosting');

    try {
      statusEl.textContent = 'Fetching vehicles...';
      
      // Get user token from storage
      const { userToken } = await chrome.storage.sync.get(['userToken']);
      
      if (!userToken) {
        throw new Error('User not authenticated. Please log in to Salesonator first.');
      }

      const response = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/facebook-poster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          action: 'get_pending_vehicles'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        this.vehicles = data.vehicles || [];
        countEl.textContent = `${this.vehicles.length} vehicles ready to post`;
        startBtn.disabled = this.vehicles.length === 0;
        statusEl.className = 'status connected';
        statusEl.textContent = `✅ Vehicles loaded! Ready to start posting.`;
        
        console.log(`📊 Loaded ${this.vehicles.length} vehicles for posting`);
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
      countEl.textContent = 'Failed to load vehicles';
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
      rateLimitingEnabled: true
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
    await chrome.storage.local.remove(['isPosting', 'postingQueue', 'currentVehicleIndex', 'postingStartTime']);
    
    document.getElementById('startPosting').style.display = 'inline-block';
    document.getElementById('stopPosting').style.display = 'none';
    document.getElementById('status').textContent = 'Posting stopped';
  }

  async postNextVehicle() {
    // Get current state from storage (in case of reload/redirect)
    const state = await chrome.storage.local.get(['isPosting', 'postingQueue', 'currentVehicleIndex', 'postedVehicles']);
    
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
      
      // Step 2: Deduct credit BEFORE posting to ensure it completes before redirect
      await this.sendLogToContent('💳 Deducting credit and initiating post...', { vehicle: vehicleLabel });
      console.log('💳 Deducting credit before posting...');
      await this.deductCreditForPosting(vehicle);
      console.log('✅ Credit deducted successfully');
      await this.sendLogToContent('✅ Credit deducted, sending vehicle to content script', { vehicle: vehicleLabel });
      
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

  // New method to handle credit deduction before posting
  async deductCreditForPosting(vehicle) {
    const { userToken } = await chrome.storage.sync.get(['userToken']);
    
    if (!userToken) {
      throw new Error('User not authenticated');
    }

    const response = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/facebook-poster', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        action: 'deduct_credit',
        vehicle_id: vehicle.id,
        credit_amount: 1
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to deduct credit: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Credit deduction failed');
    }

    // Update local credit display
    this.credits = data.remaining_credits || (this.credits - 1);
    this.updateCreditDisplay();
    
    return data;
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
    
    await chrome.storage.local.set({ currentVehicleIndex: newIndex });
    this.currentVehicleIndex = newIndex;
    
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
          console.log(`Attempting to ping content script (attempt ${retries + 1}/${maxRetries})...`);
          console.log('Current tab:', currentTab.url, 'Tab ID:', currentTab.id);
          
          // Try to inject content script if not already present
          if (retries === 0) {
            console.log('Attempting to inject content script...');
            chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              files: ['content.js']
            }).catch(err => {
              console.log('Content script injection failed (may already be injected):', err.message);
            });
          }
          
          chrome.tabs.sendMessage(currentTab.id, { action: 'ping' }, (response) => {
            if (chrome.runtime.lastError) {
              console.log(`Ping failed with error: ${chrome.runtime.lastError.message}`);
              retries++;
              if (retries < maxRetries) {
                console.log(`Content script not ready, retrying... (${retries}/${maxRetries})`);
                setTimeout(checkContentScript, 1000);
              } else {
                reject(new Error(`Content script not responding after multiple attempts. Current page: ${currentTab.url}. Please reload the extension and refresh the Facebook page.`));
              }
            } else if (!response) {
              console.log('Ping returned no response');
              retries++;
              if (retries < maxRetries) {
                console.log(`No response from content script, retrying... (${retries}/${maxRetries})`);
                setTimeout(checkContentScript, 1000);
              } else {
                reject(new Error(`Content script not responding after multiple attempts. Current page: ${currentTab.url}. Please reload the extension and refresh the Facebook page.`));
              }
            } else {
              console.log('✅ Content script is ready, received response:', response);
              // Content script is ready, now send the actual message
              chrome.tabs.sendMessage(currentTab.id, {
                action: 'postVehicle',
                vehicle: vehicle
              }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('Error sending postVehicle message:', chrome.runtime.lastError.message);
                  return reject(new Error(chrome.runtime.lastError.message));
                }
                
                // Don't wait for response - the content script will notify us via message when done
                console.log('✅ Vehicle posting command sent, waiting for notification...');
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
        document.getElementById('status').textContent = 'Vehicle posted! Moving to next...';
        
        // Mark vehicle as posted before moving to next
        const state = await chrome.storage.local.get(['postingQueue', 'currentVehicleIndex']);
        if (state.postingQueue && state.currentVehicleIndex < state.postingQueue.length) {
          const vehicle = state.postingQueue[state.currentVehicleIndex];
          await this.markVehicleAsPosted(vehicle);
        }
        
        this.moveToNextVehicle();
      } else if (message.action === 'continueWithNextVehicle') {
        console.log('🚀 Content script signaling to continue with next vehicle immediately');
        document.getElementById('status').textContent = 'Preparing next vehicle...';
        // Move to next vehicle and continue posting
        this.moveToNextVehicle();
        setTimeout(() => {
          this.postNextVehicle();
        }, 5000); // Wait longer for navigation to complete
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

  // Check for existing posting state on initialization
  async checkPostingState() {
    const state = await chrome.storage.local.get(['isPosting', 'postingQueue', 'currentVehicleIndex']);
    
    if (state.isPosting && state.postingQueue) {
      console.log('🔄 Resuming posting from storage state...');
      this.isPosting = true;
      this.vehicles = state.postingQueue;
      this.currentVehicleIndex = state.currentVehicleIndex || 0;
      
      // Update UI
      document.getElementById('startPosting').style.display = 'none';
      document.getElementById('stopPosting').style.display = 'inline-block';
      document.getElementById('vehicleCount').textContent = `${this.vehicles.length} vehicles ready to post`;
      
      // Resume posting
      await this.postNextVehicle();
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SalesonatorExtension();
});