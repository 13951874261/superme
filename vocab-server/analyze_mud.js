const { fetchCambridgeEntry } = require('./services/cambridgeDictionary');

async function analyze() {
  const cam = await fetchCambridgeEntry('mud');
  
  // Find the sense block
  const raw = cam.raw_markdown;
  const lines = raw.split(/\r?\n/);
  
  let inSense = false;
  let senseLines = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (/^noun\b/i.test(trimmed)) {
      inSense = true;
    }
    
    if (inSense) {
      if (/^## Examples of\b/i.test(trimmed)) break;
      senseLines.push(trimmed);
    }
  }
  
  console.log('=== MUD Sense Lines (raw) ===');
  senseLines.forEach((l, i) => console.log(i + ':', JSON.stringify(l)));
  
  // Now simulate cleanMarkdown
  function cleanMarkdown(value) {
    let text = String(value || '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]\([^)]+\)/g, (match) => {
        const inner = match.match(/^\[([^\]]*)\]/);
        return inner ? inner[1] : '';
      });
    return text
      .replace(/[*_`#]/g, '')
      .replace(/\\([\[\]])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  console.log('\n=== MUD Sense Lines (cleaned) ===');
  senseLines.map(cleanMarkdown).filter(Boolean).forEach((l, i) => console.log(i + ':', JSON.stringify(l)));
}

analyze().catch(console.error);