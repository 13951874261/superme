import assert from 'node:assert/strict';
import test from 'node:test';
import { THEME_CHANGED_EVENT, THEME_STORAGE_KEY, isThemeStale } from './currentTheme';

test('同一主题不算过期', () => {
  assert.equal(isThemeStale('新人报到', '新人报到'), false);
});

test('户口本和材料主题不同才过期', () => {
  assert.equal(isThemeStale('新人报到', '商务谈判：让步与施压'), true);
});

test('空值不过期', () => {
  assert.equal(isThemeStale('', '商务谈判：让步与施压'), false);
  assert.equal(isThemeStale('新人报到', ''), false);
});

test('事件名复用职业轨迹那套，存储键沿用 english_theme', () => {
  assert.equal(THEME_CHANGED_EVENT, 'superme-theme-changed');
  assert.equal(THEME_STORAGE_KEY, 'english_theme');
});
