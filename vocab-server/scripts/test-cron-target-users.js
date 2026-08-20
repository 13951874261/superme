const assert = require('assert');
const Database = require('better-sqlite3');

const dailyPackService = require('../services/dailyPackService');
const dailyListenService = require('../services/dailyListenPreGenerateService');

const DEFAULT_THEME = '商务谈判：让步与施压';
const DAY = 24 * 60 * 60 * 1000;

function createDb() {
  try {
    const db = new Database(':memory:');
    dailyPackService.initDailyPackTables(db);
    dailyListenService.initDailyListenTables(db);
    return db;
  } catch (e) {
    console.log('SKIP test-cron-target-users (better-sqlite3 native bindings unavailable)');
    process.exit(0);
  }
}

function testActiveUsersWithThemePreferred() {
  const db = createDb();
  const now = Date.now();
  db.prepare('INSERT INTO user_theme_prefs VALUES (?,?,?,?)').run('active-a', '主题A', now, now);
  db.prepare('INSERT INTO user_theme_prefs VALUES (?,?,?,?)').run('active-b', '主题B', now, now);
  db.prepare('INSERT INTO user_theme_prefs VALUES (?,?,?,?)').run('stale-c', '主题C', now, now);
  db.prepare('INSERT INTO user_login_logs VALUES (?,?)').run('active-a', now - 1 * DAY);
  db.prepare('INSERT INTO user_login_logs VALUES (?,?)').run('active-b', now - 2 * DAY);
  db.prepare('INSERT INTO user_login_logs VALUES (?,?)').run('stale-c', now - 10 * DAY);

  const users = dailyListenService.listCronTargetUsers(db, now);
  const ids = users.map((u) => u.user_id).sort();
  assert.deepStrictEqual(ids, ['active-a', 'active-b'], '应只选近7天登录且有 theme 的用户');
  assert.strictEqual(users.find((u) => u.user_id === 'active-a').theme, '主题A');
}

function testFallbackToMostRecentLoginWhenEmpty() {
  const db = createDb();
  const now = Date.now();
  // 有登录但都超过 7 天；theme 也没有匹配活跃
  db.prepare('INSERT INTO user_login_logs VALUES (?,?)').run('old-user', now - 10 * DAY);
  db.prepare('INSERT INTO user_login_logs VALUES (?,?)').run('older-user', now - 20 * DAY);
  db.prepare('INSERT INTO user_theme_prefs VALUES (?,?,?,?)').run('old-user', '旧主题', now - 10 * DAY, now - 10 * DAY);

  const users = dailyListenService.listCronTargetUsers(db, now);
  assert.strictEqual(users.length, 1, '空集合时应回退最近登录 1 人');
  assert.strictEqual(users[0].user_id, 'old-user');
  assert.strictEqual(users[0].theme, '旧主题');
  assert.strictEqual(users[0].fallback, true);
}

function testFallbackUsesDefaultThemeWhenMissing() {
  const db = createDb();
  const now = Date.now();
  db.prepare('INSERT INTO user_login_logs VALUES (?,?)').run('lonely', now - 30 * DAY);

  const users = dailyListenService.listCronTargetUsers(db, now);
  assert.strictEqual(users.length, 1);
  assert.strictEqual(users[0].user_id, 'lonely');
  assert.strictEqual(users[0].theme, DEFAULT_THEME);
  assert.strictEqual(users[0].fallback, true);
}

function testNoAliasMergeA2() {
  const db = createDb();
  const now = Date.now();
  db.prepare('INSERT INTO user_theme_prefs VALUES (?,?,?,?)').run('lzhmy', '主题L', now, now);
  db.prepare('INSERT INTO user_theme_prefs VALUES (?,?,?,?)').run('lzhumy', '主题M', now, now);
  db.prepare('INSERT INTO user_login_logs VALUES (?,?)').run('lzhmy', now - 1 * DAY);
  db.prepare('INSERT INTO user_login_logs VALUES (?,?)').run('lzhumy', now - 1 * DAY);

  const users = dailyListenService.listCronTargetUsers(db, now);
  const ids = users.map((u) => u.user_id).sort();
  assert.deepStrictEqual(ids, ['lzhmy', 'lzhumy'], 'A2：不合并双账号');
}

function testEmptyWhenNoLoginLogsAtAll() {
  const db = createDb();
  db.prepare('INSERT INTO user_theme_prefs VALUES (?,?,?,?)').run('theme-only', '主题', Date.now(), Date.now());
  const users = dailyListenService.listCronTargetUsers(db, Date.now());
  assert.deepStrictEqual(users, [], '完全无登录日志时无法回退，返回空');
}

function testPackCronUsesSharedSelector() {
  const src = require('fs').readFileSync(
    require('path').join(__dirname, '../services/dailyPackCron.js'),
    'utf8',
  );
  assert.match(src, /listCronTargetUsers/, 'DailyPack cron 应改用统一选人');
  assert.doesNotMatch(
    src,
    /listUsersWithSyncedTheme/,
    'DailyPack cron 不应再只用 theme 表全量',
  );
}

function main() {
  const tests = [
    ['近7天活跃+theme', testActiveUsersWithThemePreferred],
    ['空则回退最近1人', testFallbackToMostRecentLoginWhenEmpty],
    ['回退无theme用默认', testFallbackUsesDefaultThemeWhenMissing],
    ['A2不合并双账号', testNoAliasMergeA2],
    ['无登录日志返回空', testEmptyWhenNoLoginLogsAtAll],
    ['Pack cron 接入统一选人', testPackCronUsesSharedSelector],
  ];
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${name}`);
      console.error(error);
    }
  }
  if (failed) {
    process.exit(1);
  }
  console.log(`\nAll ${tests.length} tests passed`);
}

main();
