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
  const words = ['vibe', 'mud'];
  for (const word of words) {
    console.log(`\n========== ${word} ==========`);
    const result = await query(word);
    
    if (!result.ok) {
      console.log('✗ Request failed:', result.message);
      continue;
    }
    
    const payload = result.payload;
    console.log(`✓ headword: ${payload.headword}`);
    console.log(`✓ phonetic: ${payload.phonetic}`);
    console.log(`✓ senses count: ${payload.senses?.length || 0}`);
    
    if (payload.senses) {
      payload.senses.forEach((sense, i) => {
        console.log(`\n  Sense ${i + 1}:`);
        console.log(`    label: ${sense.label}`);
        console.log(`    def_en: ${sense.definition_en?.substring(0, 60)}`);
        console.log(`    trans_zh: ${sense.translation_zh}`);
        console.log(`    examples: ${sense.examples?.length || 0}`);
        if (sense.examples?.[0]) {
          const ex = sense.examples[0];
          console.log(`    example[0]: ${ex.en?.substring(0, 50)} | zh: ${ex.zh || '(none)'}`);
        }
      });
    }
    
    console.log(`\n✓ raw_markdown present: ${!!payload.raw_markdown}`);
    console.log(`✓ idiom count: ${payload.idioms?.length || 0}`);
  }
}

main().catch(console.error);
