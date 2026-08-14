import assert from 'node:assert/strict';
import test from 'node:test';
import { createInsightDocxBlob } from './insightWordExport';

test('Word 导出生成非空 docx', async () => {
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
