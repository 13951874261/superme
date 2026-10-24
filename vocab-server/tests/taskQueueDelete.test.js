const assert = require('assert');

// NODE_ENV=test 必须在 require 前设置，使队列使用独立临时目录并关闭定时清理。
process.env.NODE_ENV = 'test';

const taskQueue = require('../services/taskQueue');

function wipeAll() {
  for (const t of taskQueue.getAllTasks()) {
    taskQueue.tasks.delete(t.id);
  }
  taskQueue._save();
}

function testDeleteFinishedOk() {
  wipeAll();
  const t = taskQueue.createTask('url', 't1');
  taskQueue.updateTask(t.id, { status: 'completed', progress: 100 });
  const r = taskQueue.deleteTask(t.id);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(taskQueue.getTask(t.id), undefined);
}

function testDeleteRunningConflict() {
  wipeAll();
  const t = taskQueue.createTask('url', 't2');
  taskQueue.updateTask(t.id, { status: 'running', progress: 10 });
  const r = taskQueue.deleteTask(t.id);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 409);
  assert.ok(taskQueue.getTask(t.id));
}

function testDeletePendingConflict() {
  wipeAll();
  const t = taskQueue.createTask('url', 't3');
  const r = taskQueue.deleteTask(t.id);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 409);
  assert.ok(taskQueue.getTask(t.id));
}

function testDeleteMissing404() {
  wipeAll();
  const r = taskQueue.deleteTask('task_missing');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 404);
}

function testClearFinishedKeepsRunningAndSpeakingScenes() {
  wipeAll();
  const a = taskQueue.createTask('url', 'done');
  taskQueue.updateTask(a.id, { status: 'failed', error: 'x' });
  const b = taskQueue.createTask('url', 'run');
  taskQueue.updateTask(b.id, { status: 'running', progress: 1 });
  const scene = taskQueue.createTask('speaking_scene', 'private');
  taskQueue.updateTask(scene.id, { status: 'completed', userId: 'alice' });
  const r = taskQueue.clearFinishedTasks();
  assert.strictEqual(r.deleted, 1);
  assert.strictEqual(taskQueue.getTask(a.id), undefined);
  assert.ok(taskQueue.getTask(b.id));
  assert.ok(taskQueue.getTask(scene.id));
}

function testGlobalVisibilityHidesSpeakingScenesWithoutMatchingUser() {
  wipeAll();
  const scene = taskQueue.createTask('speaking_scene', 'private');
  taskQueue.updateTask(scene.id, { status: 'completed', userId: 'alice' });
  assert.deepStrictEqual(taskQueue.getPublicTasks().map((t) => t.id), []);
  assert.strictEqual(taskQueue.getPublicTask(scene.id), undefined);
  assert.strictEqual(taskQueue.getPublicTask(scene.id, 'bob'), undefined);
  assert.strictEqual(taskQueue.getPublicTask(scene.id, 'alice').id, scene.id);
  assert.strictEqual(taskQueue.deletePublicTask(scene.id).code, 404);
  assert.strictEqual(taskQueue.deletePublicTask(scene.id, 'bob').code, 404);
  assert.strictEqual(taskQueue.deletePublicTask(scene.id, 'alice').ok, true);
}

try {
  testDeleteFinishedOk();
  testDeleteRunningConflict();
  testDeletePendingConflict();
  testDeleteMissing404();
  testClearFinishedKeepsRunningAndSpeakingScenes();
  testGlobalVisibilityHidesSpeakingScenesWithoutMatchingUser();
  wipeAll();
  console.log('✅ taskQueueDelete.test.js 通过');
} catch (e) {
  console.error('❌', e);
  process.exit(1);
}
