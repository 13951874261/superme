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

### **Idioms**

[here's mud in your eye!](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/here-s-mud-in-your-eye "meaning")

[hurl/throw/sling mud at someone](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/hurl-throw-sling-mud-at "meaning")

[mud sticks](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/mud-sticks "meaning")

(Translation of **mud** from the Cambridge English-Chinese (Simplified) Dictionary © Cambridge University Press)

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
assert.ok(!allExampleEn.some(e => e.includes('hurl/throw/sling mud at someone')), 'idiom phrase should not be in examples');
assert.ok(allExampleEn.some(e => e.includes('bogged down')), 'real Cambridge example should remain');
assert.ok(!allExampleEn.some(e => e.toLowerCase() === 'uk'), 'metadata "uk" should not be in examples');
assert.ok(!allExampleEn.some(e => e.startsWith('/mʌd/')), 'phonetic should not be in examples');
assert.ok(!allExampleEn.some(e => e.startsWith('/pəˈsweɪd/us')), 'phonetic with region should not be in examples');
assert.ok(!allExampleEn.some(e => e === 'B2' || e === 'noun'), 'POS/level should not be in examples');
assert.ok(!allExampleEn.some(e => e.includes('Vocabulary')), 'navigation should not be in examples');
assert.ok(!allExampleEn.some(e => e.includes('Wikipedia')), 'Wikipedia content should not be in examples');
assert.ok(allExampleEn.some(e => e.includes('Full of aggressive, dirty and equally tender vibes and melodies...')), 'corpus example from ## Examples of should be present');

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

// Test persuade with ## Examples section and corpus attribution
const persuadeWithCorpusMarkdown = `# Translation of **persuade** – English–Mandarin Chinese dictionary

persuade

verb

uk

/pəˈsweɪd/us

/pɚˈsweɪd/

B1

to make someone do or believe something by giving them a good reason...

劝服; 说服

If she doesn't want to go, nothing you can say will persuade her.
如果她不想去，你说什么也劝不动她。

## Examples of persuade

Advocates of retrenchment must _persuade_ affected officials to transcend their special interests for the good of common goals.

From the Cambridge English Corpus

Moreover, though some motives are mutually reinforcing, others are contradictory: treating discussion as an opportunity for persuading others, for example, can conflict with educating oneself.

From the Cambridge English Corpus

It was not only husbands who persuaded women to return.

From the Cambridge English Corpus

These examples are from corpora and from sources on the web. Any opinions in the examples do not represent the opinion of the Cambridge Dictionary editors or of Cambridge University Press or its licensors.

B1
`;

const persuadeCorpus = parseCambridgeMarkdown(persuadeWithCorpusMarkdown, {
  word: 'persuade',
  sourceUrl: 'https://dictionary.cambridge.org/dictionary/english-chinese-simplified/persuade',
});

assert.strictEqual(persuadeCorpus.pos, 'verb', 'pos should be verb not noun');
assert.strictEqual(persuadeCorpus.senses.length, 1);
assert.strictEqual(persuadeCorpus.senses[0].part_of_speech, 'verb');
assert.strictEqual(persuadeCorpus.senses[0].translation_zh, '劝服; 说服');

const corpusExamples = persuadeCorpus.example_sentences.map(e => e.en);
assert.ok(corpusExamples.some(e => e.includes('persuade her')), 'inline example should be present');
assert.ok(corpusExamples.some(e => e.includes('retrenchment')), 'corpus example should be present');
assert.ok(corpusExamples.some(e => e.includes('mutually reinforcing')), 'corpus example 2 should be present');
assert.ok(corpusExamples.some(e => e.includes('husbands who persuaded')), 'corpus example 3 should be present');
assert.ok(!corpusExamples.some(e => e === 'To make someone do or believe something by giving them a good reason...'), 'definition should not be in examples');
assert.ok(!corpusExamples.some(e => e === 'B1'), 'level should not be in examples');
assert.ok(!corpusExamples.some(e => e.toLowerCase().includes('from the cambridge english corpus')), 'corpus attribution should not be in examples');
assert.ok(!corpusExamples.some(e => e.toLowerCase().includes('these examples are from corpora')), 'corpus disclaimer should not be in examples');
assert.ok(!corpusExamples.some(e => e.startsWith('/pəˈsweɪd/')), 'phonetic should not be in examples');

const counterproductiveMarkdown = `# Translation of **counterproductive** – English–Mandarin Chinese dictionary

counterproductive

adjective

uk

Your browser doesn't support HTML5 audio

/ˌkaʊn.tə.prəˈdʌk.tɪv/us

Your browser doesn't support HTML5 audio

/ˌkaʊn.t̬ɚ.prəˈdʌk.tɪv/

having an effect that is opposite to the one intended or wanted

产生相反效果的；产生相反作用的；事与愿违的，适得其反的

Improved safety measures in cars can be counterproductive as they encourage people to drive faster.
提高车辆安全性的措施可能会适得其反，因为这会激励人们开快车。

(Translation of **counterproductive** from the Cambridge English-Chinese (Simplified) Dictionary © Cambridge University Press)

## Examples of counterproductive

The whole system was thus counterproductive because it undermined financial responsibility within departments without achieving any strategic economic gains.

From the Cambridge English Corpus
`;

const counterproductive = parseCambridgeMarkdown(counterproductiveMarkdown, {
  word: 'counterproductive',
  sourceUrl: 'https://dictionary.cambridge.org/dictionary/english-chinese-simplified/counterproductive',
});

assert.strictEqual(counterproductive.pos, 'adjective');
assert.strictEqual(
  counterproductive.senses[0].definition_en,
  'having an effect that is opposite to the one intended or wanted'
);
assert.ok(counterproductive.senses[0].translation_zh.includes('产生相反效果'));
assert.ok(counterproductive.translation_main.includes('产生相反效果'));

const counterproductiveExamples = counterproductive.example_sentences.map((item) => item.en);
assert.ok(!counterproductiveExamples.some((e) => e.includes('having an effect that is opposite')), 'English definition must not be an example');
assert.ok(!counterproductiveExamples.some((e) => e.startsWith('/')), 'phonetic must not be an example');
assert.ok(counterproductiveExamples.some((e) => e.includes('Improved safety measures')), 'inline example should remain');
assert.ok(counterproductiveExamples.some((e) => e.includes('undermined financial responsibility')), '## Examples of corpus sentence should remain');

// Metadata residue: grammar tags (C[[ T ]]) and comma-separated CEFR levels (B2,C1,C2,B2)
const metadataResidueMarkdown = `# Translation of **sample** – English–Mandarin Chinese dictionary

sample

noun

uk

Your browser doesn't support HTML5 audio

/ˈsæm.pəl/us

Your browser doesn't support HTML5 audio

/ˈsæm.pəl/

B2,C1,C2,B2

[[ C[ T ] ]](https://dictionary.cambridge.org/help/codes.html)

a small part of something that shows what the whole is like

样本；样品；样例

He works on a sample basis.
他按样本工作。

This is a typical example of his work.
这是他的作品典型例子。

(Translation of **sample** from the Cambridge English-Chinese (Simplified) Dictionary © Cambridge University Press)

## Examples of sample

The researchers collected a blood sample from each participant.
研究人员从每位参与者身上采集了血样。
`;

const metadataResidue = parseCambridgeMarkdown(metadataResidueMarkdown, {
  word: 'sample',
  sourceUrl: 'https://dictionary.cambridge.org/dictionary/english-chinese-simplified/sample',
});

const metadataExamples = metadataResidue.example_sentences.map((e) => e.en);
assert.ok(!metadataExamples.some((e) => e === 'B2,C1,C2,B2'), 'comma-separated CEFR levels should not be in examples');
assert.ok(!metadataExamples.some((e) => e === 'C[ T ]'), 'grammar tag like C[ T ] should not be in examples');
assert.ok(!metadataExamples.some((e) => e === 'C[T]'), 'grammar tag like C[T] should not be in examples');
assert.ok(!metadataExamples.some((e) => e === '[T]'), 'standalone tag should not be in examples');
assert.ok(metadataExamples.some((e) => e.includes('blood sample')), 'real example should remain');
assert.ok(metadataExamples.some((e) => e.includes('typical example')), 'real example should remain');

console.log('cambridge dictionary tests passed');
