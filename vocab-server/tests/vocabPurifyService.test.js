require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const { purifyVocabulary, normalizeResult } = require('../services/vocabPurifyService');

(async () => {
  const normalized = normalizeResult({
    words: [{ word: 'test', phonetic: '/t/', pos: 'n.', zh_meaning: '测试' }],
    phrases: [{ phrase: 'as well', meaning: '也' }],
    sentences: ['The CEO will review this.', 'We must align with stakeholders.'],
  });
  assert.strictEqual(normalized.words.length, 1);
  assert.strictEqual(normalized.words[0].word, 'test');
  assert.strictEqual(normalized.phrases.length, 1);
  assert.strictEqual(normalized.sentences.length, 2);

  const key = process.env.VOCAB_PURIFY_LLM_API_KEY || process.env.LISTEN_LLM_API_KEY;
  assert.ok(key, 'LLM key must be configured');

  const result = await purifyVocabulary({
    articleText: 'The board of directors has decided to divest from the underperforming asset portfolio. Stakeholders are closely monitoring the strategic realignment, which is expected to yield significant synergies and improve operational efficiency across divisions. The CFO emphasized that this decision was not made lightly, as it involves complex contractual obligations and regulatory considerations. However, the projected returns on the new investment vehicles far outweigh the transitional costs associated with this divestiture.',
    topic: 'M&A',
  }, key);

  assert.ok(Array.isArray(result.words));
  assert.ok(result.words.length > 0);
  assert.ok(Array.isArray(result.phrases));
  assert.ok(result.phrases.length > 0);
  assert.ok(Array.isArray(result.sentences));
  assert.ok(result.sentences.length >= 3);
  result.words.forEach((w) => {
    assert.ok(typeof w.word === 'string' && w.word.length > 0);
  });
  result.phrases.forEach((p) => {
    assert.ok(typeof p.phrase === 'string' && p.phrase.length > 0);
  });
  console.log('vocabPurifyService real LLM tests passed');
})().catch((error) => { console.error(error); process.exit(1); });