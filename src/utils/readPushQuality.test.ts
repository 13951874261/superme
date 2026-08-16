import assert from 'node:assert/strict';
import test from 'node:test';
import {
  READ_PUSH_MIN_CHARS,
  countReadMaterialChars,
  evaluateReadPushQuality,
} from './readPushQuality';

test('READ_PUSH_MIN_CHARS 为 1500', () => {
  assert.equal(READ_PUSH_MIN_CHARS, 1500);
});

test('countReadMaterialChars 去空白计长', () => {
  assert.equal(countReadMaterialChars('ab cd\n'), 4);
});

test('evaluateReadPushQuality：1500 为 ok，1499 为 below_standard', () => {
  assert.equal(evaluateReadPushQuality('字'.repeat(1500)).quality, 'ok');
  assert.equal(evaluateReadPushQuality('字'.repeat(1499)).quality, 'below_standard');
  assert.equal(evaluateReadPushQuality('字'.repeat(1499)).charCount, 1499);
});
