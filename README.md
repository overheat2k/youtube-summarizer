# Hermes YouTube Summarizer 🎬📝

一键通过 **Hermes Agent** 总结 YouTube 视频的 Chrome 扩展。

## 架构

```
Chrome 扩展 (你的 Mac)
      ↓  点击「总结」
POST /v1/chat/completions
      ↓
Hermes API Server (localhost:8642)
      ↓  获取字幕 + AI 分析
结构化总结报告
      ↓
右侧面板展示
```

**所有操作都在本地完成**——扩展和 Hermes 运行在同一台 Mac 上，无需外部服务器。

## 功能

- ✅ 在 YouTube 视频页面自动注入「总结」按钮
- ✅ 一键发送视频到 Hermes Agent
- ✅ 自动获取字幕并进行深度分析
- ✅ 结构化总结（核心要点、时间戳、关键观点）
- ✅ 右侧浮动面板展示结果
- ✅ 深色模式自适应
- ✅ 多机支持（iMac / MacBook Pro 各跑各的）

## 快速安装

### 前提条件

- [Hermes Agent](https://hermes-agent.nousresearch.com) 已安装
- Chrome 浏览器

### 一键安装

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/youtube-hermes-summarizer.git
cd youtube-hermes-summarizer

# 运行安装脚本
chmod +x setup.sh
./setup.sh
```

### 手动安装

```bash
# 1. 启用 Hermes API Server
hermes config set API_SERVER_ENABLED true
hermes config set API_SERVER_KEY your-secret-key
hermes gateway restart

# 2. 安装 YouTube 字幕依赖
pip3 install youtube-transcript-api

# 3. 加载 Chrome 扩展
# 打开 chrome://extensions → 开发者模式 → 加载已解压 → 选择 extension/ 目录
```

### 扩展配置

打开扩展弹窗，确认以下设置已自动填充：

| 设置项 | 默认值 |
|--------|--------|
| API 地址 | `http://127.0.0.1:8642` |
| API 密钥 | `setup.sh` 运行后自动生成 |

点击「测试连接」确认 Hermes API Server 正在运行。

## 使用

1. 打开任意 YouTube 视频
2. 点击视频下方紫色的 **「总结」** 按钮
3. 等待几秒（Hermes 正在获取字幕并分析）
4. 右侧弹出详细总结面板

## 多机部署

每台装有 Hermes Agent 的机器各自运行一套：

```
iMac (广州)     → 本地 Hermes API Server :8642 → 本地 Chrome 扩展
MacBook Pro    → 本地 Hermes API Server :8642 → 本地 Chrome 扩展
(深圳)
```

每台机器运行一次 `./setup.sh` 即可。

## 项目结构

```
youtube-hermes-summarizer/
├── README.md
├── LICENSE
├── setup.sh                  # 一键安装脚本
├── .gitignore
├── extension/
│   ├── manifest.json         # Chrome 扩展清单
│   ├── content.js            # YouTube 页面注入脚本
│   ├── background.js         # 后台服务 (API 调用)
│   ├── icons/                # 扩展图标
│   └── popup/
│       ├── popup.html        # 设置弹窗
│       └── popup.js          # 设置逻辑
```

## 技术细节

- **Manifest V3** — 最新 Chrome 扩展规范
- **Hermes API Server** — OpenAI 兼容接口，运行在 `http://127.0.0.1:8642`
- **youtube-transcript-api** — 获取 YouTube 字幕
- **Service Worker** — Manifest V3 的后台处理
- **无外部依赖** — 所有请求走本地 Hermes

## 许可证

MIT
