const https = require('https');

function query(word, userId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ word, userId: userId || 'test-user-new' });
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
  const result = await query('persuade', 'verify-user-2024');
  
  if (!result.ok) {
    console.log('Request failed:', result.message);
    return;
  }
  
  console.log('=== Full Response Keys ===');
  console.log(Object.keys(result));
  console.log('\n=== Payload Keys ===');
  console.log(Object.keys(result.payload || {}));
  
  // Check example_sentences
  console.log('\n=== example_sentences ===');
  if (result.payload.example_sentences) {
    console.log('Count:', result.payload.example_sentences.length);
    result.payload.example_sentences.forEach((ex, i) => {
      const en = typeof ex === 'string' ? ex : ex.en;
      const zh = typeof ex === 'string' ? '' : (ex.zh || '');
      console.log(`[${i}] ${en} | ${zh}`);
    });
  }
  
  // Check senses
  console.log('\n=== senses ===');
  if (result.payload.senses) {
    console.log('Count:', result.payload.senses.length);
    result.payload.senses.forEach((sense, i) => {
      console.log(`\nSense ${i + 1}:`);
      console.log('  label:', sense.label);
      console.log('  def_en:', sense.definition_en?.substring(0, 50));
      console.log('  trans_zh:', sense.translation_zh);
      console.log('  examples:', sense.examples?.length);
      sense.examples?.forEach((ex, j) => {
        console.log(`    [${j}] ${ex.en}`);
      });
    });
  }
}

main().catch(console.error);
