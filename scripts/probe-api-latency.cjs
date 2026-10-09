const endpoints = [
  { name: 'health', method: 'GET', url: 'https://app.liujingzhuwo.site/api/vocab/health' },
  { name: 'login-ping', method: 'POST', url: 'https://app.liujingzhuwo.site/api/user/login-ping', body: { userId: 'lzhmy' } },
  { name: 'tasks', method: 'GET', url: 'https://app.liujingzhuwo.site/api/tasks' },
  { name: 'theme-list', method: 'GET', url: 'https://app.liujingzhuwo.site/api/theme/list?userId=lzhmy' },
  { name: 'cron-runs', method: 'GET', url: 'https://app.liujingzhuwo.site/api/daily-cron/runs?userId=lzhmy&days=7' },
];

async function probe({ name, method, url, body }) {
  const started = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
    const text = await res.text();
    clearTimeout(timer);
    return {
      name,
      ms: Date.now() - started,
      status: res.status,
      bytes: text.length,
      preview: text.slice(0, 120).replace(/\s+/g, ' '),
    };
  } catch (err) {
    clearTimeout(timer);
    return { name, ms: Date.now() - started, status: 'ERR', error: err.name + ': ' + err.message };
  }
}

(async () => {
  console.log('sequential probes...');
  for (const ep of endpoints) {
    const r = await probe(ep);
    console.log(JSON.stringify(r));
  }
  console.log('parallel probes...');
  const parallel = await Promise.all(endpoints.map(probe));
  for (const r of parallel) console.log(JSON.stringify(r));
})();
