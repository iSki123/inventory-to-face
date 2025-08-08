// Helper to inject reverseeng vendor scripts when enabled
// NOTE: We intentionally skip Marketplace.* on the create page to avoid conflicts with our own poster
export async function maybeInjectReverseEng(tabId: number, url: string, useReverseEng: boolean) {
  if (!useReverseEng) return;
  const isFacebook = /https?:\/\/(www\.|web\.)?facebook\.com\//.test(url);
  if (!isFacebook) return;

  const exec = async (files: string[]) => {
    for (const file of files) {
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: [file] });
      } catch (e) {
        // best-effort
        console.warn('[MEGA RE] inject fail', file, e);
      }
    }
  };

  const insertCss = async (files: string[]) => {
    for (const file of files) {
      try {
        await chrome.scripting.insertCSS({ target: { tabId }, files: [file] });
      } catch (e) {
        console.warn('[MEGA RE] css fail', file, e);
      }
    }
  };

  const base = 'reverseeng/';
  const common = [
    base + 'SiteDetails.f06f1b91.js',
    base + 'contents.04ff201a.js',
    base + 'dataScript.a2ba678e.js',
    base + 'facebook.40dee27c.js',
    base + 'group.2c67bb9f.js',
    base + 'GroupButton.b5166602.js',
    base + 'ProfileButton.24b749fa.js'
  ];

  const isCreate = /facebook\.com\/marketplace\/create\//.test(url);
  const maybeMarketplace = isCreate ? [] : [base + 'Marketplace.3864bf7a.js'];

  await insertCss([base + 'sidepanel.df89bfed.css']);
  await exec([...common, ...maybeMarketplace]);
}
