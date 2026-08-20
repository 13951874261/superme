/**
 * Wave 4 听/说 Dify 结果解析（纯函数，不打 HTTPS）。
 * 运行：node vocab-server/tests/insightSpeakProxy.test.js
 */
const assert = require('assert');
const {
  extractJsonFromString,
  parseListenFeedback,
  parseSpeakResult,
  normalizeSpeakFlaws,
  buildTimedInputs,
  resolveInsightGenApiKey,
  buildInsightGenInputs,
  parseInsightGenAnswer,
  buildCritiqueChatPrompt,
  generateMockCritiqueReply
} = require('../services/insightSpeakProxy');

assert.equal(parseListenFeedback({ data: { outputs: { ai_feedback: '导师点评' } } }), '导师点评');
assert.equal(parseListenFeedback({}), '');

// 1. 测试旧版 JSON（无 flaws）：向后兼容，自动降级切分
const speakOld = parseSpeakResult('```json\n{"score":88,"critique":"逻辑清楚","framework_analysis":"金字塔","revised_version":"改写"}\n```');
assert.equal(speakOld.score, 88);
assert.equal(speakOld.critique, '逻辑清楚');
assert.ok(Array.isArray(speakOld.flaws));
assert.equal(speakOld.flaws.length, 1);
assert.equal(speakOld.flaws[0].title, '逻辑清楚');
assert.equal(speakOld.flaws[0].dimension, 'other');

// 2. 测试新版 JSON（带结构化 flaws 数组）
const speakNew = parseSpeakResult(JSON.stringify({
  score: 40,
  critique: "综合点评",
  flaws: [
    { id: "f1", title: "空泛承诺", detail: "「尽快看看」缺乏时间表", dimension: "logic" },
    { id: "f2", title: "分寸过轻", detail: "口语化打发", dimension: "expression" }
  ],
  framework_analysis: "框架",
  revised_version: "改写范文"
}));
assert.equal(speakNew.score, 40);
assert.equal(speakNew.flaws.length, 2);
assert.equal(speakNew.flaws[0].id, 'f1');
assert.equal(speakNew.flaws[0].title, '空泛承诺');
assert.equal(speakNew.flaws[0].dimension, 'logic');
assert.equal(speakNew.flaws[1].dimension, 'expression');

// 3. 测试 normalizeSpeakFlaws 降级切分算法
// 3.1 序号切分
const flawsNumbered = normalizeSpeakFlaws(null, "1. 第一条破绽：未给出具体时间表。\n2. 第二条破绽：语气不够尊重。");
assert.equal(flawsNumbered.length, 2);
assert.equal(flawsNumbered[0].detail, '第一条破绽：未给出具体时间表。');

// 3.2 标点切分（长句 > 40 字）
const longCritique = "你的回答存在明显的问题，首先是对处长使用了过于随意口语化的表达；其次在方案推进上完全没有设定明确的完成时间与交付标准。";
const flawsPunct = normalizeSpeakFlaws(null, longCritique);
assert.ok(flawsPunct.length >= 2);

// 3.3 空白回退
const flawsEmpty = normalizeSpeakFlaws([], "");
assert.equal(flawsEmpty.length, 1);
assert.equal(flawsEmpty[0].id, 'f0');
assert.equal(flawsEmpty[0].title, '综合失分点');

// 4. 测试 buildCritiqueChatPrompt 组装
const promptBuilt = buildCritiqueChatPrompt({
  query: '如何委婉指出处长逻辑漏洞？',
  evalSnapshot: {
    totalScore: 4,
    logicScore: 2,
    expressionScore: 2,
    critique: '语言口语化',
    flaws: [{ id: 'f1', title: '空泛承诺', detail: '未给时间表', dimension: 'logic' }]
  },
  messages: [{ sender: 'user', text: '前置问题' }, { sender: 'ai', text: '前置回答' }]
});
assert.ok(promptBuilt.includes('总分: 4/10'));
assert.ok(promptBuilt.includes('如何委婉指出处长逻辑漏洞？'));
assert.ok(promptBuilt.includes('空泛承诺'));

// 5. 测试 generateMockCritiqueReply
const mockFlawReply = generateMockCritiqueReply({
  query: '请针对这条失分点展开：【空泛承诺】未给时间表',
  evalSnapshot: {
    flaws: [{ id: 'f1', title: '空泛承诺', detail: '未给时间表', dimension: 'logic' }]
  }
});
assert.ok(mockFlawReply.includes('空泛承诺'));
assert.ok(mockFlawReply.length >= 40);

const mockCustomReply = generateMockCritiqueReply({
  query: '如何委婉指出处长逻辑漏洞？',
  evalSnapshot: {}
});
assert.ok(mockCustomReply.includes('处长') || mockCustomReply.includes('委婉'));

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
