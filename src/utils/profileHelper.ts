import { getErrorLedgerSummary } from './errorLedgerHelper';
import {
  applyCareerPathLocal,
  formatCareerProfileLine,
  parseCareerPath,
  readCareerPath,
  type CareerPath,
} from './careerProgression';
import {
  clearSessionKeysOnSwitch,
  getLearnItem,
  getStoredProfileRawForUser,
  setLearnItem,
  setPreferenceItem,
  writeProfileLocalForUser,
} from './accountStorage';

const MEMORY_LAYERS_KEY = 'user_memory_layers';
const PROFILE_UPDATED_AT_KEY = 'user_profile_server_updated_at';
const ERROR_LEDGER_KEY = 'user_error_ledger';
const USER_ID_KEY = 'super_agent_user_id';
const PROFILE_STALE_MS = 5 * 60 * 1000;
export const SESSION_INIT_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = SESSION_INIT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 本地画像时间戳是否过期（供 visibility 等场景决定是否 refetch；不改变 loadUserProfileFromServer 强制拉取语义） */
export function isProfileStale(): boolean {
  const updatedAt = Number(getLearnItem(getAppUserId(), PROFILE_UPDATED_AT_KEY) || 0);
  if (!updatedAt) return true;
  return Date.now() - updatedAt > PROFILE_STALE_MS;
}

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
  if (customId?.trim()) {
    const sanitized = sanitizeUserId(customId);
    localStorage.setItem(USER_ID_KEY, sanitized);
    window.dispatchEvent(new Event('global-user-id-changed'));
    return sanitized;
  }

  const existing = localStorage.getItem(USER_ID_KEY);
  if (existing && existing !== 'default-user' && existing.trim() !== '') return existing;

  const defaultId = 'lzhmy';
  localStorage.setItem(USER_ID_KEY, defaultId);
  return defaultId;
}

/** 手动设置用户 ID（如全局设置中修改），会写入 localStorage */
export function setAppUserId(userId: string, options?: { dispatch?: boolean }) {
  localStorage.setItem(USER_ID_KEY, sanitizeUserId(userId));
  if (options?.dispatch === false) return;
  window.dispatchEvent(new Event('global-user-id-changed'));
}

/** 换号水合完成后再广播，避免 App key remount 抢在 load 之前 */
export function dispatchUserIdChanged() {
  window.dispatchEvent(new Event('global-user-id-changed'));
}

export function getAppUserId(): string {
  const existing = localStorage.getItem(USER_ID_KEY);
  if (existing && existing !== 'default-user' && existing.trim() !== '') return existing;
  return ensureAppUserId();
}

function getStoredProfileRaw(userId?: string): string {
  return getStoredProfileRawForUser(userId || getAppUserId());
}

function writeProfileLocal(profile: string, updatedAt?: number, userId?: string) {
  const uid = userId || getAppUserId();
  writeProfileLocalForUser(uid, profile, updatedAt);
  window.dispatchEvent(new Event('global-profile-changed'));
}

async function syncProfileToServer(profileContent?: string, userId?: string): Promise<void> {
  const uid = userId || getAppUserId();
  const content = profileContent ?? getStoredProfileRaw(uid);
  if (!String(content || '').trim()) return;
  try {
    const res = await fetch('/api/user/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: uid,
        profileContent: content,
        errorLedger: getLearnItem(uid, ERROR_LEDGER_KEY) || '{}',
      }),
    });
    if (res.ok) {
      setLearnItem(uid, PROFILE_UPDATED_AT_KEY, String(Date.now()));
    }
  } catch (e) {
    console.warn('[profileHelper] sync to server failed:', e);
  }
}

/**
 * 获取当前持久化的画像
 */
/**
 * 净化画像/记忆文本，彻底移除大模型思考链块（<think>...</think>）、残余尖括号，规避 Dify Jinja2 模板 500 报错
 */
export function sanitizeProfileContent(raw: string): string {
  if (!raw) return '';
  let cleaned = String(raw)
    .replace(/<think[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking[\s\S]*?<\/thinking>/gi, '')
    .replace(/<think[\s\S]*/gi, '')
    .replace(/<thinking[\s\S]*/gi, '')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

/**
 * 获取清洗并脱敏后的用户画像描述
 */
export function getUserCurrentProfile(): string {
  try {
    const raw = getStoredProfileRaw();
    if (!raw) return '';
    let resultStr = raw;
    if (raw.startsWith('[') && raw.endsWith(']')) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        resultStr = parsed.join('; ');
      }
    }
    return sanitizeProfileContent(resultStr);
  } catch (e) {
    return sanitizeProfileContent(getStoredProfileRaw());
  }
}

export const ACCENT_PREF_KEY = 'super_agent_accent_pref';
export const ACCENT_CHANGED_EVENT = 'superme-accent-changed';

export function isAccentProfile(value: string): boolean {
  const t = String(value || '').trim();
  return t === '英国 (UK)' || t === '美国 (US)';
}

export function getAccentPref(): string {
  try {
    const saved = String(localStorage.getItem(ACCENT_PREF_KEY) || '').trim();
    if (isAccentProfile(saved)) return saved;
    const fromProfile = String(getUserCurrentProfile() || '').trim();
    return isAccentProfile(fromProfile) ? fromProfile : '';
  } catch {
    return '';
  }
}

export function saveAccentPref(value: string) {
  const next = isAccentProfile(value) ? String(value).trim() : '';
  setPreferenceItem(ACCENT_PREF_KEY, next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ACCENT_CHANGED_EVENT));
  }
}

export function sanitizeWeaknessProfile(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (isAccentProfile(raw)) return '';
  return raw
    .split(/[;；,，]/)
    .map((part) => part.trim())
    .filter((part) => part && !isAccentProfile(part))
    .join('; ');
}

export function getUserWeaknessProfile(): string {
  return sanitizeWeaknessProfile(getUserCurrentProfile());
}

/**
 * 保存画像并向全局广播状态同步事件，同时写入后端 SQLite
 */
export function saveUserCurrentProfile(profile: string) {
  writeProfileLocal(profile);
  void syncProfileToServer(profile);
}

/** 调用后端 Dify Profile Dedupe 工作流，手动压缩画像并可选持久化 */
export async function compressUserProfile(
  profileContent?: string,
  save = true,
): Promise<{
  mergedProfile: string;
  dedupeCount: number;
  source: string;
  beforeLength: number;
  afterLength: number;
}> {
  const res = await fetch('/api/user/profile/compress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: getAppUserId(),
      profileContent: profileContent ?? getStoredProfileRaw(),
      save,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `画像压缩失败 HTTP ${res.status}`);
  }
  const data = json.data || {};
  const mergedProfile = String(data.profile_content || '').trim();
  if (save && mergedProfile) {
    writeProfileLocal(mergedProfile, Number(data.updated_at || Date.now()));
  }
  return {
    mergedProfile,
    dedupeCount: Number(data.dedupe_count || 0),
    source: String(data.source || 'unknown'),
    beforeLength: Number(data.before_length || 0),
    afterLength: Number(data.after_length || mergedProfile.length),
  };
}

/** 将 career 写入本地 memory_layers 镜像并 POST 到账号（不传 profileContent） */
export async function syncCareerToServer(career?: CareerPath): Promise<void> {
  const path = parseCareerPath(career ?? readCareerPath());
  const uid = getAppUserId();
  try {
    let layers: Record<string, unknown> = {};
    try {
      layers = JSON.parse(getLearnItem(uid, MEMORY_LAYERS_KEY) || '{}');
    } catch {
      layers = {};
    }
    layers.career_path = path;
    setLearnItem(uid, MEMORY_LAYERS_KEY, JSON.stringify(layers));

    await fetch('/api/user/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: uid,
        careerPath: path,
      }),
    });
  } catch (e) {
    console.warn('[profileHelper] sync career failed:', e);
  }
}

/** 从服务端 memory_layers.career_path 还原到本地 career 镜像 */
export function applyCareerFromMemoryLayers(memoryLayers: unknown): void {
  if (!memoryLayers || typeof memoryLayers !== 'object') return;
  const raw = (memoryLayers as { career_path?: unknown }).career_path;
  if (!raw) return;
  applyCareerPathLocal(parseCareerPath(raw));
}

/** 账号级保存：先写本地再异步同步服务端，立即返回本地 next */
export function saveCareerPathForAccount(data: CareerPath): CareerPath {
  const next = applyCareerPathLocal(data);
  void syncCareerToServer(next);
  return next;
}

/** 将职业路径行前置到画像字符串，并去掉旧职业块 */
export function buildCareerAwareProfileString(baseProfile: string, career: CareerPath = readCareerPath()): string {
  const careerLine = formatCareerProfileLine(career);
  let rest = String(baseProfile || '').trim();
  // Remove any existing career line block (from 职业路径: through 能力匹配度=N%)
  rest = rest.replace(/职业路径:\s*起点=[^;]*;\s*当前=[^;]*;\s*目标=[^;]*;\s*能力匹配度=\d+%/g, '').trim();
  rest = rest.replace(/^;\s*|;?\s*$/g, '').replace(/;\s*;/g, ';').trim();
  return [careerLine, rest].filter(Boolean).join('; ');
}

/**
 * 从持久化画像中提取结构化短板标签数组
 */
export function getUserProfileFactorsArray(): string[] {
  const raw = getStoredProfileRaw();
  if (!raw) return [];
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).trim()).filter((s) => s && !isAccentProfile(s));
      }
    } catch {
      /* fall through */
    }
  }
  return raw.split(/[,，;；]/).map((s) => s.trim()).filter((s) => s && !isAccentProfile(s));
}

/**
 * 追加画像短板：经 ingestUserMemory + 服务端 Profile Dedupe（latest wins）
 */
export function appendUserProfileFactor(newFactorsStr: string) {
  if (!newFactorsStr) return;
  void ingestUserMemory({
    source: 'profile_factor_append',
    profileDelta: String(newFactorsStr).trim(),
  }).then(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('global-profile-changed'));
    }
  }).catch((e) => {
    console.warn('[profileHelper] appendUserProfileFactor failed:', e);
  });
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
    if (getAccentPref() !== "英国 (UK)") {
      saveAccentPref("英国 (UK)");
      void ingestUserMemory({ source: 'profile_text', l3VarsDelta: { accent: 'UK', spelling_variant: 'UK' } });
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
    if (getAccentPref() !== "美国 (US)") {
      saveAccentPref("美国 (US)");
      void ingestUserMemory({ source: 'profile_text', l3VarsDelta: { accent: 'US', spelling_variant: 'US' } });
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

/** 读取 localStorage 中 memory_layers.l3_vars 结构化画像 */
export function getL3VarsLocal(): Record<string, string> {
  try {
    const raw = getLearnItem(getAppUserId(), MEMORY_LAYERS_KEY);
    if (!raw) return {};
    const layers = JSON.parse(raw) as { l3_vars?: Record<string, string> };
    const vars = layers.l3_vars;
    if (!vars || typeof vars !== 'object' || Array.isArray(vars)) return {};
    return vars;
  } catch {
    return {};
  }
}

export function formatL3VarsForProfile(vars: Record<string, string>): string {
  const parts: string[] = [];
  if (vars.accent) parts.push(`Accent:${vars.accent}`);
  if (vars.training_goal) parts.push(`Goal:${vars.training_goal}`);
  if (vars.weakness_focus) parts.push(`Focus:${vars.weakness_focus}`);
  return parts.join('; ');
}

/** 画像页/调试用：与 inject 静态段一致（不含按请求动态的 Recall） */
export function buildStaticDifyProfilePreview(
  baseProfile: string,
  career: CareerPath = readCareerPath(),
): string {
  const profile = buildCareerAwareProfileString(baseProfile, career);
  const l3Line = formatL3VarsForProfile(getL3VarsLocal());
  const errorSummary = getErrorLedgerSummary();
  const graphSummary = getGraphSummaryLocal();
  const graphLine = graphSummary ? `Graph: ${graphSummary.replace(/\n/g, '; ')}` : '';
  return [profile, l3Line, errorSummary, graphLine].filter(Boolean).join('; ');
}

export function getProfileUpdatedAtMs(): number {
  return Number(getLearnItem(getAppUserId(), PROFILE_UPDATED_AT_KEY) || 0);
}

function normalizeRecallQuery(query: string): string {
  return String(query || '').trim().toLowerCase();
}

function recallQueryTokens(query: string): string[] {
  const q = normalizeRecallQuery(query);
  if (!q) return [];
  const parts = q.split(/[\s,，;；、。！？!?]+/).filter((t) => t.length >= 2);
  if (!parts.length) return [q];
  return parts;
}

function scoreRecallText(query: string, tokens: string[], text: string): number {
  const t = String(text || '').toLowerCase();
  if (!t || !query) return 0;
  let score = 0;
  if (t.includes(query)) score += 10;
  for (const tok of tokens) {
    if (tok.length >= 2 && t.includes(tok)) score += 3;
  }
  return score;
}

function extractRecallQueryFromInputs(inputs: Record<string, unknown>): string {
  const explicit = inputs._memory_recall_query ?? inputs.query;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  for (const key of ['topic', 'theme', 'user_query', 'sys_query']) {
    const val = inputs[key];
    if (typeof val !== 'string' || !val.trim()) continue;
    const cleaned = val.replace(/\s*\(Weakness:[^)]*\)/gi, '').trim();
    if (cleaned.length >= 2) return cleaned;
  }
  return '';
}

/** 基于 localStorage 缓存的 memory_layers 做关键词召回（与 server recall 规则对齐） */
export function recallMemoryLocal(query: string, topK = 5): { query: string; context: string; items: unknown[] } {
  const q = normalizeRecallQuery(query);
  const tokens = recallQueryTokens(q);
  const limit = Math.min(Math.max(topK, 1), 15);
  if (!q) return { query: '', context: '', items: [] };

  let layers: {
    l2_episodes?: Record<string, unknown>[];
    l2_semantics?: Record<string, unknown>[];
    l2_graph?: {
      entities?: { name?: string }[];
      relations?: { from?: string; rel?: string; to?: string; evidence?: string; at?: number }[];
    };
  } = {};
  try {
    const raw = getLearnItem(getAppUserId(), MEMORY_LAYERS_KEY);
    if (raw) layers = JSON.parse(raw);
  } catch {
    return { query: q, context: '', items: [] };
  }

  const profile = getUserCurrentProfile();
  const hits: { kind: string; score: number; text: string; at: number; source?: string; key: string }[] = [];
  const seen = new Set<string>();

  const pushHit = (item: typeof hits[number]) => {
    if (!item.text || seen.has(item.key)) return;
    seen.add(item.key);
    hits.push(item);
  };

  const profileScore = scoreRecallText(q, tokens, profile);
  if (profileScore > 0) {
    pushHit({ kind: 'profile', score: profileScore + 2, text: profile.slice(0, 200), at: 0, key: 'profile:main' });
  }

  for (const sem of layers.l2_semantics || []) {
    const blob = [sem.tag, sem.pattern, sem.evidence, sem.category].filter(Boolean).join(' ');
    const score = scoreRecallText(q, tokens, String(blob));
    if (score > 0) {
      pushHit({
        kind: 'semantic',
        score,
        text: String(sem.pattern || sem.tag || blob).slice(0, 180),
        at: Number(sem.at || 0),
        key: `semantic:${sem.tag || sem.pattern}`,
      });
    }
  }

  for (const ep of layers.l2_episodes || []) {
    const text = String(ep.summary || ep.preview || ep.weaknessScan || ep.practicalTest || '').trim();
    const score = scoreRecallText(q, tokens, text);
    if (score > 0) {
      pushHit({
        kind: 'episode',
        score,
        text: text.slice(0, 180),
        at: Number(ep.at || 0),
        source: String(ep.source || 'unknown'),
        key: `episode:${ep._id || text.slice(0, 40)}`,
      });
    }
  }

  const relations = layers.l2_graph?.relations || [];
  const entities = layers.l2_graph?.entities || [];
  const matchedEntities = new Set<string>();
  for (const e of entities) {
    const name = String(e.name || '').trim();
    if (name && scoreRecallText(q, tokens, name) > 0) matchedEntities.add(name);
  }
  for (const r of relations) {
    const line = `${r.from} ${r.rel} ${r.to} ${r.evidence || ''}`;
    const score = scoreRecallText(q, tokens, line);
    const from = String(r.from || '').trim();
    const to = String(r.to || '').trim();
    const entityBoost = matchedEntities.has(from) || matchedEntities.has(to) ? 4 : 0;
    if (score + entityBoost > 0) {
      pushHit({
        kind: 'graph',
        score: score + entityBoost,
        text: `${r.from} —[${r.rel}]→ ${r.to}`.slice(0, 180),
        at: Number(r.at || 0),
        key: `graph:${r.from}|${r.rel}|${r.to}`,
      });
    }
  }

  hits.sort((a, b) => (b.score - a.score) || (b.at - a.at));
  const items = hits.slice(0, limit);
  const context = items.length
    ? items.map((item, i) => {
      const src = item.source ? ` · ${item.source}` : '';
      return `${i + 1}. [${item.kind}${src}] ${item.text}`;
    }).join('\n')
    : '';

  return { query: q, context, items };
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
  
  const profile = buildCareerAwareProfileString(getUserCurrentProfile());
  const weakness = getUserWeaknessProfile();
  const result = { ...inputs };
  const errorSummary = getErrorLedgerSummary();
  const l3Vars = getL3VarsLocal();
  const l3Line = formatL3VarsForProfile(l3Vars);

  if (weakness) {
    if (typeof result.theme === "string" && !result.theme.includes("Weakness:")) {
      result.theme = `${result.theme} (Weakness: ${weakness})`;
    }
    if (typeof result.topic === "string" && !result.topic.includes("Weakness:")) {
      result.topic = `${result.topic} (Weakness: ${weakness})`;
    }
  }

  const incomingProfile = typeof result.user_current_profile === 'string' ? result.user_current_profile.trim() : '';
  const graphSummary = getGraphSummaryLocal();
  const graphLine = graphSummary ? `Graph: ${graphSummary.replace(/\n/g, '; ')}` : '';

  const recallQuery = extractRecallQueryFromInputs(result);
  const recall = recallQuery ? recallMemoryLocal(recallQuery, 5) : { context: '' };
  const recallLine = recall.context ? `Recall: ${recall.context.replace(/\n/g, ' | ')}` : '';

  const mergedProfile = [profile, l3Line, errorSummary, graphLine, recallLine, incomingProfile].filter(Boolean).join('; ');

  const output: Record<string, any> = {
    ...result,
    user_current_profile: mergedProfile || profile,
    user_accent: l3Vars.accent || '',
    user_spelling_variant: l3Vars.spelling_variant || l3Vars.accent || '',
    user_training_goal: l3Vars.training_goal || '',
    user_locale: l3Vars.locale || 'zh-CN',
    user_timezone: l3Vars.timezone || 'Asia/Shanghai',
  };
  if (recall.context) {
    output.memory_recall_context = recall.context;
  }
  return output;
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
 * 仅取完整注入后的 user_current_profile（职业+短板+L3+账本+图谱+Recall）
 * 凡向 Dify 传画像时优先用此函数，勿裸用 getUserCurrentProfile()
 */
export function getInjectedUserCurrentProfile(inputs: Record<string, any> = {}): string {
  return String(injectUserProfileAndTime(inputs).user_current_profile || '').trim();
}

/**
 * 应用启动时从后端拉取画像/长效记忆，并与「当前账号本地桶」按 updated_at 合并。
 * 禁止用无前缀全局键或他账号桶内容回写目标 userId（U3/U4/U12）。
 */
export async function loadUserProfileFromServer(userId?: string): Promise<void> {
  const uid = userId || getAppUserId();
  const localRaw = getStoredProfileRawForUser(uid);
  const localUpdatedAt = Number(getLearnItem(uid, PROFILE_UPDATED_AT_KEY) || 0);

  const maybeSyncOwnBucket = (reason: string) => {
    if (!String(localRaw || '').trim()) return;
    if (uid !== getAppUserId()) {
      console.warn('[profileHelper] skip sync: bucket userId mismatch', reason, uid);
      return;
    }
    void syncProfileToServer(localRaw, uid);
  };

  try {
    const res = await fetchWithTimeout(`/api/user/profile/${encodeURIComponent(uid)}`, {}, SESSION_INIT_TIMEOUT_MS);
    if (!res.ok) {
      maybeSyncOwnBucket(`http_${res.status}`);
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
      setLearnItem(
        uid,
        ERROR_LEDGER_KEY,
        typeof error_ledger === 'string' ? error_ledger : JSON.stringify(error_ledger),
      );
    }

    if (memory_layers && typeof memory_layers === 'object') {
      setLearnItem(uid, MEMORY_LAYERS_KEY, JSON.stringify(memory_layers));
      if (serverUpdatedAt >= localUpdatedAt) {
        applyCareerFromMemoryLayers(memory_layers);
      }
    }

    // 服务端时钟不落后时，以服务端为准（含主动清空：空字符串覆盖本地桶，禁止再 sync 脏数据回去）
    if (serverUpdatedAt >= localUpdatedAt) {
      writeProfileLocal(String(profile_content ?? ''), serverUpdatedAt, uid);
      return;
    }

    if (localRaw && localUpdatedAt > serverUpdatedAt) {
      maybeSyncOwnBucket('local_newer');
      void syncCareerToServer(readCareerPath());
    }
  } catch (e) {
    console.warn('[profileHelper] load from server failed:', e);
    maybeSyncOwnBucket('fetch_exception');
  }
}

export function saveUserErrorLedger(ledger: string | Record<string, unknown>) {
  const value = typeof ledger === 'string' ? ledger : JSON.stringify(ledger);
  setLearnItem(getAppUserId(), ERROR_LEDGER_KEY, value);
  void syncProfileToServer();
}

export interface MemoryIngestPayload {
  profileDelta?: string;
  episode?: Record<string, unknown>;
  semantic?: Record<string, unknown>;
  turn?: Record<string, unknown>;
  sessionSummary?: Record<string, unknown>;
  l1?: Record<string, unknown>;
  promoteToEpisode?: boolean;
  l3VarsDelta?: Record<string, string>;
  source: string;
}

export async function ingestUserMemory(payload: MemoryIngestPayload): Promise<void> {
  try {
    const uid = getAppUserId();
    const res = await fetch('/api/user/memory/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, ...payload }),
    });
    if (!res.ok) return;

    const json = await res.json();
    const { profile_content, updated_at, memory_layers } = json?.data || {};
    if (profile_content) {
      writeProfileLocal(profile_content, Number(updated_at || Date.now()), uid);
    }
    if (memory_layers && typeof memory_layers === 'object') {
      setLearnItem(uid, MEMORY_LAYERS_KEY, JSON.stringify(memory_layers));
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

/** 服务端记忆召回（需 query；失败时回退 localStorage 规则召回） */
export async function fetchMemoryRecall(query: string, topK = 5): Promise<{ context: string; items: unknown[] }> {
  const q = String(query || '').trim();
  if (!q) return { context: '', items: [] };
  try {
    const params = new URLSearchParams({
      userId: getAppUserId(),
      query: q,
      topK: String(topK),
    });
    const res = await fetch(`/api/user/memory/recall?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      if (json?.success && json.data) {
        return {
          context: String(json.data.context || ''),
          items: Array.isArray(json.data.items) ? json.data.items : [],
        };
      }
    }
  } catch (e) {
    console.warn('[profileHelper] memory recall API failed, using local:', e);
  }
  const local = recallMemoryLocal(q, topK);
  return { context: local.context, items: local.items };
}

/** 查询 L2 episode 的 L1/L0 溯源链 */
export async function fetchMemoryProvenance(
  episodeId: string,
  userId?: string,
): Promise<{ episode: Record<string, unknown> | null; l1_summary: Record<string, unknown> | null; l0_turns: Record<string, unknown>[] } | null> {
  const epId = String(episodeId || '').trim();
  if (!epId) return null;
  try {
    const uid = userId || getAppUserId();
    const res = await fetch(`/api/user/memory/provenance/${encodeURIComponent(uid)}/${encodeURIComponent(epId)}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.success) return null;
    return json.data || null;
  } catch (e) {
    console.warn('[profileHelper] memory provenance failed:', e);
    return null;
  }
}

/** 读取本地缓存的 L2 关系图谱摘要（最多 8 条关系） */
export function getGraphSummaryLocal(): string {
  try {
    const raw = getLearnItem(getAppUserId(), MEMORY_LAYERS_KEY);
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
    const raw = getLearnItem(getAppUserId(), MEMORY_LAYERS_KEY);
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
export async function recordUserLoginPing(userId: string): Promise<void> {
  const res = await fetchWithTimeout('/api/user/login-ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  }, SESSION_INIT_TIMEOUT_MS);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) {
    const detail = json?.error ? `: ${json.error}` : '';
    throw new Error(`login-ping failed for userId=${userId}: HTTP ${res.status}${detail}`);
  }
}

/**
 * 换号会话：flush(old) → 静默改 ID → load 画像+sidecar → 再 dispatch 重挂。
 * 禁止：dispatch/remount 发生在 load 之前；禁止先改 ID 再 flush。
 */
export async function switchAccountSession(nextUserId: string): Promise<string> {
  const next = sanitizeUserId(nextUserId);
  const prevRaw = localStorage.getItem(USER_ID_KEY);
  const old =
    prevRaw && prevRaw !== 'default-user' && prevRaw.trim() ? prevRaw.trim() : null;

  if (old && old !== next) {
    const { flushLearningUi } = await import('../services/learningUiAPI');
    await flushLearningUi(old);
  }

  console.info('[profileHelper] switchAccountSession', { from: old, to: next });
  // 静默写入，等水合完成后再 dispatch，保证 remount 读已水合桶
  setAppUserId(next, { dispatch: false });
  clearSessionKeysOnSwitch(next);

  const { loadLearningUiFromServer } = await import('../services/learningUiAPI');
  const results = await Promise.allSettled([
    loadUserProfileFromServer(next),
    loadLearningUiFromServer(next),
  ]);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[profileHelper] switchAccountSession step failed:', result.reason);
    }
  }

  dispatchUserIdChanged();
  return next;
}

export async function initializeUserSession(customUserId?: string): Promise<string> {
  const userId = customUserId?.trim()
    ? await switchAccountSession(customUserId)
    : ensureAppUserId();

  if (!customUserId?.trim()) {
    const { loadLearningUiFromServer } = await import('../services/learningUiAPI');
    const results = await Promise.allSettled([
      recordUserLoginPing(userId),
      loadUserProfileFromServer(userId),
      loadLearningUiFromServer(userId),
    ]);
    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn('[profileHelper] session init step failed:', result.reason);
      }
    }
    return userId;
  }

  try {
    await recordUserLoginPing(userId);
  } catch (err) {
    console.warn('[profileHelper] login ping failed:', err);
  }
  return userId;
}
