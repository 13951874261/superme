const assert = require('node:assert/strict');
const test = require('node:test');
const cache = require('../services/readMaterialCacheService');
const cronRuns = require('../services/dailyCronRunService');

function openDb() {
  try {
    const Database = require('better-sqlite3');
    return new Database(':memory:');
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(':memory:');
  }
}

test('全部 4×3 阅读组合持久化且精确匹配', async () => {
  const db = openDb();
  let calls = 0;
  const result = await cache.generateAllForUser(db, {
    userId: 'lmy', theme: '危机公关', packDate: '2026-09-12',
    generateFn: async ({ sceneType, sceneFramework }) => {
      calls += 1;
      return `${sceneType}-${sceneFramework}-${'内容'.repeat(800)}`;
    },
    evaluateFn: () => ({ quality: 'ok', charCount: 1600 }),
  });
  assert.equal(result.ready, 12);
  assert.equal(calls, 12);
  assert.equal(cache.get(db, { userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', sceneType: 'book', sceneFramework: 'corp' }).status, 'ready');
  assert.equal(cache.get(db, { userId: 'lmy', theme: '商务谈判', packDate: '2026-09-12', sceneType: 'book', sceneFramework: 'corp' }).status, 'missing');
  assert.equal(cache.get(db, { userId: 'other', theme: '危机公关', packDate: '2026-09-12', sceneType: 'book', sceneFramework: 'corp' }).status, 'missing');
});

test('夜间任务为指定活跃账号生成全部组合', async () => {
  const db = openDb();
  const result = await cache.runDailyCron(db, {
    users: [{ user_id: 'lmy', theme: '危机公关' }],
    generateFn: async ({ sceneType, sceneFramework }) => `${sceneType}-${sceneFramework}\n甲方某企业与乙方法务发生冲突。\n1. 预算100万元。\n2. 周期30天。\n3. 风险率20%。\n${'内容'.repeat(800)}`,
  });
  assert.equal(result.users, 1);
  assert.equal(result.results[0].ready, 12);
});

test('默认质量门禁拒绝只有长度没有细节和利益方的素材', async () => {
  const db = openDb();
  await cache.generateOne(db, {
    userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', sceneType: 'policy', sceneFramework: 'gov',
    generateFn: async () => '空泛内容'.repeat(500),
  });
  assert.equal(cache.get(db, { userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', sceneType: 'policy', sceneFramework: 'gov' }).status, 'failed');
});

test('全部组合使用有界并发且不超过配置上限', async () => {
  const db = openDb();
  let active = 0;
  let peak = 0;
  const result = await cache.generateAllForUser(db, {
    userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', concurrency: 2,
    generateFn: async ({ sceneType, sceneFramework }) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return `${sceneType}-${sceneFramework}\n甲方某企业与乙方法务发生冲突。\n1. 预算100万元。\n2. 周期30天。\n3. 风险率20%。\n${'内容'.repeat(800)}`;
    },
  });
  assert.equal(result.ready, 12);
  assert.equal(peak, 2);
});

test('夜间阅读任务按账号记录失败状态并保留缺失项供补跑', async () => {
  const db = openDb();
  cronRuns.initDailyCronRunTables(db);
  const tick = cronRuns.createCronTickId();
  const run = cronRuns.createPerUserRun(db, { cronTickId: tick, userId: 'lmy', packDate: '2026-09-12', triggerSource: 'cron', unitTotal: 12 });
  const result = await cache.runDailyCron(db, {
    cronTickId: tick,
    users: [{ user_id: 'lmy', theme: '危机公关' }],
    generateFn: async ({ sceneType }) => {
      if (sceneType === 'book') return '短';
      return `甲方某企业与乙方法务发生冲突。\n1. 预算100万元。\n2. 周期30天。\n3. 风险率20%。\n${'内容'.repeat(800)}`;
    },
  });
  assert.equal(result.results[0].failed, 3);
  const step = cronRuns.findStep(db, { runId: run.id, module: 'read_material' });
  assert.equal(step.status, 'failed');
  assert.match(step.error_message, /failed=3/);
  const aggregated = cronRuns.getRunByTickUser(db, tick, 'lmy');
  assert.equal(JSON.parse(aggregated.summary_json).unitTotal, 13);
});

test('白天缓存未命中时生成并回写，后续请求直接复用', async () => {
  const db = openDb();
  let calls = 0;
  const input = {
    userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', sceneType: 'policy', sceneFramework: 'gov',
    generateFn: async () => {
      calls += 1;
      return `甲方某企业与乙方法务发生冲突。\n1. 预算100万元。\n2. 周期30天。\n3. 风险率20%。\n${'内容'.repeat(800)}`;
    },
  };
  const first = await cache.getOrGenerate(db, input);
  const second = await cache.getOrGenerate(db, input);
  assert.equal(first.status, 'ready');
  assert.equal(second.status, 'ready');
  assert.equal(calls, 1);
});

test('同键并发未命中只生成一次', async () => {
  const db = openDb();
  let calls = 0;
  const input = {
    userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', sceneType: 'policy', sceneFramework: 'gov',
    generateFn: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return `甲方某企业与乙方法务发生冲突。\n1. 预算100万元。\n2. 周期30天。\n3. 风险率20%。\n${'内容'.repeat(800)}`;
    },
  };
  const [first, second] = await Promise.all([cache.getOrGenerate(db, input), cache.getOrGenerate(db, input)]);
  assert.equal(first.status, 'ready');
  assert.equal(second.status, 'ready');
  assert.equal(calls, 1);
});

test('不合格素材最多尝试三次并持久化失败', async () => {
  const db = openDb();
  let calls = 0;
  await cache.generateOne(db, {
    userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', sceneType: 'policy', sceneFramework: 'gov',
    generateFn: async () => { calls += 1; return '短'; },
    evaluateFn: () => ({ quality: 'below_standard', charCount: 1 }),
  });
  assert.equal(calls, 3);
  assert.equal(cache.get(db, { userId: 'lmy', theme: '危机公关', packDate: '2026-09-12', sceneType: 'policy', sceneFramework: 'gov' }).status, 'failed');
});


test('Dify 阅读请求为全部组合补齐系统时间且保留原输入', async (t) => {
  const oldKey = process.env.DIFY_ORAL_API_KEY;
  const oldBase = process.env.DIFY_API_BASE_URL;
  t.after(() => {
    if (oldKey === undefined) delete process.env.DIFY_ORAL_API_KEY;
    else process.env.DIFY_ORAL_API_KEY = oldKey;
    if (oldBase === undefined) delete process.env.DIFY_API_BASE_URL;
    else process.env.DIFY_API_BASE_URL = oldBase;
  });
  process.env.DIFY_ORAL_API_KEY = 'test-only-key';
  process.env.DIFY_API_BASE_URL = 'https://dify.example/v1';
  let calls = 0;
  const startedAt = Date.now();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls += 1;
    assert.equal(url, 'https://dify.example/v1/chat-messages');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer test-only-key');
    assert.ok(options.signal instanceof AbortSignal);
    const { inputs, user, response_mode, query } = JSON.parse(options.body);
    const { _system_time, _system_timestamp_ms, ...existingInputs } = inputs;
    assert.deepEqual(existingInputs, { theme: '商务谈判', genre: 'reading', cefr_level: 'B2', duration: '15' });
    assert.equal(user, 'contract-user');
    assert.equal(response_mode, 'blocking');
    assert.match(query, /不少于1500字/);
    assert.equal(typeof _system_time, 'string', '_system_time 必须注入');
    assert.ok(Number.isFinite(Date.parse(_system_time)), '系统时间必须可解析');
    assert.ok(Number.isInteger(_system_timestamp_ms), '毫秒时间戳必须为整数');
    assert.ok(_system_timestamp_ms >= startedAt && _system_timestamp_ms <= Date.now());
    assert.ok(Math.abs(Date.parse(_system_time) - _system_timestamp_ms) < 1000);
    return { ok: true, json: async () => ({ answer: '  仿真正文  ' }) };
  });
  for (const sceneType of cache.SCENE_TYPES) {
    for (const sceneFramework of cache.SCENE_FRAMEWORKS) {
      assert.equal(await cache.generateWithDify({ userId: 'contract-user', theme: '商务谈判', sceneType, sceneFramework }), '仿真正文');
    }
  }
  assert.equal(calls, 12);
});

test('Dify 返回口语场景 JSON 时仅提取真实正文', async (t) => {
  const oldKey = process.env.DIFY_ORAL_API_KEY;
  const oldBase = process.env.DIFY_API_BASE_URL;
  const oldTimeout = process.env.DIFY_READ_MATERIAL_TIMEOUT_MS;
  t.after(() => {
    if (oldKey === undefined) delete process.env.DIFY_ORAL_API_KEY;
    else process.env.DIFY_ORAL_API_KEY = oldKey;
    if (oldBase === undefined) delete process.env.DIFY_API_BASE_URL;
    else process.env.DIFY_API_BASE_URL = oldBase;
    if (oldTimeout === undefined) delete process.env.DIFY_READ_MATERIAL_TIMEOUT_MS;
    else process.env.DIFY_READ_MATERIAL_TIMEOUT_MS = oldTimeout;
  });
  process.env.DIFY_ORAL_API_KEY = 'test-only-key';
  process.env.DIFY_API_BASE_URL = 'https://dify.example/v1';
  delete process.env.DIFY_READ_MATERIAL_TIMEOUT_MS;

  const mockPayload = {
    scene: '体制内职场：宏观政策落实与地方涉企监管协调',
    current_speaker: '某局分管负责人',
    dialogue: 'Inspection dialogue...',
    hidden_intent: '中文：监管方背景说明。以下为虚构训练文件正文。\n\n某省某局关于统筹规范涉企检查的实施意见\n一、总体要求\n第1条 规范履职...',
    flaw_point: 'causal_fallacy'
  };

  t.mock.method(globalThis, 'fetch', async (url, options) => {
    return { ok: true, json: async () => ({ answer: JSON.stringify(mockPayload) }) };
  });

  const extracted = await cache.generateWithDify({
    userId: 'contract-user',
    theme: '商务谈判',
    sceneType: 'policy',
    sceneFramework: 'gov'
  });

  assert.match(extracted, /^某省某局关于统筹规范涉企检查/);
  assert.ok(!extracted.includes('"scene":'));
  assert.ok(!extracted.includes('Inspection dialogue'));
});


const validMaterial = '甲方某企业与乙方法务发生冲突。\n1. 预算100万元。\n2. 周期30天。\n3. 风险率20%。\n' + '内容'.repeat(800);
const materialKey = { userId: 'contract-user', theme: '商务谈判', packDate: '2026-10-05', sceneType: 'policy', sceneFramework: 'gov' };

test('正文解包覆盖 JSON 围栏、明确正文优先、普通文本保持不变', async (t) => {
  const cases = [
    [JSON.stringify({ hidden_intent: '中文：背景说明。以下为虚构训练文件正文。\n\n' + validMaterial }), validMaterial],
    ['\x60\x60\x60JSON\n' + JSON.stringify({ article: validMaterial }) + '\n\x60\x60\x60', validMaterial],
    [JSON.stringify({ hidden_intent: '短背景说明', body: validMaterial }), validMaterial],
    [JSON.stringify({ content: validMaterial }), validMaterial],
    [JSON.stringify({ text: validMaterial }), validMaterial],
    ['  ' + validMaterial + '  ', validMaterial],
  ];
  for (const [input, expected] of cases) {
    await t.test(input.slice(0, 45), async () => {
      const db = openDb();
      try {
        const result = await cache.generateOne(db, { ...materialKey, generateFn: async () => input });
        assert.equal(result.status, 'ready');
        assert.equal(result.body, expected);
        assert.equal(result.quality.charCount, expected.replace(/\s+/g, '').length);
        assert.equal(db.prepare('SELECT body_text FROM read_material_cache').get().body_text, expected);
      } finally { db.close(); }
    });
  }
});

test('JSON 元数据不计入正文质量，异常 JSON 与缺正文明确失败', async (t) => {
  const cases = [
    ['{"hidden_intent":', 'READ_MATERIAL_JSON_INVALID', 1],
    [JSON.stringify({ dialogue: 'Short dialogue', scene: 'gov' }), 'READ_MATERIAL_BODY_MISSING', 1],
    [JSON.stringify({ hidden_intent: {}, body: 7 }), 'READ_MATERIAL_BODY_MISSING', 1],
    [JSON.stringify({ hidden_intent: '短正文', dialogue: 'Short dialogue' }), 'READ_MATERIAL_QUALITY_FAILED', 3],
    ['[]', 'READ_MATERIAL_BODY_MISSING', 1],
  ];
  for (const [input, error, expectedCalls] of cases) {
    await t.test(error + input.slice(0, 20), async () => {
      const db = openDb(); let calls = 0;
      try {
        const result = await cache.generateOne(db, { ...materialKey, generateFn: async () => { calls += 1; return input; } });
        assert.equal(result.status, 'failed');
        assert.equal(result.error, error);
        assert.equal(result.body, null);
        assert.equal(calls, expectedCalls);
      } finally { db.close(); }
    });
  }
});

test('旧 JSON 缓存读时解包与重新计量，数据库原记录不变', () => {
  const db = openDb();
  try {
    cache.ensureTable(db);
    const insert = db.prepare('INSERT INTO read_material_cache (id,user_id,pack_date,theme,scene_type,scene_framework,body_text,status,quality_json,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    const raw = JSON.stringify({ hidden_intent: '中文：背景。以下为虚构训练文件正文。\n\n' + validMaterial, dialogue: 'metadata' });
    insert.run('legacy', materialKey.userId, materialKey.packDate, materialKey.theme, materialKey.sceneType, materialKey.sceneFramework, raw, 'ready', '{"quality":"ok","charCount":9999}', 'cron', 1, 1);
    const result = cache.get(db, materialKey);
    assert.equal(result.status, 'ready');
    assert.equal(result.body, validMaterial);
    assert.equal(result.quality.charCount, validMaterial.replace(/\s+/g, '').length);
    assert.equal(db.prepare('SELECT body_text FROM read_material_cache').get().body_text, raw);
    db.prepare('UPDATE read_material_cache SET body_text=?').run(JSON.stringify({ hidden_intent: '短', dialogue: 'Short dialogue' }));
    assert.equal(cache.get(db, materialKey).status, 'failed');
    assert.equal(cache.get(db, materialKey).body, null);
    db.prepare('UPDATE read_material_cache SET body_text=?').run('{"hidden_intent":');
    assert.equal(cache.get(db, materialKey).error, 'READ_MATERIAL_JSON_INVALID');
  } finally { db.close(); }
});

test('超时或短暂断连最多重试一次；持续失败落库；配置和鉴权错误不重试', async (t) => {
  for (const transientError of [new DOMException('aborted', 'AbortError'), new DOMException('timeout', 'TimeoutError'), new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } })]) {
    await t.test(transientError.name, async () => {
      const db = openDb(); let calls = 0;
      try {
        const result = await cache.generateOne(db, { ...materialKey, generateFn: async () => {
          calls += 1; if (calls === 1) throw transientError; return validMaterial;
        } });
        assert.equal(result.status, 'ready'); assert.equal(calls, 2);
        calls = 0;
        const failed = await cache.generateOne(db, { ...materialKey, generateFn: async () => { calls += 1; throw transientError; } });
        assert.equal(failed.status, 'failed'); assert.equal(calls, 2); assert.equal(failed.error, transientError.message);
      } finally { db.close(); }
    });
  }
  for (const error of ['DIFY_ORAL_API_KEY missing', 'Dify 401', 'READ_MATERIAL_JSON_INVALID']) {
    const db = openDb(); let calls = 0;
    try {
      const result = await cache.generateOne(db, { ...materialKey, generateFn: async () => { calls += 1; throw new Error(error); } });
      assert.equal(result.status, 'failed'); assert.equal(calls, 1); assert.equal(result.error, error);
    } finally { db.close(); }
  }
});

test('Dify 默认超时 300s，可配置；成功与失败均释放计时器', async (t) => {
  const oldKey = process.env.DIFY_ORAL_API_KEY;
  const oldTimeout = process.env.DIFY_READ_MATERIAL_TIMEOUT_MS;
  t.after(() => {
    if (oldKey === undefined) delete process.env.DIFY_ORAL_API_KEY; else process.env.DIFY_ORAL_API_KEY = oldKey;
    if (oldTimeout === undefined) delete process.env.DIFY_READ_MATERIAL_TIMEOUT_MS; else process.env.DIFY_READ_MATERIAL_TIMEOUT_MS = oldTimeout;
  });
  process.env.DIFY_ORAL_API_KEY = 'test-only-key';
  const delays = []; const cleared = []; const timer = {};
  t.mock.method(globalThis, 'setTimeout', (cb, ms) => { delays.push(ms); return timer; });
  t.mock.method(globalThis, 'clearTimeout', (id) => { cleared.push(id); });
  let fail = false;
  t.mock.method(globalThis, 'fetch', async () => {
    if (fail) throw new DOMException('aborted', 'AbortError');
    return { ok: true, json: async () => ({ answer: validMaterial }) };
  });
  delete process.env.DIFY_READ_MATERIAL_TIMEOUT_MS;
  assert.equal(await cache.generateWithDify(materialKey), validMaterial);
  process.env.DIFY_READ_MATERIAL_TIMEOUT_MS = '180000';
  assert.equal(await cache.generateWithDify(materialKey), validMaterial);
  fail = true;
  await assert.rejects(cache.generateWithDify(materialKey), { name: 'AbortError' });
  assert.deepEqual(delays, [300000, 180000, 180000]);
  assert.deepEqual(cleared, [timer, timer, timer]);
});


test('长邮件 dialogue 可作正文；明确正文与训练文件标记保持优先', async (t) => {
  const email = 'From: Legal\nTo: Board\nSubject: Negotiation dispute\n' + validMaterial;
  const cases = [
    [{ hidden_intent: '短中文意图说明', dialogue: email }, email],
    [{ dialogue: email }, email],
    [{ hidden_intent: '以下为虚构训练文件正文。\n' + validMaterial, dialogue: email.repeat(2) }, validMaterial],
    [{ body: validMaterial, dialogue: email.repeat(2) }, validMaterial],
    [{ hidden_intent: validMaterial, dialogue: 'Short dialogue' }, validMaterial],
  ];
  for (const [payload, expected] of cases) {
    await t.test(Object.keys(payload).join(','), async () => {
      const db = openDb();
      try {
        const result = await cache.generateOne(db, {
          ...materialKey, sceneType: 'email', generateFn: async () => JSON.stringify(payload),
        });
        assert.equal(result.status, 'ready');
        assert.equal(result.body, expected);
        assert.equal(result.quality.charCount, expected.replace(/\s+/g, '').length);
        assert.equal(db.prepare('SELECT body_text FROM read_material_cache').get().body_text, expected);
      } finally { db.close(); }
    });
  }
});
