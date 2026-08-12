// Live test for /api/english/write-governance (Chinese)
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
  console.log('=== Live /api/english/write-governance (Chinese document_correction) ===');
  const payload = {
    inputs: {
      task_type: 'document_correction',
      original_text: '关于调整部门人员的通知：因业务发展需要，经公司领导研究决定，现将部分部门人员作出以下调整。',
      additional_params: '请重点检查格式规范、措辞得体性、行文逻辑和战略站位。',
    },
    response_mode: 'blocking',
    user: 'live-test',
  };

  const res = await post('/api/english/write-governance', payload);
  console.log('Status:', res.status);

  if (res.status !== 200) {
    console.error('FAIL: non-200 status', JSON.stringify(res.body || res.text).slice(0, 500));
    process.exit(1);
  }

  const analysisRaw = res.body?.data?.outputs?.analysis_result || res.body?.data?.outputs?.result || '';
  if (!analysisRaw) {
    console.error('FAIL: empty analysis_result', JSON.stringify(res.body).slice(0, 500));
    process.exit(1);
  }

  let parsed;
  try {
    parsed = typeof analysisRaw === 'string' ? JSON.parse(analysisRaw) : analysisRaw;
  } catch (e) {
    console.error('FAIL: analysis_result not valid JSON:', String(analysisRaw).slice(0, 300));
    process.exit(1);
  }

  console.log('Parsed result:', JSON.stringify(parsed, null, 2));

  // Validate required fields
  const required = ['L1', 'L2', 'L3'];
  const missing = required.filter(k => !parsed[k]);
  if (missing.length > 0) {
    console.error('FAIL: missing fields:', missing.join(', '));
    process.exit(1);
  }

  // Validate Chinese content
  const allText = (parsed.L1 + parsed.L2 + parsed.L3).replace(/\s/g, '');
  const hasChinese = /[\u3400-\u9fff]/.test(allText);
  if (!hasChinese) {
    console.error('FAIL: result not in Chinese');
    process.exit(1);
  }

  console.log('Source:', res.body.source || 'unknown');
  console.log('PASS: Chinese document_correction returned valid Chinese review');
})().catch(err => { console.error('FAIL:', err.message); process.exit(1); });