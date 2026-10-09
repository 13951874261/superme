import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReviewExampleSlots, extractReviewExampleList } from './reviewExampleSlots';

test('extractReviewExampleList prefers sense examples with letter>25 filter', () => {
  const long =
    'The negotiations got stuck in the mud of conflicting stakeholder demands.';
  assert.ok(long.replace(/[^A-Za-z]/g, '').length > 25);
  const list = extractReviewExampleList({
    senses: [{ examples: [{ en: long, zh: '谈判陷入泥潭' }, { en: '/mʌd/', zh: '' }] }],
    example_sentences: [{ en: 'short', zh: '短' }],
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].en, long);
});

test('extractReviewExampleList falls back to example_sentences chain', () => {
  const a =
    'Investors refuse to drag the brand through the mud during the crisis review.';
  const b =
    'Please do not throw mud at the partner team when the forecast misses target.';
  const list = extractReviewExampleList({
    example_sentences: [
      { en: a, zh: '一' },
      { en: b, zh: '二' },
    ],
  });
  assert.equal(list.length, 2);
  assert.equal(list[0].zh, '一');
});

test('extractReviewExampleList splits bilingual example strings and reads examples[]', () => {
  const list = extractReviewExampleList({
    examples: [
      'We completed the vocabzone-e2e-probe ahead of schedule. 词汇库端到端探测已提前完成。',
      'The probe results indicate 98% coverage across all vocabulary zones. 探测结果显示词汇库各区域覆盖率达98%。',
    ],
  });
  assert.equal(list.length, 2);
  assert.equal(list[0].zh, '词汇库端到端探测已提前完成。');
  assert.match(list[0].en, /ahead of schedule/);
});

test('buildReviewExampleSlots pads to 4 and keeps extras (AC2/AC3)', () => {
  const mk = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      en: `Sentence number ${i + 1} with enough english letters here for filter.`,
      zh: `译${i + 1}`,
    }));

  const short = buildReviewExampleSlots(mk(2));
  assert.equal(short.slots.length, 4);
  assert.equal(short.slots.filter(Boolean).length, 2);
  assert.equal(short.slots[2], null);
  assert.equal(short.extra.length, 0);

  const long = buildReviewExampleSlots(mk(7));
  assert.equal(long.slots.filter(Boolean).length, 4);
  assert.equal(long.extra.length, 3);
});
