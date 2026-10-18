r"""Small local control service so n8n (or curl) can start and watch the CHOSN update.

    python scripts/webscraper/control.py            # listens on 127.0.0.1:8765

  GET  /health                       -> {"ok": true}
  GET  /status                       -> the last run's summary, whether one is running now, paused sites and tools
  POST /run   {"mode": "quick"}      -> start the fast stores           (same as: python scripts/webscraper/run.py all --quick)
              {"mode": "full"}       -> start every store               (same as: python scripts/webscraper/run.py all)
              {"mode": "test"}       -> Limited Edt only, nothing saved (a safe check that the whole chain works)

Every request needs the header  X-Control-Token  with the value in data/webscraper/control-token.txt (made on first start,
kept out of git). It listens on this PC only (127.0.0.1); n8n in Docker reaches it as host.docker.internal.
Starting a run while one is going does nothing and says so (daily_update.py also holds a lock).
"""
import json
import os
import secrets
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import core  # noqa: E402

ROOT = str(core.ROOT)
PORT = int(os.environ.get("CONTROL_PORT", "8765"))
TOKEN_FILE = os.path.join(ROOT, "data", "webscraper", "control-token.txt")
SUMMARY = os.path.join(ROOT, "data", "daily", "last_run_summary.json")
LOCK = os.path.join(ROOT, "data", "daily", "run.lock")
LOCK_MAX_AGE = 8 * 3600
MODES = {
    "quick": ["--quick"],
    "full": [],
    "test": ["--only", "limitededt", "--dry-run"],
}
_proc = {"p": None, "mode": None, "since": None}


def token():
    os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
    if not os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "w") as f:
            f.write(secrets.token_urlsafe(32))
    return open(TOKEN_FILE).read().strip()


def running():
    p = _proc["p"]
    if p is not None and p.poll() is None:
        return True
    return os.path.exists(LOCK) and time.time() - os.path.getmtime(LOCK) < LOCK_MAX_AGE


def summary():
    try:
        return json.load(open(SUMMARY, encoding="utf-8"))
    except (OSError, ValueError):
        return None


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body):
        raw = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _authed(self):
        if secrets.compare_digest(self.headers.get("X-Control-Token", ""), TOKEN):
            return True
        self._send(401, {"error": "missing or wrong X-Control-Token"})
        return False

    def do_GET(self):
        if not self._authed():
            return
        if self.path == "/health":
            return self._send(200, {"ok": True})
        if self.path == "/status":
            st = core.status()
            return self._send(200, {"running": running(), "mode": _proc["mode"], "last_run": summary(),
                                    "paused_domains": st.get("paused_domains", {}), "paused_tools": st.get("paused_tools", {})})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if not self._authed():
            return
        if self.path != "/run":
            return self._send(404, {"error": "not found"})
        n = int(self.headers.get("Content-Length") or 0)
        try:
            mode = (json.loads(self.rfile.read(n) or b"{}").get("mode") or "quick")
        except ValueError:
            return self._send(400, {"error": "body must be JSON"})
        if mode not in MODES:
            return self._send(400, {"error": f"mode must be one of {sorted(MODES)}"})
        if running():
            return self._send(409, {"started": False, "reason": "an update is already running"})
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        _proc.update(p=subprocess.Popen([sys.executable, "scripts/webscraper/run.py", "all", *MODES[mode]], cwd=ROOT, env=env,
                                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL),
                     mode=mode, since=time.time())
        self._send(202, {"started": True, "mode": mode})

    def log_message(self, *a):  # quiet
        pass


TOKEN = token()

if __name__ == "__main__":
    print(f"CHOSN control service on http://127.0.0.1:{PORT} (token in {TOKEN_FILE})", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
