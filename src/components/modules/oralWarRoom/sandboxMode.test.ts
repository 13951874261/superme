import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCustomBackground,
  buildDailyScene,
  buildSandboxInputsPatch,
  DAILY_SCENE_ID,
  loopholeInstructionForMode,
  resolveIntentJudgement,
  roleSwitchInstructionForMode,
  shouldShowNegotiationControls,
} from './sandboxMode';
import type { SceneEntry } from './types';

const negotiationScene: SceneEntry = {
  id: 'scene-1',
  title: '高阶：国际银团贷款谈判',
  shortTitle: '国际银团贷款谈判',
  tier: '高阶',
  level: 4,
  desc: '利率与抵押物权属争议',
  roleList: '我(牵头行) + 参团行A + CFO',
  allies: [{ name: 'CEO', label: '盟友', desc: '推动落地' }],
  blockers: [{ name: 'CFO', label: '阻力', desc: '严控 IRR' }],
  neutrals: [],
  conflicts: ['利率上浮 0.5%'],
  culturalContext: '美系主导 Direct',
  openingLine: 'Gentlemen, let’s address the rate adjustment first.',
};

test('daily 模式 intent_judgement 为 daily，并关闭谈判控件', () => {
  assert.equal(resolveIntentJudgement('daily'), 'daily');
  assert.equal(resolveIntentJudgement('negotiation'), 'negotiation');
  assert.equal(shouldShowNegotiationControls('daily'), false);
  assert.equal(shouldShowNegotiationControls('negotiation'), true);
});

test('日常场景为 1VS1，并把自定义背景写入描述', () => {
  const scene = buildDailyScene('周末超市买菜闲聊');
  assert.equal(scene.id, DAILY_SCENE_ID);
  assert.equal(scene.roleList, '我 + 对话搭档');
  assert.equal(scene.allies.length, 0);
  assert.equal(scene.blockers.length, 1);
  assert.match(scene.desc, /周末超市买菜闲聊/);
});

test('custom_background 只在有内容时写入 Dify inputs', () => {
  assert.deepEqual(buildSandboxInputsPatch('daily', '  咖啡馆点单  '), {
    intent_judgement: 'daily',
    custom_background: '咖啡馆点单',
  });
  assert.deepEqual(buildSandboxInputsPatch('negotiation', '   '), {
    intent_judgement: 'negotiation',
  });
});

test('日常模式禁止破绽植入，并改用 1VS1 角色指令', () => {
  const planted = loopholeInstructionForMode('daily', '\n[系统隐性指令：植入破绽]');
  assert.equal(planted.includes('植入破绽'), false);
  assert.match(planted, /flaw_point/);
  assert.equal(roleSwitchInstructionForMode('daily', '多角色动态跟踪'), '1VS1 only. Do not track multiple negotiation roles. joint_pressure must be false. Keep existing sandbox JSON fields; set flaw_point to empty string.');
  assert.equal(roleSwitchInstructionForMode('negotiation', '多角色动态跟踪'), '多角色动态跟踪');
});

test('谈判模式自定义背景只补充描述，不改成 1VS1', () => {
  const next = applyCustomBackground(negotiationScene, '用户补充：对方坚持上浮 80bp', 'negotiation');
  assert.equal(next.id, 'scene-1');
  assert.equal(next.roleList, negotiationScene.roleList);
  assert.match(next.desc, /用户补充：对方坚持上浮 80bp/);
});
