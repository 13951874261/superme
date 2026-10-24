const assert = require('node:assert/strict');
const test = require('node:test');
const {
  evaluateSimAdviceQuality,
  evaluateVerdictSectionsQuality,
  stripPlayerPrefix,
  isFallbackToneSuggested,
  matchUserPromptCue,
} = require('../services/gtCaseQuality');

test('stripPlayerPrefix 剥离前缀', () => {
  assert.equal(stripPlayerPrefix('【玩家应对策略】：你没资格过问我的编制。'), '你没资格过问我的编制。');
  assert.equal(stripPlayerPrefix('玩家输入: 你没资格过问我的编制。'), '你没资格过问我的编制。');
});

test('isFallbackToneSuggested 拦截泛化兜底', () => {
  assert.equal(isFallbackToneSuggested('先确认对方关切，再说明边界与可协商空间的下一句'), true);
  assert.equal(isFallbackToneSuggested('“编制由组织统筹，我们先谈业务。”'), false);
});

test('matchUserPromptCue 贴当句核心词匹配', () => {
  assert.equal(
    matchUserPromptCue(
      '第一步，针对「过问编制」的防御姿态，先承认对方关切。',
      '你没资格过问我的编制。'
    ),
    true
  );
  assert.equal(
    matchUserPromptCue(
      '我们要高度重视并深刻理解全局工作。',
      '你没资格过问我的编制。'
    ),
    false
  );
});

test('F1: 编制句合格稿 (贴当句策略列 + 贴当句语气修正表 + 利益情绪合格) → ok', () => {
  const r = evaluateSimAdviceQuality({
    user_answer: '你没资格过问我的编制。',
    interest_chain: 'CEO的核心利益是赢得组织人事任免权，副总则面临被边缘化出局的阵营风险。',
    emotion_motives: '对方因权限被挑战而产生失控的愤怒，表面强势实则内心恐惧失去部门控制权。',
    strategy_guidance: [
      '第一步，针对「过问编制」的防御姿态，先承认对方对权责边界的敏感关切，避免正面硬顶。',
      '第二步，再引导对方将焦点转移至具体业务协同方案上，化解权力对立。',
    ],
    tone_corrections: [
      {
        original: '你没资格过问我的编制。',
        problem: '直接质疑对方权限，引发防御对抗并关闭谈判空间',
        suggested: '“编制层面的具体安排由组织统筹，我们今天先把手头这项业务协作流程敲定。”',
      },
    ],
  });
  assert.equal(r.quality, 'ok');
  assert.equal(r.details.interestOk, true);
  assert.equal(r.details.emotionOk, true);
  assert.equal(r.details.guidanceOk, true);
  assert.equal(r.details.toneQuoteOk, true);
  assert.equal(r.details.toneRewriteOk, true);
});

test('F2: 泛化兜底拦截 (guidance 与 suggested 均为兜底套话) → below_standard', () => {
  const r = evaluateSimAdviceQuality({
    user_answer: '你没资格过问我的编制。',
    interest_chain: 'CEO赢得控制权，副总面临出局阵营风险。',
    emotion_motives: '内心充满失控的恐惧与面子焦虑。',
    strategy_guidance: [
      '先确认对方关切，再说明边界与可协商空间的下一句',
      '先确认对方关切，再说明边界与可协商空间的下一句',
    ],
    tone_corrections: [
      {
        original: '你没资格过问我的编制。',
        problem: '表达过硬或分寸不足，易激怒对方或关闭谈判空间',
        suggested: '先确认对方关切，再说明边界与可协商空间的下一句',
      },
    ],
  });
  assert.equal(r.quality, 'below_standard');
  assert.equal(r.details.toneRewriteOk, false);
});

test('F3: 隐藏两节为套话不影响沙盘入库 → ok', () => {
  const r = evaluateSimAdviceQuality({
    user_answer: '你没资格过问我的编制。',
    interest_chain: 'CEO赢得控制权，副总面临出局阵营风险。',
    emotion_motives: '内心充满失控的恐惧与面子焦虑。',
    strategy_guidance: [
      '第一步先稳住编制话题，第二步再展开协作。',
      '切忌当面激化，再私下汇报。',
    ],
    tone_corrections: [
      {
        original: '你没资格过问我的编制。',
        problem: '直接硬顶',
        suggested: '“这方面由集团统一规划，我们先谈当下的进度。”',
      },
    ],
    actionable_strategy: '我们要高度重视并统筹兼顾，深刻理解战略定力，狠抓落实。',
    script_examples: '综上所述，高度重视统筹推进。',
  });
  assert.equal(r.quality, 'ok');
});

test('F4: 会话复盘未贴当句 → below_standard', () => {
  const r = evaluateSimAdviceQuality({
    user_answer: '你没资格过问我的编制。',
    interest_chain: 'CEO赢得控制权，副总面临出局。',
    emotion_motives: '害怕失去利益，充满恐惧。',
    strategy_guidance: [
      '第一步先梳理流程，第二步再汇总意见。',
      '会前先私下沟通。',
    ],
    tone_corrections: [
      {
        original: '今天天气不错，大家一起开会。',
        problem: '无关主题',
        suggested: '“我们直接进入议题。”',
      },
    ],
  });
  assert.equal(r.quality, 'below_standard');
  assert.equal(r.details.guidanceOk, false);
  assert.equal(r.details.toneQuoteOk, false);
});

test('F5: 案例研判套话四节维持 CASE-02 拦截 → below_standard', () => {
  const r = evaluateVerdictSectionsQuality({
    interest_chain: '我们要高度重视统筹兼顾，深刻理解战略定力。',
    emotion_motives: '我们要高度重视统筹兼顾，深刻理解战略定力。',
    actionable_strategy: '我们要高度重视统筹兼顾，深刻理解战略定力。',
    script_examples: '我们要高度重视统筹兼顾，深刻理解战略定力。',
  });
  assert.equal(r.quality, 'below_standard');
});

test('F6: 应对带【玩家应对策略】前缀剥离后判定 → ok', () => {
  const r = evaluateSimAdviceQuality({
    user_answer: '【玩家应对策略】：你没资格过问我的编制。',
    interest_chain: '赢得利益掌控权，避免出局风险。',
    emotion_motives: '极度害怕被架空与当众难堪的恐惧。',
    strategy_guidance: [
      '第一步，针对「过问编制」的防御姿态，先承认对方对权责边界的敏感关切。',
      '第二步，再引导对方将焦点转移至具体业务协同方案上。',
    ],
    tone_corrections: [
      {
        original: '你没资格过问我的编制。',
        problem: '直接质疑对方权限，引发防御对抗',
        suggested: '“编制由公司统一安排，我们先聚焦当前项目。”',
      },
    ],
  });
  assert.equal(r.quality, 'ok');
});
