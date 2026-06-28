import type { ParsedAiResponse } from '../../../services/difyAPI';

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
