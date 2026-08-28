const https = require('https');

function query(word, userId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ word, userId: userId || 'debug-test' });
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
  const result = await query('counterproductive', 'debug-test-003');
  
  if (!result.ok) {
    console.log('Request failed:', result.message);
    return;
  }
  
  console.log('Response keys:', Object.keys(result));
  console.log('Payload keys:', Object.keys(result.payload || {}));
  
  // Check raw_markdown
  const md = result.payload?.raw_markdown || result.raw_markdown;
  console.log('\nHas raw_markdown:', !!md);
  
  if (md) {
    const word = 'counterproductive';
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^## Examples of \\*\\*?${escapedWord}\\*\\*?\\s*\\n([\\s\\S]*?)(?=\\n##|\\Z)`, 'im');
    
    const match = md.match(pattern);
    
    if (match) {
      console.log('\n✓ Examples section found');
      console.log('Examples content (first 300 chars):', match[1].substring(0, 300));
    } else {
      console.log('\n❌ No match');
      const idx = md.indexOf('## Examples of');
      console.log('Index of "## Examples of":', idx);
      if (idx >= 0) {
        console.log('\nContext around it:');
        console.log(md.substring(idx, idx + 200));
      }
    }
  }
}

main().catch(console.error);
