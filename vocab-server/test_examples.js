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
    console.log(`✓ senses: ${payload.senses?.length || 0}`);
    
    if (payload.senses) {
      payload.senses.forEach((sense, i) => {
        console.log(`\n  Sense ${i + 1} [${sense.label}]:`);
        console.log(`    def_en: ${sense.definition_en?.substring(0, 50)}...`);
        console.log(`    trans_zh: ${sense.translation_zh}`);
        console.log(`    examples: ${sense.examples?.length || 0}`);
        sense.examples?.slice(0, 2).forEach((ex, j) => {
          console.log(`      [${j}] ${ex.en?.substring(0, 40)} | ${ex.zh || '(none)'}`);
        });
      });
    }
    
    // Check for non-example content in examples
    const allExamples = payload.senses?.flatMap(s => s.examples?.map(e => e.en) || []);
    if (allExamples) {
      const badExamples = allExamples.filter(e => 
        /uk|us|browser|Vocabulary|Wikipedia/i.test(e)
      );
      if (badExamples.length > 0) {
        console.log('\n⚠ BAD EXAMPLES:', badExamples.slice(0, 3));
      } else {
        console.log('\n✓ All examples clean');
      }
    }
  }
}

main().catch(console.error);
