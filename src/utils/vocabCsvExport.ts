/**
 * 生词本 CSV 导出（纯前端 Blob + UTF-8 BOM，以便 Excel 打开中文）
 */
import type { VocabEntry } from '../services/vocabAPI';
import { getAllWords, queryDictionaryWithCache, updateWordPayload } from '../services/vocabAPI';

export type VocabExportScope = 'all' | 'current_tab' | 'due_today' | 'words_only' | 'phrases_only' | 'sentences_only';
export type VocabTabCategory = 'business' | 'general';

export function getWordTranslation(word: VocabEntry): string {
  const payload = word.payload || {};
  if (typeof payload.definition === 'string' && payload.definition.trim()) return payload.definition;
  if (typeof payload.translation_main === 'string' && payload.translation_main.trim()) return payload.translation_main;
  if (Array.isArray(payload.definitions_en) && payload.definitions_en[0]) {
    return String(payload.definitions_en[0]);
  }
  if (typeof payload.meaning === 'string' && payload.meaning.trim()) return payload.meaning;
  if (typeof payload.meaning_zh === 'string' && payload.meaning_zh.trim()) return payload.meaning_zh;
  if (typeof payload.translation === 'string' && payload.translation.trim()) return payload.translation;
  if (typeof payload.explain === 'string' && payload.explain.trim()) return payload.explain;
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
    case 'words_only':
      return words.filter((w) => getItemType(w) === '单词 (Word)');
    case 'phrases_only':
      return words.filter((w) => getItemType(w) === '短语 (Phrase)');
    case 'sentences_only':
      return words.filter((w) => getItemType(w) === '句子 (Sentence)');
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

/** 本地字段归一化 Fallback，修正部分因字段键名不一致导致的空白以及清理占位符 */
export function normalizeVocabEntry(word: VocabEntry): VocabEntry {
  const payload = { ...(word.payload || {}) };

  // 1. pos (Part of Speech)
  let pos = (payload.pos || '').trim();
  if (!pos) {
    pos = (payload.partOfSpeech || payload.part_of_speech || '').trim();
  }
  // 清理常见的占位符文本
  if (pos.includes('词性(如') || pos.includes('??') || pos.includes('待复习') || pos.includes('待处理')) {
    pos = '';
  }

  // 2. phonetic (音标)
  let phonetic = (payload.phonetic || '').trim();
  if (!phonetic) {
    phonetic = (payload.phonetic_symbol || payload.symbol || payload.pronunciation || '').trim();
  }
  // 清理常见的占位符文本
  if (phonetic.includes('音标（') || phonetic.includes('??') || phonetic.includes('待复习') || phonetic.includes('待处理')) {
    phonetic = '';
  }

  // 3. translation (释义)
  let meaning = getWordTranslation(word).trim();
  if (meaning.includes('待复习补充') || meaning.includes('简明扼要') || meaning.includes('待处理') || meaning.includes('英英词典')) {
    meaning = '';
  }

  // 根据项目规则：如果是句子或短语，且词性和音标为空，自动赋默认值以规避空白
  const itemType = getItemType(word);
  if (itemType === '句子 (Sentence)') {
    if (!pos) pos = 'sentence';
    if (!phonetic) phonetic = '/';
  } else if (itemType === '短语 (Phrase)') {
    if (!pos) pos = 'phrase';
    if (!phonetic) phonetic = '/';
  }

  const normalizedPayload = {
    ...payload,
    pos,
    phonetic,
    meaning,
    translation_main: meaning,
  };

  return {
    ...word,
    payload: normalizedPayload,
  };
}

/** 按行对齐提取例句中 / 英；缺一侧时补空串，避免错位，并过滤掉测试占位符 */
export function getExampleSentences(word: VocabEntry): { en: string; zh: string } {
  const payload = word.payload || {};
  const sources = [
    payload.example_sentences,
    payload.scenarios,
    payload.business_examples,
    payload.examples,
    payload.example,
  ];
  const examples = sources.find((s) => Array.isArray(s) && s.length > 0) || [];
  if (!Array.isArray(examples)) return { en: '', zh: '' };

  const enList: string[] = [];
  const zhList: string[] = [];

  examples.forEach((ex) => {
    if (typeof ex === 'string') {
      const en = ex.trim();
      if (!en || en.includes('例句1(英文)') || en.includes('例句2') || en.includes('中文翻译') || en.includes('示例')) return;
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
      if (en.includes('例句1(英文)') || en.includes('例句2') || zh.includes('中文翻译') || en.includes('示例')) return;
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

  // 1. 本地归一化 & 检测哪些词条仍有空白关键信息
  const normalizedList: VocabEntry[] = [];
  const wordsToEnrich: VocabEntry[] = [];

  for (const entry of filtered) {
    const norm = normalizeVocabEntry(entry);
    normalizedList.push(norm);

    // 只有“单词”或“短语”才进行在线补齐
    const type = getItemType(norm);
    if (type === '单词 (Word)' || type === '短语 (Phrase)') {
      const payload = norm.payload || {};
      const examples = getExampleSentences(norm);
      
      const isTranslationBlank = !payload.meaning || !payload.meaning.trim();
      const isPosBlank = !payload.pos || !payload.pos.trim();
      const isPhoneticBlank = type === '单词 (Word)' && (!payload.phonetic || !payload.phonetic.trim());
      const isExamplesBlank = !examples.en || !examples.en.trim();

      if (isTranslationBlank || isPosBlank || isPhoneticBlank || isExamplesBlank) {
        wordsToEnrich.push(entry);
      }
    }
  }

  // 2. 如果存在空白词条，且空白词条数量不超过 10 个，则动态进行在线 Dify 词典补齐并入库
  if (wordsToEnrich.length > 0) {
    const limit = 10;
    const targets = wordsToEnrich.slice(0, limit);
    
    try {
      const { showToast } = await import('../components/Toast');
      if (wordsToEnrich.length > limit) {
        showToast(`检测到 ${wordsToEnrich.length} 个词条有空白列，将自动在线补全前 ${limit} 个...`, 'info');
      } else {
        showToast(`正在自动在线补齐 ${wordsToEnrich.length} 个词条的空白信息...`, 'info');
      }
    } catch (e) {}

    // 并发限制器（最大并发 3）
    const concurrencyLimit = 3;
    const chunks: VocabEntry[][] = [];
    for (let i = 0; i < targets.length; i += concurrencyLimit) {
      chunks.push(targets.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (entry) => {
          try {
            const dictType = entry.dict_type || 'en_zh_bidirectional';
            // 查询词典
            const res = await queryDictionaryWithCache({
              word: entry.word,
              dictType,
            });

            if (res && res.ok && res.payload) {
              const dp = res.payload as any;
              
              let meaning = dp.translation_main || '';
              if (!meaning && Array.isArray(dp.definitions_en)) {
                meaning = dp.definitions_en.join('; ');
              }
              if (!meaning) {
                meaning = dp.meaning || dp.definition || '';
              }

              let pos = dp.pos || dp.partOfSpeech || '';
              let phonetic = dp.phonetic || '';
              
              let examplesList: any[] = [];
              if (Array.isArray(dp.example_sentences)) {
                examplesList = dp.example_sentences;
              } else if (Array.isArray(dp.examples)) {
                examplesList = dp.examples;
              }

              // 构建新的 payload
              const newPayload = {
                ...entry.payload,
                word: entry.word,
                phonetic: phonetic.trim(),
                pos: pos.trim(),
                meaning: meaning.trim(),
                translation_main: meaning.trim(),
                example_sentences: examplesList,
                source: '导出自动补齐',
              };

              // 更新本地对象和数据库
              await updateWordPayload(entry.id, newPayload);
              
              // 找到并更新 normalizedList 中对应的元素
              const idx = normalizedList.findIndex((n) => n.id === entry.id);
              if (idx !== -1) {
                normalizedList[idx] = normalizeVocabEntry({
                  ...normalizedList[idx],
                  payload: newPayload,
                });
              }
            }
          } catch (err) {
            console.error(`[Export Auto-Complete] Failed to enrich word "${entry.word}":`, err);
          }
        })
      );
    }
    
    try {
      const { showToast } = await import('../components/Toast');
      showToast('生词本空白列信息已补齐完毕，正在启动下载。', 'success');
    } catch (e) {}
  }

  downloadCsvText(buildVocabCsv(normalizedList), options.filenamePrefix ?? 'vocab-export');
  return normalizedList.length;
}
