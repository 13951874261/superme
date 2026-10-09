#!/usr/bin/env python3
"""Backup Chrome cookies, delete YouTube entries, reopen Chrome to refresh session."""
import os
import shutil
import sqlite3
import subprocess
import time
from pathlib import Path

CHROME = Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Google/Chrome/Application/chrome.exe"
USER_DATA = Path(os.environ["LOCALAPPDATA"]) / r"Google\Chrome\User Data"
COOKIES = USER_DATA / "Default/Network/Cookies"
BACKUP = USER_DATA / "Default/Network/Cookies.bak.superagent"
URL = "https://www.youtube.com/watch?v=YoBc3zII7lg"


def kill_chrome():
    subprocess.run(
        ["taskkill", "/F", "/IM", "chrome.exe"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(3)


def backup_and_purge_youtube():
    if not COOKIES.exists():
        raise SystemExit(f"Cookies db missing: {COOKIES}")
    shutil.copy2(COOKIES, BACKUP)
    con = sqlite3.connect(COOKIES)
    cur = con.execute("select count(*) from cookies where host_key like '%youtube%'")
    before = cur.fetchone()[0]
    con.execute("delete from cookies where host_key like '%youtube%'")
    con.commit()
    after = con.execute("select count(*) from cookies where host_key like '%youtube%'").fetchone()[0]
    con.close()
    print(f"purged youtube cookies: {before} -> {after}")


def reopen_chrome():
    if not CHROME.exists():
        raise SystemExit(f"Chrome not found: {CHROME}")
    subprocess.Popen([str(CHROME), URL], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("opened Chrome, waiting 30s for YouTube session refresh...")
    time.sleep(30)


def count_youtube_cookies():
    con = sqlite3.connect(f"file:{COOKIES}?mode=ro", uri=True)
    rows = con.execute(
        "select name from cookies where host_key like '%youtube%'"
    ).fetchall()
    names = sorted({r[0] for r in rows})
    con.close()
    print("youtube cookie names:", names)
    print("LOGIN_INFO", "LOGIN_INFO" in names)


def main():
    kill_chrome()
    backup_and_purge_youtube()
    reopen_chrome()
    kill_chrome()
    count_youtube_cookies()
    print("backup at", BACKUP)


if __name__ == "__main__":
    main()
