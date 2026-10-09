const assert = require('node:assert/strict');
const { fetchUrlContent } = require('../services/webFetcher');

const original = {
  primaryKey: process.env.DIFY_FETCH_API_KEY,
  aowKey: process.env.AOW_CRAWL_API_KEY,
  aowEndpoint: process.env.AOW_CRAWL_ENDPOINT,
};
process.env.DIFY_FETCH_API_KEY = 'primary-test-key';
process.env.AOW_CRAWL_API_KEY = 'aow-test-key';
process.env.AOW_CRAWL_ENDPOINT = 'https://aow.example/aow/crawl';

(async () => {
  const calls = [];
  const result = await fetchUrlContent('https://example.com/article', {
    validateUrl: async () => true,
    postJsonWithRetry: async (url, headers, body) => {
      calls.push({ url, headers, body: JSON.parse(body) });
      if (calls.length === 1) return { status: 503, text: 'primary unavailable' };
      return { status: 200, text: JSON.stringify({ success: true, markdown: '# Fallback title\nFallback body' }) };
    },
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/web\/fetch$/);
  assert.equal(calls[1].url, 'https://aow.example/aow/crawl');
  assert.equal(calls[1].headers.Authorization, 'Bearer aow-test-key');
  assert.deepEqual(calls[1].body, { url: 'https://example.com/article' });
  assert.equal(result.title, 'Fallback title');
  assert.equal(result.markdown, '# Fallback title\nFallback body');
  console.log('webFetcher fallback test passed');
})().finally(() => {
  for (const [key, value] of Object.entries({
    DIFY_FETCH_API_KEY: original.primaryKey,
    AOW_CRAWL_API_KEY: original.aowKey,
    AOW_CRAWL_ENDPOINT: original.aowEndpoint,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
