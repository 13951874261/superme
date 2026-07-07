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
const EMBED_IFRAME_URL_MAX_LEN = 8192;

const DIFY_EMBED_CONVERSATION_PREFIX = 'dify_embed_conversation_';
const DIFY_EMBED_SID_KEY = 'dify_embed_session_id';
const DIFY_EMBED_MIGRATED = 'dify_embed_isolated_session_v1';
const DIFY_EMBED_PAGE_TOKEN_KEY = 'dify_embed_page_token';
const MEMORY_PACK_CACHE_MS = 60_000;
const EMBED_PROFILE_MAX_LEN = 200;

let cachedMemoryPack: { userId: string; text: string; at: number } | null = null;
let memoryPackInflight: Promise<string> | null = null;
let memoryPackInflightUser = '';
let cachedIframeUrl: { key: string; url: string; at: number } | null = null;
let iframeUrlInflight: Promise<string> | null = null;
const IFRAME_URL_CACHE_MS = 60_000;

function invalidateMemoryPackCache(): void {
  cachedMemoryPack = null;
  cachedIframeUrl = null;
  iframeUrlInflight = null;
}

/**
 * 每次整页进入（reload/navigate）轮换 embed 桶，避免 Dify 域 localStorage 里过期 conversation_id
 * 触发 Conversation Not Exists（/api/messages）。
 */
export function rotateEmbedSessionOnPageLoad(): void {
  ensureDifyEmbedScope();
  const pageToken = String(performance.timeOrigin);
  const prev = sessionStorage.getItem(DIFY_EMBED_PAGE_TOKEN_KEY);
  if (prev !== pageToken) {
    sessionStorage.setItem(DIFY_EMBED_PAGE_TOKEN_KEY, pageToken);
    getOrCreateEmbedSessionId(true);
  }
}

/** App 启动时预拉 memory_pack，打开助手面板时更快 */
export function prefetchEmbedMemoryPack(): void {
  void fetchEmbedMemoryPackCached();
}

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
  invalidateMemoryPackCache();
  window.dispatchEvent(new Event('dify-assistant-open'));
  void prepareDifyAssistantIframe(true).finally(() => refreshDifyChatbotContext());
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
  return fetchEmbedMemoryPackCached(accountUserId, true);
}

async function fetchEmbedMemoryPackCached(
  accountUserId?: string,
  bypassCache = false,
): Promise<string> {
  const uid = String(accountUserId || getAppAccountUserId()).trim();
  if (!uid) return '';

  const now = Date.now();
  if (
    !bypassCache
    && cachedMemoryPack?.userId === uid
    && now - cachedMemoryPack.at < MEMORY_PACK_CACHE_MS
  ) {
    return cachedMemoryPack.text;
  }

  if (memoryPackInflight && memoryPackInflightUser === uid) {
    return memoryPackInflight;
  }

  memoryPackInflightUser = uid;
  memoryPackInflight = (async () => {
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
      const clipped = text.length > EMBED_MEMORY_PACK_MAX_LEN
        ? text.slice(0, EMBED_MEMORY_PACK_MAX_LEN)
        : text;
      cachedMemoryPack = { userId: uid, text: clipped, at: Date.now() };
      return clipped;
    } catch (e) {
      console.warn('[difyChatbot] fetch memory_pack failed:', e);
      return '';
    }
  })();

  try {
    return await memoryPackInflight;
  } finally {
    memoryPackInflight = null;
    memoryPackInflightUser = '';
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
    Object.entries(config.systemVariables)
      .filter(([, value]) => value !== undefined && String(value).trim() !== '')
      .map(async ([key, value]) => {
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

function cloneDifyChatbotConfig(config: DifyChatbotConfig): DifyChatbotConfig {
  return {
    ...config,
    inputs: { ...config.inputs },
    systemVariables: { ...config.systemVariables },
    userVariables: { ...config.userVariables },
  };
}

/** iframe URL 超 2048 时优先保留 memory_pack，压缩侧写等次要 inputs */
async function fitConfigToEmbedUrl(config: DifyChatbotConfig): Promise<{ config: DifyChatbotConfig; url: string }> {
  let working = cloneDifyChatbotConfig(config);
  let url = await encodeConfigToChatbotUrl(working);
  if (url.length <= EMBED_IFRAME_URL_MAX_LEN) {
    return { config: working, url };
  }

  const shrinkSteps: Array<(inputs: Record<string, string | number>) => void> = [
    (inputs) => { delete inputs.training_rebalance_focus; },
    (inputs) => {
      const profile = String(inputs.user_current_profile || '');
      inputs.user_current_profile = profile.slice(0, 280);
    },
    (inputs) => {
      inputs.user_current_profile = String(inputs.user_current_profile || '').slice(0, 120);
    },
    (inputs) => {
      const pack = String(inputs.memory_pack || '').trim();
      if (!pack) return;
      const firstBlock = pack.split('\n\n').slice(0, 2).join('\n\n');
      inputs.memory_pack = firstBlock.slice(0, 700);
    },
    (inputs) => { delete inputs.user_current_profile; },
    (inputs) => {
      const pack = String(inputs.memory_pack || '').trim();
      inputs.memory_pack = pack.split('\n')[0]?.slice(0, 400) || pack.slice(0, 400);
    },
    (inputs) => { delete inputs.memory_pack; },
  ];

  for (const step of shrinkSteps) {
    step(working.inputs);
    url = await encodeConfigToChatbotUrl(working);
    if (url.length <= EMBED_IFRAME_URL_MAX_LEN) {
      console.warn('[difyChatbot] iframe URL shrunk to fit 2048 limit (memory_pack kept if possible).');
      return { config: working, url };
    }
  }

  console.warn('[difyChatbot] iframe URL still exceeds 2048 after shrink; load may fail.');
  return { config: working, url };
}

/** 与主站 injectUserProfileAndTime 对齐的 embed inputs */
export function buildDifyChatbotConfig(options?: {
  userId?: string;
  conversationId?: string;
  memoryPack?: string;
  embedCompact?: boolean;
}): DifyChatbotConfig {
  const accountUserId = getAppAccountUserId();
  const systemVariables: { user_id: string; conversation_id?: string } = {
    user_id: options?.userId ?? getDifyChatbotUserId(),
  };
  const convId = String(options?.conversationId ?? '').trim();
  if (convId) {
    systemVariables.conversation_id = convId;
  }

  const pushPlan = getNextWeekPushPlan();
  const rebalanceFocus = pushPlan?.generalFocus?.join('、')
    || pushPlan?.oralSandbox?.focus
    || '';
  const graphSummary = getGraphSummaryLocal();
  const profileBase = getUserCurrentProfile();
  let profileWithGraph = graphSummary
    ? `${profileBase}; Graph: ${graphSummary.replace(/\n/g, '; ')}`
    : profileBase;
  if (options?.embedCompact && profileWithGraph.length > EMBED_PROFILE_MAX_LEN) {
    profileWithGraph = profileWithGraph.slice(0, EMBED_PROFILE_MAX_LEN);
  }
  const memoryPack = String(options?.memoryPack || '').trim();
  let embedMemoryPack = memoryPack;
  if (options?.embedCompact && embedMemoryPack) {
    embedMemoryPack = embedMemoryPack.split('\n\n').slice(0, 2).join('\n\n').slice(0, 700);
  }

  return {
    token: DIFY_EMBED_TOKEN,
    baseUrl: DIFY_EMBED_BASE_URL.replace(/\/$/, ''),
    inputs: {
      app_user_id: accountUserId,
      user_current_profile: profileWithGraph,
      _system_time: getCurrentFormattedTime(),
      _system_timestamp_ms: Date.now(),
      ...(rebalanceFocus && !options?.embedCompact ? { training_rebalance_focus: rebalanceFocus } : {}),
      ...(embedMemoryPack ? { memory_pack: embedMemoryPack } : {}),
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
 * 不传 sys.conversation_id（空值会触发 Dify 拉 /api/messages 报 Conversation Not Exists）。
 */
export async function buildDifyChatbotIframeUrl(options?: {
  userId?: string;
  forceNew?: boolean;
}): Promise<string> {
  const userId = options?.userId ?? getDifyChatbotUserId(options?.forceNew);
  const memoryPack = await fetchEmbedMemoryPackCached();
  const config = buildDifyChatbotConfig({
    userId,
    memoryPack,
    embedCompact: true,
  });
  const fitted = await fitConfigToEmbedUrl(config);
  if (memoryPack && !fitted.config.inputs.memory_pack) {
    console.warn('[difyChatbot] memory_pack dropped from iframe URL after shrink; workflow HTTP fallback only.');
  }
  return fitted.url;
}

/** 预构建 iframe URL（App 启动时调用，打开助手面板时几乎无需等待） */
export async function prepareDifyAssistantIframe(forceNew = false): Promise<string> {
  const userId = getDifyChatbotUserId(forceNew);
  const cacheKey = `${userId}::${getAppAccountUserId()}`;
  const now = Date.now();
  if (
    !forceNew
    && cachedIframeUrl?.key === cacheKey
    && now - cachedIframeUrl.at < IFRAME_URL_CACHE_MS
  ) {
    return cachedIframeUrl.url;
  }
  if (iframeUrlInflight) {
    return iframeUrlInflight;
  }
  iframeUrlInflight = buildDifyChatbotIframeUrl({ userId, forceNew })
    .then((url) => {
      cachedIframeUrl = { key: cacheKey, url, at: Date.now() };
      return url;
    })
    .finally(() => {
      iframeUrlInflight = null;
    });
  return iframeUrlInflight;
}

export function applyDifyChatbotConfig(): DifyChatbotConfig {
  const config = buildDifyChatbotConfig();
  window.difyChatbotConfig = config;
  return config;
}

/** 刷新 inputs / user_id；重建 embed iframe（embed.js 仅在加载时读 config） */
export function refreshDifyChatbotContext(): void {
  invalidateMemoryPackCache();
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
