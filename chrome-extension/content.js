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
          // Method 1: XPath approach (prefer interactive elements, ignore script/style/meta)
          try {
            const xpath = 
              `.//*[not(self::script or self::style or self::meta or self::title)]` +
              `[contains(normalize-space(text()), "${text}")]`;
            const result = document.evaluate(xpath, parentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (result.singleNodeValue) {
              const elem = result.singleNodeValue;
              const tag = (elem.tagName || '').toUpperCase();
              const bad = tag === 'SCRIPT' || tag === 'STYLE' || tag === 'META' || tag === 'TITLE';
              const isHidden = elem.hasAttribute('aria-hidden') && elem.getAttribute('aria-hidden') === 'true';
              if (!bad && !isHidden) return elem;
            }
          } catch (e) {}
          // Method 2: Manual text search with element filtering
          const elements = Array.from(parentElement.querySelectorAll('*'));
          const found = elements.find(el => {
            const textContent = el.textContent?.trim() || '';
            const innerText = el.innerText?.trim() || '';
            const isMatch = textContent.includes(text) || innerText.includes(text);
            if (!isMatch) return false;
            const tag = (el.tagName || '').toUpperCase();
            if (['SCRIPT','STYLE','META','TITLE'].includes(tag)) return false;
            const ariaLabel = el.getAttribute('aria-label') || '';
            const isDisabled = el.hasAttribute('aria-disabled') && el.getAttribute('aria-disabled') === 'true';
            const isHidden = el.hasAttribute('aria-hidden') && el.getAttribute('aria-hidden') === 'true';
            const isBackButton = ariaLabel.toLowerCase().includes('back');
            return !isDisabled && !isHidden && !isBackButton;
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
      for (let i = 0; i < 5; i++) {
        const openMenu =
          document.querySelector('[role="listbox"]') ||
          document.querySelector('[role="menu"]') ||
          document.querySelector('[data-visualcompletion="ignore-dynamic"] [role="option"]');
        if (!openMenu) break;
        // Press Escape and click on the page to dismiss
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        document.activeElement?.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
        await this.delay(120);
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await this.delay(120);
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
          
          // Fill the form strictly in the requested order (includes images + location)
          await this.fillVehicleFormUserOrder(vehicleData);
          await this.delay(1000, attempt);
          
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

  // Strict, user-specified posting order implementation
  async fillVehicleFormUserOrder(vehicleData) {
    this.log('🧭 Filling form in strict user-defined order');

    const attempt = async (label, fn, retries = 2) => {
      for (let i = 0; i <= retries; i++) {
        await this.closeAnyOpenDropdown();
        const ok = await fn();
        await this.delay(this.randomDelay(350, 750));
        await this.closeAnyOpenDropdown();
        if (ok) return true;
        this.log(`⚠️ ${label} failed (try ${i + 1}/${retries + 1})`);
      }
      throw new Error(`${label} failed after retries`);
    };

    const safeDelay = async (min = 500, max = 900) => { await this.delay(this.randomDelay(min, max)); };

    // 1) Vehicle type (dropdown)
    await attempt('Vehicle type', async () => this.selectVehicleType());
    await safeDelay(1200, 1800);

    // 2) Images (distinct, max 10)
    if (vehicleData.images && vehicleData.images.length) {
      const imgs = Array.from(new Set(vehicleData.images.filter(Boolean))).slice(0, 10);
      await attempt('Images', async () => this.handleImageUploads(imgs));
      await safeDelay(900, 1400);
    }

    // 3) Location (typed, clear first, choose suggestion)
    await attempt('Location', async () => { try { await this.setLocationTyped(vehicleData); return true; } catch { return false; } });

    // 4) Year (dropdown)
    if (vehicleData.year) {
      await attempt('Year', async () => this.selectYear(vehicleData.year));
    }

    // 5) Make (typeahead dropdown)
    if (vehicleData.make) {
      await attempt('Make', async () => this.selectMake(vehicleData.make));
      await safeDelay(800, 1200); // Extra delay after Make to ensure it's fully processed
    }

    // 6) Model (typed, Title Case)
    await attempt('Model', async () => {
      try {
        const model = this.toTitleCase(String(vehicleData.model || ''));
        const el = await this.waitForElement(['[aria-label*="Model"]','input[placeholder*="Model"]','input[name*="model"]'], 6000);
        await this.scrollIntoView(el);
        if (el.select) el.select();
        this.setNativeValue(el, '');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await this.delay(80);
        await this.typeHumanLike(el, model);
        return (el.value || '').trim().length > 0;
      } catch { return false; }
    });

    // 7) Mileage (typed, min 300)
    await attempt('Mileage', async () => {
      let miles = parseInt(String(vehicleData.mileage||vehicleData.odometer||'').replace(/[^\d]/g,''),10);
      if (!miles || miles < 300) miles = 300;
      return this.fillMileage(miles);
    });

    // 8) Price (typed)
    await attempt('Price', async () => this.fillPrice(vehicleData.price));

    // 9) Body style (dropdown)
    const mappedBodyStyle = vehicleData.bodyStyle || vehicleData.body_style || this.mapBodyStyle(vehicleData.body_style_nhtsa || vehicleData.vehicle_type_nhtsa || '');
    if (mappedBodyStyle) {
      await attempt('Body style', async () => this.selectBodyStyle(mappedBodyStyle));
    }

    // 10) Exterior color (dropdown)
    const ext = this.standardizeExteriorColor(vehicleData.exteriorColor || vehicleData.exterior_color);
    if (ext && ext !== 'Unknown') {
      await attempt('Exterior color', async () => this.selectExteriorColor(ext));
    }

    // 11) Interior color (dropdown)
    const intr = this.standardizeInteriorColor(vehicleData.interiorColor || vehicleData.interior_color);
    if (intr) {
      await attempt('Interior color', async () => this.selectInteriorColor(intr));
    }

    // 12) Title status (checkbox -> Clean title)
    await attempt('Title status', async () => this.selectCleanTitle(true));

    // 13) Vehicle condition (dropdown -> Excellent)
    await attempt('Vehicle condition', async () => this.selectVehicleCondition('Excellent'));

    // 14) Fuel type (dropdown)
    const fuel = this.mapFuelType(vehicleData.fuelType || vehicleData.fuel_type || vehicleData.fuel_type_nhtsa || '');
    if (fuel) {
      await attempt('Fuel type', async () => this.selectFuelType(fuel));
    }

    // 15) Transmission type (dropdown)
    const trans = this.mapTransmission(vehicleData.transmission || vehicleData.transmission_nhtsa || 'Automatic');
    await attempt('Transmission', async () => this.selectTransmission(trans));

    // 16) Description (typed)
    const description = vehicleData.ai_description || vehicleData.description || `${vehicleData.year||''} ${vehicleData.make||''} ${this.toTitleCase(vehicleData.model||'')}`.trim();
    await attempt('Description', async () => this.fillDescription(description));

    this.log('✅ Strict order form fill complete');
  }

  // Type location and pick the first suggestion
  async setLocationTyped(vehicleData) {
    const guess = (obj)=>[obj?.location, obj?.city, obj?.city_state, obj?.location_name, obj?.dealer_city, obj?.dealer_location, obj?.state ? `${obj.city||''} ${obj.state}`.trim() : null].find(Boolean);
    const value = guess(vehicleData) || 'North Aurora';

    const input = await this.waitForElement(['[aria-label*="Location"]','input[placeholder*="Location"]','input[name*="location"]'], 6000);
    await this.scrollIntoView(input);
    input.focus();
    if (input.select) input.select();
    // Hard clear before typing
    this.setNativeValue(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await this.delay(100);
    await this.typeHumanLike(input, value);
    await this.delay(400);
    // pick first suggestion if present
    try {
      const firstOpt = await this.waitForElement(['[role="listbox"] [role="option"]','[role="listbox"] li','ul[role="listbox"] li'], 3000);
      await this.scrollIntoView(firstOpt);
      await this.performFacebookDropdownClick(firstOpt);
    } catch {
      // Fallback: press Enter to accept the top suggestion
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    }
  }

  toTitleCase(str) {
    const s = (str||'').toString().toLowerCase();
    return s.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1));
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
  // Enhanced dropdown context validation
  validateDropdownContext(dropdown, expectedFieldType, expectedOptions = []) {
    try {
      // Get the dropdown's context by checking nearby labels and container text
      const container = dropdown.closest('div, section, fieldset') || dropdown.parentElement;
      const containerText = (container?.textContent || '').toLowerCase();
      
      // Check if any expected options are present when dropdown is open
      if (expectedOptions.length > 0) {
        const hasExpectedOptions = expectedOptions.some(option => 
          containerText.includes(option.toLowerCase())
        );
        if (!hasExpectedOptions) {
          this.log(`❌ Dropdown context validation failed: Expected options not found`);
          return false;
        }
      }
      
      // Check for field-specific context
      const fieldIndicators = {
        'make': ['make', 'manufacturer', 'brand'],
        'bodystyle': ['body style', 'style', 'type', 'sedan', 'suv', 'coupe'],
        'exteriorcolor': ['exterior', 'color', 'paint'],
        'interiorcolor': ['interior', 'cabin', 'upholstery']
      };
      
      const indicators = fieldIndicators[expectedFieldType.toLowerCase()] || [];
      const hasFieldContext = indicators.some(indicator => 
        containerText.includes(indicator)
      );
      
      this.log(`🔍 Dropdown context validation: ${hasFieldContext ? '✅ Valid' : '❌ Invalid'} for ${expectedFieldType}`);
      return hasFieldContext;
    } catch (error) {
      this.log(`⚠️ Context validation error:`, error);
      return false; // Fail safe
    }
  }

  async selectMake(make) {
    try {
      this.log(`🏭 STEP 2: Selecting make: ${make}`);
      
      // Clean make string (remove extra spaces)
      const cleanMake = (make || '').toString().trim();
      
      // Close any open dropdowns first to prevent interference
      await this.closeAnyOpenDropdown();
      await this.delay(this.randomDelay(500, 800));
      
      // Find Make dropdown with better context awareness
      this.log('🔍 Looking for Make dropdown specifically...');
      let makeDropdown = this.findDropdownByLabel('Make');
      
      if (!makeDropdown) {
        // Try more specific selectors for Make field
        const makeSelectors = [
          '[aria-label*="Make" i]',
          'div[role="button"]:has(+ * [aria-label*="Make" i])',
          'div[role="button"]:has(span:contains("Make"))',
        ];
        
        for (const selector of makeSelectors) {
          try {
            makeDropdown = document.querySelector(selector);
            if (makeDropdown) break;
          } catch {}
        }
      }
      
      if (!makeDropdown) {
        throw new Error('Make dropdown not found');
      }
      
      // Validate this is actually the Make dropdown
      this.log('🔍 Validating dropdown context for Make field...');
      const isValidMakeDropdown = this.validateDropdownContext(makeDropdown, 'make', ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'BMW']);
      
      if (!isValidMakeDropdown) {
        this.log('❌ Found dropdown is not the Make dropdown, searching more specifically...');
        // More aggressive search for Make dropdown
        const allDropdowns = document.querySelectorAll('div[role="button"], [role="combobox"]');
        for (const dropdown of allDropdowns) {
          if (this.validateDropdownContext(dropdown, 'make')) {
            makeDropdown = dropdown;
            this.log('✅ Found valid Make dropdown after validation');
            break;
          }
        }
        
        if (!makeDropdown || !this.validateDropdownContext(makeDropdown, 'make')) {
          throw new Error('Could not find valid Make dropdown');
        }
      }
      
      await this.scrollIntoView(makeDropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      this.log('🏭 Opening validated Make dropdown...');
      makeDropdown.focus();
      makeDropdown.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      makeDropdown.click();
      await this.delay(this.randomDelay(1500, 2000)); // Extra time for dropdown to fully open
      
      // Wait for and validate options container
      let optionsContainer = null;
      try {
        optionsContainer = await this.waitForElement(['[role="listbox"]', '[role="menu"]'], 5000);
        this.log('✅ Options container found');
        
        // Double-check this is the right options container by looking for vehicle makes
        const optionTexts = Array.from(optionsContainer.querySelectorAll('[role="option"]'))
          .map(opt => (opt.textContent || '').trim().toLowerCase())
          .slice(0, 5); // Check first 5 options
        
        const hasVehicleMakes = optionTexts.some(text => 
          ['acura', 'audi', 'bmw', 'buick', 'cadillac', 'chevrolet', 'chrysler', 'dodge', 'ford', 'gmc', 'honda', 'hyundai', 'infiniti', 'jeep', 'kia', 'lexus', 'lincoln', 'mazda', 'mercedes', 'mitsubishi', 'nissan', 'ram', 'subaru', 'toyota', 'volkswagen', 'volvo'].includes(text)
        );
        
        if (!hasVehicleMakes) {
          this.log('❌ Options container does not contain vehicle makes! This might be wrong dropdown.');
          throw new Error('Wrong dropdown opened - does not contain vehicle makes');
        }
        
        this.log('✅ Confirmed options container has vehicle makes');
      } catch (error) {
        this.log('❌ Could not find or validate options container:', error);
        throw error;
      }
      
      // Find the correct Make option
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
        this.log('🎯 Trying typeahead for make selection...');
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
      
      if (!makeOption) {
        const availableOptions = Array.from((optionsContainer || document).querySelectorAll('[role="option"]'))
          .map(opt => opt.textContent?.trim())
          .filter(text => text)
          .slice(0, 10);
        throw new Error(`Make option "${cleanMake}" not found. Available options: ${availableOptions.join(', ')}`);
      }
      
      this.log(`🎯 Found make option: "${makeOption.textContent?.trim()}", clicking...`);
      await this.scrollIntoView(makeOption);
      await this.delay(this.randomDelay(300, 600));
      await this.performFacebookDropdownClick(makeOption);
      await this.delay(this.randomDelay(1000, 1500)); // Wait for selection to register
      
      // Enhanced verification with multiple methods
      const verifyMakeSelection = () => {
        // Method 1: Check dropdown text content
        const selectedText = (makeDropdown?.textContent || '').toLowerCase();
        const directMatch = selectedText.includes(cleanMake.toLowerCase());
        
        // Method 2: Check for input value
        const makeContainer = makeDropdown?.closest('div, section, form') || document;
        const comboboxInput = makeContainer.querySelector('input[aria-label*="Make"], [role="combobox"] input');
        const inputValue = comboboxInput ? (comboboxInput.value || comboboxInput.getAttribute('value') || '') : '';
        const inputMatch = inputValue && inputValue.toLowerCase().includes(cleanMake.toLowerCase());
        
        // Method 3: Check selected option state
        const selectedOption = (optionsContainer || document).querySelector('[role="option"][aria-selected="true"]');
        const selectedMatch = selectedOption && ((selectedOption.textContent || '').toLowerCase().includes(cleanMake.toLowerCase()));
        
        // Method 4: Check for hidden inputs or form data
        const hiddenInputs = document.querySelectorAll('input[type="hidden"][name*="make"], input[name*="make"]');
        const hiddenMatch = Array.from(hiddenInputs).some(input => {
          const value = input.value || input.getAttribute('value') || '';
          return value.toLowerCase().includes(cleanMake.toLowerCase());
        });
        
        // Method 5: Check for data attributes on the dropdown
        const dataAttributes = ['data-value', 'data-selected', 'aria-valuenow'];
        const attributeMatch = dataAttributes.some(attr => {
          const value = makeDropdown?.getAttribute(attr) || '';
          return value.toLowerCase().includes(cleanMake.toLowerCase());
        });
        
        // Method 6: Check if dropdown button shows selected value
        const buttonText = makeDropdown?.querySelector('span, div')?.textContent || makeDropdown?.textContent || '';
        const buttonMatch = buttonText.toLowerCase().includes(cleanMake.toLowerCase());
        
        // Method 7: Look for visual indicators of selection (like checkmarks)
        const checkedOption = (optionsContainer || document).querySelector('[role="option"] [aria-label*="checked"], [role="option"] svg[data-icon="check"]');
        const visualMatch = checkedOption && checkedOption.closest('[role="option"]')?.textContent?.toLowerCase().includes(cleanMake.toLowerCase());
        
        // Log all verification methods for debugging
        this.log(`🔍 Make verification methods:`, {
          directMatch,
          inputMatch,
          selectedMatch,
          hiddenMatch,
          attributeMatch,
          buttonMatch,
          visualMatch,
          dropdownText: selectedText,
          inputValue: inputValue || 'none',
          selectedOptionText: selectedOption?.textContent || 'none',
          buttonText: buttonText || 'none'
        });
        
        return directMatch || inputMatch || selectedMatch || hiddenMatch || attributeMatch || buttonMatch || visualMatch;
      };
      
      const verified = verifyMakeSelection();
      const titleMake = cleanMake.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
      
      if (verified) {
        this.log(`✅ STEP 2 COMPLETE: Successfully selected make: ${titleMake}`);
        // Ensure dropdown is closed before proceeding
        await this.closeAnyOpenDropdown();
        await this.delay(this.randomDelay(500, 800));
        return true;
      } else {
        this.log(`❌ STEP 2 FAILED: Make selection not verified through any method. Current dropdown text: ${makeDropdown?.textContent || 'undefined'}`);
        return false;
      }
      
    } catch (error) {
      this.log(`❌ STEP 2 FAILED: Could not select make: ${make}`, error);
      await this.closeAnyOpenDropdown(); // Clean up on error
      return false;
    }
  }

  // Fill Model input
  async fillModel(model) {
    try {
      this.log(`🚗 STEP 3: Filling model: ${model}`);
      
      // Enhanced model input detection with multiple strategies
      const modelInputSelectors = [
        'input[aria-label*="Model" i]',
        'input[placeholder*="Model" i]',
        'input[name*="model" i]',
        'input[aria-describedby*="model" i]',
        '[data-testid*="model" i]',
        '[id*="model" i]'
      ];
      
      let modelInput = null;
      
      // Strategy 1: Direct selector matching
      for (const selector of modelInputSelectors) {
        try {
          modelInput = await this.waitForElement(selector, 1000);
          if (modelInput) {
            this.log(`✅ Found model input with selector: ${selector}`);
            break;
          }
        } catch {}
      }
      
      // Strategy 2: Label-based search
      if (!modelInput) {
        modelInput = this.findInputByLabel('Model') || this.findInputByLabel('Model name');
        if (modelInput) this.log('✅ Found model input via label search');
      }
      
      // Strategy 3: Position-based search (after Make field)
      if (!modelInput) {
        const allInputs = document.querySelectorAll('input[type="text"], input:not([type])');
        for (let i = 0; i < allInputs.length; i++) {
          const input = allInputs[i];
          const container = input.closest('div, section, fieldset');
          const labelText = (container?.textContent || '').toLowerCase();
          
          if (labelText.includes('model') && !labelText.includes('year') && !labelText.includes('make')) {
            modelInput = input;
            this.log('✅ Found model input via position-based search');
            break;
          }
        }
      }
      
      // Strategy 4: Search near Make field
      if (!modelInput) {
        const makeElements = Array.from(document.querySelectorAll('*')).filter(el => 
          el.textContent && el.textContent.toLowerCase().includes('make')
        );
        
        for (const makeEl of makeElements) {
          const parent = makeEl.closest('form, section, div');
          const nearbyInputs = parent?.querySelectorAll('input[type="text"], input:not([type])') || [];
          
          for (const input of nearbyInputs) {
            const container = input.closest('div, section');
            const containerText = (container?.textContent || '').toLowerCase();
            if (containerText.includes('model') && !containerText.includes('make') && !containerText.includes('year')) {
              modelInput = input;
              this.log('✅ Found model input near Make field');
              break;
            }
          }
          if (modelInput) break;
        }
      }
      
      // Strategy 5: XPath queries around label text "Model"
      if (!modelInput) {
        const xpaths = [
          // Input inside an element that mentions "Model"
          "//*[self::label or self::div or self::span][contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), 'model')]//following::input[@type='text' or @role='textbox'][1]",
          // An input whose ancestor contains the word "Model"
          "//input[( @type='text' or @role='textbox') and ancestor::*[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'model')]]",
          // An input immediately following an element that contains "Model"
          "//*[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'model')]/following-sibling::*/descendant-or-self::input[@type='text' or @role='textbox'][1]"
        ];
        for (const xp of xpaths) {
          try {
            const node = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (node && node.tagName === 'INPUT') {
              modelInput = node;
              this.log('✅ Found model input via XPath');
              break;
            }
          } catch {}
        }
      }
      
      // Strategy 6: Heuristic scan of visible text inputs between Make and Mileage labels
      if (!modelInput) {
        const labelEls = Array.from(document.querySelectorAll('*')).filter(el => el.textContent);
        const makeLabel = labelEls.find(el => el.textContent.trim().toLowerCase() === 'make');
        const mileageLabel = labelEls.find(el => el.textContent.trim().toLowerCase() === 'mileage');
        const candidates = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
        for (const input of candidates) {
          const rect = input.getBoundingClientRect();
          if (rect.width < 50 || rect.height < 20) continue; // skip tiny inputs
          // Prefer inputs vertically between make and mileage if we can detect them
          const y = rect.top;
          const inRange = (!makeLabel || y >= makeLabel.getBoundingClientRect().top - 200) &&
                          (!mileageLabel || y <= mileageLabel.getBoundingClientRect().top + 200);
          if (!inRange) continue;
          const containerText = (input.closest('div, section, fieldset')?.textContent || '').toLowerCase();
          if (!containerText.includes('year') && !containerText.includes('price')) {
            modelInput = input;
            this.log('✅ Found model input via heuristic range scan');
            break;
          }
        }
      }
      
      if (!modelInput) {
        throw new Error('Model input not found with any strategy');
      }
      
      await this.scrollIntoView(modelInput);
      await this.delay(this.randomDelay(300, 600));
      
      // Enhanced clearing and setting with multiple attempts
      this.log('🚗 Clearing and setting model value...');
      
      // Attempt 1: Standard React-compatible approach
      modelInput.focus();
      await this.delay(100);
      
      // Clear thoroughly
      modelInput.value = '';
      if (modelInput.select) modelInput.select();
      this.setNativeValue(modelInput, '');
      modelInput.dispatchEvent(new Event('input', { bubbles: true }));
      await this.delay(200);
      
      // Set new value
      this.setNativeValue(modelInput, model);
      modelInput.dispatchEvent(new Event('input', { bubbles: true }));
      modelInput.dispatchEvent(new Event('change', { bubbles: true }));
      await this.delay(300);
      
      // Verify first attempt
      let currentValue = modelInput.value || '';
      if (currentValue.trim() === model.trim()) {
        this.log('✅ Model set successfully on first attempt');
        modelInput.dispatchEvent(new Event('blur', { bubbles: true }));
        await this.delay(500);
        return true;
      }
      
      // Attempt 2: Human-like typing
      this.log('🚗 First attempt failed, trying human-like typing...');
      modelInput.focus();
      if (modelInput.select) modelInput.select();
      await this.delay(100);
      
      // Clear again
      modelInput.value = '';
      this.setNativeValue(modelInput, '');
      modelInput.dispatchEvent(new Event('input', { bubbles: true }));
      await this.delay(100);
      
      // Type character by character
      await this.typeHumanLike(modelInput, model);
      await this.delay(500);
      
      // Final verification
      currentValue = modelInput.value || '';
      if (currentValue.trim() === model.trim()) {
        this.log('✅ STEP 3 COMPLETE: Successfully filled model with typing approach');
        modelInput.dispatchEvent(new Event('blur', { bubbles: true }));
        await this.delay(500);
        return true;
      }
      
      // Attempt 3: Direct property setting
      this.log('🚗 Typing failed, trying direct property setting...');
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(modelInput, model);
      modelInput.dispatchEvent(new Event('input', { bubbles: true }));
      modelInput.dispatchEvent(new Event('change', { bubbles: true }));
      modelInput.dispatchEvent(new Event('blur', { bubbles: true }));
      await this.delay(500);
      
      currentValue = modelInput.value || '';
      if (currentValue.trim() === model.trim()) {
        this.log('✅ STEP 3 COMPLETE: Successfully filled model with direct property setting');
        return true;
      }
      
      this.log(`⚠️ STEP 3 PARTIAL: Model may not be visually updated. Expected: "${model}", Got: "${currentValue}"`);
      return true; // Return true as we tried our best
      
    } catch (error) {
      this.log(`❌ STEP 3 FAILED: Could not fill model: ${model}`, error);
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
      
      // Use React-compatible value setting
      this.setNativeValue(mileageInput, mileage.toString());
      
      // Trigger React events
      mileageInput.dispatchEvent(new Event('input', { bubbles: true }));
      mileageInput.dispatchEvent(new Event('change', { bubbles: true }));
      mileageInput.dispatchEvent(new Event('blur', { bubbles: true }));
      
      await this.delay(500);
      
      // Verify value was set
      if ((mileageInput.value || '').toString() === mileage.toString()) {
        this.log('✅ Successfully filled mileage:', mileage);
        return true;
      } else {
        this.log('⚠️ Mileage value verification failed. Expected:', mileage.toString(), 'Got:', mileageInput.value);
        // Try typing approach as fallback
        mileageInput.focus();
        if (mileageInput.select) mileageInput.select();
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

  // Select Body Style dropdown (position 7)
  async selectBodyStyle(bodyStyle) {
    try {
      this.log(`🚙 STEP 7: Selecting body style: ${bodyStyle}`);

      // Close any open dropdowns first
      await this.closeAnyOpenDropdown();
      await this.delay(this.randomDelay(500, 800));

      const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const target = norm(bodyStyle);
      const label = 'Body style';

      this.log('🔍 Looking for Body Style dropdown specifically...');
      let dropdown = this.findDropdownByLabel(label);
      
      if (!dropdown) {
        await this.ensureAdditionalFieldsVisible();
        dropdown = this.findDropdownByLabel(label);
      }
      
      if (!dropdown) {
        // More targeted search for body style dropdown
        const allDropdowns = document.querySelectorAll('div[role="button"], [role="combobox"]');
        for (const candidate of allDropdowns) {
          const container = candidate.closest('div, section, fieldset') || candidate.parentElement;
          const containerText = (container?.textContent || '').toLowerCase();
          if (containerText.includes('body style') || containerText.includes('body type')) {
            dropdown = candidate;
            this.log('✅ Found Body Style dropdown via container text search');
            break;
          }
        }
      }

      if (!dropdown) {
        throw new Error('Body style dropdown not found');
      }

      // Validate this is actually the Body Style dropdown
      this.log('🔍 Validating dropdown context for Body Style field...');
      const expectedBodyStyles = ['sedan', 'suv', 'coupe', 'hatchback', 'convertible', 'wagon', 'truck', 'van'];
      const isValidBodyStyleDropdown = this.validateDropdownContext(dropdown, 'bodystyle', expectedBodyStyles);
      
      if (!isValidBodyStyleDropdown) {
        this.log('❌ Found dropdown is not the Body Style dropdown');
        throw new Error('Could not find valid Body Style dropdown');
      }

      await this.scrollIntoView(dropdown);
      await this.delay(this.randomDelay(500, 1000));

      this.log('🚙 Opening validated Body Style dropdown...');
      dropdown.focus();
      dropdown.click();
      await this.delay(this.randomDelay(1500, 2000));

      // Wait for and validate options container
      let optionsContainer = null;
      try {
        optionsContainer = await this.waitForElement(['[role="listbox"]', '[role="menu"]'], 5000);
        
        // Validate this contains body style options
        const optionTexts = Array.from(optionsContainer.querySelectorAll('[role="option"]'))
          .map(opt => (opt.textContent || '').trim().toLowerCase())
          .slice(0, 8);
        
        const hasBodyStyles = optionTexts.some(text => 
          expectedBodyStyles.some(style => text.includes(style))
        );
        
        if (!hasBodyStyles) {
          this.log('❌ Options container does not contain body styles! Wrong dropdown.');
          throw new Error('Wrong dropdown - does not contain body style options');
        }
        
        this.log('✅ Confirmed options container has body style options');
      } catch (error) {
        this.log('❌ Could not find or validate body style options:', error);
        throw error;
      }

      // Find the correct body style option
      const getOptions = () => Array.from((optionsContainer || document).querySelectorAll('[role="option"]'));

      let option = getOptions().find(opt => {
        const txt = norm(opt.textContent || '');
        const aria = norm(opt.getAttribute?.('aria-label') || '');
        return txt === target || aria === target || txt.includes(target);
      });

      if (!option) {
        this.log(`🎯 Trying typeahead for body style: ${bodyStyle}`);
        for (const ch of bodyStyle.toLowerCase()) {
          dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
          await this.delay(this.randomDelay(40, 100));
        }
        await this.delay(this.randomDelay(300, 600));
        option = getOptions().find(opt => {
          const txt = norm(opt.textContent || '');
          return txt === target || txt.includes(target);
        });
      }

      if (!option) {
        const availableOptions = getOptions()
          .map(opt => opt.textContent?.trim())
          .filter(text => text)
          .slice(0, 10);
        throw new Error(`Body style option "${bodyStyle}" not found. Available: ${availableOptions.join(', ')}`);
      }

      this.log(`🎯 Found body style option: "${option.textContent?.trim()}", clicking...`);
      await this.scrollIntoView(option);
      await this.delay(this.randomDelay(300, 600));
      await this.performFacebookDropdownClick(option);
      await this.delay(this.randomDelay(800, 1500));

      // Verify selection
      const verify = () => {
        const el = this.findDropdownByLabel(label) || dropdown;
        const txt = (el?.textContent || '').toLowerCase();
        return txt.includes(target);
      };

      const verified = verify();
      if (verified) {
        this.log(`✅ STEP 7 COMPLETE: Successfully selected body style: ${bodyStyle}`);
        await this.closeAnyOpenDropdown();
        await this.delay(this.randomDelay(500, 800));
        return true;
      } else {
        this.log(`❌ STEP 7 FAILED: Body style selection not verified`);
        return false;
      }

    } catch (error) {
      this.log(`❌ STEP 7 FAILED: Could not select body style: ${bodyStyle}`, error);
      await this.closeAnyOpenDropdown();
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
      this.log(`📋 Current checkbox state: ${isChecked}, should be: ${shouldCheck}`);
      
      if (shouldCheck && !isChecked) {
        this.log('📋 Checking clean title checkbox...');
        // Try multiple interaction methods for stubborn checkboxes
        checkbox.click();
        await this.delay(300);
        if (!getChecked()) {
          // Try React-style interaction
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked').set;
          nativeInputValueSetter.call(checkbox, true);
          checkbox.dispatchEvent(new Event('input', { bubbles: true }));
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          await this.delay(300);
        }
        if (!getChecked()) {
          // Try focus and space key
          checkbox.focus();
          await this.delay(100);
          checkbox.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
          checkbox.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));
          await this.delay(300);
        }
      } else if (!shouldCheck && isChecked) {
        this.log('📋 Unchecking clean title checkbox...');
        checkbox.click();
        await this.delay(300);
      }
      
      // Final verification
      const finalState = getChecked();
      this.log(`📋 Final checkbox state: ${finalState} (expected: ${shouldCheck})`);
      if (shouldCheck && !isChecked) {
        await this.performFacebookDropdownClick(checkbox);
        await this.delay(300);
      } else if (!shouldCheck && isChecked) {
        await this.performFacebookDropdownClick(checkbox);
        await this.delay(300);
      }
      
      this.log(`✅ Successfully set clean title: ${shouldCheck}`);
      return true;
      
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

  // Select Fuel Type dropdown
  async selectFuelType(fuelType) {
    try {
      this.log(`⛽ Selecting fuel type: ${fuelType}`);
      const normalized = this.mapFuelType(fuelType) || fuelType;
      await this.closeAnyOpenDropdown();
      
      // Find the dropdown by looking for the label text and closest clickable element
       let dropdown = this.findDropdownByLabel('Fuel type') || this.findDropdownByLabel('Fuel');
      
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
        // Try expanding hidden sections and retry
        await this.ensureAdditionalFieldsVisible();
        // Re-attempt finding dropdown
        dropdown = this.findDropdownByLabel('Fuel type') || this.findDropdownByLabel('Fuel');
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
        `//div[@role="option" and contains(text(), "${normalized}")]`,
        `//div[contains(text(), "${normalized}") and contains(@class, "option")]`,
        `//li[contains(text(), "${normalized}")]`
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
            if (opt.textContent.trim() === normalized || opt.textContent.includes(normalized)) {
              option = opt;
              break;
            }
          }
        }
        if (option) break;
      }
      
      if (!option) {
        // Fallback: keyboard-driven selection
        const success = await this.selectDropdownOption(['[aria-label*="Fuel type"]','text:Fuel type','text:Fuel'], normalized, true);
        if (success) { this.log(`✅ Successfully selected fuel type: ${normalized}`); return true; }
        throw new Error(`Fuel type option "${normalized}" not found`);
      }
      
      await this.scrollIntoView(option);
      await this.delay(this.randomDelay(300, 600));
      await this.performFacebookDropdownClick(option);
      
      await this.delay(this.randomDelay(1000, 2000));
      this.log(`✅ Successfully selected fuel type: ${normalized}`);
      return true;
      
    } catch (error) {
      this.log(`⚠️ Could not select fuel type: ${fuelType}`, error);
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