/**
 * Live verify: empty profile body -> server inject for user, then hit a cheap Dify path.
 * node scripts/verify-profile-inject-live.js [userId]
 */
const https = require('https');

const userId = String(process.argv[2] || 'lzhmy').trim();

function post(path, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'app.liujingzhuwo.site',
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 120000,
      },
      (res) => {
        let b = '';
        res.on('data', (c) => { b += c; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(b); } catch { /* ignore */ }
          resolve({ http: res.statusCode, json, raw: b.slice(0, 500) });
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  // speech-prompter / sentence eval may be heavy; use custom theme is heavy too.
  // biweekly is ok if key set. Prefer dict-query which always takes user_current_profile.
  const dict = await post('/api/dify/dict-query', {
    word: 'anchor',
    dictType: 'en_en_business',
    userContext: '谈判',
    userId,
    user_current_profile: '', // force server resolveProfileForDify
  });

  const ok = Boolean(dict.json?.ok || dict.json?.success || dict.json?.payload);
  console.log(JSON.stringify({
    path: '/api/dify/dict-query',
    userId,
    clientProfile: '(empty -> server fallback)',
    http: dict.http,
    ok,
    hasPayload: Boolean(dict.json?.payload || dict.json?.data),
    error: dict.json?.error || dict.json?.message || null,
    rawPreview: ok ? undefined : dict.raw,
  }, null, 2));
  process.exit(ok ? 0 : 2);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
