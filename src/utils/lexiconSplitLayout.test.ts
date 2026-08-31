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

test('splitLexicon 关闭时保持单列，不把 2-5 拆到右侧', () => {
  const plan = planLexiconSplit({ splitLexicon: false, ...mud });
  assert.equal(plan.useSplit, false);
  assert.equal(plan.rightRowCount, 0);
  assert.equal(plan.gridClass, 'space-y-3');
  assert.equal(plan.rightCellClass, '');
});

test('mud 英汉词卡：右栏四块 flex 均分，与左栏释义总高等齐', () => {
  const plan = planLexiconSplit({ splitLexicon: true, ...mud });
  assert.equal(plan.useSplit, true);
  assert.deepEqual(plan.rightBlocks, ['idioms', 'synonyms', 'antonyms', 'collocations']);
  assert.equal(plan.rightRowCount, 4);
  assert.match(plan.gridClass, /md:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(0,0\.85fr\)\]/);
  assert.match(plan.gridClass, /md:min-h-\[28rem\]/);
  assert.match(plan.rightRailClass, /h-full/);
  assert.match(plan.rightCellClass, /flex-1/);
  assert.match(plan.rightCellClass, /basis-0/);
});

test('右侧四块都空时即使开启 split 也不分栏', () => {
  const plan = planLexiconSplit({
    splitLexicon: true,
    idioms: 0,
    synonyms: 0,
    antonyms: 0,
    collocations: 0,
    hasEtymology: false,
  });
  assert.equal(plan.useSplit, false);
  assert.equal(plan.rightRowCount, 0);
});

test('缺习语时右栏三块仍均分，不把余高只给最后一块', () => {
  const plan = planLexiconSplit({
    splitLexicon: true,
    idioms: 0,
    synonyms: 2,
    antonyms: 1,
    collocations: 3,
    hasEtymology: false,
  });
  assert.deepEqual(plan.rightBlocks, ['synonyms', 'antonyms', 'collocations']);
  assert.equal(plan.rightRowCount, 3);
  assert.match(plan.rightCellClass, /basis-0/);
});
