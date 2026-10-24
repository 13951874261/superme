const assert = require('assert');
const { stemWordKey } = require('../services/dailyPackService');

function same(a, b) {
  assert.strictEqual(stemWordKey(a), stemWordKey(b), `${a} 与 ${b} 必须同一词根`);
}

function testStemPairs() {
  same('model', 'modeling');
  same('model', 'modelling');
  same('model', 'models');
  same('MODELING', 'modelling');
  same('negotiate', 'negotiation');
  same('negotiate', 'negotiating');
  same("prisoner's dilemma", 'prisoners dilemma');
  same('prisoner', 'prisoners');
  same('discuss', 'discussion');
  assert.notStrictEqual(stemWordKey('leverage'), stemWordKey('advantage'));
  console.log('PASS vocabStem');
}

testStemPairs();
