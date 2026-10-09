import { useState, useEffect, useCallback } from 'react';
import { getAppUserId } from '../../utils/profileHelper';
import type {
  KnowledgeModule,
  KnowledgeSourceRef,
  KnowledgeSourceType,
  KnowledgeSyncStatus,
} from '../../types/knowledge';

export interface KnowledgeTraceView {
  module: KnowledgeModule;
  action?: string;
  taskId?: string;
  sessionId?: string;
  usedAt: number;
}

export interface KnowledgeSyncFields {
  tags?: string[];
  moduleTargets?: KnowledgeModule[];
  sourceType?: KnowledgeSourceType;
  sourceRef?: KnowledgeSourceRef;
  syncStatus?: KnowledgeSyncStatus;
  confirmedAt?: number;
  traces?: KnowledgeTraceView[];
  difficulty?: number;
  refineStatus?: 'idle' | 'pending' | 'done' | 'failed';
  usageCount?: number;
  mindmap?: { center?: string; branches?: unknown[] } | null;
}

export interface EnglishNote extends KnowledgeSyncFields {
  id: string;
  word: string;
  meaning: string;
  example: string;
  source: string;
  addedAt: number;
}

export interface TheoryFrame extends KnowledgeSyncFields {
  id: string;
  title: string;
  category: 'game_theory' | 'psychology' | 'logic';
  summary: string;
  source: string;
  addedAt: number;
}

export interface WritingSkill extends KnowledgeSyncFields {
  id: string;
  title: string;
  category: string;
  content: string;
  source: string;
  addedAt: number;
}

export interface AestheticTip extends KnowledgeSyncFields {
  id: string;
  title: string;
  category: string;
  content: string;
  source: string;
  addedAt: number;
}

export type VaultItem = EnglishNote | TheoryFrame | WritingSkill | AestheticTip;

export interface KnowledgeVault {
  englishNotes: EnglishNote[];
  theoryFrames: TheoryFrame[];
  writingSkills: WritingSkill[];
  aestheticTips: AestheticTip[];
}

type VaultType = 'english' | 'theory' | 'writing' | 'aesthetic';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeTraces(raw: unknown): KnowledgeTraceView[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const rec = asRecord(item);
    const module = rec.module;
    if (module !== 'listen' && module !== 'speak' && module !== 'game_theory' && module !== 'writing' && module !== 'aesthetic') return [];
    const usedAt = Number(rec.usedAt ?? rec.used_at ?? 0);
    return [{
      module,
      action: typeof rec.action === 'string' ? rec.action : undefined,
      taskId: typeof rec.taskId === 'string' ? rec.taskId : (typeof rec.task_id === 'string' ? rec.task_id : undefined),
      sessionId: typeof rec.sessionId === 'string' ? rec.sessionId : (typeof rec.session_id === 'string' ? rec.session_id : undefined),
      usedAt,
    }];
  });
}

function normalizeSourceRef(raw: unknown): KnowledgeSourceRef | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const rec = asRecord(raw);
  const sourceRef: KnowledgeSourceRef = {};
  if (typeof rec.fileName === 'string' && rec.fileName) sourceRef.fileName = rec.fileName;
  if (typeof rec.sourceId === 'string' && rec.sourceId) sourceRef.sourceId = rec.sourceId;
  if (typeof rec.sourceModule === 'string' && rec.sourceModule) sourceRef.sourceModule = rec.sourceModule;
  if (typeof rec.sourceUrl === 'string' && rec.sourceUrl) sourceRef.sourceUrl = rec.sourceUrl;
  return Object.keys(sourceRef).length ? sourceRef : undefined;
}

function normalizeVaultItem<T extends VaultItem>(row: unknown): T {
  const rec = asRecord(row);
  const sourceType = rec.sourceType;
  const syncStatus = rec.syncStatus;
  return {
    ...(rec as object),
    addedAt: Number(rec.addedAt ?? rec.added_at ?? 0),
    tags: Array.isArray(rec.tags) ? rec.tags.filter((tag) => typeof tag === 'string') : [],
    moduleTargets: Array.isArray(rec.moduleTargets)
      ? rec.moduleTargets.filter((item): item is KnowledgeModule => item === 'listen' || item === 'speak' || item === 'game_theory' || item === 'writing' || item === 'aesthetic')
      : [],
    sourceType: sourceType === 'upload_book' || sourceType === 'upload_video' || sourceType === 'ai_extract' || sourceType === 'from_vocab' || sourceType === 'from_game_tactics' || sourceType === 'from_profile' || sourceType === 'manual'
      ? sourceType
      : 'manual',
    sourceRef: normalizeSourceRef(rec.sourceRef),
    syncStatus: syncStatus === 'approved' || syncStatus === 'synced' || syncStatus === 'archived' ? syncStatus : 'draft',
    confirmedAt: rec.confirmedAt == null ? undefined : Number(rec.confirmedAt),
    traces: normalizeTraces(rec.traces),
    difficulty: Number(rec.difficulty) > 0 ? Math.min(5, Math.floor(Number(rec.difficulty))) : 1,
    refineStatus: rec.refineStatus === 'pending' || rec.refineStatus === 'done' || rec.refineStatus === 'failed' || rec.refineStatus === 'idle'
      ? rec.refineStatus
      : 'idle',
    usageCount: Number(rec.usageCount) > 0 ? Math.floor(Number(rec.usageCount)) : 0,
    mindmap: rec.mindmap && typeof rec.mindmap === 'object' && !Array.isArray(rec.mindmap)
      ? rec.mindmap as { center?: string; branches?: unknown[] }
      : null,
    source: typeof rec.source === 'string' ? rec.source : 'manual',
  } as T;
}

async function fetchVault(userId: string, type: VaultType): Promise<VaultItem[]> {
  const res = await fetch(`/api/knowledge-vault/notes?userId=${encodeURIComponent(userId)}&type=${type}&includeTraces=1`);
  if (!res.ok) return [];
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : []).map((row) => normalizeVaultItem(row));
}

async function createItem(userId: string, type: VaultType, item: Omit<VaultItem, 'id' | 'addedAt'>): Promise<VaultItem> {
  const res = await fetch('/api/knowledge-vault/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, type, ...item, syncStatus: 'draft', moduleTargets: [] })
  });
  if (!res.ok) throw new Error('创建失败');
  return normalizeVaultItem(await res.json());
}

async function updateItem(id: string, userId: string, patch: Partial<VaultItem>): Promise<VaultItem> {
  const res = await fetch(`/api/knowledge-vault/notes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...patch, userId })
  });
  if (!res.ok) throw new Error('更新失败');
  return normalizeVaultItem(await res.json());
}

async function deleteItem(id: string, userId: string): Promise<void> {
  const res = await fetch(`/api/knowledge-vault/notes/${id}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('删除失败');
}

async function syncItem(id: string, userId: string, moduleTargets: KnowledgeModule[]): Promise<VaultItem> {
  const res = await fetch(`/api/knowledge-vault/notes/${id}/sync`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, moduleTargets })
  });
  if (!res.ok) throw new Error('更新知识同步范围失败');
  return normalizeVaultItem(await res.json());
}

export function useKnowledgeVault() {
  const userId = getAppUserId();
  const [state, setState] = useState<KnowledgeVault>({
    englishNotes: [],
    theoryFrames: [],
    writingSkills: [],
    aestheticTips: []
  });
  const [loading, setLoading] = useState(true);

  const mergeItem = useCallback((id: string, updated: VaultItem) => {
    setState((s) => ({
      englishNotes: s.englishNotes.map((item) => item.id === id ? { ...item, ...updated } as EnglishNote : item),
      theoryFrames: s.theoryFrames.map((item) => item.id === id ? { ...item, ...updated } as TheoryFrame : item),
      writingSkills: s.writingSkills.map((item) => item.id === id ? { ...item, ...updated } as WritingSkill : item),
      aestheticTips: s.aestheticTips.map((item) => item.id === id ? { ...item, ...updated } as AestheticTip : item),
    }));
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [englishNotes, theoryFrames, writingSkills, aestheticTips] = await Promise.all([
        fetchVault(userId, 'english'),
        fetchVault(userId, 'theory'),
        fetchVault(userId, 'writing'),
        fetchVault(userId, 'aesthetic')
      ]);
      setState({
        englishNotes: englishNotes as EnglishNote[],
        theoryFrames: theoryFrames as TheoryFrame[],
        writingSkills: writingSkills as WritingSkill[],
        aestheticTips: aestheticTips as AestheticTip[]
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const onUpdated = () => { void loadAll(); };
    window.addEventListener('knowledge-vault-updated', onUpdated);
    return () => window.removeEventListener('knowledge-vault-updated', onUpdated);
  }, [loadAll]);

  const refresh = () => loadAll();

  const addEnglishNote = async (item: Omit<EnglishNote, 'id' | 'addedAt'>) => {
    const created = await createItem(userId, 'english', item);
    setState(s => ({ ...s, englishNotes: [created as EnglishNote, ...s.englishNotes] }));
  };
  const updateEnglishNote = async (id: string, patch: Partial<EnglishNote>) => {
    mergeItem(id, await updateItem(id, userId, patch));
  };
  const deleteEnglishNote = async (id: string) => {
    await deleteItem(id, userId);
    setState(s => ({ ...s, englishNotes: s.englishNotes.filter(n => n.id !== id) }));
  };

  const addTheoryFrame = async (item: Omit<TheoryFrame, 'id' | 'addedAt'>) => {
    const created = await createItem(userId, 'theory', item);
    setState(s => ({ ...s, theoryFrames: [created as TheoryFrame, ...s.theoryFrames] }));
  };
  const updateTheoryFrame = async (id: string, patch: Partial<TheoryFrame>) => {
    mergeItem(id, await updateItem(id, userId, patch));
  };
  const deleteTheoryFrame = async (id: string) => {
    await deleteItem(id, userId);
    setState(s => ({ ...s, theoryFrames: s.theoryFrames.filter(f => f.id !== id) }));
  };

  const addWritingSkill = async (item: Omit<WritingSkill, 'id' | 'addedAt'>) => {
    const created = await createItem(userId, 'writing', item);
    setState(s => ({ ...s, writingSkills: [created as WritingSkill, ...s.writingSkills] }));
  };
  const updateWritingSkill = async (id: string, patch: Partial<WritingSkill>) => {
    mergeItem(id, await updateItem(id, userId, patch));
  };
  const deleteWritingSkill = async (id: string) => {
    await deleteItem(id, userId);
    setState(s => ({ ...s, writingSkills: s.writingSkills.filter(s => s.id !== id) }));
  };

  const addAestheticTip = async (item: Omit<AestheticTip, 'id' | 'addedAt'>) => {
    const created = await createItem(userId, 'aesthetic', item);
    setState(s => ({ ...s, aestheticTips: [created as AestheticTip, ...s.aestheticTips] }));
  };
  const updateAestheticTip = async (id: string, patch: Partial<AestheticTip>) => {
    mergeItem(id, await updateItem(id, userId, patch));
  };
  const deleteAestheticTip = async (id: string) => {
    await deleteItem(id, userId);
    setState(s => ({ ...s, aestheticTips: s.aestheticTips.filter(t => t.id !== id) }));
  };

  const syncKnowledge = async (id: string, moduleTargets: KnowledgeModule[]) => {
    const updated = await syncItem(id, userId, moduleTargets);
    mergeItem(id, updated);
    return updated;
  };

  const archiveKnowledge = async (id: string) => {
    const updated = await updateItem(id, userId, { syncStatus: 'archived', moduleTargets: [] });
    mergeItem(id, updated);
    return updated;
  };

  const importMapped = async (source: 'tactics' | 'prototypes') => {
    const res = await fetch('/api/knowledge-vault/import-mapped', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, source }),
    });
    if (!res.ok) throw new Error('导入失败');
    const payload = await res.json();
    await loadAll();
    return {
      createdCount: Number(payload?.createdCount || 0),
      skippedCount: Number(payload?.skippedCount || 0),
    };
  };

  return {
    vault: state,
    ...state,
    loading,
    refresh,
    addEnglishNote,
    updateEnglishNote,
    deleteEnglishNote,
    addTheoryFrame,
    updateTheoryFrame,
    deleteTheoryFrame,
    addWritingSkill,
    updateWritingSkill,
    deleteWritingSkill,
    addAestheticTip,
    updateAestheticTip,
    deleteAestheticTip,
    syncKnowledge,
    archiveKnowledge,
    importMapped,
  };
}
