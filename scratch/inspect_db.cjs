const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../vocab-server/vocab.db'));

const rows = db.prepare('SELECT id, word, payload FROM vocabulary LIMIT 10').all();
console.log('--- SAMPLE ENTRIES ---');
for (const r of rows) {
  let parsed = {};
  try { parsed = JSON.parse(r.payload); } catch(e){}
  console.log(`Word: "${r.word}"`);
  console.log(`Payload:`, parsed);
}

const blanks = db.prepare("SELECT COUNT(*) as count FROM vocabulary").get();
console.log(`Total count: ${blanks.count}`);
db.close();
