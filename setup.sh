#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# YouTube Summarizer — 一键安装脚本
# ============================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      YouTube Summarizer - Setup         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Check system dependencies ────────────────────────
echo -e "${YELLOW}[1/3] 检查系统环境...${NC}"

if ! command -v python3 &>/dev/null; then
  echo -e "${RED}✗ Python3 未安装${NC}"
  echo "  请先安装 Python 3.10+ : https://www.python.org/downloads/"
  exit 1
fi

# Check Python version (3.10+)
PY_VER=$(python3 --version 2>&1 | grep -oP '\d+\.\d+')
PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
if [ "$PY_MAJOR" -lt 3 ] || ([ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]); then
  echo -e "${RED}✗ 需要 Python 3.10+，当前是 $PY_MAJOR.$PY_MINOR${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Python $PY_MAJOR.$PY_MINOR${NC}"

# OS check
if [[ "$(uname)" != "Darwin" ]]; then
  echo -e "${YELLOW}⚠ 非 macOS 系统，launchd 开机自启不适用，将直接启动服务器${NC}"
  IS_MACOS=false
else
  IS_MACOS=true
  echo -e "${GREEN}✓ macOS${NC}"
fi

# ── 2. Install Python packages ──────────────────────────
echo ""
echo -e "${YELLOW}[2/3] 安装 Python 依赖...${NC}"

python3 -m pip install --quiet --upgrade youtube-transcript-api certifi 2>&1 | tail -1 || {
  echo -e "${RED}✗ pip 安装失败，尝试: python3 -m pip install youtube-transcript-api certifi${NC}"
  exit 1
}
echo -e "${GREEN}✓ youtube-transcript-api (字幕获取)${NC}"
echo -e "${GREEN}✓ certifi (SSL 证书)${NC}"

# ── 3. Start transcript server ─────────────────────────
echo ""
echo -e "${YELLOW}[3/3] 启动字幕服务器 (端口 8643)...${NC}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_SCRIPT="$SCRIPT_DIR/transcript_server.py"

# Kill any existing process on port 8643
lsof -ti :8643 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

if [ "$IS_MACOS" = true ]; then
  PLIST_SRC="$SCRIPT_DIR/com.hermes.youtube-transcript-server.plist"
  PLIST_DST="$HOME/Library/LaunchAgents/com.hermes.youtube-transcript-server.plist"

  launchctl unload "$PLIST_DST" 2>/dev/null || true

  # Install plist with real paths
  sed "s|__SCRIPT_DIR__|$SCRIPT_DIR|g; s|__HOME__|$HOME|g" "$PLIST_SRC" > "$PLIST_DST"

  launchctl load "$PLIST_DST" 2>&1 || {
    echo -e "${YELLOW}  launchd 加载失败，直接启动...${NC}"
    nohup python3 "$SERVER_SCRIPT" > /tmp/hermes_transcript_server.log 2>&1 &
    echo -e "${YELLOW}  服务器 PID $!${NC}"
  }
else
  nohup python3 "$SERVER_SCRIPT" > /tmp/hermes_transcript_server.log 2>&1 &
  echo -e "${YELLOW}  PID $!${NC}"
fi

sleep 2

if curl -sf http://127.0.0.1:8643/health >/dev/null 2>&1; then
  echo -e "${GREEN}✓ 字幕服务器已启动 (端口 8643)${NC}"
  if [ "$IS_MACOS" = true ]; then
    echo -e "${GREEN}  → 已配置为开机自启${NC}"
  fi
else
  echo -e "${YELLOW}⚠ 手动启动: python3 \"$SERVER_SCRIPT\"${NC}"
fi

# ── Print instructions ──────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ 安装完成！${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}  📌 加载 Chrome 扩展：${NC}"
echo "  1. chrome://extensions"
echo "  2. 开启「开发者模式」"
echo "  3. 「加载已解压的扩展程序」→ $SCRIPT_DIR/extension"
echo ""
echo -e "${BLUE}  ⚙️  配置扩展：${NC}"
echo "  打开扩展弹窗，填入："
echo "  - Base URL: https://api.deepseek.com/v1"
echo "  - API Key: 你的 DeepSeek / OpenRouter 密钥"
echo "  - 模型: deepseek-v4-flash"
echo ""
echo -e "${BLUE}  🎬 使用：${NC}"
echo "  打开任意 YouTube 视频 → 点击「总结」按钮"
echo ""
echo -e "  详细文档: ${BLUE}$SCRIPT_DIR/README.md${NC}"
echo ""
