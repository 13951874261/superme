import {
  buildStaticTheoryTree,
  adaptMaterialDraftToMindMapNode,
  buildUnifiedTheoryMindMapTree,
  DEFAULT_THEORY_DATA,
} from '../theoryMindMapBuilder';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('--- 开始测试 theoryMindMapBuilder ---');

// 1. 测试静态理论导图树构建
const staticTree = buildStaticTheoryTree(DEFAULT_THEORY_DATA);
assert(staticTree.name === '洞察理论框架', '根节点名称应为 洞察理论框架');
assert(Array.isArray(staticTree.children) && staticTree.children.length === 2, '静态树应包含 2 个大类');

const logicCategory = staticTree.children?.[0];
assert(logicCategory?.name === '逻辑学与系统谬误', '第一大类为 逻辑学与系统谬误');
assert(Array.isArray(logicCategory?.children) && logicCategory.children.length === 2, '逻辑大类应包含 2 个核心模块');

const firstTheme = logicCategory?.children?.[0];
assert(firstTheme?.name === '非形式逻辑谬误', '第一个主题应为 非形式逻辑谬误');
assert(Array.isArray(firstTheme?.children) && firstTheme.children.length === 4, '非形式逻辑谬误应包含 4 个叶节点');

const leaf1 = firstTheme?.children?.[0];
assert(leaf1?.name === '滑坡谬误', '叶节点 1 应为 滑坡谬误');
assert(!!leaf1?.detail && leaf1.detail.includes('【场景举例】'), '叶节点应包含场景举例');
console.log('✓ 静态理论树构建与叶节点例句校验通过');

// 2. 测试素材草稿转导图分支适配
const sampleDraft = {
  title: '跨文化沟通博弈实录.pdf',
  summary: '总结了跨国企业谈判中由于文化背景差异造成的推责与施压话术。',
  tags: ['跨文化', '推责话术', 'SOP对齐'],
  knowledgePoints: [
    {
      title: '形式同理与实质推脱',
      explanation: '先表达完全理解对方顾虑，随后以客观接口未冻结为由推迟自身交付。',
      example: '“我们非常理解贵司的担忧，但前提是接口必须在下周按时冻结。”'
    }
  ]
};

const materialNode = adaptMaterialDraftToMindMapNode(sampleDraft);
assert(materialNode.name === '素材衍生：跨文化沟通博弈实录', '素材节点名称应带有前缀与去扩展名标题');
assert(Array.isArray(materialNode.children) && materialNode.children.length === 1, '应转换出 1 个知识点子节点');
assert(materialNode.children?.[0].name === '形式同理与实质推脱', '子节点名称正确');
assert(materialNode.children?.[0].detail?.includes('【场景举例】“我们非常理解贵司的担忧'), '子节点包含场景举例');
console.log('✓ 素材结构化知识点草稿适配通过');

// 2.2 测试纯文本摘要素材草稿适配与兜底
const fallbackDraft = {
  title: '简单摘录.txt',
  summary: '某商业谈判代表放慢语速直视对方。提出底线让步并要求按A方案执行。',
  tags: ['商业谈判', '道德绑架']
};
const adaptedFallback = adaptMaterialDraftToMindMapNode(fallbackDraft);
assert(adaptedFallback.name === '素材衍生：简单摘录', '纯文本草稿名称正确');
assert(Array.isArray(adaptedFallback.children) && adaptedFallback.children.length > 0, '应从摘要拆分出至少 1 个要点节点');
console.log('✓ 纯文本摘要草稿提炼适配通过');

// 2.3 测试空素材/提取失败兜底
const emptyDraft = adaptMaterialDraftToMindMapNode(null, '失败文件.pdf');
assert(emptyDraft.name === '素材衍生：失败文件', '空草稿兜底名称正确');
assert(emptyDraft.children?.[0].detail?.includes('资料管理中心'), '空草稿应包含资料管理中心引导');
console.log('✓ 空素材提取失败兜底校验通过');

// 3. 测试 M1 合集树构建
const unifiedTree = buildUnifiedTheoryMindMapTree({
  staticData: DEFAULT_THEORY_DATA,
  materialDrafts: [sampleDraft, fallbackDraft]
});
assert(unifiedTree.name === '听读 理论框架体系', '合集根节点命名正确');
assert(Array.isArray(unifiedTree.children) && unifiedTree.children.length === 4, '合集应包含 2 个静态分类 + 2 个素材分支');
console.log('✓ M1 静态+素材合集树构建校验通过');

console.log('--- theoryMindMapBuilder 全部单测执行通过 ---');
