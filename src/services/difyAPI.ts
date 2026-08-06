import { getUserCurrentProfile, injectUserProfileAndTime, interceptOutputText, getAppUserId } from '../utils/profileHelper';
import {
  extractKeywordsFromText,
  generateScenarioMapping,
  mergeTrainingPlans,
} from '../utils/reviewHelper';

// ── 原有接口保留 ────────────────────────────────────────────
export interface ListenWorkflowInput {
  scene_type: string;
  case_text: string;
  role_judgement: string;
  ability_judgement: string;
  intent_judgement: string;
  fallacy_choice: string;
  counter_question: string;
}

export interface DifyWorkflowResponse {
  task_id?: string;
  workflow_run_id?: string;
  data?: {
    id?: string;
    status?: string;
    outputs?: Record<string, unknown>;
    error?: string;
  };
  answer?: string;
  message?: string;
  error?: string;
}

// ── 英语板块新增接口类型 ─────────────────────────────────────

/** 多角色跨文化谈判沙盘 - 输入 */
export interface OralSandboxInput {
  scene_type: string;       // 例："国际银团贷款谈判"
  roles: string;            // 例："鐗靛ご琛屼唬琛?鎴?, 参团行A, 借款企业CFO"
  cultural_context: string; // 例："美式直接 vs 鏃ュ紡濮斿"
  user_reply?: string;      // 用户本轮回复（首次为空）
}

/** 澶氳鑹茶皥鍒ゆ矙鐩?- Dify 返回结构 */
export interface OralSandboxReply {
  current_speaker: string;
  dialogue: string;
  hidden_intent: string;
  has_flaw: boolean;
  flaw_analysis: string;
  evaluation: string;
}

/** 多角色口语沙盘 - AI 返回 JSON 结构 */
export interface ParsedAiResponse {
  scene?: unknown;
  current_speaker: unknown;
  dialogue: unknown;
  hidden_intent: unknown;
  flaw_point: unknown;
  evaluation: unknown;
  role_address?: unknown;
  branch_suggestions?: unknown;
  difficulty_rating?: unknown;
  cultural_signal?: unknown;
  counter_question_templates?: unknown;
  feedback_pronunciation?: unknown;
  feedback_vocab?: unknown;
  feedback_role_switch?: unknown;
  feedback_strategy?: unknown;
  joint_pressure?: unknown;
  logicScore?: number;
  culturalScore?: number;
  fluencyScore?: number;
  breakthroughs?: Array<{
    type: 'logic' | 'fact' | 'intent';
    text: string;
    suggestion: string;
  }>;
}

/** 口语沙盘对话上下文（注入 Dify inputs） */
export interface OralChatContext {
  scene_title?: string;
  roles?: string;
  cultural_context?: string;
  conflicts?: string;
  role_switch_instruction?: string;
  scene_level?: number;
  scene_type?: string;
  role_judgement?: string;
  intent_judgement?: string;
  /** 与 Dify start 节点 user_current_profile 对齐 */
  user_current_profile?: string;
  User_Current_Profile?: string;
}

/** 词汇提纯引擎 - 输入 */
export interface VocabPurifyInput {
  article_text: string;
  topic?: string; // 新增主题过滤变量
}

/** 词汇提纯引擎 - 返回结构 */
export interface VocabPurifyResult {
  words?: Array<{ word: string; phonetic?: string; pos?: string; zh_meaning?: string }>;
  phrases?: Array<{ phrase: string; meaning: string }>; // 统一转为对象格式，包含 phrase 和 meaning
  sentences?: string[];
}

/** 词汇提纯引擎 - 直接调用 Dify Workflow 鐨?API Key */
const VOCAB_PURIFY_DIRECT_API_KEY = import.meta.env.VITE_DIFY_VOCAB_API_KEY || '';

/** 涓夋寮忓叕鏂囨壒闃?- 输入 */
export interface WritingReviewInput {
  user_text: string;
  mail_intent: string;
}

/** 涓夋寮忓叕鏂囨壒闃?- 返回结构 */
export interface WritingReviewResult {
  L1_Grammar: string;
  L2_Business_Tone: string;
  L3_Strategic_Position: string;
  optimized_version: string;
}

export interface ListenJargonItem {
  word: string;
  meaning: string;
}

export interface ListenEngineResult {
  surfaceMeaning: string;
  hiddenSubtext: string;
  powerDynamics: string;
  keyJargons: ListenJargonItem[];
}

export interface SentenceEvaluationResult {
  isPass: boolean;
  score: number;
  feedback: string;
  correctedSentence: string;
}

export interface WordEnrichmentResult {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  definitionEn: string;
  businessNote: string;
  examples: string[];
}

export interface VocabEnrichmentPayload {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  definition_en: string;
  business_note: string;
  examples: string[];
  source: string;
}

interface RawWordEnrichmentResult {
  word?: unknown;
  phonetic?: unknown;
  part_of_speech?: unknown;
  partOfSpeech?: unknown;
  meaning?: unknown;
  definition_en?: unknown;
  definitionEn?: unknown;
  business_note?: unknown;
  businessNote?: unknown;
  examples?: unknown;
}

interface RawSentenceEvaluationResult {
  is_pass?: unknown;
  score?: unknown;
  feedback?: unknown;
  corrected_sentence?: unknown;
}

interface RawListenEngineResult {
  surface_meaning?: unknown;
  hidden_subtext?: unknown;
  power_dynamics?: unknown;
  key_jargons?: unknown;
}

function normalizeListenJargons(raw: unknown): ListenJargonItem[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): ListenJargonItem | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const word = typeof record.word === 'string' ? record.word.trim() : '';
      const meaning = typeof record.meaning === 'string' ? record.meaning.trim() : '';
      if (!word || !meaning) return null;
      return { word, meaning };
    })
    .filter((item): item is ListenJargonItem => item !== null);
}

function mapListenEngineResult(raw: unknown): ListenEngineResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI 返回数据格式异常');
  }

  const result = raw as RawListenEngineResult;
  return {
    surfaceMeaning: typeof result.surface_meaning === 'string' ? result.surface_meaning : '',
    hiddenSubtext: typeof result.hidden_subtext === 'string' ? result.hidden_subtext : '',
    powerDynamics: typeof result.power_dynamics === 'string' ? result.power_dynamics : '',
    keyJargons: normalizeListenJargons(result.key_jargons),
  };
}

function normalizeScore(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(5, Math.round(num)));
}

function mapSentenceEvaluationResult(raw: unknown): SentenceEvaluationResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI 返回数据格式异常');
  }

  const result = raw as RawSentenceEvaluationResult;
  return {
    isPass: Boolean(result.is_pass),
    score: normalizeScore(result.score),
    feedback: typeof result.feedback === 'string' ? result.feedback : '',
    correctedSentence: typeof result.corrected_sentence === 'string' ? result.corrected_sentence : '',
  };
}

function mapWordEnrichmentResult(raw: unknown): WordEnrichmentResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI 返回数据格式异常');
  }

  const result = raw as RawWordEnrichmentResult;
  const examples = Array.isArray(result.examples)
    ? result.examples.filter((item): item is string => typeof item === 'string')
    : [];

  const partOfSpeech =
    typeof result.part_of_speech === 'string'
      ? result.part_of_speech
      : typeof result.partOfSpeech === 'string'
        ? result.partOfSpeech
        : '';

  const definitionEn =
    typeof result.definition_en === 'string'
      ? result.definition_en
      : typeof result.definitionEn === 'string'
        ? result.definitionEn
        : '';

  const businessNote =
    typeof result.business_note === 'string'
      ? result.business_note
      : typeof result.businessNote === 'string'
        ? result.businessNote
        : '';

  return {
    word: typeof result.word === 'string' ? result.word : '',
    phonetic: typeof result.phonetic === 'string' ? result.phonetic : '',
    partOfSpeech,
    meaning: typeof result.meaning === 'string' ? result.meaning : '',
    definitionEn,
    businessNote,
    examples,
  };
}

export function toVocabEnrichmentPayload(result: WordEnrichmentResult): VocabEnrichmentPayload {
  return {
    word: result.word,
    phonetic: result.phonetic,
    partOfSpeech: result.partOfSpeech,
    meaning: result.meaning,
    definition_en: result.definitionEn,
    business_note: result.businessNote,
    examples: result.examples,
    source: '全局划线截获',
  };
}

// ── 基础请求封装 ─────────────────────────────────────────────
const DIFY_API_BASE_URL = import.meta.env.VITE_DIFY_API_BASE_URL || '/dify';
const DIFY_APP_ID = import.meta.env.VITE_DIFY_APP_ID || '56a4d2c1-006c-4c46-95cc-7b6bedafbcff';

function getDifyApiKey() {
  const key = import.meta.env.VITE_DIFY_API_KEY;
  if (!key) throw new Error('Missing VITE_DIFY_API_KEY');
  return key;
}

function parseMaybeJson<T>(raw: unknown, fallbackMessage: string): T {
  if (typeof raw !== 'string') {
    interceptOutputText(raw);
    return raw as T;
  }

  interceptOutputText(raw);
  const cleanJson = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleanJson) as T;
    interceptOutputText(parsed);
    return parsed;
  } catch {
    throw new Error(fallbackMessage);
  }
}

/** 从混杂文本中提取可 JSON.parse 的片段（```json 块或最外侧 {}） */
function extractJsonFromString(raw: unknown): string {
  const rawStr = String(raw ?? '').trim();
  const jsonBlockMatch = rawStr.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch?.[1]) {
    return jsonBlockMatch[1].trim();
  }
  const startIdx = rawStr.indexOf('{');
  const endIdx = rawStr.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return rawStr.substring(startIdx, endIdx + 1).trim();
  }
  return rawStr.replace(/```json/gi, '').replace(/```/g, '').trim();
}

const REQUEST_TIMEOUT_MS = 10_000;
const inflightGetRequests = new Map<string, Promise<unknown>>();

async function fetchWithTimeout(url: string, options: RequestInit | undefined, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const parentSignal = options?.signal;
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}

async function request<T>(path: string, apiKey: string, options?: RequestInit): Promise<T> {
  const method = String(options?.method || 'GET').toUpperCase();
  const url = `${DIFY_API_BASE_URL}${path}`;
  const init: RequestInit = {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    ...options,
  };

  const execute = async (): Promise<T> => {
    const res = await fetchWithTimeout(url, init, REQUEST_TIMEOUT_MS);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || data?.error || `Dify HTTP ${res.status}`);
    interceptOutputText(data);
    return data as T;
  };

  // 仅合并并发 GET；POST workflow 不去重，避免误吞用户主动重试
  if (method === 'GET' && !options?.body) {
    const key = `GET:${url}`;
    const existing = inflightGetRequests.get(key);
    if (existing) return existing as Promise<T>;
    const pending = execute().finally(() => inflightGetRequests.delete(key));
    inflightGetRequests.set(key, pending);
    return pending;
  }

  return execute();
}

// ── 原有听力工作流（保持不变）────────────────────────────────
export async function runListenWorkflow(inputs: ListenWorkflowInput, userId = getAppUserId()) {
  return request<DifyWorkflowResponse>(`/workflows/run`, getDifyApiKey(), {
    method: 'POST',
    body: JSON.stringify({ inputs: injectUserProfileAndTime(inputs as any), response_mode: 'blocking', user: userId }),
  });
}

export function getDifyAppId() { return DIFY_APP_ID; }

// ── 英语板块新增调用 ─────────────────────────────────────────

/**
 * 鏅鸿兘浣?锛氬瑙掕壊璺ㄦ枃鍖栬皥鍒ゆ矙鐩?(Chatflow)
 * 閫氳繃鍚庣浠ｇ悊璋冪敤锛岄伩鍏嶅墠绔毚闇?API Key
 */
export async function callOralSandbox(
  inputs: OralSandboxInput,
  conversationId?: string,
  userId = getAppUserId()
): Promise<{ reply: OralSandboxReply; conversationId: string }> {
  const res = await fetch('/api/english/oral-sandbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: injectUserProfileAndTime(inputs as any), conversationId, userId }),
  });
  if (!res.ok) throw new Error(`oral-sandbox HTTP ${res.status}`);
  const data = await res.json();
  interceptOutputText(data);
  return data;
}

/**
 * 鏅鸿兘浣?：政商务长文词汇提纯引擎 (Workflow)
 * 通过前端直接调用 Dify Workflow锛岄伩鍏嶉澶栧悗绔敼閫?
 */
export async function uploadMaterialToKB(file: File, topic: string): Promise<any> {
  const base64Content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64String = result.includes(',') ? result.split(',')[1] : result;
      if (!base64String) {
        reject(new Error('文件读取失败，未获得 Base64 内容'));
        return;
      }
      resolve(base64String);
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });

  const response = await fetch('/api/material/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      base64Content,
      topic,
      sourceName: file.name,
      userId: getAppUserId(),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.message || '上传至知识库失败');
  }
  return data;
}

async function fileToBase64Content(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64String = result.includes(',') ? result.split(',')[1] : result;
      if (!base64String) {
        reject(new Error('文件读取失败，未获得 Base64 内容'));
        return;
      }
      resolve(base64String);
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

export interface MaterialProcessResult {
  success: boolean;
  topic: string;
  total: number;
  words: string[];
  phrases: string[];
  article: string;
  /** 本地抽取原文（PDF/纯文本）；若缺失则 article 可能来自 Dify 分段回退 */
  originalText?: string;
  results: any[];
  logs: string[];
}

export async function processMaterialsAndExtract(files: File[], topic: string, userId = getAppUserId()): Promise<{ success: boolean; taskId: string }> {
  // 将前端 File 对象转为 Base64 传递给后端的统一提纯路由
  const filePayloads = await Promise.all(
    files.map(async (f) => {
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('前端文件读取失败'));
        reader.readAsDataURL(f);
      });
      return {
        fileName: f.name,
        content: base64Content
      };
    })
  );

  const response = await fetch('/api/material/process-and-extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files: filePayloads,
      topic,
      userId
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success || !data.taskId) {
    throw new Error(data?.error || data?.message || '无法发起异步提纯任务');
  }

  return data; // 返回 { success: true, taskId }
}

export interface DailyExtractResult {
  article?: string;
  success: boolean;
  message: string;
  quotaExceeded?: boolean;
  quota: {
    wordsLimit: number;
    wordsUsed: number;
    wordsLeft: number;
    phrasesLimit: number;
    phrasesUsed: number;
    phrasesLeft: number;
  };
  words: string[];
  phrases: string[];
  sentences?: string[];
  wordCount: number;
  phraseCount: number;
  sentenceCount?: number;
  wordsAddedCount: number;
  phrasesAddedCount: number;
}

export interface DailyQuotaStatus {
  success: boolean;
  quota: {
    wordsLimit: number;
    wordsUsed: number;
    wordsLeft: number;
    phrasesLimit: number;
    phrasesUsed: number;
    phrasesLeft: number;
  };
}

let activeQuotaPromise: Promise<DailyQuotaStatus> | null = null;

export async function getDailyQuotaStatus(userId = getAppUserId()): Promise<DailyQuotaStatus> {
  if (activeQuotaPromise) return activeQuotaPromise;

  activeQuotaPromise = (async () => {
    try {
      const response = await fetch(`/api/daily-quota/status?userId=${encodeURIComponent(userId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || '获取每日配额失败');
      return data as DailyQuotaStatus;
    } finally {
      activeQuotaPromise = null;
    }
  })();

  return activeQuotaPromise;
}

export async function getDailyExtractedArticle(
  userId = getAppUserId(),
  genre?: string,
  cefrLevel?: string,
  duration?: string,
  theme?: string,
): Promise<{
  found: boolean;
  data?: {
    article: string;
    words: string[];
    phrases: string[];
    sentences: string[];
    theme: string;
    genre: string;
    cefrLevel: string;
    duration?: string;
    updatedAt?: number;
  };
}> {
  let url = `/api/english/daily-extract/article?userId=${encodeURIComponent(userId)}`;
  if (genre) url += `&genre=${encodeURIComponent(genre)}`;
  if (cefrLevel) url += `&cefrLevel=${encodeURIComponent(cefrLevel)}`;
  if (duration) url += `&duration=${encodeURIComponent(duration)}`;
  if (theme) url += `&theme=${encodeURIComponent(theme)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || '获取每日长文数据失败');
  }
  return data;
}

export async function fetchExactArticleIfExists(params: {
  userId?: string;
  topic?: string;
  genre?: string;
  cefrLevel?: string;
  duration?: string;
}): Promise<{
  found: boolean;
  isRunning?: boolean;
  taskId?: string;
  data?: {
    article: string;
    words: any[];
    phrases: any[];
    sentences: any[];
    theme: string;
    genre: string;
    cefrLevel: string;
    duration: string;
    inputSignature?: string;
    updatedAt?: number;
  };
}> {
  const uid = params.userId || getAppUserId();
  const query = new URLSearchParams({
    userId: uid,
    genre: params.genre || 'meeting',
    cefrLevel: params.cefrLevel || 'B1',
    duration: params.duration || '25',
    topic: params.topic || ''
  });

  const response = await fetch(`/api/english/daily-extract/article/exact?${query.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  });
  const data = await response.json().catch(() => ({ found: false }));
  return data;
}


export async function triggerEnglishMasteryExtraction(
  topic: string,
  materialText = '',
  userId = getAppUserId(),
  cefrLevel: 'A2' | 'B1' | 'B2' | 'C1' = 'B1',
  genre: 'news' | 'meeting' | 'podcast' | 'reading' | 'email' | 'report' | 'negotiation' | 'presentation' = 'meeting',
  duration: '15' | '25' | '35' = '25'
): Promise<DailyExtractResult> {
  const response = await fetch("/api/english/daily-extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      materialText,
      userId,
      cefrLevel,
      genre,
      duration,
      user_current_profile: getUserCurrentProfile()
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    if (data?.quotaExceeded) {
      return data as DailyExtractResult;
    }
    throw new Error(data?.error || data?.message || '提取词汇操作失败，请检查后端状态');
  }

  // 如果没有输入材料，后端会直接返回配额数据而没有 taskId
  if (!data.taskId) {
    interceptOutputText(data);
    return data as DailyExtractResult;
  }

  const taskId = data.taskId;

  // 开始轮询 (每3秒一次)
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const statusRes = await fetch(`/api/english/daily-extract/status/${taskId}`);
    const statusData = await statusRes.json().catch(() => ({}));
    
    if (!statusRes.ok || !statusData.success) {
      throw new Error(statusData?.error || '状态轮询失败，请检查网络或后端服务');
    }

    if (statusData.status === 'completed') {
      interceptOutputText(statusData);
      return statusData as DailyExtractResult;
    } else if (statusData.status === 'failed') {
      throw new Error(statusData.error || '后台生成失败');
    }
    // status === 'pending' 则继续等待
  }
}

export async function callVocabPurify(
  inputs: VocabPurifyInput,
  userId = getAppUserId()
): Promise<VocabPurifyResult> {
  if (!VOCAB_PURIFY_DIRECT_API_KEY) {
    throw new Error('未配置 VITE_DIFY_VOCAB_API_KEY');
  }

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VOCAB_PURIFY_DIRECT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: injectUserProfileAndTime(inputs as any),
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `vocab-purify HTTP ${res.status}`);
  }

  const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
  return parseMaybeJson<VocabPurifyResult>(rawResult, 'AI 返回的词汇数据格式异常');
}

/**
 * 英语公文纵深批阅接口 (前端直接调用 Dify)
 * @param userText 用户写的原始英文草稿
 * @param mailIntent 行文意图
 * @param theme 全局阵地主题
 */
export async function runEnglishWriteReview(userText: string, mailIntent: string, theme: string): Promise<WritingReviewResult> {
  const profile = getUserCurrentProfile();
  const displayTheme = profile && !theme.includes("Weakness:") ? `${theme} (Weakness: ${profile})` : theme;

  const res = await fetch('/api/dify/write-review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_text: userText,
      mail_intent: mailIntent,
      theme: displayTheme,
      user_current_profile: profile
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || '后端批阅代理接口异常');
  }

  interceptOutputText(data);
  const reviewData = data.data;
  return {
    L1_Grammar: reviewData.L1 || reviewData.L1_Grammar || '',
    L2_Business_Tone: reviewData.L2 || reviewData.L2_Business_Tone || '',
    L3_Strategic_Position: reviewData.L3 || reviewData.L3_Strategic_Position || '',
    optimized_version: reviewData.optimized_version || ''
  };
}

/** 口语类 Chatflow 统一走后端代理（DIFY_ORAL_API_KEY 仅存服务端） */
async function proxyOralChatMessage(
  query: string,
  options: {
    conversationId?: string | null;
    userId?: string;
    inputs?: Record<string, unknown>;
  } = {},
): Promise<{ answer?: string; message?: string; conversation_id?: string }> {
  const res = await fetch('/api/english/oral/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      conversationId: options.conversationId ?? null,
      userId: options.userId ?? getAppUserId(),
      inputs: options.inputs ?? {},
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data.message || data.error || '口语 Chat API 请求失败'));
  }
  return data;
}

export async function sendOralChatMessage(
  query: string,
  conversationId: string | null = null,
  userId = getAppUserId(),
  oralContext?: OralChatContext
) {
  const profile = getUserCurrentProfile();

  const inputs = injectUserProfileAndTime({
    user_weakness_profile: profile || '',
    ...(oralContext?.scene_title ? { scene_title: oralContext.scene_title } : {}),
    ...(oralContext?.roles ? { roles: oralContext.roles } : {}),
    ...(oralContext?.cultural_context ? { cultural_context: oralContext.cultural_context } : {}),
    ...(oralContext?.conflicts ? { conflicts: oralContext.conflicts } : {}),
    ...(oralContext?.role_switch_instruction ? { role_switch_instruction: oralContext.role_switch_instruction } : {}),
    ...(oralContext?.scene_level ? { scene_level: String(oralContext.scene_level) } : {}),
    ...(oralContext?.role_judgement ? { role_judgement: oralContext.role_judgement } : {}),
    ...(oralContext?.intent_judgement ? { intent_judgement: oralContext.intent_judgement } : {}),
    ...(oralContext?.user_current_profile ? { user_current_profile: oralContext.user_current_profile } : {}),
    ...(oralContext?.User_Current_Profile && !oralContext?.user_current_profile
      ? { user_current_profile: oralContext.User_Current_Profile }
      : {}),
  });

  const data = await proxyOralChatMessage(query, { conversationId, userId, inputs });
  interceptOutputText(data);

  if (data.conversation_id) {
    localStorage.setItem('oral_conversation_context', JSON.stringify({
      last_conversation_id: data.conversation_id,
      last_round_at: Date.now(),
    }));
  }

  return data;
}

export interface BreakthroughSubmitResult {
  correct: boolean;
  feedback: string;
}

/** 破绽识别提交：走后端代理，调用 English_Oral_Sandbox Chatflow（DIFY_ORAL_API_KEY） */
export async function submitBreakthrough(
  messageId: string,
  type: 'logic' | 'fact' | 'intent',
  selectedText: string,
  context?: {
    conversationId?: string | null;
    flawPoint?: string;
    sceneTitle?: string;
  },
): Promise<BreakthroughSubmitResult> {
  try {
    const res = await fetch('/api/english/breakthrough/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId,
        type,
        selectedText,
        conversationId: context?.conversationId || null,
        flawPoint: context?.flawPoint || '',
        sceneTitle: context?.sceneTitle || '',
      }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fall through to client-side heuristic
  }

  const flaw = String(context?.flawPoint || '').toLowerCase();
  const selection = selectedText.toLowerCase();
  const typeKeywords: Record<'logic' | 'fact' | 'intent', string[]> = {
    logic: ['causal', 'fallacy', 'overgeneral', 'equivalence', 'logic', '因果', '以偏概全', '虚假'],
    fact: ['contradict', 'vague', 'data', 'fact', 'factual_vague', '矛盾', '模糊', '数据'],
    intent: ['evad', 'avoid', 'shift', 'intent', 'intent_evade', '避重', '推诿', '转移'],
  };

  const typeMatch = typeKeywords[type].some((kw) => flaw.includes(kw));
  const textOverlap = selection.length >= 3 && (
    flaw.includes(selection.slice(0, Math.min(20, selection.length)))
    || selection.split(/\s+/).some((w) => w.length > 4 && flaw.includes(w))
  );
  const correct = Boolean(flaw && flaw !== '未识别到破绽' && (typeMatch || textOverlap));

  return {
    correct,
    feedback: correct
      ? '已识别破绽类型，请用英语发起针对性提问。'
      : '标记与当前 AI 埋设的破绽不匹配，请重新划词或调整类型。',
  };
}

export async function runEnglishListenEngine(text: string, theme: string, userId = getAppUserId()): Promise<ListenEngineResult> {
  const apiKey = import.meta.env.VITE_DIFY_LISTEN_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_LISTEN_API_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: injectUserProfileAndTime({ listening_text: text, theme }),
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Dify Listen Engine Error');

  try {
    const rawResult = data.data.outputs.result;
    const cleanJson = String(rawResult).replace(/```json/g, '').replace(/```/g, '').trim();
    return mapListenEngineResult(JSON.parse(cleanJson));
  } catch (e) {
    console.error('[difyAPI] 解析听辨结果失败:', e);
    throw new Error('AI 返回数据格式异常');
  }
}

export async function runWordEnrichment(targetWord: string, theme: string, userId = getAppUserId()): Promise<WordEnrichmentResult> {
  const apiKey = import.meta.env.VITE_DIFY_ENRICH_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_ENRICH_API_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: injectUserProfileAndTime({ target_word: targetWord, theme }),
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Enrich Error');

  const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
  if (typeof rawResult !== 'string') {
    console.error('[difyAPI] 词汇补全原始返回不是字符串:', data);
    throw new Error('AI 格式异常');
  }

  try {
    const cleanJson = rawResult.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson) as Record<string, unknown>;

    return {
      word: typeof parsed.word === 'string' && parsed.word.trim() ? parsed.word : targetWord,
      phonetic: typeof parsed.phonetic === 'string' ? parsed.phonetic : '',
      partOfSpeech:
        typeof parsed.partOfSpeech === 'string'
          ? parsed.partOfSpeech
          : typeof parsed.part_of_speech === 'string'
            ? parsed.part_of_speech
            : '',
      meaning: typeof parsed.meaning === 'string' ? parsed.meaning : '',
      definitionEn:
        typeof parsed.definition_en === 'string'
          ? parsed.definition_en
          : typeof parsed.definitionEn === 'string'
            ? parsed.definitionEn
            : '',
      businessNote:
        typeof parsed.business_note === 'string'
          ? parsed.business_note
          : typeof parsed.businessNote === 'string'
            ? parsed.businessNote
            : '',
      examples: Array.isArray(parsed.examples)
        ? parsed.examples.filter((item): item is string => typeof item === 'string')
        : [],
    };
  } catch (e) {
    console.error('[difyAPI] 解析词汇补全失败:', e, data);
    throw new Error('AI 格式异常');
  }
}

export async function runEnglishWakeupRoutine(theme: string, userId = getAppUserId()): Promise<{
  theme: string;
  vocab: Array<{
    word: string;
    ipa: string;
    pronunciation_note: string;
    meaning_zh: string;
    example: string;
  }>;
  grammar: {
    point: string;
    explanation: string;
    examples: Array<{ correct: string; incorrect: string }>;
  };
}> {
  const apiKey = import.meta.env.VITE_DIFY_WAKEUP_API_KEY || import.meta.env.VITE_DIFY_WAKUP_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_WAKEUP_API_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: injectUserProfileAndTime({ theme }),
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Wakeup Engine Error');

  const raw = data?.data?.outputs?.wakeup_json ?? data?.data?.outputs?.result ?? data?.answer ?? data?.message ?? '';
  const clean = String(raw).replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(clean);
}

export async function runEnglishSentenceEvaluation(
  targetWord: string,
  userSentence: string,
  theme: string,
  userId = getAppUserId()
): Promise<SentenceEvaluationResult> {
  const apiKey = import.meta.env.VITE_DIFY_SENTENCE_API_KEY;

  if (!apiKey) {
    throw new Error('未配置造句 API 密钥，请检查 .env.local 并重新运行 build/dev');
  }

  let res: Response;
  try {
    res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: injectUserProfileAndTime({ target_word: targetWord, user_sentence: userSentence, theme }),
        response_mode: 'blocking',
        user: userId,
      }),
    });
  } catch (err) {
    console.error('[difyAPI] Fetch 通讯异常:', err);
    throw new Error('与 Dify 总部失去连接，请检查 HTTPS 接口是否可达');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('[difyAPI] Dify 拒绝请求:', data);
    throw new Error(data?.message || data?.error || 'Dify 响应成功但状态非 200');
  }

  try {
    const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
    const rawText = String(rawResult);
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('AI 未返回有效的花括号 JSON 结构');
    }

    return mapSentenceEvaluationResult(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error('[difyAPI] 脱水解析失败. 原始数据:', data?.data?.outputs?.result ?? data);
    throw new Error('AI 返回数据格式异常，解析 JSON 崩溃');
  }
}

export async function getDueVocabulary(userId = getAppUserId()) {
  const res = await fetch(`/api/vocab/review?userId=${encodeURIComponent(userId)}`);
  const data = await res.json().catch(() => ([]));
  if (!res.ok) throw new Error(data?.error || '获取待复习词条失败');
  return Array.isArray(data) ? data : [];
}

export function mapGenreToDify(genre: string): 'news' | 'meeting' | 'podcast' | 'reading' {
  const g = String(genre || '').toLowerCase();
  if (['news', 'podcast', 'meeting', 'reading'].includes(g)) {
    return g as any;
  }
  if (g === 'email' || g === 'report') return 'reading';
  if (g === 'negotiation' || g === 'presentation') return 'meeting';
  return 'meeting';
}

export async function runListenMaterialGenerator(
  theme: string,
  genre: string,
  cefrLevel: 'A2' | 'B1' | 'B2' | 'C1',
  duration: number | 'short' | 'long',
  userId = getAppUserId()
): Promise<any> {
  const durationParam = typeof duration === 'number' ? `${duration}分钟` : duration;
  const isLong = duration === 'long' || (typeof duration === 'number' && duration >= 5);
  const safeGenre = mapGenreToDify(genre);

  // ── 长音频（≥5 分钟）：走后端后台任务机制，立即返回 taskId ──
  if (isLong) {
    const res = await fetch('/api/listen/generate-material-long', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: injectUserProfileAndTime({ theme, cefr_level: cefrLevel, genre: safeGenre, duration: durationParam }),
        userId,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || `提交长文听力生成失败 (HTTP ${res.status})`);
    }

    if (data.taskId) {
      return { taskId: data.taskId };
    }

    // Fallback 兼容逻辑
    if (!data.answer) {
      throw new Error('后台没有返回任何听力材料数据，请检查 Dify 应用配置。');
    }

    return data.answer.trim();
  }

  // ── 短听力：已迁移为 Node.js 代理调用 ──
  const res = await fetch('/api/listen/generate-material', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: injectUserProfileAndTime({ theme, genre: safeGenre, cefr_level: cefrLevel, duration: durationParam }),
      userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || `生成听力材料失败 (HTTP ${res.status})`);
  }

  if (!data.answer) {
    throw new Error("后台没有返回任何听力材料数据，请检查 Dify 应用配置。");
  }

  return data.answer.trim();
}

export interface ImpromptuSpeechEvaluationResult {
  total_score: number;
  logic: number;
  vocabulary: number;
  fluency: number;
  relevance: number;
  feedback: string;
}

export async function runImpromptuSpeechEvaluation(
  theme: string,
  duration: string,
  transcript: string,
  userId = getAppUserId()
): Promise<ImpromptuSpeechEvaluationResult> {
  const apiKey = import.meta.env.VITE_DIFY_SPEECH_EVAL_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_SPEECH_EVAL_API_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: injectUserProfileAndTime({ 
        theme, 
        duration,
        transcript
      }),
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || '评测失败');

  try {
    const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
    const cleanJson = String(rawResult).replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as ImpromptuSpeechEvaluationResult;
  } catch (e) {
    console.error('[difyAPI] 解析即兴演讲评测结果失败:', e, data);
    throw new Error('AI 返回口语评估数据格式异常');
  }
}

// ── 文治系统 Governance 工作流接口 ──────────────────────────────────

/** 文治系统 task_type 枚举 */
export type WriteGovernanceTaskType = 'document_correction' | 'business_writing' | 'value_proposal';

/** 文治系统返回结果（按 task_type 映射不同字段） */
export interface WriteGovernanceResult {
  taskType: WriteGovernanceTaskType;
  /** task_type=document_correction 时返回 */
  level_1?: string;
  level_2?: string;
  level_3?: string;
  /** task_type=business_writing 时返回 */
  tone_evaluation?: string;
  compressed_text?: string;
  skill_point?: string;
  /** task_type=value_proposal 时返回 */
  admin_flaws?: string;
  value_extraction?: string;
  business_proposal?: string;
  /** 原始 JSON（用于解析 L3 分数） */
  rawJson?: string;
}

/** 调用文治系统 Governance Dify workflow */
export async function runWriteGovernanceReview(params: {
  taskType: WriteGovernanceTaskType;
  originalText: string;
  additionalParams?: string;
}): Promise<WriteGovernanceResult> {
  const apiKey = import.meta.env.VITE_DIFY_WRITE_GOVERNANCE_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_WRITE_GOVERNANCE_API_KEY');
  const userId = getAppUserId();

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: injectUserProfileAndTime({
        task_type: params.taskType,
        original_text: params.originalText,
        additional_params: params.additionalParams || '',
      }),
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || '文治系统调用失败');

  interceptOutputText(data);

  try {
    // 从 Dify workflow 输出中提取 analysis_result 字段
    const rawResult = data?.data?.outputs?.analysis_result ?? data?.answer ?? '';
    const cleanJson = extractJsonFromString(rawResult);

    const parsed = JSON.parse(cleanJson) as Record<string, unknown>;

    const result: WriteGovernanceResult = {
      taskType: params.taskType,
      rawJson: cleanJson,
    };

    if (params.taskType === 'document_correction') {
      result.level_1 = String(parsed.level_1 || '');
      result.level_2 = String(parsed.level_2 || '');
      result.level_3 = String(parsed.level_3 || '');
    } else if (params.taskType === 'business_writing') {
      result.tone_evaluation = String(parsed.tone_evaluation || '');
      result.compressed_text = String(parsed.compressed_text || '');
      result.skill_point = String(parsed.skill_point || '');
    } else if (params.taskType === 'value_proposal') {
      result.admin_flaws = String(parsed.admin_flaws || '');
      result.value_extraction = String(parsed.value_extraction || '');
      result.business_proposal = String(parsed.business_proposal || '');
    }

    return result;
  } catch (e) {
    console.error('[difyAPI] 解析文治系统结果失败:', e, data);
    throw new Error('文治系统返回数据格式异常');
  }
}

// ── 即兴演讲范文生成接口 ────────────────────────────────────────

export interface ImpromptuExemplarResult {
  exemplar_text: string;
  cultural_notes: string;
  key_phrases: string[];
}

export async function generateImpromptuExemplar(params: {
  topic: string;
  scenario?: string;
}): Promise<ImpromptuExemplarResult> {
  const apiKey = import.meta.env.VITE_DIFY_IMPROMPTU_PROMPTER_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_IMPROMPTU_PROMPTER_API_KEY');
  const userId = getAppUserId();

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: injectUserProfileAndTime({
        topic: params.topic,
        scenario: params.scenario || '',
      }),
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || '范文生成失败');

  interceptOutputText(data);

  try {
    const rawResult = data?.data?.outputs?.exemplar_text ?? data?.data?.outputs?.result ?? data?.answer ?? '';
    const cleanJson = String(rawResult).replace(/```json/g, '').replace(/```$/gm, '').trim();
    const parsed = JSON.parse(cleanJson) as Record<string, unknown>;

    return {
      exemplar_text: String(parsed.exemplar_text || parsed.exemplar || parsed.text || rawResult),
      cultural_notes: String(parsed.cultural_notes || parsed.cultural || ''),
      key_phrases: Array.isArray(parsed.key_phrases) ? parsed.key_phrases.map(String) : [],
    };
  } catch (e) {
    // 降级：直接返回原始文本
    const rawResult = data?.data?.outputs?.exemplar_text ?? data?.data?.outputs?.result ?? data?.answer ?? '';
    return {
      exemplar_text: String(rawResult),
      cultural_notes: '',
      key_phrases: [],
    };
  }
}

// ── 发音纠正相关接口 ─────────────────────────────────────────

/** Dify audio-to-text 接口返回结果 */
export interface AudioToTextResult {
  text: string;
  task_id?: string;
}

/**
 * 步骤1: 调用 Dify audio-to-text 接口将音频转为英文文本
 * @param audioFile 录音文件 (Blob/File)
 * @param userId 用户ID
 * @returns 识别出的英文文本
 */
export async function audioToText(audioFile: Blob, userId = getAppUserId()): Promise<AudioToTextResult> {
  const apiKey = import.meta.env.VITE_DIFY_STT_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_STT_API_KEY');

  const formData = new FormData();
  formData.append('file', audioFile, 'audio.wav');
  formData.append('user', userId);

  const res = await fetch(`${DIFY_API_BASE_URL}/audio-to-text`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`语音识别失败 (${res.status}): ${errText}`);
  }

  const data = await res.json().catch(() => ({}));
  return {
    text: typeof data.text === 'string' ? data.text.trim() : '',
    task_id: data.task_id,
  };
}

/** 发音纠正结果 - 缁撴瀯鍖栨牸寮?*/
export interface PronunciationAssessmentResult {
  score: number;
  phonetic?: string;
  issueType?: string;
  analysis?: string;
  suggestion?: string;
  correctionNote?: string;
  corrections?: string[];
  target_text: string;
  recognized_text: string;
}

/**
 * 步骤2: 调用发音纠正工作流
 * @param targetText 用户输入的目标单词/句子
 * @param recognizedText 语音识别返回的文本
 * @param userId 用户ID
 * @returns 发音纠正结果
 */
export async function runPronunciationAssessment(
  targetText: string,
  recognizedText: string,
  userId = getAppUserId()
): Promise<PronunciationAssessmentResult> {
  // 通过后端代理调用 Dify 发音纠正工作流
  const res = await fetch(`/api/pronunciation-assessment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetText,
      recognizedText,
      userId,
      user_current_profile: getUserCurrentProfile(),
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`发音纠正请求失败 (${res.status}): ${errText}`);
  }

  const data = await res.json().catch(() => ({}));
  
  try {
    const rawResult = data?.data?.outputs?.result 
      ?? data?.data?.outputs 
      ?? data?.answer 
      ?? data?.message 
      ?? data;
    
    // 尝试提取 JSON
    const rawText = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: typeof parsed.score === 'number' ? parsed.score : (typeof parsed.total_score === 'number' ? parsed.total_score : 0),
        analysis: typeof parsed.analysis === 'string' ? parsed.analysis : (typeof parsed.feedback === 'string' ? parsed.feedback : (typeof parsed.evaluation === 'string' ? parsed.evaluation : '')),
        suggestion: typeof parsed.suggestion === 'string' ? parsed.suggestion : '',
        corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
        target_text: targetText,
        recognized_text: recognizedText,
      };
    }
    
    // 如果没有 JSON 结构，返回原始结果
    return {
      score: 0,
      analysis: rawText || '无法解析评测结果',
      corrections: [],
      target_text: targetText,
      recognized_text: recognizedText,
    };
  } catch (e) {
    console.error('[difyAPI] 解析发音纠正结果失败:', e, data);
    throw new Error('发音纠正结果解析失败');
  }
}

// ── 即兴演讲增强功能 ─────────────────────────────────────────

/** 即兴演讲提示词生成结果 */
export interface SpeechPrompterResult {
  outline: {
    opening: string;
    main_points: string[];
    closing: string;
  };
  key_arguments: Array<{
    point: string;
    evidence: string;
    transition: string;
  }>;
  useful_phrases: {
    openings: string[];
    transitions: string[];
    emphasizing: string[];
    conclusions: string[];
  };
  mindmap: {
    center: string;
    branches: Array<{ title: string; keywords: string[] }>;
  };
  tips: string[];
}

/**
 * 获取即兴演讲主题提示词
 * @param theme 演讲主题
 * @param difficulty 难度级别：基础/中等/进阶
 */
export async function runSpeechPrompter(
  theme: string,
  difficulty: '基础' | '中等' | '进阶' = '中等',
  userId = getAppUserId()
): Promise<SpeechPrompterResult> {
  const apiKey = import.meta.env.VITE_DIFY_SPEECH_PROMPTER_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_SPEECH_PROMPTER_API_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: injectUserProfileAndTime({ theme, difficulty }),
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || '生成战略破冰失败');

  try {
    const outputs = data?.data?.outputs;

    // 黄金路径：Dify 直接返回了结构化的 JSON 对象（无需再解析字符串）
    if (outputs && typeof outputs === 'object' && outputs.outline && outputs.tips) {
      return outputs as SpeechPrompterResult;
    }

    // 兜底路径：如果 Dify 把内容包在了某个变量里的字符串中
    const rawResult = outputs?.result ?? outputs?.text ?? data?.answer ?? '';
    const rawText = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
    
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as SpeechPrompterResult;
    }
    
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as SpeechPrompterResult;
  } catch (e) {
    console.error('[difyAPI] 解析提示词结果失败:', e, data);
    throw new Error('AI 建议返回数据格式异常');
  }
}

/** 即兴演讲增强评测结果 */
export interface EnhancedSpeechEvalResult {
  total_score: number;
  logic: number;
  vocabulary: number;
  fluency: number;
  relevance: number;
  structure: number;
  feedback: string;
  improvement_suggestions: string[];
  audio_features: {
    estimated_pace: string;
    estimated_clarity: string;
    estimated_confidence: string;
  };
}

/**
 * 即兴演讲增强评测（支持音频上传）
 * @param theme 演讲主题
 * @param durationMinutes 时长（分钟）
 * @param audioFile 音频文件
 */
export async function runEnhancedSpeechEvaluation(
  theme: string,
  durationMinutes: string,
  audioFile: File | Blob,
  userId = getAppUserId()
): Promise<EnhancedSpeechEvalResult> {
  const apiKey = import.meta.env.VITE_DIFY_SPEECH_EVAL_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_SPEECH_EVAL_API_KEY');

  const formData = new FormData();
  formData.append('file', audioFile, 'speech_audio.webm');
  formData.append('user', userId);
  formData.append('inputs', JSON.stringify(injectUserProfileAndTime({ theme, duration_minutes: durationMinutes })));
  formData.append('response_mode', 'blocking');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || '增强评测失败');

  try {
    const outputs = data?.data?.outputs ?? {};
    return {
      total_score: Number(outputs.total_score || 0),
      logic: Number(outputs.logic || 0),
      vocabulary: Number(outputs.vocabulary || 0),
      fluency: Number(outputs.fluency || 0),
      relevance: Number(outputs.relevance || 0),
      structure: Number(outputs.structure || 0),
      feedback: String(outputs.feedback || ''),
      improvement_suggestions: Array.isArray(outputs.improvement_suggestions) ? outputs.improvement_suggestions : [],
      audio_features: outputs.audio_features || {
        estimated_pace: 'moderate',
        estimated_clarity: 'good',
        estimated_confidence: 'high',
      },
    };
  } catch (e) {
    console.error('[difyAPI] 解析增强评测结果失败:', e, data);
    throw new Error('增强评测结果解析失败');
  }
}

// ── 洞察(听) 人性解码与破绽识别 ─────────────────────────────────────────

export interface InsightListenInputs {
  scenario_text: string;
  user_analysis: string;
}

export async function fetchInsightFeedback(inputs: InsightListenInputs, userId = getAppUserId()): Promise<string> {
  const apiKey = import.meta.env.VITE_DIFY_INSIGHT_LISTEN_KEY;
  if (!apiKey) throw new Error("未配置 VITE_DIFY_INSIGHT_LISTEN_KEY");

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: injectUserProfileAndTime(inputs as any),
      response_mode: "blocking",
      user: userId
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);

  const rawResult = data?.data?.outputs?.ai_feedback ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? "未获取到有效反馈";
  return String(rawResult);
}

/**
 * 动态获取洞察考题 (文本生成应用)
 * 依赖环境变量: VITE_DIFY_INSIGHT_GEN_KEY
 */
export async function fetchDynamicInsightScenario(category: string, userId = getAppUserId()): Promise<string> {
  const apiKey = import.meta.env.VITE_DIFY_INSIGHT_GEN_KEY;
  if (!apiKey) {
    throw new Error("未配置 VITE_DIFY_INSIGHT_GEN_KEY，无法调用 Dify 战略评估接口。");
  }

  const res = await fetch(`${DIFY_API_BASE_URL}/completion-messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: injectUserProfileAndTime({ category }),
      query: "", // 触发文本生成
      response_mode: 'blocking',
      user: userId
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `获取动态考题失败 HTTP ${res.status}`);

  return String(data?.answer || "").trim();
}

// ── 破局系统（说）相关接口 ─────────────────────────────────────────

export interface SpeakInfluenceInput {
  training_mode: string;
  scenario: string;
  user_role: string;
  target_audience: string;
  user_input: string;
}

export interface SpeakInfluenceResult {
  score: number;
  critique: string;
  framework_analysis: string;
  revised_version: string;
}

export async function runSpeakInfluenceEngine(inputs: SpeakInfluenceInput, userId = getAppUserId()): Promise<SpeakInfluenceResult> {
  const apiKey = import.meta.env.VITE_DIFY_SPEAK_INFLUENCE_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_SPEAK_INFLUENCE_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: injectUserProfileAndTime(inputs as any),
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Speak Influence Engine 请求失败');

  const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
  try {
    const cleanJson = String(rawResult).replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as SpeakInfluenceResult;
  } catch (e) {
    console.error('[difyAPI] 解析教练返回的 JSON 格式失败:', e, rawResult);
    throw new Error('AI 主题判定失败，返回的不是有效 JSON');
  }
}

// ── 穿透系统（读）相关接口 ─────────────────────────────────────────

export interface CognitivePenetrationInput {
  scene_type: 'policy' | 'report' | 'email' | 'book';
  text_input: string;
}

export interface CognitivePenetrationResult {
  // policy
  surface_conclusion?: string;
  hidden_intent?: string;
  industry_impact?: string;
  risks_and_opportunities?: string;

  // report
  business_model?: string;
  market_pain_points?: string;
  profit_logic_flaws?: string;
  traceability_training?: string;

  // email
  stripped_logic?: string;
  stance_reversal?: string;
  counter_questions?: string;

  // book
  thought_highlights?: string;
  logic_flaws?: string;
  workplace_application?: string;
}

export async function runCognitivePenetrationEngine(inputs: CognitivePenetrationInput, userId = getAppUserId()): Promise<CognitivePenetrationResult> {
  const apiKey = import.meta.env.VITE_DIFY_READ_PENETRATION_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_READ_PENETRATION_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: injectUserProfileAndTime(inputs as any),
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Cognitive Penetration Engine 请求失败');

  const rawResult = data?.data?.outputs?.analysis_result ?? data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
  try {
    // 健壮提取：优先 ```json 块，否则按最外侧 {} 切除杂质后再 parse
    return JSON.parse(extractJsonFromString(rawResult)) as CognitivePenetrationResult;
  } catch (e) {
    console.error('[difyAPI] 解析认知穿透结果的 JSON 格式失败:', e, rawResult);
    throw new Error('AI 穿透解码失败，返回的不是有效 JSON');
  }
}

// ── 驭心博弈系统（Game Theory）相关接口 ─────────────────────────────────────────

export interface GameTheoryAnalyzeInput {
  scene_type: 'gov_struggle' | 'corp_clash' | 'upward_takeover';
  game_model: 'prisoner_dilemma' | 'pig_game' | 'info_asymmetry' | 'cold_trigger';
  case_text: string;
  user_answer: string;
  applied_tactics?: string;
}

export interface GameTheoryPrototypeArchive {
  name: string;
  type: string;
  description: string;
}

export interface GameTheoryAnalyzeResult {
  is_success: boolean;
  score: number;
  stakeholder_interests: string;
  motives_analysis: string;
  weaknesses: string;
  causal_chain: string[];
  prototype_archive: GameTheoryPrototypeArchive;
  suggestion: string;
}

export interface PersonalPrototype {
  id: string;
  user_id: string;
  name: string;
  type: string;
  description: string;
  added_at: number;
}

// 运行博弈引擎分析（异步：立即返回 taskId，结果写入对局历史）
export async function runGameTheoryAnalysis(
  inputs: GameTheoryAnalyzeInput & {
    source_type?: 'case_analysis' | 'simulation';
    title?: string;
  },
  userId = getAppUserId()
): Promise<{ taskId: string; status: string }> {
  const res = await fetch('/api/game-theory/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...inputs,
      user_current_profile: getUserCurrentProfile(),
      userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.message || '博弈分析引擎请求失败');
  }
  if (!data.taskId) {
    throw new Error('未返回任务 ID');
  }
  return { taskId: data.taskId as string, status: data.status as string };
}

export interface GameTheoryHistoryItem {
  id: string;
  user_id: string;
  source_type: 'case_analysis' | 'simulation' | string;
  title: string;
  scene_type: string;
  game_model: string;
  score: number;
  is_success: boolean;
  suggestion: string;
  causal_chain: string[];
  created_at: number;
  full_result?: GameTheoryAnalyzeResult | null;
}

export async function getGameTheoryHistory(userId = getAppUserId()): Promise<GameTheoryHistoryItem[]> {
  const res = await fetch(`/api/game-theory/history?userId=${encodeURIComponent(userId)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data?.error || '获取对局历史失败');
  }
  return (data.items || []) as GameTheoryHistoryItem[];
}

export async function getGameTheoryHistoryDetail(
  id: string
): Promise<GameTheoryHistoryItem> {
  const res = await fetch(`/api/game-theory/history/${encodeURIComponent(id)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data?.error || '获取对局历史详情失败');
  }
  return data.item as GameTheoryHistoryItem;
}

export interface CognitiveAscensionInput {
  event_text: string;            // 待推演的管理事件
  layers: { level: number; why: string }[]; // 用户的 5 层 Why 推演
  dimension: 'history' | 'structure' | 'self'; // 穿透维度
}

export interface CognitiveAscensionResult {
  is_passed: boolean;            // 是否达标解锁
  depth_score: number;           // 纵深度评分 0-10
  layer_feedback: { level: number; verdict: string; gap: string }[]; // 逐层研判
  ultimate_law: string;          // AI 提炼的终极规律
  suggestion: string;            // 升维建议
}

export async function runCognitiveAscension(
  inputs: CognitiveAscensionInput,
  userId = getAppUserId()
): Promise<CognitiveAscensionResult> {
  const res = await fetch('/api/game-theory/ascension', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...inputs,
      user_current_profile: getUserCurrentProfile(),
      userId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || '升维推演引擎请求失败，请检查后端');
  if (!data?.result) throw new Error(data?.error || '升维研判结果为空，请稍后重试');
  return data.result as CognitiveAscensionResult;
}

// 获取所有人性原型档案
export async function getPersonalPrototypes(userId = getAppUserId()): Promise<PersonalPrototype[]> {
  const res = await fetch(`/api/game-theory/prototypes?userId=${encodeURIComponent(userId)}`);
  const data = await res.json().catch(() => ([]));
  if (!res.ok) {
    throw new Error(data?.error || '随机生词提取失败，请检查后端');
  }
  return data as PersonalPrototype[];
}

// 手动添加或更新人性原型档案
export async function upsertPersonalPrototype(
  params: { name: string; type: string; description: string; userId?: string }
): Promise<{ success: boolean; id: string; status: string }> {
  const res = await fetch('/api/game-theory/prototypes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...params,
      userId: params.userId ?? getAppUserId(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || '配额状态获取失败，请检查后端');
  }
  return data;
}

// 删除人性原型档案
export async function deletePersonalPrototype(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/game-theory/prototypes/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || '强制拦截校验失败，请检查后端');
  }
  return data;
}

const FLAW_SUB_THEMES = [
  'evasive arguments and diversion tactics',
  'unsubstantiated claims and lack of evidence',
  'hidden assumptions and false premises',
  'contradictory statements and double standards',
  'circular reasoning and logical leaps',
  'cognitive biases and subjective framing',
  'exaggerations and fact distortion',
  'shifting the burden of proof and defensive responses',
  'ambiguous definitions and play on words',
  'false dilemmas and oversimplification'
];

// 每日专属破绽词汇动态生成（调用 Dify 唤醒工作流）
export async function generateDailyFlawVocabulary(
  excludeWords: string[] = [],
  userId = getAppUserId()
): Promise<Array<{
  word: string;
  ipa: string;
  pronunciation_note: string;
  meaning_zh: string;
  example: string;
}>> {
  const apiKey = import.meta.env.VITE_DIFY_WAKEUP_API_KEY || import.meta.env.VITE_DIFY_WAKUP_API_KEY;
  if (!apiKey) {
    console.warn('[difyAPI] VITE_DIFY_WAKEUP_API_KEY not configured, using local fallback vocab.');
    return getFallbackFlawVocab();
  }

  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const randomSalt = Math.floor(Math.random() * 10000);
    const randomFocus = FLAW_SUB_THEMES[Math.floor(Math.random() * FLAW_SUB_THEMES.length)];
    const dynamicTheme = `identifying logical flaws and business counterattack (Focus: ${randomFocus}, Date: ${todayStr}, Salt: ${randomSalt})`;
    const historyExclude = excludeWords.join(', ');

    const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: injectUserProfileAndTime({ 
          theme: dynamicTheme,
          history_exclude: historyExclude
        }),
        response_mode: 'blocking',
        user: userId,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Dify 异常时静默使用本地 fallback，避免控制台红屏
      return getFallbackFlawVocab();
    }

    const raw = data?.data?.outputs?.wakeup_json ?? data?.data?.outputs?.result ?? data?.answer ?? data?.message ?? '';
    const clean = String(raw).replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    return parsed.vocab || getFallbackFlawVocab();
  } catch (e) {
    // 请求/解析失败时静默使用本地 fallback，避免控制台红屏
    return getFallbackFlawVocab();
  }
}

export function getFallbackFlawVocab(): Array<{
  word: string;
  ipa: string;
  pronunciation_note: string;
  meaning_zh: string;
  example: string;
}> {
  return [
    {
      word: "fallacy",
      ipa: "/ˈfæləsi/",
      pronunciation_note: "商务谈判中用于指出对方的逻辑漏洞。重音在第一音节。",
      meaning_zh: "谬误；谬论；虚妄的信念",
      example: "We must identify the logical fallacy in their pricing argument before making a counter-offer."
    },
    {
      word: "counterproductive",
      ipa: "/ˌkaʊntərprəˈdʌktɪv/",
      pronunciation_note: "常用于指出对方提案的潜在弊端。重音在后半部分的 duct。",
      meaning_zh: "适得其反的；不起作用的",
      example: "Hasty price cuts might prove counterproductive to our long-term brand equity."
    },
    {
      word: "plausible",
      ipa: "/ˈplɔːzəbl/",
      pronunciation_note: "注意中间时的 s 发 /z/ 音。指表面听起来合理但实际经不起推敲的辩解。",
      meaning_zh: "貌似可信的；花言羊语的；貌似合理的",
      example: "Their excuse for the delivery delay sounds plausible, but we need concrete evidence."
    },
    {
      word: "bait-and-switch",
      ipa: "/ˌbeɪt ən ˈswɪtʃ/",
      pronunciation_note: "连读为 bait-an-switch。常用于商业谈判中指责对方临时变卦的套路。",
      meaning_zh: "诱客买贵货的把戏；挂羊头卖狗肉；套路行为",
      example: "The supplier's sudden price increase after the initial low quote felt like a bait-and-switch."
    },
    {
      word: "red herring",
      ipa: "/ˌred ˈherɪŋ/",
      pronunciation_note: "红鲱鱼，隐喻转移视线的话题。注意 red 与 herring 的连读。",
      meaning_zh: "转移注意力的话题；障眼法；红鲱鱼",
      example: "Bringing up minor administrative delays is just a red herring to distract us from the core issue."
    },
    {
      word: "preemptive",
      ipa: "/priːˈemptɪv/",
      pronunciation_note: "中间双元音/元音过渡要清晰。指先发制人的预防性手段。",
      meaning_zh: "先发制人的；防患于未然的",
      example: "We launched a preemptive marketing campaign to neutralize the competitor's upcoming product release."
    },
    {
      word: "cognitive bias",
      ipa: "/ˈkɒɡnətɪv ˈbaɪəs/",
      pronunciation_note: "cognitive 中的 g 要轻发音，bias 重音在第一音节。常指思维定势或认知偏差。",
      meaning_zh: "认知偏差；认知偏见",
      example: "Confirmation bias is a common cognitive bias where people only listen to information that agrees with them."
    },
    {
      word: "circular reasoning",
      ipa: "/ˈsɜːkjələ ˈriːzənɪŋ/",
      pronunciation_note: "circular 词尾的 r 在英音中不发音。指循环论证 of 逻辑漏洞。",
      meaning_zh: "循环论证",
      example: "Saying we should trust them because they are trustworthy is just circular reasoning."
    },
    {
      word: "straw man",
      ipa: "/ˈstrɔː mæn/",
      pronunciation_note: "稻草人。指故意歪曲对方观点以便于攻击的论证谬误。",
      meaning_zh: "稻草人谬误；歪曲论点",
      example: "You are attacking a straw man; I never suggested that we should stop marketing altogether."
    },
    {
      word: "slippery slope",
      ipa: "/ˌslɪpəri ˈsləʊp/",
      pronunciation_note: "slope 发 /sləʊp/，不要发成 /slɒp/。比喻滑坡谬误，即无根据地推导极端后果。",
      meaning_zh: "滑坡谬误；灾难性的第一步",
      example: "Claiming that a small budget cut will lead to immediate bankruptcy is a slippery slope argument."
    },
    {
      word: "confirmation bias",
      ipa: "/ˌkɒnfəˈmeɪʃn ˈbaɪəs/",
      pronunciation_note: "confirmation 重音在 mation 上。指选择性相信符合自己预期信息的倾向。",
      meaning_zh: "确认偏误；确认偏差",
      example: "Relying only on positive customer surveys and ignoring complaints is classic confirmation bias."
    },
    {
      word: "post hoc",
      ipa: "/ˌpəʊst ˈhɒk/",
      pronunciation_note: "拉丁语借词。指因果混淆，错误地认为先发生的事情就是原因。",
      meaning_zh: "后此谬误；因果混淆",
      example: "Assuming the sales increase was purely due to the new logo is a post hoc fallacy."
    },
    {
      word: "ad hominem",
      ipa: "/ˌæd ˈhɒmɪnem/",
      pronunciation_note: "拉丁语借词。指对人不对事的攻击（人身攻击）。",
      meaning_zh: "人身攻击；诉诸人身的",
      example: "Instead of addressing the security flaw, they made an ad hominem attack on the researcher's credentials."
    },
    {
      word: "false dilemma",
      ipa: "/ˌfɔːls dɪˈlemə/",
      pronunciation_note: "dilemma 的重音在 lem 上。指非黑即白、强行二选一的谬误。",
      meaning_zh: "虚假两难；非黑即白谬误",
      example: "Presenting the issue as either cutting quality or going out of business is a false dilemma."
    },
    {
      word: "overgeneralization",
      ipa: "/ˌəʊvədʒenrəlaɪˈzeɪʃn/",
      pronunciation_note: "重音在末尾的 zation 上。指以偏概全，过度概括。",
      meaning_zh: "过度概括；以偏概全",
      example: "Saying all local suppliers are unreliable based on one bad experience is an overgeneralization."
    },
    {
      word: "equivocation",
      ipa: "/ɪˌkwɪvəˈkeɪʃn/",
      pronunciation_note: "重音在 ca 上。指故意使用模棱两可的双关语或词汇来误导。",
      meaning_zh: "模棱两可的话；含糊其辞",
      example: "The contract's use of the word 'temporary' was a deliberate equivocation."
    },
    {
      word: "non sequitur",
      ipa: "/ˌnɒn ˈsekwɪtə/",
      pronunciation_note: "拉丁语借词，意为‘不相干的推论’。注意 sequitur 的发音。",
      meaning_zh: "不相干的推论；答非所问",
      example: "We have the best office design, so our profit will double next month—that is a complete non sequitur."
    },
    {
      word: "hasty generalization",
      ipa: "/ˈheɪsti ˌdʒenrəlaɪˈzeɪʃn/",
      pronunciation_note: "hasty 的元音是 /eɪ/。指在样本不足的情况下草率得出结论。",
      meaning_zh: "轻率概括；草率下结论",
      example: "Testing the software with only two users before launch would lead to a hasty generalization."
    },
    {
      word: "cherry-picking",
      ipa: "/ˈtʃeri ˈpɪkɪŋ/",
      pronunciation_note: "意为挑樱桃。指只挑选对自己有利的数据或事实而忽略反向证据。",
      meaning_zh: "选择性挑选；挑精拣肥",
      example: "Presenting only the successful trial results while hiding the failures is cherry-picking."
    },
    {
      word: "sunk cost fallacy",
      ipa: "/ˈsʌŋk kɒst ˈfæləsi/",
      pronunciation_note: "sunk cost 意为沉没成本。指因为前期已投入而继续坚持错误决定的倾向。",
      meaning_zh: "沉没成本谬误",
      example: "Investing more money in the failing project just because we spent millions already is a sunk cost fallacy."
    },
    {
      word: "begging the question",
      ipa: "/ˈbeɡɪŋ ðə ˈkwestʃən/",
      pronunciation_note: "本意指把尚未证明的假设当作前提（同义反复/设问谬误）。",
      meaning_zh: "顺理成章的假定；设问谬误；循环论证",
      example: "Assuming that our product is superior because it is better than others is begging the question."
    },
    {
      word: "double standard",
      ipa: "/ˈdʌbl ˈstændəd/",
      pronunciation_note: "注意 standard 的尾音不要发成 /dɑːd/。指对不同的人或事采取不同的标准。",
      meaning_zh: "双重标准",
      example: "Allowing one team to submit late work while penalizing another is a clear double standard."
    },
    {
      word: "appeal to authority",
      ipa: "/əˈpiːl tu ˈɔːθɒrəti/",
      pronunciation_note: "authority 的 th 发音为无声 /θ/。指盲目诉诸并不对口的‘权威’来佐证观点。",
      meaning_zh: "诉诸权威",
      example: "Using a famous actor's opinion to support a complex financial decision is an appeal to authority."
    },
    {
      word: "moving the goalposts",
      ipa: "/ˈmuːvɪŋ ðə ˈɡəʊlpəʊsts/",
      pronunciation_note: "比喻在比赛或谈判中临时改变规则或合格判定标准。",
      meaning_zh: "改变标准；临时改变要求；移动球门",
      example: "Every time we meet their targets, they increase the requirements—they keep moving the goalposts."
    },
    {
      word: "anecdotal evidence",
      ipa: "/ˌænɪkˈdəʊtl ˈevɪdəns/",
      pronunciation_note: "anecdotal 重音在 do 上。指缺乏统计意义的个人传言或个案证据。",
      meaning_zh: "专断证言；个案传言；轶事证据",
      example: "Your friend's bad experience with the device is just anecdotal evidence; mass data says otherwise."
    },
    {
      word: "false equivalence",
      ipa: "/ˌfɔːls ɪˈkwɪvələns/",
      pronunciation_note: "equivalence 的重音在 qui 上。指将两个完全不同性质的事物强行等同。",
      meaning_zh: "虚假等同；混淆视听",
      example: "Comparing a minor typo to database corruption is a false equivalence."
    },
    {
      word: "survivorship bias",
      ipa: "/səˈvaɪvəʃɪp ˈbaɪəs/",
      pronunciation_note: "survivorship 重音在 vi 上。指只关注成功者而忽略大量失败者的偏差。",
      meaning_zh: "幸存者偏差",
      example: "Studying only successful startups to draft a business strategy is a classic survivorship bias."
    },
    {
      word: "framing effect",
      ipa: "/ˈfreɪmɪŋ ɪˈfekt/",
      pronunciation_note: "framing 意为框架。指人们因信息表达方式（框架）不同而做出不同决策的效应。",
      meaning_zh: "框架效应",
      example: "Describing the meat as 80% lean instead of 20% fat leverages the framing effect."
    },
    {
      word: "anchoring effect",
      ipa: "/ˈæŋkərɪŋ ɪˈfekt/",
      pronunciation_note: "anchoring 重音在第一音节。指人类在决策时过度依赖第一笔信息（锚点）的效应。",
      meaning_zh: "锚定效应",
      example: "The high initial price set by the seller created an anchoring effect for the negotiation."
    },
    {
      word: "halo effect",
      ipa: "/ˈheɪləʊ ɪˈfekt/",
      pronunciation_note: "halo发音为 /ˈheɪləʊ/。指因某人或某物单一方面优秀而推断其整体都优秀的效应。",
      meaning_zh: "光环效应；晕轮效应",
      example: "Because the founder is a great speaker, investors assumed the product was perfect—a clear halo effect."
    }
  ];
}


export async function clearTodayQuotaAndData(userId = getAppUserId()): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/english/clear-today', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.message || '清空今日配额与生词数据失败，请检查后端');
  }
  return data;
}

/**
 * 高精度语音转文字 (Whisper) 接口
 */
export async function transcribeAudioWithWhisper(audioBlob: Blob, userId = getAppUserId()): Promise<string> {
  const formData = new FormData();
  // Whisper-1 接口强制要求传递 file 字段，格式这里转换为 mp3 规范以保障兼容性
  formData.append('file', audioBlob, 'audio.mp3');
  // 由后端中转接口轮询确定具体的模型与参数，这里仅作为原始文件流上传

  const res = await fetch('/api/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer sk-899c9c34738f61b5-2u53op-6ed8a313',
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Whisper 语音转文字失败 (${res.status}): ${errText}`);
  }

  const data = await res.json().catch(() => ({}));
  return typeof data.text === 'string' ? data.text.trim() : '';
}

/**
 * 即兴演讲范文生成接口
 */
export async function runSpeechExemplar(
  theme: string,
  userTranscript: string,
  userId = getAppUserId()
): Promise<string> {
  const apiKey = import.meta.env.VITE_DIFY_SPEECH_EXEMPLAR_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_SPEECH_EXEMPLAR_API_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: injectUserProfileAndTime({ 
        theme, 
        user_transcript: userTranscript
      }),
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || '生成范文失败');

  try {
    const rawResult = data?.data?.outputs?.exemplar_text ?? data?.answer ?? '';
    return String(rawResult).trim();
  } catch (e) {
    console.error('[difyAPI] 解析即兴演讲范文失败:', e, data);
    throw new Error('AI 返回演讲范文格式异常');
  }
}

// ── 穿透系统新增扩展接口 ─────────────────────────────────────────

/**
 * 1. 动态生成符合当前场景框架和板块的训练材料
 * 使用 Dify Chat API 的 API Key 产生灵活的定制文本
 */
export async function generateReadMaterial(
  scene_type: 'policy' | 'report' | 'email' | 'book',
  scene_framework: 'social' | 'gov' | 'corp',
  userId = getAppUserId()
): Promise<string> {
  const frameworkName = {
    social: '通用社交',
    gov: '体制内职场',
    corp: '跨国企业'
  }[scene_framework];

  const typeName = {
    policy: '宏观政策精神/地方监管文件',
    report: '商业案例与出海财报摘要',
    email: '外企邮件/西式职场函件',
    book: '经典课外书或高阶认知随笔'
  }[scene_type];

  const query = `你是一个顶级商务与政策教官。请为我动态生成一篇用于高管穿透训练的【${typeName}】原始文本。
场景框架要求限制在：【${frameworkName}】。
内容必须专业、硬核、贴近真实商业利益博弈（比如包含具体的部门拉扯、财报数据隐性漏洞或政策潜台词）。
字数在 150-300 字之间。不要任何前言、不要任何“好的，这是为您生成的材料”等废话，直接输出材料正文。`;

  const data = await proxyOralChatMessage(query, {
    userId,
    inputs: injectUserProfileAndTime({}),
  });
  return String(data.answer || '').trim();
}

/**
 * 2. 专属 AI 交互区：对已经分析出的结果进行追问和漏洞审计
 */
export interface ReadInteractiveChatInput {
  scene_type: 'policy' | 'report' | 'email' | 'book';
  scene_framework: 'social' | 'gov' | 'corp';
  raw_text: string;
  analysis_result: any;
  user_query: string;
  conversation_id?: string | null;
}

export async function sendReadInteractiveChatMessage(
  params: ReadInteractiveChatInput,
  userId = getAppUserId()
): Promise<{ answer: string; conversation_id: string }> {
  const frameworkName = { social: '通用社交', gov: '体制内职场', corp: '跨国企业' }[params.scene_framework];
  
  const query = `
【上下文背景】
- 场景框架: ${frameworkName}
- 训练板块: ${params.scene_type}
- 用户输入的原文: 
"""
${params.raw_text}
"""
- 系统已自动进行的四宫格穿透分析结果:
${JSON.stringify(params.analysis_result, null, 2)}

【用户追问】
"${params.user_query}"

【指令】
请你作为高管教练，针对用户的追问，结合当前场景（${frameworkName}），指出他思维中的局限性、忽略的隐藏逻辑，或提供极具操作性的反向话术和风控建议。
字数保持在 150-250 字左右，语气应当犀利、专业、富有洞察力。
`;

  const data = await proxyOralChatMessage(query, {
    userId,
    conversationId: params.conversation_id,
    inputs: injectUserProfileAndTime({}),
  });
  return {
    answer: String(data.answer || ''),
    conversation_id: String(data.conversation_id || ''),
  };
}

/** 每周一聊深度研判分析 - 返回结构 */
export interface WeeklyCognitiveResult {
  analysis: string;              // AI 深度研判报告
  shortDebilitatingFactors: string; // 提取出来的短板词汇（用于更新全局画像，逗号分隔）
}

/**
 * 触发每周一聊的认知树洞分析
 * 支持 Dify 接口调用与高度拟真的本地 Fallback 离线算法
 */
export async function runWeeklyCognitiveAnalysis(
  userText: string,
  userId = getAppUserId()
): Promise<WeeklyCognitiveResult> {
  try {
    const query = `
你是专为高层管理者提供认知陪伴与决策分析的顶层 AI 智囊。
请针对用户周末录入的深度感悟、职场困境或心理状态，提供深度研判。

用户输入内容：
"""
${userText}
"""

【输出规范】
请必须且只能按照以下 XML 格式返回你的结果，以便系统解析，不要包含任何多余文字：
<response>
  <analysis>请写下 150 字左右的深度分析报告，指引用户的局限性与突破路径。语气必须专业、沉锐且富有洞察力。</analysis>
  <factors>提取 1 至 3 个最精准的能力短板或弱点词语，用英文逗号分隔。例如：防御性退缩,缺乏开创力</factors>
</response>
`;
    const data = await proxyOralChatMessage(query, {
      userId,
      inputs: injectUserProfileAndTime({}),
    });

    if (data?.answer) {
      const text = String(data.answer);
      const analysisMatch = text.match(/<analysis>([\s\S]*?)<\/analysis>/);
      const factorsMatch = text.match(/<factors>([\s\S]*?)<\/factors>/);
      
      return {
        analysis: (analysisMatch ? analysisMatch[1] : text).trim(),
        shortDebilitatingFactors: (factorsMatch ? factorsMatch[1] : '缺乏开创力').trim(),
      };
    }
  } catch (e) {
    console.warn('[difyAPI] Dify 接口调用失败，自动启用高阶本地 Fallback 算法: ', e);
  }

  // ====== 智能本地 Fallback 演化算法（保证离线与私有部署体验） ======
  await new Promise((resolve) => setTimeout(resolve, 1500)); // 模拟 AI 推演耗时
  
  const lowerText = userText.toLowerCase();
  let analysis = '';
  let shortDebilitatingFactors = '';

  if (lowerText.includes('汇报') || lowerText.includes('局长') || lowerText.includes('保守') || lowerText.includes('出错')) {
    analysis = '【行政思维研判】您的描述反映了在新权力介入或环境不确定时典型的“过度防御性退缩”。这种策略虽能在短期内躲避权力斗争的流弹，但长期来看，这种“不求有功但求无过”的静默状态会让上层裁定您缺乏开拓力与战略担当，面临逐渐被边缘化的风险。建议下周在汇报中积极寻找小切口切入，主动展现开创态度。';
    shortDebilitatingFactors = '防御性退缩,缺乏开创力';
  } else if (lowerText.includes('竞争') || lowerText.includes('博弈') || lowerText.includes('冲突') || lowerText.includes('站队')) {
    analysis = '【战略博弈研判】您正处于复杂的利益拉扯与派系夹缝中。目前的被动隐忍表明您在“筹码识别”与“信息壁垒构建”上存在欠缺。如果一味寻求绝对中立，往往会沦为双方斗争的第一牺牲品。建议摆脱情绪拉扯，从纯粹 of 利益流向角度研判两方痛点，建立自身不可替代的信息垄断地位。';
    shortDebilitatingFactors = '信息垄断弱,博弈敏感度低';
  } else if (lowerText.includes('累') || lowerText.includes('迷茫') || lowerText.includes('瓶颈') || lowerText.includes('焦虑')) {
    analysis = '【心智底层研判】当前高压的决策环境已引发了您认知带宽的过载。您正在试图以战术层面的勤奋去掩盖战略定位上的迷茫。一味压缩休息时间并不能解决体系性困局，您需要从本周的执行状态中抽离出来，重构个人的控制论闭环，强制聚焦于 20% 的决定性核心指标。';
    shortDebilitatingFactors = '认知带宽过载,精力分配失衡';
  } else {
    analysis = '【综合认知研判】您的思维轨迹呈现出对现有职场规则的适度适应，但在更高维度的“升维因果推演”上缺乏敏锐感知。当前看似平稳的表象下，可能隐藏着由于缺乏长期主义规划带来的被动危机。建议当即摒弃日常事务的零碎打法，站在组织全局的周期更迭上，重新划定个人价值跃迁的战略支点。';
    shortDebilitatingFactors = '长期战略模糊,大局观弱';
  }

  return { analysis, shortDebilitatingFactors };
}

/** 两周复盘分析结果 */
export interface BiweeklyReviewResult {
  analysis: string;
  shortDebilitatingFactors: string;
  difficultyAdjustment?: Record<string, number>;
  trainingAdjustment?: {
    pauseModules: string[];
    intensifyModules: string[];
    newFocusAreas: string[];
    difficultyIncrease: Record<string, number>;
  };
}

/**
 * 运行两周一次的专属复盘分析工作流（走后端代理，对接 Biweekly Review Workflow）
 */
export async function runBiweeklyReviewAnalysis(
  answers: Record<string, string>,
  userId = getAppUserId(),
): Promise<BiweeklyReviewResult> {
  try {
    const res = await fetch('/api/biweekly-review/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        practicalTest: answers.practicalTest,
        goalAlignment: answers.goalAlignment,
        weaknessScan: answers.weaknessScan,
        tacticalDispatch: answers.tacticalDispatch,
        user_current_profile: getUserCurrentProfile(),
        userId,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && data.analysis) {
      interceptOutputText(data);
      return {
        analysis: String(data.analysis).trim(),
        shortDebilitatingFactors: String(data.shortDebilitatingFactors || '缺乏开创力').trim(),
        difficultyAdjustment: data.difficultyAdjustment || {},
        trainingAdjustment: data.trainingAdjustment,
      };
    }

    throw new Error(data?.error || `复盘工作流 HTTP ${res.status}`);
  } catch (e) {
    console.warn('[difyAPI] Dify 复盘工作流失败，启用本地 Fallback:', e);
  }

  await new Promise((resolve) => setTimeout(resolve, 1200));
  const combined = `${answers.weaknessScan} ${answers.tacticalDispatch}`.toLowerCase();
  let shortDebilitatingFactors = '长期战略模糊,大局观弱';
  let analysis =
    '【综合复盘研判】您已主动完成两周期结构化自省。建议将下两周训练火力集中对准当前最痛瓶颈，挂起低 ROI 板块，优先击穿口语抗压与博弈敏感度。';

  if (combined.includes('口语') || combined.includes('即兴') || combined.includes('表达')) {
    shortDebilitatingFactors = '即兴逻辑散乱,上级质询承压弱';
    analysis =
      '【口语瓶颈研判】复盘显示即兴表达与高压质询是当前晋升卡点。建议下周口语沙盘与破局说权重上调，高阶审美可暂时挂起。';
  } else if (combined.includes('博弈') || combined.includes('斗争') || combined.includes('高管')) {
    shortDebilitatingFactors = '信息垄断弱,博弈敏感度低';
    analysis =
      '【博弈瓶颈研判】您正处于复杂利益拉扯期。建议强化驭心博弈与口语沙盘联动，以场景化推演补齐筹码识别短板。';
  }

  return {
    analysis,
    shortDebilitatingFactors,
    difficultyAdjustment: {},
    trainingAdjustment: {
      pauseModules: combined.includes('审美') || answers.tacticalDispatch.includes('挂起') ? ['entertainment'] : [],
      intensifyModules: combined.includes('口语') || combined.includes('即兴') ? ['oralSandbox', 'impromptuSpeech'] : [],
      newFocusAreas: [],
      difficultyIncrease: {},
    },
  };
}

/** 每周夜话增强分析结果 */
export interface WeeklyChatAnalysisResult {
  analysis: string;
  nextWeekPreview: string;
  nextWeekPush: Record<string, unknown>;
}

const WEEKLY_DIRECTION_LABELS: Record<string, string> = {
  humanGameCase: '人性博弈案例',
  englishTopic: '英语学习主题',
  executiveConflict: '高管斗争案例',
  manipulationStrategy: '驭人/博弈策略',
  cognitiveUpgrade: '顶层认知升维',
  careerAdvice: '晋升/跳槽建议',
};

function buildFallbackWeeklyPush(
  content: string,
  directions: string[],
): Record<string, unknown> {
  const labels = directions.map((d) => WEEKLY_DIRECTION_LABELS[d] || d);
  const focusHint = labels.join('、') || '综合心智升级';
  return {
    yuxinGameTheory: directions.includes('humanGameCase') || directions.includes('executiveConflict')
      ? [`${focusHint}：${content.slice(0, 40)}...`]
      : undefined,
    oralSandbox: {
      scenario: `心智投喂定向：${focusHint}`,
      roles: '我 + 业务助攻 + 施压方 + 关键决策人',
      focus: content.slice(0, 80) || focusHint,
    },
    impromptuSpeech: directions.includes('englishTopic') || directions.includes('careerAdvice')
      ? { topic: `${focusHint}即兴演练`, targetLevels: ['logic', 'fluency'] }
      : undefined,
  };
}

/**
 * 运行每周夜话启发互动 API（含训练库重组配置）
 */
export async function runWeeklyChatAnalysis(
  content: string,
  directions: string[],
  userId = getAppUserId(),
): Promise<WeeklyChatAnalysisResult> {
  const query = `【心智投喂与方向指定】
内容：${content}
勾选推送方向：${directions.join(', ')}

【输出规范】
请必须且只能按以下 XML 返回：
<response>
  <analysis>150字左右的启发式研判</analysis>
  <preview>下周训练重组预告（80字内）</preview>
  <push_config>{"oralSandbox":{"scenario":"...","roles":"...","focus":"..."},"yuxinGameTheory":["..."],"impromptuSpeech":{"topic":"...","targetLevels":["logic"]}}</push_config>
</response>`;

  try {
    const data = await proxyOralChatMessage(query, {
      userId,
      inputs: injectUserProfileAndTime({}),
    });

    if (data?.answer) {
      const text = String(data.answer);
      const analysis = (text.match(/<analysis>([\s\S]*?)<\/analysis>/)?.[1] || text).trim();
      const preview = (text.match(/<preview>([\s\S]*?)<\/preview>/)?.[1] || '已为您重组下周训练课表').trim();
      const pushRaw = text.match(/<push_config>([\s\S]*?)<\/push_config>/)?.[1] || '{}';

      let nextWeekPush: Record<string, unknown> = {};
      try {
        nextWeekPush = JSON.parse(pushRaw);
      } catch {
        nextWeekPush = buildFallbackWeeklyPush(content, directions);
      }

      return { analysis, nextWeekPreview: preview, nextWeekPush };
    }
  } catch (e) {
    console.warn('[difyAPI] Dify 每周夜话接口失败，启用本地 Fallback:', e);
  }

  await new Promise((resolve) => setTimeout(resolve, 1500));
  const fallbackPush = buildFallbackWeeklyPush(content, directions);
  const directionLabels = directions.map((d) => WEEKLY_DIRECTION_LABELS[d] || d).join('、');
  return {
    analysis: `【心智投喂研判】您本周沉淀的核心议题已纳入系统进化队列。针对「${directionLabels || '综合'}」方向，建议下周优先在口语沙盘与驭心博弈中做场景化演练，将认知转化为可执行的战术肌肉记忆。`,
    nextWeekPreview: `下周将重点重组：${directionLabels || '口语沙盘 + 驭心博弈'}，并根据您的投喂内容自动注入定制场景。`,
    nextWeekPush: fallbackPush,
  };
}

/** 每周夜话增强分析结果（含场景映射） */
export interface WeeklyChatEnhancedResult extends WeeklyChatAnalysisResult {
  coreThemes: string[];
  profileFactors: string;
}

/**
 * 运行每周夜话增强 API：Dify 研判 + 本地关键词场景映射引擎合并
 */
export async function runWeeklyChatEnhanced(
  content: string,
  directions: string[],
  userId = getAppUserId(),
): Promise<WeeklyChatEnhancedResult> {
  try {
    const res = await fetch('/api/weekly-chat/enhanced', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userText: content,
        selectedDirections: directions,
        user_current_profile: getUserCurrentProfile(),
        userId,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && data.analysis) {
      interceptOutputText(data);
      const keywordsFromDify = data.coreThemes
        ? String(data.coreThemes).split(/[,，;；]/).map((s: string) => s.trim()).filter(Boolean)
        : [];
      const keywords = keywordsFromDify.length
        ? keywordsFromDify
        : extractKeywordsFromText(`${content} ${data.analysis}`);
      const mapped = generateScenarioMapping(keywords, directions, data.analysis);
      const nextWeekPush = mergeTrainingPlans(data.nextWeekPush, mapped);
      const profileFactors = String(data.profileFactors || keywords.slice(0, 3).join(',') || '长期战略模糊').trim();

      return {
        analysis: String(data.analysis).trim(),
        nextWeekPreview: String(data.nextWeekPreview || '已为您重组下周训练课表').trim(),
        nextWeekPush,
        coreThemes: keywords,
        profileFactors,
      };
    }

    throw new Error(data?.error || `夜话工作流 HTTP ${res.status}`);
  } catch (e) {
    console.warn('[difyAPI] Dify 夜话增强工作流失败，启用本地 Fallback:', e);
  }

  const base = await runWeeklyChatAnalysis(content, directions, userId);
  const keywords = extractKeywordsFromText(`${content} ${base.analysis}`);
  const mapped = generateScenarioMapping(keywords, directions, base.analysis);
  const nextWeekPush = mergeTrainingPlans(base.nextWeekPush, mapped);

  const factorsMatch = base.analysis.match(/<profile_factors>([\s\S]*?)<\/profile_factors>/);
  const profileFactors = factorsMatch?.[1]?.trim()
    || keywords.slice(0, 3).join(',')
    || '长期战略模糊';

  return {
    ...base,
    nextWeekPush,
    coreThemes: keywords,
    profileFactors,
  };
}

