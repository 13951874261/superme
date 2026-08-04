#!/usr/bin/env node
const assert = require('assert');
const dailyListen = require('../services/dailyListenPreGenerateService');

async function testRaceTimeoutRejects() {
  const t0 = Date.now();
  let rejected = false;
  try {
    await dailyListen.raceWithTimeout(new Promise(() => {}), 120, 'extractVocab');
  } catch (e) {
    rejected = /timeout/i.test(String(e.message || e));
  }
  const elapsed = Date.now() - t0;
  assert.ok(rejected, '应因超时 reject');
  assert.ok(elapsed >= 100 && elapsed < 2000, `超时应约 120ms, elapsed=${elapsed}`);
}

async function testRaceResolvesBeforeTimeout() {
  const got = await dailyListen.raceWithTimeout(
    Promise.resolve({ vocab: [{ word: 'ok' }] }),
    1000,
    'extractVocab',
  );
  assert.strictEqual(got.vocab[0].word, 'ok');
}

function testDefaultTimeoutMs() {
  const prev = process.env.EXTRACT_VOCAB_TIMEOUT_MS;
  delete process.env.EXTRACT_VOCAB_TIMEOUT_MS;
  assert.strictEqual(dailyListen.getExtractVocabTimeoutMs(), 90 * 1000);
  process.env.EXTRACT_VOCAB_TIMEOUT_MS = '250';
  assert.strictEqual(dailyListen.getExtractVocabTimeoutMs(), 250);
  if (prev === undefined) delete process.env.EXTRACT_VOCAB_TIMEOUT_MS;
  else process.env.EXTRACT_VOCAB_TIMEOUT_MS = prev;
}

async function main() {
  testDefaultTimeoutMs();
  console.log('PASS default extract timeout ms');
  await testRaceTimeoutRejects();
  console.log('PASS raceWithTimeout rejects');
  await testRaceResolvesBeforeTimeout();
  console.log('PASS raceWithTimeout resolves');
  console.log('OK extract-vocab-timeout');
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
