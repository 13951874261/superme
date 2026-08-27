const { fetchCambridgeEntry } = require('./services/cambridgeDictionary');

async function test() {
  const words = ['mud', 'vibe', 'bitch', 'bush', 'clear', 'run', 'make', 'take', 'happy', 'quick'];
  
  console.log('=== 多词验证 ===\n');
  
  for (const word of words) {
    try {
      const cam = await fetchCambridgeEntry(word);
      const hasTranslation = !!(cam.translation_main || (cam.senses?.[0]?.translation_zh));
      
      if (hasTranslation) {
        console.log(`✅ ${word}:`);
        console.log(`   pos: ${cam.pos || '(空)'}`);
        console.log(`   level: ${cam.level || '(空)'}`);
        console.log(`   translation: ${cam.translation_main?.substring(0, 40)}`);
        console.log(`   senses: ${cam.senses?.length || 0}`);
        if (cam.senses?.[0]) {
          const s = cam.senses[0];
          console.log(`   grammar: ${JSON.stringify(s.grammar)}`);
          console.log(`   register: ${JSON.stringify(s.register)}`);
          console.log(`   examples: ${s.examples.length}`);
        }
        if (cam.idioms?.length > 0) {
          console.log(`   idioms: ${cam.idioms.length}`);
        }
      } else {
        console.log(`❌ ${word}: 无中文释义`);
      }
      console.log();
    } catch (e) {
      console.log(`❌ ${word}: ERROR - ${e.message}\n`);
    }
  }
}

test().catch(console.error);