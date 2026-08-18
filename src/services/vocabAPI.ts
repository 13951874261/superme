/**
 * 生词本前端 API 客户端
 * 统一封装所有对服务端 /api/vocab/* 的调用
 */

import { getUserCurrentProfile, interceptOutputText, getAppUserId } from '../utils/profileHelper';
import { playError } from '../utils/soundEffects';
import { showToast } from '../components/Toast';
import { createRequestDeduper } from './vocabRequestDeduper';
import { recordL1Response } from '../utils/perfSlaTelemetry';

const API_BASE = '/api/vocab';
const vocabRequestDeduper = createRequestDeduper();

export interface VocabEntry {
  id: string;
  word: string;
  dict_type: string;
  category: 'business' | 'general';
  payload: any;
  added_at: number;
  repetitions: number;
  ease_factor: number;
  interval_days: number;
  next_review_date: number;
  last_review_date: number | null;
  review_history: Array<{ date: number; quality: number }>;
  /** 轻量列表标记：需按需 getVocabItem 补全 */
  _light?: boolean;
}

export interface VocabStats {
  total: number;
  dueToday: number;
}

export interface VocabPage {
  items: VocabEntry[];
  hasMore: boolean;
}

export type VocabCategory = 'business' | 'general';

export interface DictQueryParams {
  word: string;
  dictType: string;
  direction?: string;
  userContext?: string;
  locale?: string;
  userId?: string;
}

// --- 现代汉语词典结构 ---
export interface OtherMeaningZh {
  meaning: string;
  context: string;
}

export interface ConfusablePairZh {
  term: string;
  note: string;
}

export interface ZhModernPayload {
  pos: string;
  definition: string;
  phonetic: string;
  usage_notes: string;
  other_meanings: OtherMeaningZh[];
  example_sentences: string[];
  collocations: string[];
  synonyms: string[];
  antonyms: string[];
  confusable_pairs: ConfusablePairZh[];
 level?: string;
  meaning_zh?: string;
}

// --- 商务英英词典结构 ---
export interface ScenarioEn {
  scene: string;
  example_en: string;
}

export interface OtherMeaningEn {
  meaning_en: string;
  context_en: string;
}

export interface EnEnBusinessPayload {
  headword: string;
  pos: string;
  phonetic: string;
  definitions_en: string[];
  business_notes: string;
  scenarios: (string | ScenarioEn)[];
  other_meanings: OtherMeaningEn[];
  example_sentences: (string | { en: string; zh: string })[];
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  level?: string;
  meaning_zh?: string;
}

// --- 英汉双向商务词典结构 ---
export interface OtherMeaningEnZh {
  meaning: string;
  context: string;
}

export interface BusinessExampleEnZh {
  zh: string;
  en: string;
  scene: string;
}

export interface ExampleSentenceEnZh {
  en: string;
  zh: string;
}

export interface EnZhBidirectionalPayload {
  direction_resolved: 'en_to_zh' | 'zh_to_en';
  phonetic: string;
  pos: string;
  translation_main: string;
  other_meanings: OtherMeaningEnZh[];
  business_examples: (string | BusinessExampleEnZh)[];
  example_sentences: (string | ExampleSentenceEnZh)[];
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  etymology?: string;
  level?: string;
}

export type DictPayload = ZhModernPayload | EnEnBusinessPayload | EnZhBidirectionalPayload;

export interface DictResult {
  ok: boolean;
  type?: 'zh_modern' | 'en_en_business' | 'en_zh_bidirectional';
  payload?: DictPayload;
  error_code?: string;
  message?: string;
}


async function request<T>(path: string, options?: RequestInit & { timeoutMs?: number; silent?: boolean }): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 3000;
  const silent = options?.silent === true;
  const { timeoutMs: _t, silent: _s, ...fetchOpts } = options || {};
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...fetchOpts,
      signal: controller.signal,
    });
    const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    recordL1Response(`Vocab API ${path.split('?')[0]}`, durationMs, res.ok);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[vocabAPI] Vocab request HTTP error:', path, res.status, err);
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    interceptOutputText(data);
    return data;
  } catch (err: any) {
    const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    recordL1Response(`Vocab API ${path.split('?')[0]}`, durationMs, false);
    const isAbort = err?.name === 'AbortError';
    if (!isAbort) {
      console.error('[vocabAPI] Vocab request exception:', path, err);
    }
    if (!silent && !isAbort) {
      playError();
      showToast({ message: err.message || '词库请求失败', type: 'error' });
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

function reviewLightCacheKey(category: VocabCategory): string {
  return `sa_vocab_review_light_v1:${category}`;
}

export function readReviewLightCache(category: VocabCategory): VocabEntry[] | null {
  try {
    const raw = sessionStorage.getItem(reviewLightCacheKey(category));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeReviewLightCache(category: VocabCategory, words: VocabEntry[]): void {
  try {
    sessionStorage.setItem(reviewLightCacheKey(category), JSON.stringify(words));
  } catch {
    // quota / private mode
  }
}

export function clearReviewLightCache(category: VocabCategory): void {
  try {
    sessionStorage.removeItem(reviewLightCacheKey(category));
  } catch {
    // ignore
  }
}

/** 获取统计：总词数 + 今日待复习数 */
export async function getStats(): Promise<VocabStats> {
  return vocabRequestDeduper.run('stats', () =>
    request<VocabStats>('/stats', { timeoutMs: 3000, silent: true })
  );
}

/** 获取词条分页列表（默认第一页 50 条轻量数据，禁止全表拉取） */
export async function getAllWords(options?: { light?: boolean; limit?: number }): Promise<VocabEntry[]> {
  const safeLimit = Math.min(Math.max(Math.floor(options?.limit || 50), 1), 100);
  const path = `/list?light=1&limit=${safeLimit}`;
  const res = await request<{ items: VocabEntry[]; hasMore: boolean }>(path, {
    timeoutMs: 10000,
    silent: true,
  });
  return res?.items || [];
}

/** 按单词精确查找轻量词条（走 idx_vocab_word_nocase 索引） */
export async function getVocabByWord(word: string): Promise<VocabEntry | null> {
  const trimmed = typeof word === 'string' ? word.trim() : '';
  if (!trimmed) return null;
  const path = `/list?light=1&limit=1&word=${encodeURIComponent(trimmed)}`;
  const res = await request<{ items: VocabEntry[]; hasMore: boolean }>(path, {
    timeoutMs: 8000,
    silent: true,
  });
  return res?.items?.[0] || null;
}

/** 批量点查词条（单次上限 100） */
export async function lookupVocabWords(words: string[]): Promise<VocabEntry[]> {
  const validWords = Array.from(
    new Set(words.map((w) => (typeof w === 'string' ? w.trim() : '')).filter(Boolean))
  ).slice(0, 100);
  if (validWords.length === 0) return [];
  const res = await request<{ items: VocabEntry[] }>('/lookup', {
    method: 'POST',
    body: JSON.stringify({ words: validWords }),
    timeoutMs: 10000,
    silent: true,
  });
  return res?.items || [];
}

export async function getVocabPage(
  category: VocabCategory,
  offset: number,
  limit = 50,
): Promise<VocabPage> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const safeOffset = Math.max(Math.floor(offset), 0);
  const path = `/list?light=1&category=${category}&limit=${safeLimit}&offset=${safeOffset}`;
  return vocabRequestDeduper.run(`list:page:${category}:${safeOffset}:${safeLimit}`, () =>
    request<VocabPage>(path, { timeoutMs: 20000, silent: true })
  );
}

export async function getReviewPage(
  category: VocabCategory,
  limit = 50,
  offset = 0,
): Promise<VocabPage> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const safeOffset = Math.max(Math.floor(offset), 0);
  const path = `/review?light=1&category=${category}&limit=${safeLimit}&offset=${safeOffset}`;
  return vocabRequestDeduper.run(`review:page:${category}:${safeLimit}:${safeOffset}`, () =>
    request<VocabPage>(path, { timeoutMs: 20000, silent: true })
  );
}

/** 获取今日待复习词条（始终轻量分页 + 写缓存） */
export async function getReviewWords(
  category: VocabCategory,
  _options?: { light?: boolean },
): Promise<VocabEntry[]> {
  const page = await getReviewPage(category, 50);
  writeReviewLightCache(category, page.items);
  return page.items;
}

/** 按 id 取完整词条（补全 payload） */
export async function getVocabItem(id: string): Promise<VocabEntry> {
  return request<VocabEntry>(`/item/${encodeURIComponent(id)}`, { timeoutMs: 8000, silent: true });
}

/** 收录词条 */
export async function addWord(params: {
  word: string;
  dictType: string;
  category?: 'business' | 'general';
  scene_type?: string;
  payload: any;
}): Promise<{ success: boolean; id?: string; message: string }> {
  return request('/add', {
    method: 'POST',
    body: JSON.stringify({ ...params, category: params.category || 'business' }),
  });
}

/** 更新词条 payload */
export async function updateWordPayload(
  wordId: string,
  newPayload: any
): Promise<{ success: boolean; message?: string }> {
  return request(`/update_payload/${wordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ payload: newPayload }),
  });
}

/** 全面修改词条（支持修改单词、分区及详细 payload） */
export async function updateWord(
  id: string,
  params: {
    word: string;
    category: 'business' | 'general';
    payload: any;
  }): Promise<{ success: boolean; message: string }> {
  return request(`/update/${id}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

/** 提交复习结果（quality: 0=完全忘记 2=朦胧 4=记住 5=轻松） */
export async function submitReview(
  id: string,
  quality: number
): Promise<{ success: boolean; nextReviewDate: number; interval: number; message: string }> {
  return request(`/review/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ quality }),
  });
}

/** 人工干预复习频率 */
export async function manualIntervention(
  id: string,
  action: 'restart' | 'step-back' | 'step-forward' | 'master'
): Promise<{ success: boolean; nextReviewDate: number; interval: number; message: string }> {
  return request(`/manual-intervention/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ action }),
  });
}

/** 删除词条 */
export async function deleteWord(id: string): Promise<{ success: boolean }> {
  return request(`/${id}`, { method: 'DELETE' });
}

/** 词典查询（由后端代理 Dify，避免前端暴露 token） */
export async function queryDictionary(params: DictQueryParams): Promise<DictResult> {
  let resolvedDirection = params.direction || 'auto';
  if (params.dictType === 'en_zh_bidirectional' && (!params.direction || params.direction === 'auto')) {
    const hasChinese = /[\u4e00-\u9fa5]/.test(params.word || '');
    resolvedDirection = hasChinese ? 'zh_to_en' : 'en_to_zh';
  }

  try {
    const res = await fetch('/api/dify/dict-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userContext: '',
        locale: 'zh-CN',
        userId: getAppUserId(),
        ...params,
        direction: resolvedDirection,
        user_current_profile: getUserCurrentProfile(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[vocabAPI] queryDictionary HTTP error:', res.status, data);
      throw new Error(data?.message || `HTTP ${res.status}`);
    }
    interceptOutputText(data);
    return data;
  } catch (err: any) {
    console.error('[vocabAPI] queryDictionary exception:', err);
    throw err;
  }
}

// --- 新增记忆辅助与遗忘曲线相关类型 ---
export interface MemoryAids {
  root_memory?: string;
  association_memory?: string;
  mnemonic_phrase?: string;
  image_prompt?: string;
  image_url?: string;
  download_url?: string;
  generated_at?: number;
}

export interface EbbinghausPoint {
  day: number;
  retention_estimated?: number;
  quality?: number;
  is_theoretical: boolean;
  is_review?: boolean;
  review_index?: number;
}

export interface EbbinghausData {
  id: string;
  word: string;
  repetitions: number;
  interval_days: number;
  next_review_date: number;
  points: EbbinghausPoint[];
}

export interface DictCoverageData {
  success: boolean;
  total_queries: number;
  success_queries: number;
  success_rate: number;
  level_distribution: Record<string, number>;
}

/** 获取缓存的记忆辅助 */
export async function getMemoryAids(id: string): Promise<MemoryAids> {
  return request<MemoryAids>(`/memory/${id}`);
}

/** 生成/更新记忆辅助 */
export async function enrichMemory(id: string): Promise<MemoryAids> {
  return request<MemoryAids>(`/enrich-memory/${id}`, {
    method: 'POST',
    body: JSON.stringify({ user_current_profile: getUserCurrentProfile() })
  });
}

/** 获取艾宾浩斯曲线数据 */
export async function getEbbinghausData(id: string): Promise<EbbinghausData> {
  return request<EbbinghausData>(`/ebbinghaus/${id}`);
}

/** 生成记忆配图 */
export async function generateMemoryImage(id: string): Promise<{ success: boolean; id: string; image_url: string; download_url: string }> {
  const initialRes = await request<{ success: boolean; taskId?: string; id?: string; image_url?: string; download_url?: string }>(`/generate-image/${id}`, {
    method: 'POST',
    body: JSON.stringify({ user_current_profile: getUserCurrentProfile() })
  });

  if (initialRes.taskId) {
    let attempts = 0;
    while (attempts < 60) {
      try {
        const res = await fetch(`/api/tasks/${initialRes.taskId}`);
        const data = await res.json();
        if (!res.ok) {
          console.error('[vocabAPI] generateMemoryImage poll HTTP error:', res.status, data);
          throw new Error(data.error || '获取任务状态失败');
        }

        if (data.status === 'completed' && data.result) {
          return { success: true, id, image_url: data.result.image_url, download_url: data.result.download_url };
        }
        if (data.status === 'failed') {
          console.error('[vocabAPI] generateMemoryImage poll task failed:', data.error);
          throw new Error(data.error || '图片生成失败');
        }
      } catch (err: any) {
        console.error('[vocabAPI] generateMemoryImage poll exception:', err);
        throw err;
      }

      await new Promise(r => setTimeout(r, 3000));
      attempts++;
    }
    throw new Error('生成图片超时，请稍后重试');
  }

  // Fallback to synchronous if backend didn't return taskId
  return initialRes as { success: boolean; id: string; image_url: string; download_url: string };
}

/** 获取词典查询统计/覆盖率 */
export async function getDictCoverage(): Promise<DictCoverageData> {
  try {
    const res = await fetch('/api/dify/dict-coverage');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[vocabAPI] getDictCoverage HTTP error:', res.status, data);
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    return data;
  } catch (err: any) {
    console.error('[vocabAPI] getDictCoverage exception:', err);
    throw err;
  }
}


export interface BatchAddWordItem {
  word: string;
  category?: 'business' | 'general';
  is_phrase?: boolean;
  dictType?: string;
  payload?: any;
}

/** 批量收录词条（支持单词与短语） */
export async function batchAddWords(
  items: BatchAddWordItem[]
): Promise<{ success: boolean; addedCount: number; message: string }> {
  return request('/batch-add', {
    method: 'POST',
    body: JSON.stringify(items),
  });
}

// ============================================================
// 字典查询请求去重 & 并发限制（页面初始请求过载优化）
// ============================================================

/** 请求缓存：相同参数只保留一个 Promise */
const requestCache = new Map<string, Promise<DictResult>>();

/** 生成缓存键 */
export function getCacheKey(params: DictQueryParams): string {
  return `${params.dictType}:${(params.word || '').toLowerCase().trim()}`;
}

/** 带缓存的单次查询（相同 word+dictType 只发一次请求） */
export async function queryDictionaryWithCache(params: DictQueryParams): Promise<DictResult> {
  const key = getCacheKey(params);
  if (requestCache.has(key)) return requestCache.get(key)!;
  const promise = queryDictionary(params).finally(() => requestCache.delete(key));
  requestCache.set(key, promise);
  return promise;
}

/** 并发限制器工厂：限制同时进行的请求数 */
export function createConcurrencyLimiter(maxConcurrent: number = 3) {
  const queue: Array<() => Promise<void>> = [];
  let active = 0;

  async function run() {
    if (queue.length === 0) return;
    active++;
    const task = queue.shift()!;
    try {
      await task();
    } finally {
      active--;
      run();
    }
  }

  return function enqueue(task: () => Promise<void>) {
    queue.push(task);
    if (active < maxConcurrent) run();
  };
}
