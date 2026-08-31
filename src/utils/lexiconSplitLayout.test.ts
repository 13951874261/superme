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
  assert.equal(plan.rightRowCount, 0);
  assert.equal(plan.gridClass, 'space-y-3');
  assert.equal(plan.leftFillClass, '');
});

test('mud：搭配与词源整块移到左栏铺满余高，右栏留习语近义反义并与左栏等高', () => {
  const plan = planLexiconSplit({ splitLexicon: true, ...mud });
  assert.equal(plan.useSplit, true);
  assert.deepEqual(plan.leftFillBlocks, ['collocations']);
  assert.deepEqual(plan.rightBlocks, ['idioms', 'synonyms', 'antonyms']);
  assert.equal(plan.rightRowCount, 3);
  assert.match(plan.gridClass, /items-stretch/);
  assert.match(plan.leftFillClass, /flex-1/);
  assert.match(plan.rightCellClass, /basis-0/);
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
  assert.deepEqual(plan.leftFillBlocks, []);
  assert.deepEqual(plan.rightBlocks, []);
});

test('无搭配时左栏不占位，右栏仍均分习语近义反义', () => {
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
  assert.equal(plan.rightRowCount, 3);
});
