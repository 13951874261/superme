const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const Database = require('better-sqlite3');

const scriptPath = path.join(__dirname, 'check-user-daily-readiness.js');
const {
  buildReport,
  getShanghaiDate,
  getUserIdCandidates,
  resolveDatabasePath,
} = require(scriptPath);

function runScript(args, env = {}) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

function createFixture() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-readiness-'));
  const dbPath = path.join(tempDir, 'fixture.db');
  const db = new Database(dbPath);
  const now = Date.now();
  const today = getShanghaiDate(new Date(now));
  const nonToday = getShanghaiDate(new Date(now - (24 * 60 * 60 * 1000)));
  db.exec(`
    CREATE TABLE user_theme_prefs (
      user_id TEXT PRIMARY KEY,
      theme TEXT NOT NULL,
      synced_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE user_login_logs (
      user_id TEXT NOT NULL,
      logged_at INTEGER NOT NULL
    );
    CREATE TABLE daily_packs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      pack_date TEXT NOT NULL,
      theme TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE daily_extracted_articles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      quota_date TEXT NOT NULL,
      theme TEXT NOT NULL
    );
    CREATE TABLE daily_listen_articles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      pack_date TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE daily_listen_audios (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      pack_date TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `);
  db.prepare('INSERT INTO user_theme_prefs VALUES (?, ?, ?, ?)').run('lzhumy', '商务谈判', now, now);
  db.prepare('INSERT INTO user_login_logs VALUES (?, ?)').run('lzhumy', now);
  db.prepare('INSERT INTO user_login_logs VALUES (?, ?)').run('lzhumy', 0);
  const insertPack = db.prepare('INSERT INTO daily_packs VALUES (?, ?, ?, ?, ?)');
  insertPack.run('pack-today-ready', 'lzhumy', today, '商务谈判', 'ready');
  insertPack.run('pack-today-generating', 'lzhumy', today, '商务谈判', 'generating');
  insertPack.run('pack-old', 'lzhumy', nonToday, '旧主题', 'failed');
  const insertExtracted = db.prepare('INSERT INTO daily_extracted_articles VALUES (?, ?, ?, ?)');
  insertExtracted.run('extracted-today-1', 'lzhumy', today, '商务谈判');
  insertExtracted.run('extracted-today-2', 'lzhumy', today, '商务谈判');
  insertExtracted.run('extracted-old', 'lzhumy', nonToday, '旧主题');
  const insertListenArticle = db.prepare('INSERT INTO daily_listen_articles VALUES (?, ?, ?, ?)');
  insertListenArticle.run('listen-article-today-ready', 'lzhumy', today, 'ready');
  insertListenArticle.run('listen-article-today-missing', 'lzhumy', today, 'missing');
  insertListenArticle.run('listen-article-old', 'lzhumy', nonToday, 'failed');
  const insertListenAudio = db.prepare('INSERT INTO daily_listen_audios VALUES (?, ?, ?, ?)');
  insertListenAudio.run('listen-audio-today', 'lzhumy', today, 'ready');
  insertListenAudio.run('listen-audio-old', 'lzhumy', nonToday, 'failed');
  db.close();
  return { tempDir, dbPath, now: new Date(now), today, nonToday };
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function testPathSelection() {
  const localDefault = path.resolve(__dirname, '..', 'vocab.db');
  assert.strictEqual(
    resolveDatabasePath({
      env: { VOCAB_DB_PATH: 'D:\\data\\custom.db' },
      scriptDir: __dirname,
      existsSync: () => false,
    }),
    path.resolve('D:\\data\\custom.db'),
    'VOCAB_DB_PATH 必须最高优先级',
  );
  assert.strictEqual(
    resolveDatabasePath({
      env: { NODE_ENV: 'production' },
      scriptDir: '/var/www/super-agent/vocab-server/scripts',
      existsSync: (candidate) => candidate === '/var/www/super-agent/vocab-server/vocab.db',
    }),
    '/var/www/super-agent/vocab.db',
    '生产环境必须固定使用主库，不得回退到 vocab-server 子目录',
  );
  assert.strictEqual(
    resolveDatabasePath({
      env: {},
      scriptDir: '/var/www/super-agent/vocab-server/scripts',
      existsSync: () => false,
    }),
    '/var/www/super-agent/vocab.db',
    '/var/www 环境必须固定使用生产主库',
  );
  assert.strictEqual(
    resolveDatabasePath({
      env: {},
      scriptDir: __dirname,
      existsSync: () => false,
    }),
    localDefault,
    '非生产环境默认 vocab-server/vocab.db',
  );
}

function testShanghaiDateBoundary() {
  assert.strictEqual(
    getShanghaiDate(new Date('2026-08-02T15:59:59.999Z')),
    '2026-08-02',
    '上海零点前 1 毫秒仍属于前一天',
  );
  assert.strictEqual(
    getShanghaiDate(new Date('2026-08-02T16:00:00.000Z')),
    '2026-08-03',
    'UTC 16:00 应进入上海次日',
  );
}

function testAliases() {
  assert.deepStrictEqual(getUserIdCandidates('lzhmy'), ['lzhmy', 'lzhumy']);
  assert.deepStrictEqual(getUserIdCandidates('lzhumy'), ['lzhumy', 'lzhmy']);
  assert.deepStrictEqual(getUserIdCandidates('other'), ['other']);
}

function testMissingArgument() {
  const result = runScript([]);
  assert.notStrictEqual(result.status, 0, '缺少 userId 必须非 0 退出');
  assert.match(`${result.stdout}\n${result.stderr}`, /Usage: node scripts\/check-user-daily-readiness\.js <userId>/);
}

function testMissingTablesWarnInsteadOfCrashing() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-readiness-empty-'));
  const dbPath = path.join(tempDir, 'empty.db');
  new Database(dbPath).close();
  try {
    const result = runScript(['lzhmy'], { VOCAB_DB_PATH: dbPath });
    assert.strictEqual(result.status, 0, result.stderr);
    assert.match(result.stdout, /WARNING \[user_theme_prefs\]: 表不存在/);
    assert.match(result.stdout, /WARNING \[daily_listen_audios\]: 表不存在/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function getSection(output, sectionName) {
  const marker = `[${sectionName}]`;
  const start = output.indexOf(marker);
  assert.notStrictEqual(start, -1, `缺少输出区块 ${marker}`);
  const next = output.indexOf('\n[', start + marker.length);
  return output.slice(start, next === -1 ? output.length : next);
}

function testReadonlyQueryAndMissingFieldWarning() {
  const {
    tempDir, dbPath, now, today, nonToday,
  } = createFixture();
  try {
    const before = sha256(dbPath);
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const output = buildReport(db, 'lzhmy', now);
    db.close();
    const after = sha256(dbPath);
    assert.strictEqual(after, before, '诊断前后数据库内容必须完全一致');
    assert.match(output, new RegExp(`上海日期: ${today}`));
    assert.match(output, /实际命中 user_id: lzhumy/);
    assert.match(output, /user_theme_prefs[\s\S]*商务谈判/);
    assert.match(output, /user_login_logs \(近7天\)/);
    assert.doesNotMatch(output, /"logged_at":0/, '近 7 天登录不得包含更早记录');

    const packs = getSection(output, 'daily_packs');
    assert.match(packs, /总计: 2/);
    assert.match(packs, /状态计数: (?:ready=1, generating=1|generating=1, ready=1)/);
    assert.match(packs, new RegExp(today));
    assert.doesNotMatch(packs, new RegExp(nonToday));

    const extracted = getSection(output, 'daily_extracted_articles');
    assert.match(extracted, /WARNING.*字段不存在: status/);
    assert.match(extracted, /总计: 2/);
    assert.match(extracted, /状态计数: n\/a=2/);
    assert.match(extracted, new RegExp(today));
    assert.doesNotMatch(extracted, new RegExp(nonToday));
    assert.doesNotMatch(extracted, /旧主题/);

    const listenArticles = getSection(output, 'daily_listen_articles');
    assert.match(listenArticles, /总计: 2/);
    assert.match(listenArticles, /状态计数: (?:ready=1, missing=1|missing=1, ready=1)/);
    assert.match(listenArticles, new RegExp(today));
    assert.doesNotMatch(listenArticles, new RegExp(nonToday));

    const listenAudios = getSection(output, 'daily_listen_audios');
    assert.match(listenAudios, /总计: 1/);
    assert.match(listenAudios, /状态计数: ready=1/);
    assert.match(listenAudios, new RegExp(today));
    assert.doesNotMatch(listenAudios, new RegExp(nonToday));

    assert.strictEqual(fs.existsSync(`${dbPath}-journal`), false, '只读诊断不得创建 journal');
    assert.strictEqual(fs.existsSync(`${dbPath}-wal`), false, '只读诊断不得创建 WAL');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testMissingDatabaseIsNotCreated() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-readiness-missing-'));
  const dbPath = path.join(tempDir, 'missing.db');
  try {
    const result = runScript(['lzhmy'], { VOCAB_DB_PATH: dbPath });
    assert.notStrictEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /数据库文件不存在/);
    assert.strictEqual(fs.existsSync(dbPath), false, 'fileMustExist 不得创建空数据库');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  const tests = [
    testPathSelection,
    testShanghaiDateBoundary,
    testAliases,
    testMissingArgument,
    testMissingTablesWarnInsteadOfCrashing,
    testReadonlyQueryAndMissingFieldWarning,
    testMissingDatabaseIsNotCreated,
  ];
  const failures = [];
  for (const test of tests) {
    try {
      test();
    } catch (error) {
      failures.push({ name: test.name, error });
      console.error(`FAIL ${test.name}: ${error.stack || error.message}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`${failures.length} test(s) failed`);
  }
  console.log('PASS test-check-user-daily-readiness');
}

main();
