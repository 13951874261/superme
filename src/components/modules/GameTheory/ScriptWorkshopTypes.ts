export interface ScriptCharacter {
  id: string;
  name: string;
  roleTitle: string;
  surfaceGoal: string; // 表层诉求
  hiddenMotive: string; // 隐秘底牌动机
  redLine: string; // 利益红线
  winCondition: string; // 妥协/胜利条件
}

export interface InfoAsymmetryItem {
  id: string;
  type: 'public' | 'exclusive' | 'misinformed' | 'fake_trap';
  title: string;
  content: string;
  owner?: string;
}

export interface ScriptPhaseData {
  phaseId: 1 | 2 | 3 | 4;
  title: string;
  targetDuration: string;
  targetWordsRange: string;
  targetRatio: number;
  content: string;
}

export interface BrokenLinkItem {
  phaseId: number;
  character?: string;
  quoteText: string;
  issueType: '无前置伏笔突兀反转' | '角色动机前后矛盾' | '利益让步缺少支撑' | '信息差利用不充分';
  description: string;
  suggestion: string;
}

export interface ScriptReviewReport {
  score: number; // 0-100
  passed: boolean;
  totalWords: number;
  estimatedMinutes: number;
  totalRounds: number;
  phaseDistribution: {
    phase1: { words: number; ratio: number };
    phase2: { words: number; ratio: number };
    phase3: { words: number; ratio: number };
    phase4: { words: number; ratio: number };
  };
  durationScore: {
    score: number; // max 30
    details: string[];
  };
  causalityScore: {
    score: number; // max 40
    details: string[];
    brokenLinks: BrokenLinkItem[];
  };
  strategyScore: {
    score: number; // max 30
    details: string[];
    highlights: string[];
  };
}

export interface ScriptWorkshopDraft {
  sceneTitle: string;
  sceneSummary: string;
  characters: ScriptCharacter[];
  infoMatrix: InfoAsymmetryItem[];
  phases: [ScriptPhaseData, ScriptPhaseData, ScriptPhaseData, ScriptPhaseData];
}
