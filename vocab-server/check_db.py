import sqlite3
conn = sqlite3.connect('/var/www/super-agent/vocab.db')
c = conn.cursor()
c.execute('PRAGMA table_info(personal_prototypes)')
print('personal_prototypes columns:', c.fetchall())
c.execute('SELECT * FROM personal_prototypes LIMIT 3')
print('sample rows:', c.fetchall())
conn.close()
