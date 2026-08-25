// test-llm.cjs — 本地兜底网关冒烟测试
const https = require('https');
const url = 'https://aow2.234124123.xyz/aow/v1/chat/completions';
const apiKey = 'sk-aow2api-your-custom-key';

const requestBody = JSON.stringify({
  model: '114',
  messages: [
    { role: 'user', content: 'reply with ok' }
  ],
  max_tokens: 10,
  stream: false
});

const options = {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestBody)
  },
  rejectUnauthorized: false
};

const req = https.request(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('【LLM SMOKE TEST】model:', json.model, '| reply:', json.choices[0].message.content.trim());
    } catch (e) {
      console.error('解析出错:', e.message, '原始数据:', data);
    }
  });
});

req.setTimeout(30000, () => req.destroy(new Error('timeout')));
req.on('error', (e) => console.error('请求失败:', e.message));
req.write(requestBody);
req.end();
