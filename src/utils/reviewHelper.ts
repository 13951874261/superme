/**
 * 专属复盘与训练重组助手
 */
export interface BiweeklyReviewAnswers {
  practicalTest: string;
  goalAlignment: string;
  weaknessScan: string;
  tacticalDispatch: string;
}

export interface TrainingRebalancePlan {
  yuxinGameTheory?: string[];
  oralSandbox?: {
    scenario: string;
    roles: string;
    focus: string;
  };
  impromptuSpeech?: {
    topic: string;
    targetLevels: string[];
  };
}

const LAST_REVIEW_DATE_KEY = 'superme_last_review_date';
const REVIEW_HISTORY_KEY = 'superme_biweekly_review_history';
const NEXT_WEEK_PUSH_KEY = 'superme_next_week_push';

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

export function saveReviewToHistory(answers: BiweeklyReviewAnswers, factors: string) {
  const history = getReviewHistory();
  const newItem = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    answers,
    factors,
  };
  localStorage.setItem(REVIEW_HISTORY_KEY, JSON.stringify([newItem, ...history]));
}

export function getReviewHistory() {
  const raw = localStorage.getItem(REVIEW_HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveNextWeekPushPlan(plan: TrainingRebalancePlan) {
  localStorage.setItem(NEXT_WEEK_PUSH_KEY, JSON.stringify(plan));
  window.dispatchEvent(new CustomEvent('global-training-rebalance', { detail: plan }));
}

export function getNextWeekPushPlan(): TrainingRebalancePlan | null {
  const raw = localStorage.getItem(NEXT_WEEK_PUSH_KEY);
  return raw ? JSON.parse(raw) : null;
}
