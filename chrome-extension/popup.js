
class SalesonatorExtension {
  constructor() {
    this.isPosting = false;
    this.vehicles = [];
    this.currentVehicleIndex = 0;
    this.init();
  }

  async init() {
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

    // Check authentication status
    await this.checkAuthentication();
    
    // Check connection status
    this.checkConnection();
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
        statusEl.textContent = 'Vehicles loaded successfully';
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
    statusEl.textContent = `Posting vehicle ${this.currentVehicleIndex + 1}/${this.vehicles.length}: ${vehicle.year} ${vehicle.make} ${vehicle.model}`;

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
}

// Initialize extension when popup opens
document.addEventListener('DOMContentLoaded', () => {
  new SalesonatorExtension();
});
