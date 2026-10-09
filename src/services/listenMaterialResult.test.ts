import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveListenMaterialText,
  pollTaskResultContent,
} from './listenMaterialResult';

test('字符串结果直接作为挑战正文', () => {
  assert.equal(
    resolveListenMaterialText('Write a memo to the CFO about the 80bp hike.'),
    'Write a memo to the CFO about the 80bp hike.',
  );
});

test('仅含 taskId 的对象不得当作可渲染正文', () => {
  assert.equal(resolveListenMaterialText({ taskId: 'abc-123' }), null);
});

test('script / answer 字段可提取为正文', () => {
  assert.equal(resolveListenMaterialText({ script: 'Task body' }), 'Task body');
  assert.equal(resolveListenMaterialText({ answer: 'Task body' }), 'Task body');
});

test('轮询任务完成后取出 result.content', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ success: true, status: 'pending' }), { status: 200 });
    }
    return new Response(
      JSON.stringify({
        success: true,
        status: 'completed',
        result: { content: 'Draft a reply that refuses the 80bp hike.' },
      }),
      { status: 200 },
    );
  };

  const text = await pollTaskResultContent('task-1', {
    fetchImpl,
    intervalMs: 0,
    maxAttempts: 5,
  });
  assert.equal(text, 'Draft a reply that refuses the 80bp hike.');
  assert.equal(calls, 2);
});

test('任务失败时抛出错误', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({ success: true, status: 'failed', error: 'Dify timeout' }),
      { status: 200 },
    );

  await assert.rejects(
    () => pollTaskResultContent('task-fail', { fetchImpl, intervalMs: 0, maxAttempts: 3 }),
    /Dify timeout/,
  );
});
