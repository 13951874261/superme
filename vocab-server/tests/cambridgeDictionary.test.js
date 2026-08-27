const assert = require('assert');
const {
  isSingleEnglishWord,
  parseCambridgeMarkdown,
  mergeCambridgeWithDify,
} = require('../services/cambridgeDictionary');

const markdown = `# Translation of **vibe** – English–Mandarin Chinese dictionary

vibe

noun

uk

Your browser doesn't support HTML5 audio

/vaɪb/us

Your browser doesn't support HTML5 audio

/vaɪb/

### vibenoun  (MOOD)

[\\[ C \\]](https://dictionary.cambridge.org/help/codes.html)informal

the [mood](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/mood) of a place and the way that it makes you feel

（某地的）气氛，氛围

The city is famous for its laid-back vibe.

Good vibes

The music has a soothing vibe.这种音乐能让人放松。

### vibenoun  (INSTRUMENT)

**vibes**[\\[ plural \\]](https://dictionary.cambridge.org/help/codes.html)

informal for vibraphone: a musical instrument with metal bars.

电颤琴，颤音琴

He would often play the vibes in their recording sessions.

(Translation of **vibe** from the Cambridge English-Chinese (Simplified) Dictionary © Cambridge University Press)

## Examples of vibe

Wikipedia content that must not become a Cambridge sense.
`;

assert.strictEqual(isSingleEnglishWord('vibe'), true);
assert.strictEqual(isSingleEnglishWord("don't"), true);
assert.strictEqual(isSingleEnglishWord('cost-effective'), true);
assert.strictEqual(isSingleEnglishWord('cost structure'), false);
assert.strictEqual(isSingleEnglishWord('成本'), false);
assert.strictEqual(isSingleEnglishWord('Our costs rose.'), false);

const cambridge = parseCambridgeMarkdown(markdown, {
  word: 'vibe',
  sourceUrl: 'https://dictionary.cambridge.org/dictionary/english-chinese-simplified/vibe',
});

assert.strictEqual(cambridge.headword, 'vibe');
assert.strictEqual(cambridge.raw_markdown, markdown);
assert.deepStrictEqual(cambridge.phonetics, { uk: '/vaɪb/', us: '/vaɪb/' });
assert.strictEqual(cambridge.phonetic, '/vaɪb/');
assert.strictEqual(cambridge.pos, 'noun');
assert.strictEqual(cambridge.senses.length, 2);
assert.strictEqual(cambridge.senses[0].label, 'MOOD');
assert.strictEqual(cambridge.senses[0].register, 'informal');
assert.deepStrictEqual(cambridge.senses[0].grammar, ['C']);
assert.strictEqual(cambridge.senses[0].translation_zh, '（某地的）气氛，氛围');
assert.strictEqual(cambridge.senses[1].headword, 'vibes');
assert.ok(cambridge.example_sentences.some((item) => item.zh === '这种音乐能让人放松。'));
assert.ok(cambridge.example_sentences.some((item) => item.en === 'Good vibes'));
assert.ok(!cambridge.example_sentences.some((item) => item.en.includes('Wikipedia')));
assert.ok(!cambridge.example_sentences.some((item) => item.en.includes('Translation of')));
assert.strictEqual(cambridge.source, 'Cambridge English-Chinese (Simplified) Dictionary');
assert.strictEqual(cambridge.copyright, '© Cambridge University Press');

const merged = mergeCambridgeWithDify(cambridge, {
  direction_resolved: 'en_to_zh',
  phonetic: '/wrong/',
  pos: 'verb',
  translation_main: 'Dify 释义',
  other_meanings: [{ meaning: '（某地的）气氛，氛围', context: 'duplicate' }, { meaning: 'Dify 其他义项', context: 'fallback' }],
  example_sentences: [{ en: 'The city is famous for its laid-back vibe.', zh: '重复例句。' }, { en: 'Dify example.', zh: 'Dify 例句。' }],
  synonyms: ['atmosphere'],
  antonyms: ['tension'],
  collocations: ['team vibe'],
  business_note: '团队文化语境。',
});

assert.strictEqual(merged.phonetic, '/vaɪb/');
assert.strictEqual(merged.pos, 'noun');
assert.strictEqual(merged.translation_main, '（某地的）气氛，氛围');
assert.strictEqual(merged.senses.length, 2);
assert.ok(!merged.example_sentences.some((item) => item.en === 'Dify example.'));
assert.strictEqual(merged.example_sentences.filter((item) => item.en === 'The city is famous for its laid-back vibe.').length, 1);
assert.strictEqual(merged.other_meanings.filter((item) => item.meaning === '（某地的）气氛，氛围').length, 0);
assert.strictEqual(merged.translation_main, '（某地的）气氛，氛围');
assert.ok(merged.other_meanings.some((item) => item.meaning === 'Dify 其他义项'));
assert.deepStrictEqual(merged.synonyms, ['atmosphere']);
assert.strictEqual(merged.business_note, '团队文化语境。');
assert.strictEqual(merged.cambridge_raw.senses.length, 2);
assert.strictEqual(merged.dify_raw.translation_main, 'Dify 释义');
assert.strictEqual(merged.field_sources.phonetic, 'cambridge');
assert.strictEqual(merged.field_sources.synonyms, 'dify');
const emptyCambridgeMerged = mergeCambridgeWithDify({ ...cambridge, phonetic: '', level: '' }, { phonetic: '/dɪfi/', level: 'B2' });
assert.strictEqual(emptyCambridgeMerged.phonetic, '/dɪfi/');
assert.strictEqual(emptyCambridgeMerged.level, 'B2');

console.log('cambridge dictionary tests passed');
