const assert = require('assert');
const fs = require('fs');
const path = require('path');

const moduleSource = fs.readFileSync(
  path.join(__dirname, '../../src/components/modules/EntertainmentModule.tsx'),
  'utf8'
);

const analyzeStart = moduleSource.indexOf('const handleAnalyze');
assert.ok(analyzeStart >= 0, 'EntertainmentModule must define handleAnalyze');
const analyzeEnd = moduleSource.indexOf('const initDeck', analyzeStart);
const analyzeSegment = moduleSource.slice(analyzeStart, analyzeEnd > analyzeStart ? analyzeEnd : undefined);

assert.match(analyzeSegment, /\/api\/aesthetics\/analyze/, 'handleAnalyze must call /api/aesthetics/analyze');
assert.match(
  analyzeSegment,
  /ensureAestheticsResult/,
  'handleAnalyze must sanitize aesthetic verdict via ensureAestheticsResult (AE-JUD-01)'
);
assert.doesNotMatch(
  analyzeSegment,
  /toggle-right-panel/,
  'handleAnalyze must not open the English dictionary right panel'
);
assert.doesNotMatch(
  moduleSource,
  /toggle-right-panel/,
  'EntertainmentModule must not dispatch toggle-right-panel for aesthetic verdicts'
);
assert.doesNotMatch(
  moduleSource,
  /\/api\/dify\/dict-query/,
  'EntertainmentModule must not call the English translation dict-query API'
);

assert.match(
  moduleSource,
  /difyFeedback\s*&&/,
  'EntertainmentModule must render in-module aesthetic verdict when difyFeedback exists'
);
assert.match(
  moduleSource,
  /difyFeedback\.feedback/,
  'in-module verdict must display Chinese feedback text'
);
assert.match(
  moduleSource,
  /决策得分/,
  'in-module verdict must show 决策得分'
);
assert.match(
  moduleSource,
  /避坑指南与解释/,
  'in-module verdict must show 避坑指南与解释'
);

console.log('aestheticsAnalyzeFrontend.test.js passed');
