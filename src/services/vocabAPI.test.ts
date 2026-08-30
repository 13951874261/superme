import assert from 'node:assert/strict';
import test from 'node:test';
import { getReviewPage, getVocabPage, getAllWords, getVocabByWord, lookupVocabWords, getMemoryAids, enrichMemory } from './vocabAPI';

const host = globalThis as typeof globalThis & { window: Window & typeof globalThis };
host.window = globalThis as unknown as Window & typeof globalThis;

const lsStore: Record<string, string> = { super_agent_user_id: 'test-user' };
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => lsStore[k] ?? null,
    setItem: (k: string, v: string) => { lsStore[k] = v; },
    removeItem: (k: string) => { delete lsStore[k]; },
  },
  configurable: true,
});

test('分页请求携带分区与 offset，避免不同分区重复首批数据', async () => {
  const urls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ items: [], hasMore: false }), { status: 200 });
  };

  try {
    await (getVocabPage as any)('general', 50, 100);
    await (getReviewPage as any)('business', 50, 100);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(urls[0], '/api/vocab/list?light=1&category=general&limit=100&offset=50&userId=test-user');
  assert.equal(urls[1], '/api/vocab/review?light=1&category=business&limit=50&offset=100&userId=test-user');
});

test('getAllWords 强制带 limit 分页且禁止全量裸请求', async () => {
  const urls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ items: [{ id: '1', word: 'test' }], hasMore: false }), { status: 200 });
  };

  try {
    const res1 = await getAllWords();
    const res2 = await getAllWords({ limit: 20 });
    assert.equal(res1.length, 1);
    assert.equal(res2.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(urls[0], '/api/vocab/list?light=1&limit=50&userId=test-user');
  assert.equal(urls[1], '/api/vocab/list?light=1&limit=20&userId=test-user');
});

test('getVocabByWord 按词点查构造单条轻量请求', async () => {
  const urls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ items: [{ id: '99', word: 'strategy' }], hasMore: false }), { status: 200 });
  };

  try {
    const res = await getVocabByWord('strategy');
    assert.equal(res?.word, 'strategy');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(urls[0], '/api/vocab/list?light=1&limit=1&word=strategy&userId=test-user');
});

test('lookupVocabWords 发起 POST /lookup 批量检索', async () => {
  const calls: { url: string; method?: string; body?: any }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify({ items: [{ id: '1', word: 'apple' }] }), { status: 200 });
  };

  try {
    const res = await lookupVocabWords(['apple', 'banana']);
    assert.equal(res.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls[0].url, '/api/vocab/lookup');
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(calls[0].body, { words: ['apple', 'banana'], userId: 'test-user' });
});

test('buildVocabPayloadFromDict 写入 {en,zh} 例句且不带 senses', async () => {
  const { buildVocabPayloadFromDict, vocabSyncFingerprint } = await import('./vocabAPI');
  const payload = buildVocabPayloadFromDict(
    {
      translation_main: '虫子',
      phonetic: '/bʌɡ/',
      pos: 'noun',
      senses: [{ definition_en: 'an insect', translation_zh: '昆虫', examples: [{ en: 'a bug', zh: '一只虫子' }] }],
      example_sentences: [{ en: 'There is a bug in the code.', zh: '代码里有个 bug。' }],
    },
    null,
    {
      word: 'bug',
      source: 'test',
      examplesOverride: [
        { en: 'edited en', zh: '编辑后的中文' },
        { en: 'second', zh: '' },
      ],
    }
  );

  assert.equal(payload.word, 'bug');
  assert.equal(payload.meaning, '虫子');
  assert.equal(payload.senses, undefined);
  assert.deepEqual(payload.examples, [
    { en: 'edited en', zh: '编辑后的中文' },
    { en: 'second', zh: '' },
  ]);
  assert.deepEqual(payload.example_sentences, payload.examples);

  const preserved = buildVocabPayloadFromDict(
    { translation_main: '虫子', synonyms: ['insect'] },
    { examples: [{ en: 'keep me', zh: '保留' }], meaning: '旧义' },
    { word: 'bug', preserveExamples: true }
  );
  assert.deepEqual(preserved.examples, [{ en: 'keep me', zh: '保留' }]);
  assert.ok(Array.isArray(preserved.synonyms));

  const fp1 = vocabSyncFingerprint(payload);
  const fp2 = vocabSyncFingerprint({ ...payload, examples: [{ en: 'changed', zh: '' }] });
  assert.notEqual(fp1, fp2);
});

test('buildDictDisplayPayloadFromVocab 将生词本字段映射为词典展示结构', async () => {
  const { buildDictDisplayPayloadFromVocab } = await import('./vocabAPI');
  const display = buildDictDisplayPayloadFromVocab('voila', {
    meaning: '瞧；好了',
    phonetic: '/vwaːˈlɑː/',
    partOfSpeech: 'interjection',
    examples: [{ en: 'The host said voila after the demonstration was complete enough to share.', zh: '演示完后主持人说瞧。' }],
    synonyms: ['behold'],
    antonyms: [],
    collocations: ['voila moment'],
  });
  assert.equal(display.headword, 'voila');
  assert.equal(display.translation_main, '瞧；好了');
  assert.equal(display.phonetic, '/vwaːˈlɑː/');
  assert.equal(display.pos, 'interjection');
  assert.equal(display.example_sentences.length, 1);
  assert.deepEqual(display.synonyms, ['behold']);
});

test('needsReviewPayloadHydrate：light 或空 payload 需补全；已有完整 payload 则否', async () => {
  const { needsReviewPayloadHydrate } = await import('./vocabAPI');
  assert.equal(needsReviewPayloadHydrate(null), false);
  assert.equal(needsReviewPayloadHydrate({ id: '1', word: 'a', _light: true, payload: {} } as any), true);
  assert.equal(needsReviewPayloadHydrate({ id: '1', word: 'a', payload: {} } as any), true);
  assert.equal(
    needsReviewPayloadHydrate({
      id: '1',
      word: 'voila',
      payload: { meaning: '瞧', phonetic: '/x/' },
    } as any),
    false,
  );
});

test('getMemoryAids 与 enrichMemory 必须携带 userId（query/body + x-user-id）', async () => {
  const store: Record<string, string> = { super_agent_user_id: 'test-user-memory' };
  const prev = (globalThis as any).localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    },
    configurable: true,
  });

  const calls: { url: string; headerUserId: string; body?: any }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const h = new Headers(init?.headers);
    calls.push({
      url: String(input),
      headerUserId: h.get('x-user-id') || '',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify({ root_memory: 'ok' }), { status: 200 });
  };

  try {
    await getMemoryAids('word-1');
    await enrichMemory('word-1');
    assert.equal(calls[0].headerUserId, 'test-user-memory');
    assert.match(calls[0].url, /[?&]userId=test-user-memory/);
    assert.equal(calls[1].headerUserId, 'test-user-memory');
    assert.equal(calls[1].body?.userId, 'test-user-memory');
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'localStorage', { value: prev, configurable: true });
  }
});
