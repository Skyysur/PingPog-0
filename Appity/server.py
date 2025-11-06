#!/usr/bin/env python3
import json
import os
import sys
import uuid
import urllib.request
from http.server import HTTPServer, SimpleHTTPRequestHandler

LIB_DIR = os.path.join(os.getcwd(), 'library')
os.makedirs(LIB_DIR, exist_ok=True)

def guess_ext(content_type: str, url_path: str) -> str:
    mapping = {
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'video/ogg': '.ogv',
        'video/quicktime': '.mov',
        'application/octet-stream': '',
    }
    ext = mapping.get((content_type or '').split(';')[0].strip(), '')
    if not ext:
        # try to infer from URL
        base = url_path.lower()
        for e in ['.mp4', '.webm', '.mkv', '.mov', '.ogv']:
            if base.endswith(e):
                return e
    return ext or '.bin'

class Handler(SimpleHTTPRequestHandler):
    def _send_json(self, code, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path == '/api/extract':
            try:
                length = int(self.headers.get('Content-Length', '0'))
                raw = self.rfile.read(length)
                data = json.loads(raw.decode('utf-8'))
                url = data.get('url', '').strip()
                if not url:
                    return self._send_json(400, {'ok': False, 'error': 'missing url'})
                # Try to import yt_dlp dynamically
                try:
                    import yt_dlp
                except Exception as ie:
                    return self._send_json(501, {'ok': False, 'error': 'yt-dlp not installed'})
                # Configure yt-dlp to download best video+audio, merge to mp4 when possible
                outtmpl = os.path.join(LIB_DIR, '%(id)s.%(ext)s')
                ydl_opts = {
                    'format': 'bv*+ba/b',
                    'merge_output_format': 'mp4',
                    'outtmpl': outtmpl,
                    'noplaylist': True,
                    'quiet': True,
                    'restrictfilenames': True,
                }
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info = ydl.extract_info(url, download=True)
                        # Resolve final filename; prefer mp4 if merged
                        filename = ydl.prepare_filename(info)
                        base, ext = os.path.splitext(filename)
                        mp4_candidate = base + '.mp4'
                        if os.path.exists(mp4_candidate):
                            filename = mp4_candidate
                        elif not os.path.exists(filename):
                            # try common variants
                            for e in ['.mp4', '.mkv', '.webm', '.mov']:
                                cand = base + e
                                if os.path.exists(cand):
                                    filename = cand
                                    break
                        if not os.path.exists(filename):
                            return self._send_json(500, {'ok': False, 'error': 'downloaded file not found'})
                        rel = '/library/' + os.path.basename(filename)
                        # Guess content-type from extension
                        ct = 'video/mp4' if filename.lower().endswith('.mp4') else 'video/webm' if filename.lower().endswith('.webm') else 'video/quicktime' if filename.lower().endswith('.mov') else 'application/octet-stream'
                        size = os.path.getsize(filename)
                        return self._send_json(200, {
                            'ok': True,
                            'path': rel,
                            'size': size,
                            'type': ct,
                            'title': info.get('title')
                        })
                except Exception as e:
                    return self._send_json(500, {'ok': False, 'error': str(e)})
            except Exception as e:
                return self._send_json(500, {'ok': False, 'error': str(e)})
        if self.path == '/api/fetch':
            try:
                length = int(self.headers.get('Content-Length', '0'))
                raw = self.rfile.read(length)
                data = json.loads(raw.decode('utf-8'))
                url = data.get('url', '').strip()
                if not url:
                    return self._send_json(400, {'ok': False, 'error': 'missing url'})
                # Fetch with a browser-ish user-agent
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as resp:
                    ct = resp.headers.get('Content-Type', '')
                    # Only persist if the response is a video payload
                    if not ct.lower().startswith('video/'):
                        return self._send_json(200, {'ok': False, 'type': ct})
                    content = resp.read()
                    ext = guess_ext(ct, urllib.request.urlparse(url).path)
                    name = f"{uuid.uuid4().hex}{ext}"
                    path = os.path.join(LIB_DIR, name)
                    with open(path, 'wb') as f:
                        f.write(content)
                    rel = f"/library/{name}"
                    return self._send_json(200, {
                        'ok': True,
                        'path': rel,
                        'size': len(content),
                        'type': ct,
                    })
            except Exception as e:
                return self._send_json(500, {'ok': False, 'error': str(e)})
        else:
            return super().do_POST()

def run(port=5173):
    httpd = HTTPServer(('', port), Handler)
    print(f"Serving on http://localhost:{port}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass

if __name__ == '__main__':
    p = 5173
    if len(sys.argv) > 1:
        try:
            p = int(sys.argv[1])
        except: pass
    run(p)