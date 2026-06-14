#!/usr/bin/env python3
"""
Tiny HTTP server that fetches YouTube transcripts.
The Chrome extension calls this to get the transcript before sending to Hermes.
"""
import http.server
import json
import urllib.parse
import sys
import os

PORT = 8643

# Add the youtube skill scripts to path
SKILL_SCRIPT = os.path.expanduser(
    "~/.hermes/skills/media/youtube-content/scripts/fetch_transcript.py"
)

class TranscriptHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if parsed.path == '/health':
            self._json_response({"status": "ok"})
            return

        if parsed.path == '/transcript':
            video_id = params.get('v', [None])[0]
            if not video_id:
                self._json_response({"error": "Missing ?v=VIDEO_ID"}, 400)
                return

            try:
                url = f"https://www.youtube.com/watch?v={video_id}"
                
                if os.path.exists(SKILL_SCRIPT):
                    # Use the skill's fetch script
                    import subprocess
                    result = subprocess.run(
                        ["python3", SKILL_SCRIPT, url, "--text-only", "--timestamps"],
                        capture_output=True, text=True, timeout=120
                    )
                    if result.returncode == 0 and result.stdout.strip():
                        text = result.stdout.strip()
                    else:
                        # Fallback to youtube_transcript_api directly
                        text = self._get_transcript_fallback(video_id)
                else:
                    text = self._get_transcript_fallback(video_id)

                self._json_response({
                    "video_id": video_id,
                    "transcript": text,
                    "length": len(text)
                })
            except Exception as e:
                self._json_response({"error": str(e)}, 500)
            return

        self._json_response({"error": "Not found"}, 404)

    def _get_transcript_fallback(self, video_id):
        """Fallback: use youtube_transcript_api directly."""
        from youtube_transcript_api import get_transcript
        transcript = get_transcript(video_id)
        lines = []
        for entry in transcript:
            start = int(entry['start'])
            minutes = start // 60
            seconds = start % 60
            lines.append(f"{minutes}:{seconds:02d} {entry['text']}")
        return "\n".join(lines)

    def _json_response(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def log_message(self, format, *args):
        sys.stderr.write(f"[Transcript Server] {args[0]} {args[1]} {args[2]}\n")

if __name__ == '__main__':
    server = http.server.HTTPServer(('127.0.0.1', PORT), TranscriptHandler)
    print(f"[Transcript Server] Listening on http://127.0.0.1:{PORT}")
    sys.stdout.flush()
    server.serve_forever()
