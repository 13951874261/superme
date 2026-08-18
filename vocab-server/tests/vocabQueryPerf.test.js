const assert = require('assert');
const fs = require('fs');
const path = require('path');

const serverSrc = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

// 1. 验证 /api/vocab/list 路由块
const listRouteMatch = serverSrc.match(/app\.get\(['"]\/api\/vocab\/list['"],\s*\(req,\s*res\)\s*=>\s*\{([\s\S]*?)\n\}\);/);
assert(listRouteMatch, 'Found /api/vocab/list route');
const listRouteBody = listRouteMatch[1];

assert.match(
  listRouteBody,
  /req\.query\.light[\s\S]*?400[\s\S]*?light=0 is deprecated/,
  'list route rejects light=0 with 400'
);
assert.match(
  listRouteBody,
  /SELECT \$\{LIGHT_SELECT\}[\s\S]*?FROM vocabulary[\s\S]*?LIMIT \? OFFSET \?/,
  'list route enforces parameterized pagination'
);
assert.doesNotMatch(
  listRouteBody,
  /SELECT \* FROM vocabulary/,
  'list route does NOT have SELECT *'
);

// 2. 验证 /api/vocab/review 路由块
const reviewRouteMatch = serverSrc.match(/app\.get\(['"]\/api\/vocab\/review['"],\s*\(req,\s*res\)\s*=>\s*\{([\s\S]*?)\n\}\);/);
assert(reviewRouteMatch, 'Found /api/vocab/review route');
const reviewRouteBody = reviewRouteMatch[1];

assert.match(
  reviewRouteBody,
  /req\.query\.light[\s\S]*?400[\s\S]*?light=0 is deprecated/,
  'review route rejects light=0 with 400'
);
assert.match(
  reviewRouteBody,
  /SELECT \$\{LIGHT_SELECT\}[\s\S]*?FROM vocabulary[\s\S]*?WHERE next_review_date <= \?[\s\S]*?LIMIT \? OFFSET \?/,
  'review route enforces parameterized pagination'
);
assert.doesNotMatch(
  reviewRouteBody,
  /SELECT \* FROM vocabulary/,
  'review route does NOT have SELECT *'
);

// 3. 验证 /api/vocab/lookup 批量点查路由
const lookupRouteMatch = serverSrc.match(/app\.post\(['"]\/api\/vocab\/lookup['"],\s*\(req,\s*res\)\s*=>\s*\{([\s\S]*?)\n\}\);/);
assert(lookupRouteMatch, 'Found /api/vocab/lookup route');
const lookupRouteBody = lookupRouteMatch[1];

assert.match(
  lookupRouteBody,
  /WHERE word IN \(\$\{placeholders\}\) COLLATE NOCASE/,
  'lookup route exists with parameterized NOCASE IN query'
);

// 4. 验证 /api/dify/dict-coverage 路由不含 SELECT response_payload，使用 GROUP BY level
const coverageRouteMatch = serverSrc.match(/app\.get\(['"]\/api\/dify\/dict-coverage['"],\s*\(req,\s*res\)\s*=>\s*\{([\s\S]*?)\n\}\);/);
assert(coverageRouteMatch, 'Found /api/dify/dict-coverage route');
const coverageRouteBody = coverageRouteMatch[1];

assert.match(
  coverageRouteBody,
  /SELECT level,\s*COUNT\(\*\)\s*as count FROM dict_query_log WHERE is_success = 1 GROUP BY level/,
  'coverage route uses GROUP BY level'
);
assert.doesNotMatch(
  coverageRouteBody,
  /SELECT response_payload FROM dict_query_log/,
  'coverage route does NOT select response_payload'
);

// 5. 验证 dict_query_log 表新增 level 列迁移与索引
assert.match(serverSrc, /ALTER TABLE dict_query_log ADD COLUMN level TEXT/, 'dict_query_log level column migration');
assert.match(serverSrc, /CREATE INDEX IF NOT EXISTS idx_dict_log_level ON dict_query_log\(is_success, level\)/, 'dict_query_log level index');

// 6. 验证回填脚本存在
const backfillScriptPath = path.join(__dirname, '../scripts/backfill-dict-level.js');
assert(fs.existsSync(backfillScriptPath), 'backfill-dict-level.js exists');

console.log('vocabQueryPerf.test.js contract checks passed successfully.');
