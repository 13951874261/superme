const assert = require('assert');
const { extractJsonObject } = require('../services/openaiCompatLlm');

// bare JSON
assert.deepStrictEqual(extractJsonObject('{"a":1}'), { a: 1 });

// markdown fence
assert.deepStrictEqual(
  extractJsonObject('```json\n{"phonetic":"/mʌnθ/","meaning_zh":"月"}\n```'),
  { phonetic: '/mʌnθ/', meaning_zh: '月' },
);

// think wrapper + prose
assert.deepStrictEqual(
  extractJsonObject('<think>planning</think>\nHere you go:\n{"ok":true,"n":2}\n'),
  { ok: true, n: 2 },
);

// trailing comma recovery
assert.deepStrictEqual(
  extractJsonObject('{"a":1,"b":[2,],}'),
  { a: 1, b: [2] },
);

assert.throws(() => extractJsonObject('no braces at all'), /LLM did not return JSON/);
assert.throws(() => extractJsonObject(''), /LLM did not return JSON/);

console.log('openaiCompatLlm extractJsonObject tests passed');
