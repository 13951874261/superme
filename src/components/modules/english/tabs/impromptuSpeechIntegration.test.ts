import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildFallbackImpromptuScene,
  buildImpromptuThemeContext,
  canApplySpeechGeneration,
  isFallbackImpromptuScene,
  selectInitialImpromptuScene,
} from './impromptuSpeechIntegration';
import type { SpeakingScene } from '../../../../services/speakingScenesAPI';

const scene: SpeakingScene = {
  id: 'scene-1', userId: 'alice', sceneDate: '2026-09-03', sceneType: 'impromptu',
  content: {
    topic: 'Defend a delayed launch', background: 'The release slipped by two weeks.',
    identity: 'Product lead', audience: 'Executive committee', objective: 'Keep funding approved',
    conflict: 'Quality and revenue deadlines conflict.', structure: ['Context', 'Decision'],
    points: ['Protect trust'], keywords: ['trade-off'], opening: 'I own the delay.',
  },
  contentHash: 'hash', profileHash: 'profile', useCount: 0, lastUsedAt: null, createdAt: 1, updatedAt: 1,
};

test('缓存即兴场景优先于 rebalance/theme fallback', () => {
  assert.equal(selectInitialImpromptuScene([scene])?.id, 'scene-1');
  assert.equal(selectInitialImpromptuScene([]), null);
});

test('fallback 场景稳定且具备完整可操作题卡字段', () => {
  const fallback = buildFallbackImpromptuScene('alice', 'Board update', '2026-09-03');
  const same = buildFallbackImpromptuScene('alice', 'Board update', '2026-09-03');
  assert.equal(fallback.id, same.id);
  assert.equal(fallback.sceneType, 'impromptu');
  assert.equal(fallback.content.topic, 'Board update');
  assert.ok(isFallbackImpromptuScene(fallback));
  for (const value of [fallback.content.background, fallback.content.identity, fallback.content.audience, fallback.content.objective, fallback.content.conflict, fallback.content.opening]) assert.ok(value.trim());
  for (const values of [fallback.content.structure, fallback.content.points, fallback.content.keywords]) assert.ok(values.length > 0);
  assert.equal(isFallbackImpromptuScene(scene), false);
});

test('prompter theme context 包含题目、背景、身份、听众、目标、冲突', () => {
  const context = buildImpromptuThemeContext(scene);
  for (const value of ['Defend a delayed launch', 'The release slipped by two weeks.', 'Product lead', 'Executive committee', 'Keep funding approved', 'Quality and revenue deadlines conflict.']) {
    assert.match(context, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('完整个性化场景每组件生命周期只记录一次使用', () => {
  const source = readFileSync(new URL('./ImpromptuSpeechTab.tsx', import.meta.url), 'utf8');
  assert.match(source, /recordSpeakingSceneUse/);
  assert.match(source, /recordedSpeakingSceneIdsRef = useRef\(new Set<string>\(\)\)/);
  assert.match(source, /recordedSpeakingSceneIdsRef\.current\.has\(scene\.id\)/);
  assert.match(source, /recordSpeakingSceneUse\(scene\.id, userId\)\.catch\(\(\) => \{\}\)/);
});

test('只有当前 generation token 可写入当前 scene', () => {
  assert.equal(canApplySpeechGeneration(4, 4, 'scene-1', 'scene-1'), true);
  assert.equal(canApplySpeechGeneration(3, 4, 'scene-1', 'scene-1'), false);
  assert.equal(canApplySpeechGeneration(4, 4, 'scene-0', 'scene-1'), false);
});
