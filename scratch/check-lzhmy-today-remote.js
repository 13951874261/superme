'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const USER_CANDIDATES = ['lzhmy', 'lzhumy'];
const GENRES = ['meeting', 'news', 'podcast', 'reading'];
const CEFRS = ['A2', 'B1', 'B2', 'C1'];
const DURATIONS = [1, 15, 25, 35];
const DB_CANDIDATES = [
  '/var/www/super-agent/vocab.db',
  '/var/www/super-agent/vocab-server/vocab.db',
];
const AUDIO_ROOTS = [
  '/var/www/super-agent/vocab-server/public/daily_listen_audio',
  '/var/www/super-agent/public/daily_listen_audio',
];

function shanghaiDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function tableExists(db, name) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

function columns(db, name) {
  return db.prepare(`PRAGMA table_info(${name})`).all().map((c) => c.name);
}

function comboKey(genre, cefr, duration) {
  return `${String(genre || '').trim()}|${String(cefr || '').trim()}|${String(duration)}`;
}

function fileExists(p) {
  if (!p) return false;
  try {
    return fs.existsSync(p) && fs.statSync(p).size > 0;
  } catch {
    return false;
  }
}

function resolveAudioPath(row) {
  const candidates = [];
  if (row.audio_path) candidates.push(row.audio_path);
  if (row.audio_url) {
    const m = String(row.audio_url).match(/\/api\/daily_listen_audio\/(.+)$/);
    if (m) {
      for (const root of AUDIO_ROOTS) {
        candidates.push(path.join(root, m[1]));
      }
    }
  }
  for (const c of candidates) {
    if (fileExists(c)) return { path: c, exists: true, size: fs.statSync(c).size };
  }
  return { path: candidates[0] || '', exists: false, size: 0 };
}

function main() {
  const today = shanghaiDate();
  console.log(`=== lzhmy 今日生成检查 ===`);
  console.log(`上海日期: ${today}`);
  console.log(`查询账号: ${USER_CANDIDATES.join(', ')}`);
  console.log(`期望矩阵: ${GENRES.length}体裁 x ${CEFRS.length}难度 x ${DURATIONS.length}时长 = ${GENRES.length * CEFRS.length * DURATIONS.length}`);

  const dbPath = DB_CANDIDATES.find((p) => fs.existsSync(p));
  if (!dbPath) {
    console.error('找不到 vocab.db:', DB_CANDIDATES.join(', '));
    process.exit(1);
  }
  console.log(`数据库: ${dbPath}`);
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });

  const placeholders = USER_CANDIDATES.map(() => '?').join(', ');

  if (tableExists(db, 'user_theme_prefs')) {
    const prefs = db.prepare(`SELECT * FROM user_theme_prefs WHERE user_id IN (${placeholders})`).all(...USER_CANDIDATES);
    console.log('\n[user_theme_prefs]');
    console.log(prefs.length ? JSON.stringify(prefs, null, 2) : '无');
  }

  if (tableExists(db, 'user_listen_prefs')) {
    const rows = db.prepare(`SELECT * FROM user_listen_prefs WHERE user_id IN (${placeholders})`).all(...USER_CANDIDATES);
    console.log('\n[user_listen_prefs]');
    console.log(rows.length ? JSON.stringify(rows, null, 2) : '无');
  }

  if (tableExists(db, 'daily_packs')) {
    const packs = db.prepare(`
      SELECT user_id, pack_date, theme, status, length(COALESCE(wakeup_json,'')) AS wakeup_len
      FROM daily_packs
      WHERE user_id IN (${placeholders}) AND pack_date = ?
    `).all(...USER_CANDIDATES, today);
    console.log('\n[daily_packs 今日]');
    console.log(packs.length ? JSON.stringify(packs, null, 2) : '无');
  }

  const extractedCols = tableExists(db, 'daily_extracted_articles') ? columns(db, 'daily_extracted_articles') : [];
  const extractedHasStatus = extractedCols.includes('status');
  const extracted = tableExists(db, 'daily_extracted_articles')
    ? db.prepare(`
        SELECT user_id, quota_date, theme, genre, cefr_level, duration,
               length(COALESCE(article,'')) AS article_len,
               ${extractedHasStatus ? 'status' : "'' AS status"}
        FROM daily_extracted_articles
        WHERE user_id IN (${placeholders}) AND quota_date = ?
        ORDER BY genre, cefr_level, CAST(duration AS INTEGER)
      `).all(...USER_CANDIDATES, today)
    : [];

  const listenArticles = tableExists(db, 'daily_listen_articles')
    ? db.prepare(`
        SELECT user_id, pack_date, theme, genre, cefr_level, duration, status,
               length(COALESCE(body_text,'')) AS body_len,
               file_path, error_message
        FROM daily_listen_articles
        WHERE user_id IN (${placeholders}) AND pack_date = ?
        ORDER BY genre, cefr_level, duration
      `).all(...USER_CANDIDATES, today)
    : [];

  const listenAudios = tableExists(db, 'daily_listen_audios')
    ? db.prepare(`
        SELECT user_id, pack_date, theme, genre, cefr_level, duration, status,
               audio_path, audio_url, error_message,
               length(COALESCE(script_text,'')) AS script_len
        FROM daily_listen_audios
        WHERE user_id IN (${placeholders}) AND pack_date = ?
        ORDER BY genre, cefr_level, duration
      `).all(...USER_CANDIDATES, today)
    : [];

  const extractedMap = new Map(extracted.map((r) => [comboKey(r.genre, r.cefr_level, r.duration), r]));
  const articleMap = new Map(listenArticles.map((r) => [comboKey(r.genre, r.cefr_level, r.duration), r]));
  const audioMap = new Map(listenAudios.map((r) => [comboKey(r.genre, r.cefr_level, r.duration), r]));

  console.log('\n[矩阵逐项]');
  console.log(['combo', 'extracted_len', 'listen_article', 'listen_audio', 'mp3_exists', 'mp3_size'].join('\t'));
  let readyBoth = 0;
  let missingExtract = 0;
  let missingArticle = 0;
  let missingAudio = 0;
  let missingFile = 0;
  const missingRows = [];
  const readyRows = [];

  for (const genre of GENRES) {
    for (const cefr of CEFRS) {
      for (const duration of DURATIONS) {
        const key = comboKey(genre, cefr, duration);
        const ex = extractedMap.get(key);
        const art = articleMap.get(key);
        const aud = audioMap.get(key);
        const file = aud ? resolveAudioPath(aud) : { path: '', exists: false, size: 0 };
        const extractOk = !!(ex && Number(ex.article_len) > 50);
        const articleOk = !!(art && (art.status === 'ready' || Number(art.body_len) > 50));
        const audioOk = !!(aud && (aud.status === 'ready' || file.exists));
        if (extractOk && articleOk && audioOk && file.exists) {
          readyBoth += 1;
          readyRows.push(key);
        } else {
          if (!extractOk) missingExtract += 1;
          if (!articleOk) missingArticle += 1;
          if (!audioOk) missingAudio += 1;
          if (!file.exists) missingFile += 1;
          missingRows.push({
            key,
            extract: extractOk ? ex.article_len : 'MISSING',
            article: art ? `${art.status}/${art.body_len}` : 'MISSING',
            audio: aud ? `${aud.status}/${aud.error_message || ''}` : 'MISSING',
            file: file.exists ? file.size : 'MISSING',
          });
        }
        console.log([
          key,
          extractOk ? ex.article_len : '-',
          art ? `${art.status}:${art.body_len}` : '-',
          aud ? `${aud.status}` : '-',
          file.exists ? 'Y' : 'N',
          file.size || 0,
        ].join('\t'));
      }
    }
  }

  console.log('\n[汇总]');
  console.log(`期望组合: 64`);
  console.log(`daily_extracted_articles 今日行数: ${extracted.length}`);
  console.log(`daily_listen_articles 今日行数: ${listenArticles.length}`);
  console.log(`daily_listen_audios 今日行数: ${listenAudios.length}`);
  console.log(`长文+音频+磁盘文件齐全: ${readyBoth}/64`);
  console.log(`缺长文 extracted: ${missingExtract}`);
  console.log(`缺 listen_article: ${missingArticle}`);
  console.log(`缺 listen_audio 记录/ready: ${missingAudio}`);
  console.log(`缺磁盘 mp3: ${missingFile}`);

  const extraExtracted = extracted.filter((r) => !GENRES.includes(r.genre) || !CEFRS.includes(r.cefr_level));
  const extraAudio = listenAudios.filter((r) => !GENRES.includes(r.genre) || !CEFRS.includes(r.cefr_level));
  if (extraExtracted.length || extraAudio.length) {
    console.log('\n[矩阵外额外记录]');
    extraExtracted.forEach((r) => console.log('extracted extra', comboKey(r.genre, r.cefr_level, r.duration), r.article_len));
    extraAudio.forEach((r) => console.log('audio extra', comboKey(r.genre, r.cefr_level, r.duration), r.status));
  }

  console.log('\n[未齐组合明细]');
  if (!missingRows.length) {
    console.log('全部 64 组合齐全');
  } else {
    missingRows.forEach((r) => {
      console.log(`${r.key}\textract=${r.extract}\tarticle=${r.article}\taudio=${r.audio}\tmp3=${r.file}`);
    });
  }

  if (tableExists(db, 'daily_cron_runs')) {
    const runs = db.prepare(`
      SELECT id, user_id, pack_date, status, trigger_source, progress, execution_status,
             datetime(created_at/1000, 'unixepoch', 'Asia/Shanghai') AS created_sh,
             error_message
      FROM daily_cron_runs
      WHERE user_id IN (${placeholders}) AND pack_date = ?
      ORDER BY created_at DESC
    `).all(...USER_CANDIDATES, today);
    console.log('\n[daily_cron_runs 今日]');
    console.log(runs.length ? JSON.stringify(runs, null, 2) : '无');

    if (runs.length && tableExists(db, 'daily_cron_steps')) {
      const runId = runs[0].id;
      const steps = db.prepare(`
        SELECT module, combo_key, status, progress, error_message
        FROM daily_cron_steps
        WHERE run_id = ?
        ORDER BY module, combo_key
      `).all(runId);
      const byModule = {};
      for (const s of steps) {
        const k = `${s.module}:${s.status}`;
        byModule[k] = (byModule[k] || 0) + 1;
      }
      console.log(`\n[daily_cron_steps 最新 run ${runId}]`);
      console.log(JSON.stringify(byModule, null, 2));
      const failed = steps.filter((s) => s.status === 'failed' || s.status === 'missing');
      if (failed.length) {
        console.log('失败/缺失步骤:');
        failed.forEach((s) => console.log(`${s.module}|${s.combo_key}|${s.status}|${s.error_message || ''}`));
      }
    }
  }

  console.log('\n[磁盘音频目录]');
  for (const root of AUDIO_ROOTS) {
    for (const user of USER_CANDIDATES) {
      const dir = path.join(root, user);
      if (!fs.existsSync(dir)) {
        console.log(`${dir}: 不存在`);
        continue;
      }
      const files = fs.readdirSync(dir).filter((f) => f.includes(today) || f.endsWith('.mp3'));
      const todayFiles = fs.readdirSync(dir).filter((f) => f.includes(today.replace(/-/g, '')) || f.includes(today));
      const allMp3 = fs.readdirSync(dir).filter((f) => f.endsWith('.mp3'));
      console.log(`${dir}: 全部mp3=${allMp3.length}, 文件名含今日日期=${todayFiles.length}`);
      todayFiles.slice(0, 30).forEach((f) => {
        const st = fs.statSync(path.join(dir, f));
        console.log(`  ${f}\t${st.size}`);
      });
      if (todayFiles.length > 30) console.log(`  ... 还有 ${todayFiles.length - 30} 个`);
      if (!todayFiles.length && allMp3.length) {
        console.log('  今日无日期匹配文件，列出最近 15 个 mp3:');
        allMp3
          .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs, size: fs.statSync(path.join(dir, f)).size }))
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, 15)
          .forEach((x) => console.log(`  ${x.f}\t${x.size}\t${new Date(x.mtime).toISOString()}`));
      }
    }
  }

  db.close();
}

main();
