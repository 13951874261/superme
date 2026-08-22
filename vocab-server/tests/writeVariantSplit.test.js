/**
 * FV-TAB-WR：顶栏写作=中文文治，英语纵深书面=英文商务写作。
 * 运行：node vocab-server/tests/writeVariantSplit.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const writeModule = fs.readFileSync(path.join(root, 'src/components/modules/WriteModule.tsx'), 'utf8');
const english = fs.readFileSync(path.join(root, 'src/components/modules/EnglishModule.tsx'), 'utf8');
const writeTab = fs.readFileSync(path.join(root, 'src/components/modules/english/tabs/WriteTab.tsx'), 'utf8');

assert.match(writeModule, /variant=["']zh["']/, '顶栏写作必须走中文文治');
assert.match(english, /variant=["']en["']/, '纵深书面必须走英文写作');
assert.match(writeTab, /writeModulesFor/, 'WriteTab 必须按 variant 取模块');
assert.match(writeTab, /variant === 'zh'/, '中文路径必须显式分支');
assert.doesNotMatch(
  writeTab,
  /降级到通用评测/,
  '中文文治失败不得降级到英语审阅',
);

console.log('OK writeVariantSplit frontend contract');
