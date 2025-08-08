
class SalesonatorExtension {
  constructor() {
    this.isPosting = false;
    this.vehicles = [];
    this.currentVehicleIndex = 0;
    this.init();
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
  }

  async checkWebAppAuthentication() {
    try {
      console.log('Checking for web app authentication...');
      
      // Check all open tabs for Salesonator
      const allTabs = await chrome.tabs.query({});
      console.log('Found tabs:', allTabs.length);
      
      for (const tab of allTabs) {
        if (tab.url && 
            (tab.url.includes('lovableproject.com') || 
             tab.url.includes('localhost:3000') ||
             tab.url.includes('salesonator') ||
             tab.url.includes('inventory-to-face'))) {
          
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
                
                // Check for multiple possible auth key patterns
                const authKeys = allKeys.filter(key => 
                  (key.startsWith('sb-') && key.includes('auth-token')) ||
                  key.includes('supabase.auth.token') ||
                  key.includes('auth-token')
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
    
    // We don't require being on marketplace page since the extension will navigate there

    this.isPosting = true;
    this.currentVehicleIndex = 0;
    
    document.getElementById('startPosting').style.display = 'none';
    document.getElementById('stopPosting').style.display = 'block';
    document.getElementById('fetchVehicles').disabled = true;

    this.postNextVehicle();
  }

  stopPosting() {
    this.isPosting = false;
    document.getElementById('startPosting').style.display = 'block';
    document.getElementById('stopPosting').style.display = 'none';
    document.getElementById('fetchVehicles').disabled = false;
    
    const statusEl = document.getElementById('status');
    statusEl.className = 'status connected';
    statusEl.textContent = 'Posting stopped';
  }

  async postNextVehicle() {
    if (!this.isPosting || this.currentVehicleIndex >= this.vehicles.length) {
      this.stopPosting();
      document.getElementById('status').textContent = 'All vehicles posted!';
      return;
    }

    const vehicle = this.vehicles[this.currentVehicleIndex];
    const statusEl = document.getElementById('status');
    
    // Helper function to convert to title case
    const toTitleCase = (str) => {
      if (!str) return str;
      return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    };
    
    statusEl.textContent = `Posting vehicle ${this.currentVehicleIndex + 1}/${this.vehicles.length}: ${vehicle.year} ${vehicle.make} ${toTitleCase(vehicle.model)}`;

    try {
      // Send vehicle data to content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // First, try to ping the content script to see if it's loaded
      chrome.tabs.sendMessage(tab.id, { action: 'ping' }, async (pingResponse) => {
        if (chrome.runtime.lastError) {
          console.log('Content script not loaded, attempting to inject...');
          
          // Try to inject the content script manually
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            
            // Wait a moment for the script to initialize
            setTimeout(() => {
              this.sendVehicleToContentScript(tab.id, vehicle, statusEl);
            }, 1000);
          } catch (injectError) {
            console.error('Failed to inject content script:', injectError);
            statusEl.textContent = 'Error: Could not load automation script. Please refresh Facebook page.';
            this.stopPosting();
          }
        } else {
          // Content script is loaded, proceed with posting
          this.sendVehicleToContentScript(tab.id, vehicle, statusEl);
        }
      });

    } catch (error) {
      console.error('Error posting vehicle:', error);
      statusEl.textContent = `Error: ${error.message}`;
      this.stopPosting();
    }
  }

  sendVehicleToContentScript(tabId, vehicle, statusEl) {
    chrome.tabs.sendMessage(tabId, {
      action: 'postVehicle',
      vehicle: vehicle
    }, (response) => {
      if (chrome.runtime.lastError) {
        const errorMessage = chrome.runtime.lastError.message || JSON.stringify(chrome.runtime.lastError);
        console.error('Error posting vehicle:', errorMessage);
        statusEl.textContent = `Error: ${errorMessage}`;
        this.stopPosting();
        return;
      }

      console.log('Vehicle posting response:', response);

      if (response && response.success) {
        console.log(`Successfully posted vehicle ${this.currentVehicleIndex + 1}/${this.vehicles.length}`);
        statusEl.textContent = `Posted vehicle ${this.currentVehicleIndex + 1}/${this.vehicles.length}`;
        
        this.currentVehicleIndex++;
        const delay = parseInt(document.getElementById('delay').value) * 1000;
        
        // Check if there are more vehicles to post
        if (this.currentVehicleIndex < this.vehicles.length) {
          statusEl.textContent = `Waiting ${delay/1000}s before next vehicle...`;
          
          // Wait before posting next vehicle
          setTimeout(() => {
            if (this.isPosting) {
              this.postNextVehicle();
            }
          }, delay);
        } else {
          // All vehicles posted
          statusEl.textContent = 'All vehicles posted successfully!';
          this.stopPosting();
        }
      } else {
        console.error('Failed to post vehicle:', response?.error || 'Unknown error');
        statusEl.textContent = `Failed: ${response?.error || 'Unknown error'}`;
        this.stopPosting();
      }
    });
  }

  async saveSettings() {
    const settings = {
      delay: document.getElementById('delay').value
    };
    
    await chrome.storage.sync.set(settings);
  }

  async logout() {
    await chrome.storage.sync.remove(['userToken', 'userEmail']);
    await this.checkAuthentication();
  }

  // Pre-download all vehicle images when vehicles are fetched
  async preDownloadAllImages() {
    try {
      console.log('Pre-downloading images for all vehicles...');
      
      const allImageUrls = [];
      this.vehicles.forEach(vehicle => {
        if (vehicle.images && Array.isArray(vehicle.images)) {
          allImageUrls.push(...vehicle.images);
        }
      });
      
      if (allImageUrls.length === 0) {
        console.log('No images to pre-download');
        return;
      }
      
      console.log(`Pre-downloading ${allImageUrls.length} images...`);
      
      // Use background script to pre-download images
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'preDownloadImages',
          images: allImageUrls
        }, resolve);
      });
      
      if (response && response.success) {
        console.log(`✅ Pre-downloaded ${response.successCount}/${response.totalCount} images`);
      } else {
        console.log('⚠️ Image pre-download failed:', response?.error);
      }
      
    } catch (error) {
      console.error('Error pre-downloading images:', error);
    }
  }
}

// Initialize extension when popup opens
document.addEventListener('DOMContentLoaded', () => {
  new SalesonatorExtension();
});
