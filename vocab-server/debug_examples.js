const https = require('https');

function query(word, userId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ word, userId: userId || 'debug-user-123' });
    const req = https.request({
      hostname: 'app.liujingzhuwo.site',
      port: 443,
      path: `/api/dify/dict-query`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'rejectUnauthorized': false
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  const result = await query('counterproductive', 'debug-user-counter');
  
  if (!result.ok) {
    console.log('Request failed:', result.message);
    return;
  }
  
  const md = result.payload.raw_markdown;
  if (!md) {
    console.log('No raw markdown');
    return;
  }
  
  // Print lines around "Examples of"
  const lines = md.split('\n');
  let inExamplesSection = false;
  let startIdx = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Examples of')) {
      inExamplesSection = true;
      startIdx = i;
    }
    if (inExamplesSection) {
      console.log(`[${i}] ${lines[i]}`);
      if (startIdx >= 0 && i > startIdx + 50) break;
    }
  }
  
  // Also print parsed examples
  console.log('\n=== Parsed Examples ===');
  const senses = result.payload.senses || [];
  senses.forEach((s, i) => {
    console.log(`\nSense ${i+1} examples (${s.examples?.length}):`);
    (s.examples || []).forEach((ex, j) => console.log(`  [${j}] ${ex.en}`));
  });
}

main().catch(console.error);
