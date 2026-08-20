import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEnglishNoteCsvRows,
  buildSyncExportFields,
  formatWordExportItem,
} from './vaultExport';
import type { EnglishNote } from './useKnowledgeVault';

test('同步导出字段包含来源类型、状态、同步模块、最近使用', () => {
  const fields = buildSyncExportFields({
    sourceType: 'from_profile',
    syncStatus: 'synced',
    moduleTargets: ['listen', 'game_theory'],
    traces: [
      { module: 'speak', action: 'analyzed', usedAt: 1 },
      { module: 'listen', action: 'analyzed', usedAt: 1_776_000_000_000 },
    ],
  });
  assert.equal(fields.sourceType, '画像导入');
  assert.equal(fields.syncStatus, '已同步');
  assert.equal(fields.modules, '听力/博弈');
  assert.match(fields.latestUse, /听力/);
  assert.match(fields.latestUse, /分析/);
});

test('未同步且无使用记录时导出空模块与空最近使用', () => {
  const fields = buildSyncExportFields({
    sourceType: 'manual',
    syncStatus: 'draft',
    moduleTargets: [],
    traces: [],
  });
  assert.equal(fields.sourceType, '手动录入');
  assert.equal(fields.syncStatus, '待确认');
  assert.equal(fields.modules, '');
  assert.equal(fields.latestUse, '');
});

test('英语笔记 CSV 追加同步模块、来源类型、状态、最近使用列', () => {
  const note: EnglishNote = {
    id: 'n1',
    word: 'leverage',
    meaning: '杠杆',
    example: 'Use leverage carefully.',
    source: '生词本同步',
    addedAt: 1_776_000_000_000,
    sourceType: 'from_vocab',
    syncStatus: 'synced',
    moduleTargets: ['speak'],
    traces: [{ module: 'speak', action: 'analyzed', usedAt: 1_776_000_000_000 }],
  };
  const rows = buildEnglishNoteCsvRows([note]);
  assert.deepEqual(rows[0], ['单词', '释义', '例句', '来源', '添加时间', '来源类型', '同步状态', '同步模块', '最近使用']);
  assert.equal(rows[1][0], 'leverage');
  assert.equal(rows[1][5], '生词本导入');
  assert.equal(rows[1][6], '已同步');
  assert.equal(rows[1][7], '口语');
  assert.match(rows[1][8], /口语/);
});

test('Word 条目附带来源类型、状态、同步模块、最近使用', () => {
  const line = formatWordExportItem(
    '信息不对称 [博弈论]\n一方掌握更多信息。',
    {
      sourceType: 'upload_book',
      syncStatus: 'approved',
      moduleTargets: [],
      traces: [],
    },
  );
  assert.match(line, /信息不对称/);
  assert.match(line, /书籍上传/);
  assert.match(line, /已确认未同步/);
});
