import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildBookTheoryTree, flattenBookTheoryTree } from './bookTheoryTree';
import { cloneLayout } from '../components/modules/insight/InsightMindMap';
import { readBookListenRoute, writeBookListenRoute } from './bookListenRouteState';

const nodes = [
  { id: 'root', parentId: null, title: '根理论', summary: '根摘要', orderIndex: 0, evidence: [{ id: 'e1', quote: '原文证据', locator: { kind: 'text', unitIndex: 1 } }] },
  { id: 'child', parentId: 'root', title: '子理论', summary: '子摘要', orderIndex: 1, evidence: [] },
  { id: 'orphan', parentId: 'missing', title: '孤立理论', summary: '孤立摘要', orderIndex: 2, evidence: [] },
];

test('D3 树与可访问列表节点完全一致并保留稳定 ID', () => {
  const tree = buildBookTheoryTree('测试书', nodes);
  const flat = flattenBookTheoryTree(tree);
  assert.deepEqual(flat.map((node) => node.id), ['root', 'child', 'orphan']);
  assert.equal(new Set(flat.map((node) => node.id)).size, nodes.length);
  assert.equal(flat.find((node) => node.id === 'child')?.parentId, 'root');
});

test('树节点保留 summary 与 evidence 回链', () => {
  const root = flattenBookTheoryTree(buildBookTheoryTree('测试书', nodes)).find((node) => node.id === 'root');
  assert.equal(root?.summary, '根摘要');
  assert.equal(root?.evidence[0].id, 'e1');
  assert.deepEqual(root?.evidence[0].locator, { kind: 'text', unitIndex: 1 });
});

test('输入顺序变化不改变兄弟排序与稳定 ID', () => {
  const a = flattenBookTheoryTree(buildBookTheoryTree('测试书', nodes)).map(({ id }) => id);
  const b = flattenBookTheoryTree(buildBookTheoryTree('测试书', [...nodes].reverse())).map(({ id }) => id);
  assert.deepEqual(a, b);
});

test('D3 clone 保留书籍节点 ID、摘要和证据供点击回传', () => {
  const original = buildBookTheoryTree('测试书', nodes).children![0];
  const cloned = cloneLayout(original);
  assert.equal(cloned.id, 'root');
  assert.equal(cloned.summary, '根摘要');
  assert.equal(cloned.evidence[0].id, 'e1');
});

test('书籍、revision、节点 URL 状态可写入并恢复', () => {
  const url = writeBookListenRoute('/?module=listen', { bookId: 'b', revisionId: 'r', nodeId: 'n' });
  assert.deepEqual(readBookListenRoute(url.slice(url.indexOf('?'))), { bookId: 'b', revisionId: 'r', nodeId: 'n' });
  assert.match(url, /module=listen/);
});

test('D3 仅交互节点可聚焦并支持 Enter/Space', () => {
  const source = fs.readFileSync(new URL('../components/modules/insight/InsightMindMap.tsx', import.meta.url), 'utf8');
  assert.match(source, /\.attr\('role', \(d\) => interactive\(d\) \? 'button' : null\)/);
  assert.match(source, /\.attr\('tabindex', \(d\) => interactive\(d\) \? 0 : null\)/);
  assert.match(source, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(source, /\.attr\('aria-label'/);
});
