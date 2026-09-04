export type SpeakingSceneType = 'multi_role' | 'impromptu';
export type SpeakingSceneRoleType = 'ally' | 'blocker' | 'neutral';
export interface MultiRoleSceneContent { title: string; background: string; roles: Array<{ name: string; identity: string; stance: string; roleType: SpeakingSceneRoleType }>; conflict: string; objective: string; tasks: string[]; opening: string }
export interface ImpromptuSceneContent { topic: string; background: string; identity: string; audience: string; objective: string; conflict: string; structure: string[]; points: string[]; keywords: string[]; opening: string }
interface SceneRecordBase { id: string; userId: string; sceneDate: string; contentHash: string; profileHash: string; useCount: number; lastUsedAt: number | null; createdAt: number; updatedAt: number }
export type SpeakingScene = (SceneRecordBase & { sceneType: 'multi_role'; content: MultiRoleSceneContent }) | (SceneRecordBase & { sceneType: 'impromptu'; content: ImpromptuSceneContent });
export type SpeakingSceneTask = { id: string; type: 'speaking_scene'; status: 'pending' | 'running' | 'completed' | 'failed'; progress?: number; error?: string; result?: { scene?: SpeakingScene } };
export type SpeakingSceneSwitchEvent = { type: 'scene'; scene: SpeakingScene } | { type: 'task'; taskId: string; currentSceneId: string | null } | { type: 'error'; error: string };
export type TimedSwitchEvent = SpeakingSceneSwitchEvent & { elapsedMs: number };
const API_BASE = '/api/english/speaking-scenes';

type FetchImpl = typeof fetch;
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function requiredText(value: unknown, field: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(`场景字段 ${field} 无效`); return value.trim(); }
function requiredNumber(value: unknown, field: string): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`场景字段 ${field} 无效`); return value; }
function textArray(value: unknown, field: string): string[] { if (!Array.isArray(value) || !value.length) throw new Error(`场景字段 ${field} 无效`); return value.map((item) => requiredText(item, field)); }

export function validateSpeakingScene(value: unknown): SpeakingScene {
  if (!isRecord(value)) throw new Error('场景响应格式异常');
  const base: SceneRecordBase = {
    id: requiredText(value.id, 'id'), userId: requiredText(value.userId, 'userId'), sceneDate: requiredText(value.sceneDate, 'sceneDate'),
    contentHash: requiredText(value.contentHash, 'contentHash'), profileHash: requiredText(value.profileHash, 'profileHash'), useCount: requiredNumber(value.useCount, 'useCount'),
    lastUsedAt: value.lastUsedAt === null ? null : requiredNumber(value.lastUsedAt, 'lastUsedAt'), createdAt: requiredNumber(value.createdAt, 'createdAt'), updatedAt: requiredNumber(value.updatedAt, 'updatedAt'),
  };
  if (!isRecord(value.content)) throw new Error('场景字段 content 无效');
  const content = value.content;
  const common = { background: requiredText(content.background, 'background'), conflict: requiredText(content.conflict, 'conflict'), objective: requiredText(content.objective, 'objective'), opening: requiredText(content.opening, 'opening') };
  if (value.sceneType === 'multi_role') {
    if (!Array.isArray(content.roles) || !content.roles.length) throw new Error('场景字段 roles 无效');
    const roles = content.roles.map((role) => { if (!isRecord(role)) throw new Error('场景字段 roles 无效'); if (role.roleType !== 'ally' && role.roleType !== 'blocker' && role.roleType !== 'neutral') throw new Error('场景字段 roles.roleType 无效'); return { name: requiredText(role.name, 'roles.name'), identity: requiredText(role.identity, 'roles.identity'), stance: requiredText(role.stance, 'roles.stance'), roleType: role.roleType as SpeakingSceneRoleType }; });
    if (!roles.some((role) => role.roleType === 'blocker')) throw new Error('场景字段 roles 至少需要一个 blocker');
    return { ...base, sceneType: 'multi_role', content: { title: requiredText(content.title, 'title'), ...common, roles, tasks: textArray(content.tasks, 'tasks') } };
  }
  if (value.sceneType === 'impromptu') return { ...base, sceneType: 'impromptu', content: { topic: requiredText(content.topic, 'topic'), ...common, identity: requiredText(content.identity, 'identity'), audience: requiredText(content.audience, 'audience'), structure: textArray(content.structure, 'structure'), points: textArray(content.points, 'points'), keywords: textArray(content.keywords, 'keywords') } };
  throw new Error('场景字段 sceneType 无效');
}

const TASK_STATUSES = new Set<SpeakingSceneTask['status']>(['pending', 'running', 'completed', 'failed']);
export function validateSpeakingSceneTask(value: unknown): SpeakingSceneTask {
  if (!isRecord(value)) throw new Error('任务响应格式异常');
  const id = requiredText(value.id, '任务 id');
  if (value.type !== 'speaking_scene') throw new Error('任务 type 无效');
  if (typeof value.status !== 'string' || !TASK_STATUSES.has(value.status as SpeakingSceneTask['status'])) throw new Error('任务状态无效');
  if (value.progress !== undefined && (typeof value.progress !== 'number' || !Number.isFinite(value.progress))) throw new Error('任务 progress 无效');
  if (value.error !== undefined && typeof value.error !== 'string') throw new Error('任务 error 无效');
  let result: SpeakingSceneTask['result'];
  if (value.result !== undefined) {
    if (!isRecord(value.result)) throw new Error('任务 result 无效');
    result = value.result.scene === undefined ? {} : { scene: validateSpeakingScene(value.result.scene) };
  }
  const task: SpeakingSceneTask = { id, type: 'speaking_scene', status: value.status as SpeakingSceneTask['status'] };
  if (typeof value.progress === 'number') task.progress = value.progress;
  if (typeof value.error === 'string') task.error = value.error;
  if (result !== undefined) task.result = result;
  return task;
}
function validateTaskStatus(value: unknown): SpeakingSceneTask['status'] {
  if (typeof value !== 'string' || !TASK_STATUSES.has(value as SpeakingSceneTask['status'])) throw new Error('任务状态无效');
  return value as SpeakingSceneTask['status'];
}

export function hasValidSceneContent(value: unknown): boolean { try { validateSpeakingScene(value); return true; } catch { return false; } }
function eventFrom(eventName: string, raw: string): SpeakingSceneSwitchEvent | null {
  if (!raw.trim() || eventName === 'ping') return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data)) return null;
    if (eventName === 'scene') return { type: 'scene', scene: validateSpeakingScene(data.scene) };
    if (eventName === 'task') return { type: 'task', taskId: requiredText(data.taskId, 'taskId'), currentSceneId: typeof data.currentSceneId === 'string' && data.currentSceneId.trim() ? data.currentSceneId.trim() : null };
    if (eventName === 'error') return { type: 'error', error: typeof data.error === 'string' && data.error.trim() ? data.error.trim() : '场景请求失败' };
    return null;
  } catch (error) { return { type: 'error', error: error instanceof Error && error.message.startsWith('场景字段') ? error.message : '场景流数据格式异常' }; }
}
export function createSpeakingSceneSseParser(onEvent: (event: SpeakingSceneSwitchEvent) => void) {
  let buffer = '';
  const drain = (flush = false) => { const blocks = buffer.split(/\r?\n\r?\n/); buffer = flush ? '' : blocks.pop() || ''; for (const block of blocks) { let name = 'message'; const data: string[] = []; for (const line of block.split(/\r?\n/)) { if (line.startsWith(':')) continue; if (line.startsWith('event:')) name = line.slice(6).trim(); if (line.startsWith('data:')) data.push(line.slice(5).trimStart()); } const event = eventFrom(name, data.join('\n')); if (event) onEvent(event); } };
  return { push(chunk: string) { buffer += chunk; drain(); }, finish() { if (buffer.trim()) buffer += '\n\n'; drain(true); } };
}
async function readBody(response: Response): Promise<unknown> { const raw = await response.text(); if (!raw) return {}; try { return JSON.parse(raw); } catch { return raw; } }
function errorMessage(body: unknown, status: number): string { if (isRecord(body)) { const value = body.error || body.message; if (typeof value === 'string' && value.trim()) return value; } if (typeof body === 'string' && body.trim() && !/^\s*</.test(body)) return body.trim(); return `HTTP ${status}`; }
async function jsonRequest(path: string, options: RequestInit, signal?: AbortSignal, fetchImpl: FetchImpl = fetch): Promise<Record<string, unknown>> { const response = await fetchImpl(`${API_BASE}${path}`, { ...options, signal, headers: { 'Content-Type': 'application/json', ...options.headers } }); const body = await readBody(response); if (!response.ok) throw new Error(errorMessage(body, response.status)); if (!isRecord(body)) throw new Error('响应格式异常'); return body; }

export async function getSpeakingScenes(params: { userId: string; sceneDate?: string; sceneType?: SpeakingSceneType; signal?: AbortSignal; fetchImpl?: FetchImpl }): Promise<SpeakingScene[]> { const query = new URLSearchParams({ userId: params.userId }); if (params.sceneDate) query.set('sceneDate', params.sceneDate); if (params.sceneType) query.set('sceneType', params.sceneType); const data = await jsonRequest(`?${query}`, { method: 'GET' }, params.signal, params.fetchImpl); if (!Array.isArray(data.scenes)) throw new Error('响应格式异常'); return data.scenes.map(validateSpeakingScene); }
export async function switchSpeakingScene(params: { userId: string; sceneType: SpeakingSceneType; currentSceneId?: string; sceneDate?: string; signal?: AbortSignal; onEvent?: (event: TimedSwitchEvent) => void; fetchImpl?: FetchImpl }): Promise<TimedSwitchEvent> {
  const startedAt = performance.now(); const response = await (params.fetchImpl || fetch)(`${API_BASE}/switch`, { method: 'POST', signal: params.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: params.userId, sceneType: params.sceneType, ...(params.currentSceneId ? { currentSceneId: params.currentSceneId } : {}), ...(params.sceneDate ? { sceneDate: params.sceneDate } : {}) }) });
  if (!response.ok) throw new Error(errorMessage(await readBody(response), response.status));
  if (!response.body) throw new Error('场景切换响应流不可用');
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let first: TimedSwitchEvent | undefined;
  const parser = createSpeakingSceneSseParser((event) => { const timed = { ...event, elapsedMs: performance.now() - startedAt } as TimedSwitchEvent; first ||= timed; params.onEvent?.(timed); });
  while (true) { const { value, done } = await reader.read(); if (done) break; parser.push(decoder.decode(value, { stream: true })); }
  parser.push(decoder.decode()); parser.finish(); if (!first) throw new Error('场景流未返回有效内容'); return first;
}
export async function regenerateSpeakingScene(params: { userId: string; sceneType: SpeakingSceneType; currentSceneId?: string; sceneDate?: string; signal?: AbortSignal; fetchImpl?: FetchImpl }) { const data = await jsonRequest('/regenerate', { method: 'POST', body: JSON.stringify({ userId: params.userId, sceneType: params.sceneType, ...(params.currentSceneId ? { currentSceneId: params.currentSceneId } : {}), ...(params.sceneDate ? { sceneDate: params.sceneDate } : {}) }) }, params.signal, params.fetchImpl); return { taskId: requiredText(data.taskId, 'taskId'), status: validateTaskStatus(data.status) }; }
export async function getSpeakingSceneTask(taskId: string, userId: string, signal?: AbortSignal, fetchImpl?: FetchImpl): Promise<SpeakingSceneTask> { const data = await jsonRequest(`/tasks/${encodeURIComponent(taskId)}?${new URLSearchParams({ userId })}`, { method: 'GET' }, signal, fetchImpl); return validateSpeakingSceneTask(data.task); }
export async function recordSpeakingSceneUse(sceneId: string, userId: string, signal?: AbortSignal, fetchImpl?: FetchImpl): Promise<SpeakingScene> { const data = await jsonRequest(`/${encodeURIComponent(sceneId)}/use`, { method: 'POST', body: JSON.stringify({ userId }) }, signal, fetchImpl); return validateSpeakingScene(data.scene); }

export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

export async function resolveSpeakingSceneTask(
  taskId: string,
  userId: string,
  signal: AbortSignal | undefined,
  getTask: (taskId: string, userId: string, signal?: AbortSignal) => Promise<SpeakingSceneTask> = getSpeakingSceneTask,
  delay: (ms: number, signal?: AbortSignal) => Promise<void> = abortableDelay,
): Promise<SpeakingScene> {
  while (true) {
    const task = await getTask(taskId, userId, signal);
    if (task.status === 'failed') throw new Error(task.error || '场景生成失败');
    if (task.status === 'completed') {
      if (!task.result?.scene) throw new Error('任务完成但未返回完整场景');
      return task.result.scene;
    }
    await delay(1000, signal);
  }
}
