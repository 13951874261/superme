#!/usr/bin/env python3
import sqlite3
import time
db = sqlite3.connect('/var/www/super-agent/vocab.db')
now = int(time.time() * 1000)
cur = db.execute(
    "UPDATE user_memories SET profile_content = '', updated_at = ? WHERE user_id = ?",
    (now, 'lmq'),
)
db.commit()
row = db.execute(
    "SELECT user_id, length(profile_content) as plen, updated_at, substr(profile_content,1,40) as head FROM user_memories WHERE user_id='lmq'"
).fetchone()
print('changes', cur.rowcount)
print('lmq', dict(zip(['user_id','plen','updated_at','head'], row)))
# leave lzhumy untouched for contrast
other = db.execute(
    "SELECT user_id, length(profile_content) as plen FROM user_memories WHERE user_id='lzhumy'"
).fetchone()
print('lzhumy', dict(zip(['user_id','plen'], other)))
