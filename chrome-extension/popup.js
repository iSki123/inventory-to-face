class SalesonatorExtension {
  constructor() {
    this.isPosting = false;
    this.vehicles = [];
    this.currentVehicleIndex = 0;
    this.isMapping = false;
    this.currentFieldIndex = 0;
    this.fieldQueue = ['vehicle-type', 'year', 'make', 'model', 'mileage', 'price', 'description'];
    this.fieldLabels = {
      'vehicle-type': '🚗 Vehicle Type',
      'year': '📅 Year', 
      'make': '🏭 Make',
      'model': '🚙 Model',
      'mileage': '📏 Mileage',
      'price': '💰 Price',
      'description': '📝 Description'
    };
    this.init();
  }

  async init() {
    console.log('Initializing Salesonator Extension...');
    
    // Load saved settings
    const settings = await chrome.storage.sync.get(['delay', 'userToken']);
    
    if (settings.delay) {
      document.getElementById('delay').value = settings.delay;
    }

    // Set up tab switching
    this.setupTabs();
    
    // Set up event listeners for posting tab
    document.getElementById('fetchVehicles').addEventListener('click', () => this.fetchVehicles());
    document.getElementById('startPosting').addEventListener('click', () => this.startPosting());
    document.getElementById('stopPosting').addEventListener('click', () => this.stopPosting());
    document.getElementById('delay').addEventListener('change', () => this.saveSettings());
    
    // Set up event listeners for mapping tab
    document.getElementById('startMapping').addEventListener('click', () => this.startMapping());
    document.getElementById('stopMapping').addEventListener('click', () => this.stopMapping());
    document.getElementById('clearMappings').addEventListener('click', () => this.clearMappings());
    
    // Load saved mappings
    await this.loadSavedMappings();
    
    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'FIELD_MAPPED') {
        this.handleFieldMapped(message.fieldName, message.selector);
      }
    });

    // Check authentication and connection
    await this.checkWebAppAuthentication();
    this.checkConnection();
  }

  setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Remove active class from all tabs
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.style.display = 'none');
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Show corresponding content
        const tabName = tab.dataset.tab;
        const content = document.getElementById(`${tabName}-tab`);
        if (content) {
          content.style.display = 'block';
        }
      });
    });
  }

  async loadSavedMappings() {
    try {
      const result = await chrome.storage.local.get(['fieldMappings']);
      const mappings = result.fieldMappings || {};
      
      let mappedCount = 0;
      for (const [fieldName, selector] of Object.entries(mappings)) {
        this.updateFieldDisplay(fieldName, selector);
        mappedCount++;
      }
      
      const statusEl = document.getElementById('mappingStatus');
      statusEl.textContent = mappedCount > 0 
        ? `✅ ${mappedCount} fields mapped` 
        : 'No mappings saved';
    } catch (error) {
      console.error('Error loading mappings:', error);
    }
  }

  updateFieldDisplay(fieldName, selector) {
    const fieldElement = document.getElementById(`${fieldName}-field`);
    if (fieldElement) {
      const selectorSpan = fieldElement.querySelector('.field-selector');
      selectorSpan.textContent = selector || 'Not mapped';
      
      if (selector) {
        fieldElement.classList.add('mapped');
        fieldElement.classList.remove('pending');
      } else {
        fieldElement.classList.remove('mapped', 'pending');
      }
    }
  }

  async startMapping() {
    try {
      this.isMapping = true;
      this.currentFieldIndex = 0;
      
      document.getElementById('startMapping').style.display = 'none';
      document.getElementById('stopMapping').style.display = 'block';
      document.getElementById('mappingProgress').style.display = 'block';
      
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('facebook.com/marketplace')) {
        this.showStatus('Please navigate to Facebook Marketplace vehicle creation page first', 'disconnected');
        this.stopMapping();
        return;
      }
      
      // Send message to start mapping in content script
      chrome.tabs.sendMessage(tab.id, { action: 'startFieldMapping' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error starting mapping:', chrome.runtime.lastError);
          this.showStatus('Error: Could not communicate with Facebook page. Try refreshing.', 'disconnected');
          this.stopMapping();
        } else {
          this.nextField();
          this.showStatus('🎯 Field mapping started! Follow the instructions.', 'connected');
        }
      });
      
    } catch (error) {
      console.error('Error starting mapping:', error);
      this.showStatus('Error starting mapping: ' + error.message, 'disconnected');
      this.stopMapping();
    }
  }

  async stopMapping() {
    try {
      this.isMapping = false;
      this.currentFieldIndex = 0;
      
      document.getElementById('startMapping').style.display = 'block';
      document.getElementById('stopMapping').style.display = 'none';
      document.getElementById('mappingProgress').style.display = 'none';
      
      // Get active tab and send stop message
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      chrome.tabs.sendMessage(tab.id, { action: 'stopFieldMapping' }, () => {
        // Ignore errors here since tab might be closed
      });
      
      // Remove pending status from all fields
      document.querySelectorAll('.field-item').forEach(item => {
        item.classList.remove('pending');
      });
      
      this.showStatus('🛑 Field mapping stopped', 'warning');
      
    } catch (error) {
      console.error('Error stopping mapping:', error);
    }
  }

  nextField() {
    if (!this.isMapping || this.currentFieldIndex >= this.fieldQueue.length) {
      this.stopMapping();
      this.showStatus('✅ Field mapping completed!', 'connected');
      this.loadSavedMappings(); // Refresh the mapping display
      return;
    }
    
    const fieldName = this.fieldQueue[this.currentFieldIndex];
    const fieldLabel = this.fieldLabels[fieldName];
    const fieldElement = document.getElementById(`${fieldName}-field`);
    
    // Remove pending from all fields
    document.querySelectorAll('.field-item').forEach(item => {
      item.classList.remove('pending');
    });
    
    // Add pending to current field
    fieldElement.classList.add('pending');
    
    // Update progress display
    const progressEl = document.getElementById('mappingProgress');
    progressEl.textContent = `Step ${this.currentFieldIndex + 1}/${this.fieldQueue.length}: Click on the ${fieldLabel} field on Facebook`;
    
    // Send message to content script about current field
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'setCurrentField',
        fieldName: fieldName,
        fieldLabel: fieldLabel
      }, () => {
        // Ignore errors if tab is not ready
      });
    });
  }

  handleFieldMapped(fieldName, selector) {
    console.log('Field mapped:', fieldName, selector);
    
    if (selector === null) {
      // Field was skipped
      console.log('Field skipped:', fieldName);
    } else {
      // Field was mapped
      this.updateFieldDisplay(fieldName, selector);
    }
    
    this.currentFieldIndex++;
    setTimeout(() => {
      if (this.isMapping) {
        this.nextField();
      }
    }, 1500); // Give more time for user to see the result
  }

  async clearMappings() {
    try {
      await chrome.storage.local.remove(['fieldMappings']);
      
      // Update UI
      document.querySelectorAll('.field-item').forEach(item => {
        const selectorSpan = item.querySelector('.field-selector');
        selectorSpan.textContent = 'Not mapped';
        item.classList.remove('mapped', 'pending');
      });
      
      document.getElementById('mappingStatus').textContent = 'No mappings saved';
      this.showStatus('🗑️ All mappings cleared', 'warning');
      
    } catch (error) {
      console.error('Error clearing mappings:', error);
      this.showStatus('Error clearing mappings: ' + error.message, 'disconnected');
    }
  }

  // Web app authentication (keep existing logic)
  async checkWebAppAuthentication() {
    try {
      console.log('Checking for web app authentication...');
      
      const allTabs = await chrome.tabs.query({});
      
      for (const tab of allTabs) {
        if (tab.url && 
            (tab.url.includes('lovableproject.com') || 
             tab.url.includes('localhost:3000') ||
             tab.url.includes('salesonator') ||
             tab.url.includes('inventory-to-face'))) {
          
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                const allKeys = Object.keys(localStorage);
                const authKeys = allKeys.filter(key => 
                  (key.startsWith('sb-') && key.includes('auth-token')) ||
                  key.includes('supabase.auth.token') ||
                  key.includes('auth-token')
                );
                
                for (const authKey of authKeys) {
                  const authData = localStorage.getItem(authKey);
                  if (authData) {
                    try {
                      const parsed = JSON.parse(authData);
                      if (parsed.access_token && parsed.user) {
                        return {
                          token: parsed.access_token,
                          user: parsed.user,
                          expires_at: parsed.expires_at
                        };
                      }
                    } catch (e) {
                      continue;
                    }
                  }
                }
                return null;
              }
            });
            
            const authData = results[0]?.result;
            
            if (authData && authData.token) {
              // Verify user role
              const profileUrl = `https://urdkaedsfnscgtyvcwlf.supabase.co/rest/v1/profiles?select=role&user_id=eq.${authData.user.id}`;
              const response = await fetch(profileUrl, {
                headers: {
                  'Authorization': `Bearer ${authData.token}`,
                  'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
                }
              });
              
              if (response.ok) {
                const profileData = await response.json();
                const userRole = profileData[0]?.role;
                
                if (userRole === 'Owner' || userRole === 'Manager' || userRole === 'Admin' || userRole === 'admin') {
                  await chrome.storage.sync.set({ userToken: authData.token });
                  this.showStatus('✅ Auto-authenticated via Salesonator web app!', 'connected');
                  return;
                }
              }
            }
          } catch (error) {
            continue;
          }
        }
      }
      
      this.showStatus('❌ Please log in to Salesonator first', 'disconnected');
    } catch (error) {
      console.warn('Error checking web app authentication:', error);
      this.showStatus('❌ Authentication check failed', 'disconnected');
    }
  }

  async checkConnection() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isFacebook = tab.url.includes('facebook.com');
      
      if (!isFacebook) {
        this.showStatus('📍 Please navigate to Facebook Marketplace', 'warning');
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: 'checkLogin' }, (response) => {
        if (chrome.runtime.lastError) {
          this.showStatus('📍 Please navigate to Facebook Marketplace', 'warning');
        } else if (response && response.loggedIn) {
          this.showStatus('✅ Connected to Facebook', 'connected');
        } else {
          this.showStatus('🔑 Please log in to Facebook', 'disconnected');
        }
      });
      
    } catch (error) {
      this.showStatus('❌ Connection error', 'disconnected');
    }
  }

  async fetchVehicles() {
    try {
      this.showStatus('🔄 Fetching vehicles...', 'warning');
      
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
        document.getElementById('vehicleCount').textContent = `📊 ${this.vehicles.length} vehicles ready to post`;
        document.getElementById('startPosting').disabled = this.vehicles.length === 0;
        this.showStatus('✅ Vehicles loaded successfully', 'connected');
      } else {
        throw new Error(data.error || 'Failed to fetch vehicles');
      }

    } catch (error) {
      console.error('Error fetching vehicles:', error);
      this.showStatus(`❌ Error: ${error.message}`, 'disconnected');
      document.getElementById('vehicleCount').textContent = 'Failed to load vehicles';
      document.getElementById('startPosting').disabled = true;
    }
  }

  async startPosting() {
    if (this.vehicles.length === 0) {
      alert('No vehicles to post. Please fetch vehicles first.');
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('facebook.com')) {
      alert('Please navigate to Facebook first.');
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
    
    this.showStatus('⏹️ Posting stopped', 'warning');
  }

  async postNextVehicle() {
    if (!this.isPosting || this.currentVehicleIndex >= this.vehicles.length) {
      this.stopPosting();
      this.showStatus('🎉 All vehicles posted!', 'connected');
      return;
    }

    const vehicle = this.vehicles[this.currentVehicleIndex];
    this.showStatus(`📤 Posting ${this.currentVehicleIndex + 1}/${this.vehicles.length}: ${vehicle.year} ${vehicle.make} ${vehicle.model}`, 'warning');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      chrome.tabs.sendMessage(tab.id, { action: 'ping' }, async (pingResponse) => {
        if (chrome.runtime.lastError) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            
            setTimeout(() => {
              this.sendVehicleToContentScript(tab.id, vehicle);
            }, 1000);
          } catch (injectError) {
            console.error('Failed to inject content script:', injectError);
            this.showStatus('❌ Could not load automation script. Please refresh Facebook page.', 'disconnected');
            this.stopPosting();
          }
        } else {
          this.sendVehicleToContentScript(tab.id, vehicle);
        }
      });
      
    } catch (error) {
      console.error('Error posting vehicle:', error);
      this.showStatus(`❌ Error posting: ${error.message}`, 'disconnected');
      this.currentVehicleIndex++;
      setTimeout(() => this.postNextVehicle(), 5000);
    }
  }

  sendVehicleToContentScript(tabId, vehicle) {
    chrome.tabs.sendMessage(tabId, {
      action: 'postVehicle',
      vehicle: vehicle
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending vehicle to content script:', chrome.runtime.lastError);
        this.showStatus('❌ Communication error with Facebook page', 'disconnected');
      } else if (response && response.success) {
        this.showStatus('✅ Vehicle posted successfully!', 'connected');
      } else {
        this.showStatus(`❌ Posting failed: ${response?.error || 'Unknown error'}`, 'disconnected');
      }
      
      this.currentVehicleIndex++;
      const delay = parseInt(document.getElementById('delay').value) * 1000;
      setTimeout(() => this.postNextVehicle(), delay);
    });
  }

  async saveSettings() {
    const delay = document.getElementById('delay').value;
    await chrome.storage.sync.set({ delay: parseInt(delay) });
  }

  showStatus(message, type = 'connected') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }

  // Functions to inject into content script for mapping
  initFieldMapping() {
    console.log('🎯 Field mapping mode activated');
    window.currentMappingField = null;
    
    // Add visual indicator
    const indicator = document.createElement('div');
    indicator.id = 'salesonator-mapping-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #1877f2, #166fe5);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(24, 119, 242, 0.3);
      border: 2px solid rgba(255, 255, 255, 0.2);
    `;
    indicator.innerHTML = '🎯 <strong>Field Mapping Mode</strong><br><small>Click on fields to map them</small>';
    document.body.appendChild(indicator);
    
    // Add click listener for field mapping
    document.addEventListener('click', window.handleFieldClick, true);
    
    // Listen for field updates from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'setCurrentField') {
        window.currentMappingField = message.fieldName;
        indicator.innerHTML = `🎯 <strong>Mapping: ${message.fieldLabel}</strong><br><small>Click on this field now!</small>`;
      }
    });
  }

  stopFieldMapping() {
    console.log('🎯 Field mapping mode deactivated');
    
    // Remove indicator
    const indicator = document.getElementById('salesonator-mapping-indicator');
    if (indicator) {
      indicator.remove();
    }
    
    // Remove click listener
    document.removeEventListener('click', window.handleFieldClick, true);
    window.currentMappingField = null;
  }
}

// Global function for field click handling (needs to be global for event listener)
window.handleFieldClick = function(event) {
  if (!window.currentMappingField) return;
  
  event.preventDefault();
  event.stopPropagation();
  
  const element = event.target;
  const selector = getElementSelector(element);
  
  console.log('🎯 Field clicked:', element, 'Selector:', selector);
  
  // Highlight the clicked element briefly
  const originalStyle = element.style.cssText;
  element.style.cssText += 'border: 3px solid #28a745 !important; background-color: rgba(40, 167, 69, 0.1) !important;';
  
  setTimeout(() => {
    element.style.cssText = originalStyle;
  }, 1000);
  
  // Send mapping info back to popup
  chrome.runtime.sendMessage({
    type: 'FIELD_MAPPED',
    fieldName: window.currentMappingField,
    selector: selector
  });
  
  // Save to storage
  saveFieldMapping(window.currentMappingField, selector);
};

function getElementSelector(element) {
  const selectors = [];
  
  // XPath
  const xpath = getXPath(element);
  if (xpath) selectors.push(`xpath:${xpath}`);
  
  // ID
  if (element.id) {
    selectors.push(`#${element.id}`);
  }
  
  // Class-based
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(c => c.trim());
    if (classes.length > 0) {
      selectors.push(`.${classes.join('.')}`);
    }
  }
  
  // Attribute-based
  const attrs = ['aria-label', 'data-testid', 'name', 'placeholder', 'role'];
  for (const attr of attrs) {
    const value = element.getAttribute(attr);
    if (value) {
      selectors.push(`[${attr}="${value}"]`);
    }
  }
  
  // Text-based
  if (element.textContent && element.textContent.trim()) {
    const text = element.textContent.trim();
    if (text.length < 50) {
      selectors.push(`text:${text}`);
    }
  }
  
  return selectors[0] || element.tagName.toLowerCase();
}

function getXPath(element) {
  if (element === document.body) return '/html/body';
  
  let ix = 0;
  const siblings = element.parentNode ? element.parentNode.childNodes : [];
  
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    if (sibling === element) {
      const parentPath = element.parentNode ? getXPath(element.parentNode) : '';
      return `${parentPath}/${element.tagName.toLowerCase()}[${ix + 1}]`;
    }
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
      ix++;
    }
  }
}

async function saveFieldMapping(fieldName, selector) {
  try {
    const result = await chrome.storage.local.get(['fieldMappings']);
    const mappings = result.fieldMappings || {};
    mappings[fieldName] = selector;
    await chrome.storage.local.set({ fieldMappings: mappings });
    console.log(`💾 Saved mapping for ${fieldName}:`, selector);
  } catch (error) {
    console.error('Error saving field mapping:', error);
  }
}

// Initialize the extension
document.addEventListener('DOMContentLoaded', () => {
  window.salesonatorExtension = new SalesonatorExtension();
});
