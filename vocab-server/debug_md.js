const https = require('https');

function query(word, userId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ word, userId: userId || 'debug-cp' });
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
  const result = await query('counterproductive', 'debug-cp-001');
  
  if (!result.ok) {
    console.log('Request failed:', result.message);
    return;
  }
  
  const md = result.payload.raw_markdown;
  console.log('=== Raw Markdown (first 3000 chars) ===');
  console.log(md.substring(0, 3000));
}

main().catch(console.error);
