#!/usr/bin/env python3
"""Export YouTube cookies from Chrome user profile via Playwright (in-memory session)."""
import os
import sys
import time

OUT = os.environ.get(
    "OUT",
    os.path.join(os.path.dirname(__file__), "..", "secrets", "youtube.cookies.txt"),
)
USER_DATA = os.environ.get(
    "CHROME_USER_DATA",
    os.path.join(os.environ.get("LOCALAPPDATA", ""), "Google", "Chrome", "User Data"),
)
URL = "https://www.youtube.com/watch?v=YoBc3zII7lg"


def to_netscape(cookies):
    lines = [
        "# Netscape HTTP Cookie File",
        "# Exported via Playwright Chrome profile",
        "",
    ]
    for c in cookies:
        domain = c.get("domain") or ""
        if not domain.startswith("."):
            domain = f".{domain.lstrip('.')}"
        path = c.get("path") or "/"
        secure = "TRUE" if c.get("secure") else "FALSE"
        expires = str(int(c.get("expires") or 0))
        name = c.get("name") or ""
        value = c.get("value") or ""
        include_subdomains = "TRUE" if domain.startswith(".") else "FALSE"
        lines.append("\t".join([domain, include_subdomains, path, secure, expires, name, value]))
    return "\n".join(lines) + "\n"


def main():
    from playwright.sync_api import sync_playwright

    if not os.path.isdir(USER_DATA):
        print(f"Chrome profile not found: {USER_DATA}", file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            USER_DATA,
            channel="chrome",
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.goto(URL, wait_until="domcontentloaded", timeout=60000)
        time.sleep(5)
        cookies = context.cookies(["https://www.youtube.com", "https://www.google.com"])
        context.close()

    yt = [c for c in cookies if "youtube" in (c.get("domain") or "")]
    names = sorted({c.get("name") for c in yt})
    print("youtube cookies:", len(yt), "names:", names)
    if not any(c.get("name") == "LOGIN_INFO" for c in yt):
        print("WARN: LOGIN_INFO missing; export may fail bot check", file=sys.stderr)

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(to_netscape(yt))
    print("wrote", OUT, "bytes", os.path.getsize(OUT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
