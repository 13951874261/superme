const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'dailyPackService.js'), 'utf8');
const fn = src.slice(src.indexOf('async function generateLongArticleForUser'), src.indexOf('module.exports'));

assert.match(fn, /theme/, 'skip 查询必须包含 theme');
assert.match(
  fn,
  /SELECT id FROM daily_extracted_articles WHERE user_id = \? AND quota_date = \? AND theme = \? AND genre = \? AND cefr_level = \? AND duration = \?/,
  'skip 维度必须是 user+date+theme+genre+cefr+duration'
);

// Old genre/cefr-only (or genre/cefr/duration without theme) must not remain as skip basis
assert.doesNotMatch(
  fn,
  /SELECT id FROM daily_extracted_articles WHERE user_id = \? AND quota_date = \? AND genre = \? AND cefr_level = \?/,
  '不得再以不含 theme 的 genre/cefr 查询作为 skip 依据'
);

console.log('✅ dailyPackLongArticleSkipThemeContract.test.js 通过');
