#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Hermes YouTube Summarizer — 一键安装脚本
# ============================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Hermes YouTube Summarizer - Setup     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# --- 1. Check prerequisites ---
echo -e "${YELLOW}[1/4] 检查依赖...${NC}"

if ! command -v hermes &>/dev/null; then
  echo -e "${RED}✗ Hermes CLI 未安装。请先安装 Hermes Agent。${NC}"
  echo "  curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash"
  exit 1
fi
echo -e "${GREEN}✓ Hermes CLI 已安装${NC}"

if ! command -v python3 &>/dev/null; then
  echo -e "${RED}✗ Python3 未安装${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Python3 已安装${NC}"

# Check youtube-transcript-api
if ! python3 -c "import youtube_transcript_api" 2>/dev/null; then
  echo -e "${YELLOW}  安装 youtube-transcript-api...${NC}"
  python3 -m pip install youtube-transcript-api -q
fi
echo -e "${GREEN}✓ youtube-transcript-api 已就绪${NC}"

# --- 2. Enable Hermes API Server ---
echo ""
echo -e "${YELLOW}[2/4] 配置 Hermes API Server...${NC}"

# Generate a random API key
API_KEY="hermes-yt-$(openssl rand -hex 4 2>/dev/null || echo 'summarizer')"

hermes config set API_SERVER_ENABLED true
hermes config set API_SERVER_KEY "$API_KEY"

# Restart gateway
echo -e "${BLUE}  ↻ 重启 Hermes Gateway...${NC}"
hermes gateway stop 2>/dev/null || true
sleep 1
hermes gateway start 2>/dev/null || hermes gateway run &
sleep 2

# Verify
if curl -sf http://127.0.0.1:8642/health >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Hermes API Server 已启动 (端口 8642)${NC}"
else
  echo -e "${YELLOW}⚠ 等待 Hermes API Server 启动...${NC}"
  echo -e "${YELLOW}  稍后运行 'hermes gateway' 或检查 'hermes gateway status'${NC}"
fi

# --- 3. Install YouTube Content skill ---
echo ""
echo -e "${YELLOW}[3/4] 安装 YouTube 总结技能...${NC}"

if [ ! -d "$HOME/.hermes/skills/media/youtube-content" ]; then
  echo -e "${BLUE}  → 从技能中心安装 youtube-content...${NC}"
  hermes skills install youtube-content 2>/dev/null || echo -e "${YELLOW}  ⚠ 安装失败，扩展将使用备用方案${NC}"
fi

if [ -f "$HOME/.hermes/skills/media/youtube-content/scripts/fetch_transcript.py" ]; then
  echo -e "${GREEN}✓ YouTube Content skill 已就绪${NC}"
else
  echo -e "${YELLOW}⚠ fetch_transcript.py 未找到，扩展将使用备用方法获取字幕${NC}"
fi

# --- 4. Print instructions ---
echo ""
echo -e "${YELLOW}[4/4] 安装指南${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXTENSION_DIR="$SCRIPT_DIR/extension"

echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ 配置完成！${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "  API 地址: ${BLUE}http://127.0.0.1:8642${NC}"
echo -e "  API 密钥: ${YELLOW}$API_KEY${NC}"
echo ""
echo -e "${BLUE}  📌 安装 Chrome 扩展：${NC}"
echo "  1. 打开 Chrome，访问: chrome://extensions"
echo "  2. 开启右上角「开发者模式」"
echo "  3. 点击「加载已解压的扩展程序」"
echo "  4. 选择目录: $EXTENSION_DIR"
echo ""
echo -e "${BLUE}  ⚙️  设置扩展（打开扩展弹窗即可配置）：${NC}"
echo "  - API 地址: http://127.0.0.1:8642"
echo "  - API 密钥: $API_KEY"
echo ""
echo -e "${BLUE}  🎬 使用方法：${NC}"
echo "  1. 打开任意 YouTube 视频"
echo "  2. 点击视频下方的紫色「总结」按钮"
echo "  3. 等待几秒，右侧弹出详细总结面板"
echo ""

# Save API key to .api_key (gitignored)
echo "$API_KEY" > "$SCRIPT_DIR/.api_key"
echo -e "${GREEN}  API 密钥已保存到 $SCRIPT_DIR/.api_key${NC}"
echo ""
echo -e "${BLUE}  💡 在多台 Mac 上使用：${NC}"
echo "  每台机器运行一次此脚本即可。"
echo "  扩展代码通过 Git 同步，配置各自独立。"
echo ""
