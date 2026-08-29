import os
import sqlite3

p = os.path.join(
    os.environ["LOCALAPPDATA"],
    r"Google\Chrome\User Data\Default\Network\Cookies",
)
con = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
rows = con.execute(
    "select name from cookies where host_key like '%youtube%'"
).fetchall()
names = sorted({r[0] for r in rows})
print("count", len(names))
print("names", names)
print("LOGIN_INFO", "LOGIN_INFO" in names)
print("PSID", any("PSID" in n for n in names))
