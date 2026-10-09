/** 运行：node --test vocab-server/tests/inviteAccount.test.js */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

function openDatabase(filePath) {
  try { const Database = require('better-sqlite3'); return new Database(filePath); }
  catch { const { DatabaseSync } = require('node:sqlite'); return new DatabaseSync(filePath); }
}

const script = require('../scripts/invite-account');
const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
function openTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'invited-accounts-'));
  const db = openDatabase(path.join(dir, 'vocab.db'));
  script.ensureInvitedAccountsTable(db);
  return { db, dir };
}

test('数据库路径：邀请脚本与服务遵循统一优先级', () => {
  const superAgentPath = '/data/new.db';
  const vocabPath = '/data/legacy.db';
  assert.equal(script.resolveDatabasePath({
    env: { SUPER_AGENT_DB_PATH: superAgentPath, VOCAB_DB_PATH: vocabPath },
    scriptDir: __dirname,
  }), path.resolve(superAgentPath));
  assert.equal(script.resolveDatabasePath({
    env: { VOCAB_DB_PATH: vocabPath },
    scriptDir: __dirname,
  }), path.resolve(vocabPath));
  assert.equal(script.resolveDatabasePath({
    env: { NODE_ENV: 'production' },
    scriptDir: __dirname,
  }), '/var/lib/super-agent/vocab.db');
  assert.equal(script.resolveDatabasePath({
    env: {},
    scriptDir: '/opt/super-agent/vocab-server/scripts',
  }), '/var/lib/super-agent/vocab.db');
  const windowsScriptDir = 'C:\\opt\\super-agent\\vocab-server\\scripts';
  assert.equal(script.resolveDatabasePath({
    env: {},
    scriptDir: windowsScriptDir,
  }), path.resolve(windowsScriptDir, '..', 'vocab.db'));
  assert.equal(script.resolveDatabasePath({ env: {}, scriptDir: __dirname }), path.resolve(__dirname, '..', 'vocab.db'));

  const server = read('vocab-server/server.js');
  assert.match(server, /process\.env\.SUPER_AGENT_DB_PATH\s*\|\|\s*process\.env\.VOCAB_DB_PATH/);
  assert.match(server, /\/var\/lib\/super-agent\/vocab\.db/);
});

test('名单脚本：add / reissue / list / remove 使用哈希令牌且不泄露', () => {
  const { db, dir } = openTempDb();
  try {
    const added = script.addAccount(db, 'lzhmy');
    assert.equal(added.alreadyExists, false);
    assert.equal(Buffer.from(added.inviteToken, 'base64url').length, 32);
    const row = db.prepare('SELECT * FROM invited_accounts WHERE user_id = ?').get('lzhmy');
    assert.equal(row.invite_token_hash, crypto.createHash('sha256').update(added.inviteToken).digest('hex'));
    assert.equal(JSON.stringify(script.listAccounts(db)).includes(row.invite_token_hash), false);
    assert.equal(script.addAccount(db, 'lzhmy').alreadyExists, true);
    const reissued = script.reissueAccount(db, 'lzhmy');
    assert.notEqual(reissued.inviteToken, added.inviteToken);
    assert.equal(script.removeAccount(db, 'lzhmy').removed, true);
    assert.deepEqual(script.listAccounts(db), []);
  } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('名单脚本：空账号被拒绝', () => {
  const { db, dir } = openTempDb();
  try {
    assert.equal(script.addAccount(db, '   ').ok, false);
    assert.equal(script.reissueAccount(db, '').ok, false);
    assert.equal(script.removeAccount(db, '').ok, false);
  } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('前端登录提交账号和令牌，不持久化令牌', () => {
  const login = read('src/components/LoginPage.tsx');
  const api = read('src/services/authAPI.ts');
  assert.match(login, /login\(trimmed, inviteToken\)/);
  assert.match(login, /htmlFor="invite-token"/);
  assert.match(login, /type="password"/);
  assert.doesNotMatch(login, /localStorage\.setItem\([^)]*(invite|token)/i);
  assert.match(api, /\/api\/auth\/login/);
  assert.match(api, /JSON\.stringify\(\{ userId, inviteToken \}\)/);
});

test('登录页显示上次账号和可重复令牌指导', () => {
  const login = read('src/components/LoginPage.tsx');
  assert.match(login, /上次登录账号/);
  assert.match(login, /登录令牌可重复使用/);
  assert.match(login, /联系管理员重新签发/);
  assert.doesNotMatch(login, /localStorage\.setItem\([^)]*(invite|token)/i);
  assert.match(login, />\s*登录令牌\s*</);
  assert.match(login, /autoComplete="current-password"/);
});

test('登录页按字段标记错误并尊重减少动效', () => {
  const login = read('src/components/LoginPage.tsx');
  assert.match(login, /errorField/);
  assert.match(login, /errorField === 'account'/);
  assert.match(login, /errorField === 'token'/);
  assert.match(login, /setErrorField\('form'\)/);
  assert.match(login, /htmlFor="invited-account"/);
  assert.match(login, /autoComplete="username"/);
  assert.match(login, /aria-live="polite"/);
  assert.match(login, /prefers-reduced-motion: reduce/);
  assert.match(login, /useGSAP/);
});

test('设置页只能退出后换号', () => {
  const settings = read('src/components/GlobalSettingsPanel.tsx');
  const app = read('src/App.tsx');
  const api = read('src/services/authAPI.ts');
  assert.doesNotMatch(settings, /switchAccountSession/);
  assert.doesNotMatch(settings, /保存用户标识/);
  assert.match(settings, /当前登录账号/);
  assert.match(settings, /退出登录/);
  assert.match(settings, /onLogout/);
  assert.match(settings, /切换账号需先退出，再使用另一账号及登录令牌登录/);
  assert.match(settings, /useRef\(false\)/);
  assert.match(settings, /logoutLockRef\.current = true/);
  assert.match(settings, /disabled=\{isLoggingOut\}/);
  assert.match(settings, /aria-busy=\{isLoggingOut\}/);
  assert.doesNotMatch(settings, /finally\s*\{/);
  assert.match(api, /const res = await fetch\('\/api\/auth\/logout'/);
  assert.match(api, /if \(!res\.ok\)/);
  assert.match(api, /throw new Error/);
  assert.match(app, /let cancelled = false/);
  assert.match(app, /return \(\) => \{ cancelled = true; \}/);
  assert.match(app, /if \(cancelled\) return/);
  assert.match(app, /await logout\(\)/);
  assert.match(app, /await logout\(\)[\s\S]*setIsAuthenticated\(false\)/);
  assert.match(app, /<AppContent[\s\S]*currentUserId=\{userId\}[\s\S]*onLogout=\{handleLogout\}/);
});
