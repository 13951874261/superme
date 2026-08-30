import { getAppUserId } from '../utils/profileHelper';
import {
  getLearnItem,
  removeLearnItem,
  setLearnItem,
} from '../utils/accountStorage';

export type LearningUiState = {
  v: number;
  biweeklyReviewHistory: unknown[];
  lastReviewDate: number | null;
  nextWeekPush: unknown;
  difficultyAdjustment: Record<string, unknown>;
  pausedModules: string[];
  weeklyChatHistory: unknown[];
  oralWeaknessLog: unknown[];
  writeBenchmarkText: string;
  writeDailyFeedback: unknown;
};

const EMPTY: LearningUiState = {
  v: 1,
  biweeklyReviewHistory: [],
  lastReviewDate: null,
  nextWeekPush: null,
  difficultyAdjustment: {},
  pausedModules: [],
  weeklyChatHistory: [],
  oralWeaknessLog: [],
  writeBenchmarkText: '',
  writeDailyFeedback: null,
};

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 从当前账号本地桶采集 learning_ui 快照 */
export function collectLearningUiFromLocal(userId = getAppUserId()): LearningUiState {
  const lastRaw = getLearnItem(userId, 'superme_last_review_date');
  return {
    v: 1,
    biweeklyReviewHistory: parseJson(getLearnItem(userId, 'superme_biweekly_review_history'), []),
    lastReviewDate: lastRaw ? Number(lastRaw) : null,
    nextWeekPush: parseJson(getLearnItem(userId, 'superme_next_week_push'), null),
    difficultyAdjustment: parseJson(getLearnItem(userId, 'superme_difficulty_adjustment'), {}),
    pausedModules: parseJson(getLearnItem(userId, 'superme_paused_modules'), []),
    weeklyChatHistory: parseJson(getLearnItem(userId, 'superme_weekly_history_enhanced'), []),
    oralWeaknessLog: parseJson(getLearnItem(userId, 'user_weakness_log'), []),
    writeBenchmarkText: getLearnItem(userId, 'write_benchmark_text') || '',
    writeDailyFeedback: parseJson(getLearnItem(userId, 'write_daily_feedback'), null),
  };
}

/** 将 learning_ui 写入当前账号本地桶 */
export function applyLearningUiToLocal(userId: string, state: Partial<LearningUiState> | null | undefined): void {
  const s = { ...EMPTY, ...(state || {}) };
  setLearnItem(userId, 'superme_biweekly_review_history', JSON.stringify(s.biweeklyReviewHistory || []));
  if (s.lastReviewDate == null) {
    // 空账号不伪造 Date.now（U6）——删键表示未知
    removeLearnItem(userId, 'superme_last_review_date');
  } else {
    setLearnItem(userId, 'superme_last_review_date', String(s.lastReviewDate));
  }
  setLearnItem(userId, 'superme_next_week_push', JSON.stringify(s.nextWeekPush ?? null));
  setLearnItem(userId, 'superme_difficulty_adjustment', JSON.stringify(s.difficultyAdjustment || {}));
  setLearnItem(userId, 'superme_paused_modules', JSON.stringify(s.pausedModules || []));
  setLearnItem(userId, 'superme_weekly_history_enhanced', JSON.stringify(s.weeklyChatHistory || []));
  setLearnItem(userId, 'user_weakness_log', JSON.stringify(s.oralWeaknessLog || []));
  setLearnItem(userId, 'write_benchmark_text', s.writeBenchmarkText || '');
  setLearnItem(userId, 'write_daily_feedback', JSON.stringify(s.writeDailyFeedback ?? null));
}

export async function persistLearningUiToServer(
  userId = getAppUserId(),
  learningUi: LearningUiState = collectLearningUiFromLocal(userId),
): Promise<void> {
  const res = await fetch('/api/user/learning-ui', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, learningUi }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `learning-ui persist HTTP ${res.status}`);
  }
}

/**
 * 拉取 sidecar。服务端从未 persist（null）时不覆盖本地桶。
 * 有 JSON 则水合到该 userId 桶（含刻意空壳，用于换号恢复）。
 */
export async function loadLearningUiFromServer(userId = getAppUserId()): Promise<LearningUiState> {
  const res = await fetch(`/api/user/learning-ui/${encodeURIComponent(userId)}`);
  if (!res.ok) {
    return collectLearningUiFromLocal(userId);
  }
  const json = await res.json().catch(() => ({}));
  const data = json?.data?.learning_ui;
  if (data == null || typeof data !== 'object') {
    return collectLearningUiFromLocal(userId);
  }
  applyLearningUiToLocal(userId, data);
  return { ...EMPTY, ...data };
}

/** 换号前：把旧账号未保存学习态 flush 到 sidecar */
export async function flushLearningUi(userId = getAppUserId()): Promise<void> {
  try {
    await persistLearningUiToServer(userId, collectLearningUiFromLocal(userId));
  } catch (e) {
    console.warn('[learningUiAPI] flush failed:', e);
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** 复盘/夜话等本地写入后防抖上云，闭合车道 2 */
export function schedulePersistLearningUi(userId = getAppUserId()): void {
  if (typeof window === 'undefined') return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void flushLearningUi(userId);
  }, 400);
}
