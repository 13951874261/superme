/**
 * Wave 3 博弈知识自动注入（纯函数，不依赖 better-sqlite3）。
 * 运行：node vocab-server/tests/gameTheoryKnowledge.test.js
 */
const assert = require('assert');
const {
  MAX_KNOWLEDGE_ITEMS,
  MAX_CONTEXT_CHARS,
  loadInjectedKnowledge,
  attachKnowledgeContext,
  appendKnowledgeTraces,
  buildReminder
} = require('../services/gameTheoryKnowledge');

function syncedExtra(moduleTargets, confirmedAt, difficulty = 1) {
  return JSON.stringify({
    moduleTargets,
    sourceType: 'manual',
    syncStatus: 'synced',
    confirmedAt,
    difficulty,
  });
}

function makeSelectDb(rows) {
  return {
    prepare(sql) {
      if (String(sql).includes('SELECT * FROM knowledge_vault WHERE user_id = ?')) {
        return { all: () => rows };
      }
      throw new Error('unexpected sql: ' + sql);
    }
  };
}

const empty = loadInjectedKnowledge(makeSelectDb([]), 'u1');
assert.equal(empty.context, '');
assert.equal(empty.usedCount, 0);
assert.equal(empty.syncedCount, 0);
assert.equal(empty.maxDifficulty, 1);
assert.equal(empty.isDeepened, false);
assert.equal(empty.reminder, '已同步 0 条，本次使用 0 条');
assert.deepEqual(attachKnowledgeContext({ scene_type: 'corp_clash' }, ''), { scene_type: 'corp_clash' });
assert.equal(Object.prototype.hasOwnProperty.call(attachKnowledgeContext({}, ''), 'knowledge_context'), false);

const mixedRows = [
  {
    id: 'draft',
    user_id: 'u1',
    type: 'theory',
    title: '草稿不应注入',
    summary: '草稿',
    extra_json: JSON.stringify({ moduleTargets: ['game_theory'], syncStatus: 'draft', confirmedAt: 999 }),
    source: 'manual',
    added_at: 1
  },
  {
    id: 'speak',
    user_id: 'u1',
    type: 'theory',
    title: '只同步口语',
    summary: '口语',
    extra_json: syncedExtra(['speak'], 888),
    source: 'manual',
    added_at: 2
  },
  {
    id: 'old',
    user_id: 'u1',
    type: 'theory',
    title: '旧知识',
    summary: '旧摘要',
    extra_json: syncedExtra(['game_theory'], 10),
    source: 'manual',
    added_at: 3
  }
];
for (let i = 0; i < 6; i += 1) {
  mixedRows.push({
    id: `k${i}`,
    user_id: 'u1',
    type: 'theory',
    title: `知识${i}`,
    summary: `内容${i}`,
    extra_json: syncedExtra(['game_theory'], 100 + i),
    source: 'manual',
    added_at: 10 + i
  });
}

const injected = loadInjectedKnowledge(makeSelectDb(mixedRows), 'u1');
assert.equal(injected.syncedCount, 7);
assert.equal(injected.usedCount, MAX_KNOWLEDGE_ITEMS);
assert.deepEqual(injected.ids, ['k5', 'k4', 'k3', 'k2', 'k1']);
assert.ok(injected.context.startsWith('【博弈知识】'));
assert.ok(injected.context.includes('知识5'));
assert.equal(injected.context.includes('知识0'), false);
assert.equal(injected.context.includes('草稿不应注入'), false);
assert.equal(injected.context.includes('只同步口语'), false);
assert.equal(injected.reminder, buildReminder(7, 5));

const withCtx = attachKnowledgeContext({ scene_type: 'corp_clash' }, injected.context);
assert.equal(withCtx.knowledge_context, injected.context);
assert.equal(withCtx.scene_type, 'corp_clash');

const longRow = {
  id: 'long',
  user_id: 'u1',
  type: 'theory',
  title: '超长知识',
  summary: 'X'.repeat(MAX_CONTEXT_CHARS + 80),
  extra_json: syncedExtra(['game_theory'], 1),
  source: 'manual',
  added_at: 1
};
const truncated = loadInjectedKnowledge(makeSelectDb([longRow]), 'u1');
assert.ok(truncated.context.length <= MAX_CONTEXT_CHARS);
assert.ok(truncated.context.endsWith('[内容已截断]'));

const englishRow = {
  id: 'en1',
  user_id: 'u1',
  type: 'english',
  word: 'leverage',
  meaning: '杠杆',
  example: 'Use leverage carefully.',
  title: '',
  summary: '',
  content: '',
  extra_json: syncedExtra(['game_theory'], 50),
  source: 'manual',
  added_at: 1
};
const englishInjected = loadInjectedKnowledge(makeSelectDb([englishRow]), 'u1');
assert.ok(englishInjected.context.includes('leverage'));
assert.ok(englishInjected.context.includes('杠杆'));

const inserts = [];
const insertDb = {
  prepare(sql) {
    if (String(sql).includes('INSERT INTO knowledge_vault_traces')) {
      return {
        run(...args) {
          inserts.push(args);
        }
      };
    }
    throw new Error('unexpected sql: ' + sql);
  }
};
const n = appendKnowledgeTraces(insertDb, 'u1', ['k5', 'k4'], {
  module: 'game_theory',
  action: 'analyzed',
  taskId: 'task-1',
  usedAt: 123
});
assert.equal(n, 2);
assert.equal(inserts.length, 2);
assert.equal(inserts[0][1], 'k5');
assert.equal(inserts[0][2], 'u1');
assert.equal(inserts[0][3], 'game_theory');
assert.equal(inserts[0][4], 'analyzed');
assert.equal(inserts[0][5], 'task-1');
assert.equal(appendKnowledgeTraces(insertDb, 'u1', [], { taskId: 'task-1' }), 0);

const listenRow = {
  id: 'listen1',
  user_id: 'u1',
  type: 'theory',
  title: '听知识',
  summary: '听力摘要',
  extra_json: syncedExtra(['listen'], 1),
  source: 'manual',
  added_at: 1
};
const listenInjected = loadInjectedKnowledge(makeSelectDb([listenRow]), 'u1', 'listen');
assert.ok(listenInjected.context.startsWith('【听力知识】'));
assert.equal(listenInjected.usedCount, 1);

const writingRow = {
  id: 'write1',
  user_id: 'u1',
  type: 'writing',
  title: '结论先行',
  content: '先给判断再展开理由。',
  extra_json: syncedExtra(['writing'], 1),
  source: 'manual',
  added_at: 1
};
const writingInjected = loadInjectedKnowledge(makeSelectDb([writingRow]), 'u1', 'writing');
assert.ok(writingInjected.context.startsWith('【写作知识】'));
assert.equal(writingInjected.usedCount, 1);

const aestheticRow = {
  id: 'aes1',
  user_id: 'u1',
  type: 'aesthetic',
  title: '敬酒顺序',
  content: '先主宾后陪同。',
  extra_json: syncedExtra(['aesthetic'], 1),
  source: 'manual',
  added_at: 1
};
const aestheticInjected = loadInjectedKnowledge(makeSelectDb([aestheticRow]), 'u1', 'aesthetic');
assert.ok(aestheticInjected.context.startsWith('【审美知识】'));
assert.equal(aestheticInjected.usedCount, 1);

// XF-FEED-02: 加深难度识别测试
const deepRow = {
  id: 'deep1',
  user_id: 'u1',
  type: 'theory',
  title: 'BATNA实战',
  summary: '公开底线与真实底线',
  extra_json: syncedExtra(['game_theory'], 100, 3), // difficulty = 3
  source: 'upload_book',
  added_at: 100
};
const deepInjected = loadInjectedKnowledge(makeSelectDb([deepRow]), 'u1', 'game_theory');
assert.equal(deepInjected.maxDifficulty, 3);
assert.equal(deepInjected.isDeepened, true);
assert.ok(deepInjected.context.includes('（加深）'));

console.log('gameTheoryKnowledge.test.js passed');
