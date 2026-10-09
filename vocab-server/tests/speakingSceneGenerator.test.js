const test = require('node:test');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const {
  createSpeakingSceneGenerator,
} = require('../services/personalizedSpeakingSceneService');

const validScene = {
  title: 'Quarterly roadmap negotiation',
  background: 'A product team must cut one planned initiative.',
  roles: [
    { name: 'Product lead', identity: 'Owns the roadmap', stance: 'Protect retention work', roleType: 'ally' },
    { name: 'Sales lead', identity: 'Owns enterprise revenue', stance: 'Protect a promised integration', roleType: 'blocker' },
  ],
  conflict: 'Only one initiative can remain.',
  objective: 'Reach a defensible agreement.',
  tasks: ['State priorities', 'Challenge one assumption'],
  opening: 'Thanks for joining. We need one decision today.',
};

function profileDb(profileText) {
  return {
    prepare(sql) {
      assert.match(sql, /FROM user_memories/);
      return {
        get(userId) {
          assert.equal(userId, 'u1');
          return { profile_content: profileText, memory_layers: '{}', error_ledger: '{}' };
        },
      };
    },
  };
}

function generator(overrides = {}) {
  return createSpeakingSceneGenerator({
    runWorkflow: async () => ({ data: { status: 'succeeded', outputs: { result: JSON.stringify([validScene]) } } }),
    timeoutMs: 50,
    logger: { info() {}, error() {} },
    ...overrides,
  });
}

const request = {
  db: profileDb('LATEST PRIVATE PROFILE'),
  userId: 'u1',
  sceneType: 'multi_role',
  count: 1,
  currentTheme: 'roadmap',
  cefrLevel: 'B2',
  trainingGoal: 'negotiate trade-offs',
  recentWeaknesses: ['hedging'],
  historyExclude: ['old title'],
};

test('生成器：使用 blocking workflow 请求契约，并由 DB 最新画像构造 user_current_profile', async () => {
  let captured;
  const generate = generator({
    runWorkflow: async (payload) => {
      captured = payload;
      return { data: { status: 'succeeded', outputs: { result: JSON.stringify([validScene]) } } };
    },
  });

  const scenes = await generate(request);

  assert.deepEqual(scenes, [validScene]);
  assert.equal(captured.signal instanceof AbortSignal, true);
  const { signal, ...contract } = captured;
  assert.deepEqual(contract, {
    inputs: {
      scene_type: 'multi_role',
      count: 1,
      current_theme: 'roadmap',
      cefr_level: 'B2',
      training_goal: 'negotiate trade-offs',
      recent_weaknesses: '["hedging"]',
      user_current_profile: 'LATEST PRIVATE PROFILE',
      history_exclude: '["old title"]',
    },
    userId: 'u1',
    responseMode: 'blocking',
  });
});

test('生成器：严格复用场景 validator 并接受对象形式 result', async () => {
  const generate = generator({
    runWorkflow: async () => ({ data: { status: 'succeeded', outputs: { result: [validScene] } } }),
  });
  assert.deepEqual(await generate(request), [validScene]);
});

test('生成器：多个场景拆成并发的单场景 workflow 请求', async () => {
  const calls = [];
  const generate = generator({
    runWorkflow: async (payload) => {
      calls.push(payload.inputs.count);
      const scene = { ...validScene, title: `Scene ${calls.length}` };
      return { data: { status: 'succeeded', outputs: { result: JSON.stringify([scene]) } } };
    },
  });

  const scenes = await generate({ ...request, count: 3 });

  assert.deepEqual(calls, [1, 1, 1]);
  assert.deepEqual(scenes.map((scene) => scene.title), ['Scene 1', 'Scene 2', 'Scene 3']);
});

test('生成器：空输出、无效 JSON、无效场景、数量不符均失败', async () => {
  const cases = [
    async () => ({ data: { status: 'succeeded', outputs: { result: '' } } }),
    async () => ({ data: { status: 'succeeded', outputs: { result: '{bad json' } } }),
    async () => ({ data: { status: 'succeeded', outputs: { result: JSON.stringify([{ ...validScene, roles: [] }]) } } }),
    async () => ({ data: { status: 'succeeded', outputs: { result: JSON.stringify([validScene, validScene]) } } }),
  ];

  for (const runWorkflow of cases) await assert.rejects(generator({ runWorkflow })(request));
});

test('生成器：超时通过 AbortController 取消 workflow', async () => {
  let capturedSignal;
  const generate = generator({
    timeoutMs: 10,
    runWorkflow: ({ signal }) => new Promise((resolve, reject) => {
      capturedSignal = signal;
      signal.addEventListener('abort', () => reject(Object.assign(new Error('raw private failure'), { statusCode: 499 })));
    }),
  });
  await assert.rejects(generate(request), /场景生成超时/);
  assert.equal(capturedSignal.aborted, true);
});

test('生成器：仅接受 succeeded workflow 状态，拒绝失败、停止及缺失状态', async () => {
  for (const status of ['failed', 'stopped', undefined]) {
    const data = { outputs: { result: JSON.stringify([validScene]) } };
    if (status) data.status = status;
    await assert.rejects(generator({ runWorkflow: async () => ({ data }) })(request), /workflow 状态/);
  }
  assert.deepEqual(await generator({
    runWorkflow: async () => ({ data: { status: 'succeeded', outputs: { result: JSON.stringify([validScene]) } } }),
  })(request), [validScene]);
});

test('生成器：日志仅记录画像元数据，错误日志仅记录固定分类和 status', async () => {
  const logs = [];
  const logger = {
    info(...args) { logs.push(args); },
    error(...args) { logs.push(args); },
  };
  await generator({ logger })(request);
  await assert.rejects(generator({
    logger,
    runWorkflow: async () => { throw Object.assign(new Error('LATEST PRIVATE PROFILE raw upstream message'), { statusCode: 503 }); },
  })(request));
  const serialized = JSON.stringify(logs);
  assert.doesNotMatch(serialized, /LATEST PRIVATE PROFILE/);
  assert.doesNotMatch(serialized, /raw upstream message/);
  assert.match(serialized, /profile_present/);
  assert.match(serialized, /profile_length/);
  assert.match(serialized, /profile_hash/);
  assert.match(serialized, /workflow_error/);
  assert.match(serialized, /503/);
});

test('生成器 YAML：使用可导入的 0.6 DSL，严格约束交由 Code 与 Node 双重校验', () => {
  const yaml = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../yml/Personalized_Speaking_Scene_Generator.yml'), 'utf8');
  assert.match(yaml, /^dependencies:\s*\n- current_identifier:/m);
  assert.match(yaml, /marketplace_plugin_unique_identifier:\s*langgenius\/openai_api_compatible:/);
  assert.match(yaml, /structured_output_enabled:\s*false/);
  assert.doesNotMatch(yaml, /\n\s+structured_output:\s*\n/);
  assert.match(yaml, /value_selector:\s*\n\s*- llm\s*\n\s*- text\s*\n\s*value_type: string/);
  assert.match(yaml, /value_selector:\s*\n\s*- code\s*\n\s*- result\s*\n\s*value_type: string/);
  assert.ok((yaml.match(/sourcePosition: right/g) || []).length >= 4);
  assert.ok((yaml.match(/targetPosition: left/g) || []).length >= 4);
  assert.match(yaml, /def main\(llm_text, scene_type, count\):/);
  assert.match(yaml, /scene_type.*multi_role.*impromptu/s);
  assert.match(yaml, /count.*len\(scenes\)/s);
  assert.match(yaml, /blocker/);
  assert.match(yaml, /multi_role.*title.*roles.*tasks/s);
  assert.match(yaml, /impromptu.*topic.*structure.*points.*keywords/s);
});

test('生成器 YAML Code：真实执行完整联合校验', (t) => {
  const yaml = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../yml/Personalized_Speaking_Scene_Generator.yml'), 'utf8');
  const code = /        code: \|\r?\n([\s\S]*?)\r?\n        code_language: python3/.exec(yaml)?.[1]
    .split(/\r?\n/).map((line) => line.slice(10)).join('\n');
  assert.ok(code);
  const python = process.platform === 'win32' ? 'C:\\Users\\lzhumy\\AppData\\Local\\Programs\\Python\\Python310\\python.exe' : 'python3';
  const valid = validScene;
  const cases = [
    { sceneType: 'multi_role', count: 1, scenes: [valid], ok: true },
    { sceneType: 'impromptu', count: 1, scenes: [valid], ok: false },
    { sceneType: 'multi_role', count: 2, scenes: [valid], ok: false },
    { sceneType: 'multi_role', count: 1, scenes: [{ ...valid, extra: 'x' }], ok: false },
    { sceneType: 'multi_role', count: 1, scenes: [{ ...valid, title: '<b>x</b>' }], ok: false },
    { sceneType: 'multi_role', count: 1, scenes: [{ ...valid, tasks: [`bad${String.fromCharCode(0)}`] }], ok: false },
    { sceneType: 'multi_role', count: 1, scenes: [{ ...valid, roles: valid.roles.map((role) => ({ ...role, roleType: 'ally' })) }], ok: false },
    { sceneType: 'multi_role', count: 1, scenes: [{ ...valid, extra: '界'.repeat(22000) }], ok: false },
  ];
  const harness = `${code}\nimport sys, json\np=json.loads(sys.stdin.read())\ntry:\n print(json.dumps(main(json.dumps(p['scenes'] if p.get('bare') else {'scenes': p['scenes']}, ensure_ascii=False), p['sceneType'], p['count']), ensure_ascii=False))\nexcept Exception as e:\n print(type(e).__name__ + ':' + str(e)); sys.exit(2)`;
  for (const item of [...cases, { sceneType: 'multi_role', count: 1, scenes: [valid], bare: true, ok: true }]) {
    const run = spawnSync(python, ['-c', harness], { input: JSON.stringify(item), encoding: 'utf8' });
    if (run.error?.code === 'ENOENT') return t.skip('Python 3 unavailable');
    assert.equal(run.status === 0, item.ok, run.stdout || run.stderr);
  }
});

test('生成器：默认配置只读取服务端专用 Key', () => {
  const source = require('node:fs').readFileSync(require.resolve('../services/personalizedSpeakingSceneService'), 'utf8');
  assert.match(source, /process\.env\.DIFY_SPEAKING_SCENES_API_KEY/);
  assert.doesNotMatch(source, /VITE_DIFY_SPEAKING_SCENES_API_KEY/);
  assert.doesNotMatch(source, /DIFY_SPEAKING_SCENES_API_KEY\s*\|\|\s*['"]app-/);
});
