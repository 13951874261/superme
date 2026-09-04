import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./SpeakingSceneBrief.tsx', import.meta.url), 'utf8');

test('SpeakingSceneBrief：包含两类全部字段与操作入口', () => {
  for (const token of ['title', 'background', 'roles', 'name', 'identity', 'stance', 'conflict', 'objective', 'tasks', 'opening', 'topic', 'audience', 'structure', 'points', 'keywords', '换一题', '重新生成']) {
    assert.match(source, new RegExp(token));
  }
});

test('SpeakingSceneBrief：具备忙碌、状态和错误可访问性契约', () => {
  assert.match(source, /aria-busy=/);
  assert.match(source, /disabled=\{busy\}/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /role="alert"/);
  assert.match(source, /switching \? '换题中' : '换一题'/);
  assert.match(source, /regenerating \? '生成中' : '重新生成'/);
  assert.match(source, /LoaderCircle[^>]+aria-hidden="true"/);
  assert.doesNotMatch(source, /aria-live="assertive"/);
});

test('SpeakingSceneBrief：紧凑摘要默认展示，完整内容可访问展开', () => {
  assert.match(source, /useState\(false\)/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /aria-controls=\{`speaking-scene-details-/);
  assert.match(source, /hidden=\{!expanded\}/);
  assert.match(source, /背景：/);
  assert.match(source, /目标：/);
});
