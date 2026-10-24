function resolveTestApiBase(env = process.env) {
  if (!env.TEST_API_BASE_URL) return null;
  const url = new URL(env.TEST_API_BASE_URL);
  if (!['http:', 'https:'].includes(url.protocol)
    || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || !url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('TEST_API_BASE_URL 必须是带端口的本机独立测试服务地址');
  }
  return url.origin;
}

module.exports = { resolveTestApiBase };
