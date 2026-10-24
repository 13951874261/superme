import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAnchoredPosition } from './anchoredPosition';

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height,
  x: left, y: top, toJSON: () => ({}),
});

test('浮层优先显示在锚点下方且不覆盖锚点', () => {
  const result = computeAnchoredPosition(rect(200, 100, 40, 32), { width: 280, height: 140 }, { width: 800, height: 600 });
  assert.equal(result.placement, 'bottom');
  assert.ok(result.top >= 140);
});

test('底部空间不足时翻转到锚点上方', () => {
  const result = computeAnchoredPosition(rect(200, 520, 40, 32), { width: 280, height: 140 }, { width: 800, height: 600 });
  assert.equal(result.placement, 'top');
  assert.ok(result.top + 140 <= 512);
});

test('水平位置始终约束在视口安全边距内', () => {
  assert.equal(computeAnchoredPosition(rect(2, 100, 20, 20), { width: 280, height: 100 }, { width: 320, height: 600 }).left, 12);
  assert.equal(computeAnchoredPosition(rect(300, 100, 20, 20), { width: 280, height: 100 }, { width: 320, height: 600 }).left, 28);
});

test('上下都放不下时选择空间更大的一侧', () => {
  const result = computeAnchoredPosition(rect(200, 430, 40, 32), { width: 280, height: 420 }, { width: 800, height: 600 });
  assert.equal(result.placement, 'top');
});

test('小视口超高浮层受可用空间约束且不覆盖锚点', () => {
  const anchor = rect(140, 120, 40, 32);
  const result = computeAnchoredPosition(anchor, { width: 280, height: 500 }, { width: 320, height: 260 });

  assert.equal(result.placement, 'top');
  assert.equal(result.top + result.maxHeight, anchor.top - 8);
  assert.equal(result.maxHeight, 100);
});
