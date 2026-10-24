const crypto = require('node:crypto');
const express = require('express');

const COOKIE_NAME = 'super_agent_session';
const INVALID_LOGIN = { success: false, error: '登录凭据无效', errorCode: 'INVALID_CREDENTIALS' };
const hashToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');

function ensureColumn(db, table, name, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

function migrateAuth(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS invited_accounts (user_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL,
      revoked_at INTEGER, created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
    CREATE TABLE IF NOT EXISTS auth_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);`);
  ensureColumn(db, 'invited_accounts', 'invite_token_hash', 'TEXT');
  ensureColumn(db, 'invited_accounts', 'issued_at', 'INTEGER');
  ensureColumn(db, 'invited_accounts', 'redeemed_at', 'INTEGER');
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!db.prepare("SELECT 1 FROM auth_migrations WHERE name = 'invite_tokens_v1'").get()) {
      db.prepare('DELETE FROM auth_sessions').run();
      db.prepare('INSERT INTO auth_migrations (name, applied_at) VALUES (?, ?)').run('invite_tokens_v1', Date.now());
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

function createAuthService(db, { ttlMs = 30 * 24 * 60 * 60 * 1000 } = {}) {
  migrateAuth(db);
  return {
    login(userId, inviteToken, { now = Date.now() } = {}) {
      const normalized = String(userId || '').trim();
      const suppliedHash = Buffer.from(hashToken(inviteToken), 'hex');
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = db.prepare('SELECT invite_token_hash, redeemed_at FROM invited_accounts WHERE user_id = ?').get(normalized);
        const expectedHash = Buffer.from(row?.invite_token_hash || '0'.repeat(64), 'hex');
        const valid = expectedHash.length === suppliedHash.length && crypto.timingSafeEqual(expectedHash, suppliedHash)
          && row?.invite_token_hash && String(inviteToken || '').length > 0;
        if (!valid) { db.exec('ROLLBACK'); return null; }
        db.prepare('UPDATE invited_accounts SET redeemed_at = COALESCE(redeemed_at, ?) WHERE user_id = ?').run(now, normalized);
        const token = crypto.randomBytes(32).toString('base64url');
        db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
          .run(hashToken(token), normalized, now + ttlMs, now);
        db.exec('COMMIT');
        return { token, userId: normalized, expiresAt: now + ttlMs };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    authenticate(token, { now = Date.now() } = {}) {
      if (!token) return null;
      const row = db.prepare('SELECT user_id, expires_at, revoked_at FROM auth_sessions WHERE token_hash = ?').get(hashToken(token));
      return row && !row.revoked_at && row.expires_at > now ? { userId: row.user_id, expiresAt: row.expires_at } : null;
    },
    revoke(token, { now = Date.now() } = {}) {
      if (!token) return false;
      return db.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL').run(now, hashToken(token)).changes > 0;
    },
  };
}

function cookieToken(req) {
  const prefix = `${COOKIE_NAME}=`;
  const part = String(req.headers.cookie || '').split(';').map((value) => value.trim()).find((value) => value.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : '';
}

function requireAuth(auth) {
  return (req, res, next) => {
    const session = auth.authenticate(cookieToken(req));
    if (!session) return res.status(401).json({ authenticated: false });
    req.auth = { userId: session.userId };
    next();
  };
}

function bindAuthenticatedUser(req, _res, next) {
  for (const source of [req.body, req.query]) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    source.userId = req.auth.userId;
    if (Object.hasOwn(source, 'user_id')) source.user_id = req.auth.userId;
    if (Object.hasOwn(source, 'user')) source.user = req.auth.userId;
  }
  req.headers['x-user-id'] = req.auth.userId;
  next();
}

function createAuthRouter({ auth, production = process.env.NODE_ENV === 'production', rateLimitMax = 5, rateLimitWindowMs = 15 * 60_000 }) {
  const router = express.Router();
  const attempts = new Map();
  router.post('/login', (req, res) => {
    const userId = String(req.body?.userId || '').trim();
    const key = `${req.ip}|${userId}`;
    const now = Date.now();
    const current = attempts.get(key);
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + rateLimitWindowMs } : current;
    if (entry.count >= rateLimitMax) return res.status(429).json({ success: false, error: '请求过于频繁', errorCode: 'AUTH_RATE_LIMITED' });
    entry.count += 1;
    attempts.delete(key);
    attempts.set(key, entry);
    if (attempts.size > 10_000) attempts.delete(attempts.keys().next().value);
    const session = auth.login(userId, req.body?.inviteToken, { now });
    if (!session) return res.status(401).json(INVALID_LOGIN);
    attempts.delete(key);
    const secure = production ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(session.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor((session.expiresAt - now) / 1000)}${secure}`);
    res.json({ success: true, userId: session.userId });
  });
  router.post('/logout', (req, res) => {
    auth.revoke(cookieToken(req));
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${production ? '; Secure' : ''}`);
    res.status(204).end();
  });
  router.get('/session', requireAuth(auth), (req, res) => res.json({ authenticated: true, userId: req.auth.userId }));
  return router;
}

module.exports = { COOKIE_NAME, bindAuthenticatedUser, createAuthRouter, createAuthService, hashToken, migrateAuth, requireAuth };
