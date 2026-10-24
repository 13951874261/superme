import { getAppUserId } from '../utils/profileHelper';
import { recordL1Response, recordL2CacheHit, recordL4TaskEnqueue } from '../utils/perfSlaTelemetry';

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
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const userId = params.userId || getAppUserId();
  const q = new URLSearchParams({
    userId,
    theme: params.theme,
    genre: params.genre,
    cefrLevel: params.cefrLevel,
    duration: String(params.duration),
  });
  if (params.date) q.set('date', params.date);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`/api/listen/pregenerated?${q}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    recordL1Response(`GET /api/listen/pregenerated (${params.duration}m)`, durationMs, res.ok);

    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    if (data.status === 'ready') {
      recordL2CacheHit(`Listen Pregenerated Ready (${params.genre}/${params.cefrLevel}/${params.duration}m)`, durationMs);
    }
    return data;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    recordL1Response(`GET /api/listen/pregenerated (${params.duration}m)`, durationMs, false);
    throw err;
  }
}

export async function submitPregeneratedBackfill(body: {
  theme: string;
  genre: string;
  cefrLevel: string;
  duration: number;
  only?: 'both' | 'article' | 'audio';
  userId?: string;
}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch('/api/listen/pregenerated/backfill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, userId: body.userId || getAppUserId() }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    recordL4TaskEnqueue(`Listen Backfill Submit (${body.duration}m)`, durationMs, data.taskId || 'unknown');
    return data as { success: boolean; taskId: string };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    throw err;
  }
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

export async function submitSyncLongArticleToListen(body: {
  theme: string;
  genre: string;
  cefrLevel: string;
  duration: number;
  userId?: string;
}): Promise<{ success: boolean; taskId: string }> {
  const res = await fetch('/api/listen/sync-long-article-to-listen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, userId: body.userId || getAppUserId() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as { success: boolean; taskId: string };
}
