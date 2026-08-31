const assert = require('assert');
const {
  pickWakeupSlots,
  isBannedGenericWord,
  THEORY_LEXICON,
} = require('../services/dailyPackService');

function w(word, slot) {
  return { word, ipa: '/x/', meaning_zh: word, pronunciation_note: 't', example: word, slot };
}

function testBan() {
  assert.ok(isBannedGenericWord('modeling'));
  assert.ok(isBannedGenericWord('modelling'));
  assert.ok(isBannedGenericWord('agenda'));
  assert.ok(isBannedGenericWord('deadline'));
  assert.ok(isBannedGenericWord('discussion'));
  assert.ok(!isBannedGenericWord("prisoner's dilemma"));
  console.log('  ban ok');
}

function testPick32() {
  const picked = pickWakeupSlots([
    w('modeling'),
    w('BATNA', 'theme'),
    w('reservation price', 'theme'),
    w('anchoring', 'theme'),
    w("prisoner's dilemma", 'theory'),
    w('Nash equilibrium', 'theory'),
    w('agenda'),
  ]);
  const names = picked.map((x) => x.word);
  assert.strictEqual(picked.length, 5);
  assert.deepStrictEqual(names.slice(0, 3), ['BATNA', 'reservation price', 'anchoring']);
  assert.deepStrictEqual(names.slice(3), ["prisoner's dilemma", 'Nash equilibrium']);
  assert.ok(!names.includes('modeling') && !names.includes('agenda'));
  console.log('  pick 3+2 ok');
}

function testLexiconFallbackSlot() {
  const picked = pickWakeupSlots([
    w('zero-sum'),
    w('butterfly effect'),
    w('custom term A'),
    w('custom term B'),
    w('custom term C'),
  ]);
  const names = picked.map((x) => x.word);
  assert.strictEqual(names.filter((n) => n.startsWith('custom')).length, 3);
  assert.ok(names.includes('zero-sum'));
  assert.ok(names.includes('butterfly effect'));
  console.log('  lexicon fallback ok');
}

function testNoDoubleSlot() {
  const picked = pickWakeupSlots([
    w('BATNA', 'theme'),
    w('term-a', 'theme'),
    w('term-b', 'theme'),
    w('BATNA', 'theory'),
    w('Nash equilibrium', 'theory'),
  ]);
  assert.strictEqual(picked.filter((x) => /batna/i.test(x.word)).length, 1);
  console.log('  no double slot ok');
}

testBan();
testPick32();
testLexiconFallbackSlot();
testNoDoubleSlot();
console.log('PASS wakeupSlotPick');
