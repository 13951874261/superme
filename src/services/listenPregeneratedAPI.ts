import { getAppUserId } from '../utils/profileHelper';

export type PregenStatus = 'ready' | 'partial' | 'missing' | 'failed' | 'generating' | 'uncached_duration';

export interface PregeneratedResponse {
  success: boolean;
  status: PregenStatus;
  canBackfill?: boolean;
  packDate?: string;
  articleStatus?: string;
  audioStatus?: string;
  article?: { body: string; vocab: unknown[]; phrases: unknown[]; fileUrl?: string | null } | null;
  audio?: { script: string; audioUrl: string } | null;
}

export async function fetchPregenerated(params: {
  theme: string;
  genre: string;
  cefrLevel: string;
  duration: number;
  date?: string;
  userId?: string;
}): Promise<PregeneratedResponse> {
  const userId = params.userId || getAppUserId();
  const q = new URLSearchParams({
    userId,
    theme: params.theme,
    genre: params.genre,
    cefrLevel: params.cefrLevel,
    duration: String(params.duration),
  });
  if (params.date) q.set('date', params.date);
  const res = await fetch(`/api/listen/pregenerated?${q}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function submitPregeneratedBackfill(body: {
  theme: string;
  genre: string;
  cefrLevel: string;
  duration: number;
  only?: 'both' | 'article' | 'audio';
  userId?: string;
}) {
  const res = await fetch('/api/listen/pregenerated/backfill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, userId: body.userId || getAppUserId() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as { success: boolean; taskId: string };
}

export async function writebackPregenerated(body: {
  theme: string;
  genre: string;
  cefrLevel: string;
  duration: number;
  body?: string;
  vocab?: unknown[];
  phrases?: unknown[];
  audioUrl?: string;
  audioPath?: string;
  script?: string;
  date?: string;
  userId?: string;
}): Promise<PregeneratedResponse> {
  const res = await fetch('/api/listen/pregenerated/writeback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, userId: body.userId || getAppUserId() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
