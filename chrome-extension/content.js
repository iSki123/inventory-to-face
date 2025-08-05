class FacebookMarketplaceAutomation {
  constructor() {
    this.isProcessing = false;
    this.init();
  }

  init() {
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'ping') {
        sendResponse({ success: true, message: 'Content script is loaded' });
      } else if (request.action === 'checkLogin') {
        sendResponse({ loggedIn: this.isLoggedIn() });
      } else if (request.action === 'postVehicle') {
        // Handle async response with proper error handling
        this.postVehicle(request.vehicle)
          .then(result => {
            sendResponse(result);
          })
          .catch(error => {
            console.error('Error in postVehicle:', error);
            sendResponse({ 
              success: false, 
              error: error.message || 'Unknown error occurred' 
            });
          });
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
      console.log('Starting to post vehicle:', vehicle);

      // Check if we're already on a create listing page
      const currentUrl = window.location.href;
      console.log('Current URL:', currentUrl);

      if (!currentUrl.includes('/marketplace/create')) {
        console.log('Not on create listing page, navigating...');
        await this.navigateToCreateListing();
      } else {
        console.log('Already on create listing page');
      }

      // Wait for the page to be ready with better error handling
      console.log('Waiting for page to be ready...');
      await this.waitForPageReady();
      console.log('Page is ready');

      // Fill out the form
      console.log('Starting to fill vehicle form...');
      await this.fillVehicleForm(vehicle);
      console.log('Form filled successfully');

      this.isProcessing = false;
      return { success: true, message: 'Vehicle form filled successfully' };

    } catch (error) {
      console.error('Error posting vehicle:', error);
      this.isProcessing = false;
      return { success: false, error: error.message };
    }
  }

  async navigateToCreateListing() {
    console.log('Navigating to Facebook Marketplace create listing page...');
    
    try {
      // Try to navigate to the vehicle listing page
      window.location.href = 'https://www.facebook.com/marketplace/create/vehicle';
      
      // Wait for navigation to complete with timeout
      const maxWaitTime = 10000; // 10 seconds
      const startTime = Date.now();
      
      await new Promise((resolve, reject) => {
        const checkNavigation = () => {
          const currentTime = Date.now();
          const currentUrl = window.location.href;
          
          console.log('Checking navigation, current URL:', currentUrl);
          
          if (currentUrl.includes('/marketplace/create')) {
            console.log('Navigation successful');
            resolve();
          } else if (currentTime - startTime > maxWaitTime) {
            reject(new Error('Navigation timeout - could not reach marketplace create page'));
          } else {
            setTimeout(checkNavigation, 500);
          }
        };
        
        // Start checking after a short delay
        setTimeout(checkNavigation, 1000);
      });
      
    } catch (error) {
      console.error('Navigation failed:', error);
      throw new Error(`Failed to navigate to marketplace: ${error.message}`);
    }
  }

  async waitForPageReady() {
    console.log('Waiting for page elements to be ready...');
    
    // Wait for any of these common Facebook Marketplace elements to appear
    const selectors = [
      'input[type="text"]', 'input[type="number"]', 'textarea', 'select', // Basic form elements
      '[data-testid*="composer"]', // Facebook testids
      '[role="combobox"]', // Dropdown elements
      'div[contenteditable="true"]', // Rich text editors
      'form', // Any form element
      '[aria-label*="rice"]', '[aria-label*="itle"]' // Marketplace specific fields
    ];

    try {
      // Try to find any element that indicates the page is ready
      const foundElement = await Promise.race(
        selectors.map(selector => this.waitForElement(selector, 8000))
      );
      
      console.log('Page ready - found element:', foundElement);
      
      // Additional wait to ensure page is fully loaded
      await this.delay(2000);
      
      return foundElement;
    } catch (error) {
      console.warn('Page ready check failed, proceeding anyway:', error.message);
      
      // Even if we can't find specific elements, wait a bit and continue
      await this.delay(3000);
      
      return null;
    }
  }

  async fillVehicleForm(vehicle) {
    console.log('Starting to fill vehicle form with:', vehicle);

    // Wait for the form to be fully loaded
    await this.delay(2000);

    // Standardize vehicle data with proper capitalization
    const standardizedVehicle = this.standardizeVehicleData(vehicle);
    console.log('Standardized vehicle data:', standardizedVehicle);

    // Fill vehicle type first (if dropdown exists)
    await this.selectVehicleType();

    // Fill basic fields with multiple selector strategies
    await this.fillPrice(standardizedVehicle.price);
    await this.fillYear(standardizedVehicle.year);
    await this.fillMake(standardizedVehicle.make);
    await this.fillModel(standardizedVehicle.model);
    await this.fillLocation(standardizedVehicle.location);
    await this.fillDescription(standardizedVehicle);
    
    // Upload images if available
    if (vehicle.images && vehicle.images.length > 0) {
      await this.uploadImages(vehicle.images);
    }

    console.log('Form filling completed');
  }

  standardizeVehicleData(vehicle) {
    const standardized = { ...vehicle };
    
    // Capitalize first letter of make and model
    if (standardized.make) {
      standardized.make = standardized.make.charAt(0).toUpperCase() + standardized.make.slice(1).toLowerCase();
    }
    
    if (standardized.model) {
      standardized.model = standardized.model.charAt(0).toUpperCase() + standardized.model.slice(1).toLowerCase();
    }
    
    // Ensure year is a string
    if (standardized.year) {
      standardized.year = standardized.year.toString();
    }
    
    return standardized;
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
    
    // Price is already in dollars, not cents
    const priceValue = price.toString();
    const selectors = [
      'input[placeholder*="rice"]',
      'input[data-testid*="price"]',
      'input[name*="price"]',
      'input[type="number"]',
      'input[aria-label*="rice"]'
    ];

    await this.tryFillInput(selectors, priceValue, 'price');
  }

  async fillYear(year) {
    if (!year) return;
    
    const yearString = year.toString();
    console.log('Attempting to fill year:', yearString);

    // More specific selectors to avoid search bar
    const specificSelectors = [
      // Form-specific year fields
      'div[data-testid*="vehicle"] select',
      'div[data-testid*="vehicle"] input[type="number"]',
      'div[data-testid*="vehicle"] input[placeholder*="Year"]',
      '[data-testid="year_selector"]',
      '[data-testid*="year_selector"]',
      'select[name*="year"]',
      'input[name*="year"]:not([type="search"])',
      'div.marketplace input[type="number"]',
      'form input[type="number"]'
    ];

    // Try specific selectors first
    for (let selector of specificSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null && !this.isSearchField(element)) {
          console.log(`Found year field with selector: ${selector}`);
          
          if (element.tagName === 'SELECT') {
            // Handle standard select dropdown
            const option = Array.from(element.options).find(opt => 
              opt.value === yearString || opt.text.includes(yearString)
            );
            if (option) {
              element.value = option.value;
              element.dispatchEvent(new Event('change', { bubbles: true }));
              return;
            }
          } else {
            // Handle input field
            await this.simulateTyping(element, yearString);
            return;
          }
        }
      } catch (error) {
        console.warn(`Error with year selector ${selector}:`, error);
      }
    }

    // Try dropdown selectors
    const dropdownSelectors = [
      'div[role="combobox"][aria-label*="Year"]',
      'button[role="combobox"][aria-label*="Year"]',
      '[aria-label*="Year"] div[role="combobox"]',
      '[aria-label*="Year"] button[role="combobox"]'
    ];

    for (let selector of dropdownSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null && !this.isSearchField(element)) {
          console.log(`Found year dropdown with selector: ${selector}`);
          
          // Handle custom dropdowns (click to open)
          element.click();
          await this.delay(1000);
          
          // Try a more specific search for year options
          const allOptions = document.querySelectorAll('[role="option"], li, div[data-value]');
          for (let option of allOptions) {
            if (option.textContent && option.textContent.trim() === yearString) {
              console.log('Found matching year option:', option.textContent);
              option.click();
              await this.delay(500);
              return;
            }
          }
          
          // If no exact match, try partial match
          for (let option of allOptions) {
            if (option.textContent && option.textContent.includes(yearString)) {
              console.log('Found partial matching year option:', option.textContent);
              option.click();
              await this.delay(500);
              return;
            }
          }
        }
      } catch (error) {
        console.warn(`Error with year dropdown selector ${selector}:`, error);
      }
    }

    console.warn('Could not find year field');
  }

  // Helper method to check if element is a search field
  isSearchField(element) {
    const searchIndicators = [
      'search',
      'query',
      'q=',
      'facebook.com/search'
    ];
    
    // Check element attributes
    const placeholder = element.placeholder?.toLowerCase() || '';
    const name = element.name?.toLowerCase() || '';
    const id = element.id?.toLowerCase() || '';
    const className = element.className?.toLowerCase() || '';
    
    // Check if element is in search context
    const parentText = element.closest('[role="search"]') !== null;
    const isInSearchBox = element.closest('[data-testid*="search"]') !== null;
    
    return searchIndicators.some(indicator => 
      placeholder.includes(indicator) || 
      name.includes(indicator) || 
      id.includes(indicator) || 
      className.includes(indicator)
    ) || parentText || isInSearchBox;
  }

  async fillMake(make) {
    if (!make) return;

    const selectors = [
      'input[placeholder*="ake"]',
      'input[aria-label*="ake"]',
      '[data-testid*="make"]',
      '[aria-label*="Make"]',
      'input[name*="make"]',
      'input[placeholder="Make"]',
      'input[id*="make"]',
      'input[class*="make"]'
    ];

    const success = await this.tryFillInput(selectors, make, 'make');
    if (!success) {
      // Try alternative approach - look for any text input and check if it's the make field
      const allInputs = document.querySelectorAll('input[type="text"]');
      for (let input of allInputs) {
        const parent = input.closest('div');
        if (parent && (parent.innerText.toLowerCase().includes('make') || 
                      input.placeholder.toLowerCase().includes('make'))) {
          console.log('Found make field via alternative method');
          await this.simulateTyping(input, make);
          return;
        }
      }
    }
  }

  async fillModel(model) {
    if (!model) return;

    const selectors = [
      'input[placeholder*="odel"]',
      'input[aria-label*="odel"]',
      '[data-testid*="model"]',
      '[aria-label*="Model"]',
      'input[name*="model"]',
      'input[placeholder="Model"]',
      'input[id*="model"]',
      'input[class*="model"]'
    ];

    const success = await this.tryFillInput(selectors, model, 'model');
    if (!success) {
      // Try alternative approach - look for any text input and check if it's the model field
      const allInputs = document.querySelectorAll('input[type="text"]');
      for (let input of allInputs) {
        const parent = input.closest('div');
        if (parent && (parent.innerText.toLowerCase().includes('model') || 
                      input.placeholder.toLowerCase().includes('model'))) {
          console.log('Found model field via alternative method');
          await this.simulateTyping(input, model);
          return;
        }
      }
    }
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
    let description = vehicle.ai_description || vehicle.description;
    
    // Generate AI description if none exists or is too short
    if (!description || description.length < 30) {
      console.log('Generating AI description for vehicle...');
      try {
        description = await this.generateAIDescription(vehicle);
      } catch (error) {
        console.warn('Failed to generate AI description, using fallback:', error);
        description = this.generateDescription(vehicle);
      }
    }

    const selectors = [
      'textarea[placeholder*="escription"]',
      'textarea[aria-label*="escription"]',
      'div[contenteditable="true"]',
      '[data-testid*="description"]',
      '[aria-label*="description"]',
      'textarea'
    ];

    await this.tryFillTextarea(selectors, description, 'description');
  }

  async generateAIDescription(vehicle) {
    try {
      const response = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/generate-vehicle-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
        },
        body: JSON.stringify({ vehicle })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.description) {
        console.log('Generated AI description successfully');
        return data.description;
      } else {
        throw new Error(data.error || 'Failed to generate AI description');
      }
    } catch (error) {
      console.error('Error generating AI description:', error);
      throw error;
    }
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
      // Remove duplicates and limit to first 3 unique images
      const uniqueUrls = [...new Set(imageUrls)].slice(0, 3);
      console.log('Uploading unique images:', uniqueUrls);
      
      // Download images and convert to File objects
      const files = [];
      
      for (let i = 0; i < uniqueUrls.length; i++) {
        try {
          const response = await fetch(uniqueUrls[i], { mode: 'cors' });
          if (response.ok) {
            const blob = await response.blob();
            const file = new File([blob], `vehicle_image_${i + 1}.jpg`, { type: 'image/jpeg' });
            files.push(file);
            console.log(`Downloaded image ${i + 1}:`, uniqueUrls[i]);
          }
        } catch (error) {
          console.warn(`Failed to fetch image ${uniqueUrls[i]}:`, error);
        }
      }

      if (files.length > 0) {
        // Create a new FileList
        const dt = new DataTransfer();
        files.forEach(file => dt.items.add(file));
        
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log(`Uploaded ${files.length} unique images`);
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