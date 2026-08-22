import assert from 'node:assert/strict';
import test from 'node:test';
import { isUsableForModule, toKnowledgeItem } from '../types/knowledge';
import {
  MAX_CONTEXT_CHARS,
  MAX_KNOWLEDGE_ITEMS,
  buildGameTheoryKnowledgeContext,
  buildGameTheoryKnowledgeHint,
  buildListenKnowledgeContext,
  selectKnowledgeForInject,
} from './knowledgeAdapter';

test('英语笔记转换成 title=word、content=释义+例句', () => {
  const item = toKnowledgeItem({
    type: 'english',
    id: 'n1',
    word: 'leverage',
    meaning: '杠杆',
    example: 'Use leverage carefully.',
    added_at: 10,
  });
  assert.equal(item.title, 'leverage');
  assert.equal(item.content, '杠杆\nUse leverage carefully.');
  assert.equal(item.summary, '杠杆');
  assert.equal(item.syncStatus, 'draft');
  assert.deepEqual(item.moduleTargets, []);
});

test('理论框架用 summary 作为 content', () => {
  const item = toKnowledgeItem({
    type: 'theory',
    id: 't1',
    title: '信息不对称',
    summary: '一方掌握更多信息时会影响报价。',
    addedAt: 20,
  });
  assert.equal(item.title, '信息不对称');
  assert.equal(item.content, '一方掌握更多信息时会影响报价。');
});

test('未同步条目不能注入模块', () => {
  const item = toKnowledgeItem({
    type: 'theory',
    id: 't2',
    title: '权力距离',
    summary: '上下级权力差距。',
    syncStatus: 'draft',
    moduleTargets: ['listen'],
  });
  assert.equal(isUsableForModule(item, 'listen'), false);
});

test('自动注入只取最近确认的 5 条，空列表返回空字符串', () => {
  assert.equal(buildListenKnowledgeContext([]), '');

  const items = Array.from({ length: 7 }, (_, i) =>
    toKnowledgeItem({
      type: 'theory',
      id: `k${i}`,
      title: `知识${i}`,
      summary: `内容${i}`,
      syncStatus: 'synced',
      moduleTargets: ['game_theory'],
      confirmedAt: i,
    }),
  );
  const selected = selectKnowledgeForInject(items);
  assert.equal(selected.length, MAX_KNOWLEDGE_ITEMS);
  assert.equal(selected[0].title, '知识6');

  const context = buildGameTheoryKnowledgeContext(items);
  assert.ok(context.includes('【博弈知识】'));
  assert.ok(context.includes('知识6'));
  assert.equal(context.includes('知识1'), false);
  assert.ok(context.length <= MAX_CONTEXT_CHARS + 20);
});

test('博弈页提示：抽屉有货优先，否则回退战术库条数', () => {
  assert.equal(
    buildGameTheoryKnowledgeHint(8, 20),
    '已同步 8 条博弈知识，本次训练将自动引用 5 条',
  );
  assert.equal(buildGameTheoryKnowledgeHint(0, 8), '已引用战术库 5 条');
  assert.equal(buildGameTheoryKnowledgeHint(0, 3), '已引用战术库 3 条');
  assert.equal(
    buildGameTheoryKnowledgeHint(0, 0),
    '尚未同步博弈知识，本次训练不注入资料抽屉内容',
  );
});
