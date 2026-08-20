const assert = require('assert');
const fs = require('fs');
const path = require('path');

const moduleSrc = fs.readFileSync(
  path.join(__dirname, '../../src/components/modules/GameTheoryModule.tsx'),
  'utf8'
);
const panelSrc = fs.readFileSync(
  path.join(__dirname, '../../src/components/modules/GameTheory/GameTheorySessionPanel.tsx'),
  'utf8'
);
const tableSrc = fs.readFileSync(
  path.join(__dirname, '../../src/components/modules/GameTheory/ToneCorrectionTable.tsx'),
  'utf8'
);

assert.match(tableSrc, /语气修正/, 'ToneCorrectionTable must title 语气修正');
assert.match(tableSrc, /原话/, 'table must have 原话 column');
assert.match(tableSrc, /问题/, 'table must have 问题 column');
assert.match(tableSrc, /建议说法/, 'table must have 建议说法 column');
assert.match(moduleSrc, /ToneCorrectionTable/, 'history UI must use ToneCorrectionTable');
assert.match(moduleSrc, /tone_corrections/, 'history must read tone_corrections');
assert.match(panelSrc, /ToneCorrectionTable/, 'session ReviewView must use ToneCorrectionTable');
assert.match(panelSrc, /tone_corrections/, 'session review must read tone_corrections');
assert.doesNotMatch(
  panelSrc.slice(panelSrc.indexOf('Fold title="行动建议"'), panelSrc.indexOf('Fold title="行动建议"') + 200),
  /tone_corrections/,
  'tone_corrections must not be rendered only inside strategy_guidance fold'
);

console.log('toneCorrectionsFrontend.test.js passed');
