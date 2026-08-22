const assert = require('assert');
const fs = require('fs');
const path = require('path');

const moduleSource = fs.readFileSync(
  path.join(__dirname, '../../src/components/modules/EntertainmentModule.tsx'),
  'utf8'
);

assert.match(
  moduleSource,
  /getAppUserId\(\)/,
  'daily push requests must use getAppUserId'
);
assert.doesNotMatch(
  moduleSource,
  /daily-push\/regenerate[\s\S]{0,400}userId:\s*'default-user'/,
  'regenerate must not hardcode default-user'
);
assert.match(
  moduleSource,
  /换一条/,
  'daily push card must expose 换一条'
);
assert.doesNotMatch(
  moduleSource,
  /dailyPushLoading \? '\?\?\?/,
  'regenerate button must not show corrupted ??? text'
);
assert.match(
  moduleSource,
  /dailyPush\.rules/,
  'daily push card must preview practical rules'
);
assert.match(
  moduleSource,
  /slice\(0,\s*3\)/,
  'daily push card must preview the first 3 rules'
);

assert.match(
  moduleSource,
  /nextSelectedAfterDailyPush/,
  '每日场景到达或换一条必须走自动选中'
);
assert.doesNotMatch(
  moduleSource,
  /setActiveTab\('manners'\);\s*setSelectedScenario\(null\)/,
  '切到社交训练不得清空已选场景'
);
assert.doesNotMatch(
  moduleSource,
  /setActiveTab\('aesthetics'\);\s*setSelectedScenario\(null\)/,
  '切到审美修炼不得清空已选场景'
);

console.log('aestheticsPushFrontend.test.js passed');
