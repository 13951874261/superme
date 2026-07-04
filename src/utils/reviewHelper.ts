/**
 * 自适应动态进化体系核心工具
 */
export interface BiweeklyReviewAnswer {
  practicalTest: string;
  goalAlignment: string;
  weaknessScan: string;
  tacticalDispatch: string;
}

/** @deprecated 兼容旧引用 */
export type BiweeklyReviewAnswers = BiweeklyReviewAnswer;

export interface TrainingRebalancePlan {
  yuxinGameTheory?: string[];
  oralSandbox?: {
    scenario: string;
    roles: string;
    focus: string;
    difficulty?: number;
  };
  impromptuSpeech?: {
    topic: string;
    targetLevels: string[];
    format?: string;
  };
  englishWriting?: {
    focus: string;
    genre: string;
  };
  listenModule?: {
    focus: string;
    materialType: string;
  };
  generalFocus?: string[];
}

export interface TrainingDifficultyAdjustment {
  oralSandbox?: number;
  gameTheory?: number;
  impromptuSpeech?: number;
  englishWriting?: number;
  listenModule?: number;
}

export interface BiweeklyReviewRecord {
  id: string;
  date: string;
  roundNumber: number;
  answers: BiweeklyReviewAnswer;
  extractedWeaknesses: string[];
  profileUpdateFactors: string;
  trainingAdjustment: {
    pauseModules: string[];
    intensifyModules: string[];
    newFocusAreas: string[];
    difficultyIncrease: TrainingDifficultyAdjustment;
  };
  /** 兼容旧历史条目 */
  factors?: string;
}

const BIWEEKLY_REVIEW_KEY = 'superme_biweekly_review_history';
const LAST_REVIEW_DATE_KEY = 'superme_last_review_date';
const NEXT_WEEK_PUSH_KEY = 'superme_next_week_push';
const DIFFICULTY_ADJUSTMENT_KEY = 'superme_difficulty_adjustment';
const PAUSED_MODULES_KEY = 'superme_paused_modules';

// ---- 复盘周期 ----

export function getLastReviewDate(): number {
  const saved = localStorage.getItem(LAST_REVIEW_DATE_KEY);
  if (!saved) {
    const now = Date.now();
    localStorage.setItem(LAST_REVIEW_DATE_KEY, String(now));
    return now;
  }
  return Number(saved);
}

export function setLastReviewDate(timestamp: number) {
  localStorage.setItem(LAST_REVIEW_DATE_KEY, String(timestamp));
  window.dispatchEvent(new Event('superme-review-date-changed'));
}

export function getReviewRoundNumber(): number {
  return getReviewHistory().length;
}

// ---- 复盘历史 ----

export function getReviewHistory(): BiweeklyReviewRecord[] {
  const raw = localStorage.getItem(BIWEEKLY_REVIEW_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveReviewRecord(record: BiweeklyReviewRecord) {
  const history = getReviewHistory();
  history.unshift(record);
  if (history.length > 20) history.pop();
  localStorage.setItem(BIWEEKLY_REVIEW_KEY, JSON.stringify(history));
}

/** 兼容旧 API */
export function saveReviewToHistory(answers: BiweeklyReviewAnswer, factors: string) {
  saveReviewRecord({
    id: Date.now().toString(),
    date: new Date().toISOString(),
    roundNumber: getReviewRoundNumber() + 1,
    answers,
    extractedWeaknesses: factors.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean),
    profileUpdateFactors: factors,
    trainingAdjustment: {
      pauseModules: [],
      intensifyModules: [],
      newFocusAreas: [],
      difficultyIncrease: {},
    },
    factors,
  });
}

// ---- 训练重组计划 ----

export function saveNextWeekPushPlan(plan: TrainingRebalancePlan) {
  localStorage.setItem(NEXT_WEEK_PUSH_KEY, JSON.stringify(plan));
  window.dispatchEvent(new CustomEvent('global-training-rebalance', { detail: plan }));
  window.dispatchEvent(new Event('dify-context-refresh-needed'));
}

export function getNextWeekPushPlan(): TrainingRebalancePlan | null {
  const raw = localStorage.getItem(NEXT_WEEK_PUSH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearNextWeekPushPlan() {
  localStorage.removeItem(NEXT_WEEK_PUSH_KEY);
}

export function mergeTrainingPlans(
  primary: TrainingRebalancePlan | Record<string, unknown> | null | undefined,
  secondary: TrainingRebalancePlan,
): TrainingRebalancePlan {
  const a = (primary || {}) as TrainingRebalancePlan;
  return {
    ...secondary,
    ...a,
    yuxinGameTheory: [...new Set([...(secondary.yuxinGameTheory || []), ...(a.yuxinGameTheory || [])])],
    generalFocus: [...new Set([...(secondary.generalFocus || []), ...(a.generalFocus || [])])],
    oralSandbox: a.oralSandbox?.scenario ? a.oralSandbox : secondary.oralSandbox || a.oralSandbox,
    impromptuSpeech: a.impromptuSpeech?.topic ? a.impromptuSpeech : secondary.impromptuSpeech || a.impromptuSpeech,
    englishWriting: a.englishWriting || secondary.englishWriting,
    listenModule: a.listenModule || secondary.listenModule,
  };
}

// ---- 难度调整 ----

export function applyDifficultyAdjustment(baseDifficulty: number, module: string): number {
  const raw = localStorage.getItem(DIFFICULTY_ADJUSTMENT_KEY);
  const adjustments: Record<string, number> = raw ? JSON.parse(raw) : {};
  const bonus = adjustments[module] || 0;
  return Math.min(Math.max(baseDifficulty + bonus, 1), 5);
}

export function recordDifficultyIncrease(module: string, increase: number) {
  if (!increase) return;
  const raw = localStorage.getItem(DIFFICULTY_ADJUSTMENT_KEY);
  const adjustments: Record<string, number> = raw ? JSON.parse(raw) : {};
  adjustments[module] = (adjustments[module] || 0) + increase;
  localStorage.setItem(DIFFICULTY_ADJUSTMENT_KEY, JSON.stringify(adjustments));
}

// ---- 模块暂停 ----

export function getPausedModules(): string[] {
  const raw = localStorage.getItem(PAUSED_MODULES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function setPausedModules(modules: string[]) {
  localStorage.setItem(PAUSED_MODULES_KEY, JSON.stringify(modules));
  window.dispatchEvent(new CustomEvent('global-modules-paused', { detail: modules }));
}

export function isModulePaused(moduleId: string): boolean {
  return getPausedModules().includes(moduleId);
}

// ---- 关键词提取 ----

const KEYWORD_SEEDS = [
  '财务', '风控', '晋升', '跳槽', '团队管理', '跨文化', '会议', '谈判',
  '高管', '博弈', '口语', '即兴', '邮件', '面试', '资源', '部门',
];

export function extractKeywordsFromText(text: string): string[] {
  const found = KEYWORD_SEEDS.filter((kw) => text.includes(kw));
  return [...new Set(found)];
}

// ---- 场景映射引擎（反哺核心） ----

const KEYWORD_THEME_MAP: Record<string, Partial<TrainingRebalancePlan>> = {
  财务: {
    yuxinGameTheory: ['上级制衡术', '分而治之', '预算博弈', '资源分配权争夺'],
    oralSandbox: {
      scenario: '信贷部负责人 vs 财务总监 vs 风控总监——三方资源争夺谈判',
      roles: '信贷部负责人(你), 财务总监(张总), 风控总监(李总), CEO(决策者)',
      focus: '跨部门资源争夺中的立场构建与利益交换',
      difficulty: 4,
    },
    impromptuSpeech: {
      topic: '同一预算方案，分别向CEO、财务总监、下属传达三种版本',
      targetLevels: ['上级(CEO)', '平级(财务总监)', '下属(信贷部)'],
      format: '同一内容，不同层级的称呼、分寸度与维度对比',
    },
    englishWriting: { focus: '跨部门邮件中的立场微妙平衡', genre: 'formal_inter_department_email' },
  },
  风控: {
    yuxinGameTheory: ['风险转嫁术', '合规盾牌', '责任边界切割'],
    oralSandbox: {
      scenario: '高风险项目审批——信贷推动 vs 风控否决的僵局',
      roles: '信贷部负责人(你), 风控总监(对手), 合规官(第三方)',
      focus: '在制度约束下的灵活破局',
      difficulty: 4,
    },
  },
  晋升: {
    yuxinGameTheory: ['向上管理', '预期管理', '政治资本积累'],
    impromptuSpeech: {
      topic: '晋升答辩——如何在3分钟内证明你已具备下一层级能力',
      targetLevels: ['评审委员会'],
      format: '高压环境下的结构化表达',
    },
    oralSandbox: {
      scenario: '晋升答辩模拟——高管评审委员会的多维度质询',
      roles: '你(候选人), 评审委员会A(技术派), 评审委员会B(关系派), 评审委员会C(结果派)',
      focus: '不同评审风格的差异化应对',
      difficulty: 5,
    },
  },
  跳槽: {
    yuxinGameTheory: ['面试博弈', '薪酬谈判', 'Offer选择权'],
    impromptuSpeech: {
      topic: '面试中的压力测试应对——如何在被质疑时保持主动权',
      targetLevels: ['HR', '业务负责人', 'CEO'],
      format: 'STAR法则即兴表达',
    },
    englishWriting: { focus: '英文求职信与LinkedIn个人品牌塑造', genre: 'job_application_package' },
  },
  团队管理: {
    yuxinGameTheory: ['权威构建', '激励与威慑', '分而治之'],
    oralSandbox: {
      scenario: '团队执行力危机——核心骨干消极怠工，如何重建权威',
      roles: '部门负责人(你), 消极骨干A, 积极骨干B, HRBP(调解者)',
      focus: '组织内部权力动态管理',
      difficulty: 4,
    },
  },
  跨文化: {
    yuxinGameTheory: ['跨文化权力信号识别', '文化资本转换'],
    englishWriting: { focus: '跨文化商务邮件中的隐含权力信号', genre: 'cross_cultural_email' },
    oralSandbox: {
      scenario: '向外籍CEO汇报——文化差异导致的误解与修正',
      roles: '部门负责人(你), 外籍CEO(直接上级), 本地VP(中间层)',
      focus: '跨文化语境下的信息传递保真',
      difficulty: 4,
    },
  },
  会议: {
    yuxinGameTheory: ['议程控制权', '会议中的隐性权力', '发言节奏掌控'],
    impromptuSpeech: {
      topic: '突发状况下的即兴发言——如何在会议上化解尴尬局面',
      targetLevels: ['参会全员'],
      format: '危机公关式即兴表达',
    },
  },
  谈判: {
    yuxinGameTheory: ['锚定效应', 'BATNA策略', '让步艺术'],
    oralSandbox: {
      scenario: '重大并购案谈判——多方利益博弈',
      roles: '你(收购方代表), 目标公司CEO, 投资方代表, 法律顾问',
      focus: '多轮谈判中的筹码管理与让步节奏',
      difficulty: 5,
    },
  },
  高管: {
    yuxinGameTheory: ['高管斗争案例', '派系平衡', '信息垄断'],
    oralSandbox: {
      scenario: '高管层利益纠葛——跨派系资源争夺会议',
      roles: '你(中层负责人), VP A, VP B, CEO',
      focus: '高层博弈中的站位与话术',
      difficulty: 5,
    },
  },
  博弈: {
    yuxinGameTheory: ['人性博弈', '筹码识别', '利益交换'],
  },
};

export const WEEKLY_CHAT_HISTORY_KEY = 'superme_weekly_history_enhanced';

export const GLOBAL_DIRECTION_OPTIONS = [
  { label: '人性博弈', value: 'humanGameCase' },
  { label: '英语主题', value: 'englishTopic' },
  { label: '高管斗争', value: 'executiveConflict' },
  { label: '驭人博弈', value: 'manipulationStrategy' },
  { label: '认知升维', value: 'cognitiveUpgrade' },
  { label: '晋升跳槽', value: 'careerAdvice' },
] as const;

const DIRECTION_LABELS: Record<string, string> = Object.fromEntries(
  GLOBAL_DIRECTION_OPTIONS.map((o) => [o.value, o.label]),
);

export interface WeeklyHistoryItem {
  id: string;
  date: string;
  userContent: string;
  aiAnalysis: string;
  directions: string[];
  nextWeekPreview: string;
}

export function getDirectionLabel(value: string): string {
  return DIRECTION_LABELS[value] || value;
}

export function getWeeklyChatHistory(): WeeklyHistoryItem[] {
  const raw = localStorage.getItem(WEEKLY_CHAT_HISTORY_KEY) || localStorage.getItem('super_agent_weekly_history');
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** 往 localStorage 中追加 WeeklyChat 历史足迹，并广播同步事件 */
export function appendWeeklyChatHistory(item: WeeklyHistoryItem) {
  const list = getWeeklyChatHistory();
  list.unshift(item);
  localStorage.setItem(WEEKLY_CHAT_HISTORY_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('superme-weekly-history-updated'));
}

export function generateScenarioMapping(
  keywords: string[],
  directions: string[],
  _analysis: string,
): TrainingRebalancePlan {
  const plan: TrainingRebalancePlan = {};
  const matchedThemes: Partial<TrainingRebalancePlan>[] = [];

  for (const kw of keywords) {
    for (const [key, theme] of Object.entries(KEYWORD_THEME_MAP)) {
      if (kw.includes(key) || key.includes(kw)) {
        matchedThemes.push(theme);
      }
    }
  }

  for (const theme of matchedThemes) {
    if (theme.yuxinGameTheory) {
      plan.yuxinGameTheory = [...(plan.yuxinGameTheory || []), ...theme.yuxinGameTheory];
    }
    if (theme.oralSandbox) plan.oralSandbox = theme.oralSandbox;
    if (theme.impromptuSpeech) plan.impromptuSpeech = theme.impromptuSpeech;
    if (theme.englishWriting) plan.englishWriting = theme.englishWriting;
    if (theme.listenModule) plan.listenModule = theme.listenModule;
  }

  if (plan.yuxinGameTheory) {
    plan.yuxinGameTheory = [...new Set(plan.yuxinGameTheory)];
  }

  if (matchedThemes.length > 0) {
    plan.generalFocus = [...new Set(matchedThemes.flatMap((t) => t.yuxinGameTheory || []))];
  } else if (directions.length > 0) {
    plan.generalFocus = directions.map((d) => DIRECTION_LABELS[d] || d).filter(Boolean);
  }

  return plan;
}

export function hasActiveRebalancePlan(): boolean {
  const plan = getNextWeekPushPlan();
  if (!plan) return false;
  return Boolean(
    plan.oralSandbox?.scenario
    || plan.yuxinGameTheory?.length
    || plan.impromptuSpeech?.topic
    || plan.generalFocus?.length,
  );
}

export function getRebalanceHintMessage(): string {
  const plan = getNextWeekPushPlan();
  if (!plan?.oralSandbox?.scenario && !plan?.generalFocus?.length) {
    return '已根据上周夜话投喂，为您重组了本场景训练参数。';
  }
  const focus = plan.generalFocus?.[0] || plan.oralSandbox?.focus || plan.oralSandbox?.scenario;
  return `已根据上周夜话投喂重组训练：${focus}`;
}
