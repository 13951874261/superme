'use strict';
const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db', { readonly: true, fileMustExist: true });
const user = 'lzhmy';
const date = '2026-08-22';
const genres = ['meeting', 'news', 'podcast', 'reading'];
const cefrs = ['A2', 'B1', 'B2', 'C1'];
const durs = [1, 15, 25, 35];

const arts = db.prepare('SELECT status, COUNT(*) AS c FROM daily_listen_articles WHERE user_id=? AND pack_date=? GROUP BY status').all(user, date);
const auds = db.prepare('SELECT status, COUNT(*) AS c FROM daily_listen_audios WHERE user_id=? AND pack_date=? GROUP BY status').all(user, date);
const extracted = db.prepare('SELECT COUNT(*) AS c FROM daily_extracted_articles WHERE user_id=? AND quota_date=?').get(user, date);
const rows = db.prepare('SELECT genre, cefr_level, duration, status, audio_path FROM daily_listen_audios WHERE user_id=? AND pack_date=?').all(user, date);
const map = new Map(rows.map((r) => [`${r.genre}|${r.cefr_level}|${r.duration}`, r]));

console.log('extracted_articles', extracted.c);
console.log('listen_articles', arts);
console.log('listen_audios', auds);

let ready = 0;
let missing = [];
for (const g of genres) {
  for (const c of cefrs) {
    for (const d of durs) {
      const k = `${g}|${c}|${d}`;
      const r = map.get(k);
      const fileOk = r && r.audio_path && fs.existsSync(r.audio_path) && fs.statSync(r.audio_path).size > 10000;
      const ok = r && r.status === 'ready' && fileOk;
      if (ok) ready += 1;
      else missing.push(`${g}/${c}/${d}m ${r ? r.status : 'NO_ROW'} file=${fileOk ? 'Y' : 'N'}`);
    }
  }
}
console.log(`ready_with_file ${ready}/64`);
console.log('not_ready:');
missing.forEach((m) => console.log(' ', m));
db.close();
