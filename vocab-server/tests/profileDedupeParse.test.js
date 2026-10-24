/**
 * Profile Dedupe parse + local compress tests
 * Run: node vocab-server/tests/profileDedupeParse.test.js
 */
const assert = require('assert');
const {
  parseProfileDedupeXml,
  extractDedupeRawFromWorkflowData,
  compressProfileLocal,
  dedupeProfileLocal,
} = require('../services/profileDedupe');

// XML happy path
{
  const parsed = parseProfileDedupeXml(`
    <response>
      <merged_profile>英国；对抗沟通迟疑；目标自我提升</merged_profile>
      <dedupe_count>2</dedupe_count>
    </response>
  `);
  assert.ok(parsed);
  assert.match(parsed.mergedProfile, /英国/);
  assert.equal(parsed.dedupeCount, 2);
}

// markdown fence + think noise
{
  const parsed = parseProfileDedupeXml(`\`\`\`xml
<think>ignore</think>
<merged_profile>口音UK；董事会叙事弱</merged_profile>
<dedupe_count>1</dedupe_count>
\`\`\``);
  assert.ok(parsed);
  assert.match(parsed.mergedProfile, /董事会叙事弱/);
}

// JSON fallback
{
  const parsed = parseProfileDedupeXml('{"merged_profile":"短板A；短板B","dedupe_count":3}');
  assert.equal(parsed.mergedProfile, '短板A；短板B');
  assert.equal(parsed.dedupeCount, 3);
}

// bare text fallback
{
  const parsed = parseProfileDedupeXml('英国口音；高压逻辑反击偏慢；建立每日学习记录');
  assert.ok(parsed);
  assert.match(parsed.mergedProfile, /高压逻辑/);
}

// empty / broken
assert.equal(parseProfileDedupeXml(''), null);
assert.equal(parseProfileDedupeXml('<merged_profile></merged_profile>'), null);

// extract outputs object shapes
{
  const raw = extractDedupeRawFromWorkflowData({
    data: { outputs: { result: '<merged_profile>OK正文</merged_profile><dedupe_count>0</dedupe_count>' } },
  });
  assert.match(raw, /OK正文/);
}
{
  const raw = extractDedupeRawFromWorkflowData({
    data: { outputs: { result: { merged_profile: '对象输出', dedupe_count: 1 } } },
  });
  assert.match(raw, /对象输出/);
}

// local compress shortens long prose without semicolons
{
  const long = [
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
  const out = compressProfileLocal(long, 900);
  assert.ok(out.mergedProfile.length > 0);
  assert.ok(out.mergedProfile.length <= 900);
  assert.ok(out.mergedProfile.length < long.length, 'local compress should shorten long prose');
  assert.ok(out.dedupeCount >= 0);
}

// classic segment dedupe keeps latest
{
  const { mergedProfile, dedupeCount } = dedupeProfileLocal(
    '英国；汇报逻辑散',
    '英国；董事会叙事弱',
  );
  assert.ok(dedupeCount >= 1);
  assert.match(mergedProfile, /董事会叙事弱|汇报逻辑散/);
}

console.log('OK profileDedupeParse tests');
