import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpeakingSceneSseParser,
  getSpeakingScenes,
  getSpeakingSceneTask,
  hasValidSceneContent,
  recordSpeakingSceneUse,
  regenerateSpeakingScene,
  switchSpeakingScene,
  validateSpeakingScene,
  validateSpeakingSceneTask,
  type SpeakingSceneSwitchEvent,
} from './speakingScenesAPI';

const multiRoleScene = {
  id: 'scene-2',
  userId: 'alice',
  sceneDate: '2026-09-03',
  sceneType: 'multi_role' as const,
  content: {
    title: 'Roadmap negotiation',
    background: 'Two leaders must choose one initiative.',
    roles: [
      { name: 'Product lead', identity: 'Owns retention', stance: 'Protect onboarding', roleType: 'ally' },
      { name: 'Sales lead', identity: 'Owns revenue', stance: 'Protect integrations', roleType: 'blocker' },
    ],
    conflict: 'Only one initiative can ship.',
    objective: 'Reach agreement.',
    tasks: ['State your priority'],
    opening: 'Let us decide today.',
  },
  contentHash: 'hash',
  profileHash: 'profile',
  useCount: 0,
  lastUsedAt: null,
  createdAt: 1,
  updatedAt: 1,
};

test('SSE parser：跨 chunk 拼接 scene 事件', () => {
  const events: SpeakingSceneSwitchEvent[] = [];
  const parser = createSpeakingSceneSseParser((event) => events.push(event));
  const payload = JSON.stringify({ scene: multiRoleScene });

  parser.push(`event: scene\ndata: ${payload.slice(0, 35)}`);
  assert.deepEqual(events, []);
  parser.push(`${payload.slice(35)}\n\n`);
  parser.finish();

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'scene');
  assert.equal(events[0].type === 'scene' && events[0].scene.id, 'scene-2');
});

test('SSE parser：ping 和空事件不算有效内容', () => {
  const events: SpeakingSceneSwitchEvent[] = [];
  const parser = createSpeakingSceneSseParser((event) => events.push(event));
  parser.push(': ping\n\nevent: ping\ndata: {}\n\ndata:   \n\n');
  parser.finish();
  assert.deepEqual(events, []);
});

test('SSE parser：解析 task miss 和 error 事件', () => {
  const events: SpeakingSceneSwitchEvent[] = [];
  const parser = createSpeakingSceneSseParser((event) => events.push(event));
  parser.push('event: task\ndata: {"taskId":"task-1","currentSceneId":"scene-1"}\n\n');
  parser.push('event: error\ndata: {"error":"生成失败"}\n\n');
  parser.finish();
  assert.deepEqual(events, [
    { type: 'task', taskId: 'task-1', currentSceneId: 'scene-1' },
    { type: 'error', error: '生成失败' },
  ]);
});

test('SSE parser：畸形业务数据产生 error，不误判 scene', () => {
  const events: SpeakingSceneSwitchEvent[] = [];
  const parser = createSpeakingSceneSseParser((event) => events.push(event));
  parser.push('event: scene\ndata: {bad json}\n\n');
  parser.finish();
  assert.equal(events[0].type, 'error');
});

test('有效内容判定：标题或主题等非空业务字段才有效', () => {
  assert.equal(hasValidSceneContent(multiRoleScene), true);
  assert.equal(hasValidSceneContent({ ...multiRoleScene, content: { ...multiRoleScene.content, title: '   ', background: '', conflict: '', objective: '', opening: '', roles: [], tasks: [] } }), false);
});

test('validateSpeakingScene：校验基础字段和两类全部字段', () => {
  assert.equal(validateSpeakingScene(multiRoleScene).id, 'scene-2');
  const impromptu = {
    ...multiRoleScene,
    sceneType: 'impromptu' as const,
    content: { topic: 'Topic', background: 'Background', identity: 'Lead', audience: 'Board', objective: 'Persuade', conflict: 'Risk', structure: ['Claim'], points: ['Evidence'], keywords: ['trade-off'], opening: 'Good morning.' },
  };
  assert.equal(validateSpeakingScene(impromptu).sceneType, 'impromptu');
  for (const malformed of [
    { ...multiRoleScene, id: '' },
    { ...multiRoleScene, useCount: '0' },
    { ...multiRoleScene, content: { ...multiRoleScene.content, roles: [{ name: 'A', identity: 'B' }] } },
    { ...impromptu, content: { ...impromptu.content, keywords: [1] } },
  ]) assert.throws(() => validateSpeakingScene(malformed));
});

const response = (body: unknown, init: ResponseInit = {}) => new Response(
  typeof body === 'string' ? body : JSON.stringify(body),
  { status: 200, headers: { 'content-type': 'application/json' }, ...init },
);

test('fetch 注入：GET/regenerate/task/use URL、method、body、query、signal', async () => {
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const controller = new AbortController();
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push([url, init]);
    const path = String(url);
    if (path.includes('/tasks/')) return response({ task: { id: 'task-1', type: 'speaking_scene', status: 'pending' } });
    if (path.endsWith('/regenerate')) return response({ taskId: 'task-1', status: 'pending' });
    if (path.endsWith('/use')) return response({ scene: multiRoleScene });
    return response({ scenes: [multiRoleScene] });
  };
  await getSpeakingScenes({ userId: 'a+b@example.com', sceneDate: '2026-09-03', sceneType: 'multi_role', signal: controller.signal, fetchImpl });
  await regenerateSpeakingScene({ userId: 'alice', sceneType: 'multi_role', currentSceneId: 'scene-1', signal: controller.signal, fetchImpl });
  await getSpeakingSceneTask('task/1', 'a+b@example.com', controller.signal, fetchImpl);
  await recordSpeakingSceneUse('scene/1', 'alice', controller.signal, fetchImpl);
  assert.match(String(calls[0][0]), /userId=a%2Bb%40example.com&sceneDate=2026-09-03&sceneType=multi_role/);
  assert.equal(calls[0][1]?.method, 'GET');
  assert.deepEqual(JSON.parse(String(calls[1][1]?.body)), { userId: 'alice', sceneType: 'multi_role', currentSceneId: 'scene-1' });
  assert.match(String(calls[2][0]), /tasks\/task%2F1\?userId=a%2Bb%40example.com/);
  assert.match(String(calls[3][0]), /scene%2F1\/use$/);
  assert.ok(calls.every((call) => call[1]?.signal === controller.signal));
});

test('validateSpeakingSceneTask：完整校验任务及 result.scene', () => {
  const valid = { id: 'task-1', type: 'speaking_scene', status: 'completed', progress: 100, error: 'warning', result: { scene: multiRoleScene } };
  assert.equal(validateSpeakingSceneTask(valid).result?.scene?.id, 'scene-2');
  assert.deepEqual(validateSpeakingSceneTask({ id: 'task-2', type: 'speaking_scene', status: 'running', progress: 10, error: null, result: null }), { id: 'task-2', type: 'speaking_scene', status: 'running', progress: 10 });
  for (const malformed of [
    { ...valid, id: '' },
    { ...valid, type: 'other' },
    { ...valid, status: 'unknown' },
    { ...valid, progress: '100' },
    { ...valid, error: 1 },
    { ...valid, result: [] },
    { ...valid, result: { scene: { ...multiRoleScene, id: '' } } },
  ]) assert.throws(() => validateSpeakingSceneTask(malformed), /任务|场景/);
});

test('任务查询和 regenerate 拒绝畸形任务与状态', async () => {
  await assert.rejects(getSpeakingSceneTask('task-1', 'alice', undefined, async () => response({ task: { id: 'task-1', type: 'other', status: 'pending' } })), /任务/);
  await assert.rejects(getSpeakingSceneTask('task-1', 'alice', undefined, async () => response({ task: { id: 'task-1', type: 'speaking_scene', status: 'completed', result: { scene: { ...multiRoleScene, id: '' } } } })), /场景/);
  await assert.rejects(regenerateSpeakingScene({ userId: 'alice', sceneType: 'multi_role', fetchImpl: async () => response({ taskId: 'task-1', status: 'unknown' }) }), /状态/);
});

test('GET/use 对所有 scene 结果运行校验', async () => {
  const bad = { ...multiRoleScene, content: { ...multiRoleScene.content, tasks: [1] } };
  await assert.rejects(getSpeakingScenes({ userId: 'alice', fetchImpl: async () => response({ scenes: [bad] }) }), /场景/);
  await assert.rejects(recordSpeakingSceneUse('scene-1', 'alice', undefined, async () => response({ scene: bad })), /场景/);
});

test('jsonRequest：安全处理字符串、数组、非 JSON 错误体', async () => {
  await assert.rejects(getSpeakingScenes({ userId: 'alice', fetchImpl: async () => response('denied', { status: 403 }) }), /denied/);
  await assert.rejects(getSpeakingScenes({ userId: 'alice', fetchImpl: async () => response([], { status: 200 }) }), /响应格式异常/);
  await assert.rejects(getSpeakingScenes({ userId: 'alice', fetchImpl: async () => new Response('<html>', { status: 500 }) }), /HTTP 500/);
});

test('switch：ping/空事件不算 first，scene 返回 elapsed', async () => {
  const stream = new ReadableStream<Uint8Array>({ start(controller) {
    const encoder = new TextEncoder();
    controller.enqueue(encoder.encode(': ping\n\nevent: ping\ndata: {}\n\ndata: \n\n'));
    controller.enqueue(encoder.encode(`event: scene\ndata: ${JSON.stringify({ scene: multiRoleScene })}\n\n`));
    controller.close();
  } });
  const result = await switchSpeakingScene({ userId: 'alice', sceneType: 'multi_role', fetchImpl: async () => new Response(stream) });
  assert.equal(result.type, 'scene');
  assert.ok(result.elapsedMs >= 0);
});

test('switch：task/error 可作为业务事件；无业务事件拒绝', async () => {
  const sse = (value: string) => async () => new Response(value, { headers: { 'content-type': 'text/event-stream' } });
  assert.equal((await switchSpeakingScene({ userId: 'alice', sceneType: 'multi_role', fetchImpl: sse('event: task\ndata: {"taskId":"t","currentSceneId":null}\n\n') })).type, 'task');
  assert.equal((await switchSpeakingScene({ userId: 'alice', sceneType: 'multi_role', fetchImpl: sse('event: error\ndata: {"error":"failed"}\n\n') })).type, 'error');
  await assert.rejects(switchSpeakingScene({ userId: 'alice', sceneType: 'multi_role', fetchImpl: sse(': ping\n\n') }), /未返回有效内容/);
});

test('switch：非 2xx 安全读取错误，null body 明确报错', async () => {
  await assert.rejects(switchSpeakingScene({ userId: 'alice', sceneType: 'multi_role', fetchImpl: async () => response({ error: '拒绝切换' }, { status: 400 }) }), /拒绝切换/);
  await assert.rejects(switchSpeakingScene({ userId: 'alice', sceneType: 'multi_role', fetchImpl: async () => ({ ok: true, status: 200, body: null }) as Response }), /响应流不可用/);
});

test('switch：流读取期间传递 AbortSignal 并传播 AbortError', async () => {
  const controller = new AbortController();
  let received: AbortSignal | null | undefined;
  const fetchImpl: typeof fetch = async (_url, init) => {
    received = init?.signal;
    return new Response(new ReadableStream({ start(streamController) {
      init?.signal?.addEventListener('abort', () => streamController.error(new DOMException('Aborted', 'AbortError')));
      queueMicrotask(() => controller.abort());
    } }));
  };
  await assert.rejects(switchSpeakingScene({ userId: 'alice', sceneType: 'multi_role', signal: controller.signal, fetchImpl }), { name: 'AbortError' });
  assert.equal(received, controller.signal);
});
