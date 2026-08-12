import { KnowledgeVault } from './useKnowledgeVault';

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
  const rows = [['单词', '释义', '例句', '来源', '添加时间']];
  notes.forEach(n => {
    rows.push([n.word, n.meaning, n.example, n.source, new Date(n.addedAt).toLocaleDateString('zh-CN')]);
  });
  downloadFile(toCsvString(rows), '英语笔记本.csv', 'text/csv;charset=utf-8');
}

export function exportTheoryFramesToCsv(frames: KnowledgeVault['theoryFrames']) {
  const rows = [['标题', '类别', '概要', '来源', '添加时间']];
  const catMap: Record<string, string> = {
    game_theory: '博弈论',
    psychology: '心理学',
    logic: '逻辑学'
  };
  frames.forEach(f => {
    rows.push([f.title, catMap[f.category] || f.category, f.summary, f.source, new Date(f.addedAt).toLocaleDateString('zh-CN')]);
  });
  downloadFile(toCsvString(rows), '理论框架.csv', 'text/csv;charset=utf-8');
}

export function exportWritingSkillsToCsv(skills: KnowledgeVault['writingSkills']) {
  const rows = [['标题', '类别', '内容', '来源', '添加时间']];
  skills.forEach(s => {
    rows.push([s.title, s.category, s.content, s.source, new Date(s.addedAt).toLocaleDateString('zh-CN')]);
  });
  downloadFile(toCsvString(rows), '写作技巧.csv', 'text/csv;charset=utf-8');
}

export function exportAestheticTipsToCsv(tips: KnowledgeVault['aestheticTips']) {
  const rows = [['标题', '类别', '内容', '来源', '添加时间']];
  tips.forEach(t => {
    rows.push([t.title, t.category, t.content, t.source, new Date(t.addedAt).toLocaleDateString('zh-CN')]);
  });
  downloadFile(toCsvString(rows), '审美要点.csv', 'text/csv;charset=utf-8');
}

// Export all to a single CSV with sections
export function exportAllToCsv(vault: KnowledgeVault) {
  const rows: string[][] = [];
  rows.push(['=== 英语笔记本 ===']);
  rows.push(['单词', '释义', '例句', '来源', '添加时间']);
  vault.englishNotes.forEach(n => rows.push([n.word, n.meaning, n.example, n.source, new Date(n.addedAt).toLocaleDateString('zh-CN')]));
  rows.push([]);
  rows.push(['=== 理论框架 ===']);
  rows.push(['标题', '类别', '概要', '来源', '添加时间']);
  const catMap: Record<string, string> = { game_theory: '博弈论', psychology: '心理学', logic: '逻辑学' };
  vault.theoryFrames.forEach(f => rows.push([f.title, catMap[f.category] || f.category, f.summary, f.source, new Date(f.addedAt).toLocaleDateString('zh-CN')]));
  rows.push([]);
  rows.push(['=== 写作技巧 ===']);
  rows.push(['标题', '类别', '内容', '来源', '添加时间']);
  vault.writingSkills.forEach(s => rows.push([s.title, s.category, s.content, s.source, new Date(s.addedAt).toLocaleDateString('zh-CN')]));
  rows.push([]);
  rows.push(['=== 审美要点 ===']);
  rows.push(['标题', '类别', '内容', '来源', '添加时间']);
  vault.aestheticTips.forEach(t => rows.push([t.title, t.category, t.content, t.source, new Date(t.addedAt).toLocaleDateString('zh-CN')]));
  downloadFile(toCsvString(rows), '资料管理总汇.csv', 'text/csv;charset=utf-8');
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

export async function exportEnglishNotesToWord(notes: KnowledgeVault['englishNotes']) {
  const sections = [
    { heading: '英语笔记本', items: notes.map(n => n.word + ' - ' + n.meaning + (n.example ? ('\n例句: ' + n.example) : '')) }
  ];
  const blob = await exportWord('英语笔记本', sections);
  downloadBinary(blob, '英语笔记本.docx');
}

export async function exportAllToWord(vault: KnowledgeVault) {
  const sections = [
    { heading: '英语笔记本', items: vault.englishNotes.map(n => n.word + ' - ' + n.meaning + (n.example ? ('\n例句: ' + n.example) : '')) },
    { heading: '理论框架', items: vault.theoryFrames.map(f => f.title + ' [' + f.category + ']\n' + f.summary) },
    { heading: '写作技巧', items: vault.writingSkills.map(s => s.title + ' [' + s.category + ']\n' + s.content) },
    { heading: '审美要点', items: vault.aestheticTips.map(t => t.title + ' [' + t.category + ']\n' + t.content) }
  ];
  const blob = await exportWord('资料管理总汇', sections);
  downloadBinary(blob, '资料管理总汇.docx');
}
