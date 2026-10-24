import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInsightMindMap, type InsightMindMapForm } from './insightMindMapBuilder';

function sampleForm(overrides: Partial<InsightMindMapForm> = {}): InsightMindMapForm {
  return {
    socialLevel: '正科级中层',
    innerLevel: '城府极深',
    realIntent: '表面关怀实则敲打效率',
    humanNature: '控制型人格',
    nonVerbalSignals: '食指扣桌',
    emotionLevel: '表演式温和',
    logicFlaw: '滑坡谬误',
    factFlaw: '缺失工作量对比',
    intentFlaw: '避重就轻',
    trustScore: 2,
    trustReason: '动机不纯',
    ...overrides,
  };
}

test('中心节点使用截断后的真实意图', () => {
  const tree = buildInsightMindMap({
    scenario: '走廊相遇的攀比话术',
    form: sampleForm(),
  });
  assert.equal(tree.name, '表面关怀实则敲打效率');
});

test('真实意图为空时中心回退为博弈意图', () => {
  const tree = buildInsightMindMap({
    scenario: '场景A',
    form: sampleForm({ realIntent: '' }),
  });
  assert.equal(tree.name, '博弈意图');
});

test('空字段不生成叶子，全空的分支被去掉', () => {
  const tree = buildInsightMindMap({
    scenario: '',
    form: sampleForm({
      socialLevel: '',
      innerLevel: '',
      humanNature: '',
      nonVerbalSignals: '',
      emotionLevel: '',
      factFlaw: '',
      intentFlaw: '',
      trustReason: '',
    }),
  });
  const names = (tree.children || []).map((c) => c.name);
  assert.deepEqual(names, ['利益诉求', '逻辑破绽']);
  const intent = tree.children?.find((c) => c.name === '利益诉求');
  assert.ok(intent?.children?.some((c) => c.name === '真实意图'));
  const flaw = tree.children?.find((c) => c.name === '逻辑破绽');
  assert.ok(flaw?.children?.some((c) => c.name === '逻辑'));
  assert.equal(flaw?.children?.some((c) => c.name.includes('可信度')), false);
});

test('Markdown 的 ### 标题成为额外分支', () => {
  const tree = buildInsightMindMap({
    scenario: '场景',
    form: sampleForm(),
    markdown: '### 一、多维人物侧写矩阵\n- 社会层级：上位者\n\n### 四、综合评判\n- 洞察效率评分：8',
  });
  const extra = (tree.children || []).filter((c) => c.name.includes('侧写') || c.name.includes('综合评判'));
  assert.equal(extra.length, 2);
  assert.ok(extra[0].detail?.includes('上位者'));
});
