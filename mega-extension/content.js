// Salesonator Mega Extension - Content script
// Handles FB Marketplace form population and message bridge for posting

(function(){
  const log = (...a)=>console.log('[MEGA CONTENT]', ...a);

  function isMarketplaceCreate(){
    return /facebook\.com\/marketplace\/create\//.test(location.href);
  }

  function setInputValue(el, value){
    if(!el) return false;
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
    return true;
  }

  function findField(labels){
    for(const l of labels){
      // Common FB input patterns may change often; we keep this generic
      const byPlaceholder = document.querySelector(`input[placeholder*="${l}"]`);
      if(byPlaceholder) return byPlaceholder;
      const label = Array.from(document.querySelectorAll('label')).find(lb=>lb.textContent?.toLowerCase().includes(l.toLowerCase()));
      if(label){
        const forId = label.getAttribute('for');
        if(forId){
          const inp = document.getElementById(forId);
          if(inp) return inp;
        }
        const inp = label.querySelector('input, textarea');
        if(inp) return inp;
      }
    }
    return null;
  }

  async function fillMarketplaceForm(vehicle){
    log('Filling form with vehicle', vehicle?.vin||vehicle?.make);
    const mapping = [
      { key: 'title', labels: ['Title','Listing title','Headline'], fallback: `${vehicle.year||''} ${vehicle.make||''} ${vehicle.model||''}`.trim() },
      { key: 'price', labels: ['Price'], format: (v)=> String(v||'') },
      { key: 'mileage', labels: ['Mileage'], format: (v)=> String(v||'') },
      { key: 'vin', labels: ['VIN','Vehicle Identification Number'], format: (v)=> String(v||'') },
      { key: 'description', labels: ['Description','Details'], format: (v)=> String(v||'') },
      { key: 'location', labels: ['Location','City'], format: (v)=> String(v||'') },
    ];

    for(const f of mapping){
      const value = vehicle[f.key] ?? f.fallback ?? '';
      const el = findField(f.labels);
      if(!el) { log('Field not found for', f.key); continue; }
      setInputValue(el, f.format ? f.format(value) : value);
      await new Promise(r=>setTimeout(r, 200));
    }

    // Images: content scripts cannot directly upload blobs fetched from background easily without UI; skip here.
    return true;
  }

  chrome.runtime.onMessage.addListener((req, sender, sendResponse)=>{
    if(req?.action === 'postVehicleToFacebook'){
      if(!isMarketplaceCreate()){
        sendResponse({ ok:false, error: 'not_on_marketplace_create' });
        return;
      }
      fillMarketplaceForm(req.vehicle).then(()=> sendResponse({ ok:true })).catch(err=> {
        console.error(err);
        sendResponse({ ok:false, error: String(err) });
      });
      return true;
    }
  });

  log('Content script initialized on', location.href);
})();
