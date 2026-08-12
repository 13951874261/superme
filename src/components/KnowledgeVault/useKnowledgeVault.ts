import { useState, useEffect, useCallback } from 'react';
import { getAppUserId } from '../../utils/profileHelper';

export interface EnglishNote {
  id: string;
  word: string;
  meaning: string;
  example: string;
  source: string;
  addedAt: number;
}

export interface TheoryFrame {
  id: string;
  title: string;
  category: 'game_theory' | 'psychology' | 'logic';
  summary: string;
  source: string;
  addedAt: number;
}

export interface WritingSkill {
  id: string;
  title: string;
  category: string;
  content: string;
  source: string;
  addedAt: number;
}

export interface AestheticTip {
  id: string;
  title: string;
  category: string;
  content: string;
  source: string;
  addedAt: number;
}

export type VaultItem = EnglishNote | TheoryFrame | WritingSkill | AestheticTip;

type VaultType = 'english' | 'theory' | 'writing' | 'aesthetic';

interface KnowledgeVaultState {
  englishNotes: EnglishNote[];
  theoryFrames: TheoryFrame[];
  writingSkills: WritingSkill[];
  aestheticTips: AestheticTip[];
}

function mapTypeToBackend(type: VaultType): string {
  return type;
}

async function fetchVault(userId: string, type: VaultType): Promise<VaultItem[]> {
  const res = await fetch(`/api/knowledge-vault/notes?userId=${encodeURIComponent(userId)}&type=${type}`);
  if (!res.ok) return [];
  return await res.json();
}

async function createItem(userId: string, type: VaultType, item: Omit<VaultItem, 'id' | 'addedAt'>): Promise<VaultItem> {
  const res = await fetch('/api/knowledge-vault/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, type, ...item })
  });
  if (!res.ok) throw new Error('创建失败');
  return await res.json();
}

async function updateItem(id: string, patch: Partial<VaultItem>): Promise<VaultItem> {
  const res = await fetch(`/api/knowledge-vault/notes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
  if (!res.ok) throw new Error('更新失败');
  return await res.json();
}

async function deleteItem(id: string): Promise<void> {
  const res = await fetch(`/api/knowledge-vault/notes/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('删除失败');
}

export function useKnowledgeVault() {
  const userId = getAppUserId();
  const [state, setState] = useState<KnowledgeVaultState>({
    englishNotes: [],
    theoryFrames: [],
    writingSkills: [],
    aestheticTips: []
  });
  const [loading, setLoading] = useState(true);

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

  const refresh = () => loadAll();

  const addEnglishNote = async (item: Omit<EnglishNote, 'id' | 'addedAt'>) => {
    const created = await createItem(userId, 'english', item);
    setState(s => ({ ...s, englishNotes: [created, ...s.englishNotes] }));
  };
  const updateEnglishNote = async (id: string, patch: Partial<EnglishNote>) => {
    const updated = await updateItem(id, patch);
    setState(s => ({ ...s, englishNotes: s.englishNotes.map(n => n.id === id ? { ...n, ...updated } : n) }));
  };
  const deleteEnglishNote = async (id: string) => {
    await deleteItem(id);
    setState(s => ({ ...s, englishNotes: s.englishNotes.filter(n => n.id !== id) }));
  };

  const addTheoryFrame = async (item: Omit<TheoryFrame, 'id' | 'addedAt'>) => {
    const created = await createItem(userId, 'theory', item);
    setState(s => ({ ...s, theoryFrames: [created, ...s.theoryFrames] }));
  };
  const updateTheoryFrame = async (id: string, patch: Partial<TheoryFrame>) => {
    const updated = await updateItem(id, patch);
    setState(s => ({ ...s, theoryFrames: s.theoryFrames.map(f => f.id === id ? { ...f, ...updated } : f) }));
  };
  const deleteTheoryFrame = async (id: string) => {
    await deleteItem(id);
    setState(s => ({ ...s, theoryFrames: s.theoryFrames.filter(f => f.id !== id) }));
  };

  const addWritingSkill = async (item: Omit<WritingSkill, 'id' | 'addedAt'>) => {
    const created = await createItem(userId, 'writing', item);
    setState(s => ({ ...s, writingSkills: [created, ...s.writingSkills] }));
  };
  const updateWritingSkill = async (id: string, patch: Partial<WritingSkill>) => {
    const updated = await updateItem(id, patch);
    setState(s => ({ ...s, writingSkills: s.writingSkills.map(s => s.id === id ? { ...s, ...updated } : s) }));
  };
  const deleteWritingSkill = async (id: string) => {
    await deleteItem(id);
    setState(s => ({ ...s, writingSkills: s.writingSkills.filter(s => s.id !== id) }));
  };

  const addAestheticTip = async (item: Omit<AestheticTip, 'id' | 'addedAt'>) => {
    const created = await createItem(userId, 'aesthetic', item);
    setState(s => ({ ...s, aestheticTips: [created, ...s.aestheticTips] }));
  };
  const updateAestheticTip = async (id: string, patch: Partial<AestheticTip>) => {
    const updated = await updateItem(id, patch);
    setState(s => ({ ...s, aestheticTips: s.aestheticTips.map(t => t.id === id ? { ...t, ...updated } : t) }));
  };
  const deleteAestheticTip = async (id: string) => {
    await deleteItem(id);
    setState(s => ({ ...s, aestheticTips: s.aestheticTips.filter(t => t.id !== id) }));
  };

  return {
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
    deleteAestheticTip
  };
}
