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

function getUserIdCandidates(userId) {
  const normalized = String(userId || '').trim();
  if (normalized === 'lzhmy') return ['lzhmy', 'lzhumy'];
  if (normalized === 'lzhumy') return ['lzhumy', 'lzhmy'];
  return normalized ? [normalized] : [];
}

function getShanghaiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function getTableColumns(db, tableName) {
  const table = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(tableName);
  if (!table) return null;
  return db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all().map((row) => row.name);
}

function readTable(db, {
  tableName,
  expectedFields,
  requiredFields,
  candidates,
  dateField,
  dateValue,
  minimumTimestamp,
  orderField,
}) {
  const warnings = [];
  const columns = getTableColumns(db, tableName);
  if (!columns) {
    return { tableName, rows: [], warnings: [`WARNING [${tableName}]: 表不存在`] };
  }

  for (const field of expectedFields) {
    if (!columns.includes(field)) {
      warnings.push(`WARNING [${tableName}]: 字段不存在: ${field}`);
    }
  }
  const missingRequired = requiredFields.filter((field) => !columns.includes(field));
  if (missingRequired.length > 0) return { tableName, rows: [], warnings };

  const selectedFields = expectedFields.filter((field) => columns.includes(field));
  const placeholders = candidates.map(() => '?').join(', ');
  const conditions = [`${quoteIdentifier('user_id')} IN (${placeholders})`];
  const params = [...candidates];

  if (dateField && dateValue !== undefined) {
    conditions.push(`${quoteIdentifier(dateField)} = ?`);
    params.push(dateValue);
  }
  if (minimumTimestamp !== undefined) {
    conditions.push(`${quoteIdentifier('logged_at')} >= ?`);
    params.push(minimumTimestamp);
  }

  const orderSql = orderField && columns.includes(orderField)
    ? ` ORDER BY ${quoteIdentifier(orderField)} DESC`
    : '';
  const sql = `SELECT ${selectedFields.map(quoteIdentifier).join(', ')}
    FROM ${quoteIdentifier(tableName)}
    WHERE ${conditions.join(' AND ')}${orderSql}`;

  try {
    return { tableName, rows: db.prepare(sql).all(...params), warnings };
  } catch (error) {
    warnings.push(`WARNING [${tableName}]: 查询失败: ${error.message}`);
    return { tableName, rows: [], warnings };
  }
}

function summarizeStatuses(rows) {
  const counts = new Map();
  for (const row of rows) {
    const status = Object.prototype.hasOwnProperty.call(row, 'status')
      ? String(row.status || '(empty)')
      : 'n/a';
    counts.set(status, (counts.get(status) || 0) + 1);
  }
  return [...counts.entries()].map(([status, count]) => `${status}=${count}`).join(', ') || '无';
}

function formatSection(result, { includeStatuses = false, displayName = result.tableName } = {}) {
  const lines = [`\n[${displayName}]`];
  lines.push(...result.warnings);
  lines.push(`总计: ${result.rows.length}`);
  if (includeStatuses) lines.push(`状态计数: ${summarizeStatuses(result.rows)}`);
  for (const row of result.rows) lines.push(JSON.stringify(row));
  return lines;
}

function buildReport(db, userId, now = new Date()) {
  const candidates = getUserIdCandidates(userId);
  const shanghaiDate = getShanghaiDate(now);
  const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
  const sections = [
    readTable(db, {
      tableName: 'user_theme_prefs',
      expectedFields: ['user_id', 'theme', 'synced_at', 'updated_at'],
      requiredFields: ['user_id'],
      candidates,
      orderField: 'updated_at',
    }),
    readTable(db, {
      tableName: 'user_login_logs',
      expectedFields: ['user_id', 'logged_at'],
      requiredFields: ['user_id', 'logged_at'],
      candidates,
      minimumTimestamp: sevenDaysAgo,
      orderField: 'logged_at',
    }),
    readTable(db, {
      tableName: 'daily_packs',
      expectedFields: ['user_id', 'pack_date', 'theme', 'status'],
      requiredFields: ['user_id', 'pack_date'],
      candidates,
      dateField: 'pack_date',
      dateValue: shanghaiDate,
      orderField: 'status',
    }),
    readTable(db, {
      tableName: 'daily_extracted_articles',
      expectedFields: ['user_id', 'quota_date', 'theme', 'status'],
      requiredFields: ['user_id', 'quota_date'],
      candidates,
      dateField: 'quota_date',
      dateValue: shanghaiDate,
      orderField: 'status',
    }),
    readTable(db, {
      tableName: 'daily_listen_articles',
      expectedFields: ['user_id', 'pack_date', 'status'],
      requiredFields: ['user_id', 'pack_date'],
      candidates,
      dateField: 'pack_date',
      dateValue: shanghaiDate,
      orderField: 'status',
    }),
    readTable(db, {
      tableName: 'daily_listen_audios',
      expectedFields: ['user_id', 'pack_date', 'status'],
      requiredFields: ['user_id', 'pack_date'],
      candidates,
      dateField: 'pack_date',
      dateValue: shanghaiDate,
      orderField: 'status',
    }),
  ];
  const matchedUserIds = [...new Set(
    sections.flatMap((section) => section.rows.map((row) => row.user_id).filter(Boolean)),
  )];
  const lines = [
    `上海日期: ${shanghaiDate}`,
    `查询候选 user_id: ${candidates.join(', ')}`,
    `实际命中 user_id: ${matchedUserIds.join(', ') || '无'}`,
  ];
  sections.forEach((section, index) => {
    lines.push(...formatSection(section, {
      includeStatuses: index >= 2,
      displayName: index === 1 ? 'user_login_logs (近7天)' : section.tableName,
    }));
  });
  return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
  const userId = String(argv[0] || '').trim();
  if (!userId) {
    console.error('Usage: node scripts/check-user-daily-readiness.js <userId>');
    return 2;
  }

  const dbPath = resolveDatabasePath();
  if (!fs.existsSync(dbPath)) {
    console.error(`数据库文件不存在: ${dbPath}`);
    return 1;
  }

  let db;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    console.log(`数据库: ${dbPath}`);
    console.log(buildReport(db, userId));
    return 0;
  } catch (error) {
    console.error(`只读诊断失败: ${error.message}`);
    return 1;
  } finally {
    if (db) db.close();
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  buildReport,
  getShanghaiDate,
  getUserIdCandidates,
  readTable,
  resolveDatabasePath,
  summarizeStatuses,
};
