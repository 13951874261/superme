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

const mudMarkdown = `# Translation of **mud** – English–Mandarin Chinese dictionary

mud

noun

uk

Your browser doesn't support HTML5 audio

/mʌd/us

Your browser doesn't support HTML5 audio

/mʌd/

### mudnoun  (U)

[[ U ]](https://dictionary.cambridge.org/help/codes.html)

earth that has been mixed with water

泥， 泥土; 烂泥， 泥浆; 淤泥

The vehicles got bogged down in the heavy mud.
车辆陷到了淤泥里动弹不得。

Modern houses have replaced the one-room mud huts...
新式住房取代了农民世代居住的单间草顶土屋。

These mud flats are a special research value.
这片淤泥滩有特殊的科研价值。

(Translation of **mud** from the Cambridge English-Chinese (Simplified) Dictionary © Cambridge University Press)

### **Idioms**

[here's mud in your eye!](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/here-s-mud-in-your-eye "meaning")

[hurl/throw/sling mud at someone](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/hurl-throw-sling-mud-at "meaning")

[mud sticks](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/mud-sticks "meaning")

## Examples of mud

Full of aggressive, dirty and equally tender vibes and melodies...
`;

assert.strictEqual(isSingleEnglishWord('vibe'), true);
assert.strictEqual(isSingleEnglishWord("don't"), true);
assert.strictEqual(isSingleEnglishWord('cost-effective'), true);
assert.strictEqual(isSingleEnglishWord('cost structure'), false);
assert.strictEqual(isSingleEnglishWord('成本'), false);
assert.strictEqual(isSingleEnglishWord('Our costs rose.'), false);

// Test vibe parsing
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

// Test mud parsing - ensure idioms are not in examples
const mudCambridge = parseCambridgeMarkdown(mudMarkdown, {
  word: 'mud',
  sourceUrl: 'https://dictionary.cambridge.org/dictionary/english-chinese-simplified/mud',
});

assert.strictEqual(mudCambridge.headword, 'mud');
assert.strictEqual(mudCambridge.pos, 'noun');
assert.strictEqual(mudCambridge.senses.length, 1);
assert.strictEqual(mudCambridge.senses[0].label, 'U');
assert.strictEqual(mudCambridge.senses[0].translation_zh, '泥， 泥土; 烂泥， 泥浆; 淤泥');

// Examples must NOT contain idioms or metadata
const allExampleEn = mudCambridge.example_sentences.map(e => e.en);
assert.ok(!allExampleEn.some(e => e.includes("here's mud in your eye")), 'idiom should not be in examples');
assert.ok(!allExampleEn.some(e => e.includes('mud sticks')), 'phrase should not be in examples');
assert.ok(!allExampleEn.some(e => e.toLowerCase() === 'uk'), 'metadata "uk" should not be in examples');
assert.ok(!allExampleEn.some(e => e.startsWith('/mʌd/')), 'phonetic should not be in examples');
assert.ok(!allExampleEn.some(e => e.startsWith('/pəˈsweɪd/us')), 'phonetic with region should not be in examples');
assert.ok(!allExampleEn.some(e => e === 'B2' || e === 'noun'), 'POS/level should not be in examples');
assert.ok(!allExampleEn.some(e => e.includes('Vocabulary')), 'navigation should not be in examples');
assert.ok(!allExampleEn.some(e => e.includes('Wikipedia')), 'Wikipedia content should not be in examples');

// Idioms should be extracted separately
assert.strictEqual(mudCambridge.idioms.length, 3, 'should extract 3 idioms');
assert.ok(mudCambridge.idioms.includes("here's mud in your eye!"));
assert.ok(mudCambridge.idioms.includes('mud sticks'));
assert.ok(mudCambridge.idioms.includes('hurl/throw/sling mud at someone'));

// Test merge - Dify examples should NOT appear
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

// persuade markdown test case - flat structure with phonetic + region suffix
const persuadeMarkdown = `# Translation of **persuade** – English–Mandarin Chinese dictionary

persuade

verb

uk

Your browser doesn't support HTML5 audio

/pəˈsweɪd/us

Your browser doesn't support HTML5 audio

/pɚˈsweɪd/

B1

[[ + T ]]to make someone do or believe something by giving them a good reason...

劝服; 说服

If she doesn't want to go, nothing you can say will persuade her.
如果她不想去，你说什么也劝不动她。

Synonym
talk someone into something
Opposites
deter
dissuade
Compare
convince
encourage
`;

const persuadeCambridge = parseCambridgeMarkdown(persuadeMarkdown, {
  word: 'persuade',
  sourceUrl: 'https://dictionary.cambridge.org/dictionary/english-chinese-simplified/persuade',
});

const persuadeExamples = persuadeCambridge.example_sentences.map(e => e.en);
assert.ok(!persuadeExamples.some(e => e === 'uk'), 'uk should not be in examples');
assert.ok(!persuadeExamples.some(e => e.includes("Your browser")), 'audio message should not be in examples');
assert.ok(!persuadeExamples.some(e => e.startsWith('/pəˈsweɪd/us')), 'phonetic with region should not be in examples');
assert.ok(!persuadeExamples.some(e => e === '/pɚˈsweɪd/'), 'phonetic without region should not be in examples');
assert.ok(!persuadeExamples.some(e => e === 'B1'), 'level should not be in examples');
assert.ok(!persuadeExamples.some(e => e === 'Synonym'), 'synonym header should not be in examples');
assert.ok(!persuadeExamples.some(e => e === 'talk someone into something'), 'synonym should not be in examples');
assert.ok(!persuadeExamples.some(e => e === 'Opposites'), 'opposites header should not be in examples');
assert.ok(!persuadeExamples.some(e => e === 'deter'), 'antonym should not be in examples');
assert.ok(!persuadeExamples.some(e => e === 'dissuade'), 'antonym should not be in examples');
assert.ok(!persuadeExamples.some(e => e === 'Compare'), 'compare header should not be in examples');
assert.ok(!persuadeExamples.some(e => e === 'convince'), 'compare word should not be in examples');
assert.ok(!persuadeExamples.some(e => e === 'encourage'), 'compare word should not be in examples');
assert.ok(persuadeExamples.some(e => e.includes('persuade her')), 'real example should remain');

console.log('cambridge dictionary tests passed');
