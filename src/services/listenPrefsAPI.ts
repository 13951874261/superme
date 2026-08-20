import { getAppUserId } from '../utils/profileHelper';

export interface ListenPrefsResponse {
  success: boolean;
  voiceId: string | null;
  effectiveVoiceId: string;
  error?: string;
}

export async function fetchListenPrefs(userId = getAppUserId()): Promise<ListenPrefsResponse> {
  const res = await fetch(`/api/english/listen-prefs?userId=${encodeURIComponent(userId)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as ListenPrefsResponse;
}

export async function saveListenPrefs(
  voiceId: string,
  userId = getAppUserId()
): Promise<ListenPrefsResponse> {
  const res = await fetch('/api/english/listen-prefs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, voiceId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as ListenPrefsResponse;
}
