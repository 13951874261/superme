const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');

function openDatabase(filePath) {
  try {
    const Database = require('better-sqlite3');
    return new Database(filePath);
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(filePath);
  }
}

const { bindAuthenticatedUser, createAuthRouter, createAuthService, hashToken, requireAuth } = require('../services/authService');
const invite = require('../scripts/invite-account');

async function fixture({ rateLimitMax = 5 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'invite-token-auth-'));
  const db = openDatabase(path.join(root, 'test.db'));
  invite.ensureInvitedAccountsTable(db);
  const auth = createAuthService(db, { ttlMs: 60_000 });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ auth, production: true, rateLimitMax, rateLimitWindowMs: 60_000 }));
  app.use('/api', requireAuth(auth), bindAuthenticatedUser);
  app.post('/api/private', (req, res) => res.json({ authUserId: req.auth.userId, bodyUserId: req.body.userId, queryUserId: req.query.userId }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    auth, db, root, server,
    base: `http://127.0.0.1:${server.address().port}`,
    close() { server.close(); db.close(); fs.rmSync(root, { recursive: true, force: true }); },
  };
}

async function login(f, userId, inviteToken) {
  return fetch(`${f.base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, inviteToken }),
  });
}

function issue(f, userId = 'alice') {
  return invite.addAccount(f.db, userId, 1000);
}

test('邀请只存 SHA-256，明文令牌至少 32 字节且 list 不泄露凭据', async () => {
  const f = await fixture();
  try {
    const result = issue(f);
    assert.equal(Buffer.from(result.inviteToken, 'base64url').length >= 32, true);
    const row = f.db.prepare('SELECT * FROM invited_accounts WHERE user_id = ?').get('alice');
    assert.equal(row.invite_token_hash, hashToken(result.inviteToken));
    assert.equal(JSON.stringify(row).includes(result.inviteToken), false);
    assert.deepEqual(Object.keys(invite.listAccounts(f.db)).includes('invite_token_hash'), false);
    assert.equal(JSON.stringify(invite.listAccounts(f.db)).includes(row.invite_token_hash), false);
  } finally { f.close(); }
});

test('私有 API 默认拒绝未认证请求并注入可信会话账号', async () => {
  const f = await fixture();
  try {
    assert.equal((await fetch(`${f.base}/api/private`, { method: 'POST' })).status, 401);
    const issued = issue(f);
    const authenticated = await login(f, 'alice', issued.inviteToken);
    const response = await fetch(`${f.base}/api/private?userId=bob`, {
      method: 'POST',
      headers: { cookie: authenticated.headers.get('set-cookie'), 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'bob' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { authUserId: 'alice', bodyUserId: 'alice', queryUserId: 'alice' });
    const req = { auth: { userId: 'alice' }, body: { user_id: 'bob', user: 'bob' }, query: { user_id: 'bob', user: 'bob' }, headers: {} };
    bindAuthenticatedUser(req, {}, () => {});
    assert.deepEqual(req.body, { user_id: 'alice', user: 'alice', userId: 'alice' });
    assert.deepEqual(req.query, { user_id: 'alice', user: 'alice', userId: 'alice' });
  } finally { f.close(); }
});

test('同一有效令牌可连续登录并签发独立会话', async () => {
  const f = await fixture();
  try {
    const issued = issue(f);
    const first = await login(f, 'alice', issued.inviteToken);
    assert.equal(first.status, 200);
    const firstCookie = first.headers.get('set-cookie');
    assert.match(firstCookie, /HttpOnly/i);
    assert.match(firstCookie, /SameSite=Lax/i);
    assert.match(firstCookie, /Secure/i);
    const redeemedAt = f.db.prepare('SELECT redeemed_at FROM invited_accounts WHERE user_id = ?').get('alice').redeemed_at;
    assert.equal(redeemedAt !== null, true);
    const second = await login(f, 'alice', issued.inviteToken);
    assert.equal(second.status, 200);
    const secondCookie = second.headers.get('set-cookie');
    assert.notEqual(secondCookie, firstCookie);
    assert.equal(f.db.prepare('SELECT redeemed_at FROM invited_accounts WHERE user_id = ?').get('alice').redeemed_at, redeemedAt);
    assert.equal((await fetch(`${f.base}/api/auth/session`, { headers: { cookie: firstCookie } })).status, 200);
    assert.equal((await fetch(`${f.base}/api/auth/session`, { headers: { cookie: secondCookie } })).status, 200);
  } finally { f.close(); }
});

test('并行请求可复用有效登录令牌', async () => {
  const f = await fixture();
  try {
    const issued = issue(f);
    const responses = await Promise.all([login(f, 'alice', issued.inviteToken), login(f, 'alice', issued.inviteToken)]);
    assert.deepEqual(responses.map((response) => response.status), [200, 200]);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM auth_sessions WHERE user_id = ?').get('alice').n, 2);
    assert.equal(f.db.prepare('SELECT redeemed_at FROM invited_accounts WHERE user_id = ?').get('alice').redeemed_at !== null, true);
  } finally { f.close(); }
});

test('未知账号、错误令牌、旧无令牌邀请均返回相同模糊响应', async () => {
  const f = await fixture();
  try {
    const issued = issue(f);
    f.db.prepare('INSERT INTO invited_accounts (user_id, created_at) VALUES (?, ?)').run('legacy', 1);
    const cases = [
      await login(f, 'missing', issued.inviteToken),
      await login(f, 'alice', crypto.randomBytes(32).toString('base64url')),
      await login(f, 'legacy', issued.inviteToken),
    ];
    const bodies = await Promise.all(cases.map((response) => response.json()));
    assert.deepEqual(cases.map((response) => response.status), [401, 401, 401]);
    assert.deepEqual(bodies[0], bodies[1]);
    assert.deepEqual(bodies[1], bodies[2]);
  } finally { f.close(); }
});

test('IP+账号组合限速返回稳定 429，成功兑换重置计数', async () => {
  const f = await fixture({ rateLimitMax: 2 });
  try {
    const issued = issue(f);
    await login(f, 'alice', 'bad');
    await login(f, 'alice', 'bad');
    const limited = await login(f, 'alice', issued.inviteToken);
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), { success: false, error: '请求过于频繁', errorCode: 'AUTH_RATE_LIMITED' });
    const bob = issue(f, 'bob');
    assert.equal((await login(f, 'bob', bob.inviteToken)).status, 200, '不同账号组合不受影响');
  } finally { f.close(); }
});

test('reissue 和 remove 都撤销用户全部会话', async () => {
  const f = await fixture();
  try {
    const first = issue(f);
    const firstLogin = await login(f, 'alice', first.inviteToken);
    const oldCookie = firstLogin.headers.get('set-cookie');
    const reissued = invite.reissueAccount(f.db, 'alice');
    assert.ok(reissued.inviteToken);
    assert.equal((await fetch(`${f.base}/api/auth/session`, { headers: { cookie: oldCookie } })).status, 401);
    const secondLogin = await login(f, 'alice', reissued.inviteToken);
    const secondCookie = secondLogin.headers.get('set-cookie');
    invite.removeAccount(f.db, 'alice');
    assert.equal((await fetch(`${f.base}/api/auth/session`, { headers: { cookie: secondCookie } })).status, 401);
  } finally { f.close(); }
});

test('server 仅在公开认证与健康路由后挂载全局 API 门禁', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const authRouter = server.indexOf("app.use('/api/auth'");
  const globalGate = server.indexOf("app.use('/api', requireAuth(authService), bindAuthenticatedUser)");
  const firstPrivateRoute = server.indexOf("app.use('/api/books'");
  assert.ok(authRouter >= 0 && globalGate > authRouter && firstPrivateRoute > globalGate);
  assert.equal(server.slice(0, globalGate).includes("express.static(tempAudioDir"), false);
});

test('迁移标记在 BEGIN IMMEDIATE 后检查', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'authService.js'), 'utf8');
  const migration = source.slice(source.indexOf('function migrateAuth'), source.indexOf('function createAuthService'));
  assert.ok(migration.indexOf("db.exec('BEGIN IMMEDIATE')") < migration.indexOf("SELECT 1 FROM auth_migrations WHERE name = 'invite_tokens_v1'"));
});

test('安全迁移一次性撤销已有 auth_sessions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'invite-token-migrate-'));
  const db = openDatabase(path.join(root, 'test.db'));
  try {
    db.exec('CREATE TABLE invited_accounts (user_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL); CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER, created_at INTEGER NOT NULL)');
    db.prepare('INSERT INTO invited_accounts VALUES (?, ?)').run('legacy', 1);
    db.prepare('INSERT INTO auth_sessions VALUES (?, ?, ?, NULL, ?)').run('hash', 'legacy', Date.now() + 10000, 1);
    createAuthService(db);
    assert.equal(db.prepare('SELECT count(*) AS n FROM auth_sessions').get().n, 0);
    const columns = db.prepare('PRAGMA table_info(invited_accounts)').all().map((column) => column.name);
    assert.equal(columns.includes('invite_token_hash'), true);
    assert.equal(columns.includes('issued_at'), true);
    assert.equal(columns.includes('redeemed_at'), true);
  } finally { db.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
