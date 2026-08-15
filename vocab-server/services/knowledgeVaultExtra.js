function parseJsonSafe(text, fallback) {
  if (text == null || text === '') return fallback;
  if (typeof text === 'object') return text;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function parseKnowledgeVaultTags(tags) {
  const parsed = parseJsonSafe(tags, []);
  return Array.isArray(parsed) ? parsed : [];
}

function parseKnowledgeVaultExtra(extraJson, source) {
  const parsed = parseJsonSafe(extraJson, {});
  const obj = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : {};
  delete obj.traces;
  return {
    moduleTargets: Array.isArray(obj.moduleTargets) ? obj.moduleTargets : [],
    sourceType: obj.sourceType || source || 'manual',
    sourceRef: obj.sourceRef == null ? '' : obj.sourceRef,
    syncStatus: obj.syncStatus || 'draft',
    confirmedAt: obj.confirmedAt == null ? null : obj.confirmedAt
  };
}

function buildKnowledgeVaultExtra(existingExtra, patch, source) {
  const current = parseKnowledgeVaultExtra(existingExtra, source);
  const next = { ...current };
  if (!patch || typeof patch !== 'object') return next;
  if (patch.moduleTargets !== undefined) {
    next.moduleTargets = Array.isArray(patch.moduleTargets) ? patch.moduleTargets : [];
  }
  if (patch.sourceType !== undefined) next.sourceType = patch.sourceType;
  if (patch.sourceRef !== undefined) next.sourceRef = patch.sourceRef;
  if (patch.syncStatus !== undefined) next.syncStatus = patch.syncStatus;
  if (patch.confirmedAt !== undefined) next.confirmedAt = patch.confirmedAt;
  delete next.traces;
  return next;
}

function collectKnowledgeVaultExtraPatch(body) {
  const patch = {};
  if (!body || typeof body !== 'object') return patch;
  const nested = body.extra_json && typeof body.extra_json === 'object' && !Array.isArray(body.extra_json)
    ? body.extra_json
    : {};
  ['moduleTargets', 'sourceType', 'sourceRef', 'syncStatus', 'confirmedAt'].forEach((key) => {
    if (body[key] !== undefined) patch[key] = body[key];
    else if (nested[key] !== undefined) patch[key] = nested[key];
  });
  return patch;
}

function formatKnowledgeVaultTrace(t) {
  return {
    ...t,
    knowledgeId: t.knowledge_id,
    userId: t.user_id,
    taskId: t.task_id,
    sessionId: t.session_id,
    usedAt: t.used_at
  };
}

function formatKnowledgeVaultRow(row, traces) {
  if (!row) return row;
  const extra = parseKnowledgeVaultExtra(row.extra_json, row.source);
  const tags = parseKnowledgeVaultTags(row.tags);
  const formatted = {
    ...row,
    userId: row.user_id,
    tags,
    extra_json: extra,
    moduleTargets: extra.moduleTargets,
    sourceType: extra.sourceType,
    sourceRef: extra.sourceRef,
    syncStatus: extra.syncStatus,
    confirmedAt: extra.confirmedAt,
    addedAt: row.added_at,
    added_at: row.added_at
  };
  if (traces !== undefined) {
    formatted.traces = Array.isArray(traces) ? traces.map(formatKnowledgeVaultTrace) : traces;
  }
  return formatted;
}

function filterLinkedKnowledgeRows(rows, moduleName) {
  return (rows || []).filter((row) => {
    const extra = parseKnowledgeVaultExtra(row.extra_json, row.source);
    return extra.syncStatus === 'synced' && extra.moduleTargets.includes(moduleName);
  });
}

function sortLinkedKnowledgeRows(rows) {
  return (rows || []).slice().sort((a, b) => {
    const extraA = parseKnowledgeVaultExtra(a.extra_json, a.source);
    const extraB = parseKnowledgeVaultExtra(b.extra_json, b.source);
    const va = extraA.confirmedAt || a.added_at || 0;
    const vb = extraB.confirmedAt || b.added_at || 0;
    return vb - va;
  });
}

const KNOWLEDGE_MODULES = ['listen', 'speak', 'game_theory', 'writing', 'aesthetic'];
const TRACE_ACTIONS = ['generated', 'analyzed', 'reviewed'];

function sanitizeModuleTargets(moduleTargets) {
  if (!Array.isArray(moduleTargets)) return [];
  return moduleTargets.filter((item) => KNOWLEDGE_MODULES.includes(item));
}

function assertKnowledgeVaultOwner(row, userId) {
  if (userId == null || String(userId).trim() === '') {
    return { status: 400, error: 'userId required' };
  }
  if (!row) return { status: 404, error: 'Not found' };
  if (row.user_id !== userId) return { status: 403, error: 'Forbidden' };
  return null;
}

function readKnowledgeVaultUserId(req) {
  const bodyId = req && req.body && req.body.userId;
  const queryId = req && req.query && req.query.userId;
  const value = bodyId != null && bodyId !== '' ? bodyId : queryId;
  return value == null ? '' : String(value);
}

function buildKnowledgeVaultRevisionSnapshot(row) {
  const formatted = formatKnowledgeVaultRow(row);
  if (!formatted || typeof formatted !== 'object') return formatted;
  const { traces, ...snapshot } = formatted;
  return snapshot;
}

function formatKnowledgeVaultRevision(rev) {
  if (!rev) return rev;
  return {
    id: rev.id,
    knowledgeId: rev.knowledge_id,
    userId: rev.user_id,
    createdAt: rev.created_at,
    snapshot: parseJsonSafe(rev.snapshot_json, {})
  };
}

module.exports = {
  parseJsonSafe,
  parseKnowledgeVaultTags,
  parseKnowledgeVaultExtra,
  buildKnowledgeVaultExtra,
  collectKnowledgeVaultExtraPatch,
  formatKnowledgeVaultTrace,
  formatKnowledgeVaultRow,
  filterLinkedKnowledgeRows,
  sortLinkedKnowledgeRows,
  sanitizeModuleTargets,
  assertKnowledgeVaultOwner,
  readKnowledgeVaultUserId,
  buildKnowledgeVaultRevisionSnapshot,
  formatKnowledgeVaultRevision,
  KNOWLEDGE_MODULES,
  TRACE_ACTIONS
};
