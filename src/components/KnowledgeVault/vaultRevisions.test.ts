import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeKnowledgeRevision, summarizeKnowledgeRevision } from './vaultRevisions';

test('英语快照摘要为 单词｜释义', () => {
  assert.equal(
    summarizeKnowledgeRevision({ word: 'hello', meaning: '你好' }),
    'hello｜你好',
  );
});

test('理论快照摘要为 标题｜概要截断', () => {
  const summary = '一方掌握更多信息'.repeat(10);
  const text = summarizeKnowledgeRevision({ title: '信息不对称', summary });
  assert.match(text, /^信息不对称｜/);
  assert.ok(text.length <= 90);
});

test('normalize 保留 id、时间与 snapshot', () => {
  const item = normalizeKnowledgeRevision({
    id: 'r1',
    knowledge_id: 'k1',
    user_id: 'u1',
    created_at: 42,
    snapshot: { word: 'hello', meaning: 'old' },
  });
  assert.equal(item?.id, 'r1');
  assert.equal(item?.knowledgeId, 'k1');
  assert.equal(item?.createdAt, 42);
  assert.equal(item?.snapshot.word, 'hello');
});
