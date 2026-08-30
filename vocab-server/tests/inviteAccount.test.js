/**
 * 邀请制登录：名单脚本行为 + 服务端/前端契约。
 * 运行：node --test vocab-server/tests/inviteAccount.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function extract(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

function openDatabase(filePath) {
  try {
    const Database = require('better-sqlite3');
    return new Database(filePath);
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(filePath);
  }
}

function openTempDb(script) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'invited-accounts-'));
  const db = openDatabase(path.join(dir, 'vocab.db'));
  script.ensureInvitedAccountsTable(db);
  return { db, dir };
}

const script = require('../scripts/invite-account');

test('名单脚本：add / list / remove 覆盖名额生命周期', () => {
  const { db, dir } = openTempDb(script);
  try {
    assert.deepEqual(script.listAccounts(db), [], '初始名单为空，无人可登录');

    const added = script.addAccount(db, 'lzhmy');
    assert.equal(added.alreadyExists, false);
    assert.equal(script.listAccounts(db).length, 1);

    const again = script.addAccount(db, 'lzhmy');
    assert.equal(again.alreadyExists, true, '重复 add 不报错也不重复写入');
    assert.equal(script.listAccounts(db).length, 1);

    script.addAccount(db, 'lzhumy');
    assert.equal(script.listAccounts(db).length, 2, 'lzhmy 与 lzhumy 是两个独立名额');

    const removed = script.removeAccount(db, 'lzhumy');
    assert.equal(removed.removed, true);
    assert.deepEqual(
      script.listAccounts(db).map((row) => row.user_id),
      ['lzhmy'],
    );

    const missing = script.removeAccount(db, 'guest');
    assert.equal(missing.removed, false, '移除不存在的账号不应报错');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('名单脚本：空账号被拒绝', () => {
  const { db, dir } = openTempDb(script);
  try {
    assert.equal(script.addAccount(db, '   ').ok, false);
    assert.equal(script.removeAccount(db, '').ok, false);
    assert.deepEqual(script.listAccounts(db), []);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('服务端建表且不自动灌入任何账号', () => {
  const server = read('vocab-server/server.js');
  assert.match(server, /CREATE TABLE IF NOT EXISTS invited_accounts/);
  assert.doesNotMatch(server, /INSERT INTO invited_accounts/, '服务端不得自动写入名单');
});

test('verify-invite 精确匹配名单且不回传名单', () => {
  const route = extract(
    read('vocab-server/server.js'),
    "app.post('/api/auth/verify-invite'",
    "app.post('/api/user/login-ping'",
  );

  assert.match(route, /SELECT user_id FROM invited_accounts WHERE user_id = \?/);
  assert.match(route, /该账号未被邀请/);
  assert.doesNotMatch(route, /SELECT \* FROM invited_accounts/);
  assert.doesNotMatch(route, /listAccounts|ORDER BY/, '接口不得回传完整名单');
  assert.match(route, /catch\s*\(e\)\s*\{[\s\S]*res\.status\(500\)/);
});

test('登录页只走邀请校验，不再保留本地密钥', () => {
  const login = read('src/components/LoginPage.tsx');

  assert.match(login, /verifyInvite/);
  assert.doesNotMatch(login, /super_agent_lock_password/, '不得再读取本地密钥');
  assert.doesNotMatch(login, /type="password"/, '不再有密码输入');
  assert.match(login, /请输入受邀账号/);
  assert.match(login, /暂时无法验证，请稍后重试/);
  assert.match(login, /initializeUserSession/);
});

test('登录页表单可访问并尊重减少动效', () => {
  const login = read('src/components/LoginPage.tsx');

  assert.match(login, /htmlFor="invited-account"/);
  assert.match(login, /autoComplete="username"/);
  assert.match(login, /spellCheck=\{false\}/);
  assert.match(login, /aria-live="polite"/);
  assert.match(login, /prefers-reduced-motion: reduce/);
  assert.match(login, /useGSAP/);
  assert.match(login, /scope: rootRef/);
});
