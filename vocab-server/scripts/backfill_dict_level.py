#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backfill_dict_level.py
词典覆盖率历史数据 level 字段分块回填脚本 (VOCAB-Q-PERF-01)
使用 Python 标准库 sqlite3 与 json，跨平台零依赖。
"""

import sys
import os
import json
import time
import sqlite3

def get_db_path():
    if len(sys.argv) > 1:
        return sys.argv[1]
    prod_path = '/var/www/super-agent/vocab.db'
    if os.path.exists(prod_path):
        return prod_path
    local_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../vocab.db')
    return local_path

def main():
    db_path = get_db_path()
    print(f"[Backfill Level] 连接数据库: {db_path}")

    if not os.path.exists(db_path):
        print(f"[Backfill Level] 错误: 数据库文件不存在: {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. 确保 level 列存在
    cursor.execute("PRAGMA table_info(dict_query_log)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'level' not in columns:
        cursor.execute("ALTER TABLE dict_query_log ADD COLUMN level TEXT")
        conn.commit()
        print("[Backfill Level] 新增 level 列成功。")

    # 2. 确保 (is_success, level) 索引存在
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_dict_log_level ON dict_query_log(is_success, level)")
    conn.commit()
    print("[Backfill Level] 索引 idx_dict_log_level 准备就绪。")

    # 3. 统计待回填数量
    cursor.execute("SELECT COUNT(*) FROM dict_query_log WHERE is_success = 1 AND level IS NULL")
    pending_count = cursor.fetchone()[0]
    print(f"[Backfill Level] 待回填成功记录总数: {pending_count}")

    if pending_count == 0:
        print("[Backfill Level] 没有需要回填的数据，脚本结束。")
        conn.close()
        return

    batch_size = 1000
    processed = 0
    start_time = time.time()

    while True:
        cursor.execute(
            "SELECT id, response_payload FROM dict_query_log WHERE is_success = 1 AND level IS NULL LIMIT ?",
            (batch_size,)
        )
        rows = cursor.fetchall()
        if not rows:
            break

        updates = []
        for row_id, payload_str in rows:
            level = ''
            if payload_str:
                try:
                    parsed = json.loads(payload_str)
                    raw_level = None
                    if isinstance(parsed, dict):
                        if isinstance(parsed.get('payload'), dict):
                            raw_level = parsed['payload'].get('level')
                        if not raw_level:
                            raw_level = parsed.get('level')
                    if isinstance(raw_level, str) and raw_level.strip():
                        level = raw_level.strip()
                except Exception:
                    level = ''
            updates.append((level, row_id))

        cursor.executemany("UPDATE dict_query_log SET level = ? WHERE id = ?", updates)
        conn.commit()
        processed += len(rows)

        elapsed = time.time() - start_time
        percent = (processed / pending_count) * 100
        print(f"[Backfill Level] 进度: {processed}/{pending_count} ({percent:.1f}%) | 耗时: {elapsed:.1f}s")

    conn.close()
    total_time = time.time() - start_time
    print(f"[Backfill Level] 回填完成！共处理 {processed} 行，总耗时: {total_time:.1f}s")

if __name__ == '__main__':
    main()
