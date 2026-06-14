// ============================================================
// Hermes YouTube Summarizer — Background Service Worker
// Handles API calls to Hermes Agent (no CORS issues here)
// ============================================================

const STORAGE_KEY = 'hermes_youtube_settings';

const DEFAULT_SETTINGS = {
  apiUrl: 'http://127.0.0.1:8642',
  apiKey: 'hermes-youtube-summarizer'
};

// --- Init defaults ---

chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  if (!result[STORAGE_KEY]) {
    await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
  }
});

// --- Message dispatcher ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {

    case 'testConnection':
      testHermesConnection(message.settings)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // keep channel open for async

    case 'summarize':
      (async () => {
        try {
          const result = await chrome.storage.local.get(STORAGE_KEY);
          const settings = result[STORAGE_KEY] || DEFAULT_SETTINGS;
          const summary = await callHermesAPI(message.videoInfo, settings);
          sendResponse({ success: true, summary });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // keep channel open for async
  }
});

// --- Connection Test ---

async function testHermesConnection(settings) {
  const url = `${settings.apiUrl.replace(/\/+$/, '')}/health`;
  try {
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${settings.apiKey}` }
    });
    if (resp.ok) {
      return { success: true, data: await resp.json() };
    } else {
      const text = await resp.text();
      return { success: false, error: `HTTP ${resp.status}: ${text.slice(0, 200)}` };
    }
  } catch (err) {
    return { success: false, error: `无法连接到 ${url}: ${err.message}` };
  }
}

// --- YouTube Summarizer ---

async function callHermesAPI(videoInfo, settings) {
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
    })
  });

  if (!response.ok) {
    let errMsg = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      errMsg = err.error?.message || errMsg;
    } catch {}
    throw new Error(`Hermes API 请求失败: ${errMsg}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Hermes 返回为空');
  return content;
}
