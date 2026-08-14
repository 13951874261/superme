import assert from 'node:assert/strict';
import test from 'node:test';
import type { VocabEntry } from '../services/vocabAPI';
import { buildVocabCsv, toVocabPresentation } from './vocabCsvExport';

const CSV_HEADERS = [
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

function parseCsvRow(line: string): string[] {
  return line.split(',');
}

function makeEntry(overrides: Partial<VocabEntry> = {}): VocabEntry {
  return {
    id: '1',
    word: 'abandon',
    dict_type: 'en_zh_bidirectional',
    category: 'business',
    payload: {},
    added_at: 0,
    repetitions: 0,
    ease_factor: 2.5,
    interval_days: 1,
    next_review_date: 0,
    last_review_date: null,
    review_history: [],
    ...overrides,
  };
}

test('单词词条应将主词、首条例句和关联短语拆到独立字段', () => {
  const entry = makeEntry({
    payload: {
      translation_main: '放弃',
      phonetic: 'əˈbændən',
      pos: 'v.',
      example_sentences: [
        { en: 'He abandoned the plan.', zh: '他放弃了计划。' },
        { en: 'They abandoned ship.', zh: '他们弃船了。' },
      ],
      collocations: ['abandon ship'],
    },
  });

  const row = toVocabPresentation(entry);

  assert.equal(row.headword, 'abandon');
  assert.equal(row.itemType, '单词 (Word)');
  assert.equal(row.translation, '放弃');
  assert.equal(row.phonetic, 'əˈbændən');
  assert.equal(row.pos, 'v.');
  assert.equal(row.primaryExampleEn, 'He abandoned the plan.');
  assert.equal(row.primaryExampleZh, '他放弃了计划。');
  assert.equal(row.relatedPhrase, 'abandon ship');
});

test('短语词条主体留在 headword，relatedPhrase 必须为空', () => {
  const entry = makeEntry({
    word: 'give up',
    payload: {
      is_phrase: true,
      translation_main: '放弃',
      example_sentences: [{ en: 'Do not give up.', zh: '不要放弃。' }],
      collocations: ['should not leak'],
    },
  });

  const row = toVocabPresentation(entry);

  assert.equal(row.headword, 'give up');
  assert.equal(row.itemType, '短语 (Phrase)');
  assert.equal(row.translation, '放弃');
  assert.equal(row.primaryExampleEn, 'Do not give up.');
  assert.equal(row.primaryExampleZh, '不要放弃。');
  assert.equal(row.relatedPhrase, '');
});

test('句子词条应保留整句主体并分离翻译，不写入关联短语', () => {
  const entry = makeEntry({
    word: 'He abandoned the plan after the meeting ended.',
    payload: {
      is_sentence: true,
      translation_main: '会议结束后他放弃了计划。',
    },
  });

  const row = toVocabPresentation(entry);

  assert.equal(row.headword, 'He abandoned the plan after the meeting ended.');
  assert.equal(row.itemType, '句子 (Sentence)');
  assert.equal(row.translation, '会议结束后他放弃了计划。');
  assert.equal(row.primaryExampleEn, '');
  assert.equal(row.primaryExampleZh, '');
  assert.equal(row.relatedPhrase, '');
});

test('单词导出时应将主词、首条例句、短语拆分到独立列', () => {
  const csv = buildVocabCsv([
    makeEntry({
      payload: {
        translation_main: '放弃',
        phonetic: 'əˈbændən',
        pos: 'v.',
        example_sentences: [
          { en: 'He abandoned the plan.', zh: '他放弃了计划。' },
          { en: 'They abandoned ship.', zh: '他们弃船了。' },
        ],
        collocations: ['abandon ship'],
      },
    }),
  ]);
  const [header, data] = csv.split('\r\n');
  const headers = parseCsvRow(header);
  const cells = parseCsvRow(data);

  assert.deepEqual(headers, CSV_HEADERS);
  assert.equal(cells[headers.indexOf('word')], 'abandon');
  assert.equal(cells[headers.indexOf('type')], '单词 (Word)');
  assert.equal(cells[headers.indexOf('translation')], '放弃');
  assert.equal(cells[headers.indexOf('related_phrase')], 'abandon ship');
  assert.equal(cells[headers.indexOf('example_sentences_en')], 'He abandoned the plan.');
  assert.equal(cells[headers.indexOf('example_sentences_zh')], '他放弃了计划。');
  assert.equal(data.includes('They abandoned ship.'), false);
});

test('短语导出时不应误塞入 related_phrase 列', () => {
  const csv = buildVocabCsv([
    makeEntry({
      word: 'give up',
      payload: {
        is_phrase: true,
        translation_main: '放弃',
        example_sentences: [{ en: 'Do not give up.', zh: '不要放弃。' }],
        collocations: ['should not leak'],
      },
    }),
  ]);
  const [header, data] = csv.split('\r\n');
  const headers = parseCsvRow(header);
  const cells = parseCsvRow(data);

  assert.equal(cells[headers.indexOf('word')], 'give up');
  assert.equal(cells[headers.indexOf('type')], '短语 (Phrase)');
  assert.equal(cells[headers.indexOf('related_phrase')], '');
  assert.equal(cells[headers.indexOf('example_sentences_en')], 'Do not give up.');
});

test('句子导出时应保留句子主体并分离例句翻译', () => {
  const csv = buildVocabCsv([
    makeEntry({
      word: 'He abandoned the plan after the meeting ended.',
      payload: {
        is_sentence: true,
        translation_main: '会议结束后他放弃了计划。',
      },
    }),
  ]);
  const [header, data] = csv.split('\r\n');
  const headers = parseCsvRow(header);
  const cells = parseCsvRow(data);

  assert.equal(cells[headers.indexOf('word')], 'He abandoned the plan after the meeting ended.');
  assert.equal(cells[headers.indexOf('type')], '句子 (Sentence)');
  assert.equal(cells[headers.indexOf('translation')], '会议结束后他放弃了计划。');
  assert.equal(cells[headers.indexOf('related_phrase')], '');
  assert.equal(cells[headers.indexOf('example_sentences_en')], '');
  assert.equal(cells[headers.indexOf('example_sentences_zh')], '');
});
