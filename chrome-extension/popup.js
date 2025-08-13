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
      // Open Salesonator dashboard in new tab
      const dashboardUrl = 'https://preview--inventory-to-face.lovable.app/';
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

      if (response.ok) {
        const data = await response.json();
        await chrome.storage.sync.set({ userToken: data.access_token });
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('mainSection').style.display = 'block';
        console.log('Authentication successful');
      } else {
        const errorData = await response.json();
        alert('Authentication failed: ' + (errorData.error_description || 'Unknown error'));
      }
    } catch (error) {
      console.error('Authentication error:', error);
      alert('Authentication failed: ' + error.message);
    }
  }

  checkConnection() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      const statusEl = document.getElementById('status');
      
      if (currentTab.url && currentTab.url.includes('facebook.com/marketplace')) {
        statusEl.textContent = '✅ Connected to Facebook Marketplace';
        statusEl.className = 'status connected';
      } else {
        statusEl.textContent = '❌ Not on Facebook Marketplace';
        statusEl.className = 'status disconnected';
      }
    });
  }

  async fetchVehicles() {
    try {
      document.getElementById('status').textContent = 'Fetching vehicles...';
      
      const { userToken } = await chrome.storage.sync.get(['userToken']);
      if (!userToken) {
        throw new Error('No authentication token found');
      }

      // Use edge function like old extension
      const response = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/get-pending-vehicles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.vehicles = data.vehicles || [];
      this.credits = data.credits || 0;
      this.currentVehicleIndex = 0;
      
      document.getElementById('vehicleCount').textContent = this.vehicles.length;
      document.getElementById('status').textContent = `Found ${this.vehicles.length} pending vehicles`;
      this.updateCreditDisplay();
      
      // Pre-download images for better performance
      if (this.vehicles.length > 0) {
        this.preDownloadAllImages();
      }

    } catch (error) {
      console.error('Error fetching vehicles:', error);
      document.getElementById('status').textContent = 'Error fetching vehicles: ' + error.message;
    }
  }

  async startPosting() {
    if (this.vehicles.length === 0) {
      alert('Please fetch vehicles first');
      return;
    }

    this.isPosting = true;
    document.getElementById('startPosting').disabled = true;
    document.getElementById('stopPosting').disabled = false;
    
    // Save state to chrome storage for persistence
    await chrome.storage.local.set({
      isPosting: true,
      vehicles: this.vehicles,
      currentVehicleIndex: this.currentVehicleIndex,
      credits: this.credits
    });

    this.postNextVehicle();
  }

  async stopPosting() {
    this.isPosting = false;
    document.getElementById('startPosting').disabled = false;
    document.getElementById('stopPosting').disabled = true;
    document.getElementById('status').textContent = 'Posting stopped';
    
    // Clear state from chrome storage
    await chrome.storage.local.remove(['isPosting', 'vehicles', 'currentVehicleIndex', 'credits']);
  }

  async postNextVehicle() {
    if (!this.isPosting || this.currentVehicleIndex >= this.vehicles.length) {
      this.stopPosting();
      return;
    }

    const vehicle = this.vehicles[this.currentVehicleIndex];
    document.getElementById('status').textContent = `Posting ${vehicle.make} ${vehicle.model} (${this.currentVehicleIndex + 1}/${this.vehicles.length})`;

    try {
      // Deduct credit for this vehicle
      await this.deductCreditForPosting(vehicle);
      
      // Send vehicle to content script for posting
      this.sendVehicleToContentScript(vehicle);
      
    } catch (error) {
      console.error('Error posting vehicle:', error);
      document.getElementById('status').textContent = 'Error posting vehicle: ' + error.message;
      this.moveToNextVehicle();
    }
  }

  async deductCreditForPosting(vehicle) {
    const { userToken } = await chrome.storage.sync.get(['userToken']);
    
    // Use edge function from old extension
    const response = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/facebook-poster', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
      },
      body: JSON.stringify({
        vehicle_id: vehicle.id,
        action: 'deduct_credit'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to deduct credit');
    }

    const result = await response.json();
    this.credits = result.credits || this.credits - 1;
    this.updateCreditDisplay();
  }

  moveToNextVehicle() {
    this.currentVehicleIndex++;
    
    // Update chrome storage with new index
    chrome.storage.local.set({ currentVehicleIndex: this.currentVehicleIndex });
    
    // Schedule next vehicle posting
    const delay = parseInt(document.getElementById('delay').value) * 1000;
    setTimeout(() => {
      if (this.isPosting) {
        this.postNextVehicle();
      }
    }, delay);
  }

  async sendVehicleToContentScript(vehicle) {
    try {
      // First, ping content script to make sure it's ready
      const pingResponse = await chrome.tabs.sendMessage(
        (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id,
        { action: 'ping' }
      );
      
      if (pingResponse?.pong) {
        // Content script is ready, send vehicle data
        await chrome.tabs.sendMessage(
          (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id,
          {
            action: 'postVehicle',
            vehicle: vehicle
          }
        );
      } else {
        throw new Error('Content script not ready');
      }
    } catch (error) {
      console.error('Error sending vehicle to content script:', error);
      this.moveToNextVehicle();
    }
  }

  async saveSettings() {
    const delay = document.getElementById('delay').value;
    await chrome.storage.sync.set({ delay: delay });
  }

  async logout() {
    await chrome.storage.sync.remove(['userToken']);
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('mainSection').style.display = 'none';
  }

  preDownloadAllImages() {
    // Send image URLs to background script for pre-downloading
    const imageUrls = [];
    this.vehicles.forEach(vehicle => {
      if (vehicle.images && Array.isArray(vehicle.images)) {
        imageUrls.push(...vehicle.images);
      }
    });
    
    if (imageUrls.length > 0) {
      chrome.runtime.sendMessage({
        action: 'preDownloadImages',
        urls: imageUrls
      });
    }
  }

  updateCreditDisplay() {
    const creditEl = document.getElementById('creditsCount');
    if (creditEl) {
      creditEl.textContent = this.credits;
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'vehiclePosted') {
        console.log('Vehicle posted successfully, moving to next');
        this.moveToNextVehicle();
      } else if (message.action === 'vehiclePostFailed') {
        console.log('Vehicle posting failed, moving to next');
        this.moveToNextVehicle();
      }
    });
  }

  async checkPostingState() {
    // Check if we were in the middle of posting when popup was closed
    const state = await chrome.storage.local.get(['isPosting', 'vehicles', 'currentVehicleIndex', 'credits']);
    
    if (state.isPosting) {
      this.isPosting = true;
      this.vehicles = state.vehicles || [];
      this.currentVehicleIndex = state.currentVehicleIndex || 0;
      this.credits = state.credits || 0;
      
      document.getElementById('startPosting').disabled = true;
      document.getElementById('stopPosting').disabled = false;
      document.getElementById('vehicleCount').textContent = this.vehicles.length;
      this.updateCreditDisplay();
      
      document.getElementById('status').textContent = 'Resuming posting...';
      
      // Resume posting after a short delay
      setTimeout(() => {
        this.postNextVehicle();
      }, 2000);
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SalesonatorExtension();
});