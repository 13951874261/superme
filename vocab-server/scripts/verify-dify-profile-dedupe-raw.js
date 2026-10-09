require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

(async () => {
  const key = process.env.DIFY_PROFILE_DEDUPE_API_KEY;
  const base = process.env.DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  if (!key) {
    console.log(JSON.stringify({ ok: false, error: 'NO_KEY' }));
    process.exit(1);
  }
  const res = await fetch(`${base}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {
        existing_profile: '英国；对抗沟通弱',
        new_delta: '【手动压缩】精炼去重',
        delta_source: 'verify',
        delta_timestamp_ms: String(Date.now()),
      },
      response_mode: 'blocking',
      user: 'verify-dedupe-smoke',
    }),
  });
  const j = await res.json();
  console.log(JSON.stringify({
    http: res.status,
    workflow_status: j?.data?.status,
    error: j?.data?.error || j?.error || null,
    output_keys: Object.keys(j?.data?.outputs || {}),
    outputs_preview: JSON.stringify(j?.data?.outputs || {}).slice(0, 500),
    data_keys: Object.keys(j?.data || {}),
  }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
