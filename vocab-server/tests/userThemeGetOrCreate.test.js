/**
 * FV-CRON-02：一人一主题。登录读表，缺记录写入默认「商务谈判：让步与施压」。
 * 运行：node vocab-server/tests/userThemeGetOrCreate.test.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dailyPackService = require('../services/dailyPackService');

function openDatabase(filePath) {
  try {
    const Database = require('better-sqlite3');
    return new Database(filePath);
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(filePath);
  }
}

function openDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'user-theme-'));
  const db = openDatabase(path.join(dir, 't.db'));
  dailyPackService.initDailyPackTables(db);
  return { db, dir };
}

function testGetOrCreateInsertsDefaultOnce() {
  const { db, dir } = openDb();
  try {
    const first = dailyPackService.getOrCreateUserTheme(db, 'lzhmy');
    assert.equal(first.theme, dailyPackService.DEFAULT_USER_THEME);
    assert.equal(first.created, true);
    const second = dailyPackService.getOrCreateUserTheme(db, 'lzhmy');
    assert.equal(second.theme, dailyPackService.DEFAULT_USER_THEME);
    assert.equal(second.created, false);
    const rows = db.prepare('SELECT theme FROM user_theme_prefs WHERE user_id = ?').all('lzhmy');
    assert.equal(rows.length, 1, '一人只能有一行主题');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testExistingThemeIsNotOverwritten() {
  const { db, dir } = openDb();
  try {
    dailyPackService.upsertUserTheme(db, 'lzhmy', '危机公关：外媒答疑');
    const row = dailyPackService.getOrCreateUserTheme(db, 'lzhmy');
    assert.equal(row.theme, '危机公关：外媒答疑');
    assert.equal(row.created, false);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testSwitchThemeKeepsSingleRow() {
  const { db, dir } = openDb();
  try {
    dailyPackService.getOrCreateUserTheme(db, 'lzhmy');
    dailyPackService.upsertUserTheme(db, 'lzhmy', '项目汇报：跨国董事会');
    const rows = db.prepare('SELECT theme FROM user_theme_prefs WHERE user_id = ?').all('lzhmy');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].theme, '项目汇报：跨国董事会');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testRoutesAndFrontendHydrateFromTable() {
  const root = path.join(__dirname, '..', '..');
  const server = fs.readFileSync(path.join(root, 'vocab-server/server.js'), 'utf8');
  assert.match(server, /app\.get\('\/api\/user\/theme'/, '必须能读取当前用户主题');
  assert.match(server, /getOrCreateUserTheme/, '缺记录必须写入默认主题');

  const focusStart = server.indexOf("app.post('/api/theme/focus'");
  assert.ok(focusStart >= 0, '找不到 POST /api/theme/focus');
  const focus = server.slice(focusStart, focusStart + 700);
  assert.match(focus, /upsertUserTheme/, '换主题必须写入 user_theme_prefs');
  assert.doesNotMatch(
    focus,
    /res\.json\(\{\s*success:\s*true,\s*theme:\s*req\.body\.theme/,
    'focus 不得再是空壳',
  );

  const pingStart = server.indexOf("app.post('/api/user/login-ping'");
  const ping = server.slice(pingStart, server.indexOf("app.get('/api/system/date'", pingStart));
  assert.doesNotMatch(ping, /upsertUserTheme/, '登录不得用页面旧值覆盖主题表');

  const api = fs.readFileSync(path.join(root, 'src/services/dailyPackAPI.ts'), 'utf8');
  assert.match(api, /export async function fetchUserTheme/, '前台必须能读主题表');

  const ctx = fs.readFileSync(path.join(root, 'src/components/modules/english/context/EnglishContext.tsx'), 'utf8');
  assert.match(ctx, /fetchUserTheme/, '登录后英语页必须用表里的主题，不能只信 localStorage');
  assert.match(ctx, /themeHydrated/, '未从服务器读到主题前，不得把本地旧主题写回表');

  const training = fs.readFileSync(path.join(root, 'src/services/trainingAPI.ts'), 'utf8');
  const focusFn = training.slice(training.indexOf('export async function setThemeFocus'), training.indexOf('export async function markEmailComplete'));
  assert.match(focusFn, /getAppUserId\(\)/, 'focus 必须带 userId，否则写到 default-user');
}

testGetOrCreateInsertsDefaultOnce();
console.log('PASS 缺记录写入默认商务谈判且一人一行');
testExistingThemeIsNotOverwritten();
console.log('PASS 已有主题登录不覆盖');
testSwitchThemeKeepsSingleRow();
console.log('PASS 切换主题仍一人一行');
testRoutesAndFrontendHydrateFromTable();
console.log('PASS 读接口 / focus 写表 / 登录不改主题 / 前台水合');
console.log('\nuserThemeGetOrCreate.test.js 全部通过');
