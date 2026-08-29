const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const helper = fs.readFileSync(path.join(root, 'src/utils/profileHelper.ts'), 'utf8');
assert.match(helper, /function appendUserProfileFactor|export function appendUserProfileFactor/);
assert.match(helper, /ingestUserMemory|profileDelta/, '增量必须走 ingest dedupe');
// Ensure appendUserProfileFactor body calls ingestUserMemory
const fnMatch = helper.match(/export function appendUserProfileFactor\([\s\S]*?\n\}/);
assert.ok(fnMatch, '找不到 appendUserProfileFactor 函数体');
assert.match(fnMatch[0], /ingestUserMemory/, 'appendUserProfileFactor 必须调用 ingestUserMemory');
assert.match(fnMatch[0], /profileDelta/, 'appendUserProfileFactor 必须传 profileDelta');

const componentFiles = [
  'src/components/SummaryArea.tsx',
  'src/components/modules/WeeklyChatModule.tsx',
  'src/components/modules/BiweeklyReviewModal.tsx',
];
for (const rel of componentFiles) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  assert.match(src, /ingestUserMemory\s*\(/, `${rel} 必须调用 ingestUserMemory`);
  assert.match(src, /profileDelta\s*:/, `${rel} 必须在 ingest 中传 profileDelta`);
  assert.doesNotMatch(src, /appendUserProfileFactor\s*\(/, `${rel} 不应再单独调用 appendUserProfileFactor`);
}

console.log('OK profile append freshness contract');
