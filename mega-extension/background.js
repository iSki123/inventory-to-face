// Salesonator Mega Extension - Background script
// Combines auth bridge (SSO from web app), scraping ingestion, image proxy, and FB posting helpers

const SUPABASE_PROJECT_REF = 'urdkaedsfnscgtyvcwlf';
const SUPABASE_BASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;
const EDGE_FN = {
  SCRAPE_VEHICLE: `${SUPABASE_BASE_URL}/functions/v1/scrape-vehicle`,
  FACEBOOK_POSTER: `${SUPABASE_BASE_URL}/functions/v1/facebook-poster`,
  IMAGE_PROXY: `${SUPABASE_BASE_URL}/functions/v1/image-proxy`,
  VERIFY_ADMIN: `${SUPABASE_BASE_URL}/functions/v1/verify-admin`,
};

class SalesonatorMegaBackground {
  constructor(){
    this.settings = {
      useReverseEng: false,
      requireAdmin: false, // If true, we try to verify admin role during SSO; falls back gracefully
      webAppOrigin: '', // Optional override, otherwise we scan common origins
    };
    this.init();
  }

  init(){
    chrome.runtime.onInstalled.addListener((details)=>this.onInstalled(details));
    chrome.runtime.onMessage.addListener((req, sender, sendResponse)=>this.onMessage(req, sender, sendResponse));
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab)=>this.onTabUpdated(tabId, changeInfo, tab));
  }

  async onInstalled(details){
    const { settings } = await chrome.storage.sync.get({ settings: this.settings });
    await chrome.storage.sync.set({ settings: { ...this.settings, ...settings }});
  }

  async onTabUpdated(tabId, changeInfo, tab){
    try{
      if(!changeInfo.status || changeInfo.status !== 'complete') return;
      const isFB = (tab?.url||'').includes('facebook.com/marketplace');
      chrome.action.setBadgeText({ tabId, text: isFB ? 'FB' : '' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: isFB ? '#0B81FF' : '#999' });
    }catch(e){ /* noop */ }
  }

  async onMessage(request, sender, sendResponse){
    const action = request?.action;
    try{
      switch(action){
        case 'getSettings':
          chrome.storage.sync.get({ settings: this.settings }).then(sendResponse);
          return true;
        case 'setSettings':
          await chrome.storage.sync.set({ settings: { ...this.settings, ...(request?.settings||{}) }});
          sendResponse({ ok: true });
          return;

        case 'ssoLogin':
          this.handleSSOLogin().then(sendResponse);
          return true;
        case 'logout':
          await chrome.storage.local.remove(['userToken','userInfo']);
          sendResponse({ ok: true });
          return;
        case 'isAuthenticated':
          const token = await this.getUserToken();
          sendResponse({ ok: !!token });
          return;
        case 'getUser':
          const info = await this.getUserInfo();
          sendResponse({ ok: !!info, user: info||null});
          return;

        case 'scrapedInventory':
          this.ingestScrapedInventory(request?.vehicles||[], request?.source||'unknown').then(sendResponse);
          return true;

        case 'get_pending_vehicles':
          this.getPendingVehicles().then(sendResponse);
          return true;
        case 'update_vehicle_status':
          this.updateVehicleStatus(request?.vehicleId, request?.status, request?.facebookPostId).then(sendResponse);
          return true;

        case 'fetchImageViaProxy':
          this.fetchImageViaProxy(request?.url).then(sendResponse);
          return true;

        default:
          sendResponse({ ok:false, error: 'Unknown action' });
      }
    }catch(err){
      console.error('[MEGA BG] onMessage error', err);
      sendResponse({ ok:false, error: String(err) });
    }
  }

  async getUserToken(){
    const { userToken } = await chrome.storage.local.get('userToken');
    return userToken||null;
  }
  async getUserInfo(){
    const { userInfo } = await chrome.storage.local.get('userInfo');
    return userInfo||null;
  }

  async handleSSOLogin(){
    // Try to find an open tab of the Salesonator web app and extract Supabase auth token from localStorage
    const { settings } = await chrome.storage.sync.get({ settings: this.settings });
    const candidateOrigins = [settings.webAppOrigin].filter(Boolean).concat([
      'https://*.lovable.app',
      'https://*.lovableproject.com',
      'http://localhost:8080',
      'http://localhost:3000',
    ]);

    const tabs = await chrome.tabs.query({});
    for(const tab of tabs){
      const url = tab.url || '';
      if(!url) continue;
      const matches = candidateOrigins.some(originLike => {
        const base = originLike.replace('*.', '');
        return url.startsWith(base);
      });
      if(!matches) continue;

      try{
        const [{ result } = {}] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const KEY = 'sb-urdkaedsfnscgtyvcwlf-auth-token';
            try {
              const raw = localStorage.getItem(KEY);
              if(!raw) return { ok:false, reason: 'no_localstorage_token' };
              const data = JSON.parse(raw);
              const token = data?.currentSession?.access_token || data?.access_token || data?.session?.access_token || null;
              const user = data?.currentSession?.user || data?.user || null;
              return { ok: !!token, token, user };
            } catch (e) {
              return { ok:false, error: String(e) };
            }
          }
        });

        if(result?.ok && result?.token){
          const { settings } = await chrome.storage.sync.get({ settings: this.settings });
          if (settings.requireAdmin) {
            try {
              const res = await fetch(EDGE_FN.VERIFY_ADMIN, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${result.token}` },
              });
              const data = await res.json().catch(()=>({}));
              if (!res.ok || !data?.is_admin) {
                return { ok:false, error: 'admin_required' };
              }
            } catch (e) {
              return { ok:false, error: 'admin_check_failed' };
            }
          }
          let userInfo = result.user || null;
          await chrome.storage.local.set({ userToken: result.token, userInfo });
          return { ok:true, user: userInfo };
        }
      }catch(e){
        // continue searching
      }
    }
    return { ok:false, error: 'No authenticated Salesonator tab found' };
  }

  async ingestScrapedInventory(vehicles, source){
    try{
      const token = await this.getUserToken();
      const res = await fetch(EDGE_FN.SCRAPE_VEHICLE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ source, vehicles }),
      });
      const data = await res.json().catch(()=>({}));
      return { ok: res.ok, status: res.status, data };
    } catch (e){
      console.error('[MEGA BG] ingestScrapedInventory error', e);
      return { ok:false, error: String(e) };
    }
  }

  async getPendingVehicles(){
    try{
      const token = await this.getUserToken();
      if(!token) return { ok:false, error: 'not_authenticated' };
      const res = await fetch(EDGE_FN.FACEBOOK_POSTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'get_pending_vehicles' }),
      });
      const data = await res.json().catch(()=>({}));
      return { ok: res.ok, status: res.status, data };
    }catch(e){
      console.error('[MEGA BG] getPendingVehicles error', e);
      return { ok:false, error: String(e) };
    }
  }

  async updateVehicleStatus(vehicleId, status, facebookPostId){
    try{
      const token = await this.getUserToken();
      if(!token) return { ok:false, error: 'not_authenticated' };
      const res = await fetch(EDGE_FN.FACEBOOK_POSTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'update_vehicle_status', vehicleId, status, facebookPostId }),
      });
      const data = await res.json().catch(()=>({}));
      return { ok: res.ok, status: res.status, data };
    }catch(e){
      console.error('[MEGA BG] updateVehicleStatus error', e);
      return { ok:false, error: String(e) };
    }
  }

  async fetchImageViaProxy(url){
    try{
      const res = await fetch(`${EDGE_FN.IMAGE_PROXY}?url=${encodeURIComponent(url)}`);
      const blob = await res.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      return { ok:true, data: base64 };
    }catch(e){
      console.error('[MEGA BG] fetchImageViaProxy error', e);
      return { ok:false, error: String(e) };
    }
  }
}

// Initialize
(() => new SalesonatorMegaBackground())();
