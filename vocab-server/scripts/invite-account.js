const crypto = require('node:crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const PRODUCTION_DB_PATH = '/var/lib/super-agent/vocab.db';
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function resolveDatabasePath({ env = process.env, scriptDir = __dirname } = {}) {
  const configuredPath = env.SUPER_AGENT_DB_PATH || env.VOCAB_DB_PATH;
  if (configuredPath) return path.resolve(configuredPath);
  const normalizedDir = String(scriptDir).replace(/\\/g, '/');
  const isProduction = env.NODE_ENV === 'production'
    || normalizedDir === '/opt' || normalizedDir.startsWith('/opt/') || normalizedDir.startsWith('/var/www/');
  return isProduction ? PRODUCTION_DB_PATH : path.resolve(scriptDir, '..', 'vocab.db');
}

function ensureInvitedAccountsTable(db) {
  db.exec('CREATE TABLE IF NOT EXISTS invited_accounts (user_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL)');
  const columns = db.prepare('PRAGMA table_info(invited_accounts)').all();
  for (const [name, type] of [['invite_token_hash', 'TEXT'], ['issued_at', 'INTEGER'], ['redeemed_at', 'INTEGER']]) {
    if (!columns.some((column) => column.name === name)) db.exec(`ALTER TABLE invited_accounts ADD COLUMN ${name} ${type}`);
  }
}

function normalizeAccount(raw) { return String(raw || '').trim(); }
function revokeSessions(db, userId, now = Date.now()) {
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='auth_sessions'").get();
  return exists ? db.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(now, userId).changes : 0;
}
function issueToken() { return crypto.randomBytes(32).toString('base64url'); }

function addAccount(db, rawUserId, now = Date.now()) {
  const userId = normalizeAccount(rawUserId);
  if (!userId) return { ok: false, error: '账号不能为空' };
  const existing = db.prepare('SELECT user_id FROM invited_accounts WHERE user_id = ?').get(userId);
  if (existing) return { ok: true, userId, alreadyExists: true };
  const inviteToken = issueToken();
  db.prepare('INSERT INTO invited_accounts (user_id, created_at, invite_token_hash, issued_at, redeemed_at) VALUES (?, ?, ?, ?, NULL)')
    .run(userId, now, hashToken(inviteToken), now);
  return { ok: true, userId, alreadyExists: false, inviteToken };
}

function reissueAccount(db, rawUserId, now = Date.now()) {
  const userId = normalizeAccount(rawUserId);
  if (!userId) return { ok: false, error: '账号不能为空' };
  const inviteToken = issueToken();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = db.prepare('UPDATE invited_accounts SET invite_token_hash = ?, issued_at = ?, redeemed_at = NULL WHERE user_id = ?')
      .run(hashToken(inviteToken), now, userId);
    if (!result.changes) { db.exec('ROLLBACK'); return { ok: false, error: '账号不存在', userId }; }
    revokeSessions(db, userId, now);
    db.exec('COMMIT');
    return { ok: true, userId, inviteToken };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

function removeAccount(db, rawUserId, now = Date.now()) {
  const userId = normalizeAccount(rawUserId);
  if (!userId) return { ok: false, error: '账号不能为空' };
  db.exec('BEGIN IMMEDIATE');
  try {
    revokeSessions(db, userId, now);
    const result = db.prepare('DELETE FROM invited_accounts WHERE user_id = ?').run(userId);
    db.exec('COMMIT');
    return { ok: true, userId, removed: result.changes > 0 };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

function listAccounts(db) {
  return db.prepare('SELECT user_id, created_at, issued_at, redeemed_at FROM invited_accounts ORDER BY created_at ASC').all();
}

function printUsage() {
  console.error('用法:');
  console.error('  node scripts/invite-account.js add <userId>');
  console.error('  node scripts/invite-account.js reissue <userId>');
  console.error('  node scripts/invite-account.js remove <userId>');
  console.error('  node scripts/invite-account.js list');
}

function main(argv = process.argv.slice(2)) {
  const command = String(argv[0] || '').trim();
  if (!['add', 'reissue', 'remove', 'list'].includes(command)) { printUsage(); return 2; }
  const dbPath = resolveDatabasePath();
  if (!fs.existsSync(dbPath)) { console.error(`数据库文件不存在: ${dbPath}`); return 1; }
  let db;
  try {
    db = new Database(dbPath, { fileMustExist: true });
    ensureInvitedAccountsTable(db);
    console.log(`数据库: ${dbPath}`);
    if (command === 'list') {
      const rows = listAccounts(db);
      if (!rows.length) { console.log('受邀名单为空，当前无人可登录。'); return 0; }
      console.log(`受邀账号 ${rows.length} 个:`);
      for (const row of rows) console.log(`  ${row.user_id}  (${row.redeemed_at ? '已兑换' : row.issued_at ? '待兑换' : '需重新签发'})`);
      return 0;
    }
    const userId = normalizeAccount(argv[1]);
    if (!userId) { printUsage(); return 2; }
    if (command === 'add') {
      const result = addAccount(db, userId);
      if (result.alreadyExists) console.log(`已在名单中: ${result.userId}；请用 reissue 签发新令牌`);
      else console.log(`已加入名单: ${result.userId}\n邀请令牌（仅显示一次）: ${result.inviteToken}`);
      return 0;
    }
    if (command === 'reissue') {
      const result = reissueAccount(db, userId);
      if (!result.ok) { console.error(result.error); return 1; }
      console.log(`已重新签发: ${result.userId}\n邀请令牌（仅显示一次）: ${result.inviteToken}`);
      return 0;
    }
    const result = removeAccount(db, userId);
    console.log(result.removed ? `已移出名单并撤销会话: ${result.userId}` : `名单中不存在: ${result.userId}`);
    return 0;
  } catch (error) { console.error(`操作失败: ${error.message}`); return 1; }
  finally { if (db) db.close(); }
}

if (require.main === module) process.exitCode = main();
module.exports = { addAccount, ensureInvitedAccountsTable, listAccounts, normalizeAccount, reissueAccount, removeAccount, resolveDatabasePath };
