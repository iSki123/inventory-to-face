// Content script for Salesonator Chrome Extension

class SalesonatorAutomator {
  constructor() {
    this.isRunning = false;
    this.currentStep = '';
    this.retryCount = 0;
    this.maxRetries = 3;
    this.baseDelay = 2000;
    this.maxDelay = 8000;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async waitForElement(selector, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await this.delay(500);
    }
    throw new Error(`Element not found: ${selector}`);
  }

  getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async navigateToMarketplace() {
    console.log('Navigating to marketplace...');
    
    if (window.location.pathname.includes('/marketplace/create')) {
      console.log('Already on marketplace create page');
      return true;
    }

    if (!window.location.hostname.includes('facebook.com')) {
      throw new Error('Not on Facebook');
    }

    // Navigate to marketplace
    window.location.href = 'https://www.facebook.com/marketplace/create/item';
    await this.delay(3000);
    return true;
  }

  async selectCategory() {
    console.log('Selecting vehicle category...');
    
    try {
      // Look for the "Vehicle type" dropdown
      const vehicleTypeSelectors = [
        'div:has-text("Vehicle type")',
        '[aria-label*="Vehicle type" i]',
        'div[role="button"]:has-text("Vehicle type")',
        'div[tabindex="0"]:has-text("Vehicle type")'
      ];
      
      let vehicleTypeDropdown = null;
      
      // Try to find the vehicle type dropdown
      for (let selector of vehicleTypeSelectors) {
        try {
          const elements = document.querySelectorAll('div[role="button"], div[tabindex="0"], [aria-label]');
          for (let element of elements) {
            const text = element.textContent || element.getAttribute('aria-label') || '';
            if (text.toLowerCase().includes('vehicle type') || text.toLowerCase().includes('vehicle')) {
              vehicleTypeDropdown = element;
              console.log('Found vehicle type dropdown:', text.substring(0, 50));
              break;
            }
          }
          if (vehicleTypeDropdown) break;
        } catch (error) {
          continue;
        }
      }
      
      if (!vehicleTypeDropdown) {
        throw new Error('Could not find Vehicle type dropdown');
      }
      
      // Click the dropdown to open it
      vehicleTypeDropdown.click();
      await this.delay(this.getRandomDelay(1000, 2000));
      
      // Now look for "Car/Truck" option
      const carTruckSelectors = [
        'div:has-text("Car/Truck")',
        '[aria-label*="Car/Truck" i]',
        'div[role="option"]:has-text("Car/Truck")',
        'div[tabindex="0"]:has-text("Car/Truck")'
      ];
      
      let carTruckOption = null;
      
      // Wait a moment for dropdown to open
      await this.delay(500);
      
      // Try to find the Car/Truck option
      for (let selector of carTruckSelectors) {
        try {
          const elements = document.querySelectorAll('div[role="option"], div[tabindex="0"], div[role="button"]');
          for (let element of elements) {
            const text = element.textContent || element.getAttribute('aria-label') || '';
            if (text.toLowerCase().includes('car/truck') || text.toLowerCase().includes('car') && text.toLowerCase().includes('truck')) {
              carTruckOption = element;
              console.log('Found Car/Truck option:', text.substring(0, 50));
              break;
            }
          }
          if (carTruckOption) break;
        } catch (error) {
          continue;
        }
      }
      
      if (!carTruckOption) {
        // Fallback: look for any vehicle-related option
        const elements = document.querySelectorAll('div[role="option"], div[tabindex="0"], div[role="button"]');
        for (let element of elements) {
          const text = (element.textContent || '').toLowerCase();
          if (text.includes('car') || text.includes('truck') || text.includes('auto')) {
            carTruckOption = element;
            console.log('Found fallback vehicle option:', text.substring(0, 50));
            break;
          }
        }
      }
      
      if (!carTruckOption) {
        throw new Error('Could not find Car/Truck option in dropdown');
      }
      
      // Click the Car/Truck option
      carTruckOption.click();
      await this.delay(this.getRandomDelay(1500, 2500));
      
      console.log('Successfully selected vehicle category');
      return true;
      
    } catch (error) {
      console.error('Error selecting category:', error);
      throw new Error(`Could not select vehicle category: ${error.message}`);
    }
  }

  async fillVehicleDetails(vehicle) {
    console.log('Filling vehicle details...');
    
    // Fill Year
    console.log('Filling year...');
    try {
      const yearDropdown = await this.waitForElement('input[placeholder*="Year" i], div[role="combobox"] input, select', 5000);
      await this.delay(500);
      yearDropdown.focus();
      yearDropdown.click();
      await this.delay(1000);
      
      // If it's a dropdown, look for the year option
      const yearOption = await this.waitForElement(`div[role="option"]:has-text("${vehicle.year}"), li:has-text("${vehicle.year}")`, 3000);
      yearOption.click();
      await this.delay(1000);
    } catch (error) {
      console.warn('Could not fill year field:', error);
    }
    
    // Fill Make
    console.log('Filling make...');
    try {
      const makeDropdown = await this.waitForElement('input[placeholder*="Make" i], div[role="combobox"]:nth-of-type(2) input', 5000);
      await this.delay(500);
      makeDropdown.focus();
      makeDropdown.click();
      await this.delay(1000);
      
      // Look for make in dropdown or type it
      try {
        const makeOption = await this.waitForElement(`div[role="option"]:has-text("${vehicle.make.trim()}")`, 2000);
        makeOption.click();
      } catch {
        // If no dropdown option found, type the make
        makeDropdown.value = vehicle.make.trim();
        makeDropdown.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await this.delay(1000);
    } catch (error) {
      console.warn('Could not fill make field:', error);
    }
    
    // Fill Model
    console.log('Filling model...');
    try {
      const modelDropdown = await this.waitForElement('input[placeholder*="Model" i], div[role="combobox"]:nth-of-type(3) input', 5000);
      await this.delay(500);
      modelDropdown.focus();
      modelDropdown.click();
      await this.delay(1000);
      
      const modelText = `${vehicle.model} ${vehicle.trim || ''}`.trim();
      try {
        const modelOption = await this.waitForElement(`div[role="option"]:has-text("${modelText}")`, 2000);
        modelOption.click();
      } catch {
        // If no dropdown option found, type the model
        modelDropdown.value = modelText;
        modelDropdown.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await this.delay(1000);
    } catch (error) {
      console.warn('Could not fill model field:', error);
    }
    
    // Fill Mileage
    console.log('Filling mileage...');
    try {
      if (vehicle.mileage) {
        const mileageInput = await this.waitForElement('input[placeholder*="Mileage" i], input[aria-label*="Mileage" i]', 3000);
        mileageInput.focus();
        await this.delay(500);
        mileageInput.value = vehicle.mileage.toString();
        mileageInput.dispatchEvent(new Event('input', { bubbles: true }));
        await this.delay(1000);
      }
    } catch (error) {
      console.warn('Could not fill mileage field:', error);
    }
    
    return true;
  }

  async fillPrice(vehicle) {
    console.log('Filling price...');
    
    const price = (vehicle.price / 100).toString();
    console.log(`Using price: $${price}`);
    
    const priceInput = await this.waitForElement('input[placeholder*="price" i], input[aria-label*="price" i]');
    
    priceInput.focus();
    await this.delay(500);
    priceInput.value = '';
    priceInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    for (let char of price) {
      priceInput.value += char;
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      await this.delay(this.getRandomDelay(80, 200));
    }
    
    await this.delay(500);
    return true;
  }

  async fillDescription(vehicle) {
    let description = vehicle.ai_description || vehicle.description;
    
    // Generate AI description if none exists or is too short
    if (!description || description.length < 30) {
      console.log('Generating AI description for vehicle...');
      try {
        description = await this.generateAIDescription(vehicle);
        console.log('Successfully generated AI description');
      } catch (error) {
        console.warn('Failed to generate AI description, using fallback:', error);
        description = this.generateFallbackDescription(vehicle);
      }
    }
    
    console.log(`Using description (${description.length} chars):`, description.substring(0, 100) + '...');
    
    const descriptionTextarea = await this.waitForElement('textarea[placeholder*="description" i], textarea[aria-label*="description" i]');
    
    descriptionTextarea.focus();
    await this.delay(500);
    descriptionTextarea.value = '';
    descriptionTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Type description in chunks for more human-like behavior
    const chunks = description.match(/.{1,50}/g) || [description];
    for (let chunk of chunks) {
      descriptionTextarea.value += chunk;
      descriptionTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      await this.delay(this.getRandomDelay(200, 500));
    }
    
    await this.delay(1000);
    return true;
  }

  async generateAIDescription(vehicle) {
    try {
      console.log('Calling Supabase function to generate AI description...');
      
      const response = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/generate-vehicle-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getStoredToken()}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
        },
        body: JSON.stringify({ vehicle })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.description) {
        return data.description;
      } else {
        throw new Error(data.error || 'No description generated');
      }
    } catch (error) {
      console.error('AI description generation failed:', error);
      throw error;
    }
  }

  async getStoredToken() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['userToken'], (result) => {
        resolve(result.userToken || '');
      });
    });
  }

  generateFallbackDescription(vehicle) {
    const features = vehicle.features && vehicle.features.length > 0 
      ? ` Key features include: ${vehicle.features.slice(0, 3).join(', ')}.`
      : '';
    
    const mileageText = vehicle.mileage 
      ? ` With ${vehicle.mileage.toLocaleString()} miles, `
      : ' ';
    
    const conditionText = vehicle.condition 
      ? ` in ${vehicle.condition} condition`
      : '';

    return `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''} available for sale.${mileageText}this ${vehicle.transmission || 'automatic'} ${vehicle.fuel_type || 'gasoline'} vehicle${conditionText} is perfect for your driving needs.${features} Contact us today for more information and to schedule a test drive. Serious inquiries only.`;
  }

  async uploadImages(vehicle) {
    console.log('Handling image upload...');
    
    if (!vehicle.images || vehicle.images.length === 0) {
      console.log('No images to upload');
      return true;
    }
    
    try {
      const uploadButton = await this.waitForElement('input[type="file"], [data-testid="media-sprout-picker"]', 5000);
      console.log('Found upload button, skipping actual upload for now');
      // Note: Actual image upload would require more complex handling
      await this.delay(1000);
      return true;
    } catch (error) {
      console.warn('Could not find upload button:', error);
      return true; // Continue without images
    }
  }

  async fillLocation(vehicle) {
    console.log('Filling location...');
    
    const location = vehicle.location || 'Local Area';
    
    try {
      const locationInput = await this.waitForElement('input[placeholder*="location" i], input[aria-label*="location" i]', 3000);
      
      locationInput.focus();
      await this.delay(500);
      locationInput.value = location;
      locationInput.dispatchEvent(new Event('input', { bubbles: true }));
      await this.delay(1000);
      
      return true;
    } catch (error) {
      console.warn('Could not find location field:', error);
      return true; // Continue without setting location
    }
  }

  async fillContactInfo(vehicle) {
    console.log('Handling contact info...');
    
    // Facebook typically uses the user's profile info
    // Skip manual contact info entry
    await this.delay(500);
    return true;
  }

  async publishListing() {
    console.log('Publishing listing...');
    
    try {
      // Look for publish/post button
      const publishButton = await this.waitForElement(
        'button[type="submit"], [data-testid="post-button"], button:contains("Post"), button:contains("Publish")',
        5000
      );
      
      // Add human delay before clicking
      await this.delay(this.getRandomDelay(1000, 2000));
      publishButton.click();
      
      console.log('Clicked publish button');
      await this.delay(3000);
      
      return true;
    } catch (error) {
      console.error('Could not find publish button:', error);
      throw error;
    }
  }

  async postVehicle(vehicle) {
    console.log('Starting vehicle posting process...', vehicle);
    
    try {
      this.isRunning = true;
      this.retryCount = 0;

      // Step 1: Navigate to marketplace
      await this.navigateToMarketplace();
      await this.delay(this.getRandomDelay(2000, 4000));

      // Step 2: Select category
      await this.selectCategory();
      await this.delay(this.getRandomDelay(1500, 3000));

      // Step 3: Fill in vehicle details
      await this.fillVehicleDetails(vehicle);
      await this.delay(this.getRandomDelay(800, 1500));

      await this.fillPrice(vehicle);
      await this.delay(this.getRandomDelay(800, 1500));

      await this.fillDescription(vehicle);
      await this.delay(this.getRandomDelay(1000, 2000));

      await this.uploadImages(vehicle);
      await this.delay(this.getRandomDelay(1000, 2000));

      await this.fillLocation(vehicle);
      await this.delay(this.getRandomDelay(800, 1500));

      await this.fillContactInfo(vehicle);
      await this.delay(this.getRandomDelay(1000, 2000));

      // Step 4: Publish
      await this.publishListing();

      console.log('Vehicle posted successfully!');
      return { success: true, message: 'Vehicle posted successfully' };

    } catch (error) {
      console.error('Error posting vehicle:', error);
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying... (${this.retryCount}/${this.maxRetries})`);
        await this.delay(this.getRandomDelay(5000, 10000));
        return this.postVehicle(vehicle);
      }
      
      return { 
        success: false, 
        error: `Failed to post vehicle after ${this.maxRetries} attempts: ${error.message}` 
      };
    } finally {
      this.isRunning = false;
    }
  }
}

// Initialize automator
const automator = new SalesonatorAutomator();

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);

  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'Content script loaded' });
    return;
  }

  if (request.action === 'checkLogin') {
    const isLoggedIn = document.querySelector('[data-testid="facebook_logged_in"]') || 
                      document.querySelector('[aria-label="Account"]') ||
                      !document.querySelector('[data-testid="royal_login_form"]');
    sendResponse({ loggedIn: isLoggedIn });
    return;
  }

  if (request.action === 'postVehicle') {
    automator.postVehicle(request.vehicle)
      .then(result => {
        console.log('Vehicle posting result:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('Vehicle posting error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Will respond asynchronously
  }

  sendResponse({ success: false, error: 'Unknown action' });
});

console.log('Salesonator content script loaded and ready');
