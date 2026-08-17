import assert from 'node:assert/strict';
import test from 'node:test';
import { createInsightDocxBlob, getTheoryExportFilename } from './insightWordExport';
import { buildUnifiedTheoryMindMapTree, DEFAULT_THEORY_DATA } from './theoryMindMapBuilder';

test('Word 导出生成非空 docx (含导师点评)', async () => {
  const blob = await createInsightDocxBlob({
    title: '洞察导图',
    tree: {
      name: '博弈意图',
      detail: '敲打效率',
      children: [{ name: '逻辑破绽', children: [{ name: '逻辑', detail: '滑坡谬误' }] }],
    },
    markdown: '### 四、综合评判\n洞察效率评分：8',
  });
  assert.ok(blob.size > 1000);
});

test('Word 导出支持纯理论树导出（无导师点评）', async () => {
  const unifiedTree = buildUnifiedTheoryMindMapTree({
    staticData: DEFAULT_THEORY_DATA,
    materialDrafts: [
      {
        title: '商务谈判实录.pdf',
        summary: '总结了跨国企业谈判中推责与施压话术。',
        knowledgePoints: [
          {
            title: '形式同理与实质推脱',
            explanation: '先表达完全理解对方顾虑，随后以客观接口未冻结为由推迟交付。',
            example: '“我们非常理解贵司的担忧，但前提是接口必须在下周按时冻结。”'
          }
        ]
      }
    ]
  });

  const blob = await createInsightDocxBlob({
    title: '洞察(听) 理论框架与素材合集',
    tree: unifiedTree,
  });

  assert.ok(blob instanceof Blob);
  assert.ok(blob.size > 2000, `生成的 docx blob 大小 (${blob.size}) 应大于 2000 字节`);
});

test('导出的默认文件名符合日期规范', () => {
  const name = getTheoryExportFilename('洞察理论框架');
  assert.match(name, /^洞察理论框架-\d{8}\.docx$/);
});
