/**
 * 知识中台图谱：从 knowledge_vault + traces 生成 SQLite 节点/边。
 * 草稿节点可见，但没有模块边；已同步才连 listen/speak/game_theory/writing/aesthetic。
 */
const extra = require('./knowledgeVaultExtra');

const GRAPH_MODULES = ['listen', 'speak', 'game_theory', 'writing', 'aesthetic'];
const MODULE_TITLES = {
  listen: '听',
  speak: '说',
  game_theory: '博弈',
  writing: '写作',
  aesthetic: '审美'
};

function knowledgeNodeId(knowledgeId) {
  return 'kn:' + knowledgeId;
}

function moduleNodeId(userId, moduleName) {
  return 'mod:' + userId + ':' + moduleName;
}

function edgeId(fromId, toId, rel) {
  return fromId + '|' + toId + '|' + rel;
}

function knowledgeTitle(row) {
  const formatted = extra.formatKnowledgeVaultRow(row);
  return formatted.title || formatted.word || '未命名知识';
}

function planUserGraph(userId, vaultRows, traces) {
  const now = Date.now();
  const nodes = GRAPH_MODULES.map((moduleName) => ({
    id: moduleNodeId(userId, moduleName),
    userId,
    kind: 'module',
    refId: moduleName,
    title: MODULE_TITLES[moduleName],
    createdAt: now
  }));

  (vaultRows || []).forEach((row) => {
    if (!row || !row.id) return;
    const parsed = extra.parseKnowledgeVaultExtra(row.extra_json, row.source);
    nodes.push({
      id: knowledgeNodeId(row.id),
      userId,
      kind: 'knowledge',
      refId: row.id,
      title: knowledgeTitle(row),
      type: row.type || '',
      syncStatus: parsed.syncStatus || 'draft',
      createdAt: row.added_at || now
    });
  });

  const edges = [];
  const edgeKeys = new Set();
  const addEdge = (fromId, toId, rel) => {
    const id = edgeId(fromId, toId, rel);
    if (edgeKeys.has(id)) return;
    edgeKeys.add(id);
    edges.push({ id, userId, fromId, toId, rel, createdAt: now });
  };

  (vaultRows || []).forEach((row) => {
    if (!row || !row.id) return;
    const parsed = extra.parseKnowledgeVaultExtra(row.extra_json, row.source);
    if (parsed.syncStatus !== 'synced') return;
    const fromId = knowledgeNodeId(row.id);
    (parsed.moduleTargets || []).forEach((moduleName) => {
      if (!GRAPH_MODULES.includes(moduleName)) return;
      addEdge(fromId, moduleNodeId(userId, moduleName), 'synced_to');
    });
  });

  const syncedIds = new Set();
  (vaultRows || []).forEach((row) => {
    if (!row || !row.id) return;
    const parsed = extra.parseKnowledgeVaultExtra(row.extra_json, row.source);
    if (parsed.syncStatus === 'synced') syncedIds.add(row.id);
  });

  (traces || []).forEach((trace) => {
    const knowledgeId = trace.knowledge_id || trace.knowledgeId;
    const moduleName = trace.module;
    if (!knowledgeId || !syncedIds.has(knowledgeId)) return;
    if (!GRAPH_MODULES.includes(moduleName)) return;
    addEdge(knowledgeNodeId(knowledgeId), moduleNodeId(userId, moduleName), 'used_by');
  });

  return { nodes, edges };
}

function persistUserGraph(db, userId, plan) {
  const delEdges = db.prepare('DELETE FROM knowledge_graph_edges WHERE user_id = ?');
  const delNodes = db.prepare('DELETE FROM knowledge_graph_nodes WHERE user_id = ?');
  const insNode = db.prepare(`
    INSERT INTO knowledge_graph_nodes (id, user_id, kind, ref_id, title, extra_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insEdge = db.prepare(`
    INSERT INTO knowledge_graph_edges (id, user_id, from_id, to_id, rel, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const run = () => {
    delEdges.run(userId);
    delNodes.run(userId);
    (plan.nodes || []).forEach((node) => {
      insNode.run(
        node.id,
        userId,
        node.kind,
        node.refId,
        node.title,
        JSON.stringify({
          type: node.type || '',
          syncStatus: node.syncStatus || ''
        }),
        node.createdAt || Date.now()
      );
    });
    (plan.edges || []).forEach((edge) => {
      insEdge.run(
        edge.id,
        userId,
        edge.fromId,
        edge.toId,
        edge.rel,
        edge.createdAt || Date.now()
      );
    });
  };
  if (typeof db.transaction === 'function') {
    db.transaction(run)();
  } else {
    run();
  }
}

function loadAndPersistUserGraph(db, userId) {
  const rows = db.prepare('SELECT * FROM knowledge_vault WHERE user_id = ?').all(userId);
  const traces = db.prepare('SELECT knowledge_id, module FROM knowledge_vault_traces WHERE user_id = ?').all(userId);
  const plan = planUserGraph(userId, rows, traces);
  try {
    persistUserGraph(db, userId, plan);
  } catch (err) {
    console.error('[knowledgeGraph] persist failed:', err);
  }
  return plan;
}

module.exports = {
  GRAPH_MODULES,
  MODULE_TITLES,
  knowledgeNodeId,
  moduleNodeId,
  planUserGraph,
  persistUserGraph,
  loadAndPersistUserGraph
};
