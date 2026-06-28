import {
  getAppUserId,
  getUserCurrentProfile,
  getCurrentFormattedTime,
} from './profileHelper';

const DIFY_EMBED_TOKEN =
  import.meta.env.VITE_DIFY_CHATBOT_TOKEN || 'SQb8O34NAVGEV18I';
const DIFY_EMBED_BASE_URL =
  import.meta.env.VITE_DIFY_CHATBOT_BASE_URL || 'https://dify.234124123.xyz';

export interface DifyChatbotConfig {
  token: string;
  baseUrl: string;
  inputs: Record<string, string | number>;
  systemVariables: { user_id: string };
  userVariables: Record<string, string>;
}

let embedLoaded = false;

/** 与主站 injectUserProfileAndTime 对齐的 embed inputs */
export function buildDifyChatbotConfig(): DifyChatbotConfig {
  return {
    token: DIFY_EMBED_TOKEN,
    baseUrl: DIFY_EMBED_BASE_URL,
    inputs: {
      user_current_profile: getUserCurrentProfile(),
      _system_time: getCurrentFormattedTime(),
      _system_timestamp_ms: Date.now(),
    },
    systemVariables: {
      user_id: getAppUserId(),
    },
    userVariables: {},
  };
}

export function applyDifyChatbotConfig(): DifyChatbotConfig {
  const config = buildDifyChatbotConfig();
  window.difyChatbotConfig = config;
  return config;
}

/** 刷新 inputs / user_id；移除已挂载 iframe，下次打开时使用最新上下文 */
export function refreshDifyChatbotContext(): void {
  applyDifyChatbotConfig();
  document.getElementById('dify-chatbot-bubble-window')?.remove();
  try {
    window.difyChatbot?.close?.();
  } catch {
    // embed 可能尚未初始化
  }
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

  applyDifyChatbotConfig();

  if (embedLoaded || document.getElementById(DIFY_EMBED_TOKEN)) {
    embedLoaded = true;
    return;
  }

  const script = document.createElement('script');
  script.src = `${DIFY_EMBED_BASE_URL}/embed.min.js`;
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
