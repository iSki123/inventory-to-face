// Enhanced Facebook Marketplace Automation
// Implements React-native value setting, MutationObserver, keyboard simulation, and human-like behavior

class SalesonatorAutomator {
  constructor() {
    this.isPosting = false;
    this.debugMode = true;
    this.retryAttempts = 3;
    this.setupMessageListener();
    this.installNavigationGuards();
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

      // Normalize selectors to an array (defensive against single-string input)
      const list = Array.isArray(selectors) ? selectors : [selectors];
      const display = Array.isArray(selectors) ? selectors[0] : selectors;
      
      // Try immediate selection first
      const immediateElement = this.findElementWithFallbacks(list, parentElement);
      if (immediateElement) {
        this.log('Element found immediately:', display);
        return resolve(immediateElement);
      }

      // Set up MutationObserver for dynamic detection
      const observer = new MutationObserver(() => {
        const element = this.findElementWithFallbacks(list, parentElement);
        if (element) {
          observer.disconnect();
          this.log('Element found via MutationObserver:', display);
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          observer.disconnect();
          reject(new Error(`Timeout waiting for element: ${list.join(', ')}`));
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
        reject(new Error(`Timeout waiting for element: ${list.join(', ')}`));
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
        
        // Regular CSS selector (validate before using)
        else {
          // Skip invalid CSS selectors
          if (!selector || 
              selector.trim() === '' || 
              selector === ':' || 
              selector === '[' ||
              selector.includes(':has-text(') || 
              selector.includes(':contains(')) {
            console.log(`[SALESONATOR] Skipping invalid selector: "${selector}"`);
            continue;
          }
          
          try {
            const element = parentElement.querySelector(selector);
            if (element) return element;
          } catch (selectorError) {
            console.log(`[SALESONATOR] Invalid CSS selector: "${selector}"`, selectorError.message);
            continue;
          }
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

  // NEW: Find an input by its visible label text (robust to DOM changes)
  findInputByLabel(labelText, parentElement = document) {
    const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const target = norm(labelText);

    // 1) label[for] association
    const labels = Array.from(parentElement.querySelectorAll('label'));
    for (const label of labels) {
      if (norm(label.textContent).includes(target)) {
        if (label.htmlFor) {
          const el = parentElement.getElementById ? parentElement.getElementById(label.htmlFor) : document.getElementById(label.htmlFor);
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return el;
        }
        const nested = label.querySelector('input, textarea');
        if (nested) return nested;
        const containerInput = label.parentElement?.querySelector('input, textarea');
        if (containerInput) return containerInput;
      }
    }

    // 2) XPath: label text followed by input/textarea
    try {
      const xpath = `//label[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "${target}")]/following::*[self::input or self::textarea][1]`;
      const res = document.evaluate(xpath, parentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (res.singleNodeValue) return res.singleNodeValue;
    } catch {}

    // 3) Container approach
    const containers = Array.from(parentElement.querySelectorAll('div, section, form, fieldset'));
    for (const c of containers) {
      if (norm(c.textContent).includes(target)) {
        const el = c.querySelector('input, textarea');
        if (el) return el;
      }
    }

    // 4) Attribute fallbacks
    const attr = parentElement.querySelector(
      `input[aria-label*="${labelText}"] , input[placeholder*="${labelText}"] , input[name*="${labelText.toLowerCase()}"] , textarea[aria-label*="${labelText}"] , textarea[placeholder*="${labelText}"]`
    );
    if (attr) return attr;

    return null;
  }

  // NEW: Find a combobox/button dropdown by its visible label text
  findDropdownByLabel(labelText, parentElement = document) {
    const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const target = norm(labelText);

    // 1) ARIA combobox near label
    try {
      const xpath = `//*[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "${target}")]/following::*[(@role='combobox' or @role='button' or contains(@class,'dropdown'))][1]`;
      const res = document.evaluate(xpath, parentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (res.singleNodeValue) return res.singleNodeValue;
    } catch {}

    // 2) Search within labeled containers
    const candidates = Array.from(parentElement.querySelectorAll('[role="combobox"], [role*="button"], button, div'));
    for (const el of candidates) {
      const text = norm(el.textContent);
      const parentText = norm(el.parentElement?.textContent || '');
      const prevText = norm(el.previousElementSibling?.textContent || '');
      if (parentText.includes(target) || prevText.includes(target)) return el;
    }

    // 3) Attribute-based
    const attr = parentElement.querySelector(`[aria-label*="${labelText}"]`);
    if (attr) return attr;

    return null;
  }

  // Enhanced human-like typing simulation
  async typeHumanLike(element, text, speed = 'normal') {
    await this.scrollIntoView(element);
    await this.delay(this.randomDelay(300, 700));
    
    element.focus();
    await this.delay(this.randomDelay(100, 300));
    
    if (element.select && typeof element.select === 'function') {
      element.select();
    } else {
      element.value = '';
    }
    await this.delay(this.randomDelay(50, 150));
    
    const speedMultipliers = {
      slow: [120, 260],
      normal: [50, 200],
      fast: [30, 90]
    };
    const [minDelay, maxDelay] = speedMultipliers[speed] || speedMultipliers.normal;
    
    // Type character by character with random delays and occasional typos
    for (let i = 0; i < text.length; i++) {
      let char = text[i];
      // 12% chance to simulate a small typo
      if (Math.random() < 0.12 && /[a-z]/i.test(char)) {
        const typo = String.fromCharCode(char.charCodeAt(0) + (Math.random() < 0.5 ? 1 : -1));
        this.setNativeValue(element, (element.value || '') + typo);
        await this.delay(this.randomDelay(minDelay, maxDelay));
        // backspace correction
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
        this.setNativeValue(element, (element.value || '').slice(0, -1));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', bubbles: true }));
        await this.delay(this.randomDelay(minDelay, maxDelay));
      }
      this.setNativeValue(element, (element.value || '') + char);
      if (Math.random() < 0.1) {
        await this.delay(this.randomDelay(200, 600));
      } else {
        await this.delay(this.randomDelay(minDelay, maxDelay));
      }
    }
    
    // Final events
    element.dispatchEvent(new Event('change', { bubbles: true }));
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
  
  // Close any open dropdown menus to avoid overlapping interactions
  async closeAnyOpenDropdown() {
    try {
      const openMenu =
        document.querySelector('[role="listbox"]') ||
        document.querySelector('[role="menu"]') ||
        document.querySelector('[data-visualcompletion="ignore-dynamic"] [role="option"]');
      if (openMenu) {
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        document.activeElement?.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
        await this.delay(150);
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await this.delay(150);
      }
    } catch {}
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
      this.isPosting = true;
      
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
            this.isPosting = false;
            return { success: true };
          }
          
        } catch (error) {
          this.log(`❌ Attempt ${attempt + 1} failed:`, error);
          
          if (attempt < this.retryAttempts - 1) {
            this.log(`🔄 Retrying in ${2 ** attempt} seconds...`);
            await this.delay(2000 * (2 ** attempt));
            
            // Try to recover without refreshing the page
            if (attempt > 0) {
              this.log('⚠️ Retrying without page reload to stay on Facebook');
              await this.delay(5000);
            }
          }
        }
      }
      
      throw new Error('All retry attempts failed');
      
    } catch (error) {
      this.log('❌ Vehicle posting failed completely:', error);
      this.isPosting = false;
      return { success: false, error: error.message };
    }
  }

  // Enhanced navigation with better error handling - PREVENTS ANY NAVIGATION AWAY FROM FACEBOOK
  async navigateToMarketplace() {
    const currentUrl = window.location.href;
    this.log('📍 Current URL:', currentUrl);
    
    // CRITICAL: Never navigate away from Facebook - stay on current page
    if (!currentUrl.includes('facebook.com')) {
      this.log('❌ ERROR: Not on Facebook - stopping to prevent navigation away');
      throw new Error('Must be on Facebook first - please navigate manually');
    }
    
    if (currentUrl.includes('facebook.com/marketplace/create/vehicle')) {
      this.log('✅ Already on vehicle creation page');
      return;
    }
    
    if (currentUrl.includes('facebook.com/marketplace/create')) {
      this.log('📝 On marketplace create page, checking for vehicle category...');
      
      // Look for vehicle category button/option WITHOUT any navigation
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
      return;
    }
    
    // If on Facebook but not marketplace, require manual navigation to prevent redirects
    if (currentUrl.includes('facebook.com') && !currentUrl.includes('marketplace')) {
      this.log('⚠️ On Facebook but not Marketplace - manual navigation required to prevent redirects');
      throw new Error('Please navigate to Facebook Marketplace manually - extension will NOT auto-navigate to prevent redirects');
    }
  }

  // Enhanced form filling with React-native value setting
  async fillVehicleForm(vehicleData) {
    this.log('📝 Filling vehicle form with enhanced automation...');
    
    // Sequential field completion with proper closure verification
    this.log('🔄 Starting sequential form completion...');
    
    // FIRST: Close any open dropdowns and handle vehicle type
    await this.closeAnyOpenDropdown();
    await this.delay(1000);
    await this.selectVehicleType();
    await this.delay(3000); // Longer pause to ensure completion
    
    // SECOND: Year dropdown with verification
    await this.closeAnyOpenDropdown();
    await this.delay(500);
    const yearSuccess = await this.selectYear(vehicleData.year);
    if (yearSuccess) await this.delay(3000);
    
    // THIRD: Make dropdown with verification
    await this.closeAnyOpenDropdown();
    await this.delay(500);
    const makeSuccess = await this.selectMake(vehicleData.make);
    if (makeSuccess) await this.delay(3000);
    
    // FOURTH: Model input (less interference-prone)
    await this.closeAnyOpenDropdown();
    await this.delay(500);
    await this.fillModel(vehicleData.model);
    await this.delay(2000);
    
    // FIFTH: Price input
    await this.closeAnyOpenDropdown();
    await this.delay(500);
    await this.fillPrice(vehicleData.price);
    await this.delay(2000);
    
    // SIXTH: Mileage if available
    if (vehicleData.mileage) {
      await this.closeAnyOpenDropdown();
      await this.delay(500);
      await this.fillMileage(vehicleData.mileage);
      await this.delay(2000);
    }
    
    // SEVENTH: Ensure additional fields are visible before continuing
    await this.ensureAdditionalFieldsVisible();
    await this.delay(1000);
    
    // EIGHTH: Body Style dropdown
    const mappedBodyStyle = vehicleData.bodyStyle || vehicleData.body_style || this.mapBodyStyle(vehicleData.body_style_nhtsa || vehicleData.vehicle_type_nhtsa || '');
    if (mappedBodyStyle) {
      await this.closeAnyOpenDropdown();
      await this.delay(500);
      await this.selectBodyStyle(mappedBodyStyle);
      await this.delay(3000);
    }
    
    // NINTH: Vehicle condition dropdown
    await this.closeAnyOpenDropdown();
    await this.delay(500);
    await this.selectVehicleCondition('Excellent');
    await this.delay(3000);
    
    // TENTH: Fuel type dropdown
    const mappedFuel = this.mapFuelType(vehicleData.fuelType || vehicleData.fuel_type || vehicleData.fuel_type_nhtsa || '');
    if (mappedFuel) {
      await this.closeAnyOpenDropdown();
      await this.delay(500);
      await this.selectFuelType(mappedFuel);
      await this.delay(3000);
    }
    
    // ELEVENTH: Transmission dropdown
    const mappedTransmission = this.mapTransmission(vehicleData.transmission || vehicleData.transmission_nhtsa || '');
    await this.closeAnyOpenDropdown();
    await this.delay(500);
    await this.selectTransmission(mappedTransmission);
    await this.delay(3000);
    
    // TWELFTH: Clean title checkbox
    await this.closeAnyOpenDropdown();
    await this.delay(500);
    await this.selectCleanTitle(true);
    await this.delay(1000);
    
    // THIRTEENTH: Color selections (less critical, can be done together)
    const standardizedExterior = this.standardizeExteriorColor(vehicleData.exteriorColor || vehicleData.exterior_color);
    if (standardizedExterior && standardizedExterior !== 'Unknown') {
      await this.closeAnyOpenDropdown();
      await this.delay(500);
      await this.selectExteriorColor(standardizedExterior);
      await this.delay(3000);
    }
    
    const standardizedInterior = this.standardizeInteriorColor(vehicleData.interiorColor || vehicleData.interior_color);
    if (standardizedInterior) {
      await this.closeAnyOpenDropdown();
      await this.delay(500);
      await this.selectInteriorColor(standardizedInterior);
      await this.delay(3000);
    }
    
    // FOURTEENTH: Description (final step)
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
      const cleanMake = (make || '').toString().trim();
      
      // Look for make dropdown more specifically 
      const makeDropdownSelectors = [
        'text:Make', // Visible label
        '[aria-label*="Make"]',
        'div[role="button"]', // Generic fallback after year
        'select'
      ];
      
      const makeDropdown = await this.waitForElement(makeDropdownSelectors, 8000);
      await this.scrollIntoView(makeDropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      this.log('🏭 Found make dropdown, clicking to open...');
      // Use a more reliable open sequence for React-controlled dropdowns
      makeDropdown.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      makeDropdown.click();
      await this.delay(this.randomDelay(1200, 1800)); // Wait for dropdown to open
      
      // Prefer searching within the options container only
      let optionsContainer = null;
      try {
        optionsContainer = await this.waitForElement(['[role="listbox"]', '[role="menu"]'], 4000);
      } catch {}
      
      const getExactOption = () => {
        const scope = optionsContainer || document;
        const opts = Array.from(scope.querySelectorAll('[role="option"]'));
        return opts.find(o => ((o.textContent || '').trim().toLowerCase() === cleanMake.toLowerCase()));
      };
      
      const getFuzzyOption = () => {
        const scope = optionsContainer || document;
        const opts = Array.from(scope.querySelectorAll('[role="option"]'));
        return opts.find(o => (o.textContent || '').toLowerCase().includes(cleanMake.toLowerCase()));
      };
      
      let makeOption = getExactOption();
      
      // If not found, try typeahead (Facebook supports it)
      if (!makeOption && cleanMake) {
        for (const ch of cleanMake.toLowerCase()) {
          makeDropdown.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
          await this.delay(this.randomDelay(40, 100));
        }
        await this.delay(this.randomDelay(300, 600));
        makeOption = getExactOption();
      }
      
      // Fallback to fuzzy match
      if (!makeOption) {
        makeOption = getFuzzyOption();
      }
      
      // Ultimate fallback: any element with the text inside the container
      if (!makeOption) {
        const elem = this.findElementByText(cleanMake, ['div','span','li'], optionsContainer || document);
        if (elem) makeOption = elem.closest('[role="option"]') || elem;
      }
      
      if (!makeOption) {
        throw new Error(`Make option not found for "${cleanMake}"`);
      }
      
      await this.scrollIntoView(makeOption);
      await this.delay(this.randomDelay(300, 600));
      makeOption.click();
      await this.delay(this.randomDelay(1000, 1500)); // Wait for selection to register
      
      // Verify the dropdown now displays the selected make (log in Title Case)
      const selectedText = (makeDropdown.textContent || '').toLowerCase();
      const verified = selectedText.includes(cleanMake.toLowerCase());
      const titleMake = cleanMake
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      if (verified) {
        this.log(`✅ Successfully selected make: ${titleMake}`);
      } else {
        this.log(`⚠️ Make selection not verified. Dropdown shows: ${makeDropdown.textContent}`);
      }
      return verified;
      
    } catch (error) {
      this.log(`⚠️ Could not select make: ${make}`, error);
      return false;
    }
  }

  // Fill Model input
  async fillModel(model) {
    try {
      // Helper function to convert to title case
      const toTitleCase = (str) => {
        if (!str) return str;
        return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      };
      
      const titleCaseModel = toTitleCase(model);
      this.log(`🚗 Filling model: ${model} (formatted as: ${titleCaseModel})`);
      
      const modelInputSelectors = [
        '[aria-label*="Model"]',
        'input[placeholder*="Model"]',
        'input[name*="model"]',
        '[data-testid*="model"]'
      ];
      
      let modelInput = null;
      try {
        modelInput = await this.waitForElement(modelInputSelectors, 6000);
      } catch {}
      if (!modelInput) {
        modelInput = this.findInputByLabel('Model') || this.findInputByLabel('Model name');
      }
      if (!modelInput) {
        throw new Error('Model input not found');
      }
      
      await this.scrollIntoView(modelInput);
      
      // Clear existing value and set new one
      modelInput.focus();
      if (modelInput.select) modelInput.select();
      await this.delay(100);
      
      // Use React-compatible value setting with title case
      this.setNativeValue(modelInput, titleCaseModel);
      
      // Trigger React events
      modelInput.dispatchEvent(new Event('input', { bubbles: true }));
      modelInput.dispatchEvent(new Event('change', { bubbles: true }));
      modelInput.dispatchEvent(new Event('blur', { bubbles: true }));
      
      await this.delay(500);
      
      // Verify value was set
      if ((modelInput.value || '').toString().trim() === (titleCaseModel || '').toString().trim()) {
        this.log('✅ Successfully filled model:', titleCaseModel);
        return true;
      } else {
        this.log('⚠️ Model value verification failed. Expected:', titleCaseModel, 'Got:', modelInput.value);
        // Try typing approach as fallback
        modelInput.focus();
        if (modelInput.select) modelInput.select();
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
    // Apply minimum mileage of 300 for Facebook Marketplace
    const adjustedMileage = Math.max(300, parseInt(mileage) || 0);
    
    try {
      this.log(`📏 Filling mileage: ${mileage} (adjusted to: ${adjustedMileage})`);
      
      const mileageInputSelectors = [
        '[aria-label*="Mileage"]',
        'input[placeholder*="Mileage"]',
        'input[placeholder*="mileage"]',
        'input[name*="mileage"]',
        '[data-testid*="mileage"]'
      ];
      
      let mileageInput = null;
      try {
        mileageInput = await this.waitForElement(mileageInputSelectors, 6000);
      } catch {}
      if (!mileageInput) {
        mileageInput = this.findInputByLabel('Mileage');
      }
      if (!mileageInput) {
        throw new Error('Mileage input not found');
      }
      
      await this.scrollIntoView(mileageInput);
      
      // Clear existing value and set new one
      mileageInput.focus();
      if (mileageInput.select) mileageInput.select();
      await this.delay(100);
      
      // Use React-compatible value setting with adjusted mileage
      this.setNativeValue(mileageInput, adjustedMileage.toString());
      
      // Trigger React events
      mileageInput.dispatchEvent(new Event('input', { bubbles: true }));
      mileageInput.dispatchEvent(new Event('change', { bubbles: true }));
      mileageInput.dispatchEvent(new Event('blur', { bubbles: true }));
      
      await this.delay(500);
      
      // Verify value was set
      if ((mileageInput.value || '').toString() === adjustedMileage.toString()) {
        this.log('✅ Successfully filled mileage:', adjustedMileage);
        return true;
      } else {
        this.log('⚠️ Mileage value verification failed. Expected:', adjustedMileage.toString(), 'Got:', mileageInput.value);
        // Try typing approach as fallback
        mileageInput.focus();
        if (mileageInput.select) mileageInput.select();
        await this.typeHumanLike(mileageInput, adjustedMileage.toString());
        return true;
      }
      
    } catch (error) {
      this.log('⚠️ Could not fill mileage:', adjustedMileage, error);
      return false;
    }
  }

  // Fill Price input
  async fillPrice(price) {
    try {
      this.log(`💰 Filling price: ${price}`);

      // Normalize to integer dollars (strip non-digits and fix cents if needed)
      const rawDigits = String(price ?? '').replace(/[^\d]/g, '');
      const toNumber = (val) => {
        if (val === null || val === undefined) return null;
        const digits = String(val).replace(/[^\d]/g, '');
        return digits ? parseInt(digits, 10) : null;
      };

      let expectedNum = rawDigits ? parseInt(rawDigits, 10) : null;
      if (!expectedNum || expectedNum <= 0) throw new Error('Invalid price value provided');

      // Heuristic: some sources store price in cents (e.g., 2155000 -> 21550)
      // If 6+ digits and ends with "00", treat as cents and divide by 100
      if (rawDigits.length >= 6 && rawDigits.endsWith('00')) {
        const centsAdjusted = Math.round(expectedNum / 100);
        // Only apply if the adjusted value looks like a realistic vehicle price
        if (centsAdjusted >= 1000 && centsAdjusted <= 250000) {
          expectedNum = centsAdjusted;
        }
      }
      this.log('💰 Normalized price to dollars:', expectedNum);

      const priceInputSelectors = [
        '[aria-label*="Price"]',
        'input[placeholder*="Price"]',
        'input[placeholder*="price"]',
        'input[name*="price"]',
        '[data-testid*="price"]'
      ];

      let priceInput = null;
      try {
        priceInput = await this.waitForElement(priceInputSelectors, 6000);
      } catch {}
      if (!priceInput) {
        priceInput = this.findInputByLabel('Price');
      }
      if (!priceInput) {
        throw new Error('Price input not found');
      }

      await this.scrollIntoView(priceInput);

      // Hard clear existing value
      priceInput.focus();
      if (priceInput.select) priceInput.select();
      await this.delay(100);
      this.setNativeValue(priceInput, '');
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      await this.delay(50);

      // Set target value without formatting
      this.setNativeValue(priceInput, expectedNum.toString());
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      priceInput.dispatchEvent(new Event('blur', { bubbles: true }));

      await this.delay(600);

      // Verify numerically (ignore $ and commas that FB adds)
      const currentNum = toNumber(priceInput.value);
      if (currentNum === expectedNum) {
        this.log('✅ Successfully filled price:', expectedNum);
        return true;
      }

      this.log('⚠️ Price verification mismatch. Expected:', expectedNum, 'Got raw:', priceInput.value, 'Parsed:', currentNum);

      // Fallback: clear then type human-like
      priceInput.focus();
      if (priceInput.select) priceInput.select();
      await this.delay(50);
      this.setNativeValue(priceInput, '');
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      await this.delay(50);
      await this.typeHumanLike(priceInput, expectedNum.toString());
      await this.delay(600);

      const finalNum = toNumber(priceInput.value);
      if (finalNum === expectedNum) {
        this.log('✅ Price set after typing:', expectedNum);
      } else {
        this.log('⚠️ Final price mismatch. Expected:', expectedNum, 'Got raw:', priceInput.value, 'Parsed:', finalNum);
      }
      return true;

    } catch (error) {
      this.log('⚠️ Could not fill price:', price, error);
      return false;
    }
  }

  // Ensure additional FB form sections are visible to reveal hidden fields
  async ensureAdditionalFieldsVisible() {
    try {
      const triggers = ['more details','additional details','additional information','show more','see more','add details','add more details'];
      const clickable = Array.from(document.querySelectorAll('button, [role="button"], a, div'));
      for (const label of triggers) {
        const el = clickable.find(e => (e.textContent || '').toLowerCase().includes(label));
        if (el) {
          await this.scrollIntoView(el);
          await this.delay(this.randomDelay(200, 500));
          el.click();
          await this.delay(this.randomDelay(800, 1200));
        }
      }
    } catch (e) {
      this.log('No additional fields toggle found or error expanding.', e);
    }
  }

  // Select Body Style dropdown
  async selectBodyStyle(bodyStyle) {
    try {
      this.log(`🚗 Selecting body style: ${bodyStyle}`);
      console.log(`[BODY STYLE DEBUG] Starting body style selection for: ${bodyStyle}`);
      
      // Clean body style string (remove extra spaces)
      const cleanBodyStyle = (bodyStyle || '').toString().trim();
      
      // Find body style dropdown using the same proven selectors as year/make
      const bodyStyleDropdownSelectors = [
        'text:Body style',
        '[aria-label*="Body style"]',
        'div[role="button"]:has-text("Body style")',
        'span:has-text("Body style")',
        '[data-testid*="body"]'
      ];
      
      console.log(`[BODY STYLE DEBUG] Searching for body style dropdown with selectors:`, bodyStyleDropdownSelectors);
      
      const bodyStyleDropdown = await this.waitForElement(bodyStyleDropdownSelectors, 8000);
      if (!bodyStyleDropdown) {
        throw new Error('Body style dropdown not found');
      }
      
      console.log(`[BODY STYLE DEBUG] Found body style dropdown:`, bodyStyleDropdown);
      console.log(`[BODY STYLE DEBUG] Dropdown tagName:`, bodyStyleDropdown.tagName);
      console.log(`[BODY STYLE DEBUG] Dropdown textContent:`, bodyStyleDropdown.textContent);
      
      await this.scrollIntoView(bodyStyleDropdown);
      this.log('🚗 Found body style dropdown, clicking to open...');
      
      console.log(`[BODY STYLE DEBUG] Clicking body style dropdown...`);
      // Use the same reliable open sequence as make dropdown
      bodyStyleDropdown.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      bodyStyleDropdown.click();
      await this.delay(this.randomDelay(1200, 1800)); // Wait for dropdown to open
      
      console.log(`[BODY STYLE DEBUG] Checking if dropdown opened...`);
      const optionsAfterClick = document.querySelectorAll('[role="option"]');
      console.log(`[BODY STYLE DEBUG] Found options after click:`, optionsAfterClick.length);
      
      // Log first 20 options to debug
      Array.from(optionsAfterClick).slice(0, 20).forEach((opt, idx) => {
        console.log(`[BODY STYLE DEBUG] Option ${idx}: ${opt.textContent?.trim()}`, opt);
      });
      
      // Prefer searching within the options container only
      let optionsContainer = null;
      try {
        optionsContainer = await this.waitForElement(['[role="listbox"]', '[role="menu"]'], 4000);
        console.log(`[BODY STYLE DEBUG] Found options container:`, optionsContainer);
      } catch {
        console.log(`[BODY STYLE DEBUG] No options container found, using document`);
      }
      
      const getExactOption = () => {
        const scope = optionsContainer || document;
        const opts = Array.from(scope.querySelectorAll('[role="option"]'));
        console.log(`[BODY STYLE DEBUG] Searching for exact match: "${cleanBodyStyle}" in ${opts.length} options`);
        const found = opts.find(o => ((o.textContent || '').trim().toLowerCase() === cleanBodyStyle.toLowerCase()));
        console.log(`[BODY STYLE DEBUG] Exact match found:`, found?.textContent?.trim());
        return found;
      };
      
      const getFuzzyOption = () => {
        const scope = optionsContainer || document;
        const opts = Array.from(scope.querySelectorAll('[role="option"]'));
        console.log(`[BODY STYLE DEBUG] Searching for fuzzy match: "${cleanBodyStyle}" in ${opts.length} options`);
        const found = opts.find(o => (o.textContent || '').toLowerCase().includes(cleanBodyStyle.toLowerCase()));
        console.log(`[BODY STYLE DEBUG] Fuzzy match found:`, found?.textContent?.trim());
        return found;
      };
      
      let bodyStyleOption = getExactOption();
      
      // If not found, try typeahead (Facebook supports it)
      if (!bodyStyleOption && cleanBodyStyle) {
        console.log(`[BODY STYLE DEBUG] Trying typeahead approach...`);
        for (const ch of cleanBodyStyle.toLowerCase()) {
          bodyStyleDropdown.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
          await this.delay(this.randomDelay(40, 100));
        }
        await this.delay(this.randomDelay(300, 600));
        bodyStyleOption = getExactOption();
      }
      
      // Fallback to fuzzy match
      if (!bodyStyleOption) {
        console.log(`[BODY STYLE DEBUG] Falling back to fuzzy match...`);
        bodyStyleOption = getFuzzyOption();
      }
      
      // Ultimate fallback: any element with the text inside the container
      if (!bodyStyleOption) {
        console.log(`[BODY STYLE DEBUG] Trying ultimate fallback...`);
        const elem = this.findElementByText(cleanBodyStyle, ['div','span','li'], optionsContainer || document);
        if (elem) bodyStyleOption = elem.closest('[role="option"]') || elem;
      }
      
      if (!bodyStyleOption) {
        console.log(`[BODY STYLE DEBUG] ❌ No body style option found for "${cleanBodyStyle}"`);
        throw new Error(`Body style option not found for "${cleanBodyStyle}"`);
      }
      
      console.log(`[BODY STYLE DEBUG] 🚗 Found body style option, clicking: ${bodyStyleOption.textContent?.trim()}`);
      await this.scrollIntoView(bodyStyleOption);
      await this.delay(this.randomDelay(300, 600));
      bodyStyleOption.click();
      await this.delay(this.randomDelay(1000, 1500)); // Wait for selection to register
      
      // Verify the dropdown now displays the selected body style
      console.log(`[BODY STYLE DEBUG] Verifying body style selection...`);
      const selectedText = (bodyStyleDropdown.textContent || '').toLowerCase();
      const verified = selectedText.includes(cleanBodyStyle.toLowerCase());
      console.log(`[BODY STYLE DEBUG] Dropdown text after selection:`, bodyStyleDropdown.textContent);
      console.log(`[BODY STYLE DEBUG] Verification successful:`, verified);
      
      if (verified) {
        this.log(`✅ Successfully selected body style: ${cleanBodyStyle}`);
      } else {
        this.log(`⚠️ Body style selection not verified. Dropdown shows: ${bodyStyleDropdown.textContent}`);
      }
      
      return verified;
      
    } catch (error) {
      console.log(`[BODY STYLE DEBUG] ❌ Body style selection failed:`, error);
      this.log(`⚠️ Could not select body style: ${bodyStyle}`, error);
      return false;
    }
  }

  // Select Exterior Color dropdown
  async selectExteriorColor(exteriorColor) {
    try {
      this.log(`🎨 Selecting exterior color: ${exteriorColor}`);

      const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const normalizeKey = (s) => norm(s).replace(/[\s-]/g, '');
      const target = normalizeKey(exteriorColor);

      // Find the dropdown by looking for the label text and closest clickable element
      let dropdown = this.findDropdownByLabel('Exterior color');
      if (!dropdown) {
        await this.ensureAdditionalFieldsVisible();
        dropdown = this.findDropdownByLabel('Exterior color');
      }

      // Try XPath to find exterior color dropdown
      if (!dropdown) {
        try {
          const elements = document.evaluate(
            `//div[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "exterior color") or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "exterior")]/following-sibling::*[contains(@role, "button") or contains(@class, "dropdown")]`,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          if (elements.singleNodeValue) {
            dropdown = elements.singleNodeValue;
          }
        } catch {}
      }

      if (!dropdown) {
        // Fallback to direct search
        const els = document.querySelectorAll('div[role="button"], span[role="button"], [role="combobox"]');
        for (let el of els) {
          const pt = norm(el.parentElement?.textContent || '');
          const prev = norm(el.previousElementSibling?.textContent || '');
          if (pt.includes('exterior color') || prev.includes('exterior color')) { dropdown = el; break; }
        }
      }

      if (!dropdown) throw new Error('Exterior color dropdown not found');

      await this.scrollIntoView(dropdown);
      await this.delay(this.randomDelay(500, 1000));

      this.log('🎨 Found exterior color dropdown, clicking...');
      dropdown.click();
      await this.delay(this.randomDelay(1200, 2000));

      // Search options only within the visible options container
      let optionsContainer = null;
      try {
        optionsContainer = await this.waitForElement(['[role="listbox"]','[role="menu"]'], 4000);
      } catch {}
      const options = Array.from((optionsContainer || document).querySelectorAll('[role="option"]'));
      let option = options.find((opt) => {
        const txt = (opt.textContent || '').trim();
        const label = opt.getAttribute?.('aria-label') || '';
        return normalizeKey(txt) === target || normalizeKey(label) === target || normalizeKey(txt).includes(target);
      });

      if (!option && target.includes('offwhite')) {
        option = options.find((opt) => normalizeKey(opt.textContent || '').includes('offwhite'));
      }

      // Fallback to keyboard-driven selection
      if (!option) {
        const success = await this.selectDropdownOption(['[aria-label*="Exterior color"]','text:Exterior color'], exteriorColor, true);
        if (success) {
          // Verify selection is displayed near the label
          const verify = this.findDropdownByLabel('Exterior color') || dropdown;
          const ok = (verify?.textContent || '').toLowerCase().includes(norm(exteriorColor));
          if (ok) { this.log(`✅ Successfully selected exterior color: ${exteriorColor}`); return true; }
        }
      }

      if (!option) throw new Error(`Exterior color option "${exteriorColor}" not found`);

      await this.scrollIntoView(option);
      await this.delay(this.randomDelay(300, 600));
      await this.performFacebookDropdownClick(option);

      await this.delay(this.randomDelay(800, 1500));
      // Verify the displayed value updated
      const verify = this.findDropdownByLabel('Exterior color') || dropdown;
      const ok = (verify?.textContent || '').toLowerCase().includes(norm(exteriorColor));
      if (!ok) this.log('⚠️ Exterior color may not have applied visually yet.');
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

      const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const normalizeKey = (s) => norm(s).replace(/[\s-]/g, '');
      const target = normalizeKey(interiorColor);

      // Find the dropdown by looking for the label text and closest clickable element
      let dropdown = this.findDropdownByLabel('Interior color');

      if (!dropdown) {
        await this.ensureAdditionalFieldsVisible();
        dropdown = this.findDropdownByLabel('Interior color');
      }

      // Try XPath to find interior color dropdown
      if (!dropdown) {
        try {
          const elements = document.evaluate(
            `//div[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "interior color") or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "interior")]/following-sibling::*[contains(@role, "button") or contains(@class, "dropdown")]`,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          if (elements.singleNodeValue) {
            dropdown = elements.singleNodeValue;
          }
        } catch {}
      }

      if (!dropdown) {
        // Fallback to direct search
        const els = document.querySelectorAll('div[role="button"], span[role="button"], [role="combobox"]');
        for (let el of els) {
          const pt = norm(el.parentElement?.textContent || '');
          const prev = norm(el.previousElementSibling?.textContent || '');
          if (pt.includes('interior color') || prev.includes('interior color')) { dropdown = el; break; }
        }
      }

      if (!dropdown) throw new Error('Interior color dropdown not found');

      await this.scrollIntoView(dropdown);
      await this.delay(this.randomDelay(500, 1000));

      this.log('🪑 Found interior color dropdown, clicking...');
      dropdown.click();
      await this.delay(this.randomDelay(1200, 2000));

      // Search options only within the visible options container
      let optionsContainer = null;
      try {
        optionsContainer = await this.waitForElement(['[role="listbox"]','[role="menu"]'], 4000);
      } catch {}
      const options = Array.from((optionsContainer || document).querySelectorAll('[role="option"]'));
      let option = options.find((opt) => {
        const txt = (opt.textContent || '').trim();
        const label = opt.getAttribute?.('aria-label') || '';
        return normalizeKey(txt) === target || normalizeKey(label) === target || normalizeKey(txt).includes(target);
      });

      if (!option && target.includes('offwhite')) {
        option = options.find((opt) => normalizeKey(opt.textContent || '').includes('offwhite'));
      }

      // Fallback to keyboard-driven selection
      if (!option) {
        const success = await this.selectDropdownOption(['[aria-label*="Interior color"]','text:Interior color'], interiorColor, true);
        if (success) {
          const verify = this.findDropdownByLabel('Interior color') || dropdown;
          const ok = (verify?.textContent || '').toLowerCase().includes(norm(interiorColor));
          if (ok) { this.log(`✅ Successfully selected interior color: ${interiorColor}`); return true; }
        }
      }

      if (!option) throw new Error(`Interior color option "${interiorColor}" not found`);

      await this.scrollIntoView(option);
      await this.delay(this.randomDelay(300, 600));
      await this.performFacebookDropdownClick(option);

      await this.delay(this.randomDelay(800, 1500));
      const verify = this.findDropdownByLabel('Interior color') || dropdown;
      const ok = (verify?.textContent || '').toLowerCase().includes(norm(interiorColor));
      if (!ok) this.log('⚠️ Interior color may not have applied visually yet.');
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
      
      // Enhanced search strategy using the same successful pattern as other fields
      let checkbox = null;
      
      console.log(`[CLEAN TITLE DEBUG] Starting search for clean title checkbox`);
      
      // Strategy 1: Look for known Facebook checkbox patterns from logs
      const ariaLabelSelectors = [
        'input[name="title_status"]',
        'input[value="on"][name="title_status"]',
        '[aria-label*="clean title" i]',
        '[aria-label*="This vehicle has a clean title" i]',
        'input[type="checkbox"][aria-label*="title"]'
      ];
      
      for (let selector of ariaLabelSelectors) {
        console.log(`[CLEAN TITLE DEBUG] Trying selector: ${selector}`);
        checkbox = await this.waitForElement(selector, 500);
        if (checkbox) {
          console.log(`[CLEAN TITLE DEBUG] Found checkbox with selector: ${selector}`, checkbox);
          this.log(`✅ Found clean title checkbox using: ${selector}`);
          break;
        }
      }
      
      // Strategy 2: Search by text content like successful dropdowns
      if (!checkbox) {
        const textCandidates = [
          'clean title',
          'This vehicle has a clean title',
          'title_status'
        ];
        
        for (let text of textCandidates) {
          // Look for text and find associated input
          const textElements = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent && el.textContent.toLowerCase().includes(text.toLowerCase())
          );
          
          for (let textEl of textElements) {
            // Look for checkbox in siblings or parent
            const nearby = [
              ...textEl.querySelectorAll('input[type="checkbox"], [role="checkbox"]'),
              ...textEl.parentElement?.querySelectorAll('input[type="checkbox"], [role="checkbox"]') || [],
              textEl.previousElementSibling,
              textEl.nextElementSibling
            ].filter(Boolean);
            
            for (let el of nearby) {
              if (el.type === 'checkbox' || el.getAttribute('role') === 'checkbox') {
                checkbox = el;
                break;
              }
            }
            if (checkbox) break;
          }
          if (checkbox) break;
        }
      }
      
      // Strategy 3: Enhanced XPath with case-insensitive search
      if (!checkbox) {
        try {
          const xpathQueries = [
            `//input[@type="checkbox" and contains(@aria-label, "clean title")]`,
            `//input[@type="checkbox" and @name="title_status"]`,
            `//input[@type="checkbox"][ancestor::*[contains(text(), "clean title")]]`,
            `//input[@type="checkbox"][following-sibling::*[contains(text(), "clean title")]]`,
            `//input[@type="checkbox"][preceding-sibling::*[contains(text(), "clean title")]]`,
            `//*[@role="checkbox"][ancestor::*[contains(text(), "clean title")]]`
          ];
          
          for (let query of xpathQueries) {
            const result = document.evaluate(query, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (result.singleNodeValue) {
              checkbox = result.singleNodeValue;
              break;
            }
          }
        } catch (e) {
          this.log('XPath search failed, continuing...');
        }
      }
      
      if (!checkbox) {
        throw new Error('Clean title checkbox not found after comprehensive search');
      }

      // Normalize to the actual checkbox control if a wrapper/icon was matched
      if (checkbox && !(checkbox.tagName === 'INPUT' || checkbox.getAttribute('role') === 'checkbox')) {
        const container = checkbox.closest('label, div, span, section, form');
        const alt = container?.querySelector('input[type="checkbox"], [role="checkbox"]');
        if (alt) checkbox = alt;
      }
      
      await this.scrollIntoView(checkbox);
      await this.closeAnyOpenDropdown();
      
      // Force close any overlapping elements before interacting
      await this.delay(500);
      
      const getChecked = () => (
        checkbox.checked === true ||
        checkbox.getAttribute('aria-checked') === 'true' ||
        checkbox.getAttribute('data-checked') === 'true' ||
        checkbox.classList.contains('checked')
      );
      
      let isChecked = getChecked();
      console.log(`[CLEAN TITLE DEBUG] Current checkbox state: ${isChecked}, should be: ${shouldCheck}`);
      this.log(`📋 Current checkbox state: ${isChecked}, should be: ${shouldCheck}`);
      
      // Only interact with checkbox if state needs to change
      if (shouldCheck && !isChecked) {
        console.log(`[CLEAN TITLE DEBUG] Need to CHECK the checkbox`);
        this.log('📋 Checking clean title checkbox...');
        
        // Try multiple interaction methods for stubborn checkboxes
        checkbox.click();
        await this.delay(500);
        
        // Verify the click worked
        isChecked = getChecked();
        console.log(`[CLEAN TITLE DEBUG] After click, checkbox state: ${isChecked}`);
        
        if (!isChecked) {
          console.log(`[CLEAN TITLE DEBUG] Click failed, trying React-style interaction`);
          // Try React-style interaction
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked').set;
          nativeInputValueSetter.call(checkbox, true);
          checkbox.dispatchEvent(new Event('input', { bubbles: true }));
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          await this.delay(500);
          
          isChecked = getChecked();
          console.log(`[CLEAN TITLE DEBUG] After React-style, checkbox state: ${isChecked}`);
        }
        
        if (!isChecked) {
          console.log(`[CLEAN TITLE DEBUG] React-style failed, trying keyboard interaction`);
          // Try focus and space key
          checkbox.focus();
          await this.delay(100);
          checkbox.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
          checkbox.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));
          await this.delay(500);
          
          isChecked = getChecked();
          console.log(`[CLEAN TITLE DEBUG] After keyboard, checkbox state: ${isChecked}`);
        }
        
      } else if (!shouldCheck && isChecked) {
        console.log(`[CLEAN TITLE DEBUG] Need to UNCHECK the checkbox`);
        this.log('📋 Unchecking clean title checkbox...');
        checkbox.click();
        await this.delay(500);
        
      } else {
        console.log(`[CLEAN TITLE DEBUG] Checkbox is already in correct state, no action needed`);
        this.log(`📋 Clean title checkbox already in correct state: ${isChecked}`);
      }
      
      // Final verification
      const finalState = getChecked();
      console.log(`[CLEAN TITLE DEBUG] Final checkbox state: ${finalState} (expected: ${shouldCheck})`);
      this.log(`📋 Final checkbox state: ${finalState} (expected: ${shouldCheck})`);
      
      if (finalState === shouldCheck) {
        this.log(`✅ Successfully set clean title: ${shouldCheck}`);
        return true;
      } else {
        this.log(`⚠️ Clean title checkbox state mismatch - expected: ${shouldCheck}, actual: ${finalState}`);
        return false;
      }
      
    } catch (error) {
      this.log(`⚠️ Could not set clean title checkbox`, error);
      return false;
    }
  }

  // Select Vehicle Condition dropdown (force Excellent)
  async selectVehicleCondition(condition = 'Excellent') {
    try {
      // Always force Excellent as per requirement
      condition = 'Excellent';
      this.log(`⭐ Selecting vehicle condition: ${condition}`);
      await this.closeAnyOpenDropdown();
      
      // Find the dropdown by looking for the label text and closest clickable element
      let dropdown = this.findDropdownByLabel('Vehicle condition');
      
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
      dropdown.click();
      await this.delay(this.randomDelay(1200, 1800));
      
      // Locate option and click using React-compatible click
      let option = null;
      const optionSelectors = [
        `//div[@role="option" and contains(text(), "${condition}")]`,
        `//div[contains(text(), "${condition}") and contains(@class, "option")]`,
        `//li[contains(text(), "${condition}")]`
      ];
      
      for (let selector of optionSelectors) {
        const result = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (result.singleNodeValue) { option = result.singleNodeValue; break; }
      }
      
      if (!option) {
        const success = await this.selectDropdownOption(['[aria-label*="Vehicle condition"]','text:Condition','text:Vehicle condition'], condition, true);
        if (success) { this.log(`✅ Successfully selected vehicle condition: ${condition}`); return true; }
        throw new Error(`Vehicle condition option "${condition}" not found`);
      }
      
      await this.scrollIntoView(option);
      await this.performFacebookDropdownClick(option);
      await this.delay(this.randomDelay(800, 1200));
      
      // Verification
      const verify = this.findDropdownByLabel('Vehicle condition') || dropdown;
      const ok = (verify?.textContent || '').toLowerCase().includes('excellent');
      if (!ok) this.log('⚠️ Vehicle condition may not have applied visually yet.');
      this.log(`✅ Successfully selected vehicle condition: ${condition}`);
      return true;
      
    } catch (error) {
      this.log(`⚠️ Could not select vehicle condition: ${condition}`, error);
      return false;
    }
  }

  // Select Fuel Type dropdown with enhanced detection (similar to body style)
  async selectFuelType(fuelType) {
    try {
      this.log(`⛽ Selecting fuel type: ${fuelType}`);
      console.log(`[FUEL DEBUG] Starting fuel type selection for: ${fuelType}`);
      
      const normalized = this.mapFuelType(fuelType) || fuelType;
      console.log(`[FUEL DEBUG] Normalized fuel type: ${normalized}`);
      
      await this.closeAnyOpenDropdown();
      await this.delay(500);
      
      // Find fuel type dropdown with multiple strategies
      const fuelDropdownSelectors = [
        'text:Fuel type',
        '[aria-label*="Fuel type"]',
        'div[role="button"]:has-text("Fuel type")',
        'span:has-text("Fuel type")',
        '[data-testid*="fuel"]'
      ];
      
      console.log(`[FUEL DEBUG] Searching for fuel type dropdown with selectors:`, fuelDropdownSelectors);
      
      const dropdown = await this.waitForElement(fuelDropdownSelectors, 8000);
      if (!dropdown) {
        throw new Error('Fuel type dropdown not found');
      }
      
      console.log(`[FUEL DEBUG] Found fuel type dropdown:`, dropdown);
      console.log(`[FUEL DEBUG] Dropdown tagName:`, dropdown.tagName);
      console.log(`[FUEL DEBUG] Dropdown innerHTML:`, dropdown.innerHTML);
      
      await this.scrollIntoView(dropdown);
      this.log('⛽ Found fuel type dropdown, clicking to open...');
      
      console.log(`[FUEL DEBUG] Clicking fuel type dropdown...`);
      dropdown.click();
      await this.delay(2000);
      
      console.log(`[FUEL DEBUG] Checking if dropdown opened...`);
      const optionsAfterClick = document.querySelectorAll('[role="option"]');
      console.log(`[FUEL DEBUG] Found options after click:`, optionsAfterClick.length);
      
      // Log available options for debugging
      Array.from(optionsAfterClick).slice(0, 15).forEach((opt, idx) => {
        console.log(`[FUEL DEBUG] Option ${idx}: ${opt.textContent?.trim()}`, opt);
      });
      
      console.log(`[FUEL DEBUG] 🎯 Using enhanced option selection for: ${normalized}`);
      
      // Use multiple approaches to find the fuel type option
      let fuelOption = null;
      
      // Method 1: Find by exact text match using waitForElement
      try {
        const fuelSelectors = [
          `text:${normalized}`,
          `[role="option"]:has-text("${normalized}")`,
          `div:has-text("${normalized}")`,
          `span:has-text("${normalized}")`,
          `li:has-text("${normalized}")`,
          `[data-value="${normalized}"]`,
          `[aria-label*="${normalized}"]`,
          `*[title="${normalized}"]`
        ];
        
        console.log(`[FUEL DEBUG] Searching for fuel option with selectors:`, fuelSelectors);
        fuelOption = await this.waitForElement(fuelSelectors, 3000);
        console.log(`[FUEL DEBUG] ✅ Found fuel option using waitForElement:`, fuelOption);
        
        if (fuelOption) {
          console.log(`[FUEL DEBUG] Option text:`, fuelOption?.textContent || fuelOption?.innerHTML);
          console.log(`[FUEL DEBUG] Option tagName:`, fuelOption?.tagName);
          console.log(`[FUEL DEBUG] Option role:`, fuelOption?.getAttribute('role'));
        }
        
      } catch (waitError) {
        console.log(`[FUEL DEBUG] ⚠️ waitForElement failed, falling back to manual search:`, waitError.message);
        
        // Method 2: Manual search through options with exact match
        fuelOption = Array.from(optionsAfterClick).find(opt => 
          opt.textContent?.trim() === normalized
        );
        
        // Method 3: Fuzzy match if exact fails
        if (!fuelOption) {
          fuelOption = Array.from(optionsAfterClick).find(opt => 
            opt.textContent?.trim().toLowerCase().includes(normalized.toLowerCase())
          );
        }
        
        // Method 4: Try common variations
        if (!fuelOption && normalized === 'Gasoline') {
          fuelOption = Array.from(optionsAfterClick).find(opt => {
            const text = opt.textContent?.trim().toLowerCase();
            return text === 'gas' || text === 'petrol' || text === 'gasoline';
          });
        }
        
        if (!fuelOption && normalized === 'Hybrid') {
          fuelOption = Array.from(optionsAfterClick).find(opt => {
            const text = opt.textContent?.trim().toLowerCase();
            return text.includes('hybrid') || text === 'plug-in hybrid';
          });
        }
        
        console.log(`[FUEL DEBUG] Manual search result:`, fuelOption);
      }
      
      if (!fuelOption) {
        console.log(`[FUEL DEBUG] ❌ No fuel option found for: ${normalized}`);
        console.log(`[FUEL DEBUG] Available options:`, Array.from(optionsAfterClick).map(opt => opt.textContent?.trim()));
        throw new Error(`Fuel type option ${normalized} not found among ${optionsAfterClick.length} options`);
      }
      
      console.log(`[FUEL DEBUG] ⛽ Found fuel option, clicking: ${normalized}`);
      await this.performFacebookDropdownClick(fuelOption);
      await this.delay(2000);
      
      // Enhanced verification
      console.log(`[FUEL DEBUG] Verifying fuel type selection...`);
      await this.delay(500);
      console.log(`[FUEL DEBUG] Dropdown selected value:`, dropdown.textContent?.trim());
      
      // Check if fuel type appears in form
      const dropdownText = dropdown.textContent?.trim();
      const success = dropdownText?.includes(normalized) || 
                     dropdownText?.includes(fuelType) ||
                     document.body.textContent.includes(`Fuel type: ${normalized}`);
      
      console.log(`[FUEL DEBUG] Fuel type verification:`, {
        dropdownContainsFuel: dropdownText?.includes(normalized),
        success: success
      });
      
      if (success) {
        this.log(`✅ Successfully filled fuel type: ${normalized}`);
        return true;
      } else {
        this.log(`⚠️ Fuel type selection may have failed - dropdown text: ${dropdownText}`);
        return false;
      }
      
    } catch (error) {
      this.log(`⚠️ Could not select fuel type: ${fuelType}`, error);
      console.log(`[FUEL DEBUG] ❌ Error selecting fuel type:`, error);
      return false;
    }
  }

  // Transmission dropdown using successful field pattern
  async selectTransmission(transmission) {
    try {
      this.log(`⚙️ Selecting transmission: ${transmission}`);
      await this.closeAnyOpenDropdown();
      
      // Use the same successful pattern as other dropdowns
      let dropdown = await this.waitForElement('[aria-label*="Transmission"]', 2000);
      
      if (!dropdown) {
        // Try text-based search like successful fields
        dropdown = await this.waitForElement('text:Transmission', 1000);
      }
      
      if (!dropdown) {
        // Try expanding fields first
        await this.ensureAdditionalFieldsVisible();
        await this.delay(1000);
        dropdown = await this.waitForElement('[aria-label*="Transmission"]', 2000) || 
                  await this.waitForElement('text:Transmission', 1000);
      }
      
      if (!dropdown) {
        throw new Error('Transmission dropdown not found');
      }
      
      await this.scrollIntoView(dropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      // Use the same clicking pattern as successful dropdowns
      await this.performFacebookDropdownClick(dropdown);
      await this.delay(this.randomDelay(1500, 2500));
      
      // Enhanced option matching using the same pattern as other successful fields
      const mappedTransmission = this.mapTransmission(transmission);
      const candidates = [
        mappedTransmission,
        transmission,
        'Automatic transmission',
        'Automatic',
        'Manual transmission', 
        'Manual'
      ].filter(Boolean);
      
      this.log(`🔍 Searching for transmission options: ${candidates.join(', ')}`);
      
      // Use enhanced waitForElement like successful fields
      for (const candidate of candidates) {
        this.log(`🔍 Trying transmission option: ${candidate}`);
        
        // Fixed selector construction to avoid syntax errors
        const optionSelectors = [
          `[role="option"]:has-text("${candidate}")`,
          `div[role="option"]:contains("${candidate}")`,
          `*[role="option"]`
        ];
        
        // First try text-based search which works reliably
        try {
          const option = await this.waitForElement(`text:${candidate}`, 1000);
          if (option) {
            await this.scrollIntoView(option);
            await this.delay(this.randomDelay(200, 500));
            await this.performFacebookDropdownClick(option);
            await this.delay(this.randomDelay(800, 1200));
            this.log(`✅ Successfully selected transmission: ${candidate}`);
            return true;
          }
        } catch (e) {
          this.log(`⚠️ Text search failed for ${candidate}:`, e.message);
        }
        
        // Fallback to manual option search
        try {
          const options = document.querySelectorAll('[role="option"]');
          for (let opt of options) {
            if (opt.textContent && opt.textContent.trim().toLowerCase().includes(candidate.toLowerCase())) {
              await this.scrollIntoView(opt);
              await this.delay(this.randomDelay(200, 500));
              await this.performFacebookDropdownClick(opt);
              await this.delay(this.randomDelay(800, 1200));
              this.log(`✅ Successfully selected transmission: ${candidate} (manual search)`);
              return true;
            }
          }
        } catch (e) {
          this.log(`⚠️ Manual search failed for ${candidate}:`, e.message);
        }
      }
      
      // Final XPath fallback
      const fallbackXpath = `//div[@role="option" and contains(text(), "Automatic")]`;
      const result = document.evaluate(fallbackXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (result.singleNodeValue) {
        await this.performFacebookDropdownClick(result.singleNodeValue);
        await this.delay(800);
        this.log('✅ Selected transmission: Automatic (fallback)');
        return true;
      }
      
      throw new Error('No matching transmission option found');
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
    if (v.includes('van') || v.includes('minivan')) return 'Van/Minivan';
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
        const uniqueImages = Array.from(new Set((images || []).filter(Boolean)));
        this.log(`📸 Processing ${uniqueImages.length} images (deduped)...`);
      const files = await this.getPreDownloadedImages(uniqueImages);
      
      if (files.filter(f => f !== null).length === 0) {
        this.log('📸 No pre-downloaded images found, downloading now...');
        const downloadedFiles = await this.downloadImagesViaBackground(uniqueImages);
        files.splice(0, files.length, ...downloadedFiles);
      }
      
      const validFiles = files.filter(file => file !== null);
      
      this.log(`📸 Successfully processed ${validFiles.length} out of ${uniqueImages.length} images`);
      
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

  // Navigation guards to prevent accidental redirects during posting
  installNavigationGuards() {
    if (this._navGuardsInstalled) return;
    this._navGuardsInstalled = true;

    // Block anchor navigations that would navigate away during posting
    const anchorBlocker = (e) => {
      if (!this.isPosting) return;
      const a = e.target?.closest && e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      const abs = a.href || href;
      const inMenu = !!a.closest('[role="listbox"], [role="menu"], [aria-haspopup="listbox"], [data-visualcompletion="ignore-dynamic"]');
      const offCreate = abs && !abs.includes('facebook.com/marketplace/create');
      if (inMenu || offCreate) {
        e.preventDefault();
        e.stopPropagation();
        a.removeAttribute('href');
        a.setAttribute('data-salesonator-blocked', 'true');
        console.warn('[Salesonator] Blocked anchor navigation during posting:', abs || a.textContent?.trim());
      }
    };
    document.addEventListener('click', anchorBlocker, true);
    document.addEventListener('auxclick', anchorBlocker, true);
    document.addEventListener('mousedown', anchorBlocker, true);
    document.addEventListener('keydown', (e) => {
      if (!this.isPosting) return;
      if (e.key === 'Enter') {
        const a = e.target?.closest && e.target.closest('a[href]');
        if (a) { e.preventDefault(); e.stopPropagation(); }
      }
    }, true);

    // Block programmatic window.open during posting if it would leave the create flow
    try {
      this._origOpen = window.open.bind(window);
      window.open = (...args) => {
        try {
          if (this.isPosting) {
            const url = String(args?.[0] || '');
            if (url && !url.includes('facebook.com/marketplace/create')) {
              console.warn('[Salesonator] Blocked window.open during posting:', url);
              return null;
            }
          }
        } catch {}
        return this._origOpen(...args);
      };

      // Guard History API navigations during posting
      const allowUrl = (u) => typeof u === 'string' ? u.includes('/marketplace/create') : true;
      const origPush = history.pushState.bind(history);
      const origReplace = history.replaceState.bind(history);
      history.pushState = (state, title, url) => {
        if (this.isPosting && url && !allowUrl(url)) {
          console.warn('[Salesonator] Blocked history.pushState during posting:', url);
          return;
        }
        return origPush(state, title, url);
      };
      history.replaceState = (state, title, url) => {
        if (this.isPosting && url && !allowUrl(url)) {
          console.warn('[Salesonator] Blocked history.replaceState during posting:', url);
          return;
        }
        return origReplace(state, title, url);
      };

      window.addEventListener('popstate', () => {
        if (this.isPosting && !location.pathname.includes('/marketplace/create')) {
          console.warn('[Salesonator] Detected popstate away from create; preventing');
          // Attempt to return to create page context softly
          // Do not navigate; just stop further actions
        }
      }, true);
    } catch {}
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
      
      // Never click anchors (prevent accidental navigation); prefer closest option container
      let el = element;
      if (el && el.tagName === 'A') {
        const candidate = el.closest('[role="option"]');
        if (candidate) {
          console.warn('[FACEBOOK CLICK] Element is an <a>; switching to closest role=option to prevent navigation');
          el = candidate;
        } else {
          console.warn('[FACEBOOK CLICK] Element is an <a> without role=option parent; aborting click to avoid navigation');
          return;
        }
      }
      
      // Ensure element is in view and focused
      await this.scrollIntoView(el);
      await this.delay(this.randomDelay(200, 400));

      // Temporarily disable any nested anchors to prevent navigation
      const nestedAnchors = Array.from(el.querySelectorAll?.('a[href]') || []);
      nestedAnchors.forEach(a => {
        a.setAttribute('data-salesonator-original-href', a.getAttribute('href'));
        a.removeAttribute('href');
      });

      // Pre-click preparation - mimic human behavior
      el.focus();
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
          el.dispatchEvent(event);
          await this.delay(this.randomDelay(20, 80));
        } catch (e) {
          console.warn(`[FACEBOOK CLICK] Event ${event.type} failed:`, e);
        }
      }

      // Additional React synthetic event triggers
      try {
        // Trigger React's onChange and other synthetic events
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
          this.setNativeValue(el, el.value);
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