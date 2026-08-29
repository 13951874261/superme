/**
 * 运行：node vocab-server/tests/careerPathProfileSave.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const serverSrc = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

assert.match(serverSrc, /careerPath|career_path/, 'profile/save 必须处理 careerPath');
assert.match(
  serverSrc,
  /memory_layers[\s\S]{0,200}career_path|career_path[\s\S]{0,200}memory_layers/,
  'career 必须写入 memory_layers.career_path',
);
console.log('OK careerPath profile save contract (static)');
