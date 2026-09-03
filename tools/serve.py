#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BeeBix 本機預覽伺服器
════════════════════════════════════════════════════════════════
跟 `python3 -m http.server` 的差別有二：

  1. 強制不快取（no-store）。python 內建的 http.server 只送 Last-Modified，
     瀏覽器會用「啟發式快取」自行決定新鮮度，導致改了 CSS/JS 重整仍是舊檔。

  2. 動態注入右上角的 Push 按鈕（tools/push.js）。
     ★ 注入只發生在這支伺服器服務 index.html 的時候。
       index.html 原始碼裡沒有任何按鈕相關的東西，
       所以推上 GitHub Pages 的線上版永遠不會出現這顆按鈕。

Push 流程（POST /__dev/push）：
     寫入 build.txt（時間戳）→ git commit → git push
  → 持續抓線上的 build.txt，直到時間戳對上才算「已上線」。
     也就是說按鈕顯示「已上線」時是真的驗證過，不是推完就宣稱成功。

用法：python3 tools/serve.py [port]
"""
import json, os, re, subprocess, sys, threading, time
import urllib.request, urllib.error
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUSH_JS = os.path.join(ROOT, 'tools', 'push.js')
STAMP   = os.path.join(ROOT, 'build.txt')
INJECT  = b'<script src="/__dev/push.js" defer></script>\n</body>'

# 推送狀態（狀態端點與背景執行緒共用的單一事實來源）
state = {'state': 'idle', 'message': '', 'lastPush': None}
lock  = threading.Lock()


def git(*args):
    """跑 git，回傳 (returncode, 合併輸出)。不拋例外，由呼叫端判斷。"""
    p = subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True)
    return p.returncode, (p.stdout + p.stderr).strip()


def remote_info():
    """從 git remote 推導 GitHub Pages 網址；沒設 remote 回 (None, None)。"""
    code, out = git('remote', 'get-url', 'origin')
    if code != 0 or not out:
        return None, None
    m = re.search(r'github\.com[:/]([^/]+)/([^/.\s]+)', out)
    if not m:
        return out, None
    owner, repo = m.group(1), m.group(2)
    return out, f'https://{owner.lower()}.github.io/{repo}/'


def changed_files():
    """相對於 HEAD 的改動（已套用 .gitignore），排除 build.txt 本身。"""
    code, out = git('status', '--porcelain')
    if code != 0:
        return []
    files = []
    for line in out.splitlines():
        f = line[3:].strip().strip('"')
        if f and os.path.basename(f) != 'build.txt':
            files.append(f)
    # 已 commit 但還沒 push 的也算「有改動」
    code, ahead = git('rev-list', '--count', '@{u}..HEAD')
    if code == 0 and ahead.isdigit() and int(ahead) > 0:
        files.append(f'（{ahead} 個 commit 尚未推送）')
    return files


def wait_live(url, stamp, timeout=240):
    """抓線上的 build.txt 直到時間戳對上 —— 這是「真的上線了」的憑據。"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            req = urllib.request.Request(
                f'{url}build.txt?t={int(time.time())}',
                headers={'Cache-Control': 'no-cache'})
            with urllib.request.urlopen(req, timeout=10) as r:
                if r.read().decode('utf-8', 'replace').strip() == stamp:
                    return True
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(5)
    return False


def do_push():
    """背景執行：commit → push → 驗證線上真的更新了。"""
    def set_state(s, msg=''):
        with lock:
            state['state'], state['message'] = s, msg

    try:
        url_raw, site = remote_info()
        if not url_raw:
            set_state('error', '尚未設定 git remote origin')
            return

        stamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        set_state('pushing', '正在建立 commit…')
        with open(STAMP, 'w', encoding='utf-8') as f:
            f.write(stamp + '\n')

        git('add', '-A')
        code, out = git('commit', '-m', f'Update site — {stamp}')
        if code != 0 and 'nothing to commit' not in out:
            set_state('error', f'commit 失敗：\n{out[:400]}')
            return

        set_state('pushing', '正在推送到 GitHub…')
        code, out = git('push', 'origin', 'HEAD')
        if code != 0:
            set_state('error', f'push 失敗：\n{out[:400]}')
            return

        if not site:
            set_state('done', '已推送（無法推導 Pages 網址，未驗證線上）')
            return

        set_state('waiting', 'GitHub Pages 建置中，正在確認線上是否生效…')
        ok = wait_live(site, stamp)
        with lock:
            state['lastPush'] = stamp
            state['state']    = 'done' if ok else 'error'
            state['message']  = (f'線上已確認更新（{stamp}）' if ok else
                                 'Pages 逾時未更新。可能是首次部署仍在建置，'
                                 '或該 repo 的 Pages 尚未啟用。')
    except Exception as e:                                   # noqa: BLE001
        set_state('error', f'{type(e).__name__}: {e}')


class Handler(SimpleHTTPRequestHandler):

    # ── 開發用端點 ────────────────────────────────────────────
    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, body, ctype):
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith('/__dev/status'):
            raw, site = remote_info()
            files = changed_files()
            with lock:
                s = dict(state)
            # 有新改動就把上一輪的 done/error 清掉，回到可推送狀態
            if files and s['state'] in ('done', 'error'):
                s['state'] = 'idle'
            return self._json({'remote': raw is not None, 'url': site,
                               'dirty': bool(files), 'changed': len(files),
                               'files': files[:12], **s})

        if self.path.startswith('/__dev/push.js'):
            try:
                with open(PUSH_JS, 'rb') as f:
                    return self._send_bytes(f.read(),
                                            'application/javascript; charset=utf-8')
            except OSError:
                return self.send_error(404)

        # index.html：注入 Push 按鈕（只在本機預覽，不進原始碼、不上線）
        if self.path in ('/', '/index.html') or self.path.startswith('/index.html?'):
            try:
                with open(os.path.join(ROOT, 'index.html'), 'rb') as f:
                    body = f.read()
            except OSError:
                return self.send_error(404)
            if b'</body>' in body:
                body = body.replace(b'</body>', INJECT, 1)
            return self._send_bytes(body, 'text/html; charset=utf-8')

        return super().do_GET()

    def do_POST(self):
        if self.path.startswith('/__dev/push'):
            with lock:
                busy = state['state'] in ('pushing', 'waiting')
            if not busy:
                threading.Thread(target=do_push, daemon=True).start()
            return self._json({'started': not busy})
        return self.send_error(404)

    # ── 一律不快取 ────────────────────────────────────────────
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        status = str(args[1]) if len(args) > 1 else ''
        if status.startswith(('4', '5')):
            sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5193
    _, site = remote_info()
    with ThreadingHTTPServer(('127.0.0.1', port), partial(Handler, directory=ROOT)) as httpd:
        print(f'BeeBix preview → http://localhost:{port}/index.html  (no-store)')
        print(f'Push 目標      → {site or "（尚未設定 git remote origin）"}')
        sys.stdout.flush()
        httpd.serve_forever()


if __name__ == '__main__':
    main()
