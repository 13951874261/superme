const https = require('https');
const { URL } = require('url');

function probe(url, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const marks = {};
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      timeout: timeoutMs,
    }, (res) => {
      marks.ttfb = Date.now() - started;
      marks.status = res.statusCode;
      res.resume();
      res.on('end', () => resolve({ url, ...marks, total: Date.now() - started }));
    });
    req.on('socket', (socket) => {
      socket.on('lookup', () => { marks.dns = Date.now() - started; });
      socket.on('connect', () => { marks.connect = Date.now() - started; });
      socket.on('secureConnect', () => { marks.tls = Date.now() - started; });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ url, ...marks, error: 'timeout', total: Date.now() - started });
    });
    req.on('error', (err) => {
      resolve({ url, ...marks, error: err.message, total: Date.now() - started });
    });
    req.end();
  });
}

(async () => {
  const urls = [
    'https://app.liujingzhuwo.site/',
    'https://app.liujingzhuwo.site/api/vocab/health',
    'https://app.liujingzhuwo.site/api/tasks',
  ];
  for (const url of urls) {
    console.log(JSON.stringify(await probe(url, 8000)));
  }
})();
