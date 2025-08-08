// Salesonator Mega Extension - Popup UI logic

const logEl = document.getElementById('log');
const authEl = document.getElementById('auth-status');
const btnSSO = document.getElementById('sso');
const btnFetch = document.getElementById('fetch');
const btnStart = document.getElementById('start');
const chkReverseEng = document.getElementById('useReverseEng');
const chkRequireAdmin = document.getElementById('requireAdmin');
const originInput = document.getElementById('origin');

function log(msg){
  console.log('[MEGA POPUP]', msg);
  logEl.textContent = `${new Date().toLocaleTimeString()} ${msg}\n` + logEl.textContent;
}

function sendBG(action, payload={}){
  return new Promise(res=> chrome.runtime.sendMessage({ action, ...payload }, res));
}

async function refreshAuth(){
  const { ok } = await sendBG('isAuthenticated');
  authEl.textContent = ok ? 'Authenticated' : 'Not authenticated';
  authEl.style.color = ok ? '#0a0' : '#a00';
}

async function loadSettings(){
  const { settings } = await sendBG('getSettings');
  chkReverseEng.checked = !!settings.useReverseEng;
  chkRequireAdmin.checked = !!settings.requireAdmin;
  originInput.value = settings.webAppOrigin || '';
}

async function saveSettings(){
  await sendBG('setSettings', { settings: {
    useReverseEng: chkReverseEng.checked,
    requireAdmin: chkRequireAdmin.checked,
    webAppOrigin: originInput.value.trim(),
  }});
  log('Settings saved');
}

btnSSO.addEventListener('click', async ()=>{
  log('Attempting SSO login…');
  const res = await sendBG('ssoLogin');
  if(res?.ok){
    log('SSO success');
  } else if (res?.error === 'admin_required') {
    log('SSO failed: Admin required. Log into Salesonator as an admin.');
  } else {
    log('SSO failed: ' + (res?.error||'unknown'));
  }
  await refreshAuth();
});

[chkReverseEng, chkRequireAdmin, originInput].forEach(el=>{
  el.addEventListener('change', saveSettings);
});

btnFetch.addEventListener('click', async ()=>{
  log('Fetching pending vehicles…');
  const res = await sendBG('get_pending_vehicles');
  if(res?.ok){
    const count = Array.isArray(res.data?.vehicles) ? res.data.vehicles.length : (res.data?.length||0);
    log(`Fetched ${count} vehicles.`);
  } else {
    log('Fetch failed: ' + (res?.error||res?.status));
  }
});

btnStart.addEventListener('click', async ()=>{
  log('Starting posting flow… Open FB create listing tab.');
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  if(!tab){ log('No active tab'); return; }
  const res = await sendBG('get_pending_vehicles');
  const vehicles = res?.data?.vehicles || res?.data || [];
  if(!vehicles.length){ log('No vehicles to post.'); return; }
  let idx = 0;
  const postNext = async () => {
    const v = vehicles[idx++];
    log(`Posting ${idx}/${vehicles.length}: ${v?.year||''} ${v?.make||''} ${v?.model||''}`);
    chrome.tabs.sendMessage(tab.id, { action: 'postVehicleToFacebook', vehicle: v }, async (resp)=>{
      if(resp?.ok){
        log('Posted form fields. Marking status…');
        await sendBG('update_vehicle_status', { vehicleId: v.id, status: 'posted', facebookPostId: null });
      } else {
        log('Posting failed for this vehicle: ' + (resp?.error||'unknown'));
        await sendBG('update_vehicle_status', { vehicleId: v.id, status: 'error' });
      }
      if(idx < vehicles.length) setTimeout(postNext, 1200);
      else log('Posting flow complete.');
    });
  };
  postNext();
});

(async function init(){
  await loadSettings();
  await refreshAuth();
})();
