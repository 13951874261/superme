const Database = require('better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db');

function mentionsWord(word, list) {
  const re = new RegExp(`\\b${String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return (list || []).some((item) => re.test(typeof item === 'string' ? item : JSON.stringify(item || {})));
}

const rows = db.prepare(`
  SELECT id, user_id, word, payload FROM vocabulary
  WHERE payload IS NOT NULL
`).all();

let cleaned = 0;
for (const row of rows) {
  let p;
  try { p = JSON.parse(row.payload); } catch { continue; }
  const biz = Array.isArray(p.business_examples) ? p.business_examples : [];
  if (biz.length === 0) continue;
  if (mentionsWord(row.word, biz)) continue;
  p.synonyms = [];
  p.antonyms = [];
  p.collocations = [];
  p.business_examples = [];
  p.etymology = '';
  db.prepare('UPDATE vocabulary SET payload = ? WHERE id = ?').run(JSON.stringify(p), row.id);
  cleaned += 1;
  console.log('cleaned', row.user_id, row.word);
}
console.log('done, cleaned=', cleaned);
