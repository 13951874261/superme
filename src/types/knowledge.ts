export type KnowledgeModule = 'listen' | 'speak' | 'game_theory' | 'writing' | 'aesthetic';
export type KnowledgeSourceType =
  | 'manual'
  | 'upload_book'
  | 'upload_video'
  | 'ai_extract'
  | 'from_vocab'
  | 'from_game_tactics'
  | 'from_profile';
export type KnowledgeSyncStatus = 'draft' | 'approved' | 'synced' | 'archived';

export interface KnowledgeTraceRef {
  module: KnowledgeModule;
  taskId?: string;
  sessionId?: string;
  action: 'generated' | 'analyzed' | 'reviewed';
  usedAt: number;
}

export interface KnowledgeSourceRef {
  fileName?: string;
  sourceId?: string;
  sourceModule?: string;
  sourceUrl?: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  summary?: string;
  tags: string[];
  moduleTargets: KnowledgeModule[];
  sourceType: KnowledgeSourceType;
  sourceRef?: KnowledgeSourceRef;
  syncStatus: KnowledgeSyncStatus;
  confirmedAt?: number;
  traceRefs: KnowledgeTraceRef[];
  createdAt: number;
  updatedAt: number;
}

/** 资料抽屉英语笔记（结构对齐 useKnowledgeVault.EnglishNote，含后端 added_at） */
export interface EnglishNoteLike {
  id: string;
  word: string;
  meaning: string;
  example: string;
  source?: string;
  addedAt?: number;
  added_at?: number;
}

/** 资料抽屉理论框架（结构对齐 useKnowledgeVault.TheoryFrame） */
export interface TheoryFrameLike {
  id: string;
  title: string;
  category?: 'game_theory' | 'psychology' | 'logic' | string;
  summary: string;
  source?: string;
  addedAt?: number;
  added_at?: number;
}

/** 资料抽屉写作技法（结构对齐 useKnowledgeVault.WritingSkill） */
export interface WritingSkillLike {
  id: string;
  title: string;
  category?: string;
  content: string;
  source?: string;
  addedAt?: number;
  added_at?: number;
}

/** 资料抽屉审美提示（结构对齐 useKnowledgeVault.AestheticTip） */
export interface AestheticTipLike {
  id: string;
  title: string;
  category?: string;
  content: string;
  source?: string;
  addedAt?: number;
  added_at?: number;
}

export type VaultDrawerItem =
  | EnglishNoteLike
  | TheoryFrameLike
  | WritingSkillLike
  | AestheticTipLike;

const KNOWLEDGE_MODULES: readonly KnowledgeModule[] = ['listen', 'speak', 'game_theory', 'writing', 'aesthetic'];
const SOURCE_TYPES: readonly KnowledgeSourceType[] = [
  'manual',
  'upload_book',
  'upload_video',
  'ai_extract',
  'from_vocab',
  'from_game_tactics',
  'from_profile',
];
const SYNC_STATUSES: readonly KnowledgeSyncStatus[] = ['draft', 'approved', 'synced', 'archived'];
const TRACE_ACTIONS = ['generated', 'analyzed', 'reviewed'] as const;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function pickNumber(raw: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const n = asFiniteNumber(raw[key]);
    if (n !== undefined) return n;
  }
  return undefined;
}

function isKnowledgeModule(value: unknown): value is KnowledgeModule {
  return typeof value === 'string' && (KNOWLEDGE_MODULES as readonly string[]).includes(value);
}

function isSourceType(value: unknown): value is KnowledgeSourceType {
  return typeof value === 'string' && (SOURCE_TYPES as readonly string[]).includes(value);
}

function isSyncStatus(value: unknown): value is KnowledgeSyncStatus {
  return typeof value === 'string' && (SYNC_STATUSES as readonly string[]).includes(value);
}

function parseTags(raw: Record<string, unknown>): string[] {
  const value = raw.tags;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function parseModuleTargets(raw: Record<string, unknown>): KnowledgeModule[] {
  const value = raw.moduleTargets ?? raw.module_targets;
  if (!Array.isArray(value)) return [];
  return value.filter(isKnowledgeModule);
}

function parseSourceType(raw: Record<string, unknown>): KnowledgeSourceType {
  const value = raw.sourceType ?? raw.source_type;
  return isSourceType(value) ? value : 'manual';
}

function parseSyncStatus(raw: Record<string, unknown>): KnowledgeSyncStatus {
  const value = raw.syncStatus ?? raw.sync_status;
  return isSyncStatus(value) ? value : 'draft';
}

function parseSourceRef(raw: Record<string, unknown>): KnowledgeSourceRef | undefined {
  const value = raw.sourceRef ?? raw.source_ref;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const rec = toRecord(value);
  const sourceRef: KnowledgeSourceRef = {};
  const fileName = asString(rec.fileName ?? rec.file_name);
  const sourceId = asString(rec.sourceId ?? rec.source_id);
  const sourceModule = asString(rec.sourceModule ?? rec.source_module);
  const sourceUrl = asString(rec.sourceUrl ?? rec.source_url);
  if (fileName) sourceRef.fileName = fileName;
  if (sourceId) sourceRef.sourceId = sourceId;
  if (sourceModule) sourceRef.sourceModule = sourceModule;
  if (sourceUrl) sourceRef.sourceUrl = sourceUrl;
  return Object.keys(sourceRef).length ? sourceRef : undefined;
}

function isTraceAction(value: unknown): value is KnowledgeTraceRef['action'] {
  return typeof value === 'string' && (TRACE_ACTIONS as readonly string[]).includes(value);
}

function parseTraceRefs(raw: Record<string, unknown>): KnowledgeTraceRef[] {
  const value = raw.traceRefs ?? raw.trace_refs;
  if (!Array.isArray(value)) return [];
  const traces: KnowledgeTraceRef[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = toRecord(item);
    if (!isKnowledgeModule(rec.module) || !isTraceAction(rec.action)) continue;
    const usedAt = asFiniteNumber(rec.usedAt ?? rec.used_at);
    if (usedAt === undefined) continue;
    const trace: KnowledgeTraceRef = {
      module: rec.module,
      action: rec.action,
      usedAt,
    };
    const taskId = asString(rec.taskId ?? rec.task_id);
    const sessionId = asString(rec.sessionId ?? rec.session_id);
    if (taskId) trace.taskId = taskId;
    if (sessionId) trace.sessionId = sessionId;
    traces.push(trace);
  }
  return traces;
}

function toRecord(value: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = entry;
  }
  return out;
}

function flattenRaw(raw: Record<string, unknown>): Record<string, unknown> {
  const extra = raw.extra_json ?? raw.extraJson;
  let extraObj: Record<string, unknown> = {};
  if (typeof extra === 'string' && extra.trim()) {
    try {
      const parsed: unknown = JSON.parse(extra);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        extraObj = toRecord(parsed);
      }
    } catch {
      extraObj = {};
    }
  } else if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    extraObj = toRecord(extra);
  }
  return { ...raw, ...extraObj };
}

function joinMeaningExample(meaning: string, example: string): string {
  return [meaning, example].filter((part) => part.length > 0).join('\n');
}

function clipSummary(content: string): string {
  return content.slice(0, 120);
}

function applyMeta(
  raw: Record<string, unknown>,
  core: { id: string; title: string; content: string; summary?: string },
): KnowledgeItem {
  const createdAt =
    pickNumber(raw, ['createdAt', 'created_at', 'addedAt', 'added_at']) ?? Date.now();
  const updatedAt =
    pickNumber(raw, ['updatedAt', 'updated_at', 'addedAt', 'added_at']) ?? createdAt;
  const confirmedAt = pickNumber(raw, ['confirmedAt', 'confirmed_at']);
  const item: KnowledgeItem = {
    id: core.id,
    title: core.title,
    content: core.content,
    tags: parseTags(raw),
    moduleTargets: parseModuleTargets(raw),
    sourceType: parseSourceType(raw),
    syncStatus: parseSyncStatus(raw),
    traceRefs: parseTraceRefs(raw),
    createdAt,
    updatedAt,
  };
  if (core.summary !== undefined) item.summary = core.summary;
  const sourceRef = parseSourceRef(raw);
  if (sourceRef) item.sourceRef = sourceRef;
  if (confirmedAt !== undefined) item.confirmedAt = confirmedAt;
  return item;
}

function looksLikeKnowledgeItem(raw: Record<string, unknown>): boolean {
  const hasTitle = typeof raw.title === 'string';
  const hasBody = typeof raw.content === 'string' || typeof raw.summary === 'string';
  const hasMeta =
    typeof raw.sourceType === 'string' ||
    typeof raw.source_type === 'string' ||
    typeof raw.syncStatus === 'string' ||
    typeof raw.sync_status === 'string' ||
    Array.isArray(raw.moduleTargets) ||
    Array.isArray(raw.module_targets) ||
    Array.isArray(raw.tags) ||
    Array.isArray(raw.traceRefs) ||
    Array.isArray(raw.trace_refs);
  return hasTitle && hasBody && hasMeta;
}

function mapEnglishNote(raw: Record<string, unknown>): KnowledgeItem {
  const meaning = asString(raw.meaning);
  const example = asString(raw.example);
  return applyMeta(raw, {
    id: asString(raw.id),
    title: asString(raw.word),
    content: joinMeaningExample(meaning, example),
    summary: meaning,
  });
}

function mapTheoryFrame(raw: Record<string, unknown>): KnowledgeItem {
  const summary = asString(raw.summary);
  return applyMeta(raw, {
    id: asString(raw.id),
    title: asString(raw.title),
    content: summary,
    summary,
  });
}

function mapContentDrawerItem(raw: Record<string, unknown>): KnowledgeItem {
  const content = asString(raw.content);
  return applyMeta(raw, {
    id: asString(raw.id),
    title: asString(raw.title),
    content,
    summary: clipSummary(content),
  });
}

export function englishNoteToKnowledgeItem(note: EnglishNoteLike): KnowledgeItem {
  return mapEnglishNote(flattenRaw(toRecord(note)));
}

export function theoryFrameToKnowledgeItem(frame: TheoryFrameLike): KnowledgeItem {
  return mapTheoryFrame(flattenRaw(toRecord(frame)));
}

export function writingSkillToKnowledgeItem(skill: WritingSkillLike): KnowledgeItem {
  return mapContentDrawerItem(flattenRaw(toRecord(skill)));
}

export function aestheticTipToKnowledgeItem(tip: AestheticTipLike): KnowledgeItem {
  return mapContentDrawerItem(flattenRaw(toRecord(tip)));
}

export function toKnowledgeItem(raw: Record<string, unknown> | VaultDrawerItem): KnowledgeItem {
  const record = flattenRaw(toRecord(raw));
  const drawerType = asString(record.type);

  if (drawerType === 'english' || (typeof record.word === 'string' && record.word.length > 0 && !drawerType)) {
    return mapEnglishNote(record);
  }
  if (drawerType === 'theory') return mapTheoryFrame(record);
  if (drawerType === 'writing' || drawerType === 'aesthetic') return mapContentDrawerItem(record);

  if (looksLikeKnowledgeItem(record)) {
    const content = asString(record.content);
    const summary = typeof record.summary === 'string' ? record.summary : undefined;
    return applyMeta(record, {
      id: asString(record.id),
      title: asString(record.title),
      content,
      summary,
    });
  }

  if (typeof record.content === 'string' && typeof record.title === 'string') {
    return mapContentDrawerItem(record);
  }
  if (typeof record.summary === 'string' && typeof record.title === 'string') {
    return mapTheoryFrame(record);
  }

  const meaning = asString(record.meaning);
  const example = asString(record.example);
  const content = asString(record.content) || joinMeaningExample(meaning, example);
  const title = asString(record.title) || asString(record.word);
  const summary =
    typeof record.summary === 'string'
      ? record.summary
      : meaning || (content ? clipSummary(content) : undefined);
  return applyMeta(record, { id: asString(record.id), title, content, summary });
}

export function isUsableForModule(item: KnowledgeItem, module: KnowledgeModule): boolean {
  return item.syncStatus === 'synced' && item.moduleTargets.includes(module);
}
