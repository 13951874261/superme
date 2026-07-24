/**
 * Daily listen pregenerate smoke (T1–T8), no real Dify/TTS.
 * Uses in-memory mock DB (Node 23 may not load better-sqlite3).
 *
 * Run: node vocab-server/scripts/smoke-daily-listen.mjs
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import assert from 'assert';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svc = require('../services/dailyListenPreGenerateService');
const dailyPackCronSrc = fs.readFileSync(
  path.join(__dirname, '../services/dailyPackCron.js'),
  'utf8',
);

const SMOKE_USER = `smoke_${Date.now()}`;
const THEME = '高管会议';
const PACK_DATE = '2026-07-24';

function createMemoryDb() {
  const tables = {
    user_login_logs: [],
    user_theme_prefs: [],
    daily_listen_articles: [],
    daily_listen_audios: [],
  };

  const matchCombo = (row, args) =>
    row.user_id === args[0] &&
    row.pack_date === args[1] &&
    row.theme === args[2] &&
    row.genre === args[3] &&
    row.cefr_level === args[4] &&
    Number(row.duration) === Number(args[5]);

  return {
    tables,
    prepare(sql) {
      const s = sql.replace(/\s+/g, ' ').trim();
      return {
        run(...args) {
          if (/INSERT OR IGNORE INTO user_login_logs/.test(s)) {
            const [user_id, logged_at] = args;
            if (!tables.user_login_logs.some((r) => r.user_id === user_id && r.logged_at === logged_at)) {
              tables.user_login_logs.push({ user_id, logged_at });
            }
            return { changes: 1 };
          }
          if (/DELETE FROM user_login_logs WHERE user_id/.test(s)) {
            const [user_id, cutoff] = args;
            tables.user_login_logs = tables.user_login_logs.filter(
              (r) => !(r.user_id === user_id && r.logged_at < cutoff),
            );
            return { changes: 1 };
          }
          if (/INSERT INTO user_theme_prefs|INSERT INTO user_theme_prefs/.test(s)) {
            return { changes: 0 };
          }
          if (/INSERT INTO daily_listen_articles/.test(s)) {
            const [
              id, user_id, pack_date, theme, genre, cefr_level, duration,
              body_text, vocab_json, phrases_json, file_path, status, source, error_message, created_at, updated_at,
            ] = args;
            tables.daily_listen_articles.push({
              id, user_id, pack_date, theme, genre, cefr_level, duration,
              body_text, vocab_json, phrases_json, file_path, status, source, error_message, created_at, updated_at,
            });
            return { changes: 1 };
          }
          if (/UPDATE daily_listen_articles SET/.test(s)) {
            const row = tables.daily_listen_articles.find((r) => r.id === args[args.length - 1]);
            if (row) {
              [
                'body_text', 'vocab_json', 'phrases_json', 'file_path',
                'status', 'source', 'error_message', 'updated_at',
              ].forEach((k, i) => {
                if (args[i] !== undefined) row[k] = args[i];
              });
            }
            return { changes: 1 };
          }
          if (/INSERT INTO daily_listen_audios/.test(s)) {
            const [
              id, user_id, pack_date, theme, genre, cefr_level, duration,
              script_text, audio_path, audio_url, status, source, error_message, created_at, updated_at,
            ] = args;
            tables.daily_listen_audios.push({
              id, user_id, pack_date, theme, genre, cefr_level, duration,
              script_text, audio_path, audio_url, status, source, error_message, created_at, updated_at,
            });
            return { changes: 1 };
          }
          if (/UPDATE daily_listen_audios SET/.test(s)) {
            const row = tables.daily_listen_audios.find((r) => r.id === args[args.length - 1]);
            if (row) {
              [
                'script_text', 'audio_path', 'audio_url',
                'status', 'source', 'error_message', 'updated_at',
              ].forEach((k, i) => {
                if (args[i] !== undefined) row[k] = args[i];
              });
            }
            return { changes: 1 };
          }
          if (/DELETE FROM daily_listen_articles WHERE id/.test(s)) {
            tables.daily_listen_articles = tables.daily_listen_articles.filter((r) => r.id !== args[0]);
            return { changes: 1 };
          }
          if (/DELETE FROM daily_listen_audios WHERE id/.test(s)) {
            tables.daily_listen_audios = tables.daily_listen_audios.filter((r) => r.id !== args[0]);
            return { changes: 1 };
          }
          return { changes: 0 };
        },
        get(...args) {
          if (/FROM daily_listen_articles WHERE user_id/.test(s)) {
            return tables.daily_listen_articles.find((r) => matchCombo(r, args)) || undefined;
          }
          if (/FROM daily_listen_audios WHERE user_id/.test(s)) {
            return tables.daily_listen_audios.find((r) => matchCombo(r, args)) || undefined;
          }
          if (/FROM daily_listen_audios ORDER BY created_at ASC LIMIT 1/.test(s)) {
            return [...tables.daily_listen_audios].sort((a, b) => a.created_at - b.created_at)[0];
          }
          if (/FROM daily_listen_articles ORDER BY created_at ASC LIMIT 1/.test(s)) {
            return [...tables.daily_listen_articles].sort((a, b) => a.created_at - b.created_at)[0];
          }
          return undefined;
        },
        all(...args) {
          if (/FROM user_theme_prefs/.test(s) && /user_login_logs/.test(s)) {
            const since = args[0];
            return tables.user_theme_prefs.filter((p) => {
              if (!p.theme || !String(p.theme).trim()) return false;
              return tables.user_login_logs.some((l) => l.user_id === p.user_id && l.logged_at >= since);
            });
          }
          if (/FROM daily_listen_articles WHERE pack_date </.test(s)) {
            return tables.daily_listen_articles.filter((r) => r.pack_date < args[0]);
          }
          if (/FROM daily_listen_audios WHERE pack_date </.test(s)) {
            return tables.daily_listen_audios.filter((r) => r.pack_date < args[0]);
          }
          return [];
        },
      };
    },
  };
}

let passed = 0;
function run(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`PASS ${name}`);
    })
    .catch((e) => {
      console.error(`FAIL ${name}`);
      console.error(e);
      process.exitCode = 1;
    });
}

async function main() {
  svc.ensureDirs();
  const db = createMemoryDb();

  // seed theme prefs for eligibility
  db.tables.user_theme_prefs.push({ user_id: SMOKE_USER, theme: THEME, synced_at: Date.now(), updated_at: Date.now() });
  db.tables.user_theme_prefs.push({ user_id: 'stale_user', theme: THEME, synced_at: Date.now(), updated_at: Date.now() });

  await run('T2 stale login not eligible before ping', () => {
    const eligible = svc.listEligibleUsers(db);
    assert.ok(!eligible.some((u) => u.user_id === 'stale_user'));
  });

  await run('login ping + T1 eligible user', () => {
    svc.recordUserLogin(db, SMOKE_USER);
    const eligible = svc.listEligibleUsers(db);
    assert.ok(eligible.some((u) => u.user_id === SMOKE_USER && u.theme === THEME));
  });

  svc.setGenerators({
    generateLongScript: async () =>
      'Smoke script body.\n---VOCAB_JSON_START---\n{"vocab":[{"word":"deal"}],"phrases":[]}\n',
    synthesizeAudioFile: async (_t, p) => {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, Buffer.from('ID3SMOKE'));
    },
  });

  await run('T1 generateOneCombo ready (meeting/B1/15)', async () => {
    const result = await svc.generateOneCombo(
      db,
      { userId: SMOKE_USER, theme: THEME, genre: 'meeting', cefrLevel: 'B1', duration: 15, packDate: PACK_DATE },
      { source: 'cron' },
    );
    assert.strictEqual(result.status, 'ready');
    assert.strictEqual(result.articleStatus, 'ready');
    assert.strictEqual(result.audioStatus, 'ready');
  });

  await run('T3 GET meeting/B1/15 ready', () => {
    const r = svc.getPregeneratedCombo(db, {
      userId: SMOKE_USER,
      theme: THEME,
      genre: 'meeting',
      cefrLevel: 'B1',
      duration: 15,
      date: PACK_DATE,
    });
    assert.strictEqual(r.status, 'ready');
    assert.ok(r.article?.body);
    assert.ok(r.audio?.audioUrl);
  });

  await run('T4 failed row => canBackfill', () => {
    const art = db.tables.daily_listen_articles.find(
      (r) => r.user_id === SMOKE_USER && r.genre === 'meeting' && r.duration === 15,
    );
    art.status = 'failed';
    art.error_message = 'boom';
    const r = svc.getPregeneratedCombo(db, {
      userId: SMOKE_USER,
      theme: THEME,
      genre: 'meeting',
      cefrLevel: 'B1',
      duration: 15,
      date: PACK_DATE,
    });
    assert.ok(r.status === 'failed' || r.status === 'partial');
    assert.strictEqual(r.canBackfill, true);
    art.status = 'ready';
  });

  await run('T5 backfill task type wiring (source code)', () => {
    const serverJs = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    assert.ok(serverJs.includes("createTask(\n      'listen_backfill'") || serverJs.includes("createTask('listen_backfill'") || serverJs.includes("'listen_backfill'"));
    assert.ok(serverJs.includes('/api/listen/pregenerated/backfill'));
  });

  await run('T6 delete audio file => missing/partial canBackfill', () => {
    const aud = db.tables.daily_listen_audios.find(
      (r) => r.user_id === SMOKE_USER && r.genre === 'meeting' && Number(r.duration) === 15,
    );
    assert.ok(aud?.audio_path);
    if (fs.existsSync(aud.audio_path)) fs.unlinkSync(aud.audio_path);
    aud.audio_url = null;
    const r = svc.getPregeneratedCombo(db, {
      userId: SMOKE_USER,
      theme: THEME,
      genre: 'meeting',
      cefrLevel: 'B1',
      duration: 15,
      date: PACK_DATE,
    });
    assert.ok(r.status === 'partial' || r.status === 'missing');
    assert.strictEqual(r.canBackfill, true);
  });

  await run('T7 cleanup retention (>7 days)', () => {
    const oldPath = path.join(svc.ARTICLE_ROOT, SMOKE_USER, 'old.txt');
    fs.mkdirSync(path.dirname(oldPath), { recursive: true });
    fs.writeFileSync(oldPath, 'old');
    db.tables.daily_listen_articles.push({
      id: 'old-art',
      user_id: SMOKE_USER,
      pack_date: '2020-01-01',
      theme: THEME,
      genre: 'news',
      cefr_level: 'A2',
      duration: 5,
      body_text: 'old',
      file_path: oldPath,
      status: 'ready',
      source: 'cron',
      created_at: 1,
      updated_at: 1,
    });
    const before = db.tables.daily_listen_articles.some((r) => r.id === 'old-art');
    assert.ok(before);
    svc.cleanupDailyListenStorage(db, { capacityBytes: 1024 * 1024 * 1024 });
    assert.ok(!db.tables.daily_listen_articles.some((r) => r.id === 'old-art'));
    assert.ok(!fs.existsSync(oldPath));
  });

  await run('T8 capacity cleanup deletes oldest', () => {
    const p1 = path.join(svc.AUDIO_ROOT, SMOKE_USER, 'cap1.bin');
    const p2 = path.join(svc.AUDIO_ROOT, SMOKE_USER, 'cap2.bin');
    fs.mkdirSync(path.dirname(p1), { recursive: true });
    fs.writeFileSync(p1, Buffer.alloc(8000, 1));
    fs.writeFileSync(p2, Buffer.alloc(8000, 2));
    db.tables.daily_listen_audios.push(
      {
        id: 'cap-old',
        user_id: SMOKE_USER,
        pack_date: PACK_DATE,
        theme: THEME,
        genre: 'podcast',
        cefr_level: 'C1',
        duration: 25,
        audio_path: p1,
        audio_url: '/x1',
        status: 'ready',
        source: 'cron',
        created_at: 10,
        updated_at: 10,
      },
      {
        id: 'cap-new',
        user_id: SMOKE_USER,
        pack_date: PACK_DATE,
        theme: THEME,
        genre: 'podcast',
        cefr_level: 'C1',
        duration: 5,
        audio_path: p2,
        audio_url: '/x2',
        status: 'ready',
        source: 'cron',
        created_at: 20,
        updated_at: 20,
      },
    );
    svc.cleanupDailyListenStorage(db, { capacityBytes: 9000 });
    assert.ok(!db.tables.daily_listen_audios.some((r) => r.id === 'cap-old'));
  });

  await run('cron order: pack then listen', () => {
    assert.ok(dailyPackCronSrc.includes('runDailyPackCronJob(db)'));
    assert.ok(dailyPackCronSrc.includes('runDailyListenCronJob(db)'));
    const packIdx = dailyPackCronSrc.indexOf('await runDailyPackCronJob');
    const listenIdx = dailyPackCronSrc.indexOf('runDailyListenCronJob');
    assert.ok(packIdx >= 0 && listenIdx > packIdx);
  });

  await run('36 combos dimensions', () => {
    assert.strictEqual(svc.GENRES.length * svc.CEFR_LEVELS.length * svc.DURATIONS.length, 36);
    assert.deepStrictEqual(svc.DURATIONS, [5, 15, 25]);
    assert.strictEqual(svc.CAPACITY_BYTES, 1024 * 1024 * 1024);
  });

  // cleanup smoke files under user dir
  try {
    const userAudio = path.join(svc.AUDIO_ROOT, SMOKE_USER);
    const userArt = path.join(svc.ARTICLE_ROOT, SMOKE_USER);
    if (fs.existsSync(userAudio)) fs.rmSync(userAudio, { recursive: true, force: true });
    if (fs.existsSync(userArt)) fs.rmSync(userArt, { recursive: true, force: true });
  } catch (_) {}

  console.log(`\nDone: ${passed} checks`);
}

main();
