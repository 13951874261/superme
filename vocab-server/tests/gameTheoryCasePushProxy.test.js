const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const dsl = fs.readFileSync(
  path.join(__dirname, '../../yml/Game_Theory_Case_Generator.yml'),
  'utf8'
);

assert.ok(
  /require\(['"]\.\/services\/gameTheoryCasePushService['"]\)/.test(server),
  'server must require gameTheoryCasePushService'
);
assert.ok(
  /initGameTheoryCasePushTables\(db\)/.test(server),
  'server must initialize game_theory_cases on startup'
);
assert.ok(
  /app\.get\(['"]\/api\/game-theory\/cases\/push['"]/.test(server),
  'server must expose GET /api/game-theory/cases/push'
);
assert.ok(
  /getCasePush\(/.test(server),
  'push route must call getCasePush'
);
assert.ok(
  /variable: existing_cases/.test(dsl),
  'Dify DSL must declare existing_cases for database catalog dedupe'
);
assert.ok(
  /数据库已存案例/.test(dsl),
  'Dify prompt must require avoiding stored database cases'
);

console.log('gameTheoryCasePushProxy.test.js passed');
