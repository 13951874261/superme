const { fetchCambridgeEntry } = require('./services/cambridgeDictionary');

async function test() {
  const result = await fetchCambridgeEntry('mud');
  
  console.log('=== mud 解析结果 ===');
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
    console.log('  label:', s.label);
    console.log('  level:', s.level);
    console.log('  grammar:', JSON.stringify(s.grammar));
    console.log('  register:', s.register);
    console.log('  definition_en:', s.definition_en?.substring(0, 80));
    console.log('  translation_zh:', s.translation_zh);
    console.log('  examples count:', s.examples.length);
    if (s.examples[0]) {
      console.log('  example[0]:', { en: s.examples[0].en?.substring(0, 50), zh: s.examples[0].zh });
    }
  }
  
  console.log('\nother_meanings:', result.other_meanings.length);
  console.log('example_sentences count:', result.example_sentences.length);
  console.log('idioms:', result.idioms?.length);
  console.log('inflections:', result.inflections);
}

test().catch(console.error);