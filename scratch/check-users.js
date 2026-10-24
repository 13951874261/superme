const Database = require('better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db');
console.log('recent login logs:', db.prepare("SELECT * FROM user_login_logs ORDER BY logged_at DESC LIMIT 10").all());
console.log('recent theme prefs:', db.prepare("SELECT * FROM user_theme_prefs ORDER BY updated_at DESC LIMIT 10").all());
db.close();