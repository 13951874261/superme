import os
import sqlite3
from pathlib import Path

for browser, rel in [
    ("edge", r"Microsoft\Edge\User Data\Default\Network\Cookies"),
    ("chrome", r"Google\Chrome\User Data\Default\Network\Cookies"),
]:
    p = Path(os.environ["LOCALAPPDATA"]) / rel
    print(browser, "exists", p.exists())
    if not p.exists():
        continue
    con = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
    rows = con.execute(
        "select name from cookies where host_key like '%youtube%'"
    ).fetchall()
    names = sorted({r[0] for r in rows})
    print(browser, "count", len(names), "LOGIN_INFO", "LOGIN_INFO" in names)
