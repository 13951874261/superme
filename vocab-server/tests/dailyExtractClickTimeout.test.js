const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../../node_modules/typescript');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup() {
  const code = fs.readFileSync('src/components/modules/english/tabs/DashboardTab.tsx', 'utf8');
  const start = code.indexOf('  const handleAutoGenerate = async');
  const end = code.indexOf('\n  const handleClearTodayAndReGenerate', start);
  const source = code.slice(start, end).replace(/await import\('\.\.\/\.\.\/\.\.\/\.\.\/services\/difyAPI'\)/g, 'api');
  const cache = deferred(), started = deferred(), completed = deferred();
  let now = 0;
  const timers = new Map();
  let nextId = 0;
  const state = { overlay: false, tasks: [], notices: [], polling: [] };
  const context = {
    api: {
      fetchExactArticleIfExists: () => cache.promise,
      startEnglishMasteryExtraction: () => started.promise,
      waitEnglishMasteryExtraction: () => completed.promise,
      DAILY_EXTRACT_RACE_MS: 3000,
      withDailyExtractTimeout: (promise, ms) => Promise.race([
        promise.then(result => ({ isTimeout: false, result })),
        new Promise(resolve => context.setTimeout(() => resolve({ isTimeout: true }), ms)),
      ]),
    },
    Date: { now: () => now },
    setTimeout: (fn, ms) => { const id = ++nextId; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout: id => timers.delete(id),
    setIsAutoGenerating: v => { state.overlay = v; },
    setIsBackgroundGenerating() {}, playScan() {}, playError() {}, playSuccess() {},
    showNotice: (...args) => state.notices.push(args),
    getAppUserId: () => 'test-user', genre: 'meeting', cefrLevel: 'C1', duration: '35', theme: 'test',
    addTask: task => state.tasks.push(task), startPolling: id => state.polling.push(id),
    notifyBackgroundHandoff() {}, setBriefingTab() {}, setGeneratedArticle() {}, setIsArticleExpanded() {},
    setExtractedWords() {}, setExtractedPhrases() {}, setExtractedSentences() {}, learnSet() {},
    setQuotaStatus() {}, setShowConfetti() {}, console: { error() {} },
  };
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022 });
  const run = vm.runInNewContext(js + '\nhandleAutoGenerate', context);
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  return { state, cache, started, completed, run, flush, async advance(ms) {
    now += ms;
    for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.fn(); }
    await flush();
  } };
}

test('缓存查询慢：点击三秒关闭遮罩，taskId 返回后才登记后台', async () => {
  const h = setup(); const running = h.run();
  await h.flush(); await h.advance(2999); assert.equal(h.state.overlay, true);
  await h.advance(1); assert.equal(h.state.overlay, false); assert.equal(h.state.tasks.length, 0);
  h.cache.resolve({ found: false }); await h.flush();
  h.started.resolve({ taskId: 'late-cache' }); await h.flush(); await h.advance(0);
  assert.equal(h.state.tasks[0]?.id, 'late-cache');
  h.completed.resolve({ article: 'done', words: ['loan'] }); await h.flush(); await running;
});

test('任务创建慢：三秒关闭遮罩，收到taskId立即交接', async () => {
  const h = setup(); const running = h.run();
  h.cache.resolve({ found: false }); await h.flush(); await h.advance(3000);
  assert.equal(h.state.overlay, false); assert.equal(h.state.tasks.length, 0);
  h.started.resolve({ taskId: 'late-start' }); await h.flush(); await h.advance(0);
  assert.equal(h.state.tasks[0]?.id, 'late-start');
  assert.deepEqual(h.state.polling, ['late-start']);
  h.completed.resolve({ article: 'done', words: ['loan'] }); await h.flush(); await running;
});

test('查询与创建耗时计入三秒，不重新计时', async () => {
  const h = setup(); const running = h.run();
  await h.advance(1500); h.cache.resolve({ found: false }); await h.flush();
  await h.advance(1000); h.started.resolve({ taskId: 'remaining' }); await h.flush();
  await h.advance(499); assert.equal(h.state.overlay, true);
  await h.advance(1); assert.equal(h.state.overlay, false);
  assert.equal(h.state.tasks[0]?.id, 'remaining');
  h.completed.resolve({ article: 'done', words: ['loan'] }); await h.flush(); await running;
});

test('三秒内完成：不登记后台，清理计时器', async () => {
  const h = setup(); const running = h.run();
  h.cache.resolve({ found: false }); h.started.resolve({ taskId: 'fast' });
  h.completed.resolve({ article: 'done', words: ['loan'] }); await h.flush(); await running;
  const notices = h.state.notices.length;
  await h.advance(3000);
  assert.equal(h.state.overlay, false); assert.equal(h.state.tasks.length, 0);
  assert.equal(h.state.notices.length, notices);
});

test('超时后启动失败：不创建虚假后台任务', async () => {
  const h = setup(); const running = h.run();
  h.cache.resolve({ found: false }); await h.flush(); await h.advance(3000);
  h.started.reject(new Error('network failure')); await h.flush(); await running;
  assert.equal(h.state.overlay, false); assert.equal(h.state.tasks.length, 0);
  assert.ok(h.state.notices.some(args => args[2] === 'error'));
});
