const Database = require('better-sqlite3');
const word = process.argv[2] || 'organise';
const userId = process.argv[3] || 'lzhmy';
const db = new Database('/var/www/super-agent/vocab.db');

const rows = db.prepare(`
  SELECT created_at, length(response_payload) AS len, response_payload
  FROM dict_query_log
  WHERE word = ? COLLATE NOCASE AND user_id = ? AND is_success = 1
  ORDER BY created_at DESC
  LIMIT 5
`).all(word, userId);

for (const row of rows) {
  try {
    const j = JSON.parse(row.response_payload);
    const p = j.payload || {};
    console.log(JSON.stringify({
      created_at: row.created_at,
      len: row.len,
      fromCacheLike: !!j.fromCache,
      direction: p.direction_resolved,
      translation: (p.translation_main || p.meaning_zh || '').slice(0, 40),
      examples: Array.isArray(p.example_sentences) ? p.example_sentences.length : 0,
      senses: Array.isArray(p.senses) ? p.senses.length : 0,
      senseExamples: Array.isArray(p.senses)
        ? p.senses.reduce((n, s) => n + ((s.examples || []).length), 0)
        : 0,
      idioms: Array.isArray(p.idioms) ? p.idioms.length : 0,
      synonyms: Array.isArray(p.synonyms) ? p.synonyms.length : 0,
      collocations: Array.isArray(p.collocations) ? p.collocations.length : 0,
      antonyms: Array.isArray(p.antonyms) ? p.antonyms.length : 0,
      etymology: !!(p.etymology && String(p.etymology).trim()),
      business: Array.isArray(p.business_examples) ? p.business_examples.length : 0,
      hasCambridgeRaw: !!p.cambridge_raw,
    }));
  } catch (e) {
    console.log('parse_fail', row.created_at, e.message);
  }
}

const vocab = db.prepare(`
  SELECT length(payload) AS len, payload FROM vocabulary
  WHERE user_id = ? AND word = ? COLLATE NOCASE
  ORDER BY added_at DESC LIMIT 1
`).get(userId, word);
if (vocab?.payload) {
  try {
    const p = JSON.parse(vocab.payload);
    console.log('vocab_keys', Object.keys(p).slice(0, 30));
    console.log('vocab_summary', {
      meaning: (p.meaning || p.meaning_zh || '').slice(0, 40),
      examples: Array.isArray(p.examples) ? p.examples.length : 0,
      hasPhonetic: !!p.phonetic,
    });
  } catch (e) {
    console.log('vocab_parse_fail', e.message);
  }
} else {
  console.log('vocab: none');
}
