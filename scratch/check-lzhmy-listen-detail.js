'use strict';
const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('/var/www/super-agent/vocab.db', { readonly: true, fileMustExist: true });
const today = '2026-08-22';

console.log('=== listen_articles today ===');
console.log(JSON.stringify(db.prepare(`
  SELECT genre, cefr_level, duration, status,
         length(COALESCE(body_text,'')) AS body_len,
         file_path, error_message,
         datetime(created_at/1000, 'unixepoch', '+8 hours') AS created_sh,
         datetime(updated_at/1000, 'unixepoch', '+8 hours') AS updated_sh
  FROM daily_listen_articles
  WHERE user_id='lzhmy' AND pack_date=?
  ORDER BY updated_at DESC
`).all(today), null, 2));

console.log('=== listen_audios today ===');
console.log(JSON.stringify(db.prepare(`
  SELECT genre, cefr_level, duration, status, audio_path, audio_url, error_message,
         length(COALESCE(script_text,'')) AS script_len,
         datetime(created_at/1000, 'unixepoch', '+8 hours') AS created_sh,
         datetime(updated_at/1000, 'unixepoch', '+8 hours') AS updated_sh
  FROM daily_listen_audios
  WHERE user_id='lzhmy' AND pack_date=?
`).all(today), null, 2));

console.log('=== cron listen step ===');
console.log(JSON.stringify(db.prepare(`
  SELECT module, combo_key, status, progress, error_message, attempt,
         datetime(started_at/1000, 'unixepoch', '+8 hours') AS started_sh,
         datetime(finished_at/1000, 'unixepoch', '+8 hours') AS finished_sh,
         substr(COALESCE(result_summary_json,''), 1, 800) AS result
  FROM daily_cron_steps
  WHERE run_id='run_efabf7f8-3974-4b46-ac56-b9e9a56b8aec' AND module='listen'
`).all(), null, 2));

console.log('=== cron run ===');
console.log(JSON.stringify(db.prepare(`
  SELECT id, status, progress, execution_status,
         substr(COALESCE(summary_json,''), 1, 1200) AS summary,
         datetime(started_at/1000, 'unixepoch', '+8 hours') AS started_sh,
         datetime(finished_at/1000, 'unixepoch', '+8 hours') AS finished_sh
  FROM daily_cron_runs
  WHERE id='run_efabf7f8-3974-4b46-ac56-b9e9a56b8aec'
`).get(), null, 2));

const p = '/var/www/super-agent/vocab-server/public/daily_listen_audio/lzhmy/2026-08-22_meeting_B1_25m.mp3';
const st = fs.statSync(p);
console.log('=== disk mp3 ===');
console.log(JSON.stringify({ path: p, size: st.size, mtime: st.mtime.toISOString() }, null, 2));

console.log('=== recent journal (hint) ===');
db.close();
