import { getAppUserId } from '../utils/profileHelper';

export interface WakeupWord {
  word: string;
  ipa: string;
  pronunciation_note: string;
  meaning_zh: string;
  example: string;
}

export interface WakeupPayload {
  theme: string;
  vocab: WakeupWord[];
  grammar: {
    point: string;
    explanation: string;
    examples: Array<{ correct: string; incorrect: string }>;
  };
}

export interface FlawVocabWord extends WakeupWord {}

export interface DailyPackResponse {
  success: boolean;
  status: 'missing' | 'ready' | 'failed' | 'generating';
  packDate?: string;
  theme?: string;
  source?: string;
  errorMessage?: string | null;
  wakeup?: WakeupPayload | null;
  flawVocab?: FlawVocabWord[] | null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data as T;
}

export async function syncUserTheme(theme: string, userId = getAppUserId()) {
  return request<{ success: boolean; userId: string; theme: string }>('/api/user/theme', {
    method: 'PUT',
    body: JSON.stringify({ userId, theme }),
  });
}

export async function getTodayDailyPack(userId = getAppUserId()) {
  return request<DailyPackResponse>(`/api/daily-pack/today?userId=${encodeURIComponent(userId)}`);
}

export async function regenerateDailyPack(
  type: 'wakeup' | 'flaw' | 'both' = 'both',
  theme?: string,
  userId = getAppUserId(),
) {
  return request<DailyPackResponse>('/api/daily-pack/regenerate', {
    method: 'POST',
    body: JSON.stringify({ userId, type, theme }),
  });
}
