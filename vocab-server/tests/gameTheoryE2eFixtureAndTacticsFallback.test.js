/**
 * FV-TAB-GT：拦截 E2E 人性档案名；抽屉空时回退战术库注入。
 * 运行：node vocab-server/tests/gameTheoryE2eFixtureAndTacticsFallback.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const serverSrc = fs.readFileSync(path.join(root, 'vocab-server/server.js'), 'utf8');
const moduleSrc = fs.readFileSync(
  path.join(root, 'src/components/modules/GameTheoryModule.tsx'),
  'utf8'
);
const adapterSrc = fs.readFileSync(path.join(root, 'src/utils/knowledgeAdapter.ts'), 'utf8');

assert.match(
  serverSrc,
  /filterVisiblePrototypes\(rows\)/,
  'GET /api/game-theory/prototypes 必须过滤 E2E 夹具名'
);
assert.match(
  serverSrc,
  /isTestFixturePrototypeName\(name\)/,
  'POST /api/game-theory/prototypes 必须拒绝 E2E 夹具名'
);
assert.match(
  adapterSrc,
  /export function buildGameTheoryKnowledgeHint/,
  '前端必须有博弈知识提示组装函数'
);
assert.match(
  moduleSrc,
  /buildGameTheoryKnowledgeHint/,
  '博弈页必须用统一函数生成资料抽屉提示'
);
assert.match(
  moduleSrc,
  /getTactics/,
  '抽屉为空时必须读取战术库条数才能回退文案'
);

console.log('gameTheoryE2eFixtureAndTacticsFallback.test.js passed');
