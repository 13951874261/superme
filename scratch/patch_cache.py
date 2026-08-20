filePath = "vocab-server/server.js"
with open(filePath, "r", encoding="utf-8") as f_in:
    code = f_in.read()

target_cache = """      try {
        parsedResult = JSON.parse(cleanStr);
      } catch (inner) {
        return null;
      }
    }
    return parsedResult;"""

replacement_cache = """      try {
        parsedResult = JSON.parse(cleanStr);
      } catch (inner) {
        return null;
      }
    }
    try {
      db.prepare(`
        INSERT INTO dict_query_log (id, word, dict_type, direction, user_context, locale, is_success, response_payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(crypto.randomUUID(), word.trim(), cleanDictType, direction, '', 'zh-CN', JSON.stringify(parsedResult), Date.now());
    } catch (logErr) {
      console.error('[Backend Export Worker] Cache Write Error:', logErr.message);
    }
    return parsedResult;"""

if target_cache in code:
    code = code.replace(target_cache, replacement_cache)
    print("CACHING PATCHED (CRLF)")
elif target_cache.replace("\r\n", "\n") in code:
    code = code.replace(target_cache.replace("\r\n", "\n"), replacement_cache.replace("\r\n", "\n"))
    print("CACHING PATCHED (LF)")
else:
    print("CACHING TARGET NOT FOUND")

with open(filePath, "w", encoding="utf-8") as f_out:
    f_out.write(code)
print("done")
