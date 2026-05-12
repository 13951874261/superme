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
  const payloadFiles = await Promise.all(files.map(async file => ({
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    base64Content: await fileToBase64Content(file),
    sourceName: file.name,
  })));

  const response = await fetch('/api/material/process-and-extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, userId, files: payloadFiles }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    const error = new Error(data?.error || data?.message || '上传并提纯失败');
    (error as Error & { logs?: string[] }).logs = data?.logs || [];
    throw error;
  }
  return data as { success: true; topic: string; total: number; results: any[]; logs: string[] };
}

export async function triggerEnglishMasteryExtraction(topic: string, materialText = '', userId = 'default-user') {
  const response = await fetch('/api/dify/run-english-mastery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, materialText, userId }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || data?.message || '提纯工作流执行失败');
  }
  return data;
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
 */
export async function runEnglishWriteReview(userText: string, mailIntent: string): Promise<WritingReviewResult> {
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
        mail_intent: mailIntent
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

export async function runEnglishListenEngine(text: string, userId = 'default-user'): Promise<ListenEngineResult> {
  const apiKey = import.meta.env.VITE_DIFY_LISTEN_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_LISTEN_API_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: { listening_text: text },
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

export async function runWordEnrichment(targetWord: string, userId = 'default-user'): Promise<WordEnrichmentResult> {
  const apiKey = import.meta.env.VITE_DIFY_ENRICH_API_KEY;
  if (!apiKey) throw new Error('未配置 VITE_DIFY_ENRICH_API_KEY');

  const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: { target_word: targetWord },
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

export async function runEnglishSentenceEvaluation(
  targetWord: string,
  userSentence: string,
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
        inputs: { target_word: targetWord, user_sentence: userSentence },
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
