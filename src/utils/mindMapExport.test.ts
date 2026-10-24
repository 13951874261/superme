import assert from 'node:assert/strict';
import test from 'node:test';
import { mindMapToMarkdown, makeMindMapFilename } from './mindMapExport';
import type { InsightMindMapNode } from './insightMindMapBuilder';

const tree: InsightMindMapNode = {
  name: '博弈意图',
  detail: '敲打效率',
  children: [
    {
      name: '逻辑破绽',
      children: [
        { name: '逻辑', detail: '滑坡谬误' },
      ],
    },
  ],
};

test('树转 Markdown 大纲按层级输出标题和详情', () => {
  const md = mindMapToMarkdown(tree);
  assert.match(md, /^# 博弈意图/m);
  assert.match(md, /^## 逻辑破绽/m);
  assert.match(md, /^### 逻辑/m);
  assert.match(md, /滑坡谬误/);
});

test('文件名包含词干、时间戳和扩展名', () => {
  const name = makeMindMapFilename('insight', 'svg');
  assert.match(name, /^insight-\d+\.svg$/);
});
