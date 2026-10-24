import sys

with open('vocab-server/scripts/smoke-daily-listen.mjs', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update matchCombo to handle inputSignature check if present
old_match = """  const matchCombo = (row, args) =>
    row.user_id === args[0] &&
    row.pack_date === args[1] &&
    row.theme === args[2] &&
    row.genre === args[3] &&
    row.cefr_level === args[4] &&
    Number(row.duration) === Number(args[5]);"""

new_match = """  const matchCombo = (row, args) =>
    row.user_id === args[0] &&
    row.pack_date === args[1] &&
    row.theme === args[2] &&
    row.genre === args[3] &&
    row.cefr_level === args[4] &&
    Number(row.duration) === Number(args[5]) &&
    (args.length < 7 || (row.input_signature || '') === (args[6] || ''));"""

if old_match in code:
    code = code.replace(old_match, new_match)
    print("matchCombo replaced.")
else:
    print("matchCombo pattern not found or already replaced.")

# 2. Update INSERT daily_listen_articles
old_insert_art = """          if (/INSERT INTO daily_listen_articles/.test(s)) {
            const [
              id, user_id, pack_date, theme, genre, cefr_level, duration,
              body_text, vocab_json, phrases_json, file_path, status, source, error_message, created_at, updated_at,
            ] = args;
            tables.daily_listen_articles.push({
              id, user_id, pack_date, theme, genre, cefr_level, duration,
              body_text, vocab_json, phrases_json, file_path, status, source, error_message, created_at, updated_at,
            });
            return { changes: 1 };
          }"""

new_insert_art = """          if (/INSERT INTO daily_listen_articles/.test(s)) {
            const [
              id, user_id, pack_date, theme, genre, cefr_level, duration,
              body_text, vocab_json, phrases_json, file_path, status, source, error_message, created_at, updated_at, input_signature
            ] = args;
            tables.daily_listen_articles.push({
              id, user_id, pack_date, theme, genre, cefr_level, duration,
              body_text, vocab_json, phrases_json, file_path, status, source, error_message, created_at, updated_at, input_signature
            });
            return { changes: 1 };
          }"""

if old_insert_art in code:
    code = code.replace(old_insert_art, new_insert_art)
    print("INSERT articles replaced.")
else:
    print("INSERT articles pattern not found or already replaced.")

# 3. Update UPDATE daily_listen_articles
old_update_art = """          if (/UPDATE daily_listen_articles SET/.test(s)) {
            const row = tables.daily_listen_articles.find((r) => r.id === args[args.length - 1]);
            if (row) {
              [
                'body_text', 'vocab_json', 'phrases_json', 'file_path',
                'status', 'source', 'error_message', 'updated_at',
              ].forEach((k, i) => {
                if (args[i] !== undefined) row[k] = args[i];
              });
            }
            return { changes: 1 };
          }"""

new_update_art = """          if (/UPDATE daily_listen_articles SET/.test(s)) {
            const row = tables.daily_listen_articles.find((r) => r.id === args[args.length - 1]);
            if (row) {
              [
                'body_text', 'vocab_json', 'phrases_json', 'file_path',
                'status', 'source', 'error_message', 'input_signature', 'updated_at',
              ].forEach((k, i) => {
                if (args[i] !== undefined) row[k] = args[i];
              });
            }
            return { changes: 1 };
          }"""

if old_update_art in code:
    code = code.replace(old_update_art, new_update_art)
    print("UPDATE articles replaced.")
else:
    print("UPDATE articles pattern not found or already replaced.")

# 4. Update INSERT daily_listen_audios
old_insert_aud = """          if (/INSERT INTO daily_listen_audios/.test(s)) {
            const [
              id, user_id, pack_date, theme, genre, cefr_level, duration,
              script_text, audio_path, audio_url, status, source, error_message, created_at, updated_at,
            ] = args;
            tables.daily_listen_audios.push({
              id, user_id, pack_date, theme, genre, cefr_level, duration,
              script_text, audio_path, audio_url, status, source, error_message, created_at, updated_at,
            });
            return { changes: 1 };
          }"""

new_insert_aud = """          if (/INSERT INTO daily_listen_audios/.test(s)) {
            const [
              id, user_id, pack_date, theme, genre, cefr_level, duration,
              script_text, audio_path, audio_url, status, source, error_message, created_at, updated_at, input_signature
            ] = args;
            tables.daily_listen_audios.push({
              id, user_id, pack_date, theme, genre, cefr_level, duration,
              script_text, audio_path, audio_url, status, source, error_message, created_at, updated_at, input_signature
            });
            return { changes: 1 };
          }"""

if old_insert_aud in code:
    code = code.replace(old_insert_aud, new_insert_aud)
    print("INSERT audios replaced.")
else:
    print("INSERT audios pattern not found or already replaced.")

# 5. Update UPDATE daily_listen_audios
old_update_aud = """          if (/UPDATE daily_listen_audios SET/.test(s)) {
            const row = tables.daily_listen_audios.find((r) => r.id === args[args.length - 1]);
            if (row) {
              [
                'script_text', 'audio_path', 'audio_url',
                'status', 'source', 'error_message', 'updated_at',
              ].forEach((k, i) => {
                if (args[i] !== undefined) row[k] = args[i];
              });
            }
            return { changes: 1 };
          }"""

new_update_aud = """          if (/UPDATE daily_listen_audios SET/.test(s)) {
            const row = tables.daily_listen_audios.find((r) => r.id === args[args.length - 1]);
            if (row) {
              [
                'script_text', 'audio_path', 'audio_url',
                'status', 'source', 'error_message', 'input_signature', 'updated_at',
              ].forEach((k, i) => {
                if (args[i] !== undefined) row[k] = args[i];
              });
            }
            return { changes: 1 };
          }"""

if old_update_aud in code:
    code = code.replace(old_update_aud, new_update_aud)
    print("UPDATE audios replaced.")
else:
    print("UPDATE audios pattern not found or already replaced.")

with open('vocab-server/scripts/smoke-daily-listen.mjs', 'w', encoding='utf-8') as f:
    f.write(code)

print("Done patching smoke-daily-listen.mjs")