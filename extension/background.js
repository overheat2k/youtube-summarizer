// ============================================================
// Hermes YouTube Summarizer — Background Service Worker
// Handles API calls to Hermes Agent
// ============================================================

const STORAGE_KEY = 'hermes_youtube_settings';

// Default settings
const DEFAULT_SETTINGS = {
  apiUrl: 'http://127.0.0.1:8642',
  apiKey: 'hermes-youtube-summarizer'
};

// --- Settings ---

chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  if (!result[STORAGE_KEY]) {
    await chrome.storage.local.set({
      [STORAGE_KEY]: DEFAULT_SETTINGS
    });
    console.log('[Hermes Summarizer] Default settings initialized');
  }
});

// --- On-connect test handler (from popup) ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'testConnection') {
    testHermesConnection(message.settings || DEFAULT_SETTINGS)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }
});

// --- Connection Test ---

async function testHermesConnection(settings) {
  const url = `${settings.apiUrl.replace(/\/+$/, '')}/health`;
  try {
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`
      }
    });
    if (resp.ok) {
      const data = await resp.json();
      return { success: true, data };
    } else {
      const text = await resp.text();
      return {
        success: false,
        error: `HTTP ${resp.status}: ${text.slice(0, 200)}`
      };
    }
  } catch (err) {
    return {
      success: false,
      error: `无法连接到 ${url}: ${err.message}`
    };
  }
}
