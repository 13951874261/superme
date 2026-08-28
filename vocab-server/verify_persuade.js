const https = require('https');

function query(word) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ word, userId: 'test-user-001' });
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
  console.log('=== persuade ===');
  const result = await query('persuade');
  
  if (!result.ok) {
    console.log('Request failed:', result.message);
    return;
  }
  
  const payload = result.payload;
  console.log('headword:', payload.headword);
  console.log('senses:', payload.senses?.length);
  
  if (payload.senses) {
    payload.senses.forEach((sense, i) => {
      console.log(`\nSense ${i + 1}:`);
      console.log('  def_en:', sense.definition_en);
      console.log('  trans_zh:', sense.translation_zh);
      console.log('  examples:', sense.examples?.length);
      sense.examples?.forEach((ex, j) => {
        console.log(`    [${j}] ${ex.en}`);
      });
    });
  }
  
  // Check for problematic content
  const allExamples = payload.senses?.flatMap(s => s.examples?.map(e => e.en) || []);
  const badPatterns = ['uk', '/pəˈsweɪd/', 'Synonym', 'Opposites', 'Compare', 'deter', 'dissuade', 'convince', 'encourage'];
  const badExamples = allExamples?.filter(e => badPatterns.some(p => e === p || e.includes(p)));
  
  if (badExamples?.length > 0) {
    console.log('\n⚠ PROBLEMATIC:', badExamples);
  } else {
    console.log('\n✓ All examples clean - no phonetics/synonyms/antonyms');
  }
}

main().catch(console.error);
