#!/usr/bin/env python3
"""
独立 YouTube 视频总结服务器。
获取字幕 + 直接调用 LLM API 进行总结，无需 Hermes Agent。

依赖: pip install youtube-transcript-api
"""

import http.server
import json
import urllib.parse
import urllib.request
import sys
import os
import textwrap
import ssl
import certifi

PORT = 8643

SKILL_SCRIPT = os.path.expanduser(
    "~/.hermes/skills/media/youtube-content/scripts/fetch_transcript.py"
)

SYSTEM_PROMPT = textwrap.dedent("""\
You are a YouTube video summarizer. Provide detailed structured summaries in Chinese (Simplified).

Output format:
### 📋 视频概览
### 🎯 核心要点（附时间戳）
### 💡 关键观点
### 📝 详细内容
### 🔑 一句话总结""")


class SummarizerHandler(http.server.BaseHTTPRequestHandler):

    # ── GET ────────────────────────────────────────────────

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if parsed.path == '/health':
            return self._json({"status": "ok", "version": "2.0"})

        if parsed.path == '/transcript':
            video_id = params.get('v', [None])[0]
            if not video_id:
                return self._json({"error": "Missing ?v=VIDEO_ID"}, 400)
            try:
                text = self._fetch_transcript(video_id)
                self._json({"video_id": video_id, "transcript": text, "length": len(text)})
            except Exception as e:
                self._json({"error": str(e)}, 500)
            return

        self._json({"error": "Not found"}, 404)

    # ── POST (summarize) ───────────────────────────────────

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == '/summarize':
            body = self._read_body()
            video_id = body.get('videoId')
            api_key = body.get('apiKey')
            base_url = body.get('baseUrl', 'https://api.deepseek.com/v1')
            model = body.get('model', 'deepseek-v4-flash')
            existing_transcript = body.get('transcript')  # optional, pre-fetched

            if not video_id:
                return self._json({"error": "Missing videoId"}, 400)
            if not api_key:
                return self._json({"error": "Missing apiKey"}, 400)

            try:
                # Only fetch transcript if not provided
                if existing_transcript:
                    transcript = existing_transcript
                else:
                    transcript = self._fetch_transcript(video_id)

                summary = self._call_llm(transcript, api_key, base_url, model)
                self._json({
                    "video_id": video_id,
                    "summary": summary,
                    "model": model,
                    "transcript_length": len(transcript)
                })
            except Exception as e:
                self._json({"error": str(e)}, 500)
            return

        self._json({"error": "Not found"}, 404)

    # ── Transcript ─────────────────────────────────────────

    def _fetch_transcript(self, video_id):
        url = f"https://www.youtube.com/watch?v={video_id}"

        if os.path.exists(SKILL_SCRIPT):
            import subprocess
            result = subprocess.run(
                ["python3", SKILL_SCRIPT, url, "--text-only", "--timestamps"],
                capture_output=True, text=True, timeout=120
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()

        # Fallback
        from youtube_transcript_api import get_transcript
        transcript = get_transcript(video_id)
        lines = []
        for entry in transcript:
            start = int(entry['start'])
            minutes = start // 60
            seconds = start % 60
            lines.append(f"{minutes}:{seconds:02d} {entry['text']}")
        return "\n".join(lines)

    # ── LLM call ───────────────────────────────────────────

    def _call_llm(self, transcript, api_key, base_url, model):
        """Call an OpenAI-compatible API."""
        api_url = f"{base_url.rstrip('/')}/chat/completions"
        actual_model = model

        # Build user message with transcript
        user_msg = (
            f"请用中文总结这个 YouTube 视频的字幕：\n\n"
            f"字幕全文：\n{transcript}\n\n"
            f"请按照以下格式输出：\n"
            f"### 📋 视频概览\n"
            f"### 🎯 核心要点（附时间戳）\n"
            f"### 💡 关键观点\n"
            f"### 📝 详细内容\n"
            f"### 🔑 一句话总结"
        )

        payload = json.dumps({
            "model": actual_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_msg}
            ]
        }).encode()

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/overheat2k/youtube-hermes-summarizer",
            "X-Title": "Hermes YouTube Summarizer"
        }

        req = urllib.request.Request(api_url, data=payload, headers=headers, method="POST")
        ssl_ctx = ssl.create_default_context(cafile=certifi.where())
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=300) as resp:
            result = json.loads(resp.read())

        content = result.get("choices", [{}])[0].get("message", {}).get("content")
        if not content:
            raise RuntimeError("LLM 返回为空")
        return content

    # ── HTTP helpers ───────────────────────────────────────

    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))

    def _json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def log_message(self, format, *args):
        sys.stderr.write(f"[Summarizer] {args[0]} {args[1]} {args[2]}\n")


if __name__ == '__main__':
    server = http.server.HTTPServer(('127.0.0.1', PORT), SummarizerHandler)
    print(f"[Summarizer Server] Listening on http://127.0.0.1:{PORT}")
    print(f"[Summarizer Server] POST /summarize — standalone summarization (no Hermes needed)")
    sys.stdout.flush()
    server.serve_forever()
