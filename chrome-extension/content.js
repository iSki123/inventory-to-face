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
        
        // Text content selector using multiple approaches
        else if (selector.startsWith('text:')) {
          const text = selector.replace('text:', '');
          
          // Method 1: XPath approach (most reliable)
          try {
            const xpath = `.//*[contains(normalize-space(text()), "${text}")]`;
            const result = document.evaluate(xpath, parentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (result.singleNodeValue) {
              // Filter out disabled or hidden elements
              const elem = result.singleNodeValue;
              if (!elem.hasAttribute('aria-disabled') && !elem.hasAttribute('aria-hidden')) {
                return elem;
              }
            }
          } catch (e) {}
          
          // Method 2: Manual text search with element filtering
          const elements = Array.from(parentElement.querySelectorAll('*'));
          const found = elements.find(el => {
            const textContent = el.textContent?.trim() || '';
            const innerText = el.innerText?.trim() || '';
            const isMatch = textContent.includes(text) || innerText.includes(text);
            
            // Filter out disabled, hidden, or back buttons
            if (isMatch) {
              const ariaLabel = el.getAttribute('aria-label') || '';
              const isDisabled = el.hasAttribute('aria-disabled') && el.getAttribute('aria-disabled') === 'true';
              const isHidden = el.hasAttribute('aria-hidden') && el.getAttribute('aria-hidden') === 'true';
              const isBackButton = ariaLabel.toLowerCase().includes('back');
              
              return !isDisabled && !isHidden && !isBackButton;
            }
            return false;
          });
          if (found) return found;
        }
        
        // Regular CSS selector (skip invalid ones)
        else {
          // Skip invalid CSS selectors with :has-text pseudo-selector
          if (selector.includes(':has-text(') || selector.includes(':contains(')) {
            continue;
          }
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
    
    // SEVENTH: Fill Body Style (map from NHTSA if needed)
    const mappedBodyStyle = vehicleData.bodyStyle || vehicleData.body_style || this.mapBodyStyle(vehicleData.body_style_nhtsa || vehicleData.vehicle_type_nhtsa || '');
    if (mappedBodyStyle) {
      await this.selectBodyStyle(mappedBodyStyle);
    }
    
    // EIGHTH: Fill Exterior Color (standardize to FB options)
    const standardizedExterior = this.standardizeExteriorColor(vehicleData.exteriorColor || vehicleData.exterior_color);
    if (standardizedExterior && standardizedExterior !== 'Unknown') {
      await this.selectExteriorColor(standardizedExterior);
    }
    
    // NINTH: Fill Interior Color (default to Black if unknown)
    const standardizedInterior = this.standardizeInteriorColor(vehicleData.interiorColor || vehicleData.interior_color);
    if (standardizedInterior) {
      await this.selectInteriorColor(standardizedInterior);
    }
    
    // TENTH: Check Clean Title (always default to checked)
    await this.selectCleanTitle(true);
    
    // ELEVENTH: Select Vehicle Condition (default to "Excellent")
    await this.selectVehicleCondition(vehicleData.condition || 'Excellent');
    
    // TWELFTH: Select Fuel Type (map from NHTSA if present)
    const mappedFuel = vehicleData.fuelType || vehicleData.fuel_type || (vehicleData.fuel_type_nhtsa ? this.mapFuelType(vehicleData.fuel_type_nhtsa) : null);
    if (mappedFuel) {
      await this.selectFuelType(mappedFuel);
    }

    // THIRTEENTH: Select Transmission (default to Automatic)
    const mappedTransmission = this.mapTransmission(vehicleData.transmission || vehicleData.transmission_nhtsa || '');
    await this.selectTransmission(mappedTransmission);
    
    // FOURTEENTH: Fill Description with AI description from database if available
    const description = vehicleData.ai_description || 
                       vehicleData.description || 
                       `${vehicleData.year} ${vehicleData.make} ${vehicleData.model} for sale. Contact for more details.`;
    await this.fillDescription(description);
    
    this.log('✅ Form filling sequence completed');
  }

  // Select Year dropdown with improved detection
  async selectYear(year) {
    try {
      this.log(`🗓️ Selecting year: ${year}`);
      console.log(`[YEAR DEBUG] Starting year selection for: ${year}`);
      
      // Find year dropdown more reliably
      const yearDropdownSelectors = [
        'text:Year',
        '[aria-label*="Year"]',
        'div[role="button"]:has-text("Year")',
        'span:has-text("Year")',
        '[data-testid*="year"]'
      ];
      
      console.log(`[YEAR DEBUG] Searching for year dropdown with selectors:`, yearDropdownSelectors);
      
      const yearDropdown = await this.waitForElement(yearDropdownSelectors, 8000);
      if (!yearDropdown) {
        throw new Error('Year dropdown not found');
      }
      
      console.log(`[YEAR DEBUG] Found year dropdown:`, yearDropdown);
      console.log(`[YEAR DEBUG] Dropdown tagName:`, yearDropdown.tagName);
      console.log(`[YEAR DEBUG] Dropdown innerHTML:`, yearDropdown.innerHTML);
      console.log(`[YEAR DEBUG] Dropdown attributes:`, Array.from(yearDropdown.attributes).map(a => `${a.name}="${a.value}"`));
      
      await this.scrollIntoView(yearDropdown);
      this.log('📅 Found year dropdown, clicking to open...');
      
      console.log(`[YEAR DEBUG] Clicking year dropdown...`);
      yearDropdown.click();
      await this.delay(2000);
      
      console.log(`[YEAR DEBUG] Checking if dropdown opened...`);
      const optionsAfterClick = document.querySelectorAll('[role="option"]');
      console.log(`[YEAR DEBUG] Found options after click:`, optionsAfterClick.length);
      
      // Log first 20 options to debug
      Array.from(optionsAfterClick).slice(0, 20).forEach((opt, idx) => {
        console.log(`[YEAR DEBUG] Option ${idx}: ${opt.textContent?.trim()}`, opt);
      });
      
      console.log(`[YEAR DEBUG] 🎯 Using enhanced option selection...`);
      
      // Use multiple approaches to find the year option
      let yearOption = null;
      
      // Method 1: Find by exact text match using waitForElement
      try {
        const yearSelectors = [
          `text:${year}`,
          `[role="option"]:has-text("${year}")`,
          `div:has-text("${year}")`,
          `span:has-text("${year}")`,
          `li:has-text("${year}")`,
          `[data-value="${year}"]`,
          `[aria-label*="${year}"]`,
          `*[title="${year}"]`
        ];
        
        console.log(`[YEAR DEBUG] Searching for year option with selectors:`, yearSelectors);
        yearOption = await this.waitForElement(yearSelectors, 3000);
        console.log(`[YEAR DEBUG] ✅ Found year option using waitForElement:`, yearOption);
        console.log(`[YEAR DEBUG] Option text:`, yearOption?.textContent || yearOption?.innerHTML);
        console.log(`[YEAR DEBUG] Option tagName:`, yearOption?.tagName);
        console.log(`[YEAR DEBUG] Option role:`, yearOption?.getAttribute('role'));
        console.log(`[YEAR DEBUG] Option ID:`, yearOption?.id);
        console.log(`[YEAR DEBUG] Option classes:`, yearOption?.className);
        
        // Verify this is actually the year option we want
        const optionText = yearOption?.textContent?.trim();
        const manualYearOption = Array.from(optionsAfterClick).find(opt => 
          opt.textContent?.trim() === year.toString()
        );
        console.log(`[YEAR DEBUG] 🔍 Manual search would find:`, manualYearOption);
        console.log(`[YEAR DEBUG] 🔍 Are they the same element?`, yearOption === manualYearOption);
        
        if (yearOption !== manualYearOption) {
          console.log(`[YEAR DEBUG] ⚠️ DIFFERENT ELEMENTS! Switching to manual match...`);
          yearOption = manualYearOption;
        }
        
      } catch (waitError) {
        console.log(`[YEAR DEBUG] ⚠️ waitForElement failed, falling back to manual search:`, waitError.message);
        
        // Method 2: Manual search through options
        yearOption = Array.from(optionsAfterClick).find(opt => 
          opt.textContent?.trim() === year.toString()
        );
      }
      
      if (!yearOption) {
        throw new Error(`Year option ${year} not found among ${optionsAfterClick.length} options`);
      }
      
      console.log(`[YEAR DEBUG] 📅 Found year option, clicking: ${year}`);
      await this.performFacebookDropdownClick(yearOption);
      await this.delay(2000);
      
      // Enhanced verification
      console.log(`[YEAR DEBUG] Verifying year selection...`);
      await this.delay(500);
      console.log(`[YEAR DEBUG] Dropdown selected value:`, yearDropdown.textContent?.trim());
      
      // Check if year appears in any input fields
      const allInputs = document.querySelectorAll('input');
      console.log(`[YEAR DEBUG] Checking year inputs:`, allInputs.length);
      allInputs.forEach((input, idx) => {
        console.log(`[YEAR DEBUG] Input ${idx} value: ${input.value} name: ${input.name} aria-label: ${input.getAttribute('aria-label')}`);
      });
      
      // Check dropdown text content
      const dropdownText = yearDropdown.textContent?.trim();
      const dropdownDataValue = yearDropdown.getAttribute('data-value');
      console.log(`[YEAR DEBUG] Final dropdown text:`, dropdownText);
      console.log(`[YEAR DEBUG] Final dropdown data-value:`, dropdownDataValue);
      
      // Check if year appears anywhere in the form
      const formContent = document.querySelector('form')?.textContent || document.body.textContent;
      const yearAppearsInForm = formContent.includes(year.toString()) && 
                               (formContent.includes(`${year} `) || formContent.includes(` ${year}`));
      console.log(`[YEAR DEBUG] Year appears in form:`, yearAppearsInForm);
      
      // Multiple verification methods
      const verifications = {
        dropdownContainsYear: dropdownText?.includes(year.toString()),
        dataValueMatches: dropdownDataValue === year.toString(),
        yearInForm: yearAppearsInForm,
        yearInInput: Array.from(allInputs).some(input => input.value === year.toString())
      };
      
      console.log(`[YEAR DEBUG] Year in dropdown:`, verifications.dropdownContainsYear);
      console.log(`[YEAR DEBUG] Year in input:`, verifications.yearInInput);
      console.log(`[YEAR DEBUG] Overall success:`, Object.values(verifications).some(v => v));
      
      const success = Object.values(verifications).some(v => v);
      
      if (success) {
        this.log('✅ Successfully selected year:', year);
        return true;
      } else {
        console.log(`[YEAR DEBUG] Year selection may have failed - no evidence of selection found`);
        this.log('⚠️ Year selection verification failed for:', year);
        return false;
      }
      
    } catch (error) {
      this.log('⚠️ Could not select year:', year, error);
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
        '[data-testid*="model"]'
      ];
      
      const modelInput = await this.waitForElement(modelInputSelectors, 8000);
      if (!modelInput) {
        throw new Error('Model input not found');
      }
      
      await this.scrollIntoView(modelInput);
      
      // Clear existing value and set new one
      modelInput.focus();
      modelInput.select();
      await this.delay(100);
      
      // Use React-compatible value setting
      this.setNativeValue(modelInput, model);
      
      // Trigger React events
      modelInput.dispatchEvent(new Event('input', { bubbles: true }));
      modelInput.dispatchEvent(new Event('change', { bubbles: true }));
      modelInput.dispatchEvent(new Event('blur', { bubbles: true }));
      
      await this.delay(500);
      
      // Verify value was set
      if (modelInput.value === model) {
        this.log('✅ Successfully filled model:', model);
        return true;
      } else {
        this.log('⚠️ Model value verification failed. Expected:', model, 'Got:', modelInput.value);
        // Try typing approach as fallback
        modelInput.focus();
        modelInput.select();
        await this.typeHumanLike(modelInput, model);
        return true;
      }
      
    } catch (error) {
      this.log('⚠️ Could not fill model:', model, error);
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
        'input[placeholder*="mileage"]',
        'input[name*="mileage"]',
        '[data-testid*="mileage"]'
      ];
      
      const mileageInput = await this.waitForElement(mileageInputSelectors, 8000);
      if (!mileageInput) {
        throw new Error('Mileage input not found');
      }
      
      await this.scrollIntoView(mileageInput);
      
      // Clear existing value and set new one
      mileageInput.focus();
      mileageInput.select();
      await this.delay(100);
      
      // Use React-compatible value setting
      this.setNativeValue(mileageInput, mileage.toString());
      
      // Trigger React events
      mileageInput.dispatchEvent(new Event('input', { bubbles: true }));
      mileageInput.dispatchEvent(new Event('change', { bubbles: true }));
      mileageInput.dispatchEvent(new Event('blur', { bubbles: true }));
      
      await this.delay(500);
      
      // Verify value was set
      if (mileageInput.value === mileage.toString()) {
        this.log('✅ Successfully filled mileage:', mileage);
        return true;
      } else {
        this.log('⚠️ Mileage value verification failed. Expected:', mileage.toString(), 'Got:', mileageInput.value);
        // Try typing approach as fallback
        mileageInput.focus();
        mileageInput.select();
        await this.typeHumanLike(mileageInput, mileage.toString());
        return true;
      }
      
    } catch (error) {
      this.log('⚠️ Could not fill mileage:', mileage, error);
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
        'input[placeholder*="price"]',
        'input[name*="price"]',
        '[data-testid*="price"]'
      ];
      
      const priceInput = await this.waitForElement(priceInputSelectors, 8000);
      if (!priceInput) {
        throw new Error('Price input not found');
      }
      
      await this.scrollIntoView(priceInput);
      
      // Clear existing value and set new one
      priceInput.focus();
      priceInput.select();
      await this.delay(100);
      
      // Use React-compatible value setting
      this.setNativeValue(priceInput, price.toString());
      
      // Trigger React events
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      priceInput.dispatchEvent(new Event('blur', { bubbles: true }));
      
      await this.delay(500);
      
      // Verify value was set
      if (priceInput.value === price.toString()) {
        this.log('✅ Successfully filled price:', price);
        return true;
      } else {
        this.log('⚠️ Price value verification failed. Expected:', price.toString(), 'Got:', priceInput.value);
        // Try typing approach as fallback
        priceInput.focus();
        priceInput.select();
        await this.typeHumanLike(priceInput, price.toString());
        return true;
      }
      
    } catch (error) {
      this.log('⚠️ Could not fill price:', price, error);
      return false;
    }
  }

  // Select Body Style dropdown
  async selectBodyStyle(bodyStyle) {
    try {
      this.log(`🚗 Selecting body style: ${bodyStyle}`);
      
      // Find the dropdown by looking for the label text and closest clickable element
      const bodyStyleSelectors = [
        'div:has-text("Body style") + div[role="button"]',
        '[aria-label*="Body style"]',
        'div:has-text("Body style")',
        'span:has-text("Body style")',
        'label:has-text("Body style") + div',
        '*[id*="body"] + div[role="button"]'
      ];
      
      // Look for the actual clickable dropdown element
      let dropdown = null;
      for (let selector of bodyStyleSelectors) {
        try {
          const elements = document.evaluate(
            `//div[contains(text(), "Body style")]/following-sibling::*[contains(@role, "button") or contains(@class, "dropdown")]`,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          if (elements.singleNodeValue) {
            dropdown = elements.singleNodeValue;
            break;
          }
        } catch (e) {
          // Try direct CSS selector
          const els = document.querySelectorAll('div[role="button"], span[role="button"]');
          for (let el of els) {
            if (el.textContent.includes('Body style') || 
                el.parentElement?.textContent.includes('Body style') ||
                el.previousElementSibling?.textContent.includes('Body style')) {
              dropdown = el;
              break;
            }
          }
        }
        if (dropdown) break;
      }
      
      if (!dropdown) {
        throw new Error('Body style dropdown not found');
      }
      
      await this.scrollIntoView(dropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      this.log('🚗 Found body style dropdown, clicking...');
      dropdown.click();
      await this.delay(this.randomDelay(2000, 3000));
      
      // Look for body style option in dropdown menu
      const optionSelectors = [
        `//div[@role="option" and contains(text(), "${bodyStyle}")]`,
        `//div[contains(text(), "${bodyStyle}") and contains(@class, "option")]`,
        `//li[contains(text(), "${bodyStyle}")]`
      ];
      
      let option = null;
      for (let selector of optionSelectors) {
        try {
          const result = document.evaluate(
            selector,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          if (result.singleNodeValue) {
            option = result.singleNodeValue;
            break;
          }
        } catch (e) {
          // Fallback to contains search
          const options = document.querySelectorAll('[role="option"], li, div');
          for (let opt of options) {
            if (opt.textContent.trim() === bodyStyle || opt.textContent.includes(bodyStyle)) {
              option = opt;
              break;
            }
          }
        }
        if (option) break;
      }
      
      if (!option) {
        throw new Error(`Body style option "${bodyStyle}" not found`);
      }
      
      await this.scrollIntoView(option);
      await this.delay(this.randomDelay(300, 600));
      option.click();
      
      await this.delay(this.randomDelay(1000, 2000));
      this.log(`✅ Successfully selected body style: ${bodyStyle}`);
      return true;
      
    } catch (error) {
      this.log(`⚠️ Could not select body style: ${bodyStyle}`, error);
      return false;
    }
  }

  // Select Exterior Color dropdown
  async selectExteriorColor(exteriorColor) {
    try {
      this.log(`🎨 Selecting exterior color: ${exteriorColor}`);
      
      // Find the dropdown by looking for the label text and closest clickable element
      let dropdown = null;
      
      // Try XPath to find exterior color dropdown
      try {
        const elements = document.evaluate(
          `//div[contains(text(), "Exterior color") or contains(text(), "Exterior")]/following-sibling::*[contains(@role, "button") or contains(@class, "dropdown")]`,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        if (elements.singleNodeValue) {
          dropdown = elements.singleNodeValue;
        }
      } catch (e) {
        // Fallback to direct search
        const els = document.querySelectorAll('div[role="button"], span[role="button"]');
        for (let el of els) {
          if (el.textContent.includes('Exterior color') || el.textContent.includes('Exterior') || 
              el.parentElement?.textContent.includes('Exterior color') ||
              el.previousElementSibling?.textContent.includes('Exterior color')) {
            dropdown = el;
            break;
          }
        }
      }
      
      if (!dropdown) {
        throw new Error('Exterior color dropdown not found');
      }
      
      await this.scrollIntoView(dropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      this.log('🎨 Found exterior color dropdown, clicking...');
      dropdown.click();
      await this.delay(this.randomDelay(2000, 3000));
      
      // Look for color option in dropdown menu
      let option = null;
      const optionSelectors = [
        `//div[@role="option" and contains(text(), "${exteriorColor}")]`,
        `//div[contains(text(), "${exteriorColor}") and contains(@class, "option")]`,
        `//li[contains(text(), "${exteriorColor}")]`
      ];
      
      for (let selector of optionSelectors) {
        try {
          const result = document.evaluate(
            selector,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          if (result.singleNodeValue) {
            option = result.singleNodeValue;
            break;
          }
        } catch (e) {
          // Fallback search
          const options = document.querySelectorAll('[role="option"], li, div');
          for (let opt of options) {
            if (opt.textContent.trim() === exteriorColor || opt.textContent.includes(exteriorColor)) {
              option = opt;
              break;
            }
          }
        }
        if (option) break;
      }
      
      if (!option) {
        throw new Error(`Exterior color option "${exteriorColor}" not found`);
      }
      
      await this.scrollIntoView(option);
      await this.delay(this.randomDelay(300, 600));
      option.click();
      
      await this.delay(this.randomDelay(1000, 2000));
      this.log(`✅ Successfully selected exterior color: ${exteriorColor}`);
      return true;
      
    } catch (error) {
      this.log(`⚠️ Could not select exterior color: ${exteriorColor}`, error);
      return false;
    }
  }

  // Select Interior Color dropdown
  async selectInteriorColor(interiorColor) {
    try {
      this.log(`🪑 Selecting interior color: ${interiorColor}`);
      
      // Find the dropdown by looking for the label text and closest clickable element
      let dropdown = null;
      
      // Try XPath to find interior color dropdown
      try {
        const elements = document.evaluate(
          `//div[contains(text(), "Interior color") or contains(text(), "Interior")]/following-sibling::*[contains(@role, "button") or contains(@class, "dropdown")]`,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        if (elements.singleNodeValue) {
          dropdown = elements.singleNodeValue;
        }
      } catch (e) {
        // Fallback to direct search
        const els = document.querySelectorAll('div[role="button"], span[role="button"]');
        for (let el of els) {
          if (el.textContent.includes('Interior color') || el.textContent.includes('Interior') || 
              el.parentElement?.textContent.includes('Interior color') ||
              el.previousElementSibling?.textContent.includes('Interior color')) {
            dropdown = el;
            break;
          }
        }
      }
      
      if (!dropdown) {
        throw new Error('Interior color dropdown not found');
      }
      
      await this.scrollIntoView(dropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      this.log('🪑 Found interior color dropdown, clicking...');
      dropdown.click();
      await this.delay(this.randomDelay(2000, 3000));
      
      // Look for color option in dropdown menu
      let option = null;
      const optionSelectors = [
        `//div[@role="option" and contains(text(), "${interiorColor}")]`,
        `//div[contains(text(), "${interiorColor}") and contains(@class, "option")]`,
        `//li[contains(text(), "${interiorColor}")]`
      ];
      
      for (let selector of optionSelectors) {
        try {
          const result = document.evaluate(
            selector,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          if (result.singleNodeValue) {
            option = result.singleNodeValue;
            break;
          }
        } catch (e) {
          // Fallback search
          const options = document.querySelectorAll('[role="option"], li, div');
          for (let opt of options) {
            if (opt.textContent.trim() === interiorColor || opt.textContent.includes(interiorColor)) {
              option = opt;
              break;
            }
          }
        }
        if (option) break;
      }
      
      if (!option) {
        throw new Error(`Interior color option "${interiorColor}" not found`);
      }
      
      await this.scrollIntoView(option);
      await this.delay(this.randomDelay(300, 600));
      option.click();
      
      await this.delay(this.randomDelay(1000, 2000));
      this.log(`✅ Successfully selected interior color: ${interiorColor}`);
      return true;
      
    } catch (error) {
      this.log(`⚠️ Could not select interior color: ${interiorColor}`, error);
      return false;
    }
  }

  // Select Clean Title checkbox (always check it)
  async selectCleanTitle(shouldCheck = true) {
    try {
      this.log(`📋 Setting clean title checkbox: ${shouldCheck}`);
      
      // Find checkbox by looking for clean title text and associated input
      let checkbox = null;
      
      // Try XPath to find clean title checkbox
      try {
        const elements = document.evaluate(
          `//div[contains(text(), "clean title") or contains(text(), "This vehicle has a clean title")]//input[@type="checkbox"] | //input[@type="checkbox"][following-sibling::*[contains(text(), "clean title")]] | //input[@type="checkbox"][preceding-sibling::*[contains(text(), "clean title")]]`,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        if (elements.singleNodeValue) {
          checkbox = elements.singleNodeValue;
        }
      } catch (e) {
        // Fallback to direct search
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        for (let cb of checkboxes) {
          const parent = cb.closest('div, label');
          if (parent && (parent.textContent.includes('clean title') || 
                        parent.textContent.includes('This vehicle has a clean title'))) {
            checkbox = cb;
            break;
          }
        }
      }
      
      if (!checkbox) {
        // Try looking for any element with role checkbox
        const roleCheckboxes = document.querySelectorAll('[role="checkbox"]');
        for (let cb of roleCheckboxes) {
          const parent = cb.closest('div, label');
          if (parent && (parent.textContent.includes('clean title') || 
                        parent.textContent.includes('This vehicle has a clean title'))) {
            checkbox = cb;
            break;
          }
        }
      }
      
      if (!checkbox) {
        throw new Error('Clean title checkbox not found');
      }
      
      await this.scrollIntoView(checkbox);
      
      // Check if it's already checked
      const isChecked = checkbox.checked || 
                       checkbox.getAttribute('aria-checked') === 'true' ||
                       checkbox.getAttribute('data-checked') === 'true' ||
                       checkbox.classList.contains('checked');
      
      if (shouldCheck && !isChecked) {
        this.log('📋 Checking clean title checkbox...');
        checkbox.click();
        await this.delay(this.randomDelay(500, 1000));
      } else if (!shouldCheck && isChecked) {
        this.log('📋 Unchecking clean title checkbox...');
        checkbox.click();
        await this.delay(this.randomDelay(500, 1000));
      }
      
      this.log(`✅ Successfully set clean title: ${shouldCheck}`);
      return true;
      
    } catch (error) {
      this.log(`⚠️ Could not set clean title checkbox`, error);
      return false;
    }
  }

  // Select Vehicle Condition dropdown (default to "Excellent")
  async selectVehicleCondition(condition = 'Excellent') {
    try {
      this.log(`⭐ Selecting vehicle condition: ${condition}`);
      
      // Find the dropdown by looking for the label text and closest clickable element
      let dropdown = null;
      
      // Try XPath to find vehicle condition dropdown
      try {
        const elements = document.evaluate(
          `//div[contains(text(), "Vehicle condition") or contains(text(), "Condition")]/following-sibling::*[contains(@role, "button") or contains(@class, "dropdown")]`,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        if (elements.singleNodeValue) {
          dropdown = elements.singleNodeValue;
        }
      } catch (e) {
        // Fallback to direct search
        const els = document.querySelectorAll('div[role="button"], span[role="button"]');
        for (let el of els) {
          if (el.textContent.includes('Vehicle condition') || el.textContent.includes('Condition') || 
              el.parentElement?.textContent.includes('Vehicle condition') ||
              el.previousElementSibling?.textContent.includes('Vehicle condition')) {
            dropdown = el;
            break;
          }
        }
      }
      
      if (!dropdown) {
        throw new Error('Vehicle condition dropdown not found');
      }
      
      await this.scrollIntoView(dropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      this.log('⭐ Found vehicle condition dropdown, clicking...');
      dropdown.click();
      await this.delay(this.randomDelay(2000, 3000));
      
      // Look for condition option in dropdown menu
      let option = null;
      const optionSelectors = [
        `//div[@role="option" and contains(text(), "${condition}")]`,
        `//div[contains(text(), "${condition}") and contains(@class, "option")]`,
        `//li[contains(text(), "${condition}")]`
      ];
      
      for (let selector of optionSelectors) {
        try {
          const result = document.evaluate(
            selector,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          if (result.singleNodeValue) {
            option = result.singleNodeValue;
            break;
          }
        } catch (e) {
          // Fallback search
          const options = document.querySelectorAll('[role="option"], li, div');
          for (let opt of options) {
            if (opt.textContent.trim() === condition || opt.textContent.includes(condition)) {
              option = opt;
              break;
            }
          }
        }
        if (option) break;
      }
      
      if (!option) {
        throw new Error(`Vehicle condition option "${condition}" not found`);
      }
      
      await this.scrollIntoView(option);
      await this.delay(this.randomDelay(300, 600));
      option.click();
      
      await this.delay(this.randomDelay(1000, 2000));
      this.log(`✅ Successfully selected vehicle condition: ${condition}`);
      return true;
      
    } catch (error) {
      this.log(`⚠️ Could not select vehicle condition: ${condition}`, error);
      return false;
    }
  }

  // Select Fuel Type dropdown
  async selectFuelType(fuelType) {
    try {
      this.log(`⛽ Selecting fuel type: ${fuelType}`);
      
      // Find the dropdown by looking for the label text and closest clickable element
      let dropdown = null;
      
      // Try XPath to find fuel type dropdown
      try {
        const elements = document.evaluate(
          `//div[contains(text(), "Fuel type") or contains(text(), "Fuel")]/following-sibling::*[contains(@role, "button") or contains(@class, "dropdown")]`,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        if (elements.singleNodeValue) {
          dropdown = elements.singleNodeValue;
        }
      } catch (e) {
        // Fallback to direct search
        const els = document.querySelectorAll('div[role="button"], span[role="button"]');
        for (let el of els) {
          if (el.textContent.includes('Fuel type') || el.textContent.includes('Fuel') || 
              el.parentElement?.textContent.includes('Fuel type') ||
              el.previousElementSibling?.textContent.includes('Fuel type')) {
            dropdown = el;
            break;
          }
        }
      }
      
      if (!dropdown) {
        throw new Error('Fuel type dropdown not found');
      }
      
      await this.scrollIntoView(dropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      this.log('⛽ Found fuel type dropdown, clicking...');
      dropdown.click();
      await this.delay(this.randomDelay(2000, 3000));
      
      // Look for fuel type option in dropdown menu
      let option = null;
      const optionSelectors = [
        `//div[@role="option" and contains(text(), "${fuelType}")]`,
        `//div[contains(text(), "${fuelType}") and contains(@class, "option")]`,
        `//li[contains(text(), "${fuelType}")]`
      ];
      
      for (let selector of optionSelectors) {
        try {
          const result = document.evaluate(
            selector,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          if (result.singleNodeValue) {
            option = result.singleNodeValue;
            break;
          }
        } catch (e) {
          // Fallback search
          const options = document.querySelectorAll('[role="option"], li, div');
          for (let opt of options) {
            if (opt.textContent.trim() === fuelType || opt.textContent.includes(fuelType)) {
              option = opt;
              break;
            }
          }
        }
        if (option) break;
      }
      
      if (!option) {
        throw new Error(`Fuel type option "${fuelType}" not found`);
      }
      
      await this.scrollIntoView(option);
      await this.delay(this.randomDelay(300, 600));
      option.click();
      
      await this.delay(this.randomDelay(1000, 2000));
      this.log(`✅ Successfully selected fuel type: ${fuelType}`);
      return true;
      
    } catch (error) {
      this.log(`⚠️ Could not select fuel type: ${fuelType}`, error);
      return false;
    }
  }

  // Transmission dropdown
  async selectTransmission(transmission) {
    try {
      this.log(`⚙️ Selecting transmission: ${transmission}`);
      let dropdown = null;
      try {
        const elements = document.evaluate(
          `//div[contains(text(), "Transmission")]/following-sibling::*[contains(@role, "button") or contains(@class, "dropdown")]`,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        if (elements.singleNodeValue) dropdown = elements.singleNodeValue;
      } catch (e) {}
      if (!dropdown) {
        const els = document.querySelectorAll('div[role="button"], span[role="button"]');
        for (let el of els) {
          if (el.textContent.includes('Transmission') || el.parentElement?.textContent.includes('Transmission')) {
            dropdown = el; break;
          }
        }
      }
      if (!dropdown) throw new Error('Transmission dropdown not found');
      await this.scrollIntoView(dropdown);
      await this.delay(this.randomDelay(500, 1000));
      dropdown.click();
      await this.delay(this.randomDelay(1500, 2500));

      const candidates = [transmission, this.mapTransmission(transmission)];
      for (const label of candidates.filter(Boolean)) {
        const optionXpath = `//div[@role="option" and contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "${label.toLowerCase()}")]`;
        const res = document.evaluate(optionXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (res.singleNodeValue) {
          const opt = res.singleNodeValue; await this.scrollIntoView(opt); await this.delay(200); opt.click();
          await this.delay(800);
          this.log(`✅ Selected transmission: ${label}`);
          return true;
        }
      }
      // Fallback to Automatic
      const fallbackXpath = `//div[@role="option" and contains(text(), "Automatic")]`;
      const res = document.evaluate(fallbackXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (res.singleNodeValue) { res.singleNodeValue.click(); await this.delay(800); this.log('✅ Selected transmission: Automatic'); return true; }
      throw new Error('No matching transmission option');
    } catch (error) {
      this.log(`⚠️ Could not select transmission: ${transmission}`, error);
      return false;
    }
  }

  // Mapping helpers and standardizers
  mapTransmission(input = '') {
    const v = (input || '').toString().toLowerCase();
    if (v.includes('manual')) return 'Manual transmission';
    if (v.includes('cvt') || v.includes('continuously variable')) return 'Automatic transmission';
    if (v.includes('auto')) return 'Automatic transmission';
    return 'Automatic transmission';
  }

  mapFuelType(input = '') {
    const v = (input || '').toString().toLowerCase();
    if (v.includes('diesel')) return 'Diesel';
    if (v.includes('electric')) return 'Electric';
    if (v.includes('hybrid') || v.includes('phev') || v.includes('hev')) return 'Hybrid';
    if (v.includes('flex') || v.includes('e85')) return 'Flex fuel';
    if (v.includes('gas') || v.includes('petrol')) return 'Gasoline';
    return null;
  }

  mapBodyStyle(input = '') {
    const v = (input || '').toString().toLowerCase();
    if (v.includes('suv') || v.includes('mpv')) return 'SUV';
    if (v.includes('sedan') || v.includes('saloon')) return 'Sedan';
    if (v.includes('hatch')) return 'Hatchback';
    if (v.includes('coupe')) return 'Coupe';
    if (v.includes('convert')) return 'Convertible';
    if (v.includes('wagon')) return 'Wagon';
    if (v.includes('van') || v.includes('minivan')) return 'Van';
    if (v.includes('truck') || v.includes('pickup') || v.includes('pick-up')) return 'Truck';
    return null;
  }

  standardizeExteriorColor(raw = '') {
    if (!raw) return 'Unknown';
    const input = raw.toLowerCase();
    const map = {
      silver: 'Silver', gray: 'Gray', grey: 'Gray', blue: 'Blue', black: 'Black', white: 'White', pearl: 'White',
      red: 'Red', green: 'Green', gold: 'Gold', brown: 'Brown', beige: 'Beige', tan: 'Tan', charcoal: 'Charcoal',
      burgundy: 'Burgundy', orange: 'Orange', yellow: 'Yellow', pink: 'Pink', purple: 'Purple', cream: 'Off white',
      ivory: 'Off white', champagne: 'Beige', bronze: 'Brown', copper: 'Brown', maroon: 'Burgundy', wine: 'Burgundy',
      crimson: 'Red', ruby: 'Red', azure: 'Blue', navy: 'Blue', teal: 'Green', lime: 'Green', olive: 'Green',
      forest: 'Green', slate: 'Gray', gunmetal: 'Charcoal', graphite: 'Charcoal', platinum: 'Silver', titanium: 'Silver',
      aluminum: 'Silver', pearlcoat: 'White'
    };
    for (const key of Object.keys(map)) if (input.includes(key)) return map[key];
    const priority = ['black','white','silver','gray','blue','red','green'];
    for (const key of priority) if (input.includes(key)) return map[key] || key.charAt(0).toUpperCase()+key.slice(1);
    return 'Unknown';
  }

  standardizeInteriorColor() { return 'Black'; }

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

  // Enhanced image upload handling with direct file manipulation
  async handleImageUploads(images) {
    try {
      this.log('📸 Starting enhanced image upload process...');
      this.log('📸 Processing image uploads for Facebook Marketplace...');
      
      // Find existing file input without triggering dialog
      const fileInputSelectors = [
        'input[type="file"][accept*="image"]',
        'input[type="file"][multiple]',
        'input[type="file"]'
      ];
      
      let fileInput = null;
      
      // Try to find existing file input first
      for (const selector of fileInputSelectors) {
        const inputs = document.querySelectorAll(selector);
        for (const input of inputs) {
          if (input.offsetParent !== null || input.style.display !== 'none') {
            fileInput = input;
            break;
          }
        }
        if (fileInput) break;
      }
      
      // If no visible file input found, look for hidden ones and make them accessible
      if (!fileInput) {
        this.log('📸 No visible file input found, looking for hidden inputs...');
        const hiddenInputs = document.querySelectorAll('input[type="file"]');
        if (hiddenInputs.length > 0) {
          fileInput = hiddenInputs[0];
          // Temporarily make it accessible
          const originalStyle = {
            opacity: fileInput.style.opacity,
            position: fileInput.style.position,
            left: fileInput.style.left,
            top: fileInput.style.top,
            width: fileInput.style.width,
            height: fileInput.style.height
          };
          
          fileInput.style.opacity = '1';
          fileInput.style.position = 'absolute';
          fileInput.style.left = '0px';
          fileInput.style.top = '0px';
          fileInput.style.width = '1px';
          fileInput.style.height = '1px';
          
          this.log('📸 Made hidden file input accessible');
        }
      }
      
      if (!fileInput) {
        throw new Error('No file input found on page');
      }
      
      this.log('📸 Found file input, proceeding with image processing...');
      
      // Get pre-downloaded images or download them now
      this.log(`📸 Processing ${images.length} images...`);
      const files = await this.getPreDownloadedImages(images);
      
      if (files.filter(f => f !== null).length === 0) {
        this.log('📸 No pre-downloaded images found, downloading now...');
        const downloadedFiles = await this.downloadImagesViaBackground(images);
        files.splice(0, files.length, ...downloadedFiles);
      }
      
      const validFiles = files.filter(file => file !== null);
      
      this.log(`📸 Successfully processed ${validFiles.length} out of ${images.length} images`);
      
      if (validFiles.length === 0) {
        this.log('❌ No valid images to upload');
        return false;
      }
      
      // Use advanced React-compatible file setting
      await this.setFilesWithReactCompatibility(fileInput, validFiles);
      
      this.log(`✅ Successfully uploaded ${validFiles.length} images`);
      return true;
      
    } catch (error) {
      this.log('⚠️ Image upload failed:', error);
      return false;
    }
  }

  // Advanced React-compatible file setting
  async setFilesWithReactCompatibility(fileInput, files) {
    try {
      this.log('📸 Setting files with React compatibility...');
      
      // Method 1: Direct file list assignment with React value setter
      const dataTransfer = new DataTransfer();
      files.forEach(file => {
        dataTransfer.items.add(file);
      });
      
      // Set the files property directly
      fileInput.files = dataTransfer.files;
      
      // Method 2: React-specific value setting (from reverse engineering)
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      const fileSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
      
      if (fileSetter) {
        fileSetter.call(fileInput, dataTransfer.files);
      }
      
      // Method 3: Trigger React events in sequence
      const events = [
        new Event('input', { bubbles: true }),
        new Event('change', { bubbles: true }),
        new Event('blur', { bubbles: true })
      ];
      
      for (const event of events) {
        fileInput.dispatchEvent(event);
        await this.delay(100);
      }
      
      // Method 4: Focus and trigger additional React hooks
      fileInput.focus();
      await this.delay(200);
      
      // Trigger React's synthetic events
      const syntheticEvent = new Event('change', { bubbles: true });
      Object.defineProperty(syntheticEvent, 'target', {
        value: fileInput,
        enumerable: true
      });
      Object.defineProperty(syntheticEvent, 'currentTarget', {
        value: fileInput,
        enumerable: true
      });
      
      fileInput.dispatchEvent(syntheticEvent);
      
      await this.delay(this.randomDelay(1000, 2000));
      
      this.log('📸 React-compatible file setting completed');
      
    } catch (error) {
      this.log('⚠️ Error in React-compatible file setting:', error);
      throw error;
    }
  }

  // Get pre-downloaded images from storage with improved key generation
  async getPreDownloadedImages(imageUrls) {
    const files = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      // Use more reliable key generation
      const storageKey = `img_${this.hashString(imageUrl)}`;
      
      try {
        const result = await chrome.storage.local.get(storageKey);
        if (result[storageKey]) {
          this.log(`📸 Found pre-downloaded image ${i + 1}`);
          const blob = this.base64ToBlob(result[storageKey], 'image/jpeg');
          const file = new File([blob], `vehicle_image_${i + 1}.jpg`, { type: 'image/jpeg' });
          files.push(file);
        } else {
          this.log(`📸 No pre-downloaded image found for ${i + 1} (key: ${storageKey})`);
          files.push(null);
        }
      } catch (error) {
        this.log(`⚠️ Error retrieving pre-downloaded image ${i + 1}:`, error);
        files.push(null);
      }
    }
    return files;
  }

  // Simple hash function for consistent storage keys
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Download images via background script using Supabase proxy
  async downloadImagesViaBackground(imageUrls) {
    const files = [];
    
    // Try bulk download first for efficiency
    try {
      this.log(`📸 Attempting bulk download of ${imageUrls.length} images...`);
      
      const bulkResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'preDownloadImages',
          imageUrls: imageUrls
        }, resolve);
      });
      
      if (bulkResponse && bulkResponse.success && bulkResponse.results) {
        this.log(`📸 Bulk download completed: ${bulkResponse.successCount}/${bulkResponse.totalCount} successful`);
        
        // Retrieve the stored images
        for (let i = 0; i < imageUrls.length; i++) {
          const imageUrl = imageUrls[i];
          const storageKey = `img_${this.hashString(imageUrl)}`;
          
          try {
            const result = await chrome.storage.local.get(storageKey);
            if (result[storageKey]) {
              this.log(`📸 Retrieved bulk-downloaded image ${i + 1}`);
              const blob = this.base64ToBlob(result[storageKey], 'image/jpeg');
              const file = new File([blob], `vehicle_image_${i + 1}.jpg`, { type: 'image/jpeg' });
              files.push(file);
            } else {
              this.log(`⚠️ Bulk-downloaded image ${i + 1} not found in storage`);
              files.push(null);
            }
          } catch (error) {
            this.log(`⚠️ Error retrieving bulk-downloaded image ${i + 1}:`, error);
            files.push(null);
          }
        }
      } else {
        throw new Error('Bulk download failed or returned no results');
      }
    } catch (bulkError) {
      this.log(`⚠️ Bulk download failed, falling back to individual downloads:`, bulkError.message);
      
      // Fallback to individual downloads
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        try {
          this.log(`📸 Downloading image ${i + 1}: ${imageUrl}`);
          
          const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              action: 'fetchImage',
              url: imageUrl
            }, resolve);
          });
          
          if (response && response.success) {
            this.log(`📸 Successfully downloaded image ${i + 1} via proxy`);
            const blob = this.base64ToBlob(response.data, 'image/jpeg');
            const file = new File([blob], `vehicle_image_${i + 1}.jpg`, { type: 'image/jpeg' });
            files.push(file);
          } else {
            this.log(`⚠️ Failed to download image ${i + 1}:`, response?.error || 'Unknown error');
            files.push(null);
          }
        } catch (error) {
          this.log(`⚠️ Failed to download image ${i + 1}:`, error.message);
          files.push(null);
        }
      }
    }
    
    return files;
  }

  // Utility function to convert base64 to blob
  base64ToBlob(base64Data, contentType) {
    const byteCharacters = atob(base64Data.split(',')[1] || base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  }

  // Helper function to find associated label for an input
  findAssociatedLabel(input) {
    // Method 1: Check for aria-label
    if (input.getAttribute('aria-label')) {
      return input.getAttribute('aria-label');
    }
    
    // Method 2: Check for label element via 'for' attribute
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.textContent.trim();
    }
    
    // Method 3: Check for parent label
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();
    
    // Method 4: Check for previous sibling label
    let sibling = input.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === 'LABEL') {
        return sibling.textContent.trim();
      }
      sibling = sibling.previousElementSibling;
    }
    
    // Method 5: Check for placeholder
    if (input.placeholder) {
      return input.placeholder;
    }
    
    return '';
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

  // Specialized click method for Facebook React dropdowns - Enhanced with reverse engineering insights
  async performFacebookDropdownClick(element) {
    try {
      console.log(`[FACEBOOK CLICK] Starting enhanced React-compatible click sequence...`);
      
      // Ensure element is in view and focused
      await this.scrollIntoView(element);
      await this.delay(this.randomDelay(200, 400));

      // Pre-click preparation - mimic human behavior
      element.focus();
      await this.delay(this.randomDelay(100, 300));

      // Enhanced event sequence based on reverse engineering findings
      const eventSequence = [
        new MouseEvent('mouseenter', { bubbles: true, cancelable: true }),
        new MouseEvent('mouseover', { bubbles: true, cancelable: true }),
        new FocusEvent('focusin', { bubbles: true }),
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }),
        new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }),
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }),
        new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1 }),
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
        new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true })
      ];

      // Dispatch events with realistic delays
      for (const event of eventSequence) {
        try {
          element.dispatchEvent(event);
          await this.delay(this.randomDelay(20, 80));
        } catch (e) {
          console.warn(`[FACEBOOK CLICK] Event ${event.type} failed:`, e);
        }
      }

      // Additional React synthetic event triggers
      try {
        // Trigger React's onChange and other synthetic events
        if (element.tagName === 'INPUT' || element.tagName === 'SELECT') {
          this.setNativeValue(element, element.value);
        }
      } catch (e) {
        console.warn(`[FACEBOOK CLICK] Synthetic event trigger failed:`, e);
      }

      console.log(`[FACEBOOK CLICK] Enhanced React-compatible click sequence completed`);
      
    } catch (error) {
      console.error(`[FACEBOOK CLICK] Error in enhanced React click sequence:`, error);
      // Multi-level fallback
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