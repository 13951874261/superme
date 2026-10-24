const Database = require('better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db');

const row = db.prepare(`
  SELECT id, word, payload FROM vocabulary
  WHERE user_id = ? AND word = ? COLLATE NOCASE
  ORDER BY added_at DESC LIMIT 1
`).get('lzhmy', 'mud');

if (!row) {
  console.log('mud vocab not found');
  process.exit(0);
}

const p = JSON.parse(row.payload);
console.log('before', {
  syn: p.synonyms,
  biz0: (p.business_examples || [])[0],
});

const biz = Array.isArray(p.business_examples) ? p.business_examples : [];
const re = /\bmud\b/i;
const mentions = biz.some((item) => re.test(typeof item === 'string' ? item : JSON.stringify(item || {})));
if (!mentions && biz.length > 0) {
  p.synonyms = [];
  p.antonyms = [];
  p.collocations = [];
  p.business_examples = [];
  p.etymology = '';
  db.prepare('UPDATE vocabulary SET payload = ? WHERE id = ?').run(JSON.stringify(p), row.id);
  console.log('cleaned mud enrichment fields');
} else {
  console.log('no clean needed', { mentions, bizLen: biz.length });
}

const after = JSON.parse(db.prepare('SELECT payload FROM vocabulary WHERE id = ?').get(row.id).payload);
console.log('after', {
  syn: after.synonyms,
  biz: after.business_examples,
  meaning: after.meaning || after.translation_main,
});
