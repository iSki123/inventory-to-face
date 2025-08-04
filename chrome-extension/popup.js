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

    // Check connection status
    this.checkConnection();
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
      
      // Get user token from storage (you'll need to implement auth)
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
    }
  }

  async startPosting() {
    if (this.vehicles.length === 0) {
      alert('No vehicles to post. Please fetch vehicles first.');
      return;
    }

    // Check if we're on the right page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url.includes('facebook.com/marketplace')) {
      alert('Please navigate to Facebook Marketplace before starting.');
      return;
    }

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
      
      chrome.tabs.sendMessage(tab.id, {
        action: 'postVehicle',
        vehicle: vehicle
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error posting vehicle:', chrome.runtime.lastError);
          statusEl.textContent = 'Error communicating with page';
          this.stopPosting();
          return;
        }

        if (response && response.success) {
          this.currentVehicleIndex++;
          const delay = parseInt(document.getElementById('delay').value) * 1000;
          
          // Wait before posting next vehicle
          setTimeout(() => {
            if (this.isPosting) {
              this.postNextVehicle();
            }
          }, delay);
        } else {
          console.error('Failed to post vehicle:', response?.error);
          statusEl.textContent = `Failed to post: ${response?.error || 'Unknown error'}`;
          this.stopPosting();
        }
      });

    } catch (error) {
      console.error('Error posting vehicle:', error);
      statusEl.textContent = `Error: ${error.message}`;
      this.stopPosting();
    }
  }

  async saveSettings() {
    const settings = {
      delay: document.getElementById('delay').value
    };
    
    await chrome.storage.sync.set(settings);
  }
}

// Initialize extension when popup opens
document.addEventListener('DOMContentLoaded', () => {
  new SalesonatorExtension();
});