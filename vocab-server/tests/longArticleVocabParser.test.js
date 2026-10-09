const assert = require('assert');
const { parseVocabFromRaw } = require('../services/dailyListenPreGenerateService');

function testAliasesAreExtracted() {
  const raw = `---VOCAB_JSON_START---
  {"new_words":[{"word":"allocate"}],"useful_phrases":["in response to"],"sentence_patterns":["It is essential that ..."]}
  ---VOCAB_JSON_END---`;
  const result = parseVocabFromRaw(raw);
  assert.strictEqual(result.vocab.length, 1, 'new_words 应提取为生词');
  assert.strictEqual(result.phrases.length, 1, 'useful_phrases 应提取为短语');
  assert.strictEqual(result.sentences.length, 1, 'sentence_patterns 应提取为句式');
}

function testStandardWordsStillWorks() {
  const raw = `---VOCAB_JSON_START---
  {"words":["concession","stakeholder"],"phrases":["supply chain"],"sentences":["Thank you for joining."]}
  ---VOCAB_JSON_END---`;
  const result = parseVocabFromRaw(raw);
  assert.strictEqual(result.vocab.length, 2, 'words 标准字段仍可用');
  assert.strictEqual(result.phrases.length, 1, 'phrases 标准字段仍可用');
  assert.strictEqual(result.sentences.length, 1, 'sentences 标准字段仍可用');
}

function testNestedObject() {
  const raw = `---VOCAB_JSON_START---
  {"new_words":[{"word":"allocate","phonetic":"/ˈæl.ə.keɪt/","phrase":"allocate resources"}]}
  ---VOCAB_JSON_END---`;
  const result = parseVocabFromRaw(raw);
  assert.strictEqual(result.vocab.length, 1, '嵌套对象应提取');
  assert.strictEqual(result.vocab[0].word, 'allocate', 'word 字段保留');
}

function testEmptyRawReturnsEmpty() {
  const empty = parseVocabFromRaw('');
  assert.deepStrictEqual(empty, { vocab: [], phrases: [], sentences: [] });
  const nullResult = parseVocabFromRaw(null);
  assert.deepStrictEqual(nullResult, { vocab: [], phrases: [], sentences: [] });
}

function testFallbackRawSearchStillWorks() {
  const raw = 'Some article text.\n{"words":["expatriate","leverage"]}\nMore text.';
  const result = parseVocabFromRaw(raw);
  assert.strictEqual(result.vocab.length, 2, 'fallback 全文扫描仍可用');
}

function testUnmarkedNestedVocab() {
  const expected = {
    vocab: [{ word: 'portfolio', meaning: '投资组合', examples: ['Review the {portfolio} and say "ready".'] }],
    phrases: ['credit committee'],
    sentences: ['What support do you need?'],
  };
  const json = JSON.stringify({ words: expected.vocab, phrases: expected.phrases, sentences: expected.sentences });
  for (const raw of [
    `Article text.\n${json}\nMore text.`,
    `Article text.\n\`\`\`json\n${json}\n\`\`\``,
    `An unrelated {note}.\n${json}\n{"metadata":{"done":true}}`,
  ]) {
    assert.deepStrictEqual(parseVocabFromRaw(raw), expected, '无标记嵌套词表应完整提取');
  }
  assert.deepStrictEqual(parseVocabFromRaw('Article. {"words":[{"word":"portfolio"}'), {
    vocab: [], phrases: [], sentences: [],
  }, '截断 JSON 不应提取不完整词表');
}

testUnmarkedNestedVocab();
testAliasesAreExtracted();
testStandardWordsStillWorks();
testNestedObject();
testEmptyRawReturnsEmpty();
testFallbackRawSearchStillWorks();
console.log('✅ longArticleVocabParser.test.js 通过');
