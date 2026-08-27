// Test what the actual raw line looks like
const fs = require('fs');
const path = require('path');

// Read the module
const mod = require('./services/cambridgeDictionary');

async function test() {
  const cam = await mod.fetchCambridgeEntry('mud');
  
  // Find the noun line in raw markdown
  const lines = cam.raw_markdown.split(/\r?\n/);
  for (const line of lines) {
    if (/^noun\b/i.test(line.trim())) {
      console.log('Raw line:', JSON.stringify(line));
      console.log('Hex:', Buffer.from(line).toString('hex'));
      break;
    }
  }
  
  // Test cleanMarkdown on this line
  console.log('\nTesting cleanMarkdown on actual line...');
  // We can't access cleanMarkdown directly, so let's trace through the logic
  const rawLine = lines.find(l => /^noun\b/i.test(l.trim()));
  let text = rawLine;
  console.log('Step 0:', JSON.stringify(text));
  
  let prev;
  do {
    prev = text;
    const before = text;
    text = text.replace(/\[\[([^\]]+)\]\]\(([^)]+)\)/g, '[$1]');
    console.log('After r1:', JSON.stringify(text), '(changed:', text !== before + ')');
    const before2 = text;
    text = text.replace(/\[([^\[\]]*)\]\(([^)]+)\)/g, '$1');
    console.log('After r2:', JSON.stringify(text), '(changed:', text !== before2 + ')');
  } while (text !== prev);
}

test().catch(console.error);