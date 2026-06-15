// ============================================================
// Hermes YouTube Summarizer — Popup Script
// Settings: API base URL, API key, model
// ============================================================

const STORAGE_KEY = 'hermes_youtube_settings';

const apiBaseUrlInput = document.getElementById('apiBaseUrl');
const apiKeyInput = document.getElementById('apiKey');
const modelNameInput = document.getElementById('modelName');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const statusMsg = document.getElementById('statusMsg');

const DEFAULTS = {
  apiBaseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-v4-flash'
};

// --- Load ---
(async function load() {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  const s = r[STORAGE_KEY] || {};
  apiBaseUrlInput.value = s.apiBaseUrl || DEFAULTS.apiBaseUrl;
  apiKeyInput.value = s.apiKey || '';
  modelNameInput.value = s.model || DEFAULTS.model;
})();

function getSettings() {
  return {
    apiBaseUrl: apiBaseUrlInput.value.trim() || DEFAULTS.apiBaseUrl,
    apiKey: apiKeyInput.value.trim() || '',
    model: modelNameInput.value.trim() || DEFAULTS.model
  };
}

function setStatus(msg, type) {
  statusMsg.className = `status status-${type}`;
  statusMsg.textContent = msg;
  statusMsg.style.display = 'block';
}

// --- Save ---
saveBtn.addEventListener('click', async () => {
  const s = getSettings();
  if (!s.apiKey) {
    setStatus('请输入 API Key', 'error');
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: s });
  setStatus('配置已保存 ✅', 'success');
});

// --- Test ---
testBtn.addEventListener('click', async () => {
  const s = getSettings();
  testBtn.disabled = true;
  testBtn.innerHTML = '<span class="spinner"></span> 测试中...';
  setStatus('正在测试 AI 连接...', 'info');

  // Step 1: check local server
  try {
    const resp = await fetch('http://127.0.0.1:8643/health', { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) {
      setStatus('❌ 本地服务器 (端口 8643) 未运行', 'error');
      testBtn.disabled = false;
      testBtn.textContent = '测试连接';
      return;
    }
  } catch {
    setStatus('❌ 无法连接本地服务器 (端口 8643)', 'error');
    testBtn.disabled = false;
    testBtn.textContent = '测试连接';
    return;
  }

  // Step 2: test AI API with a simple request
  if (!s.apiKey) {
    setStatus('❌ 请填写 API Key', 'error');
    testBtn.disabled = false;
    testBtn.textContent = '测试连接';
    return;
  }

  try {
    const baseUrl = (s.apiBaseUrl || DEFAULTS.apiBaseUrl).replace(/\/+$/, '');
    const apiUrl = `${baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${s.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: s.model || 'deepseek-v4-flash',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    if (resp.ok) {
      setStatus('✅ 本地服务器 + AI 连接均正常', 'success');
    } else {
      let msg = `HTTP ${resp.status}`;
      try { const e = await resp.json(); msg = e.error?.message || msg; } catch {}
      setStatus(`❌ AI 接口返回错误: ${msg}`, 'error');
    }
  } catch (err) {
    setStatus(`❌ AI 连接失败: ${err.message}`, 'error');
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = '测试连接';
  }
});

// --- Auto-save ---
let saveTimer;
function autoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const s = getSettings();
    if (s.apiKey) await chrome.storage.local.set({ [STORAGE_KEY]: s });
  }, 800);
}

apiBaseUrlInput.addEventListener('input', autoSave);
apiKeyInput.addEventListener('input', autoSave);
modelNameInput.addEventListener('input', autoSave);
