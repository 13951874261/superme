/**
 * 提纯 theoryNodes → 资料抽屉理论框架草稿（每个知识点一条，最多 8 条，不自动同步）。
 * 运行：node vocab-server/tests/knowledgeTheoryNodes.test.js
 */
const assert = require('assert');
const extra = require('../services/knowledgeVaultExtra');
const {
  MAX_THEORY_NODE_DRAFTS,
  theoryNodeToDraftInput,
  planTheoryNodeDrafts,
  importTheoryNodeDrafts,
} = require('../services/knowledgeTheoryNodes');

assert.equal(MAX_THEORY_NODE_DRAFTS, 8);
assert.equal(theoryNodeToDraftInput(null, { fileName: 'a.pdf' }), null);
assert.equal(theoryNodeToDraftInput({ title: '  ' }, { fileName: 'a.pdf' }), null);

const nodeDraft = theoryNodeToDraftInput({
  title: '信息不对称',
  concept: '一方掌握更多信息时会影响报价。',
  framework: ['信息优势', '信任'],
  points: ['卖方隐瞒成本。', '买方要求披露。'],
}, { fileName: '博弈论.pdf' });
assert.equal(nodeDraft.title, '信息不对称');
assert.equal(nodeDraft.category, 'game_theory');
assert.equal(nodeDraft.sourceType, 'upload_book');
assert.equal(nodeDraft.syncStatus, undefined);
assert.equal(nodeDraft.sourceRef.sourceId, '博弈论.pdf::信息不对称');
assert.equal(nodeDraft.sourceRef.fileName, '博弈论.pdf');
assert.ok(nodeDraft.summary.includes('报价'));
assert.ok(nodeDraft.summary.includes('卖方隐瞒成本'));

const videoDraft = theoryNodeToDraftInput({
  title: '信号传递',
  concept: '用可验证行动传递类型。',
  points: [],
}, { fileName: 'lecture.mp4', mimeType: 'video/mp4' });
assert.equal(videoDraft.sourceType, 'upload_video');
assert.equal(videoDraft.sourceRef.sourceId, 'lecture.mp4::信号传递');

const nodes = [
  { title: '信息不对称', concept: '信息差。', points: ['例1'] },
  { title: '信号传递', concept: '发信号。', points: ['例2'] },
  { title: '逆向选择', concept: '劣币。', points: ['例3'] },
];
const planned = planTheoryNodeDrafts({
  vaultRows: [],
  theoryNodes: nodes,
  fileName: '博弈论.pdf',
});
assert.equal(planned.drafts.length, 3);
assert.equal(planned.skippedCount, 0);
assert.equal(planned.drafts[0].sourceType, 'upload_book');
assert.deepEqual(planned.drafts.map((d) => d.title), ['信息不对称', '信号传递', '逆向选择']);

const existing = extra.buildKnowledgeVaultExtra('{}', {
  sourceType: 'upload_book',
  sourceRef: { sourceId: '博弈论.pdf::信息不对称', fileName: '博弈论.pdf' },
  syncStatus: 'draft',
  moduleTargets: [],
}, '博弈论.pdf');
const plannedDedup = planTheoryNodeDrafts({
  vaultRows: [{ extra_json: existing, source: '博弈论.pdf' }],
  theoryNodes: nodes,
  fileName: '博弈论.pdf',
});
assert.equal(plannedDedup.drafts.length, 2);
assert.equal(plannedDedup.skippedCount, 1);
assert.equal(plannedDedup.drafts[0].title, '信号传递');

const nine = Array.from({ length: 9 }, (_, i) => ({
  title: `知识点${i + 1}`,
  concept: `解释${i + 1}`,
  points: [`例子${i + 1}`],
}));
const plannedCap = planTheoryNodeDrafts({
  vaultRows: [],
  theoryNodes: nine,
  fileName: 'book.pdf',
});
assert.equal(plannedCap.drafts.length, 8);
assert.equal(plannedCap.skippedCount, 1);

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

const imported = importTheoryNodeDrafts(fakeDb, {
  userId: 'u1',
  fileName: '博弈论.pdf',
  theoryNodes: [
    { title: '信息不对称', concept: '一方掌握更多信息。', points: ['卖方隐瞒成本。'] },
  ],
}, { vaultRows: [] });
assert.equal(imported.createdCount, 1);
assert.equal(imported.skippedCount, 0);
assert.equal(imported.created[0].syncStatus, 'draft');
assert.deepEqual(imported.created[0].moduleTargets, []);
assert.equal(imported.created[0].sourceType, 'upload_book');
assert.equal(imported.created[0].title, '信息不对称');

assert.throws(
  () => importTheoryNodeDrafts(fakeDb, { fileName: 'a.pdf', theoryNodes: nodes }),
  /userId required/
);

const empty = planTheoryNodeDrafts({ vaultRows: [], theoryNodes: [], fileName: 'a.pdf' });
assert.equal(empty.drafts.length, 0);

console.log('knowledgeTheoryNodes.test.js passed');
