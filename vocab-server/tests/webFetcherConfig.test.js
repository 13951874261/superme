const assert = require('node:assert/strict');

const originalKey = process.env.DIFY_FETCH_API_KEY;
delete process.env.DIFY_FETCH_API_KEY;

const { fetchUrlContent } = require('../services/webFetcher');

(async () => {
  try {
    await assert.rejects(
      fetchUrlContent('https://example.com'),
      /Server missing DIFY_FETCH_API_KEY/
    );
    console.log('webFetcher config test passed');
  } finally {
    if (originalKey === undefined) delete process.env.DIFY_FETCH_API_KEY;
    else process.env.DIFY_FETCH_API_KEY = originalKey;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
