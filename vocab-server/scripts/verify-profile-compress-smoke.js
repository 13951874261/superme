/**
 * Live compress smoke on server. Run:
 * node scripts/verify-profile-compress-smoke.js
 */
const http = require('http');

const sample = [
  '英国口音偏好需要坚持。',
  '对抗沟通时容易退缩，高压下逻辑反击偏慢。',
  '商务英语听力仍有缺口。',
  '目标是自我提升。',
  '策略是对照三模型输出取长补短。',
  '习惯是定期复盘。',
  '决策要多视角参考。',
  '张力是求速度与求深度冲突。',
  '下一步建立每日学习记录。',
  '权威不是姿态而是决策质量与一致性的结果。',
  '情绪上克制，不因挑战动摇。',
  '矛盾是渴望权威又害怕冲突。',
  '行动上先立边界再用结果背书。',
].join('');

const payload = JSON.stringify({
  userId: 'verify-dedupe-smoke',
  profileContent: sample,
  save: false,
});

const req = http.request(
  {
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/user/profile/compress',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    timeout: 60000,
  },
  (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => {
      let json;
      try {
        json = JSON.parse(body);
      } catch (e) {
        console.error('BAD_JSON', body.slice(0, 500));
        process.exit(1);
      }
      if (!json.success) {
        console.error('FAIL', json);
        process.exit(1);
      }
      const d = json.data || {};
      const before = Number(d.before_length || sample.length);
      const after = Number(d.after_length || String(d.profile_content || '').length);
      console.log(JSON.stringify({
        success: true,
        source: d.source,
        before_length: before,
        after_length: after,
        dedupe_count: d.dedupe_count,
        shorter: after < before,
        preview: String(d.profile_content || '').slice(0, 160),
      }, null, 2));
      if (!(after > 0)) process.exit(2);
      // Accept either LLM success or local compress that shortens / restructures
      if (after >= before && Number(d.dedupe_count || 0) === 0 && d.source === 'local') {
        console.warn('WARN: local path did not shorten; check aggressive split');
      }
      process.exit(0);
    });
  },
);

req.on('error', (e) => {
  console.error('REQ_ERR', e.message);
  process.exit(1);
});
req.write(payload);
req.end();
