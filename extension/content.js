// ============================================================
// Hermes YouTube Summarizer — Content Script
// Injects a floating "总结" button on YouTube video pages
// ============================================================

(() => {
  'use strict';

  const STORAGE_KEY = 'hermes_youtube_settings';

  // --- UI Creation ---

  function createButton() {
    const btn = document.createElement('button');
    btn.id = 'hermes-summarize-btn';
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <span>总结</span>
    `;
    btn.title = '通过 Hermes Agent 总结此视频';
    return btn;
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'hermes-summary-panel';
    panel.innerHTML = `
      <div id="hermes-summary-header">
        <span id="hermes-summary-title">Hermes 总结</span>
        <button id="hermes-summary-close">&times;</button>
      </div>
      <div id="hermes-summary-body">
        <div id="hermes-summary-loading">
          <div class="hermes-spinner"></div>
          <p>正在分析视频...</p>
        </div>
        <div id="hermes-summary-content" style="display:none;"></div>
        <div id="hermes-summary-error" style="display:none;"></div>
      </div>
    `;
    return panel;
  }

  function createToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `hermes-toast hermes-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // --- Styles ---

  const styles = `
    #hermes-summarize-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      margin: 8px 0 4px 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      border: none;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
      z-index: 9999;
    }
    #hermes-summarize-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.6);
    }
    #hermes-summarize-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    #hermes-summarize-btn svg {
      flex-shrink: 0;
    }

    #hermes-summary-panel {
      position: fixed;
      top: 80px;
      right: 24px;
      width: 420px;
      max-height: calc(100vh - 160px);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: hermes-slideIn 0.3s ease-out;
    }
    @keyframes hermes-slideIn {
      from { transform: translateX(30px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    #hermes-summary-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      font-size: 15px;
      font-weight: 600;
    }
    #hermes-summary-close {
      background: none;
      border: none;
      color: #fff;
      font-size: 22px;
      cursor: pointer;
      opacity: 0.8;
      padding: 0 4px;
      line-height: 1;
    }
    #hermes-summary-close:hover { opacity: 1; }

    #hermes-summary-body {
      padding: 18px;
      overflow-y: auto;
      flex: 1;
    }

    #hermes-summary-loading {
      text-align: center;
      padding: 30px 0;
      color: #666;
    }
    .hermes-spinner {
      width: 36px;
      height: 36px;
      border: 3px solid #e0e0e0;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      margin: 0 auto 12px;
      animation: hermes-spin 0.8s linear infinite;
    }
    @keyframes hermes-spin {
      to { transform: rotate(360deg); }
    }

    #hermes-summary-content {
      line-height: 1.7;
      color: #222;
      font-size: 14px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    #hermes-summary-content h1,
    #hermes-summary-content h2,
    #hermes-summary-content h3 {
      margin-top: 16px;
      margin-bottom: 8px;
      color: #333;
    }
    #hermes-summary-content h2 { font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    #hermes-summary-content h3 { font-size: 14px; }
    #hermes-summary-content ul { padding-left: 20px; }
    #hermes-summary-content li { margin-bottom: 4px; }
    #hermes-summary-content strong { color: #111; }

    #hermes-summary-error {
      color: #d32f2f;
      padding: 12px;
      background: #fce4ec;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.5;
    }

    .hermes-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      z-index: 2147483647;
      animation: hermes-slideIn 0.3s ease-out;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .hermes-toast-error { background: #d32f2f; color: #fff; }
    .hermes-toast-success { background: #388e3c; color: #fff; }
    .hermes-toast-info { background: #1976d2; color: #fff; }

    @media (prefers-color-scheme: dark) {
      #hermes-summary-panel {
        background: #1e1e1e;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      }
      #hermes-summary-body { color: #ddd; }
      #hermes-summary-content { color: #ccc; }
      #hermes-summary-content strong { color: #fff; }
      #hermes-summary-content h1,
      #hermes-summary-content h2,
      #hermes-summary-content h3 { color: #eee; }
      #hermes-summary-content h2 { border-bottom-color: #333; }
      .hermes-spinner { border-color: #444; border-top-color: #667eea; }
      #hermes-summary-loading { color: #999; }
    }
  `;

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = styles;
    document.head.appendChild(style);
  }

  // --- Core Logic ---

  function getVideoInfo() {
    const url = new URL(window.location.href);
    const v = url.searchParams.get('v');
    if (!v) return null;

    // YouTube 2024+ DOM: title is in #above-the-fold > #title
    const titleEl = document.querySelector('#above-the-fold #title');
    const title = titleEl ? titleEl.textContent.trim() : document.title.replace(' - YouTube', '').trim();

    // Channel name
    const ownerEl = document.querySelector('#owner');
    const channel = ownerEl ? ownerEl.textContent.trim() : '';

    return {
      id: v,
      url: `https://www.youtube.com/watch?v=${v}`,
      title,
      channel
    };
  }

  async function callHermesAPI(videoInfo) {
    // Read settings from storage
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const settings = result[STORAGE_KEY];
    if (!settings?.apiUrl || !settings?.apiKey) {
      throw new Error('请先在扩展弹窗中配置 Hermes API 地址和密钥');
    }

    const url = `${settings.apiUrl.replace(/\/+$/, '')}/v1/chat/completions`;

    const systemPrompt = `你是一个专业的 YouTube 视频总结助手。

## 你的任务
用户会给你一个 YouTube 视频链接，你需要：
1. 获取该视频的字幕/转录文本
2. 分析内容并生成一份详细、结构化的总结报告

## 如何获取字幕
使用 python3 运行以下命令获取字幕：
\`\`\`bash
python3 /Users/alexmac/.hermes/skills/media/youtube-content/scripts/fetch_transcript.py "视频URL" --text-only --timestamps
\`\`\`

如果上述脚本不存在，则尝试：
\`\`\`bash
python3 -c "from youtube_transcript_api import get_transcript; t=get_transcript('VIDEO_ID'); [print(f'{s[\\"start\\"]:.0f}s: {s[\\"text\\"]}') for s in t]"
\`\`\`

如果字幕无法获取，则用 web_search 或 web_extract 获取视频描述和评论作为替代。

## 总结格式
请使用中文（简体）输出，格式如下：

### 📋 视频概览
- 标题：[视频标题]
- 频道/类型：[简要描述]

### 🎯 核心要点
- 按时间顺序列出主要内容，每条附上时间戳
- 每个要点用 **粗体** 标注主题

### 💡 关键观点/论据
- 列出视频中最重要的观点或论据

### 📝 详细内容
- 按章节或主题分段，每段附时间戳

### 🔑 一句话总结
- 用一句话概括整个视频的核心信息

请确保总结全面、准确、有深度。`;

    const userMessage = `请详细总结这个 YouTube 视频：

标题：${videoInfo.title}
${videoInfo.channel ? `频道：${videoInfo.channel}` : ''}
链接：${videoInfo.url}`;

    console.log('[Hermes] Fetching:', url);

    // AbortController for timeout (3 minutes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'hermes',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    console.log('[Hermes] Status:', response.status, 'Content-Length:', response.headers.get('content-length'));

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try { const err = await response.json(); errMsg = err.error?.message || errMsg; } catch {}
      throw new Error(`Hermes API 请求失败: ${errMsg}`);
    }

    console.time('[Hermes] Parse response');
    const data = await response.json();
    console.timeEnd('[Hermes] Parse response');

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Hermes 返回为空');
    console.log('[Hermes] Summary length:', content.length, 'chars');
    return content;
  }

  async function handleSummarize() {
    const videoInfo = getVideoInfo();
    if (!videoInfo) {
      createToast('未检测到 YouTube 视频', 'error');
      return;
    }

    // 1. Show panel IMMEDIATELY — before any async operation
    let panel = document.getElementById('hermes-summary-panel');
    if (panel) panel.remove();

    panel = createPanel();
    document.body.appendChild(panel);

    const btn = document.getElementById('hermes-summarize-btn');
    if (btn) btn.disabled = true;

    const loadingEl = document.getElementById('hermes-summary-loading');
    const contentEl = document.getElementById('hermes-summary-content');
    const errorEl = document.getElementById('hermes-summary-error');

    // Close handler
    document.getElementById('hermes-summary-close').onclick = () => {
      panel.remove();
      if (btn) btn.disabled = false;
    };

    // 2. Now do async work
    try {
      const summary = await callHermesAPI(videoInfo);
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      contentEl.textContent = summary;
      createToast('总结完成 ✅', 'success');
    } catch (err) {
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
      errorEl.textContent = err.message;
      console.error('[Hermes Summarizer]', err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // --- Inject Button ---

  function injectButton() {
    if (document.getElementById('hermes-summarize-btn')) return;
    if (!getVideoInfo()) return;

    const btn = createButton();
    btn.addEventListener('click', handleSummarize);

    let placed = false;

    // Strategy 1: Insert into #above-the-fold after #bottom-row (2024+ YouTube)
    const aboveFold = document.querySelector('#above-the-fold');
    if (aboveFold) {
      const bottomRow = aboveFold.querySelector('#bottom-row');
      if (bottomRow) {
        aboveFold.insertBefore(btn, bottomRow.nextSibling);
        placed = true;
      } else {
        // Fallback: append to above-the-fold
        aboveFold.appendChild(btn);
        placed = true;
      }
    }

    // Strategy 2: Insert after ytd-video-primary-info-renderer (older YouTube)
    if (!placed) {
      const primaryInfo = document.querySelector('ytd-video-primary-info-renderer');
      if (primaryInfo && primaryInfo.parentElement) {
        primaryInfo.parentElement.insertBefore(btn, primaryInfo.nextSibling);
        placed = true;
      }
    }

    // Strategy 3: Insert after the video player
    if (!placed) {
      const player = document.querySelector('#movie_player, #player-container, #player');
      if (player && player.parentElement) {
        player.parentElement.insertBefore(btn, player.nextSibling);
        placed = true;
      }
    }

    // Strategy 4: Last resort — before the comments section
    if (!placed) {
      const comments = document.querySelector('#comments, ytd-comments');
      if (comments && comments.parentElement) {
        comments.parentElement.insertBefore(btn, comments);
      }
    }
  }

  // --- Watch for YouTube navigation (SPA) ---

  function observePageChanges() {
    // YouTube is a SPA — observe URL changes
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        // Remove old elements
        document.getElementById('hermes-summarize-btn')?.remove();
        document.getElementById('hermes-summary-panel')?.remove();
        // Re-inject after a short delay for page render
        setTimeout(injectButton, 1500);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // --- Init ---

  function init() {
    injectStyles();
    injectButton();
    observePageChanges();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
