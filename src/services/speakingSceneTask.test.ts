import test from 'node:test';
import assert from 'node:assert/strict';
import { abortableDelay, resolveSpeakingSceneTask } from './speakingScenesAPI';
import type { SpeakingScene } from './speakingScenesAPI';

const scene = { id: 's', sceneType: 'impromptu' } as SpeakingScene;

test('共享任务 resolver 轮询至完整场景', async () => {
  let calls = 0;
  const result = await resolveSpeakingSceneTask('t', 'u', undefined, async () => (++calls === 1
    ? { id: 't', type: 'speaking_scene', status: 'running' }
    : { id: 't', type: 'speaking_scene', status: 'completed', result: { scene } }), async () => {});
  assert.equal(result, scene);
  assert.equal(calls, 2);
});

test('共享 delay 支持 AbortSignal', async () => {
  const controller = new AbortController();
  const pending = abortableDelay(60_000, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
