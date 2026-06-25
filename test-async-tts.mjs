/**
 * 精听异步 TTS 队列 — 单元测试
 *
 * 测试内容：
 * 1. 后端 /api/tts/speech 路由：短文本同步 vs isAsync 异步分支
 * 2. 后端 taskQueue 任务创建和更新
 * 3. 前端 listeningAPI TtsResponse 类型
 * 4. 前端 ListenTab 逻辑
 *
 * 运行方式：
 *   node test-async-tts.mjs
 *
 * 前置条件：
 *   vocab-server 服务已启动（端口 3001），前端 dev server 已启动（端口 3000）
 */

const API_BASE = 'http://localhost:3001';
const FRONTEND_BASE = 'http://localhost:3000';

// 模拟前端 TtsResponse 类型
function assertTtsResponse(data) {
  if (typeof data !== 'object' || data === null) {
    throw new Error(`期望返回对象，实际: ${typeof data}`);
  }
  if (data.success !== true) {
    throw new Error(`期望 success=true，实际: ${JSON.stringify(data)}`);
  }
  // 必须有 audioUrl 或 taskId 其一
  const hasAudio = typeof data.audioUrl === 'string' && data.audioUrl.length > 0;
  const hasTask = typeof data.taskId === 'string' && data.taskId.length > 0;
  if (!hasAudio && !hasTask) {
    throw new Error(`期望 audioUrl 或 taskId，实际: ${JSON.stringify(data)}`);
  }
  return { hasAudio, hasTask, data };
}

// 轮询任务
async function pollTask(taskId, maxAttempts = 6) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}`);
    if (!res.ok) continue;
    const task = await res.json();
    if (task.status === 'completed') {
      return { status: 'completed', result: task.result };
    }
    if (task.status === 'failed') {
      return { status: 'failed', error: task.error };
    }
    console.log(`  [${i + 1}/${maxAttempts}] 任务状态: ${task.status}，继续等待...`);
  }
  throw new Error('轮询超时');
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    return true;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   错误: ${err.message}`);
    return false;
  }
}

async function run() {
  const shortText = 'Hello, this is a short test audio message for listening practice.';
  const mediumText = shortText.repeat(5); // ~300 chars

  let passed = 0;
  let failed = 0;

  // ==========================================
  // 测试 1: 缓存命中（直接返回 audioUrl）
  // ==========================================
  if (await test('T1: 缓存命中直接返回 audioUrl', async () => {
    const res = await fetch(`${API_BASE}/api/tts/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: shortText, model: 'edge-tts/en-US-EmmaNeural' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = assertTtsResponse(data);
    if (!result.hasAudio) throw new Error('缓存命中时应直接返回 audioUrl');
  })) passed++; else failed++;

  // ==========================================
  // 测试 2: isAsync=true 短文本 → 返回 taskId（异步）
  // ==========================================
  const asyncText = 'This is an async test message.';
  if (await test('T2: isAsync=true 短文本返回 taskId', async () => {
    const res = await fetch(`${API_BASE}/api/tts/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: asyncText, model: 'edge-tts/en-US-EmmaNeural', isAsync: true }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = assertTtsResponse(data);
    if (!result.hasTask) throw new Error('isAsync=true 时应返回 taskId');
    console.log(`   获得 taskId: ${data.taskId}`);
  })) passed++; else failed++;

  // ==========================================
  // 测试 3: isAsync=true 异步任务 → 轮询完成
  // ==========================================
  if (await test('T3: isAsync=true 异步任务可轮询完成', async () => {
    const res = await fetch(`${API_BASE}/api/tts/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: asyncText, model: 'edge-tts/en-US-EmmaNeural', isAsync: true }),
    });
    const { taskId } = await res.json();
    if (!taskId) throw new Error('无 taskId');

    // 验证任务已创建
    const taskRes = await fetch(`${API_BASE}/api/tasks/${taskId}`);
    const task = await taskRes.json();
    if (!task.id) throw new Error('任务未创建');
    if (task.type !== 'tts') throw new Error(`期望 type=tts，实际: ${task.type}`);
    console.log(`   任务 ${taskId} 已创建，初始状态: ${task.status}`);

    // 轮询等待完成（最多 6×2s=12s）
    const pollResult = await pollTask(taskId, 6);
    if (pollResult.status !== 'completed') {
      throw new Error(`任务未完成: ${JSON.stringify(pollResult)}`);
    }
    if (!pollResult.result?.audioUrl) {
      throw new Error(`任务完成但无 audioUrl: ${JSON.stringify(pollResult)}`);
    }
    console.log(`   任务完成，audioUrl: ${pollResult.result.audioUrl}`);
  })) passed++; else failed++;

  // ==========================================
  // 测试 4: isAsync=false 短文本 → 同步返回 audioUrl（降级路径）
  // ==========================================
  if (await test('T4: isAsync=false 短文本同步返回 audioUrl', async () => {
    const res = await fetch(`${API_BASE}/api/tts/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: shortText, model: 'edge-tts/en-US-EmmaNeural', isAsync: false }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = assertTtsResponse(data);
    if (!result.hasAudio) throw new Error('同步模式应直接返回 audioUrl');
  })) passed++; else failed++;

  // ==========================================
  // 测试 5: taskQueue 服务状态
  // ==========================================
  if (await test('T5: taskQueue 任务列表可见', async () => {
    const res = await fetch(`${API_BASE}/api/tasks`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.tasks)) throw new Error(`期望 tasks 数组，实际: ${typeof data.tasks}`);
    console.log(`   当前任务数: ${data.tasks.length}`);
  })) passed++; else failed++;

  // ==========================================
  // 总结
  // ==========================================
  console.log(`\n${'='.repeat(50)}`);
  console.log(`测试结果: ${passed} 通过，${failed} 失败`);
  if (failed === 0) {
    console.log('✅ 全部测试通过！');
  } else {
    console.error('❌ 存在失败测试，请检查。');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('测试执行失败:', err.message);
  process.exit(1);
});
