const { parseCambridgeMarkdown } = require('./services/cambridgeDictionary');

// Test with real mud markdown from user
const mudMarkdown = `![](<Base64-Image-Removed>)

# Translation of **mud** – English–Mandarin Chinese dictionary

[Share on Facebook](https://www.facebook.com/sharer.php?u=https%3A%2F%2Fdictionary.cambridge.org%2Fdictionary%2Fenglish-chinese-simplified%2Fmud&t= "Share on Facebook")

[Share on X](https://twitter.com/intent/tweet?url=https%3A%2F%2Fdictionary.cambridge.org%2Fdictionary%2Fenglish-chinese-simplified%2Fmud&text= "Share on X")

mud

noun[[ U ]](https://dictionary.cambridge.org/help/codes.html)

uk

Your browser doesn't support HTML5 audio

/mʌd/us

Your browser doesn't support HTML5 audio

/mʌd/

Add to word listAdd to word list

B2

[earth](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/earth "earth") that has been [mixed](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/mixed "mixed") with [water](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/water "water")

[泥](https://dictionary.cambridge.org/dictionary/chinese-simplified-english/)， [泥土](https://dictionary.cambridge.org/dictionary/chinese-simplified-english/); [烂泥](https://dictionary.cambridge.org/dictionary/chinese-simplified-english/)， [泥浆](https://dictionary.cambridge.org/dictionary/chinese-simplified-english/); [淤泥](https://dictionary.cambridge.org/dictionary/chinese-simplified-english/)

The [vehicles](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/vehicle "vehicles") got bogged down in the [heavy](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/heavy "heavy") mud.车辆陷到了淤泥里动弹不得。

Modern [houses](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/house "houses") have [replaced](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/replace "replaced") the one-room mud [huts](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/hut "huts") with [grass](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/grass "grass") [roofs](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/roof "roof") that had been [home](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/home "home") to [generations](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/generation "generation") of [peasants](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/peasant "peasant").新式住房取代了农民世代居住的单间草顶土屋。

These mud [flats](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/flat "flats")(= [level](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/level "level") [ground](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/ground "ground") near the [sea](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/sea "sea")) are a [site](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/site "site") of [special](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/special "special") [scientific](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/scientific "scientific") [interest](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/interest "interest").这片淤泥滩有特殊的科研价值。

- He got out of the [car](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/car "car") and [squelched](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/squelch "squelch") through the mud to [open](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/open "open") the [gate](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/gate "gate").
- Police [found](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/found "found") [tyre](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/tyre "tyre") [tracks](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/track "track") in the mud.
- Two [bikes](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/bike "bikes") [raced](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/race "race") by and [spattered](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/spattered "spatter") mud over [our](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/our "our") [clothes](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/clothes "clothes").
- My [trousers](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/trousers "trousers") got [covered](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/cover "cover") in mud, but [luckily](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/luckily "luckily") I was [able](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/able "able") to [brush](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/brush "brush") them [clean](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/clean "clean").
- My car's [stuck](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/stuck "stuck") in the mud - it won't [shift](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/shift "shift").

### **Idioms**

[here's mud in your eye!](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/here-s-mud-in-your-eye "meaning of here's mud in your eye!")

[hurl/throw/sling mud at someone](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/hurl-throw-sling-mud-at "meaning of hurl/throw/sling mud at someone")

[mud sticks](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/mud-sticks "meaning of mud sticks")

(Translation of **mud** from the [**Cambridge English-Chinese (Simplified) Dictionary**](https://dictionary.cambridge.org/dictionary/english-chinese-simplified/ "Cambridge English-Chinese (Simplified) Dictionary") © Cambridge University Press)

## Examples of mud

mud


At the bottom of the hole, these fluids enter the annulus and displace upwards whatever fluids are in place, typically a drilling _mud_.


From the [Cambridge English Corpus](https://www.cambridge.org/gb/cambridgeenglish/better-learning-insights/corpus)

To determine the pressure drop across the _mud_ cake we use an asymptotic argument, with the _mud_ cake thickness being a small parameter.


From the [Cambridge English Corpus](https://www.cambridge.org/gb/cambridgeenglish/better-learning-insights/corpus)

As the chalk was deposited in sedimentary layers, creatures died in the settling _mud_.


From the [Cambridge English Corpus](https://www.cambridge.org/gb/cambridgeenglish/better-learning-insights/corpus)

The non-axisymmetry of the invasion front is addressed for the case of water based drilling _mud_ and isotropic rock formation.


From the [Cambridge English Corpus](https://www.cambridge.org/gb/cambridgeenglish/better-learning-insights/corpus)

Facies 1 was deposited in the mid-ramp environments (low-energy offshore), dominated by deposition of carbonate _mud_.


From the [Cambridge English Corpus](https://www.cambridge.org/gb/cambridgeenglish/better-learning-insights/corpus)

Active _mud_ volcanoes and diapirs in the area may be the direct evidence of such pore fluid expulsion through fault/fracture systems.


From the [Cambridge English Corpus](https://www.cambridge.org/gb/cambridgeenglish/better-learning-insights/corpus)

This is not surprising, as _mud_ is the chief constituent in a mangrove swamp.


From the [Cambridge English Corpus](https://www.cambridge.org/gb/cambridgeenglish/better-learning-insights/corpus)

The bottom end of the tube was covered with a fine plastic mesh to prevent _mud_ from plugging it.


From the [Cambridge English Corpus](https://www.cambridge.org/gb/cambridgeenglish/better-learning-insights/corpus)

These examples are from corpora and from sources on the web. Any opinions in the examples do not represent the opinion of the Cambridge Dictionary editors or of Cambridge University Press or its licensors.

B2
`;

console.log('=== mud 解析测试 ===\n');

const result = parseCambridgeMarkdown(mudMarkdown, { 
  word: 'mud',
  sourceUrl: 'https://dictionary.cambridge.org/dictionary/english-chinese-simplified/mud'
});

console.log('headword:', result.headword);
console.log('translation_main:', result.translation_main);
console.log('phonetic:', result.phonetic);
console.log('phonetics:', JSON.stringify(result.phonetics));
console.log('pos:', result.pos);
console.log('level:', result.level);
console.log('senses count:', result.senses.length);

if (result.senses[0]) {
  const s = result.senses[0];
  console.log('\nsense[0]:');
  console.log('  headword:', s.headword);
  console.log('  part_of_speech:', s.part_of_speech);
  console.log('  label:', JSON.stringify(s.label));
  console.log('  level:', s.level);
  console.log('  grammar:', JSON.stringify(s.grammar));
  console.log('  register:', JSON.stringify(s.register));
  console.log('  definition_en:', s.definition_en?.substring(0, 80));
  console.log('  translation_zh:', s.translation_zh);
  console.log('  examples count:', s.examples.length);
  if (s.examples[0]) {
    console.log('  example[0]:', { en: s.examples[0].en?.substring(0, 50), zh: s.examples[0].zh });
  }
}

console.log('\nidioms:', result.idioms?.length, result.idioms);
console.log('inflections:', result.inflections);