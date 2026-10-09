const Database = require('D:\\cursor\\work\\super-agent\\vocab-server\\node_modules\\better-sqlite3');
const path = 'C:/Users/lzhumy/.codex/logs_2.sqlite';
const db = new Database(path, { readonly: true, fileMustExist: true });

// Discover tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('TABLES:', JSON.stringify(tables.map(t => t.name)));

for (const t of tables) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${t.name})`).all();
    console.log(`\n== ${t.name} columns: ${cols.map(c => c.name).join(', ')}`);
    const cnt = db.prepare(`SELECT COUNT(*) c FROM ${t.name}`).get();
    console.log(`   rows: ${cnt.c}`);
  } catch (e) {
    console.log(`   error reading ${t.name}: ${e.message}`);
  }
}
db.close();
