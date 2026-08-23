import assert from 'node:assert/strict';
import test from 'node:test';
import { collectedKeysFromVocabAddTasks, reconcileVocabCollectQueue } from './reconcileVocabCollectQueue';

test('任务中心 completed 后，queued 词应变为 collected', () => {
  const result = reconcileVocabCollectQueue(
    { 'task-demo': 'demonstrate' },
    [{ id: 'task-demo', status: 'completed' }],
  );

  assert.deepEqual(result.collectedKeys, ['demonstrate']);
  assert.deepEqual(result.failedKeys, []);
  assert.deepEqual(result.remaining, {});
});

test('任务仍在 running 时保持 queued', () => {
  const result = reconcileVocabCollectQueue(
    { 'task-demo': 'demonstrate' },
    [{ id: 'task-demo', status: 'running' }],
  );

  assert.deepEqual(result.collectedKeys, []);
  assert.deepEqual(result.remaining, { 'task-demo': 'demonstrate' });
});

test('从已完成的生词收录任务名回收按钮态', () => {
  const keys = collectedKeysFromVocabAddTasks([
    { id: 't1', status: 'completed', type: 'vocab_add', name: '生词本收录: demonstrate' },
    { id: 't2', status: 'running', type: 'vocab_add', name: '生词本收录: ignore-me' },
  ]);
  assert.deepEqual(keys, ['demonstrate']);
});

test('任务 failed 后清 queued，允许重试', () => {
  const result = reconcileVocabCollectQueue(
    { 'task-demo': 'demonstrate' },
    [{ id: 'task-demo', status: 'failed' }],
  );

  assert.deepEqual(result.collectedKeys, []);
  assert.deepEqual(result.failedKeys, ['demonstrate']);
  assert.deepEqual(result.remaining, {});
});
