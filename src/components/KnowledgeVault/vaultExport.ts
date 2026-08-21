import type { KnowledgeSyncFields, KnowledgeVault } from './useKnowledgeVault';

const SOURCE_TYPE_LABEL: Record<string, string> = {
  manual: '手动录入',
  upload_book: '书籍上传',
  upload_video: '视频上传',
  ai_extract: 'AI 提炼',
  from_vocab: '生词本导入',
  from_game_tactics: '策略库导入',
  from_profile: '画像导入',
};

const SYNC_STATUS_LABEL: Record<string, string> = {
  draft: '待确认',
  approved: '已确认未同步',
  synced: '已同步',
  archived: '已归档',
};

const MODULE_LABEL: Record<string, string> = {
  listen: '听力',
  speak: '口语',
  game_theory: '博弈',
  writing: '写作',
  aesthetic: '审美',
};

const ACTION_LABEL: Record<string, string> = {
  generated: '生成',
  analyzed: '分析',
  reviewed: '复盘',
};

const SYNC_CSV_HEADERS = ['来源类型', '同步状态', '同步模块', '最近使用'];

export function buildSyncExportFields(item: KnowledgeSyncFields): {
  sourceType: string;
  syncStatus: string;
  modules: string;
  latestUse: string;
} {
  const latest = [...(item.traces || [])].sort((a, b) => (b.usedAt || 0) - (a.usedAt || 0))[0];
  const latestUse = latest
    ? [
        MODULE_LABEL[latest.module] || latest.module,
        ACTION_LABEL[latest.action || ''] || latest.action || '',
        new Date(latest.usedAt).toLocaleDateString('zh-CN'),
      ].filter(Boolean).join('/')
    : '';
  return {
    sourceType: SOURCE_TYPE_LABEL[item.sourceType || ''] || item.sourceType || '手动录入',
    syncStatus: SYNC_STATUS_LABEL[item.syncStatus || ''] || '待确认',
    modules: (item.moduleTargets || []).map((m) => MODULE_LABEL[m] || m).join('/'),
    latestUse,
  };
}

function syncCsvValues(item: KnowledgeSyncFields): string[] {
  const fields = buildSyncExportFields(item);
  return [fields.sourceType, fields.syncStatus, fields.modules, fields.latestUse];
}

export function formatWordExportItem(body: string, item: KnowledgeSyncFields): string {
  const fields = buildSyncExportFields(item);
  const meta = [
    `来源类型: ${fields.sourceType}`,
    `同步状态: ${fields.syncStatus}`,
    `同步模块: ${fields.modules || '无'}`,
    `最近使用: ${fields.latestUse || '无'}`,
  ].join('；');
  return `${body}\n${meta}`;
}

export function buildEnglishNoteCsvRows(notes: KnowledgeVault['englishNotes']): string[][] {
  const rows = [['单词', '释义', '例句', '来源', '添加时间', ...SYNC_CSV_HEADERS]];
  notes.forEach((n) => {
    rows.push([n.word, n.meaning, n.example, n.source, new Date(n.addedAt).toLocaleDateString('zh-CN'), ...syncCsvValues(n)]);
  });
  return rows;
}

export function buildTheoryFrameCsvRows(frames: KnowledgeVault['theoryFrames']): string[][] {
  const catMap: Record<string, string> = {
    game_theory: '博弈论',
    psychology: '心理学',
    logic: '逻辑学',
  };
  const rows = [['标题', '类别', '概要', '来源', '添加时间', ...SYNC_CSV_HEADERS]];
  frames.forEach((f) => {
    rows.push([f.title, catMap[f.category] || f.category, f.summary, f.source, new Date(f.addedAt).toLocaleDateString('zh-CN'), ...syncCsvValues(f)]);
  });
  return rows;
}

export function buildWritingSkillCsvRows(skills: KnowledgeVault['writingSkills']): string[][] {
  const rows = [['标题', '类别', '内容', '来源', '添加时间', ...SYNC_CSV_HEADERS]];
  skills.forEach((s) => {
    rows.push([s.title, s.category, s.content, s.source, new Date(s.addedAt).toLocaleDateString('zh-CN'), ...syncCsvValues(s)]);
  });
  return rows;
}

export function buildAestheticTipCsvRows(tips: KnowledgeVault['aestheticTips']): string[][] {
  const rows = [['标题', '类别', '内容', '来源', '添加时间', ...SYNC_CSV_HEADERS]];
  tips.forEach((t) => {
    rows.push([t.title, t.category, t.content, t.source, new Date(t.addedAt).toLocaleDateString('zh-CN'), ...syncCsvValues(t)]);
  });
  return rows;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadBinary(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// CSV with UTF-8 BOM for Excel compatibility
function toCsvString(rows: string[][]): string {
  const escape = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  };
  const csv = rows.map(row => row.map(escape).join(',')).join('\r\n');
  return '﻿' + csv; // UTF-8 BOM
}

export function exportEnglishNotesToCsv(notes: KnowledgeVault['englishNotes']) {
  downloadFile(toCsvString(buildEnglishNoteCsvRows(notes)), '英语笔记本.csv', 'text/csv;charset=utf-8');
}

export function exportTheoryFramesToCsv(frames: KnowledgeVault['theoryFrames']) {
  downloadFile(toCsvString(buildTheoryFrameCsvRows(frames)), '理论框架.csv', 'text/csv;charset=utf-8');
}

export function exportWritingSkillsToCsv(skills: KnowledgeVault['writingSkills']) {
  downloadFile(toCsvString(buildWritingSkillCsvRows(skills)), '写作技巧.csv', 'text/csv;charset=utf-8');
}

export function exportAestheticTipsToCsv(tips: KnowledgeVault['aestheticTips']) {
  downloadFile(toCsvString(buildAestheticTipCsvRows(tips)), '审美要点.csv', 'text/csv;charset=utf-8');
}

// Export all to a single CSV with sections
export function buildAllVaultCsvString(vault: KnowledgeVault): string {
  const rows: string[][] = [];
  rows.push(['=== 英语笔记本 ===']);
  rows.push(...buildEnglishNoteCsvRows(vault.englishNotes));
  rows.push([]);
  rows.push(['=== 理论框架 ===']);
  rows.push(...buildTheoryFrameCsvRows(vault.theoryFrames));
  rows.push([]);
  rows.push(['=== 写作技巧 ===']);
  rows.push(...buildWritingSkillCsvRows(vault.writingSkills));
  rows.push([]);
  rows.push(['=== 审美要点 ===']);
  rows.push(...buildAestheticTipCsvRows(vault.aestheticTips));
  return toCsvString(rows);
}

export function exportAllToCsv(vault: KnowledgeVault) {
  downloadFile(buildAllVaultCsvString(vault), '资料管理总汇.csv', 'text/csv;charset=utf-8');
}

// Word export via backend API
async function exportWord(title: string, sections: { heading: string; items: string[] }[]): Promise<Blob> {
  const res = await fetch('/api/knowledge-vault/export-docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, sections })
  });
  if (!res.ok) throw new Error('导出失败');
  return await res.blob();
}

export function buildAllVaultWordSections(vault: KnowledgeVault): { heading: string; items: string[] }[] {
  return [
    {
      heading: '英语笔记本',
      items: vault.englishNotes.map((n) => formatWordExportItem(
        n.word + ' - ' + n.meaning + (n.example ? ('\n例句: ' + n.example) : ''),
        n,
      )),
    },
    {
      heading: '理论框架',
      items: vault.theoryFrames.map((f) => formatWordExportItem(
        f.title + ' [' + f.category + ']\n' + f.summary,
        f,
      )),
    },
    {
      heading: '写作技巧',
      items: vault.writingSkills.map((s) => formatWordExportItem(
        s.title + ' [' + s.category + ']\n' + s.content,
        s,
      )),
    },
    {
      heading: '审美要点',
      items: vault.aestheticTips.map((t) => formatWordExportItem(
        t.title + ' [' + t.category + ']\n' + t.content,
        t,
      )),
    },
  ];
}

export async function exportEnglishNotesToWord(notes: KnowledgeVault['englishNotes']) {
  const sections = [
    {
      heading: '英语笔记本',
      items: notes.map((n) => formatWordExportItem(
        n.word + ' - ' + n.meaning + (n.example ? ('\n例句: ' + n.example) : ''),
        n,
      )),
    },
  ];
  const blob = await exportWord('英语笔记本', sections);
  downloadBinary(blob, '英语笔记本.docx');
}

export async function exportAllToWord(vault: KnowledgeVault) {
  const blob = await exportWord('资料管理总汇', buildAllVaultWordSections(vault));
  downloadBinary(blob, '资料管理总汇.docx');
}

export async function requestVaultExportBackground(params: {
  format: 'csv' | 'docx';
  title?: string;
  filename?: string;
  csvContent?: string;
  sections?: { heading: string; items: string[] }[];
}): Promise<{ taskId: string; status: string }> {
  const res = await fetch('/api/knowledge-vault/export-background', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success || !data?.taskId) {
    throw new Error(data?.error || '发起资料抽屉导出失败');
  }
  return { taskId: data.taskId as string, status: String(data.status || 'pending') };
}
