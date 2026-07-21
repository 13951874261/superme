/**
 * 生词本 CSV 导出（纯前端 Blob + UTF-8 BOM，便于 Excel 打开中文）
 */
import type { VocabEntry } from '../services/vocabAPI';
import { getAllWords } from '../services/vocabAPI';

export type VocabExportScope = 'all' | 'current_tab' | 'due_today';
export type VocabTabCategory = 'business' | 'general';

export function getWordTranslation(word: VocabEntry): string {
  const payload = word.payload || {};
  if (typeof payload.definition === 'string' && payload.definition.trim()) return payload.definition;
  if (typeof payload.translation_main === 'string' && payload.translation_main.trim()) return payload.translation_main;
  if (Array.isArray(payload.definitions_en) && payload.definitions_en[0]) {
    return String(payload.definitions_en[0]);
  }
  if (typeof payload.meaning === 'string' && payload.meaning.trim()) return payload.meaning;
  return '';
}

export function isDueToday(word: VocabEntry, now = Date.now()): boolean {
  return word.repetitions !== 999 && word.next_review_date <= now;
}

export function matchesVocabTab(word: VocabEntry, tab: VocabTabCategory): boolean {
  return word.category === tab || (!word.category && tab === 'business');
}

export function filterWordsForExport(
  words: VocabEntry[],
  scope: VocabExportScope,
  currentTab: VocabTabCategory = 'business'
): VocabEntry[] {
  const now = Date.now();
  switch (scope) {
    case 'all':
      return words;
    case 'current_tab':
      return words.filter((w) => matchesVocabTab(w, currentTab));
    case 'due_today':
      return words.filter((w) => isDueToday(w, now));
    default:
      return words;
  }
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** 表头与规格列一致：word / translation / phonetic / pos / 复习字段 */
export function buildVocabCsv(words: VocabEntry[]): string {
  const headers = [
    'word',
    'translation',
    'phonetic',
    'pos',
    'repetitions',
    'next_review_date',
    'due_today',
  ];
  const now = Date.now();
  const rows = words.map((w) => {
    const payload = w.payload || {};
    const cells = [
      w.word || '',
      getWordTranslation(w),
      String(payload.phonetic || ''),
      String(payload.pos || ''),
      String(w.repetitions ?? ''),
      w.next_review_date ? new Date(w.next_review_date).toISOString() : '',
      isDueToday(w, now) ? 'yes' : 'no',
    ];
    return cells.map((c) => escapeCsvCell(c)).join(',');
  });
  return [headers.join(','), ...rows].join('\r\n');
}

export function downloadCsvText(csvBody: string, filenamePrefix = 'vocab-vocab'): void {
  const csv = `\uFEFF${csvBody}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  link.href = url;
  link.download = `${filenamePrefix}-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportVocabCsv(options: {
  scope: VocabExportScope;
  currentTab?: VocabTabCategory;
  words?: VocabEntry[];
  filenamePrefix?: string;
}): Promise<number> {
  const list = options.words ?? (await getAllWords());
  const filtered = filterWordsForExport(
    list,
    options.scope,
    options.currentTab ?? 'business'
  );
  downloadCsvText(buildVocabCsv(filtered), options.filenamePrefix ?? 'vocab-export');
  return filtered.length;
}
