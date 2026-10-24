const path = require('path');
const Database = require('/var/www/super-agent/vocab-server/node_modules/better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db', { readonly: true });
const rows = db.prepare(
  "SELECT id, user_id, word, payload FROM vocabulary WHERE word LIKE ? COLLATE NOCASE ORDER BY added_at DESC LIMIT 5"
).all('%voila%');
for (const r of rows) {
  let p = {};
  try { p = JSON.parse(r.payload || '{}'); } catch {}
  console.log(JSON.stringify({
    id: r.id,
    user_id: r.user_id,
    word: r.word,
    meaning: p.meaning,
    translation_main: p.translation_main,
    meaning_zh: p.meaning_zh,
    definition_en: p.definition_en,
    phonetic: p.phonetic,
    pos: p.partOfSpeech || p.pos,
    collocations: p.collocations,
    synonyms: p.synonyms,
    business_note: p.business_note || p.business_notes,
    source: p.source,
    keys: Object.keys(p),
  }, null, 2));
}
if (rows.length === 0) console.log('NO_ROWS');
