// Enhanced Facebook Marketplace Automation with Field Mapping
// Implements React-native value setting, MutationObserver, keyboard simulation, and human-like behavior

class SalesonatorAutomator {
  constructor() {
    this.retryAttempts = 3;
    this.baseDelay = 1000;
    this.isActive = false;
    this.fieldMappings = null;
    this.currentMappingField = null;
    this.loadFieldMappings();
  }

  // Load saved field mappings
  async loadFieldMappings() {
    try {
      const result = await chrome.storage.local.get(['fieldMappings']);
      this.fieldMappings = result.fieldMappings || {};
      this.log('🎯 Loaded field mappings:', this.fieldMappings);
    } catch (error) {
      this.log('⚠️ Could not load field mappings:', error);
      this.fieldMappings = {};
    }
  }

  // Get selector for a field using saved mappings or fallback
  getFieldSelector(fieldName) {
    const mapping = this.fieldMappings[fieldName];
    if (mapping) {
      this.log(`🎯 Using saved mapping for ${fieldName}:`, mapping);
      return [mapping];
    }
    
    // Return default selectors if no mapping
    const defaultSelectors = {
      'vehicle-type': ['text:Vehicle type', '[aria-label*="Vehicle type"]', 'form div[role="button"]:first-of-type'],
      'year': ['text:Year', '[aria-label*="Year"]', 'div[role="button"]'],
      'make': ['text:Make', '[aria-label*="Make"]', 'div[role="button"]'],
      'model': ['[aria-label*="Model"]', 'input[placeholder*="Model"]'],
      'mileage': ['[aria-label*="Mileage"]', 'input[placeholder*="Mileage"]'],
      'price': ['[aria-label*="Price"]', 'input[placeholder*="Price"]'],
      'description': ['[aria-label*="Description"]', 'textarea', '[role="textbox"]']
    };
    
    return defaultSelectors[fieldName] || [];
  }

  // Utility function for randomized delays (human-like behavior)
  randomDelay(min = 300, max = 900) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Enhanced delay function with exponential backoff
  async delay(ms, attempt = 0) {
    const backoffMultiplier = Math.pow(1.5, attempt);
    const actualDelay = ms * backoffMultiplier + this.randomDelay(50, 200);
    return new Promise(resolve => setTimeout(resolve, actualDelay));
  }

  // React-native value setter that forces React to recognize changes
  setNativeValue(element, value) {
    const descriptor = Object.getOwnPropertyDescriptor(element.__proto__, 'value') ||
                     Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
    
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    
    // Trigger React's synthetic events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Enhanced element detection with MutationObserver
  waitForElement(selectors, timeout = 10000, parentElement = document) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      // Try immediate selection first
      const immediateElement = this.findElementWithFallbacks(selectors, parentElement);
      if (immediateElement) {
        this.log('Element found immediately:', selectors[0]);
        return resolve(immediateElement);
      }

      // Set up MutationObserver for dynamic detection
      const observer = new MutationObserver(() => {
        const element = this.findElementWithFallbacks(selectors, parentElement);
        if (element) {
          observer.disconnect();
          this.log('Element found via MutationObserver:', selectors[0]);
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          observer.disconnect();
          reject(new Error(`Timeout waiting for element: ${selectors.join(', ')}`));
        }
      });

      observer.observe(parentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: true
      });

      // Fallback timeout
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for element: ${selectors.join(', ')}`));
      }, timeout);
    });
  }

  // Robust selector strategy with multiple fallbacks
  findElementWithFallbacks(selectors, parentElement = document) {
    for (const selector of selectors) {
      try {
        // XPath selector
        if (selector.startsWith('xpath:')) {
          const xpath = selector.replace('xpath:', '');
          const result = document.evaluate(xpath, parentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          if (result.singleNodeValue) return result.singleNodeValue;
        }
        
        // ARIA label selector
        else if (selector.startsWith('aria:')) {
          const ariaLabel = selector.replace('aria:', '');
          const element = parentElement.querySelector(`[aria-label*="${ariaLabel}"]`);
          if (element) return element;
        }
        
        // Placeholder selector
        else if (selector.startsWith('placeholder:')) {
          const placeholder = selector.replace('placeholder:', '');
          const element = parentElement.querySelector(`[placeholder*="${placeholder}"]`);
          if (element) return element;
        }
        
        // Role selector
        else if (selector.startsWith('role:')) {
          const role = selector.replace('role:', '');
          const element = parentElement.querySelector(`[role="${role}"]`);
          if (element) return element;
        }
        
        // Text content selector (XPath)
        else if (selector.startsWith('text:')) {
          const text = selector.replace('text:', '');
          const xpath = `.//*[contains(text(), "${text}")]`;
          const result = document.evaluate(xpath, parentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          if (result.singleNodeValue) return result.singleNodeValue;
        }
        
        // Regular CSS selector
        else {
          const element = parentElement.querySelector(selector);
          if (element) return element;
        }
        
      } catch (error) {
        this.log('Selector failed:', selector, error);
        continue;
      }
    }
    return null;
  }

  // Enhanced scroll into view with human-like behavior
  async scrollIntoView(element) {
    if (!element) return;
    
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'center'
    });
    
    await this.delay(this.randomDelay(300, 600));
  }

  // Enhanced human-like typing simulation
  async typeHumanLike(element, text, speed = 'normal') {
    await this.scrollIntoView(element);
    await this.delay(this.randomDelay(200, 500));
    
    element.focus();
    await this.delay(this.randomDelay(100, 300));
    
    // Clear existing content safely
    element.value = '';
    await this.delay(this.randomDelay(50, 150));
    
    const speedMultipliers = {
      slow: [100, 250],
      normal: [50, 150],
      fast: [30, 80]
    };
    
    const [minDelay, maxDelay] = speedMultipliers[speed] || speedMultipliers.normal;
    
    // Type character by character with random delays
    for (let i = 0; i < text.length; i++) {
      const currentValue = element.value + text[i];
      this.setNativeValue(element, currentValue);
      
      // Add realistic typing variations
      if (Math.random() < 0.1) {
        await this.delay(this.randomDelay(200, 600));
      } else {
        await this.delay(this.randomDelay(minDelay, maxDelay));
      }
    }
    
    // Final events
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    await this.delay(this.randomDelay(100, 300));
  }

  // Main posting workflow
  async postVehicle(vehicleData) {
    try {
      this.log('🚗 Starting enhanced vehicle posting process...', vehicleData);
      
      for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
        try {
          await this.navigateToMarketplace();
          await this.delay(2000, attempt);
          
          await this.fillVehicleForm(vehicleData);
          await this.delay(1000, attempt);
          
          const success = await this.submitListing();
          
          if (success) {
            this.log('✅ Vehicle posted successfully');
            return { success: true };
          }
          
        } catch (error) {
          this.log(`❌ Attempt ${attempt + 1} failed:`, error);
          
          if (attempt < this.retryAttempts - 1) {
            this.log(`🔄 Retrying in ${2 ** attempt} seconds...`);
            await this.delay(2000 * (2 ** attempt));
          }
        }
      }
      
      throw new Error('All retry attempts failed');
      
    } catch (error) {
      this.log('❌ Vehicle posting failed completely:', error);
      return { success: false, error: error.message };
    }
  }

  // Navigation
  async navigateToMarketplace() {
    const currentUrl = window.location.href;
    this.log('📍 Current URL:', currentUrl);
    
    if (currentUrl.includes('facebook.com/marketplace/create/vehicle')) {
      this.log('✅ Already on vehicle creation page');
      return;
    }
    
    if (!currentUrl.includes('facebook.com/marketplace')) {
      this.log('🧭 Navigating to Facebook Marketplace...');
      window.location.href = 'https://www.facebook.com/marketplace/create/vehicle';
      await this.delay(5000);
    }
  }

  // Enhanced form filling using saved mappings
  async fillVehicleForm(vehicleData) {
    this.log('📝 Filling vehicle form with enhanced automation...');
    
    await this.selectVehicleType();
    await this.selectYear(vehicleData.year);
    await this.selectMake(vehicleData.make);
    await this.fillModel(vehicleData.model);
    
    if (vehicleData.mileage) {
      await this.fillMileage(vehicleData.mileage);
    }
    
    await this.fillPrice(vehicleData.price);
    
    const description = vehicleData.description || `${vehicleData.year} ${vehicleData.make} ${vehicleData.model} for sale. Contact for more details.`;
    await this.fillDescription(description);
    
    this.log('✅ Form filling sequence completed');
  }

  // Vehicle type dropdown selection
  async selectVehicleType() {
    try {
      this.log('🚗 Selecting vehicle type dropdown...');
      
      const vehicleDropdownSelectors = this.getFieldSelector('vehicle-type');
      
      await this.delay(2000);
      
      const dropdown = await this.waitForElement(vehicleDropdownSelectors, 10000);
      await this.scrollIntoView(dropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      this.log('📝 Found vehicle type dropdown, clicking...');
      dropdown.click();
      await this.delay(this.randomDelay(2000, 3000));
      
      const carTruckSelectors = [
        'text:Car/Truck',
        'text:Car',
        '[data-value*="car"]',
        '[role="option"]'
      ];
      
      const option = await this.waitForElement(carTruckSelectors, 5000);
      await this.scrollIntoView(option);
      await this.delay(this.randomDelay(300, 600));
      option.click();
      
      await this.delay(this.randomDelay(2000, 3000));
      this.log('✅ Successfully selected vehicle type');
      return true;
      
    } catch (error) {
      this.log('⚠️ Could not select vehicle type:', error);
      return false;
    }
  }

  // Select Year dropdown using saved mappings
  async selectYear(year) {
    try {
      this.log(`🗓️ Selecting year: ${year}`);
      
      const yearDropdownSelectors = this.getFieldSelector('year');
      
      const yearDropdown = await this.waitForElement(yearDropdownSelectors, 8000);
      await this.scrollIntoView(yearDropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      this.log('📅 Found year dropdown, clicking to open...');
      yearDropdown.click();
      await this.delay(this.randomDelay(2000, 3000));
      
      const yearOptionSelectors = [
        `text:${year}`,
        `//div[text()="${year}"]`,
        `//span[text()="${year}"]`,
        `//*[text()="${year}"]`,
        `[data-value="${year}"]`
      ];
      
      let yearOption = null;
      for (const selector of yearOptionSelectors) {
        try {
          this.log(`📅 Trying selector: ${selector}`);
          yearOption = await this.waitForElement([selector], 2000);
          if (yearOption) {
            this.log(`📅 Found year option with selector: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!yearOption) {
        const allOptions = document.querySelectorAll('[role="option"], div[data-value], .option, li');
        for (const option of allOptions) {
          if (option.textContent && option.textContent.trim() === year.toString()) {
            yearOption = option;
            this.log(`📅 Found year option via fallback: ${option.textContent}`);
            break;
          }
        }
      }
      
      if (yearOption) {
        await this.scrollIntoView(yearOption);
        await this.delay(this.randomDelay(300, 600));
        yearOption.click();
        await this.delay(this.randomDelay(2000, 3000));
        this.log(`✅ Successfully selected year: ${year}`);
        return true;
      } else {
        this.log(`❌ Could not find year option: ${year}`);
        return false;
      }
      
    } catch (error) {
      this.log(`⚠️ Could not select year: ${year}`, error);
      return false;
    }
  }

  // Select Make dropdown using saved mappings
  async selectMake(make) {
    try {
      this.log(`🏭 Selecting make: ${make}`);
      
      const cleanMake = make.trim();
      const makeDropdownSelectors = this.getFieldSelector('make');
      
      const makeDropdown = await this.waitForElement(makeDropdownSelectors, 8000);
      await this.scrollIntoView(makeDropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      this.log('🏭 Found make dropdown, clicking to open...');
      makeDropdown.click();
      await this.delay(this.randomDelay(2000, 3000));
      
      const makeOptionSelectors = [
        `text:${cleanMake}`,
        `text:${cleanMake.trim()}`,
        `[data-value*="${cleanMake.toLowerCase()}"]`,
        `[role="option"]`
      ];
      
      const makeOption = await this.waitForElement(makeOptionSelectors, 5000);
      await this.scrollIntoView(makeOption);
      await this.delay(this.randomDelay(300, 600));
      makeOption.click();
      
      await this.delay(this.randomDelay(2000, 3000));
      this.log(`✅ Successfully selected make: ${cleanMake}`);
      return true;
      
    } catch (error) {
      this.log(`⚠️ Could not select make: ${make}`, error);
      return false;
    }
  }

  // Fill Model input using saved mappings
  async fillModel(model) {
    try {
      this.log(`🚗 Filling model: ${model}`);
      
      const modelInputSelectors = this.getFieldSelector('model');
      
      const modelInput = await this.waitForElement(modelInputSelectors, 8000);
      await this.scrollIntoView(modelInput);
      await this.typeHumanLike(modelInput, model);
      
      this.log(`✅ Successfully filled model: ${model}`);
      return true;
    } catch (error) {
      this.log(`⚠️ Could not fill model: ${model}`, error);
      return false;
    }
  }

  // Fill Mileage input using saved mappings
  async fillMileage(mileage) {
    try {
      this.log(`📏 Filling mileage: ${mileage}`);
      
      const mileageInputSelectors = this.getFieldSelector('mileage');
      
      const mileageInput = await this.waitForElement(mileageInputSelectors, 8000);
      await this.scrollIntoView(mileageInput);
      await this.typeHumanLike(mileageInput, mileage.toString());
      
      this.log(`✅ Successfully filled mileage: ${mileage}`);
      return true;
    } catch (error) {
      this.log(`⚠️ Could not fill mileage: ${mileage}`, error);
      return false;
    }
  }

  // Fill Price input using saved mappings
  async fillPrice(price) {
    try {
      this.log(`💰 Filling price: ${price}`);
      
      const priceInputSelectors = this.getFieldSelector('price');
      
      const priceInput = await this.waitForElement(priceInputSelectors, 8000);
      await this.scrollIntoView(priceInput);
      await this.typeHumanLike(priceInput, price.toString());
      
      this.log(`✅ Successfully filled price: ${price}`);
      return true;
    } catch (error) {
      this.log(`⚠️ Could not fill price: ${price}`, error);
      return false;
    }
  }

  // Fill Description textarea using saved mappings
  async fillDescription(description) {
    try {
      this.log(`📝 Filling description: ${description}`);
      
      const descriptionInputSelectors = this.getFieldSelector('description');
      
      const descriptionInput = await this.waitForElement(descriptionInputSelectors, 5000);
      await this.scrollIntoView(descriptionInput);
      await this.typeHumanLike(descriptionInput, description);
      
      this.log(`✅ Successfully filled description`);
      return true;
    } catch (error) {
      this.log(`⚠️ Could not fill description`, error);
      return false;
    }
  }

  // Submit listing
  async submitListing() {
    try {
      this.log('🚀 Submitting listing...');
      
      const submitSelectors = [
        'aria:Next',
        'aria:Post',
        'text:Next',
        'text:Post',
        'button[type="submit"]',
        '[data-testid*="submit"]'
      ];
      
      const submitButton = await this.waitForElement(submitSelectors, 10000);
      await this.scrollIntoView(submitButton);
      await this.delay(this.randomDelay(1000, 2000));
      
      submitButton.click();
      await this.delay(3000);
      
      this.log('✅ Listing submitted');
      return true;
      
    } catch (error) {
      this.log('❌ Submission failed:', error);
      return false;
    }
  }

  // Handle messages from popup
  async handleMessage(message, sender, sendResponse) {
    this.log('📨 Received message:', message);
    
    try {
      switch (message.action) {
        case 'ping':
          sendResponse({ success: true, message: 'Content script is active' });
          break;
          
        case 'postVehicle':
          const result = await this.postVehicle(message.vehicle);
          sendResponse(result);
          break;
          
        case 'checkLogin':
          const isLoggedIn = this.checkFacebookLogin();
          sendResponse({ success: true, loggedIn: isLoggedIn });
          break;

        case 'startFieldMapping':
          this.startFieldMapping();
          sendResponse({ success: true });
          break;

        case 'stopFieldMapping':
          this.stopFieldMapping();
          sendResponse({ success: true });
          break;

        case 'setCurrentField':
          this.currentMappingField = message.fieldName;
          this.updateMappingIndicator(message.fieldLabel);
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      this.log('❌ Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Field mapping methods
  startFieldMapping() {
    this.log('🎯 Field mapping mode activated');
    this.currentMappingField = null;
    
    // Remove existing indicator
    const existingIndicator = document.getElementById('salesonator-mapping-indicator');
    if (existingIndicator) existingIndicator.remove();
    
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
      z-index: 10000;
      box-shadow: 0 4px 20px rgba(24, 119, 242, 0.3);
      border: 2px solid rgba(255, 255, 255, 0.2);
      max-width: 300px;
    `;
    indicator.innerHTML = '🎯 <strong>Field Mapping Mode</strong><br><small>Waiting for instructions...</small>';
    document.body.appendChild(indicator);
    
    // Add click listener for field mapping
    document.addEventListener('click', this.handleFieldClick.bind(this), true);
  }

  stopFieldMapping() {
    this.log('🎯 Field mapping mode deactivated');
    
    // Remove indicator
    const indicator = document.getElementById('salesonator-mapping-indicator');
    if (indicator) {
      indicator.remove();
    }
    
    // Remove click listener
    document.removeEventListener('click', this.handleFieldClick.bind(this), true);
    this.currentMappingField = null;
  }

  updateMappingIndicator(fieldLabel) {
    const indicator = document.getElementById('salesonator-mapping-indicator');
    if (indicator) {
      indicator.innerHTML = `🎯 <strong>Mapping: ${fieldLabel}</strong><br><small>Click on this field now!</small>`;
    }
  }

  handleFieldClick(event) {
    if (!this.currentMappingField) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const element = event.target;
    const selector = this.getElementSelector(element);
    
    this.log('🎯 Field clicked:', element, 'Selector:', selector);
    
    // Highlight the clicked element briefly
    const originalStyle = element.style.cssText;
    element.style.cssText += 'border: 3px solid #28a745 !important; background-color: rgba(40, 167, 69, 0.1) !important;';
    
    setTimeout(() => {
      element.style.cssText = originalStyle;
    }, 1500);
    
    // Save to storage immediately
    this.saveFieldMapping(this.currentMappingField, selector);
    
    // Send mapping info back to popup
    chrome.runtime.sendMessage({
      type: 'FIELD_MAPPED',
      fieldName: this.currentMappingField,
      selector: selector
    });
    
    // Update indicator
    const indicator = document.getElementById('salesonator-mapping-indicator');
    if (indicator) {
      indicator.innerHTML = `✅ <strong>Mapped: ${this.currentMappingField}</strong><br><small>Saved successfully!</small>`;
    }
  }

  getElementSelector(element) {
    const selectors = [];
    
    // XPath
    const xpath = this.getXPath(element);
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

  getXPath(element) {
    if (element === document.body) return '/html/body';
    
    let ix = 0;
    const siblings = element.parentNode ? element.parentNode.childNodes : [];
    
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (sibling === element) {
        const parentPath = element.parentNode ? this.getXPath(element.parentNode) : '';
        return `${parentPath}/${element.tagName.toLowerCase()}[${ix + 1}]`;
      }
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        ix++;
      }
    }
  }

  async saveFieldMapping(fieldName, selector) {
    try {
      const result = await chrome.storage.local.get(['fieldMappings']);
      const mappings = result.fieldMappings || {};
      mappings[fieldName] = selector;
      await chrome.storage.local.set({ fieldMappings: mappings });
      
      // Reload mappings in this instance
      this.fieldMappings = mappings;
      
      this.log(`💾 Saved mapping for ${fieldName}:`, selector);
    } catch (error) {
      this.log('❌ Error saving field mapping:', error);
    }
  }

  // Check if user is logged into Facebook
  checkFacebookLogin() {
    const loginIndicators = [
      '[data-testid="blue_bar_profile_link"]',
      '[aria-label*="Profile"]',
      'div[role="banner"]'
    ];
    
    return loginIndicators.some(selector => document.querySelector(selector) !== null);
  }

  // Enhanced logging
  log(...args) {
    console.log('[Salesonator Enhanced]', ...args);
  }
}

// Initialize automator and set up message handling
const automator = new SalesonatorAutomator();

// Handle messages from popup and background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  automator.handleMessage(message, sender, sendResponse);
  return true; // Will respond asynchronously
});

console.log('✅ Salesonator Enhanced Automator loaded successfully');