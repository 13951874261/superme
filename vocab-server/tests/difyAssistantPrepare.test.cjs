const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/utils/difyChatbot.ts', 'utf8');
const start = source.includes('let assistantPrepareGeneration') ? source.indexOf('let assistantPrepareGeneration') : source.indexOf('export async function prepareDifyAssistantIframe');
const invalidate = source.slice(source.indexOf('export function invalidateMemoryPackCache'), source.indexOf('export function rotateEmbedSessionOnPageLoad'));
const region = invalidate + source.slice(start, source.indexOf('export function applyDifyChatbotConfig()'));
let account = 'account', memory = 'memory', override = '', cached = '';
const pending = [], writes = [];
const sandbox = {
  exports: {}, AbortController, setTimeout, clearTimeout,
  cachedMemoryPack: null, cachedIframeUrl: null, iframeUrlInflight: null,
  getDifyChatbotUserId: () => account,
  getDifyEmbedInputOverrides: () => ({ memory_pack: override }),
  getUserWeaknessProfile: () => memory,
  readCachedDifyIframeUrl: () => cached,
  writeCachedDifyIframeUrl: (user, url) => writes.push([user, url]),
  sessionStorage: { removeItem() {} }, DIFY_IFRAME_URL_CACHE_KEY: 'cache',
  buildMinimalIframeUrl: async (_, conversationId) => conversationId || 'new',
  fetch: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
};
vm.createContext(sandbox);
vm.runInContext(ts.transpileModule(region, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, sandbox);
const reply = (index, conversationId) => pending[index].resolve({ ok: true, json: async () => ({ conversationId, sessionUserId: account }) });
(async () => {
  const prepare = sandbox.exports.prepareDifyAssistantIframe;
  const a = prepare(), b = prepare();
  assert.equal(pending.length, 1, 'same account and memory must share one lookup');
  reply(0, 'latest');
  assert.deepEqual(await Promise.all([a, b]), ['latest', 'latest']);
  const c = prepare();
  assert.equal(pending.length, 2, 'a completed lookup must not cache later history requests');
  writes.length = 0;
  assert.equal(await prepare(true), 'new');
  reply(1, 'old'); await c;
  assert.equal(writes.length, 0, 'forceNew must prevent stale cache writes');

  account = 'alpha'; const alpha = prepare();
  account = 'beta'; const beta = prepare();
  assert.equal(pending.length, 4, 'different accounts must not share lookups');
  reply(2, 'alpha-history'); await alpha;
  const betaAgain = prepare();
  assert.equal(pending.length, 4, 'old completion must not clear the newer lookup');
  reply(3, 'beta-history'); await Promise.all([beta, betaAgain]);
  assert.deepEqual(writes, [['beta', 'beta-history']]);

  writes.length = 0;
  memory = 'before'; const before = prepare();
  memory = 'after'; const after = prepare();
  assert.equal(pending.length, 6, 'different memory must not share lookups');
  reply(5, 'after-history'); await after;
  reply(4, 'before-history'); await before;
  assert.deepEqual(writes, [['beta', 'after-history']]);

  override = 'fixed'; const fixed = prepare();
  memory = 'ignored'; const fixedAgain = prepare();
  assert.equal(pending.length, 7, 'explicit memory overrides must determine the lookup key');
  reply(6, 'fixed-history'); await Promise.all([fixed, fixedAgain]);

  writes.length = 0;
  const invalidated = prepare();
  sandbox.exports.invalidateMemoryPackCache();
  const renewed = prepare();
  assert.equal(pending.length, 9, 'invalidation must start a fresh lookup');
  reply(7, 'invalidated-history'); await invalidated;
  const renewedAgain = prepare();
  assert.equal(pending.length, 9, 'invalidated completion must preserve the renewed lookup');
  reply(8, 'renewed-history'); await Promise.all([renewed, renewedAgain]);
  assert.deepEqual(writes, [['beta', 'renewed-history']]);

  cached = 'fallback'; const failed = prepare();
  pending[9].reject(new Error('network unavailable'));
  assert.equal(await failed, 'fallback');
  const retry = prepare();
  assert.equal(pending.length, 11, 'failed lookups must allow retry');
  pending[10].resolve({ ok: false });
  assert.equal(await retry, 'fallback');
  const recovered = prepare(); reply(11, 'recovered');
  assert.equal(await recovered, 'recovered');
  console.log('difyAssistantPrepare.test.cjs passed: merge, latest history, forceNew, account isolation, memory change, override, invalidation, stale completion, retry');
})().catch(error => { console.error(error); process.exitCode = 1; });
