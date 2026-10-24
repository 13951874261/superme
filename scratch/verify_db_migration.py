import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '../vocab-server/vocab.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- Checking SQLite Database Schema & Migrations ---")

# 1. 检查 user_id 列
cursor.execute("PRAGMA table_info(vocabulary)")
columns = [row[1] for row in cursor.fetchall()]
print("Has user_id column:", 'user_id' in columns)

# 2. 执行与 server.js 相同的 Migration
if 'user_id' not in columns:
    cursor.execute("ALTER TABLE vocabulary ADD COLUMN user_id TEXT DEFAULT 'lzhmy'")
    conn.commit()
    print("Migration Executed: Added user_id column.")

# 自动归属存量数据至 lzhmy
cursor.execute("UPDATE vocabulary SET user_id = 'lzhmy' WHERE user_id IS NULL OR user_id = ''")
conn.commit()
print("Backfilled legacy data to 'lzhmy', updated rows:", cursor.rowcount)

# 创建复合索引
indexes = [
    ("idx_vocab_user_id", "CREATE INDEX IF NOT EXISTS idx_vocab_user_id ON vocabulary(user_id)"),
    ("idx_vocab_user_category_added", "CREATE INDEX IF NOT EXISTS idx_vocab_user_category_added ON vocabulary(user_id, category, added_at DESC)"),
    ("idx_vocab_user_review_opt", "CREATE INDEX IF NOT EXISTS idx_vocab_user_review_opt ON vocabulary(user_id, category, next_review_date, repetitions)"),
    ("idx_vocab_user_word", "CREATE INDEX IF NOT EXISTS idx_vocab_user_word ON vocabulary(user_id, word COLLATE NOCASE)")
]
for idx_name, sql in indexes:
    cursor.execute(sql)
conn.commit()

# 3. 统计各 user_id 下的词数分布
cursor.execute("SELECT user_id, COUNT(*) FROM vocabulary GROUP BY user_id")
user_counts = cursor.fetchall()
print("User counts distribution:", user_counts)

# 4. 列出索引列表
cursor.execute("PRAGMA index_list(vocabulary)")
user_indexes = [row[1] for row in cursor.fetchall() if 'idx_vocab_user' in row[1]]
print("Created user indexes:", user_indexes)

conn.close()
print("--- DB Verification Complete ---")
