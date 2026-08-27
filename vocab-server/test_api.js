const https = require('https');

const postData = JSON.stringify({
  url: 'https://dictionary.cambridge.org/dictionary/english-chinese-simplified/vibe'
});

const req = https.request({
  hostname: 'app.liujingzhuwo.site',
  port: 443,
  path: '/api/materials/fetch-url',
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
      const parsed = JSON.parse(data);
      if (parsed.success && parsed.data && parsed.data.content) {
        const text = parsed.data.content.text;
        console.log('API Success! Content length:', text.length);
        console.log('\n=== First 800 chars ===');
        console.log(text.substring(0, 800));
        console.log('\n=== Checking for ### headings ===');
        const matches = text.match(/^###.+$/gm);
        if (matches) {
          console.log('Found', matches.length, '### headings:');
          matches.forEach(m => console.log(' ', m.substring(0, 60)));
        }
      } else {
        console.log('API Error:', data);
      }
    } catch (e) {
      console.log('Parse error:', e.message);
      console.log('Raw (first 500):', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(postData);
req.end();