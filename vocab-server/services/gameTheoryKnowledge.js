/**
 * 博弈模块知识自动注入（后端真相源）。
 * 只读已确认同步到 game_theory 的条目，最多 5 条，空则不附加 knowledge_context。
 */
const crypto = require('crypto');
const extra = require('./knowledgeVaultExtra');

const MAX_KNOWLEDGE_ITEMS = 5;
const MAX_CONTEXT_CHARS = 6000;
const TRUNCATED_SUFFIX = '\n[内容已截断]';
const GAME_THEORY_MODULE = 'game_theory';

function clipSummary(content) {
  return String(content || '').slice(0, 120);
}

function rowToContextParts(row) {
  const formatted = extra.formatKnowledgeVaultRow(row);
  const type = formatted.type;
  if (type === 'english') {
    const title = formatted.word || formatted.title || '';
    const meaning = formatted.meaning || '';
    const example = formatted.example || '';
    const content = [meaning, example].filter(Boolean).join('\n');
    return { title, summary: meaning, content };
  }
  if (type === 'theory') {
    const title = formatted.title || '';
    const summary = formatted.summary || '';
    return { title, summary, content: summary };
  }
  const title = formatted.title || formatted.word || '';
  const content = formatted.content || formatted.summary || formatted.meaning || '';
  const summary = formatted.summary || (content ? clipSummary(content) : '');
  return { title, summary, content };
}

function formatKnowledgeBlock(row, index) {
  const parts = rowToContextParts(row);
  const parsedExtra = extra.parseKnowledgeVaultExtra(row.extra_json, row.source);
  const deepMark = parsedExtra.difficulty >= 3 ? '（加深）' : '';
  const title = (parts.title || `知识${index + 1}`) + deepMark;
  const lines = [`${index + 1}. ${title}`];
  if (parts.summary && parts.summary !== parts.content) {
    lines.push(parts.summary);
  }
  if (parts.content) {
    lines.push(parts.content);
  }
  return lines.join('\n');
}

function truncateContext(text) {
  if (text.length <= MAX_CONTEXT_CHARS) return text;
  const budget = Math.max(0, MAX_CONTEXT_CHARS - TRUNCATED_SUFFIX.length);
  return text.slice(0, budget) + TRUNCATED_SUFFIX;
}

function buildReminder(syncedCount, usedCount) {
  return `已同步 ${syncedCount} 条，本次使用 ${usedCount} 条`;
}

function emptyInjection() {
  return {
    ids: [],
    syncedCount: 0,
    usedCount: 0,
    context: '',
    reminder: buildReminder(0, 0)
  };
}

function loadInjectedKnowledge(db, userId, moduleName = GAME_THEORY_MODULE) {
  if (!db || !userId) return emptyInjection();
  const rows = db.prepare('SELECT * FROM knowledge_vault WHERE user_id = ?').all(userId);
  const syncedAll = extra.sortLinkedKnowledgeRows(
    extra.filterLinkedKnowledgeRows(rows, moduleName)
  );
  const used = syncedAll.slice(0, MAX_KNOWLEDGE_ITEMS);
  if (!used.length) {
    return {
      ids: [],
      syncedCount: syncedAll.length,
      usedCount: 0,
      context: '',
      reminder: buildReminder(syncedAll.length, 0)
    };
  }
  const headings = {
    listen: '【听力知识】',
    speak: '【口语知识】',
    game_theory: '【博弈知识】',
    writing: '【写作知识】',
    aesthetic: '【审美知识】'
  };
  const heading = headings[moduleName] || '【引用知识】';
  const body = used.map((row, index) => formatKnowledgeBlock(row, index)).join('\n\n');
  return {
    ids: used.map((row) => row.id),
    syncedCount: syncedAll.length,
    usedCount: used.length,
    context: truncateContext(`${heading}\n${body}`),
    reminder: buildReminder(syncedAll.length, used.length)
  };
}

function loadInjectedKnowledgeSafe(db, userId, moduleName = GAME_THEORY_MODULE) {
  try {
    return loadInjectedKnowledge(db, userId, moduleName);
  } catch (err) {
    console.error('[gameTheoryKnowledge] loadInjectedKnowledge failed:', err);
    return emptyInjection();
  }
}

function attachKnowledgeContext(inputs, context) {
  const base = inputs && typeof inputs === 'object' ? { ...inputs } : {};
  if (!context) return base;
  base.knowledge_context = context;
  return base;
}

function appendKnowledgeTraces(db, userId, ids, meta) {
  if (!db || !userId || !Array.isArray(ids) || !ids.length) return 0;
  const moduleName = (meta && meta.module) || GAME_THEORY_MODULE;
  const action = (meta && meta.action) || 'analyzed';
  const taskId = meta && meta.taskId != null ? String(meta.taskId) : '';
  const sessionId = meta && meta.sessionId != null ? String(meta.sessionId) : '';
  const usedAt = meta && meta.usedAt != null ? meta.usedAt : Date.now();
  const stmt = db.prepare(`
    INSERT INTO knowledge_vault_traces (id, knowledge_id, user_id, module, action, task_id, session_id, used_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let inserted = 0;
  for (const id of ids) {
    if (!id) continue;
    stmt.run(crypto.randomUUID(), id, userId, moduleName, action, taskId, sessionId, usedAt);
    inserted += 1;
  }
  return inserted;
}

function appendKnowledgeTracesSafe(db, userId, ids, meta) {
  try {
    return appendKnowledgeTraces(db, userId, ids, meta);
  } catch (err) {
    console.error('[gameTheoryKnowledge] appendKnowledgeTraces failed:', err);
    return 0;
  }
}

module.exports = {
  MAX_KNOWLEDGE_ITEMS,
  MAX_CONTEXT_CHARS,
  GAME_THEORY_MODULE,
  buildReminder,
  emptyInjection,
  loadInjectedKnowledge,
  loadInjectedKnowledgeSafe,
  attachKnowledgeContext,
  appendKnowledgeTraces,
  appendKnowledgeTracesSafe
};
