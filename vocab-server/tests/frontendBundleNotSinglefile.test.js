const assert = require('assert');
const fs = require('fs');
const path = require('path');

const vitePath = path.join(__dirname, '../../vite.config.ts');
const htmlPath = path.join(__dirname, '../../index.html');
const vite = fs.readFileSync(vitePath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

assert.doesNotMatch(
  vite,
  /vite-plugin-singlefile|viteSingleFile/,
  '禁止 singlefile：会把整站 JS/CSS 内联进 index.html，首屏必须下完 ~2MB 才能出画面',
);
assert.doesNotMatch(
  vite,
  /manualChunks/,
  '禁止把 react 与 motion 拆进不同 chunk：循环依赖会导致 createContext undefined，页面白屏',
);
assert.doesNotMatch(
  html,
  /fonts\.googleapis\.com/,
  'index.html 不得同步拉取 Google Fonts（国内会阻塞首屏）',
);

console.log('✅ frontendBundleNotSinglefile.test.js 通过');
