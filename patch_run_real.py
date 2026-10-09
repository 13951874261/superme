import sys

with open('vocab-server/scripts/run-real-2am-lzhmy.js', 'r', encoding='utf-8') as f:
    code = f.read()

old_loop = """  for (const genre of GENRES) {
    for (const cefrLevel of CEFR_LEVELS) {
      const artId = crypto.randomUUID();
      const body = articlesByCefr[genre][cefrLevel];
      db.prepare(`
        INSERT OR REPLACE INTO daily_extracted_articles (id, user_id, quota_date, theme, genre, cefr_level, article, words_json, phrases_json, sentences_json, duration, input_signature, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        artId, targetUser, packDate, theme, genre, cefrLevel, body,
        JSON.stringify([{ word: 'strategy' }, { word: 'leverage' }]),
        JSON.stringify(['strategic flexibility', 'firm pressure']),
        JSON.stringify([body.split('.')[0] + '.']),
        DURATION, `sig_1m_${genre}_${cefrLevel}_diff`, now, now
      );

      const audioId = crypto.randomUUID();
      const audioUrl = `/api/daily_listen_audio/${targetUser}/${packDate}_${genre}_${cefrLevel}_1m.mp3`;
      db.prepare(`
        INSERT OR REPLACE INTO daily_listen_audios (id, user_id, pack_date, theme, genre, cefr_level, duration, audio_url, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(audioId, targetUser, packDate, theme, genre, cefrLevel, 1, audioUrl, 'ready', now, now);
    }
  }"""

new_loop = """  for (const genre of GENRES) {
    for (const cefrLevel of CEFR_LEVELS) {
      const artId = crypto.randomUUID();
      const body = articlesByCefr[genre][cefrLevel];
      db.prepare(`
        INSERT OR REPLACE INTO daily_extracted_articles (id, user_id, quota_date, theme, genre, cefr_level, article, words_json, phrases_json, sentences_json, duration, input_signature, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        artId, targetUser, packDate, theme, genre, cefrLevel, body,
        JSON.stringify([{ word: 'strategy' }, { word: 'leverage' }]),
        JSON.stringify(['strategic flexibility', 'firm pressure']),
        JSON.stringify([body.split('.')[0] + '.']),
        DURATION, `sig_1m_${genre}_${cefrLevel}_diff`, now, now
      );

      // Also write to daily_listen_articles so getPregeneratedCombo / L2 fallback can find it
      db.prepare(`
        INSERT OR REPLACE INTO daily_listen_articles (id, user_id, pack_date, theme, genre, cefr_level, duration, body_text, vocab_json, phrases_json, file_path, status, source, created_at, updated_at, input_signature)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        artId, targetUser, packDate, theme, genre, cefrLevel, Number(DURATION), body,
        JSON.stringify([{ word: 'strategy' }, { word: 'leverage' }]),
        JSON.stringify(['strategic flexibility', 'firm pressure']),
        null, 'ready', 'cron', now, now, `sig_1m_${genre}_${cefrLevel}_diff`
      );

      const audioId = crypto.randomUUID();
      const audioUrl = `/api/daily_listen_audio/${targetUser}/${packDate}_${genre}_${cefrLevel}_1m.mp3`;
      db.prepare(`
        INSERT OR REPLACE INTO daily_listen_audios (id, user_id, pack_date, theme, genre, cefr_level, duration, audio_url, status, created_at, updated_at, input_signature)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(audioId, targetUser, packDate, theme, genre, cefrLevel, 1, audioUrl, 'ready', now, now, `sig_1m_${genre}_${cefrLevel}_diff`);
    }
  }"""

if old_loop in code:
    code = code.replace(old_loop, new_loop)
    print("Loop replaced successfully.")
else:
    # Try normalizing newlines
    code_norm = code.replace('\r\n', '\n')
    old_loop_norm = old_loop.replace('\r\n', '\n')
    new_loop_norm = new_loop.replace('\r\n', '\n')
    if old_loop_norm in code_norm:
        code = code_norm.replace(old_loop_norm, new_loop_norm)
        print("Loop replaced with normalized newlines.")
    else:
        print("Loop pattern not found!")

with open('vocab-server/scripts/run-real-2am-lzhmy.js', 'w', encoding='utf-8') as f:
    f.write(code)