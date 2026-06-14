// ============================================================
// Hermes YouTube Summarizer — Popup Script
// Settings management and connection testing
// ============================================================

const STORAGE_KEY = 'hermes_youtube_settings';

// --- DOM refs ---
const apiUrlInput = document.getElementById('apiUrl');
const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const statusMsg = document.getElementById('statusMsg');

// --- Load saved settings ---
(async function loadSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const settings = result[STORAGE_KEY] || {
    apiUrl: 'http://127.0.0.1:8642',
    apiKey: 'hermes-youtube-summarizer'
  };
  apiUrlInput.value = settings.apiUrl;
  apiKeyInput.value = settings.apiKey;
})();

// --- Save ---
saveBtn.addEventListener('click', async () => {
  const settings = {
    apiUrl: apiUrlInput.value.trim() || 'http://127.0.0.1:8642',
    apiKey: apiKeyInput.value.trim() || ''
  };

  if (!settings.apiKey) {
    showStatus('请输入 API 密钥', 'error');
    return;
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
  showStatus('配置已保存 ✅', 'success');
});

// --- Test Connection ---
testBtn.addEventListener('click', async () => {
  const settings = {
    apiUrl: apiUrlInput.value.trim() || 'http://127.0.0.1:8642',
    apiKey: apiKeyInput.value.trim() || ''
  };

  testBtn.disabled = true;
  testBtn.innerHTML = '<span class="spinner"></span> 测试中...';
  showStatus('正在连接 Hermes API Server...', 'info');

  try {
    const result = await chrome.runtime.sendMessage({
      action: 'testConnection',
      settings
    });

    if (result?.success) {
      showStatus('✅ 连接成功！Hermes API Server 正在运行', 'success');
    } else {
      showStatus(`❌ ${result?.error || '连接失败'}`, 'error');
    }
  } catch (err) {
    showStatus(`❌ 发送消息失败: ${err.message}`, 'error');
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = '测试连接';
  }
});

// --- Status helper ---
function showStatus(msg, type) {
  statusMsg.className = `status status-${type}`;
  statusMsg.textContent = msg;
  statusMsg.style.display = 'block';
}

// --- Auto-save on input change ---
let saveTimer;
function autoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const settings = {
      apiUrl: apiUrlInput.value.trim() || 'http://127.0.0.1:8642',
      apiKey: apiKeyInput.value.trim() || ''
    };
    if (settings.apiKey) {
      await chrome.storage.local.set({ [STORAGE_KEY]: settings });
    }
  }, 800);
}

apiUrlInput.addEventListener('input', autoSave);
apiKeyInput.addEventListener('input', autoSave);
