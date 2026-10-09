const Database = require('/var/www/super-agent/vocab-server/node_modules/better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db');

const columns = db.prepare("PRAGMA table_info('vocabulary')").all();
console.log('Columns in vocabulary:', columns);
