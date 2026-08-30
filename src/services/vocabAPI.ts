/**
 * 生词本前端 API 客户端
 * 统一封装所有对服务端 /api/vocab/* 的调用
 */

import { getInjectedUserCurrentProfile, interceptOutputText, getAppUserId } from '../utils/profileHelper';
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
  total?: number;
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
  other_meanings: OtherMeaningEn[] | OtherMeaningEnZh[];
  example_sentences: (string | { en: string; zh: string })[];
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  level?: string;
  meaning_zh?: string;
  /** Cambridge English edition marker */
  edition?: string;
  senses?: CambridgeSense[];
  idioms?: string[];
  phonetics?: { uk?: string; us?: string };
  source?: string;
  source_url?: string;
  copyright?: string;
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

export interface CambridgeSense {
  headword: string;
  part_of_speech: string;
  label: string;
  level: string;
  grammar: string[];
  register: string;
  definition_en: string;
  translation_zh: string;
  examples: ExampleSentenceEnZh[];
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
  idioms?: string[];
  etymology?: string;
  level?: string;
  phonetics?: { uk?: string; us?: string };
  senses?: CambridgeSense[];
  inflections?: string[];
  source?: string;
  source_url?: string;
  copyright?: string;
  raw_markdown?: string;
}

export type DictPayload = ZhModernPayload | EnEnBusinessPayload | EnZhBidirectionalPayload;

export interface DictResult {
  ok: boolean;
  type?: 'zh_modern' | 'en_en_business' | 'en_zh_bidirectional';
  payload?: DictPayload;
  error_code?: string;
  message?: string;
  fromCache?: boolean;
  backgroundEnriching?: boolean;
  /** 首响来自生词本秒开（后台仍拉 Cam/Dify 更新） */
  fromVocabBook?: boolean;
  /** 该词是否已在当前用户生词本中（后端 dict-query 返回） */
  inVocabulary?: boolean;
}

/**
 * 将生词本存储 payload 转为词典面板可展示结构（C1 秒开用）。
 */
export function buildDictDisplayPayloadFromVocab(
  word: string,
  vocabPayload: Record<string, any> | null | undefined,
): Record<string, any> {
  const p = vocabPayload && typeof vocabPayload === 'object' ? vocabPayload : {};
  const meaningZh = String(p.meaning || p.meaning_zh || p.translation_main || '').trim();
  const definitionEn = String(p.definition_en || '').trim();
  const examples = normalizeExampleList(p.examples?.length ? p.examples : p.example_sentences);
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean) : []);
  return {
    headword: String(word || p.word || '').trim(),
    phonetic: p.phonetic || '',
    pos: p.partOfSpeech || p.pos || '',
    level: p.level || '',
    meaning_zh: meaningZh,
    translation_main: meaningZh,
    definitions_en: definitionEn ? [definitionEn] : [],
    definition: meaningZh || definitionEn,
    business_notes: p.business_note || p.business_notes || '',
    example_sentences: examples,
    synonyms: list(p.synonyms),
    antonyms: list(p.antonyms),
    collocations: list(p.collocations),
    business_examples: list(p.business_examples),
    etymology: typeof p.etymology === 'string' ? p.etymology : '',
  };
}

/** Dify enrichment fields (synonyms / antonyms / collocations / etymology / business_examples) */
export function hasDifyEnrichmentFields(payload: DictPayload | Record<string, unknown> | null | undefined): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  const list = (v: unknown) => Array.isArray(v) && v.length > 0;
  const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  return (
    list(p.synonyms)
    || list(p.antonyms)
    || list(p.collocations)
    || list(p.business_examples)
    || text(p.etymology)
  );
}

function normalizeExamplePair(item: unknown): { en: string; zh: string } | null {
  if (typeof item === 'string') {
    const en = item.trim();
    return en ? { en, zh: '' } : null;
  }
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const en = String(row.en || row.example_en || row.example || '').trim();
  const zh = String(row.zh || row.example_zh || row.translation || '').trim();
  if (!en && !zh) return null;
  return { en, zh };
}

function normalizeExampleList(list: unknown): { en: string; zh: string }[] {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeExamplePair).filter(Boolean) as { en: string; zh: string }[];
}

/**
 * 将词典查询 payload 转为生词本存储结构：Cambridge 字段优先，Dify 仅补缺；
 * 保留已有矩阵/记忆等扩展字段；剥离 raw_markdown / senses 等不写入生词本的字段。
 * examplesOverride：用户编辑后的「Cambridge 例句」可见列表（仅收录/更新时写入）。
 */
export function buildVocabPayloadFromDict(
  dictPayload: DictPayload | Record<string, any> | null | undefined,
  existing?: Record<string, any> | null,
  meta?: {
    word?: string;
    source?: string;
    examplesOverride?: Array<{ en?: string; zh?: string } | string> | null;
    /** 已收录自动补全时保留生词本已有例句，避免覆盖用户编辑 */
    preserveExamples?: boolean;
  }
): Record<string, any> {
  const d = (dictPayload && typeof dictPayload === 'object') ? dictPayload as Record<string, any> : {};
  const ex = (existing && typeof existing === 'object') ? { ...existing } : {};
  delete ex.raw_markdown;
  delete ex.cambridge_raw;
  delete ex.dify_raw;
  // Cambridge 详情折叠区不写入生词本
  delete ex.senses;

  const fillList = (key: string) => {
    const cur = d[key];
    const seed = ex[key];
    if (Array.isArray(cur) && cur.length > 0) return cur;
    if (Array.isArray(seed) && seed.length > 0) return seed;
    return Array.isArray(cur) ? cur : (Array.isArray(seed) ? seed : []);
  };
  const fillText = (primary: unknown, fallback: unknown) => {
    const a = typeof primary === 'string' ? primary.trim() : '';
    if (a) return primary as string;
    const b = typeof fallback === 'string' ? fallback.trim() : '';
    return b ? (fallback as string) : (typeof primary === 'string' ? primary : (typeof fallback === 'string' ? fallback : ''));
  };

  const meaning = fillText(
    d.translation_main || d.meaning_zh || d.meaning,
    ex.meaning || ex.translation_main || ex.meaning_zh
  );
  const definitionEn = fillText(
    (Array.isArray(d.definitions_en) && d.definitions_en[0])
      || d.senses?.[0]?.definition_en
      || d.definition_en,
    ex.definition_en
  );

  let examples = normalizeExampleList(meta?.examplesOverride);
  if (examples.length === 0 && meta?.preserveExamples) {
    examples = normalizeExampleList(ex.examples?.length ? ex.examples : ex.example_sentences);
  }
  if (examples.length === 0) {
    const fromTop = normalizeExampleList(d.example_sentences);
    if (fromTop.length > 0) {
      examples = fromTop;
    } else if (Array.isArray(d.senses) && d.senses.some((s: any) => s?.examples?.length)) {
      examples = normalizeExampleList(d.senses.flatMap((s: any) => s.examples || []));
    } else {
      examples = normalizeExampleList(ex.examples?.length ? ex.examples : ex.example_sentences);
    }
  }

  const out: Record<string, any> = {
    ...ex,
    word: meta?.word || d.headword || ex.word || '',
    phonetic: fillText(d.phonetic, ex.phonetic),
    partOfSpeech: fillText(d.pos || d.partOfSpeech, ex.partOfSpeech || ex.pos),
    meaning,
    translation_main: meaning,
    meaning_zh: meaning,
    definition_en: definitionEn,
    level: fillText(d.level, ex.level),
    examples,
    example_sentences: examples,
    idioms: fillList('idioms'),
    synonyms: fillList('synonyms'),
    antonyms: fillList('antonyms'),
    collocations: fillList('collocations'),
    business_examples: fillList('business_examples'),
    etymology: fillText(d.etymology, ex.etymology),
    business_note: fillText(d.business_notes || d.business_note, ex.business_note || ex.business_notes),
    direction_resolved: fillText(d.direction_resolved, ex.direction_resolved) || 'en_to_zh',
    source: meta?.source || ex.source || 'dictionary',
  };
  // 供后端 mergeCambridgeWithDify 使用；展示层仍用扁平字段，不依赖 senses/raw_markdown
  if (d.cambridge_raw && typeof d.cambridge_raw === 'object') {
    out.cambridge_raw = d.cambridge_raw;
  }
  return out;
}

/** 收录前拉取词典数据：单词 Cam-first（与词典面板一致）；短语/句型走 en_zh 纯 Dify 同步路径 */
export async function buildVocabCollectPayload(
  text: string,
  options: {
    isPhrase?: boolean;
    isSentence?: boolean;
    source?: string;
  } = {}
): Promise<Record<string, any>> {
  const clean = String(text || '').trim();
  if (!clean) return {};
  const source = options.source || 'Manual Select';
  const isWord = !options.isPhrase && !options.isSentence;

  const dictResult = await queryDictionary({
    word: clean,
    dictType: 'en_zh_bidirectional',
    direction: 'auto',
    locale: 'zh-CN',
    userContext: '',
  });

  if (!dictResult?.ok || !dictResult.payload) return {};

  if (isWord) {
    return buildVocabPayloadFromDict(dictResult.payload, null, {
      word: clean,
      source,
    });
  }

  const p = dictResult.payload as Record<string, any>;
  const meaning = p.translation_main || p.meaning_zh || p.meaning || '';
  return {
    word: clean,
    meaning,
    translation_main: meaning,
    meaning_zh: meaning,
    phonetic: p.phonetic || '',
    partOfSpeech: options.isSentence ? 'sentence' : 'phrase',
    definition_en: Array.isArray(p.definitions_en) ? p.definitions_en[0] : (p.definition_en || ''),
    examples: p.example_sentences || [],
    example_sentences: p.example_sentences || [],
    synonyms: Array.isArray(p.synonyms) ? p.synonyms : [],
    antonyms: Array.isArray(p.antonyms) ? p.antonyms : [],
    collocations: Array.isArray(p.collocations) ? p.collocations : [],
    source,
  };
}

/** 用于判断生词本是否需要再次回写（避免轮询重复 PATCH） */
export function vocabSyncFingerprint(payload: Record<string, any> | null | undefined): string {
  const p = payload || {};
  const exNorm = normalizeExampleList(p.examples?.length ? p.examples : p.example_sentences);
  return JSON.stringify({
    m: p.meaning || p.translation_main || '',
    ph: p.phonetic || '',
    pos: p.partOfSpeech || p.pos || '',
    ex: exNorm.map((e) => `${e.en}|${e.zh}`),
    syn: Array.isArray(p.synonyms) ? p.synonyms.length : 0,
    ant: Array.isArray(p.antonyms) ? p.antonyms.length : 0,
    col: Array.isArray(p.collocations) ? p.collocations.length : 0,
    biz: Array.isArray(p.business_examples) ? p.business_examples.length : 0,
    ety: typeof p.etymology === 'string' ? p.etymology.slice(0, 80) : '',
  });
}


async function request<T>(path: string, options?: RequestInit & { timeoutMs?: number; silent?: boolean }): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const silent = options?.silent === true;
  const { timeoutMs: _t, silent: _s, headers: optHeaders, ...fetchOpts } = options || {};
  const controller = new AbortController();
  let timer: number | null = null;

  // 如果 timeoutMs > 0 才开启超时限制；如果 timeoutMs === 0 则不做时长限制
  if (timeoutMs > 0) {
    timer = window.setTimeout(() => controller.abort(), timeoutMs);
  }
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOpts,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': getAppUserId(),
        ...(optHeaders as Record<string, string> | undefined),
      },
      ...(timer ? { signal: controller.signal } : {}),
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
      console.error('生词本请求失败:', err);
      showToast({ message: '生词本请求失败，请稍后重试', type: 'error' });
    }
    throw err;
  } finally {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
  }
}

function reviewLightCacheKey(category: VocabCategory): string {
  return `sa_vocab_review_light_v1:${getAppUserId()}:${category}`;
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

/** 获取统计：总词数 + 今日待复习数（按当前登录账号隔离） */
export async function getStats(): Promise<VocabStats> {
  const uid = getAppUserId();
  return vocabRequestDeduper.run(`stats:${uid}`, () =>
    request<VocabStats>(`/stats?userId=${encodeURIComponent(uid)}`, { timeoutMs: 3000, silent: true })
  );
}

/** 获取词条分页列表（默认第一页 50 条轻量数据，按账号隔离） */
export async function getAllWords(options?: { light?: boolean; limit?: number }): Promise<VocabEntry[]> {
  const safeLimit = Math.min(Math.max(Math.floor(options?.limit || 50), 1), 100);
  const uid = getAppUserId();
  const path = `/list?light=1&limit=${safeLimit}&userId=${encodeURIComponent(uid)}`;
  const res = await request<{ items: VocabEntry[]; hasMore: boolean }>(path, {
    timeoutMs: 10000,
    silent: true,
  });
  return res?.items || [];
}

/** 按单词精确查找轻量词条（按账号隔离） */
export async function getVocabByWord(word: string): Promise<VocabEntry | null> {
  const trimmed = typeof word === 'string' ? word.trim() : '';
  if (!trimmed) return null;
  const uid = getAppUserId();
  const path = `/list?light=1&limit=1&word=${encodeURIComponent(trimmed)}&userId=${encodeURIComponent(uid)}`;
  const res = await request<{ items: VocabEntry[]; hasMore: boolean }>(path, {
    timeoutMs: 8000,
    silent: true,
  });
  return res?.items?.[0] || null;
}

/** 批量点查词条（单次上限 100，按账号隔离） */
export async function lookupVocabWords(words: string[]): Promise<VocabEntry[]> {
  const validWords = Array.from(
    new Set(words.map((w) => (typeof w === 'string' ? w.trim() : '')).filter(Boolean))
  ).slice(0, 100);
  if (validWords.length === 0) return [];
  const uid = getAppUserId();
  const res = await request<{ items: VocabEntry[] }>('/lookup', {
    method: 'POST',
    body: JSON.stringify({ words: validWords, userId: uid }),
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
  const uid = getAppUserId();
  const path = `/list?light=1&category=${category}&limit=${safeLimit}&offset=${safeOffset}&userId=${encodeURIComponent(uid)}`;
  return vocabRequestDeduper.run(`list:page:${uid}:${category}:${safeOffset}:${safeLimit}`, () =>
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
  const uid = getAppUserId();
  const path = `/review?light=1&category=${category}&limit=${safeLimit}&offset=${safeOffset}&userId=${encodeURIComponent(uid)}`;
  return vocabRequestDeduper.run(`review:page:${uid}:${category}:${safeLimit}:${safeOffset}`, () =>
    request<VocabPage>(path, { timeoutMs: 20000, silent: true })
  );
}

/** 获取今日待复习词条（始终轻量分页 + 写缓存，按账号隔离） */
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
  const uid = getAppUserId();
  return request<VocabEntry>(
    `/item/${encodeURIComponent(id)}?userId=${encodeURIComponent(uid)}`,
    { timeoutMs: 8000, silent: true },
  );
}

/** 复习 light 列表条目是否需要 getVocabItem 补全 payload（F1） */
export function needsReviewPayloadHydrate(
  entry: (Pick<VocabEntry, 'id' | 'payload'> & { _light?: boolean }) | null | undefined,
): boolean {
  if (!entry?.id) return false;
  if (entry._light) return true;
  const p = entry.payload;
  if (!p || typeof p !== 'object') return true;
  return Object.keys(p).length === 0;
}

/** 收录词条（自动绑定当前登录账号） */
export async function addWord(params: {
  word: string;
  dictType: string;
  category?: 'business' | 'general';
  scene_type?: string;
  payload: any;
}): Promise<{ success: boolean; id?: string; message: string }> {
  const uid = getAppUserId();
  return request('/add', {
    method: 'POST',
    body: JSON.stringify({ ...params, category: params.category || 'business', userId: uid }),
  });
}

/** 单条收录并同步补齐词汇矩阵（音标释义/同近义词/搭配/记忆节点/高管 SOP；句式另含翻译与语法结构） */
export async function addWordEnriched(params: {
  word: string;
  dictType: string;
  category?: 'business' | 'general';
  scene_type?: string;
  is_phrase?: boolean;
  is_sentence?: boolean;
  payload?: any;
  topic?: string;
  source?: string;
}): Promise<{
  success: boolean;
  id?: string;
  kind?: 'word' | 'phrase' | 'sentence';
  created?: boolean;
  matrixReady?: boolean;
  memoryReady?: boolean;
}> {
  const uid = getAppUserId();
  return request('/add-enriched', {
    method: 'POST',
    // 矩阵补齐需调用大模型，放宽单次请求时长；前端另有 3 秒竞速托管机制
    timeoutMs: 120000,
    // 静默：迟到失败不得 Toast，提示统一由 useVocabCollect（成功 / 转入任务中心）负责
    silent: true,
    body: JSON.stringify({ ...params, category: params.category || 'business', userId: uid }),
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
        ...params,
        userContext: params.userContext || '',
        locale: params.locale || 'zh-CN',
        userId: getAppUserId(),
        direction: resolvedDirection,
        user_current_profile: getInjectedUserCurrentProfile({
          topic: params.word,
          user_query: params.word,
          userContext: params.userContext || '',
        }),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[vocabAPI] queryDictionary HTTP error:', res.status, data);
      throw new Error(data?.message || `HTTP ${res.status}`);
    }
    interceptOutputText(data);
    return data as DictResult;
  } catch (err: any) {
    console.error('[vocabAPI] queryDictionary exception:', err);
    throw err;
  }
}

/**
 * 首响可能是生词本秒开 / Cambridge 秒开（backgroundEnriching=true）。
 * - fromVocabBook：继续轮询直到 Cam/Dify 缓存回写（即使生词本已有近反义）
 * - 其它：轮询直到 Dify enrichment 字段出现或超时
 */
export async function queryDictionaryWithEnrichmentPoll(
  params: DictQueryParams,
  options?: {
    onUpdate?: (result: DictResult) => void;
    maxAttempts?: number;
    intervalMs?: number;
    signal?: AbortSignal;
  }
): Promise<DictResult> {
  // Dify 增强有队列+限流，常需 30–90s；过短轮询会误以为“没有返回”
  const maxAttempts = options?.maxAttempts ?? 24;
  const intervalMs = options?.intervalMs ?? 3000;
  let latest = await queryDictionary(params);
  options?.onUpdate?.(latest);

  const shouldKeepPolling = (r: DictResult) => {
    if (!r?.ok || !r.backgroundEnriching) return false;
    // 生词本秒开：即使已有 Dify 字段，也继续等 Cam/Dify 更新结果
    if (r.fromVocabBook) return true;
    return !hasDifyEnrichmentFields(r.payload);
  };

  if (!shouldKeepPolling(latest)) {
    return latest;
  }

  for (let i = 0; i < maxAttempts; i += 1) {
    if (options?.signal?.aborted) break;
    await new Promise((r) => setTimeout(r, intervalMs));
    if (options?.signal?.aborted) break;
    try {
      const next = await queryDictionary(params);
      if (!next?.ok) continue;
      latest = next;
      options?.onUpdate?.(next);
      if (!shouldKeepPolling(next)) {
        return next;
      }
    } catch {
      // keep polling
    }
  }
  return latest;
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
  const uid = getAppUserId();
  return request<MemoryAids>(`/memory/${encodeURIComponent(id)}?userId=${encodeURIComponent(uid)}`, {
    timeoutMs: 0,
    silent: true,
  });
}

/** 生成/更新记忆辅助（无时长限制）；成功后后端写入生词本 memory_aids */
export async function enrichMemory(id: string): Promise<MemoryAids> {
  const uid = getAppUserId();
  return request<MemoryAids>(`/enrich-memory/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify({
      userId: uid,
      user_current_profile: getInjectedUserCurrentProfile(),
    }),
    timeoutMs: 0,
  });
}

/** 获取艾宾浩斯曲线数据 */
export async function getEbbinghausData(id: string): Promise<EbbinghausData> {
  return request<EbbinghausData>(`/ebbinghaus/${id}`);
}

/** 生成记忆配图（无时长限制） */
export async function generateMemoryImage(id: string): Promise<{ success: boolean; id: string; image_url: string; download_url: string }> {
  const uid = getAppUserId();
  const initialRes = await request<{ success: boolean; taskId?: string; id?: string; image_url?: string; download_url?: string }>(
    `/generate-image/${encodeURIComponent(id)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        userId: uid,
        user_current_profile: getInjectedUserCurrentProfile(),
      }),
      timeoutMs: 0,
    },
  );

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
  is_sentence?: boolean;
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

/** 异步批量收录词条（解耦返回 taskId 接入任务中心） */
export async function batchAddWordsAsync(
  items: BatchAddWordItem[],
  topic: string = '通用主题',
  source: string = 'User Manual Selection'
): Promise<{ success: boolean; taskId: string; status: string }> {
  return request('/batch-add-async', {
    method: 'POST',
    body: JSON.stringify({ items, topic, source, userId: getAppUserId() }),
  });
}

/** 包装 3 秒 Timeout 竞速添加词汇 */
export async function addVocabWithTimeout<T>(
  actionPromise: Promise<T>,
  timeoutMs: number = 3000
): Promise<{ isTimeout: false; result: T } | { isTimeout: true }> {
  let timerId: any = null;
  const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) => {
    timerId = setTimeout(() => {
      resolve({ isTimeout: true });
    }, timeoutMs);
  });

  try {
    const res = await Promise.race([
      actionPromise.then((result) => ({ isTimeout: false as const, result })),
      timeoutPromise,
    ]);
    return res;
  } finally {
    if (timerId) clearTimeout(timerId);
  }
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
