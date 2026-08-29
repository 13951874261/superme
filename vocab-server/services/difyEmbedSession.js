const EMBED_SESSION_BUDGET_MS = 2500;
const MIN_UPSTREAM_MS = 80;
const LEGACY_EMBED_SCOPES = ['@embed2', '@embed3'];

function loginAccountFromUserId(userId) {
  const raw = String(userId || '').trim();
  if (!raw) return '';
  const at = raw.indexOf('@');
  return at === -1 ? raw : raw.slice(0, at);
}

function candidateSessionIds(userId) {
  const loginId = loginAccountFromUserId(userId) || String(userId || '').trim();
  const ids = [loginId];
  for (const scope of LEGACY_EMBED_SCOPES) {
    ids.push(`${loginId}${scope}`);
  }
  return [...new Set(ids.filter(Boolean))];
}

async function resolveDifyEmbedSession({
  userId,
  conversationId = '',
  renew = false,
  fetchImpl = fetch,
  webBaseUrl,
  appCode,
  now = Date.now,
  budgetMs = EMBED_SESSION_BUDGET_MS,
} = {}) {
  const loginId = loginAccountFromUserId(userId) || String(userId || '').trim();
  if (!loginId) {
    const err = new Error('缺少 userId 参数。');
    err.statusCode = 400;
    throw err;
  }

  if (renew) {
    return { conversationId: null, sessionUserId: loginId, stale: false, forceNew: true, reason: 'renew' };
  }

  const started = now();
  const remaining = () => Math.max(0, budgetMs - (now() - started));
  const root = String(webBaseUrl || '').replace(/\/$/, '').replace(/\/v1$/, '');
  const code = String(appCode || '').trim();
  if (!root || !code) {
    return { conversationId: null, sessionUserId: loginId, stale: false, forceNew: true, reason: 'misconfigured' };
  }

  async function upstream(url, headers = {}) {
    if (remaining() < MIN_UPSTREAM_MS) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining());
    try {
      return await fetchImpl(url, {
        headers: {
          'X-App-Code': code,
          ...headers,
        },
        signal: controller.signal,
      });
    } catch (err) {
      console.error('[embed-session] upstream failed:', err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function passportFor(sessionUserId) {
    const url = `${root}/api/passport?user_id=${encodeURIComponent(sessionUserId)}`;
    const response = await upstream(url);
    if (!response || !response.ok) return '';
    const data = await response.json().catch(() => ({}));
    return String(data?.access_token || '').trim();
  }

  async function listConversations(token) {
    const url = `${root}/api/conversations?limit=10&sort_by=-updated_at`;
    const response = await upstream(url, { 'X-App-Passport': token });
    if (!response || !response.ok) return [];
    const data = await response.json().catch(() => ({}));
    return Array.isArray(data?.data) ? data.data : [];
  }

  async function messagesOk(token, convId) {
    if (!convId) return false;
    const url = `${root}/api/messages?conversation_id=${encodeURIComponent(convId)}&limit=1`;
    const response = await upstream(url, { 'X-App-Passport': token });
    return Boolean(response && response.ok);
  }

  const cached = String(conversationId || '').trim();

  async function lookupSlot(sessionUserId) {
    const token = await passportFor(sessionUserId);
    if (!token) return [];
    const conversations = await listConversations(token);
    const found = [];
    for (const item of conversations) {
      const id = String(item?.id || '').trim();
      if (!id) continue;
      if (!(await messagesOk(token, id))) continue;
      found.push({
        conversationId: id,
        sessionUserId,
        updatedAt: Number(item?.updated_at || 0),
      });
      break;
    }
    return found;
  }

  const candidates = (await Promise.all(candidateSessionIds(loginId).map(lookupSlot))).flat();

  if (cached) {
    const hit = candidates.find((item) => item.conversationId === cached);
    if (hit) {
      return { conversationId: hit.conversationId, sessionUserId: hit.sessionUserId, stale: false };
    }
  }

  if (!candidates.length) {
    return {
      conversationId: null,
      sessionUserId: loginId,
      stale: false,
      forceNew: true,
      reason: remaining() < MIN_UPSTREAM_MS ? 'timeout' : 'no_conversation',
    };
  }

  candidates.sort((a, b) => b.updatedAt - a.updatedAt);
  const best = candidates[0];
  return {
    conversationId: best.conversationId,
    sessionUserId: best.sessionUserId,
    stale: false,
    recovered: Boolean(cached && cached !== best.conversationId),
  };
}

module.exports = {
  EMBED_SESSION_BUDGET_MS,
  resolveDifyEmbedSession,
  candidateSessionIds,
};
