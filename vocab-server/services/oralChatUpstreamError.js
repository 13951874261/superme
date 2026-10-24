function bodyText(body) {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

function isOralUpstreamFailure(status, body) {
  const code = Number(status) || 0;
  if (code === 522 || code === 502 || code === 503 || code === 504 || code >= 500) return true;
  return /status code 522|\b522\b|Cloudflare|origin timed? ?out/i.test(bodyText(body));
}

function mapOralUpstreamError(status, body) {
  if (!isOralUpstreamFailure(status, body)) {
    return { status: Number(status) || 400, body: body && typeof body === 'object' ? body : { message: bodyText(body) || '口语推演请求失败' } };
  }
  return {
    status: 503,
    body: {
      fallback: true,
      message: '口语推演上游超时或不可用，已允许本地开场',
      upstreamStatus: Number(status) || 0,
    },
  };
}

module.exports = { isOralUpstreamFailure, mapOralUpstreamError };
