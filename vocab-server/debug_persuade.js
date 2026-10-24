const https = require('https');

function fetchMarkdown(word, userId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ word, userId: userId || 'test-user-debug' });
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
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  const result = await fetchMarkdown('persuade', 'debug-user-999');
  
  if (!result.ok) {
    console.log('Request failed:', result.message);
    return;
  }
  
  // Print raw markdown
  const md = result.payload.raw_markdown;
  if (md) {
    console.log('=== Raw Markdown (first 2000 chars) ===');
    console.log(md.substring(0, 2000));
    console.log('\n=== Lines ===');
    const lines = md.split('\n');
    lines.forEach((line, i) => {
      console.log(`[${i}] ${line.substring(0, 80)}`);
    });
  }
}

main().catch(console.error);
