import {
  getAppUserId,
  getUserCurrentProfile,
  getCurrentFormattedTime,
} from './profileHelper';
import { getNextWeekPushPlan } from './reviewHelper';

const DIFY_EMBED_TOKEN =
  import.meta.env.VITE_DIFY_CHATBOT_TOKEN || 'Gz2zXRlfsAr5jYgC';
const DIFY_EMBED_BASE_URL =
  import.meta.env.VITE_DIFY_CHATBOT_BASE_URL || 'https://dify.234124123.xyz';

/** 变更此版本可一次性让所有用户脱离旧 localStorage 会话桶 */
const DIFY_EMBED_SCOPE_VERSION = `${DIFY_EMBED_TOKEN}-v2`;
const DIFY_EMBED_SCOPE_STORAGE = 'dify_embed_scope_id';
const DIFY_EMBED_SCOPE_MIGRATED = 'dify_embed_scope_migrated_v2';
const DIFY_EMBED_CONVERSATION_PREFIX = 'dify_embed_conversation_';

/**
 * Dify embed 专用 user_id（与 SQLite getAppUserId 隔离命名空间）。
 * Dify 按 sys.user_id 在浏览器 localStorage 分桶存 conversation_id；
 * 旧桶里若有过期 id，会触发 /api/messages 404 循环。
 */
export function ensureDifyEmbedScope(): void {
  if (localStorage.getItem(DIFY_EMBED_SCOPE_MIGRATED) === '1') return;
  localStorage.setItem(DIFY_EMBED_SCOPE_STORAGE, DIFY_EMBED_SCOPE_VERSION);
  localStorage.setItem(DIFY_EMBED_SCOPE_MIGRATED, '1');
}

export function getDifyChatbotUserId(): string {
  ensureDifyEmbedScope();
  const scope = localStorage.getItem(DIFY_EMBED_SCOPE_STORAGE) || DIFY_EMBED_SCOPE_VERSION;
  return `${getAppUserId()}@${scope}`;
}

function getCachedConversationId(userId: string): string | null {
  return localStorage.getItem(`${DIFY_EMBED_CONVERSATION_PREFIX}${userId}`);
}

function setCachedConversationId(userId: string, conversationId: string | null): void {
  const key = `${DIFY_EMBED_CONVERSATION_PREFIX}${userId}`;
  if (conversationId) localStorage.setItem(key, conversationId);
  else localStorage.removeItem(key);
}

function rotateDifyEmbedScope(): void {
  localStorage.setItem(DIFY_EMBED_SCOPE_STORAGE, `${DIFY_EMBED_TOKEN}-${Date.now()}`);
  window.dispatchEvent(new Event('dify-embed-scope-changed'));
  refreshDifyChatbotContext();
}

/** 新对话：切换 Dify 会话桶，避免复用已失效的 conversation_id */
export function resetDifyChatbotSession(): void {
  setCachedConversationId(getDifyChatbotUserId(), null);
  rotateDifyEmbedScope();
}

export interface DifyChatbotConfig {
  token: string;
  baseUrl: string;
  inputs: Record<string, string | number>;
  systemVariables: { user_id: string; conversation_id?: string };
  userVariables: Record<string, string>;
}

export interface DifyEmbedSession {
  userId: string;
  conversationId: string | null;
  /** 用空 sys.conversation_id 覆盖 Dify iframe 内过期 localStorage */
  forceNew?: boolean;
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

/** 与主站 injectUserProfileAndTime 对齐的 embed inputs */
export function buildDifyChatbotConfig(options?: {
  userId?: string;
  conversationId?: string;
}): DifyChatbotConfig {
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

  return {
    token: DIFY_EMBED_TOKEN,
    baseUrl: DIFY_EMBED_BASE_URL.replace(/\/$/, ''),
    inputs: {
      user_current_profile: getUserCurrentProfile(),
      _system_time: getCurrentFormattedTime(),
      _system_timestamp_ms: Date.now(),
      ...(rebalanceFocus ? { training_rebalance_focus: rebalanceFocus } : {}),
    },
    systemVariables,
    userVariables: {},
  };
}

/**
 * 打开 embed 前解析会话：有效历史继续加载；过期则自动切换 scope 并开新会话。
 * URL 中的 sys.conversation_id 优先于 Dify iframe 内 localStorage，可覆盖过期 id。
 */
export async function resolveDifyEmbedSession(retried = false): Promise<DifyEmbedSession> {
  ensureDifyEmbedScope();
  const userId = getDifyChatbotUserId();
  const cachedConversationId = getCachedConversationId(userId);

  const params = new URLSearchParams({ userId });
  if (cachedConversationId) params.set('conversationId', cachedConversationId);

  try {
    const response = await fetch(`/api/dify/embed-session?${params.toString()}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn('[difyChatbot] embed-session failed:', data);
      return { userId, conversationId: cachedConversationId };
    }

    if (data.stale && !retried) {
      setCachedConversationId(userId, null);
      rotateDifyEmbedScope();
      return resolveDifyEmbedSession(true);
    }

    const resolvedUserId = getDifyChatbotUserId();
    const conversationId = typeof data.conversationId === 'string' ? data.conversationId : null;
    const forceNew = data.forceNew === true || (data.stale === true && retried);
    setCachedConversationId(resolvedUserId, conversationId);
    return { userId: resolvedUserId, conversationId, forceNew };
  } catch (err) {
    console.error('[difyChatbot] resolveDifyEmbedSession error:', err);
    return { userId, conversationId: cachedConversationId };
  }
}

/**
 * 按 Dify embed.js 规则压缩 query，供 iframe / embed 使用。
 * systemVariables.user_id → sys.user_id，与主站 getAppUserId() 一致。
 */
export async function buildDifyChatbotIframeUrl(options?: {
  userId?: string;
  conversationId?: string | null;
  forceNew?: boolean;
}): Promise<string> {
  const config = buildDifyChatbotConfig({
    userId: options?.userId,
    conversationId: options?.forceNew
      ? ''
      : (options?.conversationId ?? undefined),
  });
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

  const url = `${config.baseUrl}/chatbot/${config.token}?${params.toString()}`;
  if (url.length > 2048) {
    console.warn('[difyChatbot] iframe URL exceeds 2048 chars; reduce inputs if load fails.');
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
  applyDifyChatbotConfig();
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
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  ensureDifyEmbedScope();
  applyDifyChatbotConfig();

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
