const { fetchCambridgeEntry } = require('./services/cambridgeDictionary');

async function test() {
  const cam = await fetchCambridgeEntry('mud');
  
  // Access internal cleanMarkdown by checking the raw_markdown and simulating
  console.log('=== First 5 lines of raw_markdown (after noun) ===');
  const lines = cam.raw_markdown.split(/\r?\n/);
  let foundNoun = false;
  for (const line of lines) {
    if (/^(noun|verb)\b/i.test(line.trim())) {
      foundNoun = true;
    }
    if (foundNoun) {
      console.log('RAW:', line.trim().substring(0, 100));
      if (line.includes('## Examples')) break;
    }
  }
}

test().catch(console.error);