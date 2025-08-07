// CarsForSale.com enhanced scraper content script
(function(){
  console.log('[CARSFORSALE SCRAPER] Script loaded on:', window.location.href);
  
  const VIN_REGEX = /\b[A-HJ-NPR-Z0-9]{17}\b/;
  function toNumber(val){ if(val==null) return null; const d=String(val).replace(/[^\d.]/g,''); const n=parseFloat(d); return isNaN(n)?null:n; }
  function q(el, sels){ for(const s of sels){ try{ const f=el.querySelector(s); if(f) return f; }catch{} } return null; }
  function text(el){ return (el?.textContent||'').trim(); }

  function scrape(){
    console.log('[CARSFORSALE SCRAPER] Starting scrape process...');
    
    // Enhanced selectors for different page layouts
    const selectors = [
      '[data-qa="vehicle-card"]', '.vehicle-card', '.srp-grid .vehicle', 
      '.vehicle-item', 'article', '.listing-item', '.inventory-item',
      '.vehicle-listing', '.car-item', '.auto-item'
    ];
    
    let cards = [];
    for (const selector of selectors) {
      const found = Array.from(document.querySelectorAll(selector));
      if (found.length > 0) {
        console.log(`[CARSFORSALE SCRAPER] Found ${found.length} cards with selector: ${selector}`);
        cards = found;
        break;
      }
    }
    
    if (cards.length === 0) {
      console.log('[CARSFORSALE SCRAPER] No vehicle cards found. Page might not be an inventory page.');
      console.log('[CARSFORSALE SCRAPER] Available elements:', document.querySelectorAll('*').length);
      return;
    }
    
    console.log(`[CARSFORSALE SCRAPER] Processing ${cards.length} vehicle cards...`);
    const vehicles=[];
    
    for(let i = 0; i < cards.length; i++){
      const card = cards[i];
      const title = text(q(card,['.title','.vehicle-title','h2','h3']));
      const priceText = text(q(card,['.price','[data-qa="price"]','.vehicle-price']));
      const mileageText = text(q(card,['.mileage','[data-qa="mileage"]','.vehicle-mileage']));
      const vinText = (card.innerText.match(VIN_REGEX)||[])[0] || text(q(card,['[data-qa="vin"]','.vin']));
      const imgEls = Array.from(card.querySelectorAll('img')).slice(0,10);
      const images = imgEls.map(img=>img.src).filter(Boolean);

      let year, make, model, trim;
      if(title){
        const parts = title.split(/\s+/);
        const possibleYear = parseInt(parts[0]);
        if(possibleYear>1980 && possibleYear<2100){
          year = possibleYear; make = parts[1]; model = parts.slice(2).join(' ');
        }
      }

      const vehicle = {
        year, make, model, trim,
        vin: vinText || null,
        price: toNumber(priceText),
        mileage: toNumber(mileageText),
        images,
        description: title
      };
      
      if(make && model) {
        vehicles.push(vehicle);
        console.log(`[CARSFORSALE SCRAPER] Card ${i+1}: ${year} ${make} ${model} - $${toNumber(priceText)}`);
      } else {
        console.log(`[CARSFORSALE SCRAPER] Card ${i+1}: Skipped (missing make/model) - Title: "${title}"`);
      }
    }
    
    console.log(`[CARSFORSALE SCRAPER] Scraping complete. Found ${vehicles.length} valid vehicles.`);
    
    if(vehicles.length > 0){
      console.log('[CARSFORSALE SCRAPER] Sending vehicles to background script...');
      chrome.runtime.sendMessage({ 
        action: 'scrapedInventory', 
        source: 'carsforsale', 
        vehicles 
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[CARSFORSALE SCRAPER] Error sending message:', chrome.runtime.lastError);
        } else if (response) {
          console.log('[CARSFORSALE SCRAPER] Background response:', response);
        }
      });
    } else {
      console.log('[CARSFORSALE SCRAPER] No vehicles to send.');
    }
  }

  // Multiple triggers to catch different page load scenarios
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[CARSFORSALE SCRAPER] DOM loaded, starting scrape in 2 seconds...');
      setTimeout(scrape, 2000);
    });
  } else {
    console.log('[CARSFORSALE SCRAPER] DOM already loaded, starting scrape in 1 second...');
    setTimeout(scrape, 1000);
  }
  
  // Backup scraper for slow-loading pages
  setTimeout(() => {
    console.log('[CARSFORSALE SCRAPER] Backup scrape trigger...');
    scrape();
  }, 5000);
})();
