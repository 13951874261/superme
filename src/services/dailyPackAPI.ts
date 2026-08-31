import { getAppUserId, getInjectedUserCurrentProfile } from '../utils/profileHelper';
import { getAllWords, type VocabEntry } from './vocabAPI';
import { recordL1Response } from '../utils/perfSlaTelemetry';

export interface WakeupWord {
  word: string;
  ipa: string;
  pronunciation_note: string;
  meaning_zh: string;
  example: string;
  slot?: 'theme' | 'theory';
}

export interface WakeupPayload {
  theme: string;
  _dedupeNotice?: string | null;
  vocab: WakeupWord[];
  grammar: {
    point: string;
    explanation: string;
    examples: Array<{ correct: string; incorrect: string }>;
  };
}

export interface FlawVocabWord extends WakeupWord {}

export interface DailyPackQueryInput {
  theme: string;
  historyExclude: string;
  userCurrentProfile: string;
}

export interface DailyPackResponse {
  success: boolean;
  status: 'missing' | 'ready' | 'failed' | 'generating';
  packDate?: string;
  theme?: string;
  currentTheme?: string;
  stale?: boolean;
  source?: string;
  errorMessage?: string | null;
  wakeup?: WakeupPayload | null;
  flawVocab?: FlawVocabWord[] | null;
  taskId?: string;
}

/** 禁止把 Node/浏览器网络原文展示给用户 */
export function friendlyDailyPackError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw ?? '').trim();
  if (/唤醒服务暂时连不上/.test(msg)) return msg;
  if (/fetch failed|Failed to fetch|NetworkError|Load failed|ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(msg)) {
    return '唤醒服务暂时连不上，请稍后点「立即生成」重试';
  }
  return msg;
}

/** 缓存未命中后前台最多等 3 秒，超时转入任务中心 */
export const DAILY_PACK_RACE_MS = 3000;

export async function withDailyPackRace<T>(
  actionPromise: Promise<T>,
  timeoutMs: number = DAILY_PACK_RACE_MS,
): Promise<{ isTimeout: false; result: T } | { isTimeout: true }> {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) => {
    timerId = setTimeout(() => resolve({ isTimeout: true }), timeoutMs);
  });
  try {
    return await Promise.race([
      actionPromise.then((result) => ({ isTimeout: false as const, result })),
      timeoutPromise,
    ]);
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}

async function request<T>(path: string, options?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = 30_000, ...init } = options || {};
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      ...init,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    return data as T;
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError' || controller.signal.aborted) {
      throw new Error(`请求超时（>${Math.round(timeoutMs / 1000)}s）`);
    }
    throw new Error(friendlyDailyPackError(err));
  } finally {
    window.clearTimeout(timer);
  }
}

function normalizeDailyPackInput(input?: Partial<DailyPackQueryInput>): DailyPackQueryInput {
  return {
    theme: String(input?.theme || '').trim(),
    historyExclude: String(input?.historyExclude || '').trim(),
    userCurrentProfile: String(input?.userCurrentProfile || '').trim(),
  };
}

function buildTodayInflightKey(userId: string, input: DailyPackQueryInput) {
  return JSON.stringify({ userId, ...input });
}

export async function buildDailyPackQueryInput(theme: string): Promise<DailyPackQueryInput> {
  // 设置 500ms 极速超时，防止生词库网络波动/卡死导致首页唤醒包无法呈现
  // I6：userId 缺失的 400 不当成「词表为空」；超时/网络仍回退空 exclude（非隔离路径软降级）
  const wordsPromise = getAllWords({ limit: 50 }).catch((err: unknown) => {
    const msg = String((err as Error)?.message || err || '');
    if (/userId required|HTTP 400/i.test(msg)) {
      console.warn('[dailyPackAPI] vocab request rejected (not empty list):', msg);
    }
    return [] as VocabEntry[];
  });
  const timeoutPromise = new Promise<VocabEntry[]>((r) => setTimeout(() => r([]), 500));
  const words = await Promise.race([wordsPromise, timeoutPromise]);

  const historyExclude = words
    .slice()
    .sort((a, b) => Number(b?.added_at || 0) - Number(a?.added_at || 0))
    .map((item) => String(item?.word || '').trim())
    .filter(Boolean)
    .slice(0, 50)
    .join(', ');

  return {
    theme: String(theme || '').trim(),
    historyExclude,
    userCurrentProfile: getInjectedUserCurrentProfile({ theme: String(theme || '').trim() }),
  };
}

export async function fetchUserTheme(userId = getAppUserId()) {
  const data = await request<{ success: boolean; userId: string; theme: string }>(
    `/api/user/theme?userId=${encodeURIComponent(userId)}`,
    { timeoutMs: 20_000 },
  );
  return String(data?.theme || '').trim();
}

export async function syncUserTheme(theme: string, userId = getAppUserId()) {
  return request<{ success: boolean; userId: string; theme: string }>('/api/user/theme', {
    method: 'PUT',
    body: JSON.stringify({ userId, theme }),
    timeoutMs: 20_000,
  });
}

/** 合并同一稳定输入快照的并发 today 请求，避免进站双模块各打一次占满连接 */
const todayInflight = new Map<string, Promise<DailyPackResponse>>();

export async function getTodayDailyPack(input?: Partial<DailyPackQueryInput>, userId = getAppUserId()) {
  const uid = userId || 'default-user';
  const normalizedInput = normalizeDailyPackInput(input);
  const inflightKey = buildTodayInflightKey(uid, normalizedInput);
  const existing = todayInflight.get(inflightKey);
  if (existing) return existing;

  const job = (async () => {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const result = await request<DailyPackResponse>('/api/daily-pack/today', {
          method: 'POST',
          body: JSON.stringify({
            userId: uid,
            theme: normalizedInput.theme,
            historyExclude: normalizedInput.historyExclude,
            userCurrentProfile: normalizedInput.userCurrentProfile,
          }),
          timeoutMs: 5_000,
        });
        const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
        recordL1Response('POST /api/daily-pack/today (Cache Read)', durationMs, true);
        return result;
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : '';
        if (!msg.includes('请求超时') || attempt === 2) break;
        await new Promise((r) => setTimeout(r, 200 * attempt));
      }
    }
    const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    recordL1Response('POST /api/daily-pack/today (Cache Read)', durationMs, false);
    throw lastErr instanceof Error ? lastErr : new Error('读取今日包失败');
  })();

  todayInflight.set(inflightKey, job);
  try {
    return await job;
  } finally {
    todayInflight.delete(inflightKey);
  }
}

async function pollTodayUntilSettled(
  userId: string,
  input: DailyPackQueryInput,
  need: 'wakeup' | 'flaw' | 'both',
  timeoutMs = 180_000,
): Promise<DailyPackResponse> {
  const started = Date.now();
  let last: DailyPackResponse | null = null;
  while (Date.now() - started < timeoutMs) {
    last = await getTodayDailyPack(input, userId);
    if (last.status === 'failed') return last;
    if (last.status === 'ready') {
      if (need === 'wakeup' && last.wakeup) return last;
      if (need === 'flaw' && last.flawVocab?.length) return last;
      if (need === 'both' && last.wakeup && last.flawVocab?.length) return last;
      if (need === 'both' && last.wakeup) return last;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return last || { success: false, status: 'failed', errorMessage: '等待生成超时' };
}

export async function waitDailyPackUntilReady(
  type: 'wakeup' | 'flaw' | 'both',
  input?: Partial<DailyPackQueryInput>,
  userId = getAppUserId(),
  timeoutMs = 180_000,
) {
  return pollTodayUntilSettled(
    userId,
    normalizeDailyPackInput(input),
    type === 'flaw' ? 'flaw' : type === 'wakeup' ? 'wakeup' : 'both',
    timeoutMs,
  );
}

export async function regenerateDailyPack(
  type: 'wakeup' | 'flaw' | 'both' = 'both',
  input?: Partial<DailyPackQueryInput>,
  userId = getAppUserId(),
) {
  const normalizedInput = normalizeDailyPackInput(input);
  return request<DailyPackResponse>('/api/daily-pack/regenerate', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      type,
      theme: normalizedInput.theme,
      historyExclude: normalizedInput.historyExclude,
      userCurrentProfile: normalizedInput.userCurrentProfile,
    }),
    timeoutMs: 8_000,
  });
}

function packSatisfiesNeed(pack: DailyPackResponse, need: 'wakeup' | 'flaw' | 'both') {
  if (pack.status === 'failed') return true;
  if (pack.status !== 'ready') return false;
  if (need === 'wakeup') return Boolean(pack.wakeup);
  if (need === 'flaw') return Boolean(pack.flawVocab?.length);
  return Boolean(pack.wakeup);
}

export async function raceDailyPackReady(
  first: DailyPackResponse,
  type: 'wakeup' | 'flaw' | 'both',
  input?: Partial<DailyPackQueryInput>,
  userId = getAppUserId(),
): Promise<
  | { kind: 'ready'; pack: DailyPackResponse }
  | { kind: 'handoff'; pack: DailyPackResponse; wait: Promise<DailyPackResponse> }
> {
  const need = type === 'flaw' ? 'flaw' : type === 'wakeup' ? 'wakeup' : 'both';
  if (packSatisfiesNeed(first, need)) {
    return { kind: 'ready', pack: first };
  }
  const wait = waitDailyPackUntilReady(type, input, userId);
  const raced = await withDailyPackRace(wait);
  if (!raced.isTimeout) {
    return { kind: 'ready', pack: raced.result };
  }
  return { kind: 'handoff', pack: first, wait };
}
