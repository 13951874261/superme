export const CAREER_STORAGE_KEY = 'superme_career';
export const CAREER_CHANGED_EVENT = 'superme-career-changed';

export type CareerPath = {
  history: string;
  current: string;
  target: string;
  progress: number;
};

export const DEFAULT_CAREER_PATH: CareerPath = {
  history: '高级经理 (Senior Manager)',
  current: '总监 (Director)',
  target: '合伙人 (Partner / Managing Director)',
  progress: 65,
};

export function clampCareerProgress(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CAREER_PATH.progress;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function parseCareerPath(raw: unknown): CareerPath {
  const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return {
    history: String(row.history || DEFAULT_CAREER_PATH.history),
    current: String(row.current || DEFAULT_CAREER_PATH.current),
    target: String(row.target || DEFAULT_CAREER_PATH.target),
    progress: Object.prototype.hasOwnProperty.call(row, 'progress')
      ? clampCareerProgress(row.progress)
      : DEFAULT_CAREER_PATH.progress,
  };
}

export function readCareerPath(): CareerPath {
  try {
    const saved = localStorage.getItem(CAREER_STORAGE_KEY);
    return saved ? parseCareerPath(JSON.parse(saved)) : { ...DEFAULT_CAREER_PATH };
  } catch {
    return { ...DEFAULT_CAREER_PATH };
  }
}

export function writeCareerPath(data: CareerPath): CareerPath {
  const next = parseCareerPath(data);
  localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CAREER_CHANGED_EVENT));
  return next;
}

export function careerNodeLabel(title: string): string {
  const text = String(title || '').trim();
  const shortName = text.split(' (')[0].trim();
  return shortName || text;
}
