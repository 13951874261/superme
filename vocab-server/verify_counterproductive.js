const https = require('https');

function query(word, userId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ word, userId: userId || 'verify-user-999' });
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
  const result = await query('counterproductive', 'verify-user-cp-new');
  
  if (!result.ok) {
    console.log('Request failed:', result.message);
    return;
  }
  
  console.log('=== counterproductive ===');
  console.log('headword:', result.payload.headword);
  console.log('senses:', result.payload.senses?.length);
  
  if (result.payload.senses) {
    result.payload.senses.forEach((sense, i) => {
      console.log(`\nSense ${i + 1}:`);
      console.log('  def_en:', sense.definition_en?.substring(0, 60));
      console.log('  trans_zh:', sense.translation_zh);
      console.log('  examples:', sense.examples?.length);
      sense.examples?.forEach((ex, j) => {
        console.log(`    [${j}] ${ex.en}`);
      });
    });
  }
  
  // Check example_sentences
  const allExamples = result.payload.example_sentences || [];
  console.log('\n=== example_sentences ===');
  console.log('Count:', allExamples.length);
  allExamples.forEach((ex, i) => {
    const en = typeof ex === 'string' ? ex : ex.en;
    const zh = typeof ex === 'string' ? '' : (ex.zh || '');
    console.log(`[${i}] ${en}`);
  });
  
  // Check for problematic content
  const badPatterns = ['From the Cambridge English Corpus', 'uk', '/ˌkaʊn/', 'B2', 'adjective'];
  const badExamples = allExamples.filter(e => {
    const text = typeof e === 'string' ? e : e.en || '';
    return badPatterns.some(p => text.includes(p));
  });
  
  if (badExamples.length > 0) {
    console.log('\n⚠ PROBLEMATIC:', badExamples);
  } else {
    console.log('\n✓ All examples clean');
  }
}

main().catch(console.error);
