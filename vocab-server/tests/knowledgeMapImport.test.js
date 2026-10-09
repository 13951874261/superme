/**
 * Wave 6 战术库 / 人性档案 → 资料抽屉草稿（纯函数，不依赖 better-sqlite3）。
 * 运行：node vocab-server/tests/knowledgeMapImport.test.js
 */
const assert = require('assert');
const extra = require('../services/knowledgeVaultExtra');
const {
  sourceIdFromExtra,
  isAlreadyMapped,
  tacticToDraftInput,
  prototypeToDraftInput,
  planMappedDrafts,
  importMappedDrafts,
  collectMappedSourceIds,
} = require('../services/knowledgeMapImport');

const extraA = extra.buildKnowledgeVaultExtra('{}', {
  sourceType: 'from_game_tactics',
  sourceRef: { sourceId: 't1', sourceModule: 'game_theory_tactics' },
  syncStatus: 'draft',
  moduleTargets: [],
}, '战术库导入');
assert.equal(sourceIdFromExtra(extraA), 't1');
assert.equal(isAlreadyMapped([{ extra_json: extraA, source: '战术库导入' }], 'from_game_tactics', 't1'), true);
assert.equal(isAlreadyMapped([{ extra_json: extraA, source: '战术库导入' }], 'from_game_tactics', 't2'), false);

const tacticDraft = tacticToDraftInput({
  id: 't9',
  name: '架空',
  category: 'downward',
  description: '保留面子，收回签字权。',
  source_file: 'seed',
});
assert.equal(tacticDraft.title, '架空');
assert.equal(tacticDraft.category, 'game_theory');
assert.equal(tacticDraft.sourceType, 'from_game_tactics');
assert.equal(tacticDraft.sourceRef.sourceId, 't9');
assert.equal(tacticDraft.sourceRef.sourceModule, 'game_theory_tactics');
assert.ok(tacticDraft.summary.includes('签字权'));
assert.equal(tacticToDraftInput({ id: 'x', name: '  ' }), null);

const protoDraft = prototypeToDraftInput({
  id: 'p1',
  name: '李总',
  type: '利益驱动型',
  description: '在资源分配上极度敏感。',
});
assert.equal(protoDraft.title, '李总');
assert.equal(protoDraft.category, 'psychology');
assert.equal(protoDraft.sourceType, 'from_profile');
assert.equal(protoDraft.sourceRef.sourceId, 'p1');
assert.equal(protoDraft.sourceRef.sourceModule, 'personal_prototypes');
assert.ok(protoDraft.summary.includes('利益驱动型'));

const vaultRows = [{ extra_json: extraA, source: '战术库导入' }];
const planned = planMappedDrafts({
  vaultRows,
  tactics: [
    { id: 't1', name: '恩威并施', category: 'downward', description: '已映射过' },
    { id: 't2', name: '制衡术', category: 'downward', description: '新战术' },
  ],
  prototypes: [
    { id: 'p1', name: '李总', type: '利益驱动型', description: '敏感' },
  ],
  source: 'tactics',
});
assert.equal(planned.drafts.length, 1);
assert.equal(planned.drafts[0].sourceRef.sourceId, 't2');
assert.equal(planned.skippedCount, 1);

const plannedAll = planMappedDrafts({
  vaultRows: [],
  tactics: [{ id: 't2', name: '制衡术', description: '新战术' }],
  prototypes: [{ id: 'p1', name: '李总', type: '利益驱动型', description: '敏感' }],
  source: 'all',
});
assert.equal(plannedAll.drafts.length, 2);
assert.equal(plannedAll.skippedCount, 0);

const inserts = [];
const fakeDb = {
  prepare(sql) {
    const text = String(sql);
    if (text.includes('INSERT INTO knowledge_vault')) {
      return {
        run(...args) {
          inserts.push(args);
        },
      };
    }
    if (text.includes('SELECT * FROM knowledge_vault WHERE id = ?')) {
      return {
        get(id) {
          const row = inserts.find((item) => item[0] === id) || inserts[inserts.length - 1];
          return {
            id,
            user_id: row[1],
            type: row[2],
            word: row[3],
            meaning: row[4],
            example: row[5],
            title: row[6],
            category: row[7],
            summary: row[8],
            content: row[9],
            source: row[10],
            added_at: row[11],
            tags: row[12],
            extra_json: row[13],
          };
        },
      };
    }
    throw new Error('unexpected sql: ' + sql);
  },
};

const imported = importMappedDrafts(fakeDb, { userId: 'u1', source: 'prototypes' }, {
  tactics: [{ id: 't2', name: '制衡术', description: '不应导入' }],
  prototypes: [{ id: 'p1', name: '李总', type: '利益驱动型', description: '在资源分配上极度敏感。' }],
  vaultRows: [],
});
assert.equal(imported.createdCount, 1);
assert.equal(imported.skippedCount, 0);
assert.equal(imported.created[0].syncStatus, 'draft');
assert.deepEqual(imported.created[0].moduleTargets, []);
assert.equal(imported.created[0].sourceType, 'from_profile');
assert.equal(imported.created[0].title, '李总');
assert.equal(imported.created[0].sourceRef.sourceId, 'p1');

const skippedAgain = importMappedDrafts(fakeDb, { userId: 'u1', source: 'prototypes' }, {
  tactics: [],
  prototypes: [{ id: 'p1', name: '李总', type: '利益驱动型', description: '在资源分配上极度敏感。' }],
  vaultRows: [{
    extra_json: extra.buildKnowledgeVaultExtra('{}', {
      sourceType: 'from_profile',
      sourceRef: { sourceId: 'p1', sourceModule: 'personal_prototypes' },
      syncStatus: 'draft',
      moduleTargets: [],
    }, '人性档案导入'),
    source: '人性档案导入',
  }],
});
assert.equal(skippedAgain.createdCount, 0);
assert.equal(skippedAgain.skippedCount, 1);

const mappedIds = collectMappedSourceIds([
  {
    extra_json: extra.buildKnowledgeVaultExtra('{}', {
      sourceType: 'from_profile',
      sourceRef: { sourceId: 'p1', sourceModule: 'personal_prototypes' },
      syncStatus: 'synced',
      moduleTargets: ['game_theory'],
    }, '人性档案导入'),
    source: '人性档案导入',
  },
  {
    extra_json: extra.buildKnowledgeVaultExtra('{}', {
      sourceType: 'from_profile',
      sourceRef: { sourceId: 'p2', sourceModule: 'personal_prototypes' },
      syncStatus: 'draft',
      moduleTargets: [],
    }, '人性档案导入'),
    source: '人性档案导入',
  },
], 'from_profile');
assert.deepEqual(mappedIds, ['p1']);

console.log('knowledgeMapImport.test.js passed');
