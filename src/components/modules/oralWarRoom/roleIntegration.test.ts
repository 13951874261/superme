import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptMultiRoleScene } from './types';
import { createSceneChangeIdleState } from './roleIntegration';
import { abortableDelay, resolveSpeakingSceneTask, type SpeakingScene } from '../../../services/speakingScenesAPI';

const scene: SpeakingScene = {
  id: 'server-scene-42', userId: 'alice', sceneDate: '2026-09-03', sceneType: 'multi_role',
  content: {
    title: 'Roadmap negotiation', background: 'Choose one initiative.',
    roles: [
      { name: 'Product lead', identity: 'Product owner', stance: 'Protect onboarding', roleType: 'ally' },
      { name: 'Sales lead', identity: 'Revenue owner', stance: 'Protect integrations', roleType: 'blocker' },
      { name: 'Finance lead', identity: 'Budget owner', stance: 'Require ROI proof', roleType: 'neutral' },
    ],
    conflict: 'Only one can ship.', objective: 'Reach agreement.', tasks: ['State priority', 'Trade concessions'], opening: 'Let us decide.',
  },
  contentHash: 'hash', profileHash: 'profile', useCount: 0, lastUsedAt: null, createdAt: 1, updatedAt: 1,
};

test('multi_role 场景适配为稳定动态 SceneEntry', () => {
  const actual = adaptMultiRoleScene(scene);
  assert.equal(actual.id, 'speaking-scene-server-scene-42');
  assert.equal(adaptMultiRoleScene(scene).id, actual.id);
  assert.equal(actual.title, 'Roadmap negotiation');
  assert.equal(actual.desc, 'Choose one initiative.');
  assert.equal(actual.goal, 'Reach agreement.');
  assert.deepEqual(actual.mission, ['State priority', 'Trade concessions']);
  assert.equal(actual.source, 'multi_role');
  assert.equal(actual.openingLine, 'Let us decide.');
  assert.deepEqual(actual.conflicts, ['Only one can ship.']);
  assert.equal(actual.allies[0].name, 'Product lead');
  assert.equal(actual.blockers[0].name, 'Sales lead');
  assert.equal(actual.neutrals[0].name, 'Finance lead');
});

test('适配器按 roleType 分类而非位置', () => {
  const shuffled = { ...scene, content: { ...scene.content, roles: [scene.content.roles[2], scene.content.roles[1], scene.content.roles[0]] } } as SpeakingScene;
  const actual = adaptMultiRoleScene(shuffled);
  assert.equal(actual.allies[0].name, 'Product lead');
  assert.equal(actual.blockers[0].name, 'Sales lead');
  assert.equal(actual.neutrals[0].name, 'Finance lead');
});

test('适配器拒绝非 multi_role 场景', () => {
  assert.throws(() => adaptMultiRoleScene({ ...scene, sceneType: 'impromptu' } as SpeakingScene), /multi_role/);
});

test('任务 resolver 轮询到完整 scene', async () => {
  let calls = 0;
  const result = await resolveSpeakingSceneTask('task-1', 'alice', undefined, async () => {
    calls += 1;
    return calls === 1
      ? { id: 'task-1', type: 'speaking_scene', status: 'running' }
      : { id: 'task-1', type: 'speaking_scene', status: 'completed', result: { scene } };
  }, async () => {});
  assert.equal(result.id, scene.id);
  assert.equal(calls, 2);
});

test('abortableDelay 被取消时立即拒绝 AbortError', async () => {
  const controller = new AbortController();
  const waiting = abortableDelay(60_000, controller.signal);
  controller.abort();
  await assert.rejects(waiting, { name: 'AbortError' });
});

test('inactive/cleanup 状态统一复位为空闲', () => {
  assert.deepEqual(createSceneChangeIdleState(), {
    isSceneChanging: false,
    sceneChangeStatus: '',
    sceneChangeError: '',
  });
});
