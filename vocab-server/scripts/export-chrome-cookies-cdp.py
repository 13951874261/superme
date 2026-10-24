#!/usr/bin/env python3
"""Export YouTube cookies via Chrome CDP using junction profile path."""
import json
import os
import shutil
import subprocess
import time
import urllib.request
from pathlib import Path

CHROME = Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Google/Chrome/Application/chrome.exe"
REAL_USER_DATA = Path(os.environ["LOCALAPPDATA"]) / r"Google\Chrome\User Data"
JUNCTION = Path(os.environ["TEMP"]) / "chrome-cdp-profile"
_SCRIPT_DIR = Path(__file__).resolve().parent
if _SCRIPT_DIR.name == "windows":
    _DEFAULT_OUT = _SCRIPT_DIR.parent / "windows" / "youtube.cookies.txt"
else:
    _DEFAULT_OUT = _SCRIPT_DIR.parent / "secrets" / "youtube.cookies.txt"
OUT = Path(os.environ.get("OUT") or _DEFAULT_OUT)
DEBUG_PORT = 9333
URL = "https://www.youtube.com/watch?v=YoBc3zII7lg"


def kill_chrome():
    subprocess.run(["taskkill", "/F", "/IM", "chrome.exe"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(3)


def ensure_junction():
    if JUNCTION.exists():
        if JUNCTION.is_symlink() or os.path.isjunction(str(JUNCTION)):
            return
        shutil.rmtree(JUNCTION, ignore_errors=True)
    subprocess.run(["cmd", "/c", "mklink", "/J", str(JUNCTION), str(REAL_USER_DATA)], check=True)


def to_netscape(cookies):
    lines = ["# Netscape HTTP Cookie File", "# Exported via Chrome CDP", ""]
    for c in cookies:
        domain = c.get("domain") or ""
        if domain.startswith("."):
            include = "TRUE"
        else:
            include = "FALSE"
            domain = f".{domain.lstrip('.')}"
        secure = "TRUE" if c.get("secure") else "FALSE"
        expires = str(int(c.get("expires") or 0))
        name = c.get("name") or ""
        value = c.get("value") or ""
        path = c.get("path") or "/"
        lines.append("\t".join([domain, include, path, secure, expires, name, value]))
    return "\n".join(lines) + "\n"


def cdp_get_cookies(ws_url):
    import websocket  # type: ignore

    msg_id = 1
    cookies = []

    def send(ws, method, params=None):
        nonlocal msg_id
        payload = {"id": msg_id, "method": method}
        if params:
            payload["params"] = params
        msg_id += 1
        ws.send(json.dumps(payload))
        while True:
            raw = ws.recv()
            data = json.loads(raw)
            if data.get("id") == payload["id"]:
                return data

    ws = websocket.create_connection(ws_url, timeout=30)
    try:
        send(ws, "Network.enable")
        res = send(ws, "Network.getCookies", {"urls": ["https://www.youtube.com", "https://www.google.com"]})
        cookies = (res.get("result") or {}).get("cookies") or []
    finally:
        ws.close()
    return cookies


def main():
    try:
        import websocket  # noqa: F401
    except ImportError:
        subprocess.check_call(["python", "-m", "pip", "install", "websocket-client", "-q"])

    kill_chrome()
    ensure_junction()
    proc = subprocess.Popen(
        [
            str(CHROME),
            f"--user-data-dir={JUNCTION}",
            f"--remote-debugging-port={DEBUG_PORT}",
            "--remote-allow-origins=*",
            "--no-first-run",
            URL,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(12)
    try:
        targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{DEBUG_PORT}/json", timeout=10))
        page = next((t for t in targets if t.get("type") == "page" and "youtube.com" in t.get("url", "")), targets[0])
        cookies = cdp_get_cookies(page["webSocketDebuggerUrl"])
    finally:
        kill_chrome()
        proc.poll()

    yt = [c for c in cookies if "youtube" in (c.get("domain") or "")]
    names = sorted({c.get("name") for c in yt})
    print("youtube cookies:", len(yt), names)
    print("LOGIN_INFO", "LOGIN_INFO" in names)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(to_netscape(yt), encoding="utf-8")
    print("wrote", OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
