const assert = require('node:assert/strict');
const http = require('node:http');
const { fetchAndExtractWebArticle, postJsonWithRetry, REQUEST_TIMEOUT_MS } = require('../services/webArticleExtractor');

const original = {
  key: process.env.AOW_CRAWL_API_KEY,
  endpoint: process.env.AOW_CRAWL_ENDPOINT,
};
process.env.AOW_CRAWL_API_KEY = 'test-key';
process.env.AOW_CRAWL_ENDPOINT = 'https://aow.example/aow/crawl';

(async () => {
  let request;
  const result = await fetchAndExtractWebArticle('https://example.com/story', {
    validateUrl: async () => true,
    postJsonWithRetry: async (url, headers, body) => {
      request = { url, headers, body: JSON.parse(body) };
      return {
        status: 200,
        text: JSON.stringify({
          success: true,
          html: '<html><head><title>Policy Shift</title></head><body><nav>Menu</nav><article><h1>Policy Shift</h1><p>By Jane Doe</p><p>The government announced a significant policy shift today.</p><p>Officials said the measure will take effect next month.</p><h2>Recommended for you</h2><p>Noise story that must not leak.</p><h2>Comments</h2><p>User spam that must not leak.</p></article><aside>Most Popular</aside></body></html>',
        }),
      };
    },
  });

  assert.deepEqual(request.body, { url: 'https://example.com/story', format: 'html' });
  assert.equal(request.headers.Authorization, 'Bearer test-key');
  assert.equal(result.title, 'Policy Shift');
  assert.match(result.markdown, /^# Policy Shift/m);
  assert.match(result.markdown, /significant policy shift/);
  assert.doesNotMatch(result.markdown, /Menu|Most Popular|Recommended for you|Noise story|Comments|User spam/);

  await assert.rejects(
    fetchAndExtractWebArticle('https://example.com/story', {
      validateUrl: async () => true,
      postJsonWithRetry: async () => ({ status: 422, text: 'invalid format' }),
    }),
    /AOW HTML crawl failed: 422/
  );

  await assert.rejects(
    fetchAndExtractWebArticle('http://127.0.0.1/private', { validateUrl: async () => false }),
    /invalid URL or restricted network address/
  );

  assert.equal(REQUEST_TIMEOUT_MS, 60_000);

  const logs = [];
  let attempts = 0;
  const retried = await postJsonWithRetry('https://aow.example/aow/crawl', {}, '{}', false, 1024, {
    post: async () => {
      attempts++;
      if (attempts === 1) throw new Error('ETIMEDOUT');
      return { status: 200, text: '{}' };
    },
    now: (() => { let value = 1000; return () => value += 250; })(),
    log: (message) => logs.push(message),
  });
  assert.equal(retried.status, 200);
  assert.equal(attempts, 2);
  assert.match(logs.join('\n'), /attempt=1.*failed.*elapsedMs=250.*status=0.*bytes=0.*ETIMEDOUT/);
  assert.match(logs.join('\n'), /attempt=2.*success.*elapsedMs=250.*status=200.*bytes=2/);

  const httpLogs = [];
  await assert.rejects(
    postJsonWithRetry('https://aow.example/aow/crawl', {}, '{}', false, 1024, {
      post: async () => ({ status: 503, text: 'unavailable' }),
      now: (() => { let value = 2000; return () => value += 100; })(),
      log: (message) => httpLogs.push(message),
    }),
    /AOW HTML crawl failed: 503/
  );
  assert.match(httpLogs.join('\n'), /attempt=1.*failed.*elapsedMs=100.*status=503.*bytes=11/);

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('x'.repeat(1025));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { postJson } = require('../services/webArticleExtractor');
    await assert.rejects(
      postJson(`http://127.0.0.1:${server.address().port}/crawl`, {}, '{}', false, 1024),
      /response exceeds 1024 bytes/
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('web article extractor tests passed');
})().finally(() => {
  if (original.key === undefined) delete process.env.AOW_CRAWL_API_KEY;
  else process.env.AOW_CRAWL_API_KEY = original.key;
  if (original.endpoint === undefined) delete process.env.AOW_CRAWL_ENDPOINT;
  else process.env.AOW_CRAWL_ENDPOINT = original.endpoint;
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
