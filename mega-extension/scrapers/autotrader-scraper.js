// Copied from current extension scrapers to include in mega extension
// AutoTrader simple scraper content script
(function(){
  const VIN_REGEX = /\b[A-HJ-NPR-Z0-9]{17}\b/;
  function toNumber(val){ if(val==null) return null; const d=String(val).replace(/[^\d.]/g,''); const n=parseFloat(d); return isNaN(n)?null:n; }
  function q(el, sels){ for(const s of sels){ try{ const f=el.querySelector(s); if(f) return f; }catch{} } return null; }
  function text(el){ return (el?.textContent||'').trim(); }

  function scrape(){
    const cards = Array.from(document.querySelectorAll('[data-cmp="inventoryListing"] , .inventory-listing, article, .vehicle-card')); 
    const vehicles=[];
    for(const card of cards){
      const title = text(q(card,['h2','h3','.title','.vehicle-title']));
      const priceText = text(q(card,['.first-price','.price','.inventory-listing-price']));
      const mileageText = text(q(card,['.mileage','.item-card-specifications']));
      const vinText = (card.innerText.match(VIN_REGEX)||[])[0] || text(q(card,['.vin','[data-cmp="vin"]']));
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
      if(make && model) vehicles.push(vehicle);
    }
    if(vehicles.length){
      chrome.runtime.sendMessage({ action: 'scrapedInventory', source: 'autotrader', vehicles });
    }
  }

  document.addEventListener('DOMContentLoaded', ()=> setTimeout(scrape, 1500));
  setTimeout(scrape, 4000);
})();
