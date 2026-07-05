import {
  getAppUserId,
  getUserCurrentProfile,
  getCurrentFormattedTime,
  getGraphSummaryLocal,
} from './profileHelper';
import { getNextWeekPushPlan } from './reviewHelper';

const DIFY_EMBED_TOKEN =
  import.meta.env.VITE_DIFY_CHATBOT_TOKEN || 'Gz2zXRlfsAr5jYgC';
const DIFY_EMBED_BASE_URL =
  import.meta.env.VITE_DIFY_CHATBOT_BASE_URL || 'https://dify.234124123.xyz';
const EMBED_MEMORY_PACK_QUERY = 'memory';
const EMBED_MEMORY_PACK_MAX_LEN = 4000;
const EMBED_IFRAME_URL_MAX_LEN = 2048;

const DIFY_EMBED_CONVERSATION_PREFIX = 'dify_embed_conversation_';
const DIFY_EMBED_SID_KEY = 'dify_embed_session_id';
const DIFY_EMBED_MIGRATED = 'dify_embed_isolated_session_v1';

/**
 * Dify 在 dify 域名 localStorage 按 sys.user_id 存 conversation_id，且优先于 URL 参数。
 * 无法从主站清除；为每个浏览器标签页使用独立 @embed-{sid} 桶，避免过期 id 404。
 * 工作流侧写/记忆用 inputs.app_user_id（登录账号，如 lzhumy）。
 */
export function ensureDifyEmbedScope(): void {
  if (localStorage.getItem(DIFY_EMBED_MIGRATED) === '1') return;
  clearAllEmbedConversationCache();
  localStorage.removeItem('dify_embed_plain_user_migrated_v1');
  localStorage.removeItem('dify_embed_scope_id');
  localStorage.removeItem('dify_embed_scope_migrated_v4');
  sessionStorage.removeItem(DIFY_EMBED_SID_KEY);
  localStorage.setItem(DIFY_EMBED_MIGRATED, '1');
}

function clearAllEmbedConversationCache(): void {
  const prefix = DIFY_EMBED_CONVERSATION_PREFIX;
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) localStorage.removeItem(key);
  }
}

/** 登录账号（与登录页「当前用户」一致） */
export function getAppAccountUserId(): string {
  return getAppUserId();
}

function getOrCreateEmbedSessionId(forceNew = false): string {
  if (forceNew) sessionStorage.removeItem(DIFY_EMBED_SID_KEY);
  let sid = sessionStorage.getItem(DIFY_EMBED_SID_KEY);
  if (!sid) {
    sid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(DIFY_EMBED_SID_KEY, sid);
  }
  return sid;
}

/** Dify sys.user_id：{登录账号}@embed-{标签页会话}，隔离 dify 域过期 conversationIdInfo */
export function getDifyChatbotUserId(forceNewEmbedSession = false): string {
  ensureDifyEmbedScope();
  const sid = getOrCreateEmbedSessionId(forceNewEmbedSession);
  return `${getAppUserId()}@embed-${sid}`;
}

/** 新对话：轮换 embed 会话桶并刷新 iframe/气泡 */
export function resetDifyChatbotSession(): void {
  clearAllEmbedConversationCache();
  getOrCreateEmbedSessionId(true);
  window.dispatchEvent(new Event('dify-assistant-open'));
  refreshDifyChatbotContext();
}

export interface DifyChatbotConfig {
  token: string;
  baseUrl: string;
  inputs: Record<string, string | number>;
  systemVariables: { user_id: string; conversation_id?: string };
  userVariables: Record<string, string>;
}

let embedLoaded = false;

async function compressAndEncodeBase64(input: string): Promise<string> {
  const uint8Array = new TextEncoder().encode(input);
  const compressedStream = new Response(
    new Blob([uint8Array]).stream().pipeThrough(new CompressionStream('gzip')),
  ).arrayBuffer();
  const compressedUint8Array = new Uint8Array(await compressedStream);
  return btoa(String.fromCharCode(...compressedUint8Array));
}

/** 启动 embed 前拉取结构化记忆包，供 Dify inputs.memory_pack 注入 */
export async function fetchEmbedMemoryPack(accountUserId?: string): Promise<string> {
  const uid = String(accountUserId || getAppAccountUserId()).trim();
  if (!uid) return '';
  try {
    const params = new URLSearchParams({
      userId: uid,
      query: EMBED_MEMORY_PACK_QUERY,
      format: 'json',
    });
    const res = await fetch(`/api/user/memory/pack-for-llm?${params.toString()}`);
    if (!res.ok) return '';
    const json = await res.json();
    const text = String(json?.data?.text || '').trim();
    if (!text) return '';
    return text.length > EMBED_MEMORY_PACK_MAX_LEN
      ? text.slice(0, EMBED_MEMORY_PACK_MAX_LEN)
      : text;
  } catch (e) {
    console.warn('[difyChatbot] fetch memory_pack failed:', e);
    return '';
  }
}

async function encodeConfigToChatbotUrl(config: DifyChatbotConfig): Promise<string> {
  const params = new URLSearchParams();

  await Promise.all(
    Object.entries(config.inputs).map(async ([key, value]) => {
      params.set(key, await compressAndEncodeBase64(String(value)));
    }),
  );

  await Promise.all(
    Object.entries(config.systemVariables).map(async ([key, value]) => {
      params.set(`sys.${key}`, await compressAndEncodeBase64(String(value)));
    }),
  );

  await Promise.all(
    Object.entries(config.userVariables).map(async ([key, value]) => {
      params.set(`user.${key}`, await compressAndEncodeBase64(String(value)));
    }),
  );

  return `${config.baseUrl}/chatbot/${config.token}?${params.toString()}&_refresh=${Date.now()}`;
}

/** 与主站 injectUserProfileAndTime 对齐的 embed inputs */
export function buildDifyChatbotConfig(options?: {
  userId?: string;
  conversationId?: string;
  memoryPack?: string;
}): DifyChatbotConfig {
  const accountUserId = getAppAccountUserId();
  const systemVariables: { user_id: string; conversation_id?: string } = {
    user_id: options?.userId ?? getDifyChatbotUserId(),
  };
  if (options?.conversationId !== undefined) {
    systemVariables.conversation_id = options.conversationId;
  }

  const pushPlan = getNextWeekPushPlan();
  const rebalanceFocus = pushPlan?.generalFocus?.join('、')
    || pushPlan?.oralSandbox?.focus
    || '';
  const graphSummary = getGraphSummaryLocal();
  const profileBase = getUserCurrentProfile();
  const profileWithGraph = graphSummary
    ? `${profileBase}; Graph: ${graphSummary.replace(/\n/g, '; ')}`
    : profileBase;
  const memoryPack = String(options?.memoryPack || '').trim();

  return {
    token: DIFY_EMBED_TOKEN,
    baseUrl: DIFY_EMBED_BASE_URL.replace(/\/$/, ''),
    inputs: {
      app_user_id: accountUserId,
      user_current_profile: profileWithGraph,
      _system_time: getCurrentFormattedTime(),
      _system_timestamp_ms: Date.now(),
      ...(rebalanceFocus ? { training_rebalance_focus: rebalanceFocus } : {}),
      ...(memoryPack ? { memory_pack: memoryPack } : {}),
    },
    systemVariables,
    userVariables: {},
  };
}

export async function applyDifyChatbotConfigAsync(options?: {
  userId?: string;
  conversationId?: string;
  skipMemoryPack?: boolean;
}): Promise<DifyChatbotConfig> {
  const memoryPack = options?.skipMemoryPack
    ? ''
    : await fetchEmbedMemoryPack();
  const config = buildDifyChatbotConfig({
    userId: options?.userId,
    conversationId: options?.conversationId,
    memoryPack,
  });
  window.difyChatbotConfig = config;
  return config;
}

/**
 * 按 Dify embed.js 规则压缩 query，供 iframe / embed 使用。
 * 新 embed 桶 + 空 conversation_id，无需等待后端 embed-session（避免 AbortError）。
 */
export async function buildDifyChatbotIframeUrl(options?: {
  userId?: string;
  forceNew?: boolean;
}): Promise<string> {
  const userId = options?.userId ?? getDifyChatbotUserId();
  const memoryPack = await fetchEmbedMemoryPack();
  let config = buildDifyChatbotConfig({
    userId,
    conversationId: '',
    memoryPack,
  });
  let url = await encodeConfigToChatbotUrl(config);
  if (url.length > EMBED_IFRAME_URL_MAX_LEN && memoryPack) {
    console.warn('[difyChatbot] iframe URL exceeds limit with memory_pack; retrying without memory_pack.');
    config = buildDifyChatbotConfig({ userId, conversationId: '', memoryPack: '' });
    url = await encodeConfigToChatbotUrl(config);
  }
  if (url.length > EMBED_IFRAME_URL_MAX_LEN) {
    console.warn('[difyChatbot] iframe URL still exceeds 2048 chars; reduce inputs if load fails.');
  }
  return url;
}

export function applyDifyChatbotConfig(): DifyChatbotConfig {
  const config = buildDifyChatbotConfig();
  window.difyChatbotConfig = config;
  return config;
}

/** 刷新 inputs / user_id；重建 embed iframe（embed.js 仅在加载时读 config） */
export function refreshDifyChatbotContext(): void {
  const pushPlan = getNextWeekPushPlan();
  if (pushPlan?.generalFocus?.length) {
    localStorage.setItem('superme_dify_context_update', JSON.stringify({
      type: 'training_rebalance',
      focus: pushPlan.generalFocus,
      timestamp: Date.now(),
    }));
  }
  if (embedLoaded || document.getElementById(DIFY_EMBED_TOKEN)) {
    unloadDifyChatbotEmbed();
    loadDifyChatbotEmbed();
    return;
  }
  void applyDifyChatbotConfigAsync();
}

export function unloadDifyChatbotEmbed(): void {
  document.getElementById('dify-chatbot-bubble-button')?.remove();
  document.getElementById('dify-chatbot-bubble-window')?.remove();
  document.getElementById(DIFY_EMBED_TOKEN)?.remove();
  delete window.difyChatbot;
  embedLoaded = false;
}

/** 登录成功后注入配置并动态加载 embed.min.js（仅一次） */
export function loadDifyChatbotEmbed(): void {
  void loadDifyChatbotEmbedAsync();
}

async function loadDifyChatbotEmbedAsync(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  ensureDifyEmbedScope();
  await applyDifyChatbotConfigAsync();

  if (embedLoaded || document.getElementById(DIFY_EMBED_TOKEN)) {
    embedLoaded = true;
    return;
  }

  const script = document.createElement('script');
  script.src = `${DIFY_EMBED_BASE_URL.replace(/\/$/, '')}/embed.min.js`;
  script.id = DIFY_EMBED_TOKEN;
  script.defer = true;
  document.body.appendChild(script);
  embedLoaded = true;
}

/** 用户标识变更后重建 embed，使 systemVariables.user_id 生效 */
export function reloadDifyChatbotEmbed(): void {
  unloadDifyChatbotEmbed();
  loadDifyChatbotEmbed();
}

declare global {
  interface Window {
    difyChatbotConfig?: DifyChatbotConfig;
    difyChatbot?: {
      open?: () => void;
      close?: () => void;
    };
  }
}
