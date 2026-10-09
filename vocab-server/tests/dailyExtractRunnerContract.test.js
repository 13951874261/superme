const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const service = require('../services/dailyPackService');
const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const unit = fs.readFileSync(path.join(__dirname, '../../super-agent-vocab.service'), 'utf8');
const db = { prepare: () => ({ run() {}, get: () => null, all: () => [] }) };
const theme = '商务谈判：让步与施压';

(async () => {
  assert.throws(() => service.setExtractRunner(null), TypeError);
  await assert.rejects(service.generateLongArticleForUser(db, 'runner-test', theme), /not configured/);
  let calls = 0;
  service.setExtractRunner(async payload => {
    calls++;
    assert.equal(payload.userId, 'runner-test');
    assert.equal(payload.topic, theme);
    assert.equal(payload.duration, '1');
    assert.equal(payload.skipListenAudioSync, true);
    assert.match(payload.businessPackDate, /^\d{4}-\d{2}-\d{2}$/);
    await new Promise(resolve => setTimeout(resolve, 1));
    return { taskId: 'task-' + calls, status: 'completed' };
  });
  for (const genre of ['meeting', 'news', 'podcast', 'reading']) {
    for (const level of ['A2', 'B1', 'B2', 'C1']) {
      const result = await service.generateLongArticleForUser(db, 'runner-test', theme, 'cron', genre, level, '1');
      assert.equal(result.success, true);
      assert.ok(result.taskId);
    }
  }
  assert.equal(calls, 16);
  service.setExtractRunner(async () => ({ taskId: 'pending-task', status: 'pending' }));
  await assert.rejects(service.generateLongArticleForUser(db, 'runner-test', theme), /did not complete/);
  service.setExtractRunner(async () => { throw new Error('upstream unavailable'); });
  await assert.rejects(service.generateLongArticleForUser(db, 'runner-test', theme), /upstream unavailable/);

  // 实际共享入口：前台异步，后台必须等待完成；失败不得冒报成功。
  const entry = server.slice(server.indexOf('async function startDailyExtract('), server.indexOf('dailyPackService.setExtractRunner('));
  assert.ok(entry, 'shared extraction entry missing');
  const tasks = new Map();
  let completed = false;
  let fail = false;
  const quotaDb = { prepare: () => ({ get: () => ({ words_added: 0, phrases_added: 0 }) }) };
  const queue = { createTask: () => ({ id: 'shared-task' }), updateTask() {} };
  const context = vm.createContext({
    db: quotaDb, crypto: require('crypto'), console,
    WORD_DAILY_LIMIT: 10, PHRASE_DAILY_LIMIT: 10,
    dailyPackService: { getPackDate: service.getPackDate },
    extractionTasks: tasks, require: () => queue,
    runDailyExtractAsync: async id => {
      await new Promise(resolve => setTimeout(resolve, 5));
      completed = true;
      tasks.set(id, fail ? { status: 'failed', error: 'upstream failed' } : { status: 'completed' });
    },
  });
  vm.runInContext(entry, context);
  const payload = { topic: theme, materialText: theme, userId: 'runner-test' };
  const foreground = await context.startDailyExtract(payload);
  assert.ok(foreground.taskId);
  assert.equal(completed, false, 'foreground must remain asynchronous');
  await new Promise(resolve => setTimeout(resolve, 10));
  completed = false;
  const background = await context.startDailyExtract(payload, true);
  assert.equal(completed, true, 'background must await terminal status');
  assert.equal(background.status, 'completed');
  fail = true;
  await assert.rejects(context.startDailyExtract(payload, true), /upstream failed/);
  const empty = await context.startDailyExtract({});
  assert.equal(empty.words.length, 0);
  assert.equal(empty.taskId, undefined);

  const extract = server.slice(server.indexOf('async function runDailyExtractAsync'), server.indexOf("app.post('/api/read/material-cache'"));
  assert.match(extract, /const difyApiKey = process\.env\.DIFY_LONG_AUDIO_API_KEY \|\| process\.env\.DIFY_LISTEN_GEN_API_KEY;/, 'long articles must use the configured long-material app, not the vocabulary workflow');
  assert.match(server, /setExtractRunner\(\(payload\) => startDailyExtract\(payload, true\)\)/);
  assert.ok(!fs.readFileSync(path.join(__dirname, '../services/dailyPackService.js'), 'utf8').includes('127.0.0.1'));
  assert.match(unit, /^ProtectSystem=strict$/m);
  const paths = unit.match(/^ReadWritePaths=(.*)$/m)[1].split(' ');
  for (const directory of ['daily_long_articles', 'daily_listen_audio']) {
    assert.ok(paths.includes('/var/www/super-agent/vocab-server/public/' + directory));
  }
  assert.ok(!paths.includes('/var/www/super-agent'), 'no blanket writable application directory');
  console.log('PASS: 16 combinations, terminal wait, failure propagation, empty input, strict sandbox');
})().catch(error => { console.error(error); process.exit(1); });
