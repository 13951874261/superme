import assert from 'node:assert/strict';
import {
  DEFAULT_THEORY_DATA,
  buildStaticTheoryTree,
  adaptMaterialDraftToMindMapNode,
  buildUnifiedTheoryMindMapTree,
} from './theoryMindMapBuilder';

console.log('Testing theoryMindMapBuilder...');

// 1. 测试静态理论树构建 (AC1.1, AC1.2, AC1.5)
const staticTree = buildStaticTheoryTree(DEFAULT_THEORY_DATA);
assert.equal(staticTree.name, '洞察理论框架');
assert.ok(Array.isArray(staticTree.children));
assert.equal(staticTree.children.length, 2); // 逻辑学与系统谬误, 人性分析与心理侧写

const logicCategory = staticTree.children.find((c) => c.name === '逻辑学与系统谬误');
assert.ok(logicCategory, '必须包含逻辑学与系统谬误分类');
assert.ok(logicCategory.children && logicCategory.children.length >= 2);

const fallacyTheme = logicCategory.children.find((t) => t.name === '非形式逻辑谬误');
assert.ok(fallacyTheme, '必须包含非形式逻辑谬误主题');
assert.ok(fallacyTheme.children && fallacyTheme.children.length >= 4);

const slipperySlopeLeaf = fallacyTheme.children.find((p) => p.name === '滑坡谬误');
assert.ok(slipperySlopeLeaf, '必须包含滑坡谬误知识点');
assert.ok(slipperySlopeLeaf.detail?.includes('【概念要点】'), '叶节点必须包含概念要点');
assert.ok(slipperySlopeLeaf.detail?.includes('【场景举例】'), '叶节点必须包含场景举例');
console.log('✓ 静态理论树校验通过 (包含 2 大类、完整子主题及含概念与举例的叶节点)');

// 2. 测试素材提取结果转思维导图节点 (AC2.2, AC2.5)
const mockMaterialDraft = {
  title: '博弈谈判实战录.pdf',
  summary: '本书系统阐述了商务谈判中的锚定效应与让步策略。',
  tags: ['商务谈判', '博弈心理'],
  knowledgePoints: [
    {
      title: '沉锚效应',
      explanation: '在谈判初始阶段设定极端报价，以影响后续谈判区间的心理倾向。',
      example: '在首次报价时提出高于预算30%的方案，迫使对方在此基准上重新评估谈判空间。',
    },
    {
      title: '渐进式让步',
      explanation: '每次让步幅度递减，向对方传递已接近底线的信号。',
      example: '第一轮让步5万，第二轮让步2万，第三轮让步5000元。',
    },
  ],
};

const materialNode = adaptMaterialDraftToMindMapNode(mockMaterialDraft);
assert.equal(materialNode.name, '素材衍生：博弈谈判实战录');
assert.ok(materialNode.detail?.includes('【素材摘要】'));
assert.ok(materialNode.children && materialNode.children.length === 2);
assert.equal(materialNode.children[0].name, '沉锚效应');
assert.ok(materialNode.children[0].detail?.includes('【要点阐述】'));
assert.ok(materialNode.children[0].detail?.includes('【场景举例】'));
console.log('✓ 素材草稿转换导图分支校验通过 (正确生成衍生分支与结构化叶节点)');

// 3. 测试素材提取无结构化 points 时的兜底机制 (AC2.4 兜底)
const mockRawDraft = {
  title: '短文本无要点.txt',
  summary: '这是一份简短的素材内容。',
};
const fallbackNode = adaptMaterialDraftToMindMapNode(mockRawDraft);
assert.equal(fallbackNode.name, '素材衍生：短文本无要点');
assert.ok(fallbackNode.children && fallbackNode.children.length >= 1);
assert.ok(fallbackNode.children[0].detail?.includes('【要点提炼】') || fallbackNode.children[0].detail?.includes('【说明】'));
console.log('✓ 素材草稿兜底机制校验通过');

// 4. 测试 M1 模式统合树构建 (AC3.4 / M1 语义)
const unifiedTree = buildUnifiedTheoryMindMapTree({
  staticData: DEFAULT_THEORY_DATA,
  materialDrafts: [mockMaterialDraft],
});
assert.equal(unifiedTree.name, '听读 理论框架体系');
assert.ok(unifiedTree.children && unifiedTree.children.length === 3); // 2个静态大类 + 1个素材衍生
assert.ok(unifiedTree.children.some((c) => c.name === '素材衍生：博弈谈判实战录'));
console.log('✓ M1 统合思维导图树校验通过 (包含 2 个静态分类 + 挂载的素材分支)');

console.log('\nAll theoryMindMapBuilder tests passed successfully!');
