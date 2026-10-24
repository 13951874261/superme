const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');
const ready = (word = 'negotiation') => ({
  success: true, status: 'ready', flawVocab: [{ word, ipa: '', meaning_zh: '谈判', pronunciation_note: '', example: 'Example.' }],
});
const generating = { success: true, status: 'generating', taskId: 'task-flaw' };
const missing = { success: true, status: 'missing' };
const flush = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function load(relative, imports, globals = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, require: (name) => {
      assert.ok(name in imports, '未声明的依赖: ' + name);
      return imports[name];
    }, Date, setTimeout, clearTimeout, AbortController, console, ...globals,
  }, { filename: relative });
  return exports;
}

function mount(t, route, options = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  let theme = '商务谈判';
  let userId = 'user-a';
  const requests = [], tasks = [], notices = [], states = [], refs = [], effects = [];
  let stateIndex = 0, refIndex = 0, effectIndex = 0, updates = 0;
  const api = load('src/services/dailyPackAPI.ts', {
    '../utils/profileHelper': { getAppUserId: () => userId, getInjectedUserCurrentProfile: () => 'profile' },
    './vocabAPI': { getAllWords: () => options.words || Promise.resolve([]) },
    '../utils/perfSlaTelemetry': { recordL1Response() {} },
  }, {
    window: { setTimeout, clearTimeout },
    fetch: (url, init) => {
      const body = JSON.parse(init.body);
      requests.push({ url, body, at: Date.now() });
      const result = route(url, body, requests);
      return Promise.race([
        Promise.resolve(result).then((data) => ({ ok: true, json: async () => data })),
        new Promise((_, reject) => init.signal.addEventListener('abort', () => {
          const error = new Error('aborted'); error.name = 'AbortError'; reject(error);
        }, { once: true })),
      ]);
    },
  });
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: (initial) => {
      const i = stateIndex++;
      if (!(i in states)) states[i] = initial;
      return [states[i], (next) => { updates++; states[i] = typeof next === 'function' ? next(states[i]) : next; }];
    },
    useRef: (initial) => refs[refIndex++] ||= { current: initial },
    useEffect: (effect, deps) => {
      const i = effectIndex++;
      if (!effects[i] || deps.some((dep, j) => dep !== effects[i].deps[j])) {
        effects[i]?.cleanup?.();
        effects[i] = { effect, deps, pending: true };
      }
    },
  };
  const component = load('src/components/modules/DailyErrorVocabularyModule.tsx', {
    react: { ...react, default: react },
    'lucide-react': Object.fromEntries(['BookOpen', 'RefreshCw', 'Loader2', 'AlertTriangle', 'CheckCircle2'].map((name) => [name, name])),
    '../../services/dailyPackAPI': api,
    '../../utils/profileHelper': { getAppUserId: () => userId },
    '../../hooks/useVocabCollect': { useVocabCollect: () => ({ hydrateFromEntries() {}, getCollectingZone() {}, getQueuedZone() {}, getStoredCategory() {} }) },
    '../../services/vocabAPI': { lookupVocabWords: async () => [] },
    '../Toast': { showToast() {} },
    '../SpeakButton': { default: 'SpeakButton' },
    './english/context/EnglishContext': { useEnglishContext: () => ({ theme }) },
    '../TaskContext': { useTask: () => ({ addTask: (task) => tasks.push(task) }) },
    '../../utils/backgroundHandoff': { notifyBackgroundHandoff: (notice) => notices.push(notice) },
    '../../utils/vocabZoneLabels': { VOCAB_ZONE_LABEL: {}, VOCAB_ZONE_COLLECT_BTN: {}, classifyCollectKind: () => 'word' },
  }, { window: { addEventListener() {}, removeEventListener() {} } }).default;
  const render = () => { stateIndex = refIndex = effectIndex = 0; return component(); };
  const runEffects = () => effects.forEach((effect) => {
    if (effect.pending) { effect.pending = false; effect.cleanup = effect.effect(); }
  });
  const flatten = (node) => {
    if (node == null || typeof node === 'boolean') return [];
    if (Array.isArray(node)) return node.flatMap(flatten);
    if (typeof node !== 'object') return [String(node)];
    return [node, ...node.children.flatMap(flatten)];
  };
  render(); runEffects();
  return {
    requests, tasks, notices,
    updates: () => updates,
    replayEffects: () => { effects.forEach((effect) => { effect.cleanup?.(); effect.pending = true; }); runEffects(); },
    text: () => flatten(render()).filter((item) => typeof item === 'string').join(' '),
    refresh: () => flatten(render()).find((item) => item?.type === 'button' && item.children.includes('刷新词汇')).props.onClick(),
    tick: async (ms) => { t.mock.timers.tick(ms); await flush(); },
    theme: (value) => { theme = value; render(); runEffects(); },
    user: (value) => { userId = value; },
    unmount: () => effects.forEach((effect) => effect.cleanup?.()),
  };
}

const regens = (app) => app.requests.filter((request) => request.url.endsWith('/regenerate'));

test('初次加载缓存命中，不生成', async (t) => {
  const app = mount(t, () => ready()); await flush();
  assert.match(app.text(), /negotiation/); assert.equal(regens(app).length, 0);
});

test('初次未命中，自动生成；3 秒进入后台，完成自动回填', async (t) => {
  let pack = missing;
  const app = mount(t, (url) => url.endsWith('/regenerate') ? (pack = generating) : pack);
  await flush(); assert.equal(regens(app).length, 1, '缺缓存应自动提交生成');
  await app.tick(2999); assert.doesNotMatch(app.text(), /正在后台生成/);
  await app.tick(1); assert.match(app.text(), /正在后台生成/);
  assert.equal(app.tasks[0].id, 'task-flaw'); assert.equal(app.notices.length, 1);
  pack = ready(); await app.tick(2000);
  assert.match(app.text(), /negotiation/); assert.doesNotMatch(app.text(), /正在后台生成/);
});

test('慢缓存最多等待 3 秒，自动提交后台生成', async (t) => {
  const cache = deferred(); let submitted = false;
  const app = mount(t, (url) => {
    if (url.endsWith('/regenerate')) { submitted = true; return generating; }
    return submitted ? ready() : cache.promise;
  });
  await flush(); await app.tick(3000);
  assert.equal(regens(app).length, 1); assert.equal(regens(app)[0].at, 3000);
  assert.doesNotMatch(app.text(), /请求超时/);
  cache.resolve(missing); await flush(); await app.tick(2000);
  assert.match(app.text(), /negotiation/);
});

test('刷新回执慢：总计 3 秒交接，不先等 8 秒；回执到达后登记任务', async (t) => {
  const ack = deferred(); let pack = ready('cached-word');
  const app = mount(t, (url) => url.endsWith('/regenerate') ? ack.promise : pack);
  await flush(); app.refresh(); await flush(); await app.tick(3000);
  assert.match(app.text(), /正在后台生成/); assert.equal(regens(app).length, 1);
  assert.match(app.text(), /cached-word/, '生成时保留旧词汇');
  pack = generating; ack.resolve(generating); await flush();
  assert.equal(app.tasks[0].id, 'task-flaw');
  pack = ready('fresh-word'); await app.tick(2000); assert.match(app.text(), /fresh-word/);
});

test('已在生成不重复提交；连续刷新也只保留一个任务', async (t) => {
  let pack = generating;
  const app = mount(t, () => pack); await flush();
  await app.tick(3000); app.refresh(); app.refresh(); await flush();
  assert.equal(regens(app).length, 0); assert.match(app.text(), /正在后台生成/);
  pack = ready(); await app.tick(2000); assert.match(app.text(), /negotiation/);
});

test('后台失败可见，允许重试', async (t) => {
  let pack = missing;
  const app = mount(t, (url) => url.endsWith('/regenerate') ? (pack = generating) : pack);
  await flush(); await app.tick(3000);
  pack = { success: false, status: 'failed', errorMessage: '生成服务不可用' };
  await app.tick(2000); assert.match(app.text(), /生成服务不可用/);
  assert.doesNotMatch(app.text(), /正在后台生成/);
  app.refresh(); await flush(); assert.equal(regens(app).length, 2);
});

test('回执 8 秒超时但后台已受理，恢复轮询而非展示请求超时', async (t) => {
  const ack = deferred(); let pack = ready();
  const app = mount(t, (url) => url.endsWith('/regenerate') ? ack.promise : pack);
  await flush(); app.refresh(); await flush(); await app.tick(3000);
  pack = generating; await app.tick(5000);
  assert.doesNotMatch(app.text(), /请求超时/); assert.equal(regens(app).length, 1);
  pack = ready('recovered'); await app.tick(2000); assert.match(app.text(), /recovered/);
});

test('主题切换后，旧后台结果不能覆盖新主题', async (t) => {
  let oldPack = missing;
  const app = mount(t, (url, body) => {
    if (body.theme === '新主题') return ready('new-theme-word');
    return url.endsWith('/regenerate') ? (oldPack = generating) : oldPack;
  });
  await flush(); await app.tick(3000); app.theme('新主题'); await flush();
  oldPack = ready('old-theme-word'); await app.tick(2000);
  assert.match(app.text(), /new-theme-word/); assert.doesNotMatch(app.text(), /old-theme-word/);
});

test('3 秒包含准备输入的时间，不是多个阶段各等 3 秒', async (t) => {
  const words = deferred(); let submitted = false;
  const app = mount(t, (url) => {
    if (url.endsWith('/regenerate')) { submitted = true; return generating; }
    return submitted ? generating : deferred().promise;
  }, { words: words.promise });
  await app.tick(500); await app.tick(2500);
  assert.equal(regens(app).length, 1); assert.equal(regens(app)[0].at, 3000);
  assert.match(app.text(), /正在后台生成/);
});


test('刷新前已被其他页面生成，只接续任务不重复提交', async (t) => {
  let pack = ready();
  const app = mount(t, (url) => url.endsWith('/regenerate') ? generating : pack);
  await flush(); pack = generating; app.refresh(); await flush();
  assert.equal(regens(app).length, 0);
  await app.tick(3000); assert.match(app.text(), /正在后台生成/);
});

test('后台轮询暂时超时后继续等待，不误报生成失败', async (t) => {
  let pack = missing, hang = false;
  const app = mount(t, (url) => {
    if (url.endsWith('/regenerate')) { hang = true; return generating; }
    return hang ? deferred().promise : pack;
  });
  await flush(); await app.tick(5000); await app.tick(200); await app.tick(5000);
  hang = false; pack = ready('poll-recovered'); await app.tick(2000);
  assert.match(app.text(), /poll-recovered/); assert.doesNotMatch(app.text(), /请求超时/);
});

test('鉴权失败不触发生成，不伪装后台成功', async (t) => {
  const app = mount(t, () => Promise.reject(new Error('HTTP 401'))); await flush();
  assert.equal(regens(app).length, 0); assert.match(app.text(), /HTTP 401/);
  assert.equal(app.notices.length, 0);
});


test('快速生成成功，无后台交接提示', async (t) => {
  let pack = missing;
  const app = mount(t, (url) => url.endsWith('/regenerate') ? (pack = ready('fast-word')) : pack);
  await flush(); assert.match(app.text(), /fast-word/);
  assert.equal(app.notices.length, 0); assert.equal(regens(app).length, 1);
});

test('回执超时且无缓存受理证据，显示失败而非假装成功', async (t) => {
  const ack = deferred();
  const app = mount(t, (url) => url.endsWith('/regenerate') ? ack.promise : missing);
  await flush(); await app.tick(3000); await app.tick(5000);
  assert.match(app.text(), /后台任务提交未确认/);
  assert.doesNotMatch(app.text(), /正在后台生成/); assert.equal(app.tasks.length, 0);
});

test('组件卸载后，后台结果不更新已卸载界面', async (t) => {
  let pack = missing;
  const app = mount(t, (url) => url.endsWith('/regenerate') ? (pack = generating) : pack);
  await flush(); await app.tick(3000); app.unmount();
  const updates = app.updates(); pack = ready(); await app.tick(2000);
  assert.equal(app.updates(), updates);
});

test('账号切换后，旧回执不写入新账号任务或词汇', async (t) => {
  const ack = deferred(); let pack = missing;
  const app = mount(t, (url) => url.endsWith('/regenerate') ? ack.promise : pack);
  await flush(); await app.tick(3000); app.user('user-b');
  pack = ready('old-user-word'); ack.resolve(generating); await flush();
  assert.equal(app.tasks.length, 0); assert.doesNotMatch(app.text(), /old-user-word/);
});

test('React StrictMode 重放 Effect，不重复提交', async (t) => {
  let pack = missing;
  const app = mount(t, (url) => url.endsWith('/regenerate') ? (pack = generating) : pack);
  app.replayEffects(); await flush(); assert.equal(regens(app).length, 1);
  await app.tick(3000); pack = ready(); await app.tick(2000);
  assert.match(app.text(), /negotiation/);
});
