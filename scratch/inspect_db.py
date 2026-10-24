import sqlite3
import json
import os

db_path = os.path.join(os.path.dirname(__file__), '..', 'vocab-server', 'vocab.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

print('=== Vocabulary Table Schema ===')
cur.execute("PRAGMA table_info(vocabulary)")
for col in cur.fetchall():
    print(col)

print()
print('=== Sample 10 Entries ===')
cur.execute('SELECT id, word, payload FROM vocabulary LIMIT 10')
rows = cur.fetchall()
for r in rows:
    word = r['word']
    try:
        payload = json.loads(r['payload']) if r['payload'] else {}
    except:
        payload = {}
    meaning = payload.get('meaning', '')
    pos = payload.get('pos', '')
    phonetic = payload.get('phonetic', '')
    print(f'Word: "{word}" | Meaning: "{meaning}" | POS: "{pos}" | Phonetic: "{phonetic}"')

print()
print('=== Total Count ===')
cur.execute('SELECT COUNT(*) as count FROM vocabulary')
print(cur.fetchone()['count'])

print()
print('=== dict_query_log schema ===')
cur.execute("PRAGMA table_info(dict_query_log)")
for col in cur.fetchall():
    print(col)

conn.close()
