import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyCollectKind, stripThinHoverSeed } from './vocabZoneLabels';

describe('classifyCollectKind', () => {
  it('treats a single word as neither phrase nor sentence', () => {
    assert.deepEqual(classifyCollectKind('legal'), { isPhrase: false, isSentence: false });
  });

  it('classifies a multi-word phrase', () => {
    assert.deepEqual(classifyCollectKind('take late goods'), { isPhrase: true, isSentence: false });
  });

  it('classifies a punctuated long sentence', () => {
    assert.deepEqual(classifyCollectKind('Procurement review, London.'), {
      isPhrase: false,
      isSentence: true,
    });
  });
});

describe('stripThinHoverSeed', () => {
  it('drops hover-only meaning and phonetic', () => {
    assert.deepEqual(
      stripThinHoverSeed({ meaning: '法律的', phonetic: '/ˈliːɡl/', source: 'Material Upload' }),
      { source: 'Material Upload' },
    );
  });

  it('keeps a real dictionary payload', () => {
    const full = { meaning: '法律的', examples: [{ en: 'legal advice', zh: '法律意见' }], source: 'dict' };
    assert.equal(stripThinHoverSeed(full), full);
  });
});
