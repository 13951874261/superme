const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseVocabFromRaw } = require('../services/dailyListenPreGenerateService');

test('parseVocabFromRaw salvages complete items from truncated Dify VOCAB_JSON block', () => {
  const truncatedRaw = `📝 沉浸式听力/阅读长篇材料 (生成完毕)

CHAIRPERSON ALEX (DIRECTOR): Good morning, everyone.

---VOCAB_JSON_START---
{
  "words": [
    {
      "word": "syndicated",
      "phonetic": "ˈsɪndɪkeɪtɪd",
      "partOfSpeech": "adj.",
      "meaning": "银团的；联合辛迪加的",
      "definition_en": "formed by a syndicate of banks",
      "examples": ["When we look at the big picture, this syndicated loan is a major step for all of us."]
    },
    {
      "word": "concession",
      "phonetic": "kənˈseʃn",
      "partOfSpeech": "n.",
      "meaning": "让步；妥协",
      "definition_en": "a thing that is granted in response to demands",
      "examples": ["Any concession on pricing must be paired with stricter covenants."]
    }
  ],
  "phrases": [
    {
      "phrase": "get down to business",
      "meaning": "切入正题；开始干正事",
      "definition_en": "start talking about the subject to be discussed",
      "examples": ["Let us get down to business right away."]
    },
    {
      "phrase": "truncated_item_without_closing_brace",
      "meaning": "半截被截断`;

  const res = parseVocabFromRaw(truncatedRaw);
  assert.equal(res.vocab.length, 2);
  assert.equal(res.vocab[0].word, 'syndicated');
  assert.equal(res.vocab[1].word, 'concession');
  assert.deepEqual(res.phrases, ['get down to business']);
  assert.deepEqual(res.sentences, ['Let us get down to business right away.']);
});

const vm = require('node:vm');
const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
function loadFunction(name, nextName, globals = {}) {
  const start = serverCode.indexOf(`function ${name}(`);
  const end = serverCode.indexOf(`\n${nextName}`, start);
  assert.ok(start >= 0 && end > start);
  return vm.runInNewContext(`${serverCode.slice(start, end)}\n${name}`, globals);
}

test('超长文采样受限且保留完整句子', () => {
  const sample = loadFunction('sampleLongBodyForFallback', 'async function extractVocabFallback');
  assert.equal(sample('Short text.'), 'Short text.');
  const body = Array.from({ length: 1500 }, (_, i) => `Sentence ${i} contains business vocabulary.`).join('\n');
  for (const limit of [9000, 4500]) {
    const result = sample(body, limit);
    assert.ok(result.length <= limit, `实际长度 ${result.length} 超过 ${limit}`);
    for (const paragraph of result.split('\n...\n')) {
      assert.match(paragraph, /^Sentence \d+ /);
      assert.match(paragraph, /vocabulary\.$/);
    }
  }
});

test('首轮超时后缩小输入重试', async () => {
  const calls = [];
  const start = serverCode.indexOf('async function extractVocabFallback(');
  const end = serverCode.indexOf('\nasync function callPolishLLM', start);
  const extract = vm.runInNewContext(`${serverCode.slice(start, end)}\nextractVocabFallback`, {
    process: { env: {} }, console: { log() {}, warn() {}, error() {} },
    sampleLongBodyForFallback: (text, limit) => text.slice(0, limit),
    setTimeout: (fn) => { fn(); },
    require: () => ({ getLlmModels: () => ['test-model'], DEFAULT_LLM_KEY: 'test',
      chatCompletions: async (args) => {
        calls.push(args);
        if (calls.length === 1) throw new Error('LLM timeout');
        return { choices: [{ message: { content: '{"words":[{"word":"loan"}],"phrases":[],"sentences":[]}' } }] };
      },
    }),
  });
  const result = await extract('x'.repeat(35033));
  assert.equal(result.vocab[0].word, 'loan');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].timeoutMs, 120000);
  assert.ok(calls[1].messages[1].content.length < calls[0].messages[1].content.length);
});
