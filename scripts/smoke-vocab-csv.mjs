/**
 * Quick smoke checks for vocab CSV helpers (run: node scripts/smoke-vocab-csv.mjs)
 * Mirrors escape/BOM logic used in src/utils/vocabCsvExport.ts
 */
function escapeCsvCell(value) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildVocabCsv(rows) {
  const headers = [
    'word',
    'type',
    'translation',
    'phonetic',
    'pos',
    'related_phrase',
    'example_sentences_en',
    'example_sentences_zh',
    'repetitions',
    'next_review_date',
    'due_today',
  ];
  const lines = rows.map((cells) => cells.map((c) => escapeCsvCell(String(c ?? ''))).join(','));
  return [headers.join(','), ...lines].join('\r\n');
}

const body = buildVocabCsv([
  ['leverage', '单词 (Word)', '杠杆', 'ˈlevərɪdʒ', 'n.', 'leverage a deal', 'They leveraged the asset.', '他们撬动了这笔资产。', '3', '2026-07-20T00:00:00.000Z', 'yes'],
  ['hello, world', '短语 (Phrase)', '你好 "测试"', '', 'phrase', '', '', '', '0', '', 'no'],
]);
const withBom = `\uFEFF${body}`;

const checks = [
  ['bom', withBom.charCodeAt(0) === 0xfeff],
  ['headers', body.startsWith('word,type,translation,phonetic,pos,related_phrase,example_sentences_en,example_sentences_zh,repetitions,next_review_date,due_today')],
  ['escaped_comma', body.includes('"hello, world"')],
  ['escaped_quote', body.includes('"你好 ""测试"""')],
  ['related_phrase_column', body.includes('leverage a deal')],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}
process.exit(failed === 0 ? 0 : 1);
