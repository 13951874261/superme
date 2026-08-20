/**
 * 博弈战术库 / 人性档案 → 资料抽屉理论框架草稿。
 * 不删除 game_theory_tactics / personal_prototypes；不自动同步。
 */
const extra = require('./knowledgeVaultExtra');
const { insertTheoryDraft } = require('./knowledgeDraftExtract');

const MAP_SOURCES = ['tactics', 'prototypes', 'all'];

function sourceIdFromExtra(parsedExtra) {
  const ref = parsedExtra && parsedExtra.sourceRef;
  if (ref && typeof ref === 'object' && !Array.isArray(ref)) {
    return String(ref.sourceId || '').trim();
  }
  return '';
}

function isAlreadyMapped(vaultRows, sourceType, sourceId) {
  const id = String(sourceId || '').trim();
  if (!id) return false;
  return (vaultRows || []).some((row) => {
    const parsed = extra.parseKnowledgeVaultExtra(row.extra_json, row.source);
    return parsed.sourceType === sourceType && sourceIdFromExtra(parsed) === id;
  });
}

function tacticToDraftInput(tactic) {
  if (!tactic || typeof tactic !== 'object') return null;
  const title = String(tactic.name || '').trim();
  if (!title) return null;
  const sourceRef = {
    sourceId: String(tactic.id || '').trim(),
    sourceModule: 'game_theory_tactics',
  };
  if (tactic.source_file) sourceRef.fileName = String(tactic.source_file);
  const tags = ['from_game_tactics'];
  if (tactic.category) tags.push(String(tactic.category));
  return {
    title: title.slice(0, 80),
    category: 'game_theory',
    summary: String(tactic.description || '').trim() || `来自战术库「${title}」的待确认草稿。`,
    tags,
    source: '战术库导入',
    sourceType: 'from_game_tactics',
    sourceRef,
  };
}

function prototypeToDraftInput(proto) {
  if (!proto || typeof proto !== 'object') return null;
  const title = String(proto.name || '').trim();
  if (!title) return null;
  const kind = String(proto.type || '档案').trim() || '档案';
  const desc = String(proto.description || '').trim();
  return {
    title: title.slice(0, 80),
    category: 'psychology',
    summary: desc ? `[${kind}] ${desc}` : `[${kind}] 来自人性档案「${title}」的待确认草稿。`,
    tags: ['from_profile', kind].filter(Boolean),
    source: '人性档案导入',
    sourceType: 'from_profile',
    sourceRef: {
      sourceId: String(proto.id || '').trim(),
      sourceModule: 'personal_prototypes',
    },
  };
}

function planMappedDrafts({ vaultRows, tactics, prototypes, source } = {}) {
  const mode = MAP_SOURCES.includes(source) ? source : 'all';
  const drafts = [];
  const skipped = [];
  if (mode === 'tactics' || mode === 'all') {
    for (const tactic of tactics || []) {
      const draft = tacticToDraftInput(tactic);
      if (!draft || !draft.sourceRef.sourceId) continue;
      if (isAlreadyMapped(vaultRows, 'from_game_tactics', draft.sourceRef.sourceId)) {
        skipped.push(draft.sourceRef.sourceId);
        continue;
      }
      drafts.push(draft);
    }
  }
  if (mode === 'prototypes' || mode === 'all') {
    for (const proto of prototypes || []) {
      const draft = prototypeToDraftInput(proto);
      if (!draft || !draft.sourceRef.sourceId) continue;
      if (isAlreadyMapped(vaultRows, 'from_profile', draft.sourceRef.sourceId)) {
        skipped.push(draft.sourceRef.sourceId);
        continue;
      }
      drafts.push(draft);
    }
  }
  return { drafts, skipped, skippedCount: skipped.length };
}

function loadTactics(db, userId) {
  return db.prepare(
    'SELECT * FROM game_theory_tactics WHERE user_id = ? OR user_id = ? ORDER BY created_at ASC'
  ).all('system', userId);
}

function loadPrototypes(db, userId) {
  return db.prepare(
    'SELECT * FROM personal_prototypes WHERE user_id = ? ORDER BY added_at DESC'
  ).all(userId);
}

function loadVaultTheory(db, userId) {
  return db.prepare(
    'SELECT extra_json, source FROM knowledge_vault WHERE user_id = ? AND type = ?'
  ).all(userId, 'theory');
}

function collectMappedSourceIds(rows, sourceType) {
  const ids = [];
  const seen = new Set();
  for (const row of rows || []) {
    const parsed = extra.parseKnowledgeVaultExtra(row.extra_json, row.source);
    if (parsed.syncStatus !== 'synced') continue;
    if (parsed.sourceType !== sourceType) continue;
    const sourceId = sourceIdFromExtra(parsed);
    if (!sourceId || seen.has(sourceId)) continue;
    seen.add(sourceId);
    ids.push(sourceId);
  }
  return ids;
}

function importMappedDrafts(db, input, deps = {}) {
  const userId = input && input.userId;
  if (!userId) throw new Error('userId required');
  const source = MAP_SOURCES.includes(input.source) ? input.source : null;
  if (!source) throw new Error('source must be tactics, prototypes, or all');

  const tactics = deps.tactics || loadTactics(db, userId);
  const prototypes = deps.prototypes || loadPrototypes(db, userId);
  const vaultRows = deps.vaultRows || loadVaultTheory(db, userId);
  const planned = planMappedDrafts({ vaultRows, tactics, prototypes, source });
  const created = planned.drafts.map((draft) => insertTheoryDraft(db, {
    userId,
    title: draft.title,
    category: draft.category,
    summary: draft.summary,
    content: draft.summary,
    tags: draft.tags,
    source: draft.source,
    sourceType: draft.sourceType,
    sourceRef: draft.sourceRef,
  }));
  return {
    created,
    skipped: planned.skipped,
    createdCount: created.length,
    skippedCount: planned.skippedCount,
  };
}

module.exports = {
  MAP_SOURCES,
  sourceIdFromExtra,
  isAlreadyMapped,
  tacticToDraftInput,
  prototypeToDraftInput,
  planMappedDrafts,
  collectMappedSourceIds,
  importMappedDrafts,
};
