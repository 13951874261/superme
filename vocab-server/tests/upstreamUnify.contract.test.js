const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const serverSrc = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const webSrc = fs.readFileSync(path.join(root, 'services/webFetcher.js'), 'utf8');
const llm = require('../services/openaiCompatLlm');

assert.ok(
  serverSrc.includes("IMAGE_GEN_FALLBACK_URL || 'https://9router.234124123.xyz/v1'"),
  'image gen must keep Agnes primary and add 9router fallback'
);
assert.ok(serverSrc.includes('ag/gemini-3.1-flash-image'), 'image fallback model must be gemini');
assert.ok(serverSrc.includes("IMAGE_GEN_BASE_URL || 'https://apihub.agnes-ai.cn/v1'"), 'Agnes remains primary');

assert.strictEqual(llm.DEFAULT_LLM_URL, 'https://aow2.234124123.xyz/aow/v1/chat/completions');
assert.strictEqual(llm.DEFAULT_LLM_KEY, 'sk-aow2api-your-custom-key');
assert.deepStrictEqual(llm.DEFAULT_LLM_MODELS, ['114']);
assert.ok(!serverSrc.includes('https://23.95.214.232/v1/chat/completions'), 'server.js must not hardcode old chat completions');

assert.ok(webSrc.includes("FETCH_ENDPOINT_BASE || 'https://fetch.234124123.xyz/v1'"), 'web fetch default must use the confirmed upstream');
assert.ok(webSrc.includes("model: 'firecrawl'"), 'web fetch model must be firecrawl');
assert.ok(webSrc.includes('sk-d2c5fb65e9516bbc-rd1lv9-762292df'), 'web fetch default key must match new gateway');
assert.ok(webSrc.includes("parsed.protocol === 'https:'"), 'web fetch must pick http/https by protocol');
assert.ok(webSrc.includes('postJsonWithRetry('), 'web fetch must retry transient upstream errors');

const helperSrc = fs.readFileSync(path.join(root, 'services/openaiCompatLlm.js'), 'utf8');
assert.ok(helperSrc.includes("parsed.protocol === 'https:'"), 'LLM helper must pick http/https by protocol');

const liveServices = [
  'listenAnalysisService.js',
  'vocabPurifyService.js',
  'sentenceEvaluationService.js',
  'aestheticsFallback.js',
  'ascensionFallback.js',
  'writeGovernanceFallback.js',
  'vocabMatrixEnricher.js',
  'knowledgeDraftExtract.js',
  'vaultRefine.js',
  'audioTranscriptionService.js',
];
for (const name of liveServices) {
  const src = fs.readFileSync(path.join(root, 'services', name), 'utf8');
  assert.ok(!src.includes('https://23.95.214.232/v1/chat/completions'), `${name} must not hardcode old LLM URL`);
}

console.log('upstreamUnify contract passed');
