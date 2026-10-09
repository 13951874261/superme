const Database = require('better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db', { readonly: true });

function summarizePayload(raw) {
  try {
    const j = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const p = j.payload || j;
    const biz0 = (p.business_examples || [])[0];
    return {
      headword: p.headword || '',
      meaning: (p.translation_main || p.meaning || '').slice(0, 40),
      syn: (p.synonyms || []).slice(0, 5),
      ant: (p.antonyms || []).slice(0, 5),
      biz0: typeof biz0 === 'object' ? biz0.en : biz0,
      col: (p.collocations || []).slice(0, 3),
    };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

const rows = db.prepare(`
  SELECT user_id, word, response_payload, created_at
  FROM dict_query_log
  WHERE word IN ('mud', 'bug') COLLATE NOCASE AND is_success = 1
  ORDER BY created_at DESC
  LIMIT 12
`).all();

console.log('=== dict_query_log ===');
for (const r of rows) {
  console.log(JSON.stringify({
    user: r.user_id,
    word: r.word,
    at: r.created_at,
    ...summarizePayload(r.response_payload),
  }));
}

const vocab = db.prepare(`
  SELECT user_id, word, payload, added_at
  FROM vocabulary
  WHERE word IN ('mud', 'bug') COLLATE NOCASE
  ORDER BY added_at DESC
  LIMIT 8
`).all();

console.log('=== vocabulary ===');
for (const v of vocab) {
  console.log(JSON.stringify({
    user: v.user_id,
    word: v.word,
    at: v.added_at,
    ...summarizePayload(v.payload),
  }));
}
