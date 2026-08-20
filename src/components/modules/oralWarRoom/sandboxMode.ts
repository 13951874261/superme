import type { SceneEntry } from './types';

export type SandboxMode = 'negotiation' | 'daily';

export const DAILY_SCENE_ID = 'scene-daily-1vs1';

export const DAILY_ROLE_SWITCH_INSTRUCTION =
  '1VS1 only. Do not track multiple negotiation roles. joint_pressure must be false. Keep existing sandbox JSON fields; set flaw_point to empty string.';

export const DAILY_LOOPHOLE_INSTRUCTION =
  '\n[系统隐性指令：当前为 daily 1VS1 日常演练。禁止植入谈判逻辑破绽。flaw_point 必须为空字符串。joint_pressure 必须为 false。仍输出完整沙盘 JSON。]';

export function resolveIntentJudgement(mode: SandboxMode): 'negotiation' | 'daily' {
  return mode === 'daily' ? 'daily' : 'negotiation';
}

export function shouldShowNegotiationControls(mode: SandboxMode): boolean {
  return mode === 'negotiation';
}

export function buildDailyScene(customBackground: string): SceneEntry {
  const bg = customBackground.trim();
  return {
    id: DAILY_SCENE_ID,
    title: bg ? `日常演练：${bg.slice(0, 24)}` : '日常演练：1VS1 闲聊',
    shortTitle: bg ? bg.slice(0, 24) : '1VS1 日常对话',
    tier: '定制',
    level: 4,
    desc: bg || '轻松环境下的一对一日常英语对话，聚焦生活场景与地道表达。',
    roleList: '我 + 对话搭档',
    allies: [],
    blockers: [{ name: '对话搭档', label: '搭档', desc: '用自然地道的日常英语回应' }],
    neutrals: [],
    conflicts: [bg ? '自定义日常场景' : '日常闲聊'],
    culturalContext: 'Casual everyday English. Avoid business jargon. Keep a natural 1VS1 register.',
    openingLine: "Hey, good to see you. What's been going on lately?",
  };
}

export function applyCustomBackground(
  scene: SceneEntry,
  customBackground: string,
  mode: SandboxMode,
): SceneEntry {
  const bg = customBackground.trim();
  if (!bg) return scene;
  if (mode === 'daily') return { ...buildDailyScene(bg), id: scene.id };
  return {
    ...scene,
    desc: bg,
  };
}

export function roleSwitchInstructionForMode(mode: SandboxMode, negotiationInstruction: string): string {
  return mode === 'daily' ? DAILY_ROLE_SWITCH_INSTRUCTION : negotiationInstruction;
}

export function loopholeInstructionForMode(mode: SandboxMode, negotiationInstruction: string): string {
  return mode === 'daily' ? DAILY_LOOPHOLE_INSTRUCTION : negotiationInstruction;
}

export function buildSandboxInputsPatch(
  mode: SandboxMode,
  customBackground?: string,
): { intent_judgement: 'negotiation' | 'daily'; custom_background?: string } {
  const bg = customBackground?.trim();
  return {
    intent_judgement: resolveIntentJudgement(mode),
    ...(bg ? { custom_background: bg } : {}),
  };
}
