require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const { evaluateSentence, normalizeResult, normalizeScore } = require('../services/sentenceEvaluationService');

(async () => {
  assert.strictEqual(normalizeScore(10), 5);
  assert.strictEqual(normalizeScore(-1), 0);
  assert.strictEqual(normalizeScore(3.4), 3);
  const normalized = normalizeResult({ score: 4, is_pass: true, feedback: 'ok', corrected_sentence: 'We need to negotiate the terms.' }, 'negotiate');
  assert.strictEqual(normalized.score, 4);
  assert.strictEqual(normalized.is_pass, true);
  assert.strictEqual(normalized.corrected_sentence, 'We need to negotiate the terms.');
  const key = process.env.EVALUATION_LLM_API_KEY || process.env.LISTEN_LLM_API_KEY;
  assert.ok(key, 'LLM key must be configured');
  const result = await evaluateSentence({
    targetWord: 'negotiate',
    userSentence: 'We need negotiate the price with client.',
    theme: '商务谈判',
  }, key);
  assert.ok(Number.isInteger(result.score));
  assert.ok(result.score >= 0 && result.score <= 5);
  assert.strictEqual(typeof result.is_pass, 'boolean');
  assert.ok(result.feedback.length > 0);
  assert.ok(result.corrected_sentence.length > 0);
  console.log('sentenceEvaluationService real LLM tests passed');
})().catch((error) => { console.error(error); process.exit(1); });