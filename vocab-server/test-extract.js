const assert = require('assert');

function extractJsonFromString(raw) {
  const rawStr = String(raw ?? '').trim();
  const jsonBlockMatch = rawStr.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    return jsonBlockMatch[1].trim();
  }
  const startIdx = rawStr.indexOf('{');
  const endIdx = rawStr.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return rawStr.substring(startIdx, endIdx + 1).trim();
  }
  return rawStr.replace(/```json/gi, '').replace(/```/g, '').trim();
}

// Test cases
const tc1 = '```json\n{"L1": "test"}\n```';
assert.strictEqual(extractJsonFromString(tc1), '{"L1": "test"}');

const tc2 = 'Here is the result:\n{\n  "L1": "test2"\n}\nHope it helps!';
assert.strictEqual(extractJsonFromString(tc2), '{\n  "L1": "test2"\n}');

const tc3 = '```json{"L1": "test3"}```';
assert.strictEqual(extractJsonFromString(tc3), '{"L1": "test3"}');

const tc4 = '{"L1": "test4"}';
assert.strictEqual(extractJsonFromString(tc4), '{"L1": "test4"}');

console.log('All JSON extraction tests passed!');
