export interface VerifyInviteResponse {
  success: boolean;
  error?: string;
}

const VERIFY_TIMEOUT_MS = 8000;

/**
 * 校验账号是否在后台受邀名单中。
 * 名单只能由 vocab-server/scripts/invite-account.js 手动写入，接口不回传名单。
 */
export async function verifyInvite(userId: string): Promise<VerifyInviteResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch('/api/auth/verify-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data as VerifyInviteResponse;
  } finally {
    clearTimeout(timer);
  }
}
