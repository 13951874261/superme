// 鈹€鈹€ 鍘熸湁鎺ュ彛淇濈暀 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€ 鑻辫鏉垮潡鏂板鎺ュ彛绫诲瀷 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

/** 澶氳鑹茶法鏂囧寲璋堝垽娌欑洏 - 杈撳叆 */
export interface OralSandboxInput {
  scene_type: string;       // 渚嬶細"鍥介檯閾跺洟璐锋璋堝垽"
  roles: string;            // 渚嬶細"鐗靛ご琛屼唬琛?鎴?, 鍙傚洟琛孉, 鍊熸浼佷笟CFO"
  cultural_context: string; // 渚嬶細"缇庡紡鐩存帴 vs 鏃ュ紡濮斿"
  user_reply?: string;      // 鐢ㄦ埛鏈疆鍥炲锛堥娆′负绌猴級
}

/** 澶氳鑹茶皥鍒ゆ矙鐩?- Dify 杩斿洖缁撴瀯 */
export interface OralSandboxReply {
  current_speaker: string;
  dialogue: string;
  hidden_intent: string;
  has_flaw: boolean;
  flaw_analysis: string;
  evaluation: string;
}

/** 璇嶆眹鎻愮函寮曟搸 - 杈撳叆 */
export interface VocabPurifyInput {
  article_text: string;
}

/** 璇嶆眹鎻愮函寮曟搸 - 杩斿洖缁撴瀯 */
export interface VocabPurifyResult {
  words?: Array<{ word: string; phonetic?: string; pos?: string; zh_meaning?: string }>;
  phrases?: string[];
  sentences?: string[];
}

/** 璇嶆眹鎻愮函寮曟搸 - 鐩存帴璋冪敤 Dify Workflow 鐨?API Key */
const VOCAB_PURIFY_DIRECT_API_KEY = import.meta.env.VITE_DIFY_VOCAB_API_KEY || '';

/** 涓夋寮忓叕鏂囨壒闃?- 杈撳叆 */
export interface WritingReviewInput {
  user_text: string;
  mail_intent: string;
}

/** 涓夋寮忓叕鏂囨壒闃?- 杩斿洖缁撴瀯 */
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
    throw new Error('AI 杩斿洖鏁版嵁鏍煎紡寮傚父');
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
    throw new Error('AI 杩斿洖鏁版嵁鏍煎紡寮傚父');
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
    throw new Error('AI 杩斿洖鏁版嵁鏍煎紡寮傚父');
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
    source: '鍏ㄥ眬鍒掔嚎鎴幏',
  };
}

// 鈹€鈹€ 鍩虹璇锋眰灏佽 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

// 鈹€鈹€ 鍘熸湁鍚姏宸ヤ綔娴侊紙淇濇寔涓嶅彉锛夆攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
export async function runListenWorkflow(inputs: ListenWorkflowInput, userId = 'default-user') {
  return request<DifyWorkflowResponse>(`/workflows/run`, getDifyApiKey(), {
    method: 'POST',
    body: JSON.stringify({ inputs, response_mode: 'blocking', user: userId }),
  });
}

export function getDifyAppId() { return DIFY_APP_ID; }

// 鈹€鈹€ 鑻辫鏉垮潡鏂板璋冪敤 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

/**
 * 鏅鸿兘浣?锛氬瑙掕壊璺ㄦ枃鍖栬皥鍒ゆ矙鐩?(Chatflow)
 * 閫氳繃鍚庣浠ｇ悊璋冪敤锛岄伩鍏嶅墠绔毚闇?API Key
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
 * 鏅鸿兘浣?锛氭斂鍟嗗姟闀挎枃璇嶆眹鎻愮函寮曟搸 (Workflow)
 * 閫氳繃鍓嶇鐩存帴璋冪敤 Dify Workflow锛岄伩鍏嶉澶栧悗绔敼閫?
 */
export async function uploadMaterialToKB(file: File, topic: string): Promise<any> {
  const base64Content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64String = result.includes(',') ? result.split(',')[1] : result;
      if (!base64String) {
        reject(new Error('鏂囦欢璇诲彇澶辫触锛屾湭鑾峰緱 Base64 鍐呭'));
        return;
      }
      resolve(base64String);
    };
    reader.onerror = () => reject(new Error('鏂囦欢璇诲彇澶辫触'));
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
    throw new Error(data?.error || data?.message || '涓婁紶鑷崇煡璇嗗簱澶辫触');
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
        reject(new Error('鏂囦欢璇诲彇澶辫触锛屾湭鑾峰緱 Base64 鍐呭'));
        return;
      }
      resolve(base64String);
    };
    reader.onerror = () => reject(new Error('鏂囦欢璇诲彇澶辫触'));
    reader.readAsDataURL(file);
  });
}

export async function processMaterialsAndExtract(files: File[], topic: string, userId = 'default-user') {
  // 灏嗗墠绔?File 瀵硅薄杞负 Base64 浼犻€掔粰鍚庣鐨勭粺涓€鎻愮函璺敱
  const filePayloads = await Promise.all(
    files.map(async (f) => {
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('鍓嶇鏂囦欢璇诲彇澶辫触'));
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
  if (!response.ok) throw new Error(data?.error || '鑾峰彇姣忔棩閰嶉澶辫触');
  return data as DailyQuotaStatus;
}

export async function triggerEnglishMasteryExtraction(
  topic: string,
  materialText = '',
  userId = 'default-user',
  cefrLevel: 'A2' | 'B1' | 'B2' | 'C1' = 'B1',
  genre: 'news' | 'meeting' | 'podcast' | 'reading' = 'meeting'
): Promise<DailyExtractResult> {
  const response = await fetch("/api/english/daily-extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, materialText, userId, cefrLevel, genre }),
  });

  // 澶勭悊娴佸紡鍝嶅簲 (SSE)
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalPayload: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // 鎸夎澶勭悊 SSE 鏁版嵁
      let lineEnd = buffer.indexOf("\n");
      while (lineEnd !== -1) {
        const line = buffer.substring(0, lineEnd).trim();
        buffer = buffer.substring(lineEnd + 1);

        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") break;
          
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.success !== undefined) {
              finalPayload = parsed;
            }
          } catch (e) {
            // 蹇界暐涓存椂瑙ｆ瀽閿欒锛堟暟鎹潡琚埅鏂級
          }
        }
        lineEnd = buffer.indexOf("\n");
      }
    }

    // 澶勭悊娈嬩綑缂撳啿鏁版嵁
    if (buffer.trim().startsWith("data: ")) {
      const dataStr = buffer.trim().slice(6).trim();
      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.success !== undefined) {
          finalPayload = parsed;
        }
      } catch (e) {}
    }

    if (!finalPayload) {
      throw new Error("Failed to receive completion payload from stream");
    }
    if (finalPayload.success === false) {
      throw new Error(finalPayload.error || finalPayload.message || "流式提取失败");
    }
    return finalPayload;
  }

  // 浼犵粺 JSON 鍝嶅簲澶勭悊
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    if (data?.quotaExceeded) {
      return data as DailyExtractResult;
    }
    throw new Error(data?.error || data?.message || '提取词汇操作失败，请检查后端状态');
  }
  return data as DailyExtractResult;
}

export async function callVocabPurify(
  inputs: VocabPurifyInput,
  userId = 'default-user'
): Promise<VocabPurifyResult> {
  if (!VOCAB_PURIFY_DIRECT_API_KEY) {
    throw new Error('鏈厤缃?VITE_DIFY_VOCAB_API_KEY');
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
 * 鑻辫鍏枃绾垫繁鎵归槄鎺ュ彛 (鍓嶇鐩存帴璋冪敤 Dify)
 * @param userText 鐢ㄦ埛鍐欑殑鍘熷鑻辨枃鑽夌
 * @param mailIntent 琛屾枃鎰忓浘
 * @param theme 鍏ㄥ眬闃靛湴涓婚
 */
export async function runEnglishWriteReview(userText: string, mailIntent: string, theme: string): Promise<WritingReviewResult> {
  const apiKey = import.meta.env.VITE_DIFY_WRITE_API_KEY;
  if (!apiKey) throw new Error('鏈厤缃?VITE_DIFY_WRITE_API_KEY');

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

  // 瑙ｆ瀽 Dify 杩斿洖鐨?JSON 瀛楃涓茬粨鏋?
  try {
    const rawResult = data.data.outputs.result;
    return parseMaybeJson<WritingReviewResult>(rawResult, 'AI 杩斿洖鏍煎紡寮傚父');
  } catch (e) {
    console.error('瑙ｆ瀽鎵归槄缁撴灉澶辫触:', e, data);
    throw new Error('AI 杩斿洖鏍煎紡寮傚父');
  }
}

export async function sendOralChatMessage(query: string, conversationId: string | null = null, userId = 'default-user') {
  const apiKey = import.meta.env.VITE_DIFY_ORAL_API_KEY;
  if (!apiKey) throw new Error('鏈厤缃?VITE_DIFY_ORAL_API_KEY');

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
  if (!res.ok) throw new Error(data.message || data.error || 'Dify Chat API 璇锋眰澶辫触');
  return data;
}

export async function runEnglishListenEngine(text: string, theme: string, userId = 'default-user'): Promise<ListenEngineResult> {
  const apiKey = import.meta.env.VITE_DIFY_LISTEN_API_KEY;
  if (!apiKey) throw new Error('鏈厤缃?VITE_DIFY_LISTEN_API_KEY');

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
    console.error('瑙ｆ瀽鍚鲸缁撴灉澶辫触:', e);
    throw new Error('AI 杩斿洖鏁版嵁鏍煎紡寮傚父');
  }
}

export async function runWordEnrichment(targetWord: string, theme: string, userId = 'default-user'): Promise<WordEnrichmentResult> {
  const apiKey = import.meta.env.VITE_DIFY_ENRICH_API_KEY;
  if (!apiKey) throw new Error('鏈厤缃?VITE_DIFY_ENRICH_API_KEY');

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
    console.error('璇嶆眹琛ュ叏鍘熷杩斿洖涓嶆槸瀛楃涓?', data);
    throw new Error('AI 鏍煎紡寮傚父');
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
    console.error('瑙ｆ瀽璇嶆眹琛ュ叏澶辫触:', e, data);
    throw new Error('AI 鏍煎紡寮傚父');
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
  if (!apiKey) throw new Error('鏈厤缃?VITE_DIFY_WAKEUP_API_KEY');

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
    throw new Error('鏈厤缃€犲彞 API 瀵嗛挜锛岃妫€鏌?.env.local 骞堕噸鏂拌繍琛?build/dev');
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
    console.error('Fetch 閫氳寮傚父:', err);
    throw new Error('涓?Dify 鎬婚儴澶卞幓杩炴帴锛岃妫€鏌?HTTPS 鎺ュ彛鏄惁鍙揪');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('Dify 鎷掔粷璇锋眰:', data);
    throw new Error(data?.message || data?.error || 'Dify 响应成功但状态非 200');
  }

  try {
    const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
    const rawText = String(rawResult);
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('AI 鏈繑鍥炴湁鏁堢殑澶ф嫭鍙?JSON 缁撴瀯');
    }

    return mapSentenceEvaluationResult(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error('鑴辨按瑙ｆ瀽澶辫触. 鍘熷鏁版嵁:', data?.data?.outputs?.result ?? data);
    throw new Error('AI 杩斿洖鏁版嵁鏍煎紡寮傚父锛岃В鏋?JSON 宕╂簝');
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
  if (!apiKey) throw new Error('未配置 VITE_DIFY_LISTEN_GEN_API_KEY，无法生成拦截剧本。');

  // 璇ュ簲鐢ㄤ负 Text Generator (Completion) 妯″紡锛屼娇鐢?/completion-messages 鎺ュ彛
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
  if (!res.ok) throw new Error(data?.message || data?.error || '鐢熸垚鎴幏鍓ф湰澶辫触');

  // Completion 缁撴灉鍦?data.answer
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
  if (!apiKey) throw new Error('鏈厤缃?VITE_DIFY_SPEECH_EVAL_API_KEY');

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
  if (!res.ok) throw new Error(data?.message || data?.error || '璇勬祴澶辫触');

  try {
    const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
    const cleanJson = String(rawResult).replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as ImpromptuSpeechEvaluationResult;
  } catch (e) {
    console.error('瑙ｆ瀽鍗冲叴婕旇璇勬祴缁撴灉澶辫触:', e, data);
    throw new Error('AI 返回口语评估数据格式异常');
  }
}

// 鈹€鈹€ 鍙戦煶绾犳鐩稿叧鎺ュ彛 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

/** Dify audio-to-text 鎺ュ彛杩斿洖缁撴灉 */
export interface AudioToTextResult {
  text: string;
  task_id?: string;
}

/**
 * 姝ラ1: 璋冪敤 Dify audio-to-text 鎺ュ彛灏嗛煶棰戣浆涓鸿嫳鏂囨枃鏈?
 * @param audioFile 褰曢煶鏂囦欢 (Blob/File)
 * @param userId 鐢ㄦ埛ID
 * @returns 璇嗗埆鍑虹殑鑻辨枃鏂囨湰
 */
export async function audioToText(audioFile: Blob, userId = 'default-user'): Promise<AudioToTextResult> {
  const apiKey = import.meta.env.VITE_DIFY_STT_API_KEY;
  if (!apiKey) throw new Error('鏈厤缃?VITE_DIFY_STT_API_KEY');

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
    throw new Error(`璇煶璇嗗埆澶辫触 (${res.status}): ${errText}`);
  }

  const data = await res.json().catch(() => ({}));
  return {
    text: typeof data.text === 'string' ? data.text.trim() : '',
    task_id: data.task_id,
  };
}

/** 鍙戦煶绾犳缁撴灉 - 缁撴瀯鍖栨牸寮?*/
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
 * 姝ラ2: 璋冪敤鍙戦煶绾犳宸ヤ綔娴?
 * @param targetText 鐢ㄦ埛杈撳叆鐨勭洰鏍囧崟璇?鍙ュ瓙
 * @param recognizedText 璇煶璇嗗埆杩斿洖鐨勬枃鏈?
 * @param userId 鐢ㄦ埛ID
 * @returns 鍙戦煶绾犳缁撴灉
 */
export async function runPronunciationAssessment(
  targetText: string,
  recognizedText: string,
  userId = 'default-user'
): Promise<PronunciationAssessmentResult> {
  // 閫氳繃鍚庣浠ｇ悊璋冪敤 Dify 鍙戦煶绾犳宸ヤ綔娴?
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
    throw new Error(`鍙戦煶绾犳璇锋眰澶辫触 (${res.status}): ${errText}`);
  }

  const data = await res.json().catch(() => ({}));
  
  try {
    const rawResult = data?.data?.outputs?.result 
      ?? data?.data?.outputs 
      ?? data?.answer 
      ?? data?.message 
      ?? data;
    
    // 灏濊瘯鎻愬彇 JSON
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
    
    // 濡傛灉娌℃湁 JSON 缁撴瀯锛岃繑鍥炲師濮嬬粨鏋?
    return {
      score: 0,
      analysis: rawText || '鏃犳硶瑙ｆ瀽璇勬祴缁撴灉',
      corrections: [],
      target_text: targetText,
      recognized_text: recognizedText,
    };
  } catch (e) {
    console.error('瑙ｆ瀽鍙戦煶绾犳缁撴灉澶辫触:', e, data);
    throw new Error('鍙戦煶绾犳缁撴灉瑙ｆ瀽澶辫触');
  }
}

// 鈹€鈹€ 鍗冲叴婕旇澧炲己鍔熻兘 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

/** 鍗冲叴婕旇鎻愮ず璇嶇敓鎴愮粨鏋?*/
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
 * 鑾峰彇鍗冲叴婕旇涓婚鎻愮ず璇?
 * @param theme 婕旇涓婚
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
  if (!res.ok) throw new Error(data?.message || data?.error || '生成战略破冰失败');

  try {
    const outputs = data?.data?.outputs;

    // 榛勯噾璺緞锛欴ify 鐩存帴杩斿洖浜嗙粨鏋勫寲鐨?JSON 瀵硅薄锛堟棤闇€鍐嶈В鏋愬瓧绗︿覆锛?
    if (outputs && typeof outputs === 'object' && outputs.outline && outputs.tips) {
      return outputs as SpeechPrompterResult;
    }

    // 鍏滃簳璺緞锛氬鏋?Dify 鎶婂唴瀹瑰寘鍦ㄤ簡鏌愪釜鍙橀噺閲岀殑瀛楃涓蹭腑
    const rawResult = outputs?.result ?? outputs?.text ?? data?.answer ?? '';
    const rawText = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
    
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as SpeechPrompterResult;
    }
    
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as SpeechPrompterResult;
  } catch (e) {
    console.error('瑙ｆ瀽鎻愮ず璇嶇粨鏋滃け璐?', e, data);
    throw new Error('AI 建议返回数据格式异常');
  }
}

/** 鍗冲叴婕旇澧炲己璇勬祴缁撴灉 */
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
 * 鍗冲叴婕旇澧炲己璇勬祴锛堟敮鎸侀煶棰戜笂浼狅級
 * @param theme 婕旇涓婚
 * @param durationMinutes 鏃堕暱锛堝垎閽燂級
 * @param audioFile 闊抽鏂囦欢
 */
export async function runEnhancedSpeechEvaluation(
  theme: string,
  durationMinutes: string,
  audioFile: File | Blob,
  userId = 'default-user'
): Promise<EnhancedSpeechEvalResult> {
  const apiKey = import.meta.env.VITE_DIFY_SPEECH_EVAL_API_KEY;
  if (!apiKey) throw new Error('鏈厤缃?VITE_DIFY_SPEECH_EVAL_API_KEY');

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
  if (!res.ok) throw new Error(data?.message || data?.error || '澧炲己璇勬祴澶辫触');

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
    console.error('瑙ｆ瀽澧炲己璇勬祴缁撴灉澶辫触:', e, data);
    throw new Error('澧炲己璇勬祴缁撴灉瑙ｆ瀽澶辫触');
  }
}

// 鈹€鈹€ 娲炲療(鍚? 浜烘€цВ鐮佷笌鐮寸唤璇嗗埆 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface InsightListenInputs {
  scenario_text: string;
  user_analysis: string;
}

export async function fetchInsightFeedback(inputs: InsightListenInputs, userId = 'default-user'): Promise<string> {
  const apiKey = import.meta.env.VITE_DIFY_INSIGHT_LISTEN_KEY;
  if (!apiKey) throw new Error("鏈厤缃?VITE_DIFY_INSIGHT_LISTEN_KEY");

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

  const rawResult = data?.data?.outputs?.ai_feedback ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? "鏈幏鍙栧埌鏈夋晥鍙嶉";
  return String(rawResult);
}

/**
 * 鍔ㄦ€佽幏鍙栨礊瀵熻€冮 (鏂囨湰鐢熸垚搴旂敤)
 * 渚濊禆鐜鍙橀噺: VITE_DIFY_INSIGHT_GEN_KEY
 */
export async function fetchDynamicInsightScenario(category: string, userId = 'default-user'): Promise<string> {
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
      inputs: { category },
      query: "", // 瑙﹀彂鏂囨湰鐢熸垚
      response_mode: 'blocking',
      user: userId
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `鑾峰彇鍔ㄦ€佽€冮澶辫触 HTTP ${res.status}`);

  return String(data?.answer || "").trim();
}

// 鈹€鈹€ 鐮村眬绯荤粺锛堣锛夌浉鍏虫帴鍙?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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
  if (!apiKey) throw new Error('鏈厤缃?VITE_DIFY_SPEAK_INFLUENCE_KEY');

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
  if (!res.ok) throw new Error(data?.message || data?.error || 'Speak Influence Engine 璇锋眰澶辫触');

  const rawResult = data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
  try {
    const cleanJson = String(rawResult).replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as SpeakInfluenceResult;
  } catch (e) {
    console.error('瑙ｆ瀽鏁欑粌杩斿洖鐨?JSON 鏍煎紡澶辫触:', e, rawResult);
    throw new Error('AI 主题判定失败，返回的不是有效 JSON');
  }
}

// 鈹€鈹€ 绌块€忕郴缁燂紙璇伙級鐩稿叧鎺ュ彛 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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
  if (!apiKey) throw new Error('鏈厤缃?VITE_DIFY_READ_PENETRATION_KEY');

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
  if (!res.ok) throw new Error(data?.message || data?.error || 'Cognitive Penetration Engine 璇锋眰澶辫触');

  const rawResult = data?.data?.outputs?.analysis_result ?? data?.data?.outputs?.result ?? data?.data?.outputs?.text ?? data?.answer ?? data?.message ?? '';
  try {
    const cleanJson = String(rawResult).replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as CognitivePenetrationResult;
  } catch (e) {
    console.error('瑙ｆ瀽璁ょ煡绌块€忕粨鏋滅殑 JSON 鏍煎紡澶辫触:', e, rawResult);
    throw new Error('AI 错题集生成失败，返回的不是有效 JSON');
  }
}

// 鈹€鈹€ 椹績鍗氬紙绯荤粺锛圙ame Theory锛夌浉鍏虫帴鍙?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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

// 杩愯鍗氬紙寮曟搸鍒嗘瀽锛堣皟鐢ㄥ悗绔唬鐞嗭級
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
    throw new Error(data?.error || data?.message || '鍗氬紙鍒嗘瀽寮曟搸璇锋眰澶辫触');
  }
  return data.result as GameTheoryAnalyzeResult;
}

// 鑾峰彇鎵€鏈変汉鎬у師鍨嬫。妗?
export async function getPersonalPrototypes(userId = 'default-user'): Promise<PersonalPrototype[]> {
  const res = await fetch(`/api/game-theory/prototypes?userId=${encodeURIComponent(userId)}`);
  const data = await res.json().catch(() => ([]));
  if (!res.ok) {
    throw new Error(data?.error || '随机生词提取失败，请检查后端');
  }
  return data as PersonalPrototype[];
}

// 鎵嬪姩娣诲姞鎴栨洿鏂颁汉鎬у師鍨嬫。妗?
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
    throw new Error(data?.error || '配额状态获取失败，请检查后端');
  }
  return data;
}

// 鍒犻櫎浜烘€у師鍨嬫。妗?
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

// 姣忔棩涓撳睘鐮寸唤璇嶆眹鍔ㄦ€佺敓鎴愶紙璋冪敤 Dify 鍞ら啋宸ヤ綔娴侊級
export async function generateDailyFlawVocabulary(userId = 'default-user'): Promise<Array<{
  word: string;
  ipa: string;
  pronunciation_note: string;
  meaning_zh: string;
  example: string;
}>> {
  const apiKey = import.meta.env.VITE_DIFY_WAKEUP_API_KEY || import.meta.env.VITE_DIFY_WAKUP_API_KEY;
  if (!apiKey) throw new Error('鏈厤缃?VITE_DIFY_WAKEUP_API_KEY');

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
    console.error('瑙ｆ瀽鐮寸唤璇嶆眹澶辫触:', e, data);
    throw new Error('Dify 鎺ュ彛杩斿洖鏁版嵁鏍煎紡瑙ｆ瀽澶辫触');
  }
}


