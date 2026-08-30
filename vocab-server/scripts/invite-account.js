const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const PRODUCTION_DB_PATH = '/var/www/super-agent/vocab.db';

function resolveDatabasePath({
  env = process.env,
  scriptDir = __dirname,
} = {}) {
  if (env.VOCAB_DB_PATH) return path.resolve(env.VOCAB_DB_PATH);

  const normalizedDir = String(scriptDir).replace(/\\/g, '/');
  const isProduction = env.NODE_ENV === 'production' || normalizedDir.includes('/var/www/');
  if (!isProduction) return path.resolve(scriptDir, '..', 'vocab.db');

  return PRODUCTION_DB_PATH;
}

function ensureInvitedAccountsTable(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS invited_accounts (
      user_id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    )
  `).run();
}

// 账号按精确相等匹配，lzhmy 与 lzhumy 是两个独立名额
function normalizeAccount(raw) {
  return String(raw || '').trim();
}

function addAccount(db, rawUserId, now = Date.now()) {
  const userId = normalizeAccount(rawUserId);
  if (!userId) return { ok: false, error: '账号不能为空' };

  const existing = db.prepare('SELECT user_id FROM invited_accounts WHERE user_id = ?').get(userId);
  if (existing) return { ok: true, userId, alreadyExists: true };

  db.prepare('INSERT INTO invited_accounts (user_id, created_at) VALUES (?, ?)').run(userId, now);
  return { ok: true, userId, alreadyExists: false };
}

function removeAccount(db, rawUserId) {
  const userId = normalizeAccount(rawUserId);
  if (!userId) return { ok: false, error: '账号不能为空' };

  const result = db.prepare('DELETE FROM invited_accounts WHERE user_id = ?').run(userId);
  return { ok: true, userId, removed: result.changes > 0 };
}

function listAccounts(db) {
  return db.prepare('SELECT user_id, created_at FROM invited_accounts ORDER BY created_at ASC').all();
}

function printUsage() {
  console.error('用法:');
  console.error('  node scripts/invite-account.js add <userId>');
  console.error('  node scripts/invite-account.js remove <userId>');
  console.error('  node scripts/invite-account.js list');
}

function main(argv = process.argv.slice(2)) {
  const command = String(argv[0] || '').trim();
  if (!['add', 'remove', 'list'].includes(command)) {
    printUsage();
    return 2;
  }

  const dbPath = resolveDatabasePath();
  if (!fs.existsSync(dbPath)) {
    console.error(`数据库文件不存在: ${dbPath}`);
    return 1;
  }

  let db;
  try {
    db = new Database(dbPath, { fileMustExist: true });
    ensureInvitedAccountsTable(db);
    console.log(`数据库: ${dbPath}`);

    if (command === 'list') {
      const rows = listAccounts(db);
      if (rows.length === 0) {
        console.log('受邀名单为空，当前无人可登录。');
        return 0;
      }
      console.log(`受邀账号 ${rows.length} 个:`);
      for (const row of rows) {
        console.log(`  ${row.user_id}  (${new Date(row.created_at).toISOString()})`);
      }
      return 0;
    }

    const userId = normalizeAccount(argv[1]);
    if (!userId) {
      printUsage();
      return 2;
    }

    if (command === 'add') {
      const result = addAccount(db, userId);
      console.log(result.alreadyExists ? `已在名单中: ${result.userId}` : `已加入名单: ${result.userId}`);
      return 0;
    }

    const result = removeAccount(db, userId);
    console.log(result.removed ? `已移出名单: ${result.userId}` : `名单中不存在: ${result.userId}`);
    return 0;
  } catch (error) {
    console.error(`操作失败: ${error.message}`);
    return 1;
  } finally {
    if (db) db.close();
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  addAccount,
  ensureInvitedAccountsTable,
  listAccounts,
  normalizeAccount,
  removeAccount,
  resolveDatabasePath,
};
