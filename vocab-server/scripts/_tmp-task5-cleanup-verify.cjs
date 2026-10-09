/**
 * Task 5 verify: cleanupDailyListenStorage with tiny capacityBytes.
 * Uses in-memory mock DB + real temp files under AUDIO_ROOT/ARTICLE_ROOT test user dirs.
 * Run: node vocab-server/scripts/_tmp-task5-cleanup-verify.cjs
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const svc = require('../services/dailyListenPreGenerateService');
const dailyPackService = require('../services/dailyPackService');

const TEST_UID = `_cleanup_test_${Date.now()}`;

function writeBig(p, bytes) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, Buffer.alloc(bytes, 0x61));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function makeMockDb() {
  const articles = [];
  const audios = [];
  return {
    _articles: articles,
    _audios: audios,
    prepare(sql) {
      const s = String(sql);
      return {
        all(...args) {
          if (/FROM daily_listen_articles WHERE pack_date </.test(s)) {
            return articles.filter((r) => r.pack_date < args[0]);
          }
          if (/FROM daily_listen_audios WHERE pack_date </.test(s)) {
            return audios.filter((r) => r.pack_date < args[0]);
          }
          return [];
        },
        get() {
          if (/FROM daily_listen_audios ORDER BY created_at ASC/.test(s)) {
            return audios.slice().sort((a, b) => a.created_at - b.created_at)[0] || undefined;
          }
          if (/FROM daily_listen_articles ORDER BY created_at ASC/.test(s)) {
            return articles.slice().sort((a, b) => a.created_at - b.created_at)[0] || undefined;
          }
          return undefined;
        },
        run(...args) {
          if (/DELETE FROM daily_listen_articles WHERE id=/.test(s)) {
            const i = articles.findIndex((r) => r.id === args[0]);
            if (i >= 0) articles.splice(i, 1);
            return;
          }
          if (/DELETE FROM daily_listen_audios WHERE id=/.test(s)) {
            const i = audios.findIndex((r) => r.id === args[0]);
            if (i >= 0) audios.splice(i, 1);
          }
        },
      };
    },
  };
}

function main() {
  const db = makeMockDb();
  const packDate = dailyPackService.getPackDate();
  const artDir = path.join(svc.ARTICLE_ROOT, TEST_UID);
  const audDir = path.join(svc.AUDIO_ROOT, TEST_UID);
  const artPath1 = path.join(artDir, 'old.txt');
  const artPath2 = path.join(artDir, 'newer.txt');
  const audPath1 = path.join(audDir, 'old.mp3');

  writeBig(artPath1, 4000);
  writeBig(artPath2, 4000);
  writeBig(audPath1, 4000);

  const now = Date.now();
  db._articles.push(
    { id: crypto.randomUUID(), user_id: TEST_UID, pack_date: packDate, file_path: artPath1, created_at: now - 3000 },
    { id: crypto.randomUUID(), user_id: TEST_UID, pack_date: packDate, file_path: artPath2, created_at: now - 1000 },
  );
  db._audios.push(
    { id: crypto.randomUUID(), user_id: TEST_UID, pack_date: packDate, audio_path: audPath1, created_at: now - 2000 },
  );

  const before = svc.dirSize(artDir) + svc.dirSize(audDir);
  assert(before >= 12000, `expected >=12000 bytes under test dirs, got ${before}`);

  const result = svc.cleanupDailyListenStorage(db, { capacityBytes: 5000 });

  assert(fs.existsSync(artPath2), 'newest article file should remain');
  assert(!fs.existsSync(artPath1), 'oldest article file should be deleted');
  assert(!fs.existsSync(audPath1), 'older audio file should be deleted');
  assert(db._articles.length === 1, `expected 1 article row, got ${db._articles.length}`);
  assert(db._audios.length === 0, `expected 0 audio rows, got ${db._audios.length}`);
  assert(typeof result.totalBytes === 'number', 'cleanup returned totalBytes');
  assert(typeof result.cutoffDate === 'string', 'cleanup returned cutoffDate');

  // retention: old pack_date
  const oldPath = path.join(artDir, 'ancient.txt');
  writeBig(oldPath, 100);
  db._articles.push({
    id: crypto.randomUUID(),
    user_id: TEST_UID,
    pack_date: '2000-01-01',
    file_path: oldPath,
    created_at: now,
  });
  svc.cleanupDailyListenStorage(db, { capacityBytes: 1024 * 1024 * 1024 });
  assert(!fs.existsSync(oldPath), 'retention should unlink old pack_date file');
  assert(!db._articles.some((r) => r.pack_date === '2000-01-01'), 'retention should delete old pack_date rows');

  try { fs.rmSync(artDir, { recursive: true, force: true }); } catch (_) {}
  try { fs.rmSync(audDir, { recursive: true, force: true }); } catch (_) {}

  console.log('PASS cleanupDailyListenStorage capacity + retention');
}

try {
  main();
} catch (e) {
  console.error('FAIL', e);
  process.exit(1);
}
