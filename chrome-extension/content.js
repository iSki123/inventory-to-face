// Enhanced Facebook Marketplace Automation
// Implements React-native value setting, MutationObserver, keyboard simulation, and human-like behavior

class SalesonatorAutomator {
  constructor() {
    this.isPosting = false;
    this.debugMode = true;
    this.retryAttempts = 3;
    this.uploadedImages = []; // Track uploaded images to prevent duplicates
    this.currentUrl = window.location.href;
    this.isWaitingForNextVehicle = false;
    
    // Initialize console logging
    this.initializeConsoleLogging();
    
    this.setupMessageListener();
    this.installNavigationGuards();
    this.setupUrlChangeDetection();
    this.checkWebAppAuthentication(); // Check for web app auth on load
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

  // Convert base64 string to File object
  base64ToFile(base64Data, filename) {
    try {
      // Remove data URL prefix if present
      const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      
      // Convert base64 to binary
      const binaryString = atob(base64String);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Create blob and file
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      const file = new File([blob], filename, { type: 'image/jpeg' });
      
      return file;
    } catch (error) {
      console.error('Error converting base64 to file:', error);
      return null;
    }
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
      fast: [10, 30]  // Further increased speed for faster typing while maintaining human-like behavior
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
      
      // Check if we're on the correct page first
      if (!window.location.href.includes('/marketplace/create/vehicle')) {
        this.log('⚠️ Not on create vehicle page, current URL:', window.location.href);
        this.log('🧭 Navigating to create vehicle page...');
        
        // Navigate to the create vehicle page
        window.location.href = 'https://www.facebook.com/marketplace/create/vehicle';
        
        // Wait for page to load and try again
        return new Promise((resolve, reject) => {
          const checkPageReady = () => {
            if (window.location.href.includes('/marketplace/create/vehicle')) {
              this.log('✅ Successfully navigated to create vehicle page');
              // Wait a bit more for the page to fully load
              setTimeout(() => {
                this.postVehicle(vehicleData).then(resolve).catch(reject);
              }, 2000);
            } else {
              setTimeout(checkPageReady, 500);
            }
          };
          setTimeout(checkPageReady, 1000);
        });
      }
      
      this.isPosting = true;
      this.uploadedImages = []; // Reset uploaded images tracking for new posting session
      
      for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
        try {
          // Navigate to marketplace with retry logic
          await this.navigateToMarketplace();
          await this.delay(2000, attempt);
          
          // Fill form with enhanced automation
          await this.fillVehicleForm(vehicleData);
          await this.delay(1000, attempt);
          
          // Handle image uploads if images are provided
          if (vehicleData.images && Array.isArray(vehicleData.images) && vehicleData.images.length > 0) {
            await this.handleImageUploads(vehicleData);
            await this.delay(1000, attempt);
          } else {
            this.log('📸 No images provided or images array is invalid, skipping image upload');
          }
          
          // Submit with verification
          const success = await this.submitListing();
          
          if (success) {
            this.log('✅ Vehicle posted successfully');
            
            // Record the posting in backend and deduct credits
            try {
              console.log('🚀 CREDIT DEDUCTION ATTEMPT STARTING');
              console.log('🚀 Vehicle ID for recording:', vehicleData.id);
              this.log('📝 Recording vehicle posting in backend...');
              this.log('🔍 Current URL before recording:', window.location.href);
              
              const recordResult = await this.recordVehiclePosting(vehicleData.id);
              
              console.log('🚀 CREDIT DEDUCTION RESULT:', recordResult);
              console.log('🚀 Credits after posting:', recordResult.credits);
              this.log('✅ Vehicle posting recorded in backend', recordResult);
              this.log('💰 Credits after posting:', recordResult.credits);
              
              // Send credit update to popup immediately
              console.log('🚀 SENDING CREDITS UPDATE TO POPUP:', recordResult.credits);
              chrome.runtime.sendMessage({
                action: 'creditsUpdated',
                credits: recordResult.credits
              });
              
              // Clear posting state first
              this.isPosting = false;
              this.currentVehicleData = null;
              this.uploadedImages = [];
              this.log('🔄 Reset posting flags and uploaded images');
              
              // Wait a moment for any page processing
              await this.delay(2000);
              
              // Set flag that we're waiting for the next vehicle posting
              console.log('🚀 SETTING WAITING FOR NEXT VEHICLE FLAG');
              this.isWaitingForNextVehicle = true;
              
              // Navigate to create page immediately for next vehicle (same as error path)
              this.log('🔄 Posting complete, navigating to create page...');
              this.log('📍 Current URL before navigation:', window.location.href);
              
              const createVehicleUrl = 'https://www.facebook.com/marketplace/create/vehicle';
              this.log('🎯 Navigation to:', createVehicleUrl);
              window.location.href = createVehicleUrl;
              
              console.log('🚀 POSTING FLOW COMPLETE - NAVIGATED TO CREATE PAGE');
              console.log('🚀 Current URL after posting:', window.location.href);
              
              // Return success with credits info to popup for processing next vehicle
              return { 
                success: true, 
                credits: recordResult.credits,
                message: recordResult.message 
              };
              
            } catch (backendError) {
              this.log('⚠️ CRITICAL: Vehicle posted but failed to record in backend:', backendError);
              this.log('⚠️ Backend error details:', backendError.message);
              this.log('⚠️ Backend error stack:', backendError.stack);
              console.error('Backend recording error:', backendError);
              console.error('Full backend error object:', backendError);
              
              // IMPORTANT: Send error notification to popup
              chrome.runtime.sendMessage({
                action: 'recordingError',
                vehicleId: vehicleData.id,
                error: backendError.message,
                fullError: backendError.toString()
              });
              
              // Clear posting state even if recording failed
              this.isPosting = false;
              this.currentVehicleData = null;
              this.uploadedImages = [];
              this.log('🔄 Reset posting flags despite backend error');
              
              // Wait a moment
              await this.delay(1000);
              
              // Still navigate back for next vehicle even if recording failed
              this.log('🔄 Attempting navigation despite recording error...');
              this.log('📍 Current URL before fallback navigation:', window.location.href);
              
              const createVehicleUrl = 'https://www.facebook.com/marketplace/create/vehicle';
              this.log('🎯 Fallback navigation to:', createVehicleUrl);
              window.location.href = createVehicleUrl;
              
              return { 
                success: true, 
                warning: 'Posted but failed to record: ' + backendError.message,
                databaseError: true
              };
            }
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
      this.uploadedImages = []; // Reset on failure too
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
      this.log('✅ Already on vehicle creation page, waiting for it to fully load...');
      await this.waitForPageToLoad();
      return;
    }
    
    if (currentUrl.includes('facebook.com/marketplace/create')) {
      this.log('📝 On marketplace create page, checking for vehicle category...');
      
      // Wait for page to load first
      await this.waitForPageToLoad();
      
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
        const vehicleCategory = await this.waitForElement(vehicleCategorySelectors, 5000);
        await this.scrollIntoView(vehicleCategory);
        await this.delay(this.randomDelay(300, 600));
        vehicleCategory.click();
        await this.delay(this.randomDelay(2000, 3000));
        
        // Wait for the new page to load after clicking vehicle category
        await this.waitForPageToLoad();
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

  // Enhanced page loading detection with multiple strategies
  async waitForPageToLoad() {
    this.log('⏳ Waiting for page to fully load...');
    
    try {
      // Strategy 1: Wait for document ready state
      if (document.readyState !== 'complete') {
        this.log('📄 Document not ready, waiting...');
        await new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            const listener = () => {
              if (document.readyState === 'complete') {
                document.removeEventListener('readystatechange', listener);
                resolve();
              }
            };
            document.addEventListener('readystatechange', listener);
          }
        });
      }
      
      // Strategy 2: Wait for React/Facebook components to load
      const pageLoadIndicators = [
        'form', // Facebook forms
        '[role="main"]', // Main content area
        'input[type="text"]', // Any input field
        '[data-testid]', // Facebook test ids
        '.marketplace', // Marketplace specific
        '[aria-label]' // Any labeled element
      ];
      
      this.log('🔍 Waiting for page elements to appear...');
      await this.waitForElement(pageLoadIndicators, 10000);
      
      // Strategy 3: Wait for no loading spinners
      this.log('🔄 Checking for loading indicators...');
      let loadingCount = 0;
      while (loadingCount < 5) { // Max 5 attempts
        const loadingElements = document.querySelectorAll(
          '[role="progressbar"], .loading, .spinner, [aria-label*="Loading"], [aria-label*="loading"]'
        );
        
        if (loadingElements.length === 0) {
          this.log('✅ No loading indicators found');
          break;
        } else {
          this.log(`⏳ Found ${loadingElements.length} loading indicators, waiting...`);
          await this.delay(1000);
          loadingCount++;
        }
      }
      
      // Strategy 4: Additional delay for React hydration
      this.log('⚡ Final delay for React hydration...');
      await this.delay(2000);
      
      this.log('✅ Page fully loaded and ready for interaction');
      
    } catch (error) {
      this.log('⚠️ Page loading detection failed, continuing anyway:', error);
      // Even if detection fails, wait a bit before continuing
      await this.delay(3000);
    }
  }

  // Enhanced form filling with React-native value setting
  async fillVehicleForm(vehicleData) {
    this.log('📝 Filling vehicle form with enhanced automation...');
    
    // FIRST: Ensure page is fully loaded before starting form fill
    this.log('⏳ Ensuring page is ready before form filling...');
    await this.waitForPageToLoad();
    
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

  // Fill Price input - using the exact same reliable method as mileage
  async fillPrice(price) {
    try {
      this.log(`💰 Filling price: ${price}`);

      // Normalize to integer dollars (strip non-digits, remove decimals, fix cents if needed)
      const rawDigits = String(price ?? '').replace(/[^\d]/g, '');
      let expectedNum = rawDigits ? parseInt(rawDigits, 10) : null;
      
      if (!expectedNum || expectedNum <= 0) {
        throw new Error('Invalid price value provided');
      }

      // Improved price normalization logic
      // If the number is unrealistically high (over 500k), it's likely in cents
      // If 6+ digits and over 500,000, divide by 100 (cents to dollars)
      if (rawDigits.length >= 6 && expectedNum > 500000) {
        const centsAdjusted = Math.round(expectedNum / 100);
        // Only apply if the adjusted value looks like a realistic vehicle price (1k-250k)
        if (centsAdjusted >= 1000 && centsAdjusted <= 250000) {
          this.log('💰 Converting from cents to dollars:', expectedNum, '->', centsAdjusted);
          expectedNum = centsAdjusted;
        }
      }
      
      // Safety check: if still over 500k, it's probably wrong
      if (expectedNum > 500000) {
        this.log('⚠️ Price seems too high, capping at 250k:', expectedNum);
        expectedNum = Math.min(expectedNum, 250000);
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
      
      // Clear existing value and set new one - exact same as mileage method
      priceInput.focus();
      if (priceInput.select) priceInput.select();
      await this.delay(100);
      
      // Use React-compatible value setting with expected price
      this.setNativeValue(priceInput, expectedNum.toString());
      
      // Trigger React events - exact same as mileage method
      priceInput.dispatchEvent(new Event('input', { bubbles: true }));
      priceInput.dispatchEvent(new Event('change', { bubbles: true }));
      priceInput.dispatchEvent(new Event('blur', { bubbles: true }));
      
      await this.delay(500);
      
      // Verify value was set - handle Facebook's formatted display
      const currentValue = (priceInput.value || '').toString();
      const cleanCurrentValue = currentValue.replace(/[^\d]/g, ''); // Remove $, commas, etc.
      const expectedStr = expectedNum.toString();
      
      if (cleanCurrentValue === expectedStr || currentValue === expectedStr) {
        this.log('✅ Successfully filled price:', expectedNum);
        return true;
      } else {
        this.log('⚠️ Price value verification failed. Expected:', expectedStr, 'Got:', currentValue, 'Cleaned:', cleanCurrentValue);
        // Try typing approach as fallback - exact same as mileage method
        priceInput.focus();
        if (priceInput.select) priceInput.select();
        await this.typeHumanLike(priceInput, expectedNum.toString());
        return true;
      }
      
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
      console.log(`[EXTERIOR COLOR DEBUG] Starting exterior color selection for: ${exteriorColor}`);
      
      // Clean exterior color string
      const cleanExteriorColor = (exteriorColor || '').toString().trim();
      
      // Find exterior color dropdown using the same proven selectors as other successful dropdowns
      const exteriorColorDropdownSelectors = [
        'text:Exterior color',
        '[aria-label*="Exterior color"]',
        'div[role="button"]:has-text("Exterior color")',
        'span:has-text("Exterior color")',
        '[data-testid*="exterior"]'
      ];
      
      console.log(`[EXTERIOR COLOR DEBUG] Searching for exterior color dropdown with selectors:`, exteriorColorDropdownSelectors);
      
      const exteriorColorDropdown = await this.waitForElement(exteriorColorDropdownSelectors, 8000);
      if (!exteriorColorDropdown) {
        throw new Error('Exterior color dropdown not found');
      }
      
      console.log(`[EXTERIOR COLOR DEBUG] Found exterior color dropdown:`, exteriorColorDropdown);
      console.log(`[EXTERIOR COLOR DEBUG] Dropdown tagName:`, exteriorColorDropdown.tagName);
      console.log(`[EXTERIOR COLOR DEBUG] Dropdown textContent:`, exteriorColorDropdown.textContent);
      
      await this.scrollIntoView(exteriorColorDropdown);
      this.log('🎨 Found exterior color dropdown, clicking to open...');
      
      console.log(`[EXTERIOR COLOR DEBUG] Clicking exterior color dropdown...`);
      // Use the same reliable open sequence as other successful dropdowns
      exteriorColorDropdown.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      exteriorColorDropdown.click();
      await this.delay(this.randomDelay(1200, 1800)); // Wait for dropdown to open
      
      console.log(`[EXTERIOR COLOR DEBUG] Checking if dropdown opened...`);
      const optionsAfterClick = document.querySelectorAll('[role="option"]');
      console.log(`[EXTERIOR COLOR DEBUG] Found options after click:`, optionsAfterClick.length);
      
      // Log first 20 options to debug
      Array.from(optionsAfterClick).slice(0, 20).forEach((opt, idx) => {
        console.log(`[EXTERIOR COLOR DEBUG] Option ${idx + 1}:`, opt.textContent?.trim());
      });
      
      // Enhanced option detection using same proven methods
      let exteriorColorOption = null;
      
      // Method 1: Direct text search using the proven waitForElement pattern
      try {
        console.log(`[EXTERIOR COLOR DEBUG] Trying direct text search for: ${cleanExteriorColor}`);
        exteriorColorOption = await this.waitForElement(`text:${cleanExteriorColor}`, 2000);
        console.log(`[EXTERIOR COLOR DEBUG] Direct text search result:`, exteriorColorOption);
      } catch (e) {
        console.log(`[EXTERIOR COLOR DEBUG] Direct text search failed:`, e.message);
      }
      
      // Method 2: Manual search through options if direct search fails
      if (!exteriorColorOption && optionsAfterClick.length > 0) {
        console.log(`[EXTERIOR COLOR DEBUG] Trying manual search through ${optionsAfterClick.length} options...`);
        
        // Normalize the target color for comparison
        const normalized = cleanExteriorColor.toLowerCase();
        
        // Method 2a: Exact match
        exteriorColorOption = Array.from(optionsAfterClick).find(opt => 
          opt.textContent?.trim().toLowerCase() === normalized
        );
        
        // Method 2b: Fuzzy match if exact fails
        if (!exteriorColorOption) {
          exteriorColorOption = Array.from(optionsAfterClick).find(opt => 
            opt.textContent?.trim().toLowerCase().includes(normalized.toLowerCase())
          );
        }
        
        // Method 2c: Try common variations
        if (!exteriorColorOption && normalized === 'off white') {
          exteriorColorOption = Array.from(optionsAfterClick).find(opt => {
            const text = opt.textContent?.trim().toLowerCase();
            return text === 'off white' || text === 'offwhite' || text === 'cream' || text === 'ivory';
          });
        }
        
        console.log(`[EXTERIOR COLOR DEBUG] Manual search result:`, exteriorColorOption);
      }
      
      if (!exteriorColorOption) {
        console.log(`[EXTERIOR COLOR DEBUG] ❌ No exterior color option found for: ${cleanExteriorColor}`);
        console.log(`[EXTERIOR COLOR DEBUG] Available options:`, Array.from(optionsAfterClick).map(opt => opt.textContent?.trim()));
        throw new Error(`Exterior color option ${cleanExteriorColor} not found among ${optionsAfterClick.length} options`);
      }
      
      console.log(`[EXTERIOR COLOR DEBUG] 🎨 Found exterior color option, clicking: ${cleanExteriorColor}`);
      await this.performFacebookDropdownClick(exteriorColorOption);
      await this.delay(2000);
      
      // Enhanced verification
      console.log(`[EXTERIOR COLOR DEBUG] Verifying exterior color selection...`);
      await this.delay(500);
      console.log(`[EXTERIOR COLOR DEBUG] Dropdown selected value:`, exteriorColorDropdown.textContent?.trim());
      
      // Check if exterior color appears in form
      const dropdownText = exteriorColorDropdown.textContent?.trim();
      const success = dropdownText?.includes(cleanExteriorColor) || 
                     dropdownText?.includes(exteriorColor) ||
                     document.body.textContent.includes(`Exterior color: ${cleanExteriorColor}`);
      
      console.log(`[EXTERIOR COLOR DEBUG] Exterior color verification:`, {
        dropdownContainsColor: dropdownText?.includes(cleanExteriorColor),
        success: success
      });
      
      if (success) {
        this.log(`✅ Successfully filled exterior color: ${cleanExteriorColor}`);
        return true;
      } else {
        this.log(`⚠️ Exterior color selection may have failed - dropdown text: ${dropdownText}`);
        return false;
      }
      
    } catch (error) {
      this.log(`⚠️ Could not select exterior color: ${exteriorColor}`, error);
      console.log(`[EXTERIOR COLOR DEBUG] ❌ Error selecting exterior color:`, error);
      return false;
    }
  }

  // Select Interior Color dropdown with enhanced detection (similar to vehicle condition)
  async selectInteriorColor(interiorColor) {
    try {
      this.log(`🪑 Selecting interior color: ${interiorColor}`);
      console.log(`[INTERIOR COLOR DEBUG] Starting interior color selection for: ${interiorColor}`);
      
      // Clean interior color string (remove extra spaces)
      const cleanInteriorColor = (interiorColor || '').toString().trim();
      
      // Look for interior color dropdown more specifically using proven selectors
      const interiorColorDropdownSelectors = [
        'text:Interior color', // Visible label
        'text:Interior', // Shorter label 
        '[aria-label*="Interior color"]',
        '[aria-label*="Interior"]',
        'div[role="button"]', // Generic fallback
        'select'
      ];
      
      console.log(`[INTERIOR COLOR DEBUG] Looking for interior color dropdown with selectors:`, interiorColorDropdownSelectors);
      
      const interiorColorDropdown = await this.waitForElement(interiorColorDropdownSelectors, 8000);
      await this.scrollIntoView(interiorColorDropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      this.log('🪑 Found interior color dropdown, clicking to open...');
      console.log(`[INTERIOR COLOR DEBUG] Found dropdown:`, interiorColorDropdown);
      
      // Use a more reliable open sequence for React-controlled dropdowns
      interiorColorDropdown.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      interiorColorDropdown.click();
      await this.delay(this.randomDelay(1200, 1800)); // Wait for dropdown to open
      
      // Prefer searching within the options container only
      let optionsContainer = null;
      try {
        optionsContainer = await this.waitForElement(['[role="listbox"]', '[role="menu"]'], 4000);
        console.log(`[INTERIOR COLOR DEBUG] Found options container:`, optionsContainer);
      } catch {
        console.log(`[INTERIOR COLOR DEBUG] No options container found, using document scope`);
      }
      
      const getExactOption = () => {
        const scope = optionsContainer || document;
        const opts = Array.from(scope.querySelectorAll('[role="option"]'));
        console.log(`[INTERIOR COLOR DEBUG] Found ${opts.length} options in scope`);
        const found = opts.find(o => {
          const text = (o.textContent || '').trim().toLowerCase();
          console.log(`[INTERIOR COLOR DEBUG] Checking option: "${text}" against "${cleanInteriorColor.toLowerCase()}"`);
          return text === cleanInteriorColor.toLowerCase();
        });
        if (found) console.log(`[INTERIOR COLOR DEBUG] Exact match found:`, found);
        return found;
      };
      
      const getFuzzyOption = () => {
        const scope = optionsContainer || document;
        const opts = Array.from(scope.querySelectorAll('[role="option"]'));
        const found = opts.find(o => {
          const text = (o.textContent || '').toLowerCase();
          return text.includes(cleanInteriorColor.toLowerCase());
        });
        if (found) console.log(`[INTERIOR COLOR DEBUG] Fuzzy match found:`, found);
        return found;
      };
      
      let interiorColorOption = getExactOption();
      
      // If not found, try typeahead (Facebook supports it)
      if (!interiorColorOption && cleanInteriorColor) {
        console.log(`[INTERIOR COLOR DEBUG] Trying typeahead for: ${cleanInteriorColor}`);
        for (const ch of cleanInteriorColor.toLowerCase()) {
          interiorColorDropdown.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
          await this.delay(this.randomDelay(40, 100));
        }
        await this.delay(this.randomDelay(300, 600));
        interiorColorOption = getExactOption();
      }
      
      // Fallback to fuzzy match
      if (!interiorColorOption) {
        console.log(`[INTERIOR COLOR DEBUG] Trying fuzzy match`);
        interiorColorOption = getFuzzyOption();
      }
      
      // Ultimate fallback: any element with the text inside the container
      if (!interiorColorOption) {
        console.log(`[INTERIOR COLOR DEBUG] Trying ultimate fallback search`);
        const elem = this.findElementByText(cleanInteriorColor, ['div','span','li'], optionsContainer || document);
        if (elem) interiorColorOption = elem.closest('[role="option"]') || elem;
        if (interiorColorOption) console.log(`[INTERIOR COLOR DEBUG] Ultimate fallback found:`, interiorColorOption);
      }
      
      if (!interiorColorOption) {
        console.log(`[INTERIOR COLOR DEBUG] No interior color option found for "${cleanInteriorColor}"`);
        // Show available options for debugging
        const allOpts = Array.from((optionsContainer || document).querySelectorAll('[role="option"]'));
        console.log(`[INTERIOR COLOR DEBUG] Available options:`, allOpts.map(opt => opt.textContent?.trim()));
        throw new Error(`Interior color option not found for "${cleanInteriorColor}"`);
      }
      
      console.log(`[INTERIOR COLOR DEBUG] Selected interior color option:`, interiorColorOption);
      await this.scrollIntoView(interiorColorOption);
      await this.delay(this.randomDelay(300, 600));
      interiorColorOption.click();
      await this.delay(this.randomDelay(1000, 1500)); // Wait for selection to register
      
      // Enhanced verification with multiple checks (same as vehicle condition)
      const verifications = {
        dropdownText: false,
        selectedValue: false,
        ariaSelected: false
      };
      
      // Check if dropdown text changed
      const dropdownText = (interiorColorDropdown.textContent || '').toLowerCase();
      verifications.dropdownText = dropdownText.includes(cleanInteriorColor.toLowerCase());
      console.log(`[INTERIOR COLOR DEBUG] Dropdown text verification: ${verifications.dropdownText} (text: "${dropdownText}")`);
      
      // Check if there's a selected value attribute
      if (interiorColorDropdown.value) {
        verifications.selectedValue = interiorColorDropdown.value.toLowerCase().includes(cleanInteriorColor.toLowerCase());
        console.log(`[INTERIOR COLOR DEBUG] Selected value verification: ${verifications.selectedValue} (value: "${interiorColorDropdown.value}")`);
      }
      
      // Check if the option is marked as selected
      if (interiorColorOption.getAttribute('aria-selected') === 'true') {
        verifications.ariaSelected = true;
        console.log(`[INTERIOR COLOR DEBUG] Aria-selected verification: ${verifications.ariaSelected}`);
      }
      
      const success = Object.values(verifications).some(v => v);
      
      if (success) {
        this.log('✅ Successfully selected interior color:', cleanInteriorColor);
        return true;
      } else {
        console.log(`[INTERIOR COLOR DEBUG] Interior color selection may have failed - no evidence of selection found`);
        this.log('⚠️ Interior color selection verification failed for:', cleanInteriorColor);
        return false;
      }
      
    } catch (error) {
      console.log(`[INTERIOR COLOR DEBUG] Error in selectInteriorColor:`, error);
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

  // Select Vehicle Condition dropdown with enhanced detection (similar to body style)
  async selectVehicleCondition(condition = 'Excellent') {
    try {
      // Always force Excellent as per requirement
      condition = 'Excellent';
      console.log(`[CONDITION DEBUG] Starting vehicle condition selection: ${condition}`);
      this.log(`⭐ Selecting vehicle condition: ${condition}`);
      
      // Clean condition string (remove extra spaces)
      const cleanCondition = (condition || '').toString().trim();
      
      // Look for vehicle condition dropdown more specifically
      const conditionDropdownSelectors = [
        'text:Vehicle condition', // Visible label
        'text:Condition', // Shorter label
        '[aria-label*="Vehicle condition"]',
        '[aria-label*="Condition"]',
        'div[role="button"]', // Generic fallback
        'select'
      ];
      
      console.log(`[CONDITION DEBUG] Looking for condition dropdown with selectors:`, conditionDropdownSelectors);
      
      const conditionDropdown = await this.waitForElement(conditionDropdownSelectors, 8000);
      await this.scrollIntoView(conditionDropdown);
      await this.delay(this.randomDelay(500, 1000));
      
      this.log('⭐ Found vehicle condition dropdown, clicking to open...');
      console.log(`[CONDITION DEBUG] Found dropdown:`, conditionDropdown);
      
      // Use a more reliable open sequence for React-controlled dropdowns
      conditionDropdown.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      conditionDropdown.click();
      await this.delay(this.randomDelay(1200, 1800)); // Wait for dropdown to open
      
      // Prefer searching within the options container only
      let optionsContainer = null;
      try {
        optionsContainer = await this.waitForElement(['[role="listbox"]', '[role="menu"]'], 4000);
        console.log(`[CONDITION DEBUG] Found options container:`, optionsContainer);
      } catch {
        console.log(`[CONDITION DEBUG] No options container found, using document scope`);
      }
      
      const getExactOption = () => {
        const scope = optionsContainer || document;
        const opts = Array.from(scope.querySelectorAll('[role="option"]'));
        console.log(`[CONDITION DEBUG] Found ${opts.length} options in scope`);
        const found = opts.find(o => {
          const text = (o.textContent || '').trim().toLowerCase();
          console.log(`[CONDITION DEBUG] Checking option: "${text}" against "${cleanCondition.toLowerCase()}"`);
          return text === cleanCondition.toLowerCase();
        });
        if (found) console.log(`[CONDITION DEBUG] Exact match found:`, found);
        return found;
      };
      
      const getFuzzyOption = () => {
        const scope = optionsContainer || document;
        const opts = Array.from(scope.querySelectorAll('[role="option"]'));
        const found = opts.find(o => {
          const text = (o.textContent || '').toLowerCase();
          return text.includes(cleanCondition.toLowerCase());
        });
        if (found) console.log(`[CONDITION DEBUG] Fuzzy match found:`, found);
        return found;
      };
      
      let conditionOption = getExactOption();
      
      // If not found, try typeahead (Facebook supports it)
      if (!conditionOption && cleanCondition) {
        console.log(`[CONDITION DEBUG] Trying typeahead for: ${cleanCondition}`);
        for (const ch of cleanCondition.toLowerCase()) {
          conditionDropdown.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
          await this.delay(this.randomDelay(40, 100));
        }
        await this.delay(this.randomDelay(300, 600));
        conditionOption = getExactOption();
      }
      
      // Fallback to fuzzy match
      if (!conditionOption) {
        console.log(`[CONDITION DEBUG] Trying fuzzy match`);
        conditionOption = getFuzzyOption();
      }
      
      // Ultimate fallback: any element with the text inside the container
      if (!conditionOption) {
        console.log(`[CONDITION DEBUG] Trying ultimate fallback search`);
        const elem = this.findElementByText(cleanCondition, ['div','span','li'], optionsContainer || document);
        if (elem) conditionOption = elem.closest('[role="option"]') || elem;
        if (conditionOption) console.log(`[CONDITION DEBUG] Ultimate fallback found:`, conditionOption);
      }
      
      if (!conditionOption) {
        console.log(`[CONDITION DEBUG] No condition option found for "${cleanCondition}"`);
        throw new Error(`Vehicle condition option not found for "${cleanCondition}"`);
      }
      
      console.log(`[CONDITION DEBUG] Selected condition option:`, conditionOption);
      await this.scrollIntoView(conditionOption);
      await this.delay(this.randomDelay(300, 600));
      conditionOption.click();
      await this.delay(this.randomDelay(1000, 1500)); // Wait for selection to register
      
      // Enhanced verification with multiple checks
      const verifications = {
        dropdownText: false,
        selectedValue: false,
        ariaSelected: false
      };
      
      // Check if dropdown text changed
      const dropdownText = (conditionDropdown.textContent || '').toLowerCase();
      verifications.dropdownText = dropdownText.includes(cleanCondition.toLowerCase());
      console.log(`[CONDITION DEBUG] Dropdown text verification: ${verifications.dropdownText} (text: "${dropdownText}")`);
      
      // Check if there's a selected value attribute
      if (conditionDropdown.value) {
        verifications.selectedValue = conditionDropdown.value.toLowerCase().includes(cleanCondition.toLowerCase());
        console.log(`[CONDITION DEBUG] Selected value verification: ${verifications.selectedValue} (value: "${conditionDropdown.value}")`);
      }
      
      // Check if the option is marked as selected
      if (conditionOption.getAttribute('aria-selected') === 'true') {
        verifications.ariaSelected = true;
        console.log(`[CONDITION DEBUG] Aria-selected verification: ${verifications.ariaSelected}`);
      }
      
      const success = Object.values(verifications).some(v => v);
      
      if (success) {
        this.log('✅ Successfully selected vehicle condition:', condition);
        return true;
      } else {
        console.log(`[CONDITION DEBUG] Vehicle condition selection may have failed - no evidence of selection found`);
        this.log('⚠️ Vehicle condition selection verification failed for:', condition);
        return false;
      }
      
    } catch (error) {
      console.log(`[CONDITION DEBUG] Error in selectVehicleCondition:`, error);
      this.log(`⚠️ Could not select vehicle condition: ${condition}`, error);
      return false;
    }
  }

  // Select Fuel Type dropdown with enhanced detection (similar to vehicle condition)
  async selectFuelType(fuelType) {
    try {
      this.log(`⛽ Selecting fuel type: ${fuelType}`);
      console.log(`[FUEL DEBUG] Starting fuel type selection for: ${fuelType}`);
      
      const normalized = this.mapFuelType(fuelType) || fuelType;
      console.log(`[FUEL DEBUG] Normalized fuel type: ${normalized}`);
      
      await this.closeAnyOpenDropdown();
      await this.delay(500);
      
      // Use the same proven approach as vehicle condition - find label first, then dropdown relative to it
      const labelSelectors = [
        'text:Fuel type',
        '[aria-label*="Fuel type"]',
        'span:has-text("Fuel type")',
        'label:has-text("Fuel type")',
        '*:contains("Fuel type")'
      ];
      
      console.log(`[FUEL DEBUG] Looking for fuel type label with selectors:`, labelSelectors);
      
      // Find the label first
      let dropdown = null;
      for (const selector of labelSelectors) {
        try {
          const label = await this.waitForElement([selector], 2000);
          if (label) {
            console.log(`[FUEL DEBUG] Found label:`, label.textContent);
            // Find the dropdown relative to this label (same pattern as working dropdowns)
            const possibleDropdowns = [
              label.parentElement?.querySelector('div[role="button"]'),
              label.parentElement?.querySelector('select'),
              label.nextElementSibling,
              label.parentElement?.nextElementSibling?.querySelector('div[role="button"]'),
              label.closest('div')?.querySelector('div[role="button"]')
            ].filter(Boolean);
            
            for (const possibleDropdown of possibleDropdowns) {
              if (possibleDropdown) {
                dropdown = possibleDropdown;
                console.log(`[FUEL DEBUG] Found dropdown relative to label:`, dropdown);
                break;
              }
            }
            
            if (dropdown) break;
          }
        } catch (e) {
          continue;
        }
      }
      
      // Fallback: Look for dropdown with specific fuel-related context
      if (!dropdown) {
        console.log(`[FUEL DEBUG] Label approach failed, trying context-based approach`);
        const allDropdowns = document.querySelectorAll('div[role="button"]');
        for (const possibleDropdown of allDropdowns) {
          const text = possibleDropdown.textContent?.toLowerCase() || '';
          const context = possibleDropdown.closest('div')?.textContent?.toLowerCase() || '';
          
          // Look for fuel context or fuel-related terms
          if (text.includes('fuel') || context.includes('fuel') ||
              text.includes('gasoline') || text.includes('diesel') || 
              text.includes('electric') || text.includes('hybrid')) {
            dropdown = possibleDropdown;
            console.log(`[FUEL DEBUG] Found dropdown by fuel context:`, dropdown);
            break;
          }
        }
      }
      
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
      // Use 'fast' speed for description typing while maintaining AI-detection features
      await this.typeHumanLike(descriptionInput, description, 'fast');
      
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

  // Image upload handling with pre-downloaded images from chrome.storage.local
  async handleImageUploads(vehicleData) {
    try {
      this.log('📸 Starting image upload process...');
      
      const images = vehicleData.images || [];
      if (!images || images.length === 0) {
        this.log('📸 No images to upload');
        return { success: true, uploadedCount: 0 };
      }

      this.log(`📸 Processing ${images.length} images for upload...`);
      
      const uploadFiles = [];
      
      // First, try to get images from chrome.storage.local (pre-downloaded)
      const vehicleKey = `vehicle_images_${vehicleData.id}`;
      const { [vehicleKey]: cachedImages } = await chrome.storage.local.get([vehicleKey]);
      
      if (cachedImages && cachedImages.length > 0) {
        this.log(`📸 Found ${cachedImages.length} pre-downloaded images in cache`);
        
        // Use cached images
        for (let i = 0; i < cachedImages.length; i++) {
          const imageData = cachedImages[i];
          if (imageData && imageData.base64) {
            const file = this.base64ToFile(imageData.base64, `vehicle_image_${i + 1}.jpg`);
            if (file) {
              uploadFiles.push(file);
              this.log(`📸 Prepared cached image ${i + 1} for upload (${(file.size / 1024).toFixed(1)}KB)`);
            }
          }
        }
      } else {
        // Fallback: try individual image cache or direct download
        this.log('📸 No vehicle-specific cache found, trying individual image cache...');
        
        for (let i = 0; i < images.length; i++) {
          const imageUrl = images[i];
          if (!imageUrl) continue;
          
          this.log(`📸 Processing image ${i + 1}/${images.length}: ${imageUrl}`);
          
          try {
            // Try individual cache first
            const imageKey = this.hashString(imageUrl);
            const { [imageKey]: imageData } = await chrome.storage.local.get([imageKey]);
            
            if (imageData && imageData.base64) {
              this.log(`📸 Using individually cached image ${i + 1}`);
              const file = this.base64ToFile(imageData.base64, `vehicle_image_${i + 1}.jpg`);
              if (file) {
                uploadFiles.push(file);
                this.log(`📸 Prepared cached image ${i + 1} for upload (${(file.size / 1024).toFixed(1)}KB)`);
              }
            } else {
              this.log(`📸 Image ${i + 1} not in cache, downloading directly...`);
              
                // Download via background script (bypasses CORS)
                try {
                  this.log(`📸 Downloading via background script for image ${i + 1}...`);
                  
                  const response = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                      this.log(`📸 ⏰ Timeout (10s) downloading image ${i + 1} - skipping`);
                      resolve({ success: false, error: 'Download timeout' });
                    }, 10000); // 10 second timeout per image
                    
                    chrome.runtime.sendMessage({ 
                      action: 'fetchImage', 
                      url: imageUrl 
                    }, (result) => {
                      clearTimeout(timeout);
                      if (chrome.runtime.lastError) {
                        this.log(`📸 Chrome runtime error for image ${i + 1}:`, chrome.runtime.lastError.message);
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                      } else {
                        resolve(result || { success: false, error: 'No response from background script' });
                      }
                    });
                  });
                  
                  if (response && response.success && response.data) {
                    const blob = this.base64ToBlob(response.data, 'image/jpeg');
                    const file = new File([blob], `vehicle_image_${i + 1}.jpg`, { type: 'image/jpeg' });
                    uploadFiles.push(file);
                    this.log(`📸 ✅ Downloaded and prepared image ${i + 1} (${(file.size / 1024).toFixed(1)}KB)`);
                    
                    // Cache the downloaded image for future use
                    const imageKey = this.hashString(imageUrl);
                    await chrome.storage.local.set({
                      [imageKey]: {
                        base64: response.data,
                        url: imageUrl,
                        size: response.size || blob.size,
                        timestamp: Date.now()
                      }
                    });
                  } else {
                    this.log(`📸 ❌ Failed to download image ${i + 1}: ${response?.error || 'Unknown error'}`);
                  }
                } catch (fetchError) {
                  this.log(`📸 ❌ Failed to fetch image ${i + 1}:`, fetchError.message);
                }
            }
          } catch (imageError) {
            this.log(`📸 Error processing image ${i + 1}:`, imageError.message);
            continue;
          }
        }
      }

      if (uploadFiles.length === 0) {
        this.log('📸 No valid images prepared for upload');
        return { success: true, uploadedCount: 0 };
      }

      this.log(`📸 Prepared ${uploadFiles.length} images for upload, looking for file input...`);
      
      // Find file input 
      const fileInputSelectors = [
        'input[type="file"][accept*="image"]',
        'input[type="file"][multiple]',
        'input[type="file"]'
      ];
      
      let fileInput = null;
      for (const selector of fileInputSelectors) {
        fileInput = document.querySelector(selector);
        if (fileInput) break;
      }
      
      if (!fileInput) {
        this.log('📸 No file input found, cannot upload images');
        return { success: false, error: 'File input not found' };
      }

      this.log('📸 Found file input, uploading images...');
      
      // Set files using DataTransfer
      const dataTransfer = new DataTransfer();
      uploadFiles.forEach(file => {
        dataTransfer.items.add(file);
      });
      
      fileInput.files = dataTransfer.files;
      
      // Trigger change event
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      await this.delay(2000); // Wait for files to process
      
      this.log(`✅ Successfully uploaded ${uploadFiles.length} images`);
      return { success: true, uploadedCount: uploadFiles.length };
      
    } catch (error) {
      this.log('❌ Image upload error:', error);
      return { success: false, error: error.message };
    }
  }

  // Fallback image upload method
  async handleImageUploadsFallback(images, fileInput) {
    try {
      this.log('📸 Starting fallback image upload method...');
      
      if (!images || !Array.isArray(images) || images.length === 0) {
        this.log('📸 No images to upload in fallback');
        return true;
      }
      
      if (!fileInput) {
        this.log('❌ No file input provided for fallback');
        return false;
      }
      
      // Simple fallback approach - just try to set files directly
      const imagesToProcess = Math.min(images.length, 4);
      const validFiles = [];
      
      for (let i = 0; i < imagesToProcess; i++) {
        try {
          const response = await fetch(images[i]);
          const blob = await response.blob();
          const file = new File([blob], `vehicle_image_${i + 1}.jpg`, { type: 'image/jpeg' });
          validFiles.push(file);
        } catch (error) {
          this.log(`⚠️ Failed to fetch image ${i + 1} in fallback:`, error);
        }
      }
      
      if (validFiles.length === 0) {
        this.log('❌ No valid images could be processed in fallback');
        return false;
      }
      
      // Use simple DataTransfer approach
      const dataTransfer = new DataTransfer();
      validFiles.forEach(file => dataTransfer.items.add(file));
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      this.log(`✅ Fallback upload completed - ${validFiles.length} files`);
      return true;
      
    } catch (error) {
      this.log('⚠️ Fallback image upload failed:', error);
      return false;
    }
  }

  // Advanced React-compatible file setting with enhanced safeguards
  async setFilesWithReactCompatibility(fileInput, files) {
    try {
      this.log('📸 Setting files with React compatibility...');
      console.log(`[FILE SETTING DEBUG] About to set ${files.length} files on input element`);
      console.log('[FILE SETTING DEBUG] Files details:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
      
      // Validate files before setting - filter out null/undefined
      const validFiles = files.filter(file => {
        const isValid = file && file.size > 0 && file.size < 50 * 1024 * 1024; // Max 50MB per file
        if (!isValid) {
          console.log('[FILE SETTING DEBUG] Invalid file filtered out:', file);
        }
        return isValid;
      });
      
      if (validFiles.length === 0) {
        throw new Error('No valid files to upload');
      }
      
      console.log(`[FILE SETTING DEBUG] Using ${validFiles.length} valid files out of ${files.length}`);
      
      // CRITICAL: Ensure input supports multiple files
      if (!fileInput.hasAttribute('multiple') && validFiles.length > 1) {
        console.log('[FILE SETTING DEBUG] Setting multiple attribute on file input');
        fileInput.setAttribute('multiple', 'multiple');
        fileInput.multiple = true;
      }
      
      // Clear any existing files first
      try {
        const emptyDataTransfer = new DataTransfer();
        fileInput.files = emptyDataTransfer.files;
        await this.delay(200);
        console.log('[FILE SETTING DEBUG] Cleared existing files');
      } catch (e) {
        console.log('[FILE SETTING DEBUG] Failed to clear existing files:', e);
      }
      
      // Create new DataTransfer with ALL valid files at once
      const dataTransfer = new DataTransfer();
      
      // Add all files to the same DataTransfer object
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        try {
          console.log(`[FILE SETTING DEBUG] Adding file ${i + 1}/${validFiles.length}: ${file.name} (${file.size} bytes, ${file.type})`);
          dataTransfer.items.add(file);
          console.log(`[FILE SETTING DEBUG] Successfully added file ${i + 1}, DataTransfer now has ${dataTransfer.files.length} files`);
        } catch (e) {
          console.log(`[FILE SETTING DEBUG] Failed to add file ${i + 1}:`, e);
        }
      }
      
      console.log(`[FILE SETTING DEBUG] Final DataTransfer created with ${dataTransfer.files.length} files`);
      
      // CRITICAL: Set ALL files at once using multiple methods for maximum compatibility
      let fileSetSuccess = false;
      
      // Method 1: Use Object.defineProperty for React compatibility (most reliable)
      try {
        Object.defineProperty(fileInput, 'files', {
          value: dataTransfer.files,
          configurable: true
        });
        console.log('[FILE SETTING DEBUG] Set files via Object.defineProperty');
        fileSetSuccess = true;
      } catch (e) {
        console.log('[FILE SETTING DEBUG] Object.defineProperty method failed:', e);
      }
      
      // Method 2: Direct assignment as backup
      if (!fileSetSuccess) {
        try {
          fileInput.files = dataTransfer.files;
          console.log('[FILE SETTING DEBUG] Set files via direct assignment');
          fileSetSuccess = true;
        } catch (e) {
          console.log('[FILE SETTING DEBUG] Direct assignment failed:', e);
        }
      }
      
      // Method 3: Property descriptor setter as final backup
      if (!fileSetSuccess) {
        try {
          const fileSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
          if (fileSetter) {
            fileSetter.call(fileInput, dataTransfer.files);
            console.log('[FILE SETTING DEBUG] Set files via property descriptor');
            fileSetSuccess = true;
          }
        } catch (e) {
          console.log('[FILE SETTING DEBUG] Property descriptor method failed:', e);
        }
      }
      
      if (!fileSetSuccess) {
        throw new Error('All file setting methods failed');
      }
      
      // Brief delay before events
      await this.delay(500);
      
      // Verify files were set BEFORE triggering events
      const preEventFileCount = fileInput.files ? fileInput.files.length : 0;
      console.log(`[FILE SETTING DEBUG] Pre-event verification: ${preEventFileCount} files in input`);
      
      if (preEventFileCount !== validFiles.length) {
        console.log(`[FILE SETTING DEBUG] WARNING: Expected ${validFiles.length} files but input has ${preEventFileCount}`);
      }
      
      // Focus and trigger events for React
      try {
        fileInput.focus();
        await this.delay(200);
        
        // Create change event with proper target references
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        Object.defineProperty(changeEvent, 'target', { 
          value: fileInput, 
          enumerable: true,
          configurable: true 
        });
        Object.defineProperty(changeEvent, 'currentTarget', { 
          value: fileInput, 
          enumerable: true,
          configurable: true 
        });
        
        fileInput.dispatchEvent(changeEvent);
        console.log('[FILE SETTING DEBUG] Dispatched change event');
        
        await this.delay(100);
        
        // Also trigger input event for React
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        Object.defineProperty(inputEvent, 'target', { 
          value: fileInput, 
          enumerable: true,
          configurable: true 
        });
        fileInput.dispatchEvent(inputEvent);
        console.log('[FILE SETTING DEBUG] Dispatched input event');
        
      } catch (e) {
        console.log('[FILE SETTING DEBUG] Event dispatching failed:', e);
      }
      
      // Wait for React to process the files
      await this.delay(3000);
      
      // Final verification
      const finalFileCount = fileInput.files ? fileInput.files.length : 0;
      console.log(`[FILE SETTING DEBUG] Final verification: ${finalFileCount} files in input`);
      
      if (finalFileCount === validFiles.length) {
        this.log(`✅ Successfully set ALL ${finalFileCount} files in input!`);
        return true;
      } else if (finalFileCount > 0) {
        this.log(`⚠️ Partial success: ${finalFileCount}/${validFiles.length} files set in input`);
        return true; // Still consider this a success
      } else {
        this.log(`❌ No files detected in input after setting`);
        return false;
      }
      
    } catch (error) {
      console.log('[FILE SETTING DEBUG] Error in file setting:', error);
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

  // Enhanced utility function to convert base64 to blob with better error handling
  base64ToBlob(base64Data, contentType = 'image/jpeg') {
    try {
      console.log('[BASE64 DEBUG] Converting base64 to blob, contentType:', contentType);
      console.log('[BASE64 DEBUG] Base64 data length:', base64Data?.length || 0);
      
      // Handle data URLs (data:image/jpeg;base64,xxxxx) vs raw base64
      let base64String = base64Data;
      if (base64Data.includes(',')) {
        base64String = base64Data.split(',')[1];
        console.log('[BASE64 DEBUG] Extracted base64 from data URL');
      }
      
      // Validate base64 string
      if (!base64String || base64String.length === 0) {
        throw new Error('Empty base64 string');
      }
      
      // Decode base64 to binary
      const byteCharacters = atob(base64String);
      console.log('[BASE64 DEBUG] Decoded byte characters length:', byteCharacters.length);
      
      if (byteCharacters.length === 0) {
        throw new Error('Base64 decode resulted in empty data');
      }
      
      // Convert to byte array
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      
      // Create blob with proper MIME type
      const blob = new Blob([byteArray], { type: contentType });
      console.log('[BASE64 DEBUG] Created blob:', { size: blob.size, type: blob.type });
      
      return blob;
    } catch (error) {
      console.log('[BASE64 DEBUG] Error converting base64 to blob:', error);
      this.log('⚠️ Error converting base64 to blob:', error);
      // Return empty blob as fallback
      return new Blob([], { type: contentType });
    }
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
      
      // Step 1: Click Next button to go to preview page
      const nextSelectors = [
        'aria:Next',
        'text:Next',
        'button:contains("Next")',
        '[data-testid*="next"]'
      ];
      
      const nextButton = await this.waitForElement(nextSelectors, 10000);
      await this.scrollIntoView(nextButton);
      await this.delay(this.randomDelay(1000, 2000));
      
      this.log('📋 Clicking Next button...');
      nextButton.click();
      
      // Wait for preview page to load
      await this.delay(3000);
      
      // Step 2: Look for and click the final Publish button
      const publishSelectors = [
        'aria:Publish',
        'text:Publish',
        'button:contains("Publish")',
        '[data-testid*="publish"]',
        'button[type="submit"]',
        '.btn-primary:contains("Publish")'
      ];
      
      this.log('🔍 Looking for Publish button...');
      try {
        const publishButton = await this.waitForElement(publishSelectors, 8000);
        await this.scrollIntoView(publishButton);
        await this.delay(this.randomDelay(1000, 2000));
        
        this.log('📤 Clicking Publish button...');
        publishButton.click();
        
        // Wait for publication to complete
        await this.delay(5000);
        
        // Step 3: Verify success and navigate back to marketplace
        const successIndicators = [
          'text:posted',
          'text:published',
          'text:success',
          'text:Your listing is now live',
          'text:listing posted',
          '[data-testid*="success"]'
        ];
        
        try {
          await this.waitForElement(successIndicators, 8000);
          this.log('✅ Listing published successfully!');
          
          // Navigate back to marketplace vehicle listings
          await this.delay(2000);
          this.log('🔄 Navigating back to marketplace...');
          
          // Try to navigate back to marketplace
          try {
            window.location.href = 'https://www.facebook.com/marketplace/category/vehicles';
            await this.delay(3000);
          } catch (navError) {
            this.log('⚠️ Could not auto-navigate, staying on current page');
          }
          
          return true;
        } catch (successError) {
          this.log('⚠️ Could not verify publication success, but likely succeeded');
          
          // Still try to navigate back
          try {
            await this.delay(2000);
            window.location.href = 'https://www.facebook.com/marketplace/category/vehicles';
            await this.delay(3000);
          } catch (navError) {
            this.log('⚠️ Could not auto-navigate back to marketplace');
          }
          
          return true; // Assume success if we got this far
        }
        
      } catch (publishError) {
        this.log('❌ Could not find Publish button:', publishError);
        
        // Check if already published by looking for success indicators
        const alreadyPublishedSelectors = [
          'text:posted',
          'text:published',
          'text:success'
        ];
        
        try {
          await this.waitForElement(alreadyPublishedSelectors, 3000);
          this.log('✅ Listing appears to be already published');
          
          // Navigate back to marketplace
          await this.delay(2000);
          window.location.href = 'https://www.facebook.com/marketplace/category/vehicles';
          return true;
        } catch (alreadyError) {
          this.log('❌ Publication failed - could not find Publish button or success confirmation');
          return false;
        }
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
  initializeConsoleLogging() {
    this.consoleBuffer = [];
    this.sessionId = this.generateSessionId();
    this.maxBufferSize = 100;
    this.logBatchInterval = 30000; // 30 seconds
    
    // Override console methods to capture logs
    this.originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };
    
    ['log', 'info', 'warn', 'error', 'debug'].forEach(level => {
      console[level] = (...args) => {
        // Call original console method
        this.originalConsole[level](...args);
        
        // Capture the log
        this.captureLog(level, args);
      };
    });
    
    // Start periodic log transmission
    this.startLogTransmission();
    
    console.log('📊 Console logging initialized', { sessionId: this.sessionId });
  }
  
  generateSessionId() {
    return 'ext_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  captureLog(level, args) {
    try {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg, null, 2);
        }
        return String(arg);
      }).join(' ');
      
      const logEntry = {
        session_id: this.sessionId,
        timestamp: new Date().toISOString(),
        level: level,
        message: message,
        data: args.length > 1 ? args.slice(1) : null,
        url: window.location.href,
        source: 'content_script',
        user_agent: navigator.userAgent
      };
      
      this.consoleBuffer.push(logEntry);
      
      // Trim buffer if it gets too large
      if (this.consoleBuffer.length > this.maxBufferSize) {
        this.consoleBuffer = this.consoleBuffer.slice(-this.maxBufferSize);
      }
    } catch (error) {
      this.originalConsole.error('Failed to capture log:', error);
    }
  }
  
  async startLogTransmission() {
    const transmitLogs = async () => {
      if (this.consoleBuffer.length === 0) return;
      
      try {
        // Get current authentication token
        const token = await this.getAuthToken();
        if (!token) return;
        
        const logsToSend = [...this.consoleBuffer];
        this.consoleBuffer = [];
        
        const response = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/console-logger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ logs: logsToSend })
        });
        
        if (!response.ok) {
          this.originalConsole.warn('Failed to send console logs:', response.status);
          // Put logs back in buffer if send failed
          this.consoleBuffer.unshift(...logsToSend);
        } else {
          const result = await response.json();
          this.originalConsole.debug('Console logs sent successfully:', result.message);
        }
      } catch (error) {
        this.originalConsole.error('Error sending console logs:', error);
      }
    };
    
    // Send logs immediately, then on interval
    transmitLogs();
    setInterval(transmitLogs, this.logBatchInterval);
  }
  
  async getAuthToken() {
    return new Promise((resolve) => {
      // First try background script
      chrome.runtime.sendMessage({
        action: 'GET_AUTH_TOKEN'
      }, async (response) => {
        if (response?.token) {
          resolve(response.token);
          return;
        }
        
        // Fallback to storage if background script doesn't have token
        try {
          const result = await chrome.storage.sync.get(['userToken']);
          if (result.userToken) {
            // Store in background script for next time
            chrome.runtime.sendMessage({
              action: 'SET_AUTH_TOKEN',
              token: result.userToken
            });
            resolve(result.userToken);
          } else {
            resolve(null);
          }
        } catch (error) {
          console.error('Error getting auth token from storage:', error);
          resolve(null);
        }
      });
    });
  }

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
    console.log('🔧 Setting up message listener in content script...');
    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📨 Message received in content script:', request.action, request);
      this.log('📨 Received message in content script:', request);
      
      if (request.action === 'postVehicle') {
        console.log('🚀 Processing postVehicle request...');
        this.log('🚀 Starting vehicle posting process...');
        
        // Validate vehicle data structure
        if (!request.vehicle) {
          console.log('❌ No vehicle data provided in request');
          this.log('❌ No vehicle data provided');
          sendResponse({ success: false, error: 'No vehicle data provided' });
          return true;
        }
        
        // Ensure images is an array
        if (request.vehicle.images && !Array.isArray(request.vehicle.images)) {
          this.log('⚠️ Converting non-array images to array');
          request.vehicle.images = [];
        }
        
        this.postVehicle(request.vehicle)
          .then(result => {
            console.log('✅ Vehicle posting completed:', result);
            this.log('📤 Sending response back to popup:', result);
            sendResponse(result);
          })
          .catch(error => {
            console.error('❌ Vehicle posting failed:', error);
            this.log('❌ Error in postVehicle:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Keep message channel open for async response
      }
      
      if (request.action === 'checkLogin') {
        console.log('🔐 Checking Facebook login status...');
        const isLoggedIn = this.checkFacebookLogin();
        console.log('🔐 Login status:', isLoggedIn);
        sendResponse({ loggedIn: isLoggedIn });
        return false; // Synchronous response
      }
      
      if (request.action === 'ping') {
        console.log('🏓 Ping received, responding with ready status');
        sendResponse({ status: 'ready', enhanced: true, timestamp: Date.now() });
        return false; // Synchronous response
      }
      
      if (request.action === 'popupLog') {
        console.log('[Popup]', request.message, request.data || '');
        this.log('🧭 Popup log:', { message: request.message, data: request.data });
        sendResponse?.({ ok: true });
        return false;
      }

      if (request.action === 'popupError') {
        console.error('[Popup Error]', request.message, request.data || '');
        this.log('❌ Popup error:', { message: request.message, data: request.data });
        sendResponse?.({ ok: true });
        return false;
      }
      
      console.log('❓ Unknown action received:', request.action);
      // For unknown actions, don't keep channel open
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
    });
    
    console.log('✅ Message listener setup complete');
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

  // Record vehicle posting in backend and deduct credits using proper endpoint
  async recordVehiclePosting(vehicleId) {
    try {
      this.log('📝 Starting vehicle posting record process for ID:', vehicleId);
      
      // Get user token from extension storage using direct access
      this.log('🔍 Getting user token from storage...');
      const storageResult = await chrome.storage.sync.get(['userToken']);
      const userToken = storageResult.userToken;
      
      if (!userToken) {
        this.log('❌ No user token found in storage');
        throw new Error('User not authenticated - no token found');
      }
      
      this.log('🔑 Token found, proceeding with recording...');
      
      // Generate Facebook post ID
      const facebookPostId = this.extractFacebookPostId();
      this.log('🆔 Facebook post ID:', facebookPostId);
      
      // Call the database function directly via Supabase REST API
      const updateData = {
        facebook_post_status: 'posted',
        last_posted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      this.log('📤 Calling database function with data:', JSON.stringify({
        p_vehicle_id: vehicleId,
        p_user_id: 'from_auth',
        p_facebook_post_id: facebookPostId,
        p_update_data: updateData
      }, null, 2));
      
      const apiUrl = 'https://urdkaedsfnscgtyvcwlf.supabase.co/rest/v1/rpc/deduct_credit_and_update_vehicle';
      this.log('🌐 API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
        },
        body: JSON.stringify({
          p_vehicle_id: vehicleId,
          p_user_id: null, // Let function use auth.uid()
          p_facebook_post_id: facebookPostId,
          p_update_data: updateData
        })
      });
      
      this.log('📨 Backend response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        this.log('❌ Backend error response text:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      this.log('📋 Database function response:', JSON.stringify(data, null, 2));
      
      // The RPC response is the direct result of the function
      if (!data || (data.error && !data.vehicle)) {
        this.log('❌ Database function failed:', data?.error || 'No data returned');
        throw new Error(data?.error || 'Failed to record posting');
      }
      
      const credits = data.credits;
      this.log('✅ Successfully recorded posting!');
      this.log('💰 Credits remaining:', credits);
      
      return {
        success: true,
        credits: credits,
        message: 'Vehicle posted and credits deducted successfully'
      };
      
    } catch (error) {
      this.log('❌ Error in recordVehiclePosting:', error.message);
      console.error('Full recording error:', error);
      throw error;
    }
  }

  // Setup URL change detection to handle Facebook redirects
  setupUrlChangeDetection() {
    this.log('🔍 Setting up URL change detection...');
    
    // Monitor for URL changes using both popstate and a periodic check
    window.addEventListener('popstate', () => this.handleUrlChange());
    
    // Periodic URL check (Facebook uses pushState which doesn't trigger popstate)
    setInterval(() => {
      if (window.location.href !== this.currentUrl) {
        this.handleUrlChange();
      }
    }, 1000);
    
    // Also monitor for page load events
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.handleUrlChange());
    } else {
      // Document already loaded
      setTimeout(() => this.handleUrlChange(), 500);
    }
  }

  // Handle URL changes and redirects
  handleUrlChange() {
    const newUrl = window.location.href;
    const oldUrl = this.currentUrl;
    
    if (newUrl !== oldUrl) {
      console.log('🚀 URL CHANGE DETECTED:');
      console.log('🚀 From:', oldUrl);
      console.log('🚀 To:', newUrl);
      console.log('🚀 isWaitingForNextVehicle:', this.isWaitingForNextVehicle);
      
      this.log('🔄 URL changed detected:');
      this.log('  From:', oldUrl);
      this.log('  To:', newUrl);
      
      this.currentUrl = newUrl;
      
      // Check if we've been redirected to vehicles category after posting
      if (newUrl.includes('/marketplace/category/vehicles') && this.isWaitingForNextVehicle) {
        console.log('🚀 DETECTED REDIRECT TO VEHICLES CATEGORY - POSTING COMPLETED');
        this.log('🎯 Detected redirect to vehicles category after posting - vehicle posted successfully');
        
        // Send immediate success notification to popup
        try {
          chrome.runtime.sendMessage({
            action: 'vehiclePosted',
            oldUrl: oldUrl,
            newUrl: newUrl,
            status: 'posted_successfully'
          });
          
          // Also notify web app of successful posting (non-blocking)
          this.notifyWebAppOfPosting();
          
          // Signal popup to continue with next vehicle immediately
          chrome.runtime.sendMessage({
            action: 'continueWithNextVehicle',
            message: 'Vehicle posted successfully, ready for next vehicle'
          });
        } catch (error) {
          console.log('Extension context invalidated, but posting was successful');
        }
        
        // Navigate to create page immediately for next vehicle
        setTimeout(() => {
          console.log('🚀 NAVIGATING TO CREATE PAGE FOR NEXT VEHICLE');
          this.navigateToCreateVehiclePage();
        }, 1500);
      }
      
      // Check if we're on the create vehicle page and ready for next posting
      else if (newUrl.includes('/marketplace/create/vehicle') && this.isWaitingForNextVehicle) {
        console.log('🚀 SUCCESSFULLY ON CREATE VEHICLE PAGE - READY FOR NEXT');
        this.log('✅ Successfully navigated to create vehicle page - ready for next posting');
        
        // Send status update to popup
        chrome.runtime.sendMessage({
          action: 'urlChanged',
          oldUrl: oldUrl,
          newUrl: newUrl,
          status: 'ready_for_next_vehicle'
        });
        
        this.isWaitingForNextVehicle = false;
        
        // Wait a moment for page to fully load then notify popup
        setTimeout(() => {
          console.log('🚀 NOTIFYING POPUP - READY FOR NEXT VEHICLE');
          chrome.runtime.sendMessage({
            action: 'readyForNextVehicle',
            url: newUrl
          });
        }, 2000);
      }
      
      // Handle any other URL changes after successful posting
      else if (this.isWaitingForNextVehicle) {
        console.log('🚀 URL CHANGED WHILE WAITING - FORCING NAVIGATION:', newUrl);
        this.log('🔄 URL changed while waiting for next vehicle:', newUrl);
        
        // If we're on any Facebook page but not the vehicles category or create page,
        // force navigation to create page
        if (newUrl.includes('facebook.com') && 
            !newUrl.includes('/marketplace/create/vehicle') && 
            !newUrl.includes('/marketplace/category/vehicles')) {
          console.log('🚀 FORCING NAVIGATION TO CREATE FROM UNEXPECTED URL');
          this.log('🎯 Forcing navigation to create vehicle page from unexpected URL');
          setTimeout(() => {
            this.navigateToCreateVehiclePage();
          }, 2000);
        }
      }
      
      // Update popup with current status
      chrome.runtime.sendMessage({
        action: 'urlChanged',
        oldUrl: oldUrl,
        newUrl: newUrl
      });
    }
  }

  // Navigate back to create vehicle page for next posting
  async navigateToCreateVehiclePage() {
    try {
      this.log('🔄 Starting navigation to Facebook Marketplace create vehicle page...');
      this.log('📍 Current URL before navigation:', window.location.href);
      this.log('📍 Current page title:', document.title);
      
      // Navigate directly to the create vehicle URL
      const createVehicleUrl = 'https://www.facebook.com/marketplace/create/vehicle';
      this.log('🎯 Target URL:', createVehicleUrl);
      
      // Notify popup we're navigating
      chrome.runtime.sendMessage({
        action: 'navigatingToCreate',
        fromUrl: window.location.href,
        toUrl: createVehicleUrl
      });
      
      // Use immediate navigation
      this.log('🌐 Initiating immediate navigation...');
      window.location.replace(createVehicleUrl);
      
      this.log('✅ Navigation initiated to create vehicle page');
      
    } catch (error) {
      this.log('⚠️ Error navigating to create vehicle page:', error.message);
      this.log('⚠️ Full navigation error:', error);
      console.error('Navigation error:', error);
      
      // Fallback: try regular navigation
      try {
        window.location.href = createVehicleUrl;
      } catch (fallbackError) {
        this.log('⚠️ Fallback navigation also failed:', fallbackError);
      }
    }
  }

  // Check for Salesonator web app authentication across all tabs
  async checkWebAppAuthentication() {
    try {
      // Check if we're on the Salesonator domain
      const salesonatorDomains = [
        'urdkaedsfnscgtyvcwlf.supabase.co',
        'salesonator.com',
        'salesonator.lovable.app', 
        'preview--inventory-to-face.lovable.app'
      ];
      
      const isOnSalesonatorDomain = salesonatorDomains.some(domain => 
        window.location.hostname.includes(domain) || 
        window.location.hostname === domain
      );

      if (isOnSalesonatorDomain) {
        // Check localStorage for Supabase session
        const supabaseSession = localStorage.getItem('sb-urdkaedsfnscgtyvcwlf-auth-token');
        
        if (supabaseSession) {
          try {
            const sessionData = JSON.parse(supabaseSession);
            const accessToken = sessionData.access_token;
            
            if (accessToken) {
              // Verify the token and get user info
              const response = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/rest/v1/profiles?select=credits,is_active,email', {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ'
                }
              });

              if (response.ok) {
                const profileData = await response.json();
                const profile = profileData[0];

                if (profile && profile.is_active && profile.credits > 0) {
                  // Store authentication info in extension storage
                  chrome.runtime.sendMessage({
                    action: 'webAppAuthenticated',
                    credentials: {
                      token: accessToken,
                      email: profile.email,
                      credits: profile.credits
                    }
                  });

                  this.log('🔐 Auto-authenticated via Salesonator web app!');
                  this.showAuthenticationBanner(true);
                }
              }
            }
          } catch (parseError) {
            console.log('Failed to parse session data:', parseError);
          }
        }
      }
    } catch (error) {
      console.log('Web app authentication check failed:', error);
    }
  }

  // Show authentication status banner
  showAuthenticationBanner(isAuthenticated) {
    // Remove any existing banner
    const existingBanner = document.getElementById('salesonator-auth-banner');
    if (existingBanner) {
      existingBanner.remove();
    }

    if (isAuthenticated) {
      const banner = document.createElement('div');
      banner.id = 'salesonator-auth-banner';
      banner.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 8px;
        animation: slideInFromRight 0.3s ease-out;
      `;
      
      banner.innerHTML = `
        <span style="font-size: 16px;">✅</span>
        <span>Auto-authenticated via Salesonator web app!</span>
      `;

      // Add animation keyframes
      if (!document.getElementById('salesonator-animations')) {
        const style = document.createElement('style');
        style.id = 'salesonator-animations';
        style.textContent = `
          @keyframes slideInFromRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(banner);

      // Auto-hide after 5 seconds
      setTimeout(() => {
        if (banner.parentNode) {
          banner.style.transition = 'opacity 0.3s ease-out';
          banner.style.opacity = '0';
          setTimeout(() => banner.remove(), 300);
        }
      }, 5000);
    }
  }

  // Notify web app of successful posting without blocking the extension flow
  async notifyWebAppOfPosting() {
    try {
      if (this.currentVehicle && this.currentVehicle.id) {
        // Get stored authentication
        const result = await chrome.storage.sync.get(['userToken']);
        if (!result.userToken) {
          console.log('No auth token available for web app notification');
          return;
        }

        // Extract Facebook post ID from current URL or page
        const facebookPostId = this.extractFacebookPostId();
        
        // Call the correct scrape-vehicle edge function with proper data structure
        const response = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/scrape-vehicle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${result.userToken}`
          },
          body: JSON.stringify({
            vehicles: [{
              id: this.currentVehicle.id,
              facebook_post_status: 'posted',
              facebook_post_id: facebookPostId,
              last_posted_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Web app notified of successful posting:', data);
          
          // Schedule URL retrieval for later (after redirect settles)
          setTimeout(() => {
            this.retrievePostingUrl();
          }, 5000);
        } else {
          const errorText = await response.text();
          console.log('Failed to notify web app:', response.status, errorText);
        }
      }
    } catch (error) {
      console.log('Error notifying web app (non-blocking):', error);
    }
  }

  // Extract Facebook post ID from the current page
  extractFacebookPostId() {
    try {
      // Try to get post ID from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      let postId = urlParams.get('id') || urlParams.get('post_id');
      
      if (!postId) {
        // Try to extract from current URL path
        const pathMatch = window.location.pathname.match(/\/([0-9]+)/);
        if (pathMatch) {
          postId = pathMatch[1];
        }
      }
      
      return postId || `marketplace_${Date.now()}`;
    } catch (error) {
      console.log('Could not extract Facebook post ID:', error);
      return `marketplace_${Date.now()}`;
    }
  }

  // Retrieve the actual posting URL from Facebook's selling page
  async retrievePostingUrl() {
    try {
      console.log('🔍 Attempting to retrieve posting URL...');
      
      // Navigate to the selling page to find the posted vehicle
      const sellingPageUrl = 'https://www.facebook.com/marketplace/you/selling';
      
      // Only navigate if we're not already there
      if (!window.location.href.includes('/marketplace/you/selling')) {
        window.location.href = sellingPageUrl;
        
        // Wait for page to load, then look for the posted vehicle
        setTimeout(() => {
          this.findPostedVehicleUrl();
        }, 3000);
      } else {
        this.findPostedVehicleUrl();
      }
    } catch (error) {
      console.log('Error retrieving posting URL (non-blocking):', error);
    }
  }

  // Find the URL of the posted vehicle on the selling page
  async findPostedVehicleUrl() {
    try {
      if (!this.currentVehicle) return;

      // Look for vehicle listings on the selling page
      const vehicleLinks = document.querySelectorAll('a[href*="/marketplace/item/"]');
      
      for (const link of vehicleLinks) {
        const linkText = link.textContent || '';
        const vehicleTitle = `${this.currentVehicle.year} ${this.currentVehicle.make} ${this.currentVehicle.model}`;
        
        // Check if this link matches our vehicle
        if (linkText.includes(this.currentVehicle.year.toString()) && 
            linkText.includes(this.currentVehicle.make) && 
            linkText.includes(this.currentVehicle.model)) {
          
          const postingUrl = link.href;
          console.log('🎯 Found posting URL:', postingUrl);
          
          // Store the URL in the web app
          await this.storePostingUrl(postingUrl);
          break;
        }
      }
    } catch (error) {
      console.log('Error finding posted vehicle URL (non-blocking):', error);
    }
  }

  // Store the posting URL in the web app database
  async storePostingUrl(postingUrl) {
    try {
      const result = await chrome.storage.local.get(['userToken']);
      if (!result.userToken || !this.currentVehicle) return;

      // Update the vehicle with the posting URL (would need a new database field)
      const response = await fetch('https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/facebook-poster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.userToken}`
        },
        body: JSON.stringify({
          action: 'store_posting_url',
          vehicleId: this.currentVehicle.id,
          postingUrl: postingUrl
        })
      });

      if (response.ok) {
        console.log('✅ Posting URL stored successfully');
      }
    } catch (error) {
      console.log('Error storing posting URL (non-blocking):', error);
    }
  }
}

// Initialize the enhanced automator
const salesonatorAutomator = new SalesonatorAutomator();
console.log('✅ Salesonator Enhanced Automator loaded successfully');
console.log('📞 Content script ready to receive messages from popup');