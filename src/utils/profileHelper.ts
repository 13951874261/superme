import { getErrorLedgerSummary } from './errorLedgerHelper';

const MEMORY_LAYERS_KEY = 'user_memory_layers';
const PROFILE_UPDATED_AT_KEY = 'user_profile_server_updated_at';
const ERROR_LEDGER_KEY = 'user_error_ledger';
const USER_ID_KEY = 'super_agent_user_id';

function sanitizeUserId(id: string): string {
  const cleaned = id.trim().replace(/[^\w\-@.]/g, '_').slice(0, 64);
  return cleaned || 'default-user';
}

function generateAppUserId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `user_${crypto.randomUUID()}`;
  }
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 确保 localStorage 中存在用户 ID。
 * - 已有 ID：直接返回（登录时不覆盖）
 * - 首次登录且传入 customId：使用用户填写的标识
 * - 首次登录且未填写：自动生成 UUID 并持久化
 */
export function ensureAppUserId(customId?: string): string {
  const existing = localStorage.getItem(USER_ID_KEY);
  if (existing) return existing;

  const userId = customId?.trim() ? sanitizeUserId(customId) : generateAppUserId();
  localStorage.setItem(USER_ID_KEY, userId);
  return userId;
}

/** 手动设置用户 ID（如全局设置中修改），会写入 localStorage */
export function setAppUserId(userId: string) {
  localStorage.setItem(USER_ID_KEY, sanitizeUserId(userId));
  window.dispatchEvent(new Event('global-user-id-changed'));
}

export function getAppUserId(): string {
  return localStorage.getItem(USER_ID_KEY) || 'default-user';
}

function getStoredProfileRaw(): string {
  return localStorage.getItem('User_Current_Profile') || localStorage.getItem('user_current_profile') || '';
}

function writeProfileLocal(profile: string, updatedAt?: number) {
  localStorage.setItem('user_current_profile', profile);
  localStorage.setItem('User_Current_Profile', profile);
  if (updatedAt) {
    localStorage.setItem(PROFILE_UPDATED_AT_KEY, String(updatedAt));
  }
  window.dispatchEvent(new Event('global-profile-changed'));
}

async function syncProfileToServer(profileContent?: string): Promise<void> {
  const content = profileContent ?? getStoredProfileRaw();
  try {
    const res = await fetch('/api/user/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: getAppUserId(),
        profileContent: content,
        errorLedger: localStorage.getItem(ERROR_LEDGER_KEY) || '{}',
      }),
    });
    if (res.ok) {
      localStorage.setItem(PROFILE_UPDATED_AT_KEY, String(Date.now()));
    }
  } catch (e) {
    console.warn('[profileHelper] sync to server failed:', e);
  }
}

/**
 * 获取当前持久化的画像
 */
export function getUserCurrentProfile(): string {
  try {
    const raw = localStorage.getItem('User_Current_Profile') || localStorage.getItem('user_current_profile') || '';
    if (!raw) return '';
    if (raw.startsWith('[') && raw.endsWith(']')) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.join('; ');
      }
    }
    return raw;
  } catch (e) {
    return localStorage.getItem('User_Current_Profile') || localStorage.getItem('user_current_profile') || '';
  }
}

/**
 * 保存画像并向全局广播状态同步事件，同时写入后端 SQLite
 */
export function saveUserCurrentProfile(profile: string) {
  writeProfileLocal(profile);
  void syncProfileToServer(profile);
}

/**
 * 从持久化画像中提取结构化短板标签数组
 */
export function getUserProfileFactorsArray(): string[] {
  const raw = localStorage.getItem('User_Current_Profile') || localStorage.getItem('user_current_profile') || '';
  if (!raw) return [];
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).trim()).filter(Boolean);
      }
    } catch {
      /* fall through */
    }
  }
  return raw.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean);
}

/**
 * 追加画像短板并去重，限制最大长度为 5 个标签，并广播同步事件
 */
export function appendUserProfileFactor(newFactorsStr: string) {
  if (!newFactorsStr) return;
  let currentArray: string[] = [];
  const raw = localStorage.getItem('User_Current_Profile') || localStorage.getItem('user_current_profile') || '';
  if (raw) {
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          currentArray = parsed;
        }
      } catch (e) {
        currentArray = raw.split(/; /).map(s => s.trim()).filter(Boolean);
      }
    } else {
      currentArray = raw.split(/[,，;；]/).map(s => s.trim()).filter(Boolean);
    }
  }

  const incoming = newFactorsStr.split(/[,，;；]/).map(s => s.trim()).filter(Boolean);
  incoming.forEach(factor => {
    if (!currentArray.includes(factor)) {
      currentArray.push(factor);
    }
  });

  if (currentArray.length > 5) {
    currentArray = currentArray.slice(-5);
  }

  const jsonStr = JSON.stringify(currentArray);
  writeProfileLocal(jsonStr);
  void syncProfileToServer(jsonStr);
}

/**
 * 智能分析提问或上下文，发现英国/美国画像指令时自动执行隐式更新
 */
export function updateProfileFromText(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  // 匹配英国 (UK) 信号
  if (
    lower.includes("切换为英国") || 
    lower.includes("切换为英音") || 
    lower.includes("英国(uk)") || 
    lower.includes("英国 (uk)") ||
    lower.includes("[profile: uk]") ||
    lower.includes("[profile: 英国]") ||
    (lower.includes("英国") && (lower.includes("画像") || lower.includes("对齐") || lower.includes("设定")))
  ) {
    const current = getUserCurrentProfile();
    if (current !== "英国 (UK)") {
      saveUserCurrentProfile("英国 (UK)");
      return true;
    }
  }
  
  // 匹配美国 (US) 信号
  if (
    lower.includes("切换为美国") || 
    lower.includes("切换为美音") || 
    lower.includes("美国(us)") || 
    lower.includes("美国 (us)") ||
    lower.includes("[profile: us]") ||
    lower.includes("[profile: 美国]") ||
    (lower.includes("美国") && (lower.includes("画像") || lower.includes("对齐") || lower.includes("设定")))
  ) {
    const current = getUserCurrentProfile();
    if (current !== "美国 (US)") {
      saveUserCurrentProfile("美国 (US)");
      return true;
    }
  }
  
  return false;
}

/**
 * 遍历并分析大模型返回的所有字符串，实现隐式自适应学习
 */
export function interceptOutputText(output: any): void {
  if (!output) return;
  if (typeof output === 'string') {
    updateProfileFromText(output);
  } else if (typeof output === 'object') {
    for (const key in output) {
      if (Object.prototype.hasOwnProperty.call(output, key)) {
        const val = output[key];
        if (typeof val === 'string') {
          updateProfileFromText(val);
        } else if (val && typeof val === 'object') {
          interceptOutputText(val);
        }
      }
    }
  }
}

/**
 * 获取当前格式化时间（Asia/Shanghai），含星期
 */
export function getCurrentFormattedTime(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  const formatter = new Intl.DateTimeFormat('zh-CN', options);
  const parts = formatter.formatToParts(now);
  const val = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const weekdayMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dayOfWeek = weekdayMap[now.getDay()];

  return `${val('year')}-${val('month')}-${val('day')} ${val('hour')}:${val('minute')}:${val('second')} ${dayOfWeek}`;
}

/**
 * 包装并注入当前画像到 Dify 请求体中
 */
export function injectUserProfile(inputs: Record<string, any> = {}): Record<string, any> {
  for (const key in inputs) {
    if (Object.prototype.hasOwnProperty.call(inputs, key) && typeof inputs[key] === 'string') {
      updateProfileFromText(inputs[key]);
    }
  }
  
  const profile = getUserCurrentProfile();
  const result = { ...inputs };
  const errorSummary = getErrorLedgerSummary();

  if (profile) {
    if (typeof result.theme === "string" && !result.theme.includes("Weakness:")) {
      result.theme = `${result.theme} (Weakness: ${profile})`;
    }
    if (typeof result.topic === "string" && !result.topic.includes("Weakness:")) {
      result.topic = `${result.topic} (Weakness: ${profile})`;
    }
  }

  const incomingProfile = typeof result.user_current_profile === 'string' ? result.user_current_profile.trim() : '';
  const graphSummary = getGraphSummaryLocal();
  const graphLine = graphSummary ? `Graph: ${graphSummary.replace(/\n/g, '; ')}` : '';
  const mergedProfile = [profile, errorSummary, graphLine, incomingProfile].filter(Boolean).join('; ');

  return {
    ...result,
    user_current_profile: mergedProfile || profile,
  };
}

/**
 * 包装并注入当前画像与系统时间到 Dify 请求体中
 */
export function injectUserProfileAndTime(inputs: Record<string, any> = {}): Record<string, any> {
  const result = injectUserProfile(inputs);
  return {
    ...result,
    _system_time: getCurrentFormattedTime(),
    _system_timestamp_ms: Date.now(),
  };
}

/**
 * 应用启动时从后端拉取画像/长效记忆，并与 localStorage 按 updated_at 合并
 */
export async function loadUserProfileFromServer(userId?: string): Promise<void> {
  const uid = userId || getAppUserId();
  const localRaw = getStoredProfileRaw();
  const localUpdatedAt = Number(localStorage.getItem(PROFILE_UPDATED_AT_KEY) || 0);

  try {
    const res = await fetch(`/api/user/profile/${encodeURIComponent(uid)}`);
    if (!res.ok) {
      if (localRaw) void syncProfileToServer(localRaw);
      return;
    }

    const json = await res.json();
    if (!json?.success) return;

    const {
      profile_content,
      error_ledger,
      memory_layers,
      updated_at,
    } = json.data || {};
    const serverUpdatedAt = Number(updated_at || 0);

    if (error_ledger && (typeof error_ledger === 'object' || error_ledger !== '{}')) {
      localStorage.setItem(
        ERROR_LEDGER_KEY,
        typeof error_ledger === 'string' ? error_ledger : JSON.stringify(error_ledger),
      );
    }

    if (memory_layers && typeof memory_layers === 'object') {
      localStorage.setItem(MEMORY_LAYERS_KEY, JSON.stringify(memory_layers));
    }

    if (profile_content && serverUpdatedAt >= localUpdatedAt) {
      writeProfileLocal(profile_content, serverUpdatedAt);
      return;
    }

    if (localRaw && (localUpdatedAt > serverUpdatedAt || !profile_content)) {
      void syncProfileToServer(localRaw);
    }
  } catch (e) {
    console.warn('[profileHelper] load from server failed:', e);
    if (localRaw) void syncProfileToServer(localRaw);
  }
}

export function saveUserErrorLedger(ledger: string | Record<string, unknown>) {
  const value = typeof ledger === 'string' ? ledger : JSON.stringify(ledger);
  localStorage.setItem(ERROR_LEDGER_KEY, value);
  void syncProfileToServer();
}

export interface MemoryIngestPayload {
  profileDelta?: string;
  episode?: Record<string, unknown>;
  semantic?: Record<string, unknown>;
  source: string;
}

export async function ingestUserMemory(payload: MemoryIngestPayload): Promise<void> {
  try {
    const res = await fetch('/api/user/memory/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getAppUserId(), ...payload }),
    });
    if (!res.ok) return;

    const json = await res.json();
    const { profile_content, updated_at, memory_layers } = json?.data || {};
    if (profile_content) {
      writeProfileLocal(profile_content, Number(updated_at || Date.now()));
    }
    if (memory_layers && typeof memory_layers === 'object') {
      localStorage.setItem(MEMORY_LAYERS_KEY, JSON.stringify(memory_layers));
    }
  } catch (e) {
    console.warn('[profileHelper] memory ingest failed:', e);
  }
}

/** 触发后台 Dreaming：去重 L2、升格高频短板至 L3 */
export async function runMemoryDreaming(userId?: string): Promise<void> {
  try {
    const res = await fetch('/api/user/memory/dreaming/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userId ? { userId } : {}),
    });
    if (!res.ok) return;
    await loadUserProfileFromServer(userId);
  } catch (e) {
    console.warn('[profileHelper] memory dreaming failed:', e);
  }
}

/** 读取本地缓存的 L2 关系图谱摘要（最多 8 条关系） */
export function getGraphSummaryLocal(): string {
  try {
    const raw = localStorage.getItem(MEMORY_LAYERS_KEY);
    if (!raw) return '';
    const layers = JSON.parse(raw) as {
      l2_graph?: { relations?: { from?: string; rel?: string; to?: string; evidence?: string }[] };
    };
    const relations = layers.l2_graph?.relations || [];
    if (!relations.length) return '';
    return relations.slice(0, 8).map((r, i) => {
      const ev = r.evidence ? ` (${String(r.evidence).slice(0, 60)})` : '';
      return `${i + 1}. ${r.from} —[${r.rel}]→ ${r.to}${ev}`;
    }).join('\n');
  } catch {
    return '';
  }
}

/** 读取本地缓存的 L2 情景记忆（最多 5 条摘要行） */
export function getRecentEpisodesSummaryLocal(): string {
  try {
    const raw = localStorage.getItem(MEMORY_LAYERS_KEY);
    if (!raw) return '';
    const layers = JSON.parse(raw) as { l2_episodes?: Record<string, unknown>[] };
    const episodes = layers.l2_episodes || [];
    return episodes.slice(0, 5).map((ep, i) => {
      const text = String(ep.summary || ep.preview || ep.weaknessScan || '').slice(0, 120);
      return text ? `${i + 1}. ${text}` : '';
    }).filter(Boolean).join('\n');
  } catch {
    return '';
  }
}

/**
 * 登录成功后调用：确定 userId 并从后端拉取该用户的画像/记忆
 */
export async function initializeUserSession(customUserId?: string): Promise<string> {
  const userId = ensureAppUserId(customUserId);
  await loadUserProfileFromServer(userId);
  return userId;
}
