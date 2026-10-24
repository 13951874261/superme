const assert = require('assert');
const fs = require('fs');
const path = require('path');

const api = fs.readFileSync(path.join(__dirname, '../../src/services/difyAPI.ts'), 'utf8');
const moduleSource = fs.readFileSync(
  path.join(__dirname, '../../src/components/modules/GameTheoryModule.tsx'),
  'utf8'
);

assert.ok(
  /export async function pushGameTheoryCase/.test(api),
  'difyAPI must export pushGameTheoryCase'
);
assert.ok(
  /\/api\/game-theory\/cases\/push/.test(api),
  'difyAPI must call GET /api/game-theory/cases/push'
);
assert.ok(
  /pushGameTheoryCase\(/.test(moduleSource),
  'GameTheoryModule must call pushGameTheoryCase'
);
assert.ok(
  /换一条/.test(moduleSource),
  'cases panel must expose a 换一条 action'
);

console.log('gameTheoryCasePushFrontend.test.js passed');
