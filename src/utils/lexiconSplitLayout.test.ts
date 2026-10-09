import assert from 'node:assert/strict';
import test from 'node:test';
import { planLexiconSplit } from './lexiconSplitLayout';

const mud = {
  idioms: 3,
  synonyms: 4,
  antonyms: 2,
  collocations: 1,
  hasEtymology: true,
};

test('splitLexicon 关闭时保持单列', () => {
  const plan = planLexiconSplit({ splitLexicon: false, ...mud });
  assert.equal(plan.useSplit, false);
  assert.equal(plan.gridClass, 'space-y-3');
  assert.equal(plan.leftInnerClass, '');
});

test('mud：左栏释义与搭配并排压缩，右栏三块均分，两列 items-stretch 等高', () => {
  const plan = planLexiconSplit({ splitLexicon: true, ...mud });
  assert.equal(plan.useSplit, true);
  assert.deepEqual(plan.leftFillBlocks, ['collocations']);
  assert.deepEqual(plan.rightBlocks, ['idioms', 'synonyms', 'antonyms']);
  assert.equal(plan.rightRowCount, 3);
  assert.match(plan.gridClass, /items-stretch/);
  assert.match(plan.gridClass, /gap-2/);
  assert.doesNotMatch(plan.gridClass, /min-h-\[28rem\]/);
  assert.match(plan.leftInnerClass, /grid-cols-2/);
  assert.match(plan.rightCellClass, /basis-0/);
  assert.doesNotMatch(plan.rightCellClass, /min-h-\[5\.5rem\]/);
});

test('扩展块都空时即使开启 split 也不分栏', () => {
  const plan = planLexiconSplit({
    splitLexicon: true,
    idioms: 0,
    synonyms: 0,
    antonyms: 0,
    collocations: 0,
    hasEtymology: false,
  });
  assert.equal(plan.useSplit, false);
});

test('无搭配时左栏不并排，右栏仍均分三块', () => {
  const plan = planLexiconSplit({
    splitLexicon: true,
    idioms: 2,
    synonyms: 2,
    antonyms: 1,
    collocations: 0,
    hasEtymology: false,
  });
  assert.deepEqual(plan.leftFillBlocks, []);
  assert.deepEqual(plan.rightBlocks, ['idioms', 'synonyms', 'antonyms']);
  assert.match(plan.leftInnerClass, /flex flex-col/);
  assert.doesNotMatch(plan.leftInnerClass, /grid-cols-2/);
});
