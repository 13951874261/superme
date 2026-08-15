/**
 * Wave 4 听/说 Dify 结果解析（纯函数，不打 HTTPS）。
 * 运行：node vocab-server/tests/insightSpeakProxy.test.js
 */
const assert = require('assert');
const {
  extractJsonFromString,
  parseListenFeedback,
  parseSpeakResult,
  buildTimedInputs,
  resolveInsightGenApiKey,
  buildInsightGenInputs,
  parseInsightGenAnswer
} = require('../services/insightSpeakProxy');

assert.equal(parseListenFeedback({ data: { outputs: { ai_feedback: '导师点评' } } }), '导师点评');
assert.equal(parseListenFeedback({}), '');

const speak = parseSpeakResult('```json\n{"score":88,"critique":"逻辑清楚","framework_analysis":"金字塔","revised_version":"改写"}\n```');
assert.equal(speak.score, 88);
assert.equal(speak.critique, '逻辑清楚');
assert.equal(extractJsonFromString('prefix {"a":1} suffix'), '{"a":1}');

const timed = buildTimedInputs({ scenario_text: '场景' }, '画像');
assert.equal(timed.scenario_text, '场景');
assert.equal(timed.user_current_profile, '画像');
assert.ok(timed._system_time);
assert.equal(buildTimedInputs({ a: 1 }, '').user_current_profile, '');

assert.equal(resolveInsightGenApiKey({ DIFY_INSIGHT_GEN_KEY: 'backend' }), 'backend');
assert.equal(resolveInsightGenApiKey({ VITE_DIFY_INSIGHT_GEN_KEY: 'vite' }), 'vite');
assert.equal(resolveInsightGenApiKey({ DIFY_INSIGHT_GEN_KEY: 'backend', VITE_DIFY_INSIGHT_GEN_KEY: 'vite' }), 'backend');
assert.equal(resolveInsightGenApiKey({}), '');

const genInputs = buildInsightGenInputs({ category: ' 体制内 ' });
assert.equal(genInputs.category, '体制内');
assert.deepEqual(genInputs.inputs, { category: '体制内' });
assert.equal(Object.prototype.hasOwnProperty.call(genInputs.inputs, 'knowledge_context'), false);

assert.throws(() => buildInsightGenInputs({ category: '  ' }), /category required/);
assert.equal(parseInsightGenAnswer({ answer: '  考题正文  ' }), '考题正文');
assert.equal(parseInsightGenAnswer({}), '');

console.log('insightSpeakProxy.test.js passed');
