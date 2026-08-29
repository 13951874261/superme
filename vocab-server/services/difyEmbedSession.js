const EMBED_SESSION_BUDGET_MS = 2500;
const MIN_UPSTREAM_MS = 80;

async function resolveDifyEmbedSession({
  userId,
  conversationId = '',
  renew = false,
  fetchImpl = fetch,
  apiKey,
  baseUrl,
  now = Date.now,
  budgetMs = EMBED_SESSION_BUDGET_MS,
} = {}) {
  const uid = String(userId || '').trim();
  if (!uid) {
    const err = new Error('缺少 userId 参数。');
    err.statusCode = 400;
    throw err;
  }

  if (renew) {
    return { conversationId: null, stale: false, forceNew: true, reason: 'renew' };
  }

  const started = now();
  const remaining = () => Math.max(0, budgetMs - (now() - started));
  const root = String(baseUrl || '').replace(/\/$/, '');

  async function upstream(url) {
    if (remaining() < MIN_UPSTREAM_MS) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining());
    try {
      return await fetchImpl(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
    } catch (err) {
      console.error('[embed-session] upstream failed:', err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function validateConversation(convId) {
    if (!convId) return false;
    const url = `${root}/messages?user=${encodeURIComponent(uid)}&conversation_id=${encodeURIComponent(convId)}&limit=1`;
    const response = await upstream(url);
    return Boolean(response && response.ok);
  }

  async function listLatestConversation() {
    const url = `${root}/conversations?user=${encodeURIComponent(uid)}&limit=1&sort_by=-updated_at`;
    const response = await upstream(url);
    if (!response || !response.ok) return null;
    const data = await response.json().catch(() => ({}));
    return data?.data?.[0]?.id || null;
  }

  const cached = String(conversationId || '').trim();
  if (cached) {
    if (await validateConversation(cached)) {
      return { conversationId: cached, stale: false };
    }
    const latest = await listLatestConversation();
    if (latest && await validateConversation(latest)) {
      return { conversationId: latest, stale: false, recovered: true };
    }
    return { conversationId: null, stale: true, forceNew: true, reason: 'cached_invalid' };
  }

  const latest = await listLatestConversation();
  if (latest && await validateConversation(latest)) {
    return { conversationId: latest, stale: false };
  }
  if (latest) {
    return { conversationId: null, stale: true, forceNew: true, reason: 'listed_invalid' };
  }
  return {
    conversationId: null,
    stale: false,
    forceNew: true,
    reason: remaining() < MIN_UPSTREAM_MS ? 'timeout' : 'no_conversation',
  };
}

module.exports = {
  EMBED_SESSION_BUDGET_MS,
  resolveDifyEmbedSession,
};
