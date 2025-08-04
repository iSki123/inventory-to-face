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

      // Wait for page to load
      await this.waitForElement('[data-testid="marketplace_composer_title_input"]', 10000);

      // Fill out the form
      await this.fillVehicleForm(vehicle);

      // Submit the form
      await this.submitForm();

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

  async fillVehicleForm(vehicle) {
    // Title
    await this.fillInput('[data-testid="marketplace_composer_title_input"]', 
      `${vehicle.year} ${vehicle.make} ${vehicle.model}`);

    // Price
    await this.fillInput('[data-testid="marketplace_composer_price_input"]', 
      (vehicle.price / 100).toString());

    // Category - select Vehicle
    await this.selectCategory('Vehicle');

    // Description
    await this.fillTextarea('[data-testid="marketplace_composer_description_input"]', 
      vehicle.description || `Beautiful ${vehicle.year} ${vehicle.make} ${vehicle.model} in excellent condition.`);

    // Vehicle specific fields
    await this.fillVehicleSpecificFields(vehicle);
  }

  async fillVehicleSpecificFields(vehicle) {
    // Year
    if (vehicle.year) {
      await this.selectDropdown('[data-testid="year_selector"]', vehicle.year.toString());
    }

    // Make
    if (vehicle.make) {
      await this.selectDropdown('[data-testid="make_selector"]', vehicle.make);
    }

    // Model
    if (vehicle.model) {
      await this.selectDropdown('[data-testid="model_selector"]', vehicle.model);
    }

    // Mileage
    if (vehicle.mileage) {
      await this.fillInput('[data-testid="mileage_input"]', vehicle.mileage.toString());
    }

    // Condition
    if (vehicle.condition) {
      await this.selectDropdown('[data-testid="condition_selector"]', vehicle.condition);
    }

    // Color
    if (vehicle.exterior_color) {
      await this.selectDropdown('[data-testid="exterior_color_selector"]', vehicle.exterior_color);
    }

    // Transmission
    if (vehicle.transmission) {
      await this.selectDropdown('[data-testid="transmission_selector"]', vehicle.transmission);
    }

    // Fuel type
    if (vehicle.fuel_type) {
      await this.selectDropdown('[data-testid="fuel_type_selector"]', vehicle.fuel_type);
    }
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