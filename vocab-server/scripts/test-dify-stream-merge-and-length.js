#!/usr/bin/env node
/**
 * D: 流式合并不去重 / duration 软上限
 */
const assert = require('assert');

const {
  mergeStreamAnswer,
  estimateEnglishWordCount,
  softWordLimitForDuration,
  isOverSoftWordLimit,
  preferNonDuplicatingMerge,
} = require('../services/difyStreamMerge');

function testMergePrefersLongerPrefixNotConcat() {
  const part = 'Hello world. This is a meeting script about pricing.';
  const full = `${part} And more closing remarks.`;
  assert.strictEqual(mergeStreamAnswer(part, full), full);
  assert.strictEqual(mergeStreamAnswer(full, part), full);
  assert.strictEqual(mergeStreamAnswer(full, full), full);
}

function testMergeDoesNotDoubleAppendNearDuplicateArticles() {
  const a = [
    'Margaret Vance: Let us get the ball rolling by outlining the core parameters.',
    'Arthur Pendelton: Thank you, Margaret. Apex Retail needs a stable supply.',
    'Sophia Chen: Twenty-nine dollars per unit is our opening offer.',
  ].join('\n\n');
  // 流式结束后 workflow_finished 再给一份「几乎相同但多了空行」的全文
  const b = `${a}\n\n`;
  const merged = mergeStreamAnswer(a, b);
  assert.ok(!merged.includes(`${a}${a}`), '不应把近似全文再拼一次');
  assert.ok(merged.includes('Margaret Vance'), '应保留正文');
  // 字数不应接近翻倍
  assert.ok(
    estimateEnglishWordCount(merged) < estimateEnglishWordCount(a) * 1.5,
    `合并后词数异常: ${estimateEnglishWordCount(merged)} vs base ${estimateEnglishWordCount(a)}`,
  );
}

function testMergeDistinctChunksStillAppend() {
  const a = 'First paragraph about logistics delays.';
  const b = 'Second paragraph about air freight options.';
  assert.strictEqual(mergeStreamAnswer(a, b), a + b);
}

function testSoftLimitForOneMinute() {
  assert.ok(softWordLimitForDuration(1) <= 900);
  assert.ok(softWordLimitForDuration(1) >= 200);
  assert.ok(softWordLimitForDuration(15) > softWordLimitForDuration(1));
  const huge = 'word '.repeat(5000);
  assert.strictEqual(isOverSoftWordLimit(huge, 1), true);
  assert.strictEqual(isOverSoftWordLimit('Short meeting script with few words.', 1), false);
}

function testPreferNonDuplicatingMergeHelper() {
  const base = 'Alpha scene one. '.repeat(40);
  const dup = `${base}\n\n${base}`;
  const preferred = preferNonDuplicatingMerge(base, dup);
  assert.ok(estimateEnglishWordCount(preferred) <= estimateEnglishWordCount(base) * 1.2);
}

function main() {
  testMergePrefersLongerPrefixNotConcat();
  console.log('PASS merge prefix/equal');
  testMergeDoesNotDoubleAppendNearDuplicateArticles();
  console.log('PASS no near-duplicate concat');
  testMergeDistinctChunksStillAppend();
  console.log('PASS distinct chunks append');
  testSoftLimitForOneMinute();
  console.log('PASS soft word limit');
  testPreferNonDuplicatingMergeHelper();
  console.log('PASS preferNonDuplicatingMerge');
  console.log('OK dify-stream-merge-and-length');
}

main();
