import assert from 'node:assert/strict';
import test from 'node:test';
import { createBookExercise, evaluateBookExercise, getBookExercise, listBookExercises, pollBookExercise, transcribeBookExerciseAudio } from './bookExerciseAPI';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('两题型请求绑定 book/revision/node 且使用 cookie', async () => {
  const calls: Array<[string, RequestInit]> = [];
  globalThis.fetch = (async (url, init) => { calls.push([String(url), init || {}]); return json({ exercise: { id: 'e' } }, 201); }) as typeof fetch;
  await createBookExercise('b', 'fr', 'n', 'one_minute_retell'); await createBookExercise('b', 'fr', 'n', 'concept_explanation');
  assert.match(calls[0][0], /\/books\/b\/frameworks\/fr\/nodes\/n\/exercises$/); assert.equal(calls[0][1].credentials, 'include');
  assert.deepEqual(calls.map((call) => JSON.parse(String(call[1].body)).trainingMode), ['one_minute_retell', 'concept_explanation']);
});

test('录音上传不发送 userId并返回 raw/polished；评价明确选择修订文本', async () => {
  const calls: Array<[string, RequestInit]> = [];
  globalThis.fetch = (async (url, init) => { calls.push([String(url), init || {}]); return String(url).includes('transcriptions') ? json({ rawTranscript: 'raw', polishedTranscript: 'pretty' }) : json({ taskId: 't', status: 'running' }, 202); }) as typeof fetch;
  const transcript = await transcribeBookExerciseAudio('b', new Blob(['audio'], { type: 'audio/webm' })); assert.deepEqual(transcript, { rawTranscript: 'raw', polishedTranscript: 'pretty' });
  await evaluateBookExercise('b', 'fr', 'n', 'e', { taskId: 't', rawTranscript: 'raw', polishedTranscript: 'pretty', revisedTranscript: 'fixed', useRevisedTranscript: true, durationSeconds: 60, viewedEvidence: true });
  const payload = JSON.parse(String(calls[1][1].body)); assert.equal(payload.useRevisedTranscript, true); assert.equal('userId' in payload, false);
});

test('轮询遇 succeeded/failed/cancelled 终态立即停止', async () => {
  for (const status of ['succeeded', 'failed', 'cancelled'] as const) { let calls = 0; globalThis.fetch = (async () => { calls++; return json({ exercise: { id: 'e', status } }); }) as typeof fetch; const result = await pollBookExercise('b', 'fr', 'n', 'e', { intervalMs: 0 }); assert.equal(result.status, status); assert.equal(calls, 1); }
});

test('轮询支持 abort 与最大次数超时并停止请求', async () => {
  let calls = 0; globalThis.fetch = (async () => { calls++; return json({ exercise: { id: 'e', status: 'running' } }); }) as typeof fetch;
  const controller = new AbortController(); controller.abort(); await assert.rejects(() => pollBookExercise('b','fr','n','e',{intervalMs:0,signal:controller.signal}), (e: any) => e.name === 'AbortError'); assert.equal(calls, 0);
  await assert.rejects(() => pollBookExercise('b','fr','n','e',{intervalMs:0,maxAttempts:2,maxDurationMs:60_000}), (e: any) => e.errorCode === 'POLL_TIMEOUT'); assert.equal(calls, 2);
});

test('历史与精确练习恢复使用绑定版本 URL', async () => {
  const urls: string[] = []; globalThis.fetch = (async (url) => { urls.push(String(url)); return String(url).endsWith('/exercises') ? json({ exercises: [] }) : json({ exercise: { id: 'e', status: 'ready' } }); }) as typeof fetch;
  await getBookExercise('b', 'old-fr', 'old-n', 'e'); await listBookExercises('b');
  assert.match(urls[0], /old-fr\/nodes\/old-n\/exercises\/e$/); assert.match(urls[1], /\/books\/b\/exercises$/);
});
