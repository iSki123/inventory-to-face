// Enhanced Facebook Marketplace Automation
// Implements React-native value setting, MutationObserver, keyboard simulation, and human-like behavior

class SalesonatorAutomator {
  constructor() {
    this.isPosting = false;
    this.debugMode = true;
    this.retryAttempts = 3;
    this.setupMessageListener();
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
    // Priority order: ARIA labels, placeholders, roles, text content, CSS selectors
    for (const selector of selectors) {
      try {
        // ARIA label selector
        if (selector.startsWith('aria:')) {
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

  // Helper function to find elements containing specific text
  findElementByText(text, tagNames = ['div', 'li', 'button', 'span'], parentElement = document) {
    const elements = Array.from(parentElement.querySelectorAll(tagNames.join(', ')));
    return elements.find(el => el.textContent && el.textContent.trim().includes(text));
  }

  // Enhanced human-like typing simulation
  async typeHumanLike(element, text, speed = 'normal') {
    await this.scrollIntoView(element);
    await this.delay(this.randomDelay(200, 500));
    
    element.focus();
    await this.delay(this.randomDelay(100, 300));
    
    // Clear existing content safely
    if (element.select && typeof element.select === 'function') {
      element.select();
    } else {
      element.value = '';
    }
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
        // Simulate brief pause (thinking)
        await this.delay(this.randomDelay(200, 600));
      } else {
        await this.delay(this.randomDelay(minDelay, maxDelay));
      }
    }
    
    // Final events
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    await this.delay(this.randomDelay(100, 300));
  }

  // Enhanced dropdown interaction with keyboard navigation
  async selectDropdownOption(dropdownSelectors, optionValue, useKeyboard = true) {
    try {
      const dropdown = await this.waitForElement(dropdownSelectors, 5000);
      await this.scrollIntoView(dropdown);
      await this.delay(this.randomDelay(300, 600));
      
      // Focus and open dropdown
      dropdown.focus();
      await this.delay(this.randomDelay(200, 400));
      
      if (useKeyboard) {
        // Use keyboard navigation (more reliable)
        dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await this.delay(this.randomDelay(300, 500));
        
        // Try typeahead selection
        if (typeof optionValue === 'string') {
          for (const char of optionValue.toLowerCase()) {
            dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
            await this.delay(this.randomDelay(50, 150));
          }
        }
        
        await this.delay(this.randomDelay(200, 400));
        dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        
      } else {
        // Fallback to click-based selection
        dropdown.click();
        await this.delay(this.randomDelay(500, 1000));
        
        // Look for options
        const optionSelectors = [
          `[role="option"]`,
          `[data-value="${optionValue}"]`,
          `text:${optionValue}`,
          `.option:contains("${optionValue}")`,
          `option[value="${optionValue}"]`
        ];
        
        const option = await this.waitForElement(optionSelectors, 3000);
        if (option) {
          await this.scrollIntoView(option);
          await this.delay(this.randomDelay(200, 400));
          option.click();
        }
      }
      
      await this.delay(this.randomDelay(300, 600));
      return true;
      
    } catch (error) {
      this.log('Dropdown selection failed:', error);
      return false;
    }
  }

  // Enhanced scroll into view with human-like behavior
  async scrollIntoView(element) {
    if (!element) return;
    
    // Add random scroll offset to make it look more natural
    const randomOffset = this.randomDelay(-100, 100);
    
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'center'
    });
    
    // Add slight delay and random adjustment
    await this.delay(this.randomDelay(300, 600));
    
    if (randomOffset !== 0) {
      window.scrollBy(0, randomOffset);
      await this.delay(this.randomDelay(100, 300));
    }
  }

  // Enhanced file upload with proper event simulation
  async uploadFiles(fileInputSelectors, files) {
    try {
      const fileInput = await this.waitForElement(fileInputSelectors, 5000);
      await this.scrollIntoView(fileInput);
      
      // Create FileList-like object
      const fileList = {
        length: files.length,
        item: (index) => files[index],
        [Symbol.iterator]: function* () {
          for (let i = 0; i < files.length; i++) {
            yield files[i];
          }
        }
      };
      
      // Add files as indexed properties
      files.forEach((file, index) => {
        fileList[index] = file;
      });
      
      // Set files using React-native approach
      this.setNativeValue(fileInput, '');
      Object.defineProperty(fileInput, 'files', {
        value: fileList,
        writable: false
      });
      
      // Trigger change event
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await this.delay(this.randomDelay(500, 1000));
      
      return true;
    } catch (error) {
      this.log('File upload failed:', error);
      return false;
    }
  }

  // Main posting workflow with enhanced error recovery
  async postVehicle(vehicleData) {
    try {
      this.log('🚗 Starting enhanced vehicle posting process...', vehicleData);
      
      for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
        try {
          // Navigate to marketplace with retry logic
          await this.navigateToMarketplace();
          await this.delay(2000, attempt);
          
          // Fill form with enhanced automation
          await this.fillVehicleForm(vehicleData);
          await this.delay(1000, attempt);
          
          // Handle image uploads if images are provided
          if (vehicleData.images && vehicleData.images.length > 0) {
            await this.handleImageUploads(vehicleData.images);
            await this.delay(1000, attempt);
          }
          
          // Submit with verification
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
            
            // Try to recover by refreshing the page
            if (attempt > 0) {
              window.location.reload();
              await this.delay(5000);
            }
          }
        }
      }
      
      throw new Error('All retry attempts failed');
      
    } catch (error) {
      this.log('❌ Vehicle posting failed completely:', error);
      return { success: false, error: error.message };
    }
  }

  // Enhanced navigation with better error handling
  async navigateToMarketplace() {
    const currentUrl = window.location.href;
    this.log('📍 Current URL:', currentUrl);
    
    if (currentUrl.includes('facebook.com/marketplace/create/vehicle')) {
      this.log('✅ Already on vehicle creation page');
      return;
    }
    
    if (currentUrl.includes('facebook.com/marketplace/create')) {
      this.log('📝 On marketplace create page, checking for vehicle category...');
      
      // Look for vehicle category button/option
      const vehicleCategorySelectors = [
        'aria:Vehicle',
        'text:Vehicle',
        'text:Car',
        'text:Truck',
        '[data-testid*="vehicle"]',
        '[data-testid*="car"]'
      ];
      
      try {
        const vehicleCategory = await this.waitForElement(vehicleCategorySelectors, 3000);
        await this.scrollIntoView(vehicleCategory);
        await this.delay(this.randomDelay(300, 600));
        vehicleCategory.click();
        await this.delay(this.randomDelay(1000, 2000));
        return;
      } catch (error) {
        this.log('⚠️ Could not find vehicle category, proceeding anyway');
      }
    }
    
    // Navigate to marketplace create page
    if (!currentUrl.includes('facebook.com/marketplace')) {
      this.log('🧭 Navigating to Facebook Marketplace...');
      window.location.href = 'https://www.facebook.com/marketplace/create/vehicle';
      await this.delay(5000);
    }
  }

  // Enhanced form filling with React-native value setting
  async fillVehicleForm(vehicleData) {
    this.log('📝 Filling vehicle form with enhanced automation...');
    
    // FIRST: Handle vehicle type dropdown selection
    await this.selectVehicleType();
    
    // SECOND: Fill Year dropdown
    await this.selectYear(vehicleData.year);
    
    // THIRD: Fill Make dropdown  
    await this.selectMake(vehicleData.make);
    
    // FOURTH: Fill Model input
    await this.fillModel(vehicleData.model);
    
    // FIFTH: Fill Mileage if available
    if (vehicleData.mileage) {
      await this.fillMileage(vehicleData.mileage);
    }
    
    // SIXTH: Fill Price
    await this.fillPrice(vehicleData.price);
    
    // SEVENTH: Fill Description (this one works)
    const description = vehicleData.description || `${vehicleData.year} ${vehicleData.make} ${vehicleData.model} for sale. Contact for more details.`;
    await this.fillDescription(description);
    
    this.log('✅ Form filling sequence completed');
  }

  // Select Year dropdown
  async selectYear(year) {
    try {
      this.log(`🗓️ Selecting year: ${year}`);
      console.log(`[YEAR DEBUG] Starting year selection for: ${year}`);
      
      // Look for year dropdown more specifically using XPath and standard selectors
      const yearDropdownSelectors = [
        'text:Year', // This will use XPath
        '[aria-label*="Year"]',
        'div[role="button"]', // Generic fallback
        'select'
      ];
      
      console.log('[YEAR DEBUG] Searching for year dropdown with selectors:', yearDropdownSelectors);
      const yearDropdown = await this.waitForElement(yearDropdownSelectors, 8000);
      
      if (!yearDropdown) {
        console.error('[YEAR DEBUG] No year dropdown found!');
        throw new Error('Year dropdown not found');
      }
      
      console.log('[YEAR DEBUG] Found year dropdown:', yearDropdown);
      console.log('[YEAR DEBUG] Dropdown tagName:', yearDropdown.tagName);
      console.log('[YEAR DEBUG] Dropdown innerHTML:', yearDropdown.innerHTML);
      console.log('[YEAR DEBUG] Dropdown attributes:', Array.from(yearDropdown.attributes).map(attr => `${attr.name}="${attr.value}"`));
      
      await this.scrollIntoView(yearDropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      this.log('📅 Found year dropdown, clicking to open...');
      console.log('[YEAR DEBUG] Clicking year dropdown...');
      yearDropdown.click();
      await this.delay(this.randomDelay(2000, 3000)); // Wait for dropdown to open
      
      // Check if dropdown opened by looking for options
      console.log('[YEAR DEBUG] Checking if dropdown opened...');
      const allOptions = document.querySelectorAll('[role="option"]');
      console.log('[YEAR DEBUG] Found options after click:', allOptions.length);
      allOptions.forEach((opt, i) => {
        console.log(`[YEAR DEBUG] Option ${i}:`, opt.textContent?.trim(), opt);
      });
      
      // Look for year option more specifically using XPath - EXACT same as vehicle type
      const yearOptionSelectors = [
        `text:${year}`, // Use XPath for text content
        `[data-value="${year}"]`,
        `[role="option"]`
      ];
      
      console.log('[YEAR DEBUG] Searching for year option with selectors:', yearOptionSelectors);
      const yearOption = await this.waitForElement(yearOptionSelectors, 5000);
      
      if (!yearOption) {
        console.error(`[YEAR DEBUG] No year option found for: ${year}`);
        // Try to find any year options to debug
        const anyYearOptions = document.querySelectorAll('[role="option"]');
        console.log('[YEAR DEBUG] Available options:', Array.from(anyYearOptions).map(opt => opt.textContent?.trim()));
        throw new Error(`Year option ${year} not found`);
      }
      
      console.log('[YEAR DEBUG] Found year option:', yearOption);
      console.log('[YEAR DEBUG] Option text content:', yearOption.textContent?.trim());
      
      await this.scrollIntoView(yearOption);
      await this.delay(this.randomDelay(300, 600));
      
      console.log('[YEAR DEBUG] Clicking year option...');
      yearOption.click();
      
      await this.delay(this.randomDelay(2000, 3000)); // Wait for selection to register
      
      // Verify selection worked - check multiple ways
      console.log('[YEAR DEBUG] Verifying year selection...');
      const selectedValue = yearDropdown.textContent?.trim() || yearDropdown.value;
      console.log('[YEAR DEBUG] Dropdown selected value:', selectedValue);
      
      // Check if any input fields have the year value
      const yearInputs = document.querySelectorAll('input[type="text"], input[type="number"], input[name*="year"], [aria-label*="Year"]');
      console.log('[YEAR DEBUG] Checking year inputs:', yearInputs.length);
      yearInputs.forEach((input, i) => {
        console.log(`[YEAR DEBUG] Input ${i} value:`, input.value, 'name:', input.name, 'aria-label:', input.getAttribute('aria-label'));
      });
      
      // Check if the dropdown still shows the placeholder or selected value
      const dropdownText = yearDropdown.textContent?.trim();
      const dropdownValue = yearDropdown.getAttribute('data-value') || yearDropdown.value;
      console.log('[YEAR DEBUG] Final dropdown text:', dropdownText);
      console.log('[YEAR DEBUG] Final dropdown data-value:', dropdownValue);
      
      // More aggressive verification - check if year appears anywhere in the form
      const formContainer = yearDropdown.closest('form') || document.querySelector('form');
      if (formContainer) {
        const yearInForm = formContainer.textContent?.includes(year.toString());
        console.log('[YEAR DEBUG] Year appears in form:', yearInForm);
      }
      
      // Check if this looks like success (either dropdown shows year or some input has year)
      const hasYearInDropdown = dropdownText?.includes(year.toString()) || dropdownValue?.includes(year.toString());
      const hasYearInInput = Array.from(yearInputs).some(input => input.value?.includes(year.toString()));
      const selectionSuccess = hasYearInDropdown || hasYearInInput;
      
      console.log('[YEAR DEBUG] Year in dropdown:', hasYearInDropdown);
      console.log('[YEAR DEBUG] Year in input:', hasYearInInput);
      console.log('[YEAR DEBUG] Overall success:', selectionSuccess);
      
      if (!selectionSuccess) {
        console.warn('[YEAR DEBUG] Year selection may have failed - no evidence of selection found');
        this.log(`⚠️ Year selection verification failed for: ${year}`);
        return false;
      }
      
      this.log(`✅ Successfully selected year: ${year}`);
      console.log(`[YEAR DEBUG] Year selection completed successfully`);
      return true;
      
    } catch (error) {
      console.error(`[YEAR DEBUG] Year selection failed:`, error);
      console.error(`[YEAR DEBUG] Error stack:`, error.stack);
      this.log(`⚠️ Could not select year: ${year}`, error);
      return false;
    }
  }

  // Select Make dropdown  
  async selectMake(make) {
    try {
      this.log(`🏭 Selecting make: ${make}`);
      
      // Clean make string (remove extra spaces)
      const cleanMake = make.trim();
      
      // Look for make dropdown more specifically 
      const makeDropdownSelectors = [
        'text:Make', // Use XPath
        '[aria-label*="Make"]',
        'div[role="button"]', // Generic fallback after year
        'select'
      ];
      
      const makeDropdown = await this.waitForElement(makeDropdownSelectors, 8000);
      await this.scrollIntoView(makeDropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      this.log('🏭 Found make dropdown, clicking to open...');
      makeDropdown.click();
      await this.delay(this.randomDelay(2000, 3000)); // Wait for dropdown to open
      
      // Look for make option more specifically using XPath - EXACT same as vehicle type
      const makeOptionSelectors = [
        `text:${cleanMake}`, // Use XPath for text content
        `text:${cleanMake.trim()}`,
        `[data-value*="${cleanMake.toLowerCase()}"]`,
        `[role="option"]`
      ];
      
      const makeOption = await this.waitForElement(makeOptionSelectors, 5000);
      await this.scrollIntoView(makeOption);
      await this.delay(this.randomDelay(300, 600));
      makeOption.click();
      
      await this.delay(this.randomDelay(2000, 3000)); // Wait for selection to register
      this.log(`✅ Successfully selected make: ${cleanMake}`);
      return true;
      
    } catch (error) {
      this.log(`⚠️ Could not select make: ${make}`, error);
      return false;
    }
  }

  // Fill Model input
  async fillModel(model) {
    try {
      this.log(`🚗 Filling model: ${model}`);
      
      const modelInputSelectors = [
        '[aria-label*="Model"]', 
        'input[placeholder*="Model"]',
        'input[name*="model"]',
        'text:Model', // May appear as label text
        'input[type="text"]:not([aria-label*="Year"]):not([aria-label*="Make"])'
      ];
      
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

  // Fill Mileage input
  async fillMileage(mileage) {
    try {
      this.log(`📏 Filling mileage: ${mileage}`);
      
      const mileageInputSelectors = [
        '[aria-label*="Mileage"]', 
        'input[placeholder*="Mileage"]',
        'input[name*="mileage"]',
        'text:Mileage', // May appear as label text
        'input[type="number"]:not([aria-label*="Price"]):not([aria-label*="Year"])'
      ];
      
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

  // Fill Price input
  async fillPrice(price) {
    try {
      this.log(`💰 Filling price: ${price}`);
      
      const priceInputSelectors = [
        '[aria-label*="Price"]', 
        'input[placeholder*="Price"]',
        'input[name*="price"]',
        'text:Price', // May appear as label text  
        'input[type="number"]:not([aria-label*="Mileage"]):not([aria-label*="Year"])'
      ];
      
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

  // Fill Description textarea
  async fillDescription(description) {
    try {
      this.log(`📝 Filling description: ${description}`);
      
      const descriptionInput = await this.waitForElement(['[aria-label*="Description"]', 'textarea'], 5000);
      await this.scrollIntoView(descriptionInput);
      await this.typeHumanLike(descriptionInput, description);
      
      this.log(`✅ Successfully filled description`);
      return true;
    } catch (error) {
      this.log(`⚠️ Could not fill description`, error);
      return false;
    }
  }

  // Vehicle type dropdown selection
  async selectVehicleType() {
    try {
      this.log('🚗 Selecting vehicle type dropdown first...');
      
      // Look for the actual Vehicle type dropdown in the form, not search bar
      const vehicleDropdownSelectors = [
        'text:Vehicle type', // Use XPath to find by text
        '[aria-label*="Vehicle type"]',
        'form select:first-of-type',
        'form div[role="button"]:first-of-type'
      ];
      
      // Wait longer and be more specific
      await this.delay(2000); // Wait for page to fully load
      
      const dropdown = await this.waitForElement(vehicleDropdownSelectors, 10000);
      await this.scrollIntoView(dropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      this.log('📝 Found vehicle type dropdown, clicking...');
      dropdown.click();
      await this.delay(this.randomDelay(2000, 3000)); // Wait longer for dropdown to open
      
      // Look for Car/Truck option more specifically using XPath
      const carTruckSelectors = [
        'text:Car/Truck', // Use XPath for text content
        'text:Car',
        '[data-value*="car"]',
        '[role="option"]'
      ];
      
      const option = await this.waitForElement(carTruckSelectors, 5000);
      await this.scrollIntoView(option);
      await this.delay(this.randomDelay(300, 600));
      option.click();
      
      await this.delay(this.randomDelay(2000, 3000)); // Wait for selection to register
      this.log('✅ Successfully selected vehicle type');
      return true;
      
    } catch (error) {
      this.log('⚠️ Could not select vehicle type:', error);
      return false;
    }
  }

  // Enhanced image upload handling
  async handleImageUploads(images) {
    try {
      this.log('📸 Processing image uploads...');
      
      const uploadSelectors = [
        'input[type="file"]',
        'input[accept*="image"]',
        '[data-testid*="photo"]',
        '[data-testid*="image"]',
        '.file-input'
      ];
      
      // Convert image URLs to File objects (simplified for demo)
      const files = await Promise.all(images.map(async (imageUrl, index) => {
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          return new File([blob], `vehicle_image_${index + 1}.jpg`, { type: 'image/jpeg' });
        } catch (error) {
          this.log('⚠️ Could not process image:', imageUrl, error);
          return null;
        }
      }));
      
      const validFiles = files.filter(file => file !== null);
      
      if (validFiles.length > 0) {
        await this.uploadFiles(uploadSelectors, validFiles);
        this.log(`✅ Uploaded ${validFiles.length} images`);
      }
      
    } catch (error) {
      this.log('⚠️ Image upload failed:', error);
    }
  }

  // Enhanced form submission with verification
  async submitListing() {
    try {
      this.log('🚀 Submitting listing...');
      
      const submitSelectors = [
        'aria:Next',
        'aria:Post',
        'aria:Publish',
        'aria:Submit',
        'text:Next',
        'text:Post',
        'text:Publish',
        'button[type="submit"]',
        '[data-testid*="submit"]',
        '[data-testid*="next"]',
        '.btn-primary'
      ];
      
      const submitButton = await this.waitForElement(submitSelectors, 10000);
      await this.scrollIntoView(submitButton);
      
      // Add final delay before submission
      await this.delay(this.randomDelay(1000, 2000));
      
      submitButton.click();
      
      // Wait for submission confirmation or next step
      await this.delay(3000);
      
      // Verify submission success
      const successIndicators = [
        'text:posted',
        'text:published',
        'text:success',
        'text:Your listing is now live',
        '[data-testid*="success"]'
      ];
      
      try {
        await this.waitForElement(successIndicators, 5000);
        this.log('✅ Submission confirmed');
        return true;
      } catch (error) {
        // Check if we're on a preview/confirmation page
        if (window.location.href.includes('preview') || 
            window.location.href.includes('confirm')) {
          this.log('📋 On preview/confirmation page, looking for final submit...');
          
          const finalSubmitSelectors = [
            'aria:Publish',
            'aria:Post',
            'text:Publish',
            'text:Post',
            'button:contains("Publish")',
            'button:contains("Post")'
          ];
          
          try {
            const finalSubmit = await this.waitForElement(finalSubmitSelectors, 5000);
            await this.scrollIntoView(finalSubmit);
            await this.delay(this.randomDelay(500, 1000));
            finalSubmit.click();
            await this.delay(3000);
            return true;
          } catch (finalError) {
            this.log('⚠️ Could not find final submit button');
          }
        }
        
        this.log('⚠️ Could not verify submission success');
        return false;
      }
      
    } catch (error) {
      this.log('❌ Submission failed:', error);
      return false;
    }
  }

  // Enhanced logging with debug mode
  log(...args) {
    if (this.debugMode) {
      console.log('[Salesonator Enhanced]', ...args);
    }
  }

  // Message listener setup
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.log('📨 Received message:', request);
      
      if (request.action === 'postVehicle') {
        this.postVehicle(request.vehicle)
          .then(result => {
            this.log('📤 Sending response:', result);
            sendResponse(result);
          })
          .catch(error => {
            this.log('❌ Error in postVehicle:', error);
            sendResponse({ success: false, error: error.message });
          });
        
        return true; // Keep message channel open for async response
      }
      
      if (request.action === 'checkLogin') {
        const isLoggedIn = this.checkFacebookLogin();
        sendResponse({ loggedIn: isLoggedIn });
      }
      
      if (request.action === 'ping') {
        sendResponse({ status: 'ready', enhanced: true });
      }
    });
  }

  // Check if user is logged into Facebook
  checkFacebookLogin() {
    const loginIndicators = [
      '[data-testid="blue_bar_profile_link"]',
      '[data-testid="left_nav_menu_item_Marketplace"]',
      '[aria-label*="Profile"]',
      '.fb_logo'
    ];
    
    return loginIndicators.some(selector => document.querySelector(selector) !== null);
  }
}

// Initialize the enhanced automator
const salesonatorAutomator = new SalesonatorAutomator();
console.log('✅ Salesonator Enhanced Automator loaded successfully');