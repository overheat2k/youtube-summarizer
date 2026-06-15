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
        <span id="hermes-summary-title">✧ Hermes 总结</span>
        <div class="hermes-header-actions">
          <button id="hermes-summary-copy" title="复制总结内容">📋</button>
          <button id="hermes-summary-close">&times;</button>
        </div>
      </div>
      <div id="hermes-summary-body">
        <div id="hermes-summary-loading">
          <div class="hermes-spinner"></div>
          <p>正在分析视频...</p>
          <p class="hermes-loading-hint">长视频可能需要 2-3 分钟</p>
        </div>
        <div id="hermes-summary-content" style="display:none;"></div>
        <div id="hermes-summary-error" style="display:none;"></div>
      </div>
      <div id="hermes-summary-resize-handle">↘</div>
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

  // --- Drag & Resize ---

  function makeDraggable(panel) {
    const header = panel.querySelector('#hermes-summary-header');
    let isDragging = false;
    let startX, startY, origLeft, origTop;

    function onStart(e) {
      // Only drag on header, not on buttons
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      isDragging = true;
      panel.classList.add('hermes-dragging');

      const rect = panel.getBoundingClientRect();
      // Convert fixed position to left/top
      origLeft = rect.left;
      origTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;

      // Remove right/bottom, use left/top
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.left = origLeft + 'px';
      panel.style.top = origTop + 'px';

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
    }

    function onMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = (origLeft + dx) + 'px';
      panel.style.top = (origTop + dy) + 'px';
    }

    function onEnd() {
      isDragging = false;
      panel.classList.remove('hermes-dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
    }

    header.addEventListener('mousedown', onStart);
  }

  function setupPanelInteractions(panel) {
    // Drag
    makeDraggable(panel);

    // Copy summary
    const copyBtn = panel.querySelector('#hermes-summary-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const content = panel.querySelector('#hermes-summary-content');
        if (!content || content.style.display === 'none') return;
        const text = content.textContent;
        navigator.clipboard.writeText(text).then(() => {
          createToast('已复制到剪贴板 ✅', 'success');
        }).catch(() => {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          createToast('已复制到剪贴板 ✅', 'success');
        });
      });
    }
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
      max-width: 90vw;
      min-width: 280px;
      max-height: calc(100vh - 40px);
      min-height: 200px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: hermes-slideIn 0.3s ease-out;
      resize: both;
    }
    #hermes-summary-panel.hermes-dragging {
      user-select: none;
      opacity: 0.95;
      transition: none;
      animation: none;
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
      cursor: grab;
    }
    #hermes-summary-header:active { cursor: grabbing; }
    .hermes-header-actions {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .hermes-header-actions button {
      background: none;
      border: none;
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      opacity: 0.8;
      padding: 0 6px;
      line-height: 1;
      border-radius: 4px;
      transition: background 0.15s;
    }
    .hermes-header-actions button:hover {
      opacity: 1;
      background: rgba(255,255,255,0.15);
    }
    #hermes-summary-close { font-size: 22px; }

    #hermes-summary-body {
      padding: 18px;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
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
    .hermes-loading-hint {
      font-size: 12px;
      color: #999;
      margin-top: 8px;
    }

    #hermes-summary-content {
      line-height: 1.7;
      color: #222;
      font-size: 14px;
      white-space: normal;
      word-wrap: break-word;
    }
    #hermes-summary-content h1 {
      font-size: 18px;
      margin: 16px 0 8px;
      color: #333;
      border-bottom: 2px solid #667eea;
      padding-bottom: 4px;
    }
    #hermes-summary-content h2 {
      font-size: 16px;
      margin: 14px 0 6px;
      color: #444;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 3px;
    }
    #hermes-summary-content h3 {
      font-size: 15px;
      margin: 12px 0 4px;
      color: #555;
    }
    #hermes-summary-content p {
      margin: 6px 0;
    }
    #hermes-summary-content ul {
      padding-left: 20px;
      margin: 6px 0;
    }
    #hermes-summary-content li {
      margin-bottom: 3px;
    }
    #hermes-summary-content strong {
      color: #111;
    }
    #hermes-summary-content code {
      background: #f0f0f0;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 12px;
      font-family: 'SF Mono', Menlo, monospace;
    }
    #hermes-summary-content pre {
      background: #f5f5f5;
      padding: 10px 14px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 12px;
      line-height: 1.5;
      margin: 8px 0;
    }
    #hermes-summary-content pre code {
      background: none;
      padding: 0;
    }
    #hermes-summary-content hr {
      border: none;
      border-top: 1px solid #e0e0e0;
      margin: 12px 0;
    }

    #hermes-summary-error {
      color: #d32f2f;
      padding: 12px;
      background: #fce4ec;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.5;
    }

    #hermes-summary-resize-handle {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 24px;
      height: 24px;
      font-size: 12px;
      color: #aaa;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 2px;
      cursor: nwse-resize;
      pointer-events: auto;
      z-index: 1;
    }
    #hermes-summary-resize-handle:hover { color: #667eea; }

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
      #hermes-summary-content h1 { border-bottom-color: #667eea; }
      #hermes-summary-content h2 { border-bottom-color: #444; }
      #hermes-summary-content code { background: #2d2d2d; }
      #hermes-summary-content pre { background: #2a2a2a; }
      #hermes-summary-content hr { border-top-color: #444; }
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

  // --- Lightweight Markdown Renderer ---

  function renderMarkdown(text) {
    // Escape HTML first
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks (```...```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline code (`code`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers (### then ## then #)
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Line breaks (double newline = paragraph)
    html = html.replace(/\n\n/g, '</p><p>');

    // Single line breaks
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph if not starting with block element
    if (!html.startsWith('<h') && !html.startsWith('<p') && !html.startsWith('<ul') && !html.startsWith('<pre')) {
      html = '<p>' + html + '</p>';
    }

    // Clean up nested paragraphs from list items
    html = html.replace(/<li><p>/g, '<li>');
    html = html.replace(/<\/p><\/li>/g, '</li>');
    html = html.replace(/<\/li><br>/g, '</li>');

    return html;
  }

  async function summarizeVideo(videoInfo) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const settings = result[STORAGE_KEY];
    if (!settings?.apiKey) throw new Error('请先在扩展弹窗中配置 API 密钥');

    const model = settings.model || 'openrouter/openai/gpt-4o-mini';
    const serverUrl = settings.serverUrl || 'http://127.0.0.1:8643';

    // Strategy 1: Use the standalone /summarize endpoint (no Hermes needed)
    try {
      const resp = await fetch(`${serverUrl}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: videoInfo.id,
          apiKey: settings.apiKey,
          model: model,
        }),
        signal: AbortSignal.timeout(300000)
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.summary) {
          console.log('[Hermes] Standalone mode, model:', data.model);
          return data.summary;
        }
      }
      // If server returns error, fall through
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${resp.status}`);
    } catch (err) {
      // Strategy 2: Fallback — transcript + Hermes API
      console.log('[Hermes] Standalone failed, trying Hermes mode:', err.message);
      return await summarizeWithHermes(videoInfo, settings);
    }
  }

  async function summarizeWithHermes(videoInfo, settings) {
    const url = `${settings.apiUrl.replace(/\/+$/, '')}/v1/chat/completions`;
    const model = settings.model || 'hermes';

    const systemPrompt = 'You are a YouTube video summarizer. Provide detailed structured summaries in Chinese (Simplified).';

    const userMessage = `Please summarize this YouTube video transcript in Chinese.

Title: ${videoInfo.title}
${videoInfo.channel ? `Channel: ${videoInfo.channel}` : ''}

Transcript:
${transcript}

Output format:
### 📋 视频概览
### 🎯 核心要点（附时间戳）
### 💡 关键观点
### 📝 详细内容
### 🔑 一句话总结`;

    console.log('[Hermes] Summarizing', transcript.length, 'chars...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    console.log('[Hermes] Status:', response.status);

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try { const err = await response.json(); errMsg = err.error?.message || errMsg; } catch {}
      if (errMsg.includes('Content Exists Risk')) {
        errMsg += '\n\n💡 DeepSeek 内容审查拦截了此视频。\n请在扩展弹出中设置模型为：openrouter/anthropic/claude-sonnet-4\n并用 OpenRouter API 密钥。';
      }
      throw new Error(`Hermes API 请求失败: ${errMsg}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Hermes 返回为空');
    console.log('[Hermes] Summary:', content.length, 'chars');
    return content;
  }

  async function handleSummarize() {
    const videoInfo = getVideoInfo();
    if (!videoInfo) {
      createToast('未检测到 YouTube 视频', 'error');
      return;
    }

    // 1. Show panel IMMEDIATELY
    let panel = document.getElementById('hermes-summary-panel');
    if (panel) panel.remove();
    panel = createPanel();
    document.body.appendChild(panel);
    setupPanelInteractions(panel);

    const btn = document.getElementById('hermes-summarize-btn');
    if (btn) btn.disabled = true;

    const loadingEl = document.getElementById('hermes-summary-loading');
    const contentEl = document.getElementById('hermes-summary-content');
    const errorEl = document.getElementById('hermes-summary-error');

    document.getElementById('hermes-summary-close').onclick = () => {
      panel.remove();
      if (btn) btn.disabled = false;
    };

    try {
      // 2. Summarize using standalone /summarize (fallback to Hermes)
      const loadingHint = loadingEl.querySelector('.hermes-loading-hint');
      if (loadingHint) loadingHint.textContent = '正在分析视频...';
      
      const summary = await summarizeVideo(videoInfo);
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      contentEl.innerHTML = renderMarkdown(summary);
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
