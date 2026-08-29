import os
import sqlite3
import glob

base = os.path.join(os.environ["TEMP"], "yt-chrome-ud")
print("base", base, "exists", os.path.isdir(base))
for p in glob.glob(os.path.join(base, "*", "Network", "Cookies")):
    con = sqlite3.connect(p)
    try:
        n = con.execute("select count(*) from cookies").fetchone()[0]
        yt = con.execute(
            "select host_key, name from cookies where host_key like '%youtube%'"
        ).fetchall()
        print(p, "total", n, "youtube", len(yt), yt[:20])
    except Exception as e:
        print("err", p, e)
    finally:
        con.close()
