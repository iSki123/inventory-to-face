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

  // Enhanced robust selector strategy - Fixed for Facebook
  findElementWithFallbacks(selectors, parentElement = document) {
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
        
        // Enhanced text content selector - FIXED for Facebook dropdowns
        else if (selector.startsWith('text:')) {
          const text = selector.replace('text:', '');
          
          // Method 1: Find interactive elements first (buttons, options, links)
          const interactiveSelectors = [
            `[role="option"]:contains("${text}")`,
            `button:contains("${text}")`,
            `[role="button"]:contains("${text}")`,
            `div[role="option"]`,
            `li[role="option"]`,
            `div[tabindex]`,
            `span[role="button"]`
          ];
          
          for (const sel of interactiveSelectors) {
            try {
              if (sel.includes(':contains')) {
                // Manual text search for interactive elements
                const baseSelector = sel.split(':contains')[0];
                const elements = Array.from(parentElement.querySelectorAll(baseSelector));
                const found = elements.find(el => {
                  const textContent = el.textContent?.trim() || '';
                  const innerText = el.innerText?.trim() || '';
                  return textContent === text || innerText === text || 
                         textContent.includes(text) || innerText.includes(text);
                });
                if (found && this.isInteractiveElement(found)) return found;
              } else {
                const elements = Array.from(parentElement.querySelectorAll(sel));
                const found = elements.find(el => {
                  const textContent = el.textContent?.trim() || '';
                  return textContent === text || textContent.includes(text);
                });
                if (found && this.isInteractiveElement(found)) return found;
              }
            } catch (e) {}
          }
          
          // Method 2: XPath approach with filtering for non-script elements
          try {
            const xpath = `.//*[not(self::script) and not(self::style) and contains(normalize-space(text()), "${text}")]`;
            const result = document.evaluate(xpath, parentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (result.singleNodeValue && this.isInteractiveElement(result.singleNodeValue)) {
              return result.singleNodeValue;
            }
          } catch (e) {}
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

  // Helper to check if element is interactive
  isInteractiveElement(element) {
    if (!element) return false;
    
    // Exclude script tags, style tags, and other non-interactive elements
    const tagName = element.tagName?.toLowerCase();
    if (['script', 'style', 'meta', 'link', 'title'].includes(tagName)) {
      return false;
    }
    
    // Check for interactive attributes/roles
    const role = element.getAttribute('role');
    const tabindex = element.getAttribute('tabindex');
    const clickable = element.onclick || role === 'button' || role === 'option' || 
                     tagName === 'button' || tagName === 'a' || tabindex !== null;
    
    return clickable;
  }

  // Helper function to find elements containing specific text
  findElementByText(text, tagNames = ['div', 'li', 'button', 'span'], parentElement = document) {
    const elements = Array.from(parentElement.querySelectorAll(tagNames.join(', ')));
    return elements.find(el => el.textContent && el.textContent.trim().includes(text));
  }

  // Enhanced human-like typing with better Facebook compatibility
  async typeHumanLike(element, text, speed = 'normal') {
    await this.scrollIntoView(element);
    await this.delay(this.randomDelay(300, 600));
    
    // Focus with multiple attempts
    for (let attempt = 0; attempt < 3; attempt++) {
      element.focus();
      await this.delay(this.randomDelay(100, 200));
      if (document.activeElement === element) break;
    }
    
    // Clear existing content more aggressively
    try {
      element.select();
      await this.delay(50);
    } catch (e) {}
    
    // Multiple clear methods
    this.setNativeValue(element, '');
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await this.delay(this.randomDelay(100, 200));
    
    const speedMultipliers = {
      slow: [150, 300],
      normal: [80, 200],
      fast: [50, 120]
    };
    
    const [minDelay, maxDelay] = speedMultipliers[speed] || speedMultipliers.normal;
    
    // Type character by character with enhanced React support
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const currentValue = element.value + char;
      
      // Multiple methods to set value (React compatibility)
      this.setNativeValue(element, currentValue);
      element.value = currentValue;
      
      // Trigger multiple events for React
      element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
      
      // Realistic typing variations
      if (Math.random() < 0.15) {
        await this.delay(this.randomDelay(300, 800)); // Thinking pause
      } else {
        await this.delay(this.randomDelay(minDelay, maxDelay));
      }
    }
    
    // Final validation events
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    element.dispatchEvent(new Event('focusout', { bubbles: true }));
    await this.delay(this.randomDelay(200, 400));
    
    // Verify the value was set
    if (element.value !== text) {
      console.warn(`[TYPE] Value verification failed. Expected: "${text}", Got: "${element.value}"`);
      // Try one more time
      this.setNativeValue(element, text);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
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
            this.log('📸 Starting image upload process...');
            await this.handleImageUploads(vehicleData.images);
            await this.delay(2000, attempt);
          } else {
            this.log('⚠️ No images provided for upload');
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

  // Select Year dropdown with improved detection
  async selectYear(year) {
    try {
      this.log(`🗓️ Selecting year: ${year}`);
      console.log(`[YEAR DEBUG] Starting year selection for: ${year}`);
      
      // Enhanced year dropdown selectors based on reverse engineering findings
      const yearDropdownSelectors = [
        'text:Year', // XPath text search (most reliable)
        'aria:Year', // ARIA label approach
        'text:Select year', // Alternative text
        'placeholder:Year',
        '[aria-label*="Year" i]', // Case insensitive
        '[data-testid*="year" i]',
        'select[name*="year" i]',
        'div[role="button"]:has-text("Year")', // Role with text context
        'div[role="combobox"]:has-text("Year")',
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
        if (i < 20) { // Only log first 20 to avoid truncation
          console.log(`[YEAR DEBUG] Option ${i}:`, opt.textContent?.trim(), opt);
        }
      });
      
      // Enhanced option selection with multiple approaches
      console.log(`[YEAR DEBUG] 🎯 Using enhanced option selection...`);
      
      const yearOptionSelectors = [
        `text:${year}`, // XPath exact text match
        `text:${year.toString().trim()}`, // Trimmed version
        `aria:${year}`, // ARIA approach
        `[data-value="${year}"]`, // Exact data-value
        `[data-value*="${year}"]`, // Contains data-value
        `[value="${year}"]`, // Standard value attribute
        `[role="option"][aria-label*="${year}"]`, // Role with ARIA
        `[role="option"]` // Generic option fallback
      ];
      
      console.log(`[YEAR DEBUG] Searching for year option with selectors:`, yearOptionSelectors);
      
      const yearOption = await this.waitForElement(yearOptionSelectors, 5000);
      
      if (!yearOption) {
        console.error(`[YEAR DEBUG] ❌ Year option not found using waitForElement!`);
        // Fallback to manual search if needed
        const fallbackOptions = document.querySelectorAll('[role="option"]');
        console.log(`[YEAR DEBUG] Available options for fallback:`, Array.from(fallbackOptions).slice(0, 10).map(opt => opt.textContent?.trim()));
        return false;
      }
      
      console.log(`[YEAR DEBUG] ✅ Found year option using waitForElement:`, yearOption);
      console.log(`[YEAR DEBUG] Option text:`, yearOption.textContent?.trim());
      console.log(`[YEAR DEBUG] Option tagName:`, yearOption.tagName);
      console.log(`[YEAR DEBUG] Option role:`, yearOption.getAttribute('role'));
      console.log(`[YEAR DEBUG] Option ID:`, yearOption.id);
      console.log(`[YEAR DEBUG] Option classes:`, yearOption.className);
      
      // Let's check what the manual search would find for comparison
      const manualOptions = document.querySelectorAll('[role="option"]');
      const manualMatch = Array.from(manualOptions).find(opt => opt.textContent?.trim() === year.toString());
      console.log(`[YEAR DEBUG] 🔍 Manual search would find:`, manualMatch);
      console.log(`[YEAR DEBUG] 🔍 Are they the same element?`, yearOption === manualMatch);
      
      if (manualMatch && yearOption !== manualMatch) {
        console.log(`[YEAR DEBUG] ⚠️ DIFFERENT ELEMENTS! Switching to manual match...`);
        await this.performFacebookDropdownClick(manualMatch);
      } else {
        console.log(`[YEAR DEBUG] 🖱️ Using React-compatible click sequence...`);
        await this.performFacebookDropdownClick(yearOption);
      }
      
      await this.delay(this.randomDelay(2000, 3000)); // Wait for selection to register
      
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

  // Enhanced image upload handling with Facebook-specific targeting
  async handleImageUploads(images) {
    try {
      this.log('📸 Processing image uploads for Facebook Marketplace...');
      
      // Facebook-specific upload selectors
      const uploadSelectors = [
        'input[type="file"][accept*="image"]',
        'input[type="file"]',
        '[data-testid*="photo-upload"]',
        '[data-testid*="image-upload"]',
        '[aria-label*="photo" i]',
        '[aria-label*="image" i]',
        'input[accept*="image"]',
        'input[multiple][accept*="image"]'
      ];
      
      // Look for upload area or button first
      const uploadAreaSelectors = [
        'text:Add photos',
        'text:Upload photos',
        'text:Add images',
        '[data-testid*="upload"]',
        '.upload-area',
        '[role="button"]:contains("photo")'
      ];
      
      // Try to find upload area first
      let uploadTrigger = null;
      for (const selector of uploadAreaSelectors) {
        uploadTrigger = this.findElementWithFallbacks([selector]);
        if (uploadTrigger) {
          this.log('📸 Found upload trigger:', selector);
          break;
        }
      }
      
      // Click upload area to reveal file input if needed
      if (uploadTrigger && uploadTrigger.tagName !== 'INPUT') {
        this.log('📸 Clicking upload area to reveal file input...');
        await this.performFacebookDropdownClick(uploadTrigger);
        await this.delay(this.randomDelay(1000, 2000));
      }
      
      // Find file input after potential click
      let fileInput = null;
      for (const selector of uploadSelectors) {
        fileInput = document.querySelector(selector);
        if (fileInput && !fileInput.disabled && !fileInput.hidden) {
          this.log('📸 Found file input:', selector);
          break;
        }
      }
      
      if (!fileInput) {
        this.log('❌ No file input found for image upload');
        return;
      }
      
      // Convert image URLs to File objects
      this.log(`📸 Converting ${images.length} image URLs to files...`);
      const files = await Promise.all(images.map(async (imageUrl, index) => {
        try {
          this.log(`📸 Processing image ${index + 1}: ${imageUrl}`);
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const blob = await response.blob();
          return new File([blob], `vehicle_image_${index + 1}.jpg`, { type: 'image/jpeg' });
        } catch (error) {
          this.log(`⚠️ Could not process image ${index + 1}:`, imageUrl, error);
          return null;
        }
      }));
      
      const validFiles = files.filter(file => file !== null);
      this.log(`📸 Successfully processed ${validFiles.length} out of ${images.length} images`);
      
      if (validFiles.length > 0) {
        await this.uploadFilesToInput(fileInput, validFiles);
        this.log(`✅ Uploaded ${validFiles.length} images to Facebook`);
      } else {
        this.log('❌ No valid images to upload');
      }
      
    } catch (error) {
      this.log('❌ Image upload failed:', error);
    }
  }

  // Enhanced file upload specifically for Facebook
  async uploadFilesToInput(fileInput, files) {
    try {
      this.log(`📸 Uploading ${files.length} files to input element...`);
      
      // Create DataTransfer object
      const dataTransfer = new DataTransfer();
      
      // Add all files to the DataTransfer
      files.forEach((file, index) => {
        this.log(`📸 Adding file ${index + 1}: ${file.name} (${file.size} bytes)`);
        dataTransfer.items.add(file);
      });
      
      // Set the files on the input
      fileInput.files = dataTransfer.files;
      
      // Trigger all necessary events for Facebook's React system
      const events = [
        new Event('input', { bubbles: true }),
        new Event('change', { bubbles: true }),
        new Event('blur', { bubbles: true })
      ];
      
      for (const event of events) {
        fileInput.dispatchEvent(event);
        await this.delay(this.randomDelay(100, 300));
      }
      
      this.log(`✅ File upload events dispatched successfully`);
      
    } catch (error) {
      this.log('❌ File upload to input failed:', error);
      throw error;
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

  // Enhanced Facebook React dropdown click with aggressive retry
  async performFacebookDropdownClick(element) {
    try {
      console.log(`[FACEBOOK CLICK] Starting enhanced React-compatible click sequence...`);
      
      // Ensure element is in view and focused
      await this.scrollIntoView(element);
      await this.delay(this.randomDelay(300, 500));

      // Clear any existing selections first
      document.getSelection()?.removeAllRanges();

      // Method 1: Standard click with focus preparation
      element.focus();
      await this.delay(this.randomDelay(200, 400));
      
      // Aggressive event sequence for Facebook's React system
      const clickEvents = [
        () => element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true })),
        () => element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true })),
        () => element.focus(),
        () => element.dispatchEvent(new FocusEvent('focusin', { bubbles: true })),
        () => element.dispatchEvent(new MouseEvent('mousedown', { 
          bubbles: true, cancelable: true, button: 0, detail: 1,
          clientX: element.getBoundingClientRect().left + 10,
          clientY: element.getBoundingClientRect().top + 10
        })),
        () => element.dispatchEvent(new MouseEvent('mouseup', { 
          bubbles: true, cancelable: true, button: 0, detail: 1,
          clientX: element.getBoundingClientRect().left + 10,
          clientY: element.getBoundingClientRect().top + 10
        })),
        () => element.click(), // Standard click
        () => element.dispatchEvent(new MouseEvent('click', { 
          bubbles: true, cancelable: true, button: 0, detail: 1,
          clientX: element.getBoundingClientRect().left + 10,
          clientY: element.getBoundingClientRect().top + 10
        })),
        () => element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 })),
        () => element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }))
      ];

      // Execute events with delays
      for (const eventFn of clickEvents) {
        try {
          eventFn();
          await this.delay(this.randomDelay(50, 150));
        } catch (e) {
          console.warn(`[FACEBOOK CLICK] Event execution failed:`, e);
        }
      }

      // Try keyboard trigger as backup
      try {
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await this.delay(100);
        element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
        await this.delay(100);
        element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); // Space key
        await this.delay(100);
        element.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
      } catch (e) {
        console.warn(`[FACEBOOK CLICK] Keyboard events failed:`, e);
      }

      console.log(`[FACEBOOK CLICK] Enhanced React-compatible click sequence completed`);
      
    } catch (error) {
      console.error(`[FACEBOOK CLICK] Error in enhanced React click sequence:`, error);
      // Last resort fallback
      try {
        element.click();
      } catch (fallbackError) {
        console.error(`[FACEBOOK CLICK] Even simple click failed:`, fallbackError);
      }
    }
  }
}

// Initialize the enhanced automator
const salesonatorAutomator = new SalesonatorAutomator();
console.log('✅ Salesonator Enhanced Automator loaded successfully');