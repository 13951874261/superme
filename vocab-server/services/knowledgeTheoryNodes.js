/**
 * 提纯 theoryNodes → 资料抽屉理论框架草稿。
 * 每个知识点一条；最多 8 条；不自动同步。
 */
const extra = require('./knowledgeVaultExtra');
const { insertTheoryDraft, guessSourceType } = require('./knowledgeDraftExtract');
const { isAlreadyMapped } = require('./knowledgeMapImport');

const MAX_THEORY_NODE_DRAFTS = 8;

function nodeSourceId(fileName, title) {
  return String(fileName || '').trim() + '::' + String(title || '').trim();
}

function buildNodeSummary(node) {
  const concept = String((node && node.concept) || '').trim();
  const points = Array.isArray(node && node.points)
    ? node.points.filter((item) => typeof item === 'string' && item.trim())
    : [];
  const framework = Array.isArray(node && node.framework)
    ? node.framework.filter((item) => typeof item === 'string' && item.trim())
    : [];
  const parts = [];
  if (concept) parts.push(concept);
  if (framework.length) parts.push('框架：' + framework.join('、'));
  parts.push(...points.map((item) => item.trim()));
  return parts.join('\n').slice(0, 2000);
}

function theoryNodeToDraftInput(node, meta) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
  const title = String(node.title || '').trim().slice(0, 80);
  if (!title) return null;
  const fileName = String((meta && meta.fileName) || '').trim();
  const sourceUrl = String((meta && meta.sourceUrl) || '').trim();
  const mimeType = (meta && meta.mimeType) || '';
  const sourceType = guessSourceType(fileName, mimeType);
  const sourceRef = {
    sourceId: nodeSourceId(fileName || sourceUrl, title),
    sourceModule: 'material_purify',
  };
  if (fileName) sourceRef.fileName = fileName;
  if (sourceUrl) sourceRef.sourceUrl = sourceUrl;
  const summary = buildNodeSummary(node) || `来自材料「${fileName || sourceUrl || '上传'}」的待确认知识点。`;
  return {
    title,
    category: 'game_theory',
    summary,
    tags: ['material_purify', sourceType],
    source: fileName || sourceUrl || 'material_purify',
    sourceType,
    sourceRef,
  };
}

function planTheoryNodeDrafts({ vaultRows, theoryNodes, fileName, mimeType, sourceUrl } = {}) {
  const drafts = [];
  const skipped = [];
  const meta = { fileName, mimeType, sourceUrl };
  for (const node of theoryNodes || []) {
    const draft = theoryNodeToDraftInput(node, meta);
    if (!draft || !draft.sourceRef.sourceId) continue;
    if (drafts.length >= MAX_THEORY_NODE_DRAFTS) {
      skipped.push(draft.sourceRef.sourceId);
      continue;
    }
    if (isAlreadyMapped(vaultRows, draft.sourceType, draft.sourceRef.sourceId)) {
      skipped.push(draft.sourceRef.sourceId);
      continue;
    }
    drafts.push(draft);
  }
  return { drafts, skipped, skippedCount: skipped.length };
}

function loadVaultTheory(db, userId) {
  return db.prepare(
    'SELECT extra_json, source FROM knowledge_vault WHERE user_id = ? AND type = ?'
  ).all(userId, 'theory');
}

function attachBatchSourceRef(sourceRef, batchId) {
  if (!batchId) return sourceRef;
  if (sourceRef && typeof sourceRef === 'object' && !Array.isArray(sourceRef)) {
    return { ...sourceRef, batchId: String(batchId) };
  }
  return { sourceId: String(sourceRef || ''), batchId: String(batchId) };
}

function importMindmapDraft(db, input) {
  const mindmap = input && input.mindmap;
  if (!mindmap || typeof mindmap !== 'object') return null;
  const topic = String((input && input.topic) || '').trim() || '材料导图';
  const fileName = String((input && input.fileName) || '').trim();
  const batchId = input && input.batchId ? String(input.batchId) : '';
  const sourceType = 'ai_extract';
  const sourceRef = attachBatchSourceRef({
    sourceId: nodeSourceId(fileName || batchId || topic, '__mindmap__'),
    sourceModule: 'material_purify',
    fileName: fileName || undefined,
  }, batchId);
  return insertTheoryDraft(db, {
    userId: input.userId,
    title: `导图 · ${topic}`.slice(0, 80),
    category: 'game_theory',
    summary: `材料「${fileName || topic}」的思维导图（只读）。中心：${String(mindmap.center || topic)}`,
    content: String(mindmap.center || topic),
    tags: ['material_purify', 'mindmap'],
    source: fileName || batchId || 'material_purify',
    sourceType,
    sourceRef,
    mindmap: {
      center: mindmap.center == null ? '' : String(mindmap.center),
      branches: Array.isArray(mindmap.branches) ? mindmap.branches : [],
    },
  });
}

function importTheoryNodeDrafts(db, input, deps = {}) {
  const userId = input && input.userId;
  if (!userId) throw new Error('userId required');
  const vaultRows = deps.vaultRows || loadVaultTheory(db, userId);
  const batchId = input.batchId || (input.taskId ? `material:${input.taskId}` : '');
  const planned = planTheoryNodeDrafts({
    vaultRows,
    theoryNodes: input.theoryNodes,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sourceUrl: input.sourceUrl,
  });
  const created = planned.drafts.map((draft) => insertTheoryDraft(db, {
    userId,
    title: draft.title,
    category: draft.category,
    summary: draft.summary,
    content: draft.summary,
    tags: draft.tags,
    source: draft.source,
    sourceType: draft.sourceType,
    sourceRef: attachBatchSourceRef(draft.sourceRef, batchId),
  }));
  let mindmapNote = null;
  if (input.mindmap) {
    try {
      mindmapNote = importMindmapDraft(db, {
        userId,
        mindmap: input.mindmap,
        topic: input.topic,
        fileName: input.fileName,
        batchId,
      });
      if (mindmapNote) created.push(mindmapNote);
    } catch (err) {
      console.warn('[knowledgeTheoryNodes] mindmap import failed:', err.message);
    }
  }
  return {
    created,
    skipped: planned.skipped,
    createdCount: created.length,
    skippedCount: planned.skippedCount,
    mindmapId: mindmapNote && mindmapNote.id ? mindmapNote.id : null,
    batchId: batchId || null,
  };
}

module.exports = {
  MAX_THEORY_NODE_DRAFTS,
  nodeSourceId,
  theoryNodeToDraftInput,
  planTheoryNodeDrafts,
  importMindmapDraft,
  importTheoryNodeDrafts,
  attachBatchSourceRef,
};
