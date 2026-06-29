import {
  getAppUserId,
  getUserCurrentProfile,
  getCurrentFormattedTime,
} from './profileHelper';

const DIFY_EMBED_TOKEN =
  import.meta.env.VITE_DIFY_CHATBOT_TOKEN || 'Gz2zXRlfsAr5jYgC';
const DIFY_EMBED_BASE_URL =
  import.meta.env.VITE_DIFY_CHATBOT_BASE_URL || 'https://dify.234124123.xyz';

/** 变更此版本可一次性让所有用户脱离旧 localStorage 会话桶 */
const DIFY_EMBED_SCOPE_VERSION = `${DIFY_EMBED_TOKEN}-v2`;
const DIFY_EMBED_SCOPE_STORAGE = 'dify_embed_scope_id';
const DIFY_EMBED_SCOPE_MIGRATED = 'dify_embed_scope_migrated_v2';

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

/** 新对话：切换 Dify 会话桶，避免复用已失效的 conversation_id */
export function resetDifyChatbotSession(): void {
  localStorage.setItem(DIFY_EMBED_SCOPE_STORAGE, `${DIFY_EMBED_TOKEN}-${Date.now()}`);
  window.dispatchEvent(new Event('dify-embed-scope-changed'));
  refreshDifyChatbotContext();
}

export interface DifyChatbotConfig {
  token: string;
  baseUrl: string;
  inputs: Record<string, string | number>;
  systemVariables: { user_id: string };
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

/** 与主站 injectUserProfileAndTime 对齐的 embed inputs */
export function buildDifyChatbotConfig(): DifyChatbotConfig {
  return {
    token: DIFY_EMBED_TOKEN,
    baseUrl: DIFY_EMBED_BASE_URL.replace(/\/$/, ''),
    inputs: {
      user_current_profile: getUserCurrentProfile(),
      _system_time: getCurrentFormattedTime(),
      _system_timestamp_ms: Date.now(),
    },
    systemVariables: {
      user_id: getDifyChatbotUserId(),
    },
    userVariables: {},
  };
}

/**
 * 按 Dify embed.js 规则压缩 query，供 iframe / embed 使用。
 * systemVariables.user_id → sys.user_id，与主站 getAppUserId() 一致。
 */
export async function buildDifyChatbotIframeUrl(): Promise<string> {
  const config = buildDifyChatbotConfig();
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
