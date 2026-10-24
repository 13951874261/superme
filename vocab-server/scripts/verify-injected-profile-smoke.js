/**
 * Step E smoke: print injected profile for a user from live SQLite.
 * Usage on server:
 *   node scripts/verify-injected-profile-smoke.js lzhey
 */
const path = require('path');
const Database = require('better-sqlite3');
const {
  buildInjectedUserCurrentProfile,
  resolveUserCurrentProfileForDify,
} = require('../services/profileInject');

const userId = String(process.argv[2] || 'lzhey').trim();
const dbCandidates = [
  process.env.VOCAB_DB_PATH,
  path.join(__dirname, '..', 'data', 'vocab.db'),
  path.join(__dirname, '..', 'vocab.db'),
  '/var/www/super-agent/vocab.db',
  '/var/www/super-agent/vocab-server/data/vocab.db',
  '/var/www/super-agent/vocab-server/vocab.db',
].filter(Boolean);

let dbPath = null;
let db = null;
for (const p of dbCandidates) {
  try {
    const candidate = new Database(p, { readonly: true, fileMustExist: true });
    const hasMemories = candidate
      .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='user_memories' LIMIT 1")
      .get();
    if (!hasMemories) {
      candidate.close();
      continue;
    }
    db = candidate;
    dbPath = p;
    break;
  } catch {
    /* try next */
  }
}

if (!db) {
  console.log(JSON.stringify({ ok: false, error: 'DB_NOT_FOUND', tried: dbCandidates }, null, 2));
  process.exit(1);
}

const injected = buildInjectedUserCurrentProfile(db, userId, { recallQuery: '听辨' });
const resolvedEmpty = resolveUserCurrentProfileForDify(db, userId, '');
const resolvedClient = resolveUserCurrentProfileForDify(db, userId, 'CLIENT_MARK');

const out = {
  ok: true,
  dbPath,
  userId,
  length: injected.length,
  has_career: /能力匹配度=\d+%/.test(injected),
  has_accent_or_l3: /Accent:|Goal:|Focus:/.test(injected),
  has_graph: /Graph:/.test(injected),
  has_ledger: /oral:|listening:|vocab:/.test(injected),
  has_recall: /Recall:/.test(injected),
  resolve_empty_matches_build: resolvedEmpty === injected || (resolvedEmpty.includes('能力匹配度=') && injected.includes('能力匹配度=')),
  resolve_prefers_client: resolvedClient === 'CLIENT_MARK',
  preview: injected.slice(0, 360),
};

console.log(JSON.stringify(out, null, 2));
db.close();
process.exit(out.has_career && out.resolve_prefers_client ? 0 : 2);
