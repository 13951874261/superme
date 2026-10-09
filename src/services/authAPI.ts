export interface LoginResponse {
  success: boolean;
  userId?: string;
  error?: string;
  errorCode?: string;
}

const LOGIN_TIMEOUT_MS = 8000;

export async function getSession(): Promise<{ authenticated: true; userId: string } | null> {
  const res = await fetch('/api/auth/session');
  return res.ok ? res.json() : null;
}

export async function logout(): Promise<void> {
  const res = await fetch('/api/auth/logout', { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || '退出失败');
  }
}

export async function login(userId: string, inviteToken: string): Promise<LoginResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, inviteToken }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data?.error || '登录失败', errorCode: data?.errorCode };
    return data as LoginResponse;
  } finally {
    clearTimeout(timer);
  }
}
