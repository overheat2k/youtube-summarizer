// ============================================================
// Hermes YouTube Summarizer — Popup Script
// Settings: server URL, API key, model
// ============================================================

const STORAGE_KEY = 'hermes_youtube_settings';

const apiUrlInput = document.getElementById('serverUrl');
const apiKeyInput = document.getElementById('apiKey');
const modelNameInput = document.getElementById('modelName');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const statusMsg = document.getElementById('statusMsg');

// --- Load saved settings ---
(async function loadSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const s = result[STORAGE_KEY] || {};
  apiUrlInput.value = s.serverUrl || 'http://127.0.0.1:8643';
  apiKeyInput.value = s.apiKey || '';
  modelNameInput.value = s.model || 'openrouter/openai/gpt-4o-mini';
})();

function getSettings() {
  return {
    serverUrl: apiUrlInput.value.trim() || 'http://127.0.0.1:8643',
    apiKey: apiKeyInput.value.trim() || '',
    model: modelNameInput.value.trim() || 'openrouter/openai/gpt-4o-mini'
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
    setStatus('请输入 API 密钥', 'error');
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: s });
  setStatus('配置已保存 ✅', 'success');
});

// --- Test Connection ---
testBtn.addEventListener('click', async () => {
  const s = getSettings();
  testBtn.disabled = true;
  testBtn.innerHTML = '<span class="spinner"></span> 测试中...';
  setStatus('正在连接总结服务器...', 'info');

  try {
    const resp = await fetch(`${s.serverUrl}/health`, { signal: AbortSignal.timeout(5000) });
    if (resp.ok) {
      const data = await resp.json();
      setStatus(`✅ ${data.version || 'v1'} 服务器运行正常`, 'success');
    } else {
      setStatus(`❌ HTTP ${resp.status}`, 'error');
    }
  } catch (err) {
    setStatus(`❌ 无法连接 ${s.serverUrl}: ${err.message}`, 'error');
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

apiUrlInput.addEventListener('input', autoSave);
apiKeyInput.addEventListener('input', autoSave);
modelNameInput.addEventListener('input', autoSave);
