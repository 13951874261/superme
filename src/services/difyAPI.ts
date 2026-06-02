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
  roles: string;            // 例："牵头行代表(我), 参团行A, 借款企业CFO"
  cultural_context: string; // 例："美式直接 vs 日式委婉"
  user_reply?: string;      // 用户本轮回复（首次为空）
}

/** 多角色谈判沙盘 - Dify 返回结构 */
export interface OralSandboxReply {
  current_speaker: string;
  dialogue: string;
  hidden_intent: string;
  has_flaw: boolean;
  flaw_analysis: string;
  evaluation: string;
}

/** 词汇提纯引擎 - 输入 */
export interface VocabPurifyInput {
  article_text: string;
}

/** 词汇提纯引擎 - 返回结构 */
export interface VocabPurifyResult {
  words?: Array<{ word: string; phonetic?: string; pos?: string; zh_meaning?: string }>;
  phrases?: string[];
  sentences?: string[];
}

/** 词汇提纯引擎 - 直接调用 Dify Workflow 的 API Key */
const VOCAB_PURIFY_DIRECT_API_KEY = import.meta.env.VITE_DIFY_VOCAB_API_KEY || '';

/** 三段式公文批阅 - 输入 */
export interface WritingReviewInput {
  user_text: string;
  mail_intent: string;
}

/** 三段式公文批阅 - 返回结构 */
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
const DIFY_API_BASE_URL = import.meta.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
const DIFY_APP_ID = import.meta.env.VITE_DIFY_APP_ID || '56a4d2c1-006c-4c46-95cc-7b6bedafbcff';

function getDifyApiKey() {
  const key = import.meta.env.VITE_DIFY_API_KEY;
  if (!key) throw new Error('Missing VITE_DIFY_API_KEY');
  return key;
}

function parseMaybeJson<T>(raw: unknown, fallbackMessage: string): T {
  if (typeof raw !== 'string') {
    return raw as T;
  }

  const cleanJson = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleanJson) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

async function request<T>(path: string, apiKey: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${DIFY_API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `Dify HTTP ${res.status}`);
  return data as T;
}

// ── 原有听力工作流（保持不变）────────────────────────────────
export async function runListenWorkflow(inputs: ListenWorkflowInput, userId = 'default-user') {
  return request<DifyWorkflowResponse>(`/workflows/run`, getDifyApiKey(), {
    method: 'POST',
    body: JSON.stringify({ inputs, response_mode: 'blocking', user: userId }),
  });
}

export function getDifyAppId() { return DIFY_APP_ID; }

// ── 英语板块新增调用 ─────────────────────────────────────────

/**
 * 智能体1：多角色跨文化谈判沙盘 (Chatflow)
 * 通过后端代理调用，避免前端暴露 API Key
 */
export async function callOralSandbox(
  inputs: OralSandboxInput,
  conversationId?: string,
  userId = 'default-user'
): Promise<{ reply: OralSandboxReply; conversationId: string }> {
  const res = await fetch('/api/english/oral-sandbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs, conversationId, userId }),
  });
  if (!res.ok) throw new Error(`oral-sandbox HTTP ${res.status}`);
  return res.json();
}

/**
 * 智能体2：政商务长文词汇提纯引擎 (Workflow)
 * 通过前端直接调用 Dify Workflow，避免额外后端改造
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
      userId: 'default-user',
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

export async function processMaterialsAndExtract(files: File[], topic: string, userId = 'default-user') {
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
  if (!response.ok) {
    throw new Error(data?.error || data?.message || '提纯流水线执行失败，请检查后端状态');
  }

  return data;
}

export interface DailyExtractResult {
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
  wordCount: number;
  phraseCount: number;
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

export async function getDailyQuotaStatus(userId = 'default-user'): Promise<DailyQuotaStatus> {
  const response = await fetch(`/api/daily-quota/status?userId=${encodeURIComponent(userId)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || '获取每日配额失败');
  return data as DailyQuotaStatus;
}

export async function triggerEnglishMasteryExtraction(topic: string, materialText = '', userId = 'default-user'): Promise<DailyExtractResult> {
  const response = await fetch('/api/english/daily-extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, materialText, userId }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    if (data?.quotaExceeded) {
      // 配额耗尽也是一种"成功返回"，前端根据 quotaExceeded 字段展示提示
      return data as DailyExtractResult;
    }
    throw new Error(data?.error || data?.message || '提纯流水线执行失败，请检查后端状态');
  }
  return data as DailyExtractResult;
}

export async function callVocabPurify(
  inputs: VocabPurifyInput,
  userId = 'default-user'
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
      inputs,
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
  const apiKey = import.meta.env.VITE_DIFY_WRITE_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_WRITE_API_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {
        user_text: userText,
        mail_intent: mailIntent,
        theme: theme
      },
      response_mode: 'blocking',
      user: 'default-user',
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Dify Workflow Error');

  // 解析 Dify 返回的 JSON 字符串结果
  try {
    const rawResult = data.data.outputs.result;
    return parseMaybeJson<WritingReviewResult>(rawResult, 'AI 返回格式异常');
  } catch (e) {
    console.error('解析批阅结果失败:', e, data);
    throw new Error('AI 返回格式异常');
  }
}

export async function sendOralChatMessage(query: string, conversationId: string | null = null, userId = 'default-user') {
  const apiKey = import.meta.env.VITE_DIFY_ORAL_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_ORAL_API_KEY');

  const body = {
    inputs: {},
    query,
    response_mode: 'blocking' as const,
    user: userId,
    ...(conversationId ? { conversation_id: conversationId } : {}),
  };

  const res = await fetch(`${DIFY_API_BASE_URL}/chat-messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Dify Chat API 请求失败');
  return data;
}

export async function runEnglishListenEngine(text: string, theme: string, userId = 'default-user'): Promise<ListenEngineResult> {
  const apiKey = import.meta.env.VITE_DIFY_LISTEN_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_LISTEN_API_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: { listening_text: text, theme },
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
    console.error('解析听辨结果失败:', e);
    throw new Error('AI 返回数据格式异常');
  }
}

export async function runWordEnrichment(targetWord: string, theme: string, userId = 'default-user'): Promise<WordEnrichmentResult> {
  const apiKey = import.meta.env.VITE_DIFY_ENRICH_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_ENRICH_API_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: { target_word: targetWord, theme },
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Enrich Error');

  const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
  if (typeof rawResult !== 'string') {
    console.error('词汇补全原始返回不是字符串:', data);
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
    console.error('解析词汇补全失败:', e, data);
    throw new Error('AI 格式异常');
  }
}

export async function runEnglishWakeupRoutine(theme: string, userId = 'default-user'): Promise<{
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
      inputs: { theme },
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
  userId = 'default-user'
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
        inputs: { target_word: targetWord, user_sentence: userSentence, theme },
        response_mode: 'blocking',
        user: userId,
      }),
    });
  } catch (err) {
    console.error('Fetch 通讯异常:', err);
    throw new Error('与 Dify 总部失去连接，请检查 HTTPS 接口是否可达');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('Dify 拒绝请求:', data);
    throw new Error(data?.message || data?.error || 'Dify 引擎返回非 200 状态');
  }

  try {
    const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
    const rawText = String(rawResult);
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('AI 未返回有效的大括号 JSON 结构');
    }

    return mapSentenceEvaluationResult(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error('脱水解析失败. 原始数据:', data?.data?.outputs?.result ?? data);
    throw new Error('AI 返回数据格式异常，解析 JSON 崩溃');
  }
}

export async function getDueVocabulary(userId = 'default-user') {
  const res = await fetch(`/api/vocab/review?userId=${encodeURIComponent(userId)}`);
  const data = await res.json().catch(() => ([]));
  if (!res.ok) throw new Error(data?.error || '获取待复习词条失败');
  return Array.isArray(data) ? data : [];
}

export async function runListenMaterialGenerator(
  theme: string,
  genre: 'news' | 'meeting' | 'podcast' = 'meeting',
  cefrLevel: 'A2' | 'B1' | 'B2' | 'C1' = 'B1',
  userId = 'default-user'
): Promise<string> {
  const apiKey = import.meta.env.VITE_DIFY_LISTEN_GEN_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_LISTEN_GEN_API_KEY，无法生成截获剧本。');

  // 该应用为 Text Generator (Completion) 模式，使用 /completion-messages 接口
  const res = await fetch(`${DIFY_API_BASE_URL}/completion-messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: { theme, genre, cefr_level: cefrLevel },
      query: "",
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || '生成截获剧本失败');

  // Completion 结果在 data.answer
  return String(data?.answer || '').trim();
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
  userId = 'default-user'
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
      inputs: { 
        theme, 
        duration,
        transcript
      },
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
    console.error('解析即兴演讲评测结果失败:', e, data);
    throw new Error('AI 返回数据格式异常，无法提取四维分数');
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
export async function audioToText(audioFile: Blob, userId = 'default-user'): Promise<AudioToTextResult> {
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

/** 发音纠正结果 - 结构化格式 */
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
  userId = 'default-user'
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
    console.error('解析发音纠正结果失败:', e, data);
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
  userId = 'default-user'
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
      inputs: { theme, difficulty },
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || '生成提示词失败');

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
    console.error('解析提示词结果失败:', e, data);
    throw new Error('AI 返回提示词格式异常');
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
  userId = 'default-user'
): Promise<EnhancedSpeechEvalResult> {
  const apiKey = import.meta.env.VITE_DIFY_SPEECH_EVAL_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_SPEECH_EVAL_API_KEY');

  const formData = new FormData();
  formData.append('file', audioFile, 'speech_audio.webm');
  formData.append('user', userId);
  formData.append('inputs', JSON.stringify({ theme, duration_minutes: durationMinutes }));
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
    console.error('解析增强评测结果失败:', e, data);
    throw new Error('增强评测结果解析失败');
  }
}

// ── 洞察(听) 人性解码与破绽识别 ─────────────────────────────────────────

export interface InsightListenInputs {
  scenario_text: string;
  user_analysis: string;
}

export async function fetchInsightFeedback(inputs: InsightListenInputs, userId = 'default-user'): Promise<string> {
  const apiKey = import.meta.env.VITE_DIFY_INSIGHT_LISTEN_KEY;
  if (!apiKey) throw new Error("未配置 VITE_DIFY_INSIGHT_LISTEN_KEY");

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: inputs,
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
export async function fetchDynamicInsightScenario(category: string, userId = 'default-user'): Promise<string> {
  const apiKey = import.meta.env.VITE_DIFY_INSIGHT_GEN_KEY;
  if (!apiKey) {
    throw new Error("未配置 VITE_DIFY_INSIGHT_GEN_KEY，请在 Dify 中创建一个【文本生成】应用专门用于出题，并配置此环境变量。");
  }

  const res = await fetch(`${DIFY_API_BASE_URL}/completion-messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: { category },
      query: "", // 触发文本生成
      response_mode: 'blocking',
      user: userId
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `获取动态考题失败 HTTP ${res.status}`);

  return String(data?.answer || "【未能生成有效题目，请重试】").trim();
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

export async function runSpeakInfluenceEngine(inputs: SpeakInfluenceInput, userId = 'default-user'): Promise<SpeakInfluenceResult> {
  const apiKey = import.meta.env.VITE_DIFY_SPEAK_INFLUENCE_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_SPEAK_INFLUENCE_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs,
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
    console.error('解析教练返回的 JSON 格式失败:', e, rawResult);
    throw new Error('AI 返回的数据格式异常，无法解析为合法JSON。');
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

export async function runCognitivePenetrationEngine(inputs: CognitivePenetrationInput, userId = 'default-user'): Promise<CognitivePenetrationResult> {
  const apiKey = import.meta.env.VITE_DIFY_READ_PENETRATION_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_READ_PENETRATION_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs,
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Cognitive Penetration Engine 请求失败');

  const rawResult = data?.data?.outputs?.analysis_result ?? data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
  try {
    const cleanJson = String(rawResult).replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as CognitivePenetrationResult;
  } catch (e) {
    console.error('解析认知穿透结果的 JSON 格式失败:', e, rawResult);
    throw new Error('AI 返回的数据格式异常，无法解析为合法JSON。');
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

// 运行博弈引擎分析（调用后端代理）
export async function runGameTheoryAnalysis(
  inputs: GameTheoryAnalyzeInput,
  userId = 'default-user'
): Promise<GameTheoryAnalyzeResult> {
  const res = await fetch('/api/game-theory/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...inputs,
      userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.message || '博弈分析引擎请求失败');
  }
  return data.result as GameTheoryAnalyzeResult;
}

// 获取所有人性原型档案
export async function getPersonalPrototypes(userId = 'default-user'): Promise<PersonalPrototype[]> {
  const res = await fetch(`/api/game-theory/prototypes?userId=${encodeURIComponent(userId)}`);
  const data = await res.json().catch(() => ([]));
  if (!res.ok) {
    throw new Error(data?.error || '获取人性原型档案失败');
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
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || '操作人性原型档案失败');
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
    throw new Error(data?.error || '删除人性原型档案失败');
  }
  return data;
}

// 每日专属破绽词汇动态生成（调用 Dify 唤醒工作流）
export async function generateDailyFlawVocabulary(userId = 'default-user'): Promise<Array<{
  word: string;
  ipa: string;
  pronunciation_note: string;
  meaning_zh: string;
  example: string;
}>> {
  const apiKey = import.meta.env.VITE_DIFY_WAKEUP_API_KEY || import.meta.env.VITE_DIFY_WAKUP_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_WAKEUP_API_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: { theme: 'identifying logical flaws and business counterattack' },
      response_mode: 'blocking',
      user: userId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Wakeup Engine Error');

  try {
    const raw = data?.data?.outputs?.wakeup_json ?? data?.data?.outputs?.result ?? data?.answer ?? data?.message ?? '';
    const clean = String(raw).replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    return parsed.vocab || [];
  } catch (e) {
    console.error('解析破绽词汇失败:', e, data);
    throw new Error('Dify 接口返回数据格式解析失败');
  }
}

