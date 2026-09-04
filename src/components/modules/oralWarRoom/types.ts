import type { ParsedAiResponse } from '../../../services/difyAPI';
import type { SpeakingScene } from '../../../services/speakingScenesAPI';

export interface SceneRole {
  name: string;
  label: string;
  desc: string;
}

export interface SceneEntry {
  id: string;
  title: string;
  shortTitle: string;
  tier: '初阶' | '高阶' | '跨文化' | '定制';
  level: 4 | 5;
  desc: string;
  roleList: string;
  allies: SceneRole[];
  blockers: SceneRole[];
  neutrals: SceneRole[];
  conflicts: string[];
  culturalContext: string;
  openingLine: string;
  goal?: string;
  mission?: string[];
  source?: 'multi_role';
}

export function adaptMultiRoleScene(scene: SpeakingScene): SceneEntry {
  if (scene.sceneType !== 'multi_role') throw new Error('仅支持 multi_role 场景');
  const { content } = scene;
  const roleEntry = (role: typeof content.roles[number]) => ({ name: role.name, label: role.identity, desc: role.stance });
  return {
    id: `speaking-scene-${scene.id}`,
    title: content.title,
    shortTitle: content.title.slice(0, 24),
    tier: '定制',
    level: 5,
    desc: content.background,
    roleList: ['我', ...content.roles.map((role) => `${role.name}（${role.identity}）`)].join(' + '),
    allies: content.roles.filter((role) => role.roleType === 'ally').map(roleEntry),
    blockers: content.roles.filter((role) => role.roleType === 'blocker').map(roleEntry),
    neutrals: content.roles.filter((role) => role.roleType === 'neutral').map(roleEntry),
    conflicts: [content.conflict],
    culturalContext: content.background,
    openingLine: content.opening,
    goal: content.objective,
    mission: content.tasks,
    source: 'multi_role',
  };
}

export interface MessageItem {
  id: string;
  role: 'user' | 'ai';
  content: string;
  parsed?: ParsedAiResponse | null;
  feedback?: {
    logicScore: number;
    culturalScore: number;
    fluencyScore: number;
    overall: string;
  };
}

export type BreakthroughType = 'logic' | 'fact' | 'intent';

export interface BreakthroughRecord {
  id: string;
  text: string;
  type: BreakthroughType;
  correct: boolean;
  timestamp: number;
  messageId?: string;
}

export interface SessionMemory {
  weaknesses: string[];
  lastSceneId: string;
  oralCount: number;
  avgLogicScore: number;
  avgCulturalScore: number;
}

export interface RoleSwitcherRole {
  name: string;
  label: string;
  desc: string;
  avatarColor: string;
}

export interface LatestExchange {
  aiDialogue: string;
  aiSpeaker: string;
  roleAddress: string;
  userText: string;
  turnCount: number;
  jointPressure: string;
  hiddenIntent: string;
  branchSuggestions: string[];
  culturalSignal: string;
  speakerStyle: 'ally' | 'blocker' | 'neutral' | 'joint';
  isAllyAssist: boolean;
  stanceHistory: Array<{ speaker: string; address: string }>;
  isOpeningTurn: boolean;
}

export interface WeaknessLogEntry {
  scene: string;
  flaw: string;
  timestamp: number;
}
