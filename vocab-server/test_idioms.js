const { fetchCambridgeEntry } = require('./services/cambridgeDictionary');

async function test() {
  const result = await fetchCambridgeEntry('mud');
  
  console.log('=== 完整解析结果 ===');
  console.log('idioms:', JSON.stringify(result.idioms));
  console.log('idioms length:', result.idioms.length);
  
  // Also show raw markdown for idioms section
  const raw = result.raw_markdown;
  const idiomsSection = raw.match(/###\s+\*\*Idioms\*\*([\s\S]*?)(?=^##|\Z)/im);
  if (idiomsSection) {
    console.log('\n=== Idioms Section Raw ===');
    console.log(idiomsSection[1].substring(0, 500));
  }
}

test().catch(console.error);