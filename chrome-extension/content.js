class FacebookMarketplaceAutomation {
  constructor() {
    this.isProcessing = false;
    this.init();
  }

  init() {
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'checkLogin') {
        sendResponse({ loggedIn: this.isLoggedIn() });
      } else if (request.action === 'postVehicle') {
        this.postVehicle(request.vehicle).then(sendResponse);
        return true; // Will respond asynchronously
      }
    });

    console.log('Salesonator: Facebook Marketplace automation loaded');
  }

  isLoggedIn() {
    // Check if user is logged in by looking for profile elements
    const profileElements = [
      '[data-testid="blue_bar_profile_link"]',
      '[data-testid="nav_profile_tab"]',
      '[aria-label*="Profile"]'
    ];

    return profileElements.some(selector => document.querySelector(selector));
  }

  async postVehicle(vehicle) {
    if (this.isProcessing) {
      return { success: false, error: 'Already posting a vehicle' };
    }

    this.isProcessing = true;

    try {
      console.log('Posting vehicle:', vehicle);

      // Navigate to marketplace create listing if not already there
      if (!window.location.href.includes('/marketplace/create')) {
        await this.navigateToCreateListing();
      }

      // Wait for the page to be ready - use more flexible selectors
      await this.waitForPageReady();

      // Fill out the form
      await this.fillVehicleForm(vehicle);

      // Don't auto-submit, let user review first
      console.log('Form filled successfully. Please review and submit manually.');

      this.isProcessing = false;
      return { success: true };

    } catch (error) {
      console.error('Error posting vehicle:', error);
      this.isProcessing = false;
      return { success: false, error: error.message };
    }
  }

  async navigateToCreateListing() {
    window.location.href = 'https://www.facebook.com/marketplace/create/vehicle';
    
    // Wait for navigation to complete
    await new Promise(resolve => {
      const checkNavigation = () => {
        if (window.location.href.includes('/marketplace/create')) {
          resolve();
        } else {
          setTimeout(checkNavigation, 500);
        }
      };
      checkNavigation();
    });
  }

  async waitForPageReady() {
    // Wait for any of these common Facebook Marketplace elements to appear
    const selectors = [
      'input', 'textarea', 'select', // Basic form elements
      '[data-testid*="composer"]', // Facebook testids
      '[role="combobox"]', // Dropdown elements
      'div[contenteditable="true"]' // Rich text editors
    ];

    return Promise.race(
      selectors.map(selector => this.waitForElement(selector, 8000))
    );
  }

  async fillVehicleForm(vehicle) {
    console.log('Starting to fill vehicle form with:', vehicle);

    // Wait for the form to be fully loaded
    await this.delay(2000);

    // Fill vehicle type first (if dropdown exists)
    await this.selectVehicleType();

    // Fill basic fields with multiple selector strategies
    await this.fillPrice(vehicle.price);
    await this.fillYear(vehicle.year);
    await this.fillMake(vehicle.make);
    await this.fillModel(vehicle.model);
    await this.fillLocation(vehicle.location);
    await this.fillDescription(vehicle);
    
    // Upload images if available
    if (vehicle.images && vehicle.images.length > 0) {
      await this.uploadImages(vehicle.images);
    }

    console.log('Form filling completed');
  }

  async selectVehicleType() {
    const selectors = [
      'select', // Generic select element
      '[data-testid*="vehicle"]',
      '[aria-label*="Vehicle"]',
      'div[role="combobox"]'
    ];

    for (let selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          console.log(`Found vehicle type selector: ${selector}`);
          if (element.tagName === 'SELECT') {
            // For regular select dropdown
            element.value = 'vehicle';
            element.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            // For custom dropdowns
            element.click();
            await this.delay(500);
            // Look for vehicle option
            const vehicleOption = document.querySelector('[role="option"]');
            if (vehicleOption) vehicleOption.click();
          }
          break;
        }
      } catch (error) {
        console.warn(`Error with vehicle type selector ${selector}:`, error);
      }
    }
  }

  async fillPrice(price) {
    if (!price) return;
    
    const priceValue = (price / 100).toString();
    const selectors = [
      'input[placeholder*="rice"]',
      'input[data-testid*="price"]',
      'input[name*="price"]',
      'input[type="number"]'
    ];

    await this.tryFillInput(selectors, priceValue, 'price');
  }

  async fillYear(year) {
    if (!year) return;

    const selectors = [
      'select', // Year is often the first select
      'input[placeholder*="ear"]',
      '[data-testid*="year"]',
      '[aria-label*="Year"]'
    ];

    await this.tryFillInput(selectors, year.toString(), 'year');
  }

  async fillMake(make) {
    if (!make) return;

    const selectors = [
      'input[placeholder*="ake"]',
      '[data-testid*="make"]',
      '[aria-label*="Make"]',
      'input[name*="make"]'
    ];

    await this.tryFillInput(selectors, make, 'make');
  }

  async fillModel(model) {
    if (!model) return;

    const selectors = [
      'input[placeholder*="odel"]',
      '[data-testid*="model"]',
      '[aria-label*="Model"]',
      'input[name*="model"]'
    ];

    await this.tryFillInput(selectors, model, 'model');
  }

  async fillLocation(location) {
    if (!location) return;

    const selectors = [
      'input[placeholder*="ocation"]',
      '[data-testid*="location"]',
      '[aria-label*="Location"]',
      'input[name*="location"]'
    ];

    await this.tryFillInput(selectors, location, 'location');
  }

  async fillDescription(vehicle) {
    let description = vehicle.description;
    
    // Generate a better description if none exists
    if (!description) {
      description = this.generateDescription(vehicle);
    }

    const selectors = [
      'textarea',
      'div[contenteditable="true"]',
      '[data-testid*="description"]',
      '[aria-label*="description"]'
    ];

    await this.tryFillTextarea(selectors, description, 'description');
  }

  generateDescription(vehicle) {
    let desc = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    
    if (vehicle.trim) desc += ` ${vehicle.trim}`;
    if (vehicle.mileage) desc += `\n\nMileage: ${vehicle.mileage.toLocaleString()} miles`;
    if (vehicle.exterior_color) desc += `\nExterior Color: ${vehicle.exterior_color}`;
    if (vehicle.interior_color) desc += `\nInterior Color: ${vehicle.interior_color}`;
    if (vehicle.transmission) desc += `\nTransmission: ${vehicle.transmission}`;
    if (vehicle.fuel_type) desc += `\nFuel Type: ${vehicle.fuel_type}`;
    if (vehicle.condition) desc += `\nCondition: ${vehicle.condition}`;
    if (vehicle.vin) desc += `\nVIN: ${vehicle.vin}`;
    
    if (vehicle.features && vehicle.features.length > 0) {
      desc += `\n\nFeatures:\n${vehicle.features.join('\n')}`;
    }

    if (vehicle.contact_phone) {
      desc += `\n\nContact: ${vehicle.contact_phone}`;
    }

    return desc;
  }

  async uploadImages(imageUrls) {
    console.log('Attempting to upload images:', imageUrls);
    
    // Look for file input or upload area
    const uploadSelectors = [
      'input[type="file"]',
      '[data-testid*="photo"]',
      '[aria-label*="photo"]',
      '[role="button"]:has-text("Add photos")'
    ];

    for (let selector of uploadSelectors) {
      try {
        const uploadElement = document.querySelector(selector);
        if (uploadElement) {
          console.log(`Found upload element: ${selector}`);
          
          if (uploadElement.tagName === 'INPUT') {
            // For file input, we need to create File objects from URLs
            await this.uploadImageFiles(uploadElement, imageUrls);
          } else {
            // For other upload areas, try clicking
            uploadElement.click();
            await this.delay(1000);
          }
          break;
        }
      } catch (error) {
        console.warn(`Error with upload selector ${selector}:`, error);
      }
    }
  }

  async uploadImageFiles(input, imageUrls) {
    try {
      // Download images and convert to File objects
      const files = [];
      
      for (let i = 0; i < Math.min(imageUrls.length, 10); i++) { // Limit to 10 images
        try {
          const response = await fetch(imageUrls[i], { mode: 'cors' });
          if (response.ok) {
            const blob = await response.blob();
            const file = new File([blob], `vehicle_image_${i + 1}.jpg`, { type: 'image/jpeg' });
            files.push(file);
          }
        } catch (error) {
          console.warn(`Failed to fetch image ${imageUrls[i]}:`, error);
        }
      }

      if (files.length > 0) {
        // Create a new FileList
        const dt = new DataTransfer();
        files.forEach(file => dt.items.add(file));
        
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log(`Uploaded ${files.length} images`);
      }
    } catch (error) {
      console.error('Error uploading images:', error);
    }
  }

  async tryFillInput(selectors, value, fieldName) {
    for (let selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) { // Check if visible
          console.log(`Filling ${fieldName} with selector: ${selector}`);
          
          if (element.tagName === 'SELECT') {
            // Handle select dropdowns
            const option = Array.from(element.options).find(opt => 
              opt.value === value || opt.text.toLowerCase().includes(value.toLowerCase())
            );
            if (option) {
              element.value = option.value;
              element.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          } else if (element.tagName === 'INPUT') {
            // Handle input fields
            await this.simulateTyping(element, value);
            return true;
          } else {
            // Handle custom components
            element.click();
            await this.delay(500);
            
            // Try to type the value
            document.execCommand('insertText', false, value);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
      } catch (error) {
        console.warn(`Error with ${fieldName} selector ${selector}:`, error);
      }
    }
    
    console.warn(`Could not fill ${fieldName} with value: ${value}`);
    return false;
  }

  async tryFillTextarea(selectors, value, fieldName) {
    for (let selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) {
          console.log(`Filling ${fieldName} with selector: ${selector}`);
          
          if (element.tagName === 'TEXTAREA') {
            await this.simulateTyping(element, value);
            return true;
          } else if (element.contentEditable === 'true') {
            element.focus();
            element.textContent = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
      } catch (error) {
        console.warn(`Error with ${fieldName} selector ${selector}:`, error);
      }
    }
    
    console.warn(`Could not fill ${fieldName} with value: ${value}`);
    return false;
  }

  async simulateTyping(element, value) {
    element.focus();
    
    // Clear existing content
    element.select();
    await this.delay(100);
    
    // Set value directly for reliability
    element.value = value;
    
    // Trigger events to ensure React/Vue components detect the change
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    
    await this.delay(200);
  }

  async fillInput(selector, value) {
    const input = await this.waitForElement(selector, 5000);
    
    // Clear existing value
    input.focus();
    input.select();
    
    // Simulate typing
    for (let char of value) {
      input.value += char;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await this.delay(50 + Math.random() * 100); // Random delay between 50-150ms
    }
    
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
  }

  async fillTextarea(selector, value) {
    const textarea = await this.waitForElement(selector, 5000);
    
    textarea.focus();
    textarea.value = '';
    
    // Simulate typing
    for (let char of value) {
      textarea.value += char;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await this.delay(30 + Math.random() * 70); // Random delay
    }
    
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.blur();
  }

  async selectCategory(categoryName) {
    // Click category dropdown
    const categoryButton = await this.waitForElement('[data-testid="category_selector"]', 5000);
    categoryButton.click();
    
    // Wait for dropdown to open
    await this.delay(500);
    
    // Find and click the category
    const categoryOption = await this.waitForElement(`[data-testid="category_option_${categoryName}"]`, 3000);
    categoryOption.click();
    
    await this.delay(500);
  }

  async selectDropdown(selector, value) {
    try {
      const dropdown = await this.waitForElement(selector, 3000);
      dropdown.click();
      
      await this.delay(500);
      
      // Try to find the option
      const optionSelector = `[data-testid="${selector.replace('[data-testid="', '').replace('"]', '')}_option_${value}"]`;
      const option = document.querySelector(optionSelector);
      
      if (option) {
        option.click();
        await this.delay(300);
      } else {
        console.warn(`Could not find option ${value} for ${selector}`);
      }
    } catch (error) {
      console.warn(`Could not select ${value} for ${selector}:`, error);
    }
  }

  async submitForm() {
    // Look for publish/submit button
    const submitSelectors = [
      '[data-testid="marketplace_composer_publish_button"]',
      '[data-testid="publish_button"]',
      'button[type="submit"]',
      'button:contains("Publish")',
      'button:contains("Post")'
    ];

    for (let selector of submitSelectors) {
      try {
        const button = await this.waitForElement(selector, 2000);
        if (button && !button.disabled) {
          button.click();
          
          // Wait for submission to complete
          await this.delay(3000);
          
          return;
        }
      } catch (error) {
        // Try next selector
        continue;
      }
    }
    
    throw new Error('Could not find submit button');
  }

  async waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize the automation
new FacebookMarketplaceAutomation();