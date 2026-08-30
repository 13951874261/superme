/**
 * U7 / I6 / I8：parseVocabUserId 无 id 不回落 lzhmy；路由 require → 400。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

const fnBlock = server.slice(
  server.indexOf('function parseVocabUserId'),
  server.indexOf('function requireVocabUserId'),
);
assert.match(fnBlock, /return null;/);
assert.doesNotMatch(fnBlock, /return ['"]lzhmy['"]/);

assert.match(server, /function requireVocabUserId\(req, res\)/);
assert.match(server, /status\(400\)\.json\(\{ error: ['"]userId required['"] \}\)/);
assert.match(server, /\/api\/vocab\/stats[\s\S]{0,400}?requireVocabUserId/);
assert.match(server, /\/api\/vocab\/list[\s\S]{0,400}?requireVocabUserId/);
assert.match(server, /\/api\/vocab\/review[\s\S]{0,400}?requireVocabUserId/);
assert.match(server, /\/api\/vocab\/item\/:id[\s\S]{0,400}?requireVocabUserId/);
assert.match(server, /\/api\/vocab\/update\/:id[\s\S]{0,400}?requireVocabUserId/);
assert.match(server, /app\.delete\('\/api\/vocab\/:id'[\s\S]{0,400}?requireVocabUserId/);

// O3: dreaming/compress 读路径不用 SELECT *
assert.doesNotMatch(
  server,
  /SELECT \* FROM user_memories WHERE user_id = \?/,
);

console.log('PASS parseVocabUserIdContract');
