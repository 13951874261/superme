const API_BASE = '/api/listening';

export type ListeningDifficulty = 'A2' | 'B1' | 'B2' | 'C1';

export interface ListeningMaterial {
  id: string;
  title: string;
  content_text: string;
  audio_url: string;
  difficulty: ListeningDifficulty;
  category: string;
  duration: number;
  has_subtext: boolean;
  subtext_analysis: string;
  source_type: string;
  source_topic: string;
  source_url: string;
  created_at: number;
  updated_at: number;
  source?: {
    type?: string;
    topic?: string;
    voice?: string;
    [key: string]: unknown;
  };
}

export interface ListeningMaterialsResponse {
  success: boolean;
  data: ListeningMaterial[];
  error?: string;
}

export async function fetchListeningMaterials(params: {
  difficulty?: ListeningDifficulty | 'all';
  category?: string;
  limit?: number;
} = {}): Promise<ListeningMaterial[]> {
  const search = new URLSearchParams();
  if (params.difficulty && params.difficulty !== 'all') search.set('difficulty', params.difficulty);
  if (params.category) search.set('category', params.category);
  if (params.limit) search.set('limit', String(params.limit));

  const suffix = search.toString() ? `?${search.toString()}` : '';
  const response = await fetch(`${API_BASE}/materials${suffix}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `听力材料加载失败：HTTP ${response.status}`);
  }

  return Array.isArray(data?.data) ? data.data : [];
}

export async function requestListeningTts(id: string, voice = 'alloy'): Promise<{ success: boolean; pending?: boolean; audioUrl?: string; message?: string }> {
  const response = await fetch(`${API_BASE}/tts/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice, format: 'mp3' }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok && response.status !== 202) {
    throw new Error(data?.error || `TTS 请求失败：HTTP ${response.status}`);
  }

  return data;
}
