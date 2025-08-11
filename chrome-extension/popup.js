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
  }

  async checkWebAppAuthentication() {
    try {
      console.log('Checking for web app authentication...');
      
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
                  
                  if (profile && profile.is_active && profile.credits > 0) {
                    console.log('✅ User is eligible with credits:', profile.credits);
                    console.log('Setting up auto-authentication...');
                    this.credits = profile.credits;
                    this.updateCreditDisplay();
                    this.showWebAppAuthSuccess();
                    return { token: authData.token, user: authData.user, credits: profile.credits };
                  } else {
                    console.log('❌ User is not eligible - Active:', profile?.is_active, 'Credits:', profile?.credits);
                    this.showError('Active account with credits required for extension');
                    return null;
                  }
                } else {
                  const errorText = await response.text();
                  console.log('❌ Failed to verify user eligibility, status:', response.status);
                  console.log('❌ Error response:', errorText);
                  this.showError('Failed to verify user eligibility');
                  return null;
                }
              } catch (error) {
                console.error('❌ Error verifying user eligibility:', error);
                console.error('❌ Error details:', error.message, error.stack);
                this.showError('Error checking user eligibility: ' + error.message);
                return null;
              }
            }
          } catch (error) {
            console.log('Script injection failed for tab:', tab.url, error);
            continue;
          }
        }
      }
      
      console.log('No admin authentication found');
      return null;
    } catch (error) {
      console.warn('Error checking web app authentication:', error);
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
        statusEl.textContent = 'Vehicles loaded, pre-downloading images...';
        
        // Pre-download all vehicle images
        await this.preDownloadAllImages();
        
        statusEl.textContent = 'Vehicles and images ready for posting';
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
      alert('No vehicles to post. Please fetch vehicles first.');
      return;
    }

    // Check if we're on the right page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Current tab URL:', tab.url);
    
    if (!tab.url.includes('facebook.com')) {
      alert('Please navigate to Facebook first.');
      return;
    }

    // Store posting state in Chrome Storage for persistence across redirects
    await chrome.storage.local.set({
      isPosting: true,
      postingQueue: this.vehicles,
      currentVehicleIndex: 0,
      postingStartTime: Date.now()
    });

    this.isPosting = true;
    this.currentVehicleIndex = 0;
    
    document.getElementById('startPosting').style.display = 'none';
    document.getElementById('stopPosting').style.display = 'inline-block';
    document.getElementById('status').textContent = 'Posting in progress...';
    
    await this.postNextVehicle();
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
    const state = await chrome.storage.local.get(['isPosting', 'postingQueue', 'currentVehicleIndex']);
    
    if (!state.isPosting || !state.postingQueue || state.currentVehicleIndex >= state.postingQueue.length) {
      await this.stopPosting();
      document.getElementById('status').textContent = 'All vehicles posted!';
      return;
    }

    const vehicle = state.postingQueue[state.currentVehicleIndex];
    console.log('🚗 Posting vehicle', state.currentVehicleIndex + 1, 'of', state.postingQueue.length, ':', vehicle.year, vehicle.make, vehicle.model);
    
    // Update UI
    document.getElementById('status').textContent = `Posting ${state.currentVehicleIndex + 1} of ${state.postingQueue.length}: ${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    
    try {
      // CRITICAL: Deduct credit BEFORE posting to ensure it completes before redirect
      console.log('💳 Deducting credit before posting...');
      await this.deductCreditForPosting(vehicle);
      console.log('✅ Credit deducted successfully');
      
      // Now attempt to post the vehicle
      await this.sendVehicleToContentScript(vehicle);
    } catch (error) {
      console.error('Error posting vehicle:', error);
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

  // New method to move to next vehicle and update storage
  async moveToNextVehicle() {
    const state = await chrome.storage.local.get(['currentVehicleIndex', 'postingQueue']);
    const newIndex = (state.currentVehicleIndex || 0) + 1;
    
    await chrome.storage.local.set({ currentVehicleIndex: newIndex });
    this.currentVehicleIndex = newIndex;
    
    // Small delay before continuing
    const delay = parseInt(document.getElementById('delay').value) || 5;
    setTimeout(() => {
      this.postNextVehicle();
    }, delay * 1000);
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
                
                if (response && response.success) {
                  console.log('✅ Vehicle posting successful:', response);
                  resolve(response);
                } else {
                  console.error('Vehicle posting failed:', response);
                  reject(new Error(response?.error || 'Unknown error from content script'));
                }
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
        return;
      }
      
      // Use background script to pre-download images
      const response = await chrome.runtime.sendMessage({
        action: 'preDownloadImages',
        imageUrls: allImageUrls
      });
      
      if (response.success) {
        console.log('✅ Successfully pre-downloaded', response.downloaded, 'images');
      } else {
        console.warn('⚠️ Some images failed to pre-download:', response.failed);
      }
      
    } catch (error) {
      console.error('Error pre-downloading images:', error);
    }
  }

  updateCreditDisplay() {
    const creditEl = document.getElementById('creditCount');
    if (creditEl) {
      creditEl.textContent = this.credits;
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📩 Popup received message:', message);
      
      if (message.action === 'updateCredits') {
        console.log('💳 Updating credits from', this.credits, 'to', message.credits);
        this.credits = message.credits;
        this.updateCreditDisplay();
      } else if (message.action === 'vehiclePosted') {
        console.log('✅ Vehicle posted successfully, moving to next vehicle');
        this.moveToNextVehicle();
      } else if (message.action === 'postingError') {
        console.log('❌ Posting error received:', message.error);
        // Move to next vehicle even on error
        this.moveToNextVehicle();
      } else if (message.action === 'navigationDetected') {
        console.log('🔄 Navigation detected:', message.url);
        document.getElementById('status').textContent = 'Navigation detected, waiting for next posting...';
      } else if (message.action === 'readyForNext') {
        console.log('✅ Content script is ready for next vehicle');
        // Small delay before posting next vehicle
        setTimeout(() => {
          this.postNextVehicle();
        }, 2000);
      }
    });
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