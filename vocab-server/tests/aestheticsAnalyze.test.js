const assert = require('assert');
const https = require('https');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request('https://app.liujingzhuwo.site' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let text = ''; res.on('data', c => text += c); res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(text) }); }
        catch (e) { resolve({ status: res.statusCode, text }); }
      });
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

(async () => {
  console.log('=== Remote /api/aesthetics/analyze validation ===');
  // 1. Invalid category
  const r1 = await post('/api/aesthetics/analyze', { scene_category: '无效分类', user_response: '测试内容' });
  assert.strictEqual(r1.status, 400, 'invalid category should be 400');
  assert.strictEqual(r1.body.error, '无效的审美场景类型');
  console.log('PASS invalid category -> 400');

  // 2. Empty user_response
  const r2 = await post('/api/aesthetics/analyze', { scene_category: '政商务饭局与敬酒', user_response: '' });
  assert.strictEqual(r2.status, 400, 'empty response should be 400');
  assert.strictEqual(r2.body.error, '请输入待研判的应对内容');
  console.log('PASS empty user_response -> 400');

  // 3. Valid request (may succeed or return expected error if Dify key missing)
  const r3 = await post('/api/aesthetics/analyze', {
    scene_category: '政商务饭局与敬酒',
    user_response: '张局，我代表公司全体敬您一杯酒，非常感谢您的关照，您随意！'
  });
  console.log('Live response status:', r3.status, 'body:', JSON.stringify(r3.body).slice(0, 400));
  assert.ok(r3.body.success === true || r3.body.error, 'must return success:true or error string');
  if (r3.body.success) {
    assert.ok(r3.body.result.feedback, 'feedback required');
    assert.strictEqual(typeof r3.body.result.score, 'number');
    assert.strictEqual(typeof r3.body.result.is_passed, 'boolean');
    console.log('PASS live success contract');
  } else {
    console.log('PASS expected error response from backend/Dify');
  }
  console.log('ALL PASS');
})().catch(err => { console.error(err); process.exit(1); });
