const fs = require('fs');
const content = fs.readFileSync('/var/www/super-agent/vocab-server/.env', 'utf8');
const match = content.match(/^DIFY_HIGH_AESTHETICS_API_KEY=(.+)$/m);
const apiKey = match ? match[1].trim() : '';
const body = JSON.stringify({ inputs: { scene_category: '政商务饭局与敬酒', user_response: '张局，我敬您一杯。', _system_time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }), _system_timestamp_ms: Date.now() }, response_mode: 'blocking', user: 'server-diagnostic' });
const https = require('https');
const url = new URL('https://dify.234124123.xyz/v1/workflows/run');
const req = https.request({ hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => { let data = ''; res.on('data', c => data += c); res.on('end', () => { console.log('STATUS:', res.statusCode); console.log('BODY:', data.slice(0, 1500)); }); });
req.on('error', e => console.error('ERROR:', e.message)); req.write(body); req.end();
