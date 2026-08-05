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

export function getItemType(word: VocabEntry): string {
  const payload = word.payload || {};
  if (payload.is_sentence === true) return '句子 (Sentence)';
  if (payload.is_phrase === true) return '短语 (Phrase)';

  const text = (word.word || '').trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount > 4) return '句子 (Sentence)';
  if (wordCount > 1) return '短语 (Phrase)';
  return '单词 (Word)';
}

/** 按行对齐提取例句中/英；缺一侧时补空串，避免错位 */
export function getExampleSentences(word: VocabEntry): { en: string; zh: string } {
  const payload = word.payload || {};
  const sources = [
    payload.example_sentences,
    payload.scenarios,
    payload.business_examples,
    payload.examples,
  ];
  const examples = sources.find((s) => Array.isArray(s) && s.length > 0) || [];
  if (!Array.isArray(examples)) return { en: '', zh: '' };

  const enList: string[] = [];
  const zhList: string[] = [];

  examples.forEach((ex) => {
    if (typeof ex === 'string') {
      const en = ex.trim();
      if (!en) return;
      enList.push(en);
      zhList.push('');
      return;
    }
    if (typeof ex === 'object' && ex !== null) {
      const en = String(
        (ex as any).en || (ex as any).example_en || (ex as any).sentence || (ex as any).example || ''
      ).trim();
      const zh = String(
        (ex as any).zh || (ex as any).translation || (ex as any).example_zh || ''
      ).trim();
      if (!en && !zh) return;
      enList.push(en);
      zhList.push(zh);
    }
  });

  return { en: enList.join('\n'), zh: zhList.join('\n') };
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** 表头：word / type / translation / phonetic / pos / 例句中英 / 复习字段 */
export function buildVocabCsv(words: VocabEntry[]): string {
  const headers = [
    'word',
    'type',
    'translation',
    'phonetic',
    'pos',
    'example_sentences_en',
    'example_sentences_zh',
    'repetitions',
    'next_review_date',
    'due_today',
  ];
  const now = Date.now();
  const rows = words.map((w) => {
    const payload = w.payload || {};
    const examples = getExampleSentences(w);
    const cells = [
      w.word || '',
      getItemType(w),
      getWordTranslation(w),
      String(payload.phonetic || ''),
      String(payload.pos || ''),
      examples.en,
      examples.zh,
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
