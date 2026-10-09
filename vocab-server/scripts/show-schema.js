const Database = require('better-sqlite3'); const db = new Database('vocab.db'); console.log(db.prepare('SELECT sql FROM sqlite_master WHERE type=\x27table\x27').all().map(r => r.sql).join('\n\n'));
