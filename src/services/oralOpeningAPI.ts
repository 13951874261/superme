import { getAppUserId } from '../utils/profileHelper';

export interface OralOpeningPayload {
  success: boolean;
  ready: boolean;
  packDate: string;
  sceneId: string;
  theme: string;
  opening?: {
    id: string;
    answer: string;
    conversationId: string | null;
    source: string;
    createdAt: number;
    updatedAt: number;
  } | null;
}

export async function fetchOralOpening(params: {
  userId?: string;
  sceneId?: string;
  theme?: string;
  packDate?: string;
  signal?: AbortSignal;
}): Promise<OralOpeningPayload> {
  const q = new URLSearchParams();
  q.set('userId', params.userId || getAppUserId());
  if (params.sceneId) q.set('sceneId', params.sceneId);
  if (params.theme) q.set('theme', params.theme);
  if (params.packDate) q.set('packDate', params.packDate);
  const res = await fetch(`/api/english/oral/opening?${q}`, { signal: params.signal });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function requestOralOpeningBackfill(params: {
  userId?: string;
  sceneId: string;
  theme?: string;
  packDate?: string;
}): Promise<{ success: boolean; taskId: string; status: string }> {
  const res = await fetch('/api/english/oral/opening/backfill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: params.userId || getAppUserId(),
      sceneId: params.sceneId,
      theme: params.theme,
      packDate: params.packDate,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `HTTP ${res.status}`);
  }
  return data;
}
