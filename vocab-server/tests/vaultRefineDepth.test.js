/**
 * XF-FEED-02 黄金夹具单测：知识加深深度硬卡 evaluateVaultRefineDepth
 * 夹具说明：
 * - F-K0: 初始 3 个一级枝（利益/BATNA/情绪），无子枝、无步骤无反例。
 * - F-K1: 仅摘要变长 200 字，导图结构未变 → 100% 拦截（below_standard）。
 * - F-K2: 原枝保留 + 新增子枝「公开底线 vs 真实底线」+ 步骤与反例 → 100% 通过。
 */

const assert = require('assert');
const {
  evaluateVaultRefineDepth,
  collectSubBranchTitles,
  getLevel1BranchMap,
} = require('../services/vaultRefineDepthQuality');

// 黄金夹具 F-K0：初始浅层数据
const FK0_ORIGINAL = {
  mindmap: {
    center: '谈判力',
    branches: [
      { title: '利益', children: [] },
      { title: 'BATNA', children: [] },
      { title: '情绪', children: [] },
    ],
  },
  summary: '谈判中应当关注利益、准备BATNA并控制情绪。',
  items: [
    { title: '利益', explanation: '谈判的核心在于满足双方的深层利益。' },
    { title: 'BATNA', explanation: '最佳替代方案。' },
    { title: '情绪', explanation: '谈判时要保持冷静。' },
  ],
};

// 黄金夹具 F-K1：仅摘要变长，导图未扩枝
const FK1_REFINED_SUMMARY_ONLY = {
  mindmap: {
    center: '谈判力',
    branches: [
      { title: '利益', children: [] },
      { title: 'BATNA', children: [] },
      { title: '情绪', children: [] },
    ],
  },
  summary: '围绕谈判力进行了大幅度深化总结，谈判不仅是立场的争夺，更是深层利益的博弈与情绪掌控的艺术。在实战过程中我们需要深入分析对手的诉求与动机，不断强化自身的替代方案准备，确保在任何突发局势下都能保持主动地位。',
  items: [
    { title: '利益', explanation: '谈判的核心在于满足双方的深层利益，不可忽视。' },
  ],
};

// 黄金夹具 F-K2：合格加深（原枝保留 + 新增子枝 + 步骤与反例）
const FK2_REFINED_QUALIFIED = {
  mindmap: {
    center: '谈判力',
    branches: [
      {
        title: '利益',
        children: [
          { title: '公开底线 vs 真实底线' },
          { title: '隐性利益挖掘' },
        ],
      },
      {
        title: 'BATNA',
        children: [
          { title: '动态替代方案评估' },
        ],
      },
      { title: '情绪', children: [] },
    ],
  },
  summary: '谈判力精进版：聚焦真实底线与动态BATNA构建。',
  items: [
    {
      title: '公开底线 vs 真实底线',
      explanation: '在博弈中区分对方的表面报价与核心诉求。步骤1：首先通过开放式提问探寻对方隐性痛点；步骤2：测试对方的让步弹性并锁定真实底线。反例：切忌在谈判初期直接亮出自己的底牌，否则会导致筹码尽失。',
    },
  ],
};

// 测试 1：F-K1 仅摘要变长，必须 100% 失败
const resK1 = evaluateVaultRefineDepth(FK0_ORIGINAL, FK1_REFINED_SUMMARY_ONLY);
assert.strictEqual(resK1.ok, false, 'F-K1 仅摘要变长必须被硬卡拦截');
assert.ok(
  resK1.failedChecks.includes('no_new_valid_subbranches') ||
  resK1.failedChecks.includes('explanation_lacks_steps_or_counterexamples'),
  'F-K1 必须包含未扩枝或无步骤反例的失败原因'
);

// 测试 2：F-K2 合格扩枝与讲解，必须 100% 通过
const resK2 = evaluateVaultRefineDepth(FK0_ORIGINAL, FK2_REFINED_QUALIFIED);
assert.strictEqual(resK2.ok, true, 'F-K2 合格加深必须通过深度硬卡');
assert.strictEqual(resK2.reason, 'ok');
assert.ok(resK2.passedChecks.includes('branches_preserved'));
assert.ok(resK2.passedChecks.some((c) => c.startsWith('subbranches_expanded')));
assert.ok(resK2.passedChecks.includes('has_executable_steps'));
assert.ok(resK2.passedChecks.includes('has_counterexample'));

// 测试 3：缺失原一级枝（如丢弃了「情绪」），必须判定失败
const FK_MISSING_L1 = {
  mindmap: {
    center: '谈判力',
    branches: [
      { title: '利益', children: [{ title: '公开底线 vs 真实底线' }] },
      { title: 'BATNA', children: [] },
      // 缺失 '情绪'
    ],
  },
  items: FK2_REFINED_QUALIFIED.items,
};
const resMissingL1 = evaluateVaultRefineDepth(FK0_ORIGINAL, FK_MISSING_L1);
assert.strictEqual(resMissingL1.ok, false, '丢失原一级枝必须被拦截');
assert.ok(resMissingL1.failedChecks.some((c) => c.includes('missing_level1_branch')));

// 测试 4：新增通用无效子枝（如「详情」、「补充」），必须判定失败
const FK_GENERIC_SUB = {
  mindmap: {
    center: '谈判力',
    branches: [
      { title: '利益', children: [{ title: '详情' }, { title: '补充' }] },
      { title: 'BATNA', children: [] },
      { title: '情绪', children: [] },
    ],
  },
  items: FK2_REFINED_QUALIFIED.items,
};
const resGenericSub = evaluateVaultRefineDepth(FK0_ORIGINAL, FK_GENERIC_SUB);
assert.strictEqual(resGenericSub.ok, false, '通用无意义子枝不得算作合格扩枝');

// 测试 5：子枝名称等于父枝（如 利益 -> 利益），必须判定失败
const FK_SAME_AS_PARENT = {
  mindmap: {
    center: '谈判力',
    branches: [
      { title: '利益', children: [{ title: '利益' }] },
      { title: 'BATNA', children: [] },
      { title: '情绪', children: [] },
    ],
  },
  items: FK2_REFINED_QUALIFIED.items,
};
const resSame = evaluateVaultRefineDepth(FK0_ORIGINAL, FK_SAME_AS_PARENT);
assert.strictEqual(resSame.ok, false, '子枝名等于父枝不得算作扩枝');

console.log('vaultRefineDepth.test.js: All golden fixture tests passed successfully!');
