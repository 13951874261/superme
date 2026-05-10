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

// ── 基础请求封装 ─────────────────────────────────────────────
const DIFY_API_BASE_URL = import.meta.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
const DIFY_APP_ID = import.meta.env.VITE_DIFY_APP_ID || '56a4d2c1-006c-4c46-95cc-7b6bedafbcff';

// 各智能体独立 API Key（后续在 .env 中配置）
const ORAL_SANDBOX_API_KEY  = import.meta.env.VITE_DIFY_ORAL_SANDBOX_API_KEY  || '';
const VOCAB_PURIFY_API_KEY  = import.meta.env.VITE_DIFY_VOCAB_PURIFY_API_KEY  || '';
const WRITING_REVIEW_API_KEY = import.meta.env.VITE_DIFY_WRITING_REVIEW_API_KEY || '';

function getDifyApiKey() {
  const key = import.meta.env.VITE_DIFY_API_KEY;
  if (!key) throw new Error('Missing VITE_DIFY_API_KEY');
  return key;
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
  if (typeof rawResult !== 'string') {
    return rawResult as VocabPurifyResult;
  }

  const cleanJson = rawResult.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleanJson) as VocabPurifyResult;
  } catch {
    throw new Error('AI 返回的词汇数据格式异常');
  }
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
    // 去除可能存在的 Markdown 围栏
    const cleanJson = rawResult.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error('解析批阅结果失败:', e, data);
    throw new Error('AI 返回格式异常');
  }
}
