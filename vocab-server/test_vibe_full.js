const { fetchCambridgeEntry } = require('./services/cambridgeDictionary');

async function test() {
  console.log('=== vibe 解析结果 ===\n');
  
  const result = await fetchCambridgeEntry('vibe');
  
  console.log('【核心信息】');
  console.log('headword:', result.headword);
  console.log('phonetic:', result.phonetic);
  console.log('phonetics:', JSON.stringify(result.phonetics));
  console.log('pos:', result.pos);
  console.log('level:', result.level);
  console.log('translation_main:', result.translation_main);
  console.log();
  
  console.log('【senses 结构】');
  console.log('senses count:', result.senses.length);
  result.senses.forEach((s, i) => {
    console.log(`\nsense[${i}]:`);
    console.log('  headword:', s.headword);
    console.log('  part_of_speech:', s.part_of_speech);
    console.log('  label:', s.label);
    console.log('  level:', s.level);
    console.log('  grammar:', JSON.stringify(s.grammar));
    console.log('  register:', s.register);
    console.log('  definition_en:', s.definition_en?.substring(0, 60));
    console.log('  translation_zh:', s.translation_zh);
    console.log('  examples:', s.examples.length);
  });
  console.log();
  
  console.log('【其他字段】');
  console.log('other_meanings:', result.other_meanings.length);
  console.log('example_sentences:', result.example_sentences.length);
  console.log('idioms:', result.idioms?.length);
  console.log('collocations:', result.collocations?.length);
  console.log('inflections:', result.inflections);
  console.log('audio:', result.audio?.length);
  console.log('source:', result.source);
  console.log('copyright:', result.copyright);
}

test().catch(console.error);