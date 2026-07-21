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
    'translation',
    'phonetic',
    'pos',
    'repetitions',
    'next_review_date',
    'due_today',
  ];
  const lines = rows.map((cells) => cells.map((c) => escapeCsvCell(String(c ?? ''))).join(','));
  return [headers.join(','), ...lines].join('\r\n');
}

const body = buildVocabCsv([
  ['leverage', '杠杆', 'ˈlevərɪdʒ', 'n.', '3', '2026-07-20T00:00:00.000Z', 'yes'],
  ['hello, world', '你好 "测试"', '', '', '0', '', 'no'],
]);
const withBom = `\uFEFF${body}`;

const checks = [
  ['bom', withBom.charCodeAt(0) === 0xfeff],
  ['headers', body.startsWith('word,translation,phonetic,pos,repetitions,next_review_date,due_today')],
  ['escaped_comma', body.includes('"hello, world"')],
  ['escaped_quote', body.includes('"你好 ""测试"""')],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}
process.exit(failed === 0 ? 0 : 1);
