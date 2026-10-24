export interface KnowledgeRevisionView {
  id: string;
  knowledgeId: string;
  createdAt: number;
  snapshot: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clip(text: string, max = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function summarizeKnowledgeRevision(snapshot: Record<string, unknown>): string {
  const word = typeof snapshot.word === 'string' ? snapshot.word.trim() : '';
  const meaning = typeof snapshot.meaning === 'string' ? snapshot.meaning.trim() : '';
  const title = typeof snapshot.title === 'string' ? snapshot.title.trim() : '';
  const summary = typeof snapshot.summary === 'string' ? snapshot.summary.trim() : '';
  const content = typeof snapshot.content === 'string' ? snapshot.content.trim() : '';
  if (word) return meaning ? `${word}｜${meaning}` : word;
  if (title) {
    const body = summary || content;
    return body ? `${title}｜${clip(body)}` : title;
  }
  return clip(summary || content || meaning || '（无摘要）');
}

export function normalizeKnowledgeRevision(raw: unknown): KnowledgeRevisionView | null {
  const rec = asRecord(raw);
  const id = typeof rec.id === 'string' ? rec.id : '';
  if (!id) return null;
  const knowledgeId = typeof rec.knowledgeId === 'string'
    ? rec.knowledgeId
    : (typeof rec.knowledge_id === 'string' ? rec.knowledge_id : '');
  const createdAt = Number(rec.createdAt ?? rec.created_at ?? 0);
  const snapshot = asRecord(rec.snapshot);
  return { id, knowledgeId, createdAt, snapshot };
}

export async function fetchKnowledgeRevisions(id: string, userId: string): Promise<KnowledgeRevisionView[]> {
  const res = await fetch(`/api/knowledge-vault/notes/${encodeURIComponent(id)}/revisions?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('历史版本加载失败');
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : []).flatMap((row) => {
    const item = normalizeKnowledgeRevision(row);
    return item ? [item] : [];
  });
}
