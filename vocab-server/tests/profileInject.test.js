/**
 * Server profile inject assembly (no native sqlite — stub db)
 * Run: node vocab-server/tests/profileInject.test.js
 */
const assert = require('assert');
const {
  buildInjectedUserCurrentProfile,
  resolveUserCurrentProfileForDify,
  formatCareerProfileLine,
  buildCareerAwareProfileString,
  formatL3VarsForProfile,
  formatErrorLedgerSummary,
  formatGraphSummaryLine,
} = require('../services/profileInject');

const career = formatCareerProfileLine({
  history: '高级经理',
  current: '总监',
  target: '合伙人',
  progress: 41,
});
assert.match(career, /能力匹配度=41%/);

const careerAware = buildCareerAwareProfileString('英国；商务英文听辨断层', {
  history: '高级经理',
  current: '总监',
  target: '合伙人',
  progress: 41,
});
assert.match(careerAware, /能力匹配度=41%/);
assert.match(careerAware, /商务英文听辨断层/);

assert.equal(formatL3VarsForProfile({ accent: 'UK', training_goal: '即兴表达' }), 'Accent:UK; Goal:即兴表达');
assert.match(formatErrorLedgerSummary({ oral: [{ flaw: 'causal_fallacy' }] }), /oral:causal_fallacy/);
assert.match(
  formatGraphSummaryLine({
    l2_graph: { relations: [{ from: '用户', rel: '弱点', to: '商务听辨', evidence: '测试' }] },
  }),
  /Graph:/,
);

const row = {
  profile_content: '英国；商务英文听辨断层',
  error_ledger: JSON.stringify({ oral: [{ flaw: 'causal_fallacy' }], listening: [], vocab: [] }),
  memory_layers: JSON.stringify({
    career_path: {
      history: '高级经理',
      current: '总监',
      target: '合伙人',
      progress: 41,
    },
    l3_vars: { accent: 'UK', training_goal: '即兴表达' },
    l2_graph: {
      relations: [{ from: '用户', rel: '弱点', to: '商务听辨', evidence: '测试证据' }],
    },
  }),
};

const stubDb = {
  prepare() {
    return {
      get() {
        return row;
      },
    };
  },
};

const injected = buildInjectedUserCurrentProfile(stubDb, 'lzhey');
assert.match(injected, /能力匹配度=41%/);
assert.match(injected, /商务英文听辨断层/);
assert.match(injected, /Accent:UK/);
assert.match(injected, /oral:causal_fallacy/);
assert.match(injected, /Graph:/);
assert.ok(injected.length > 80);

const resolvedClient = resolveUserCurrentProfileForDify(stubDb, 'lzhey', '客户端完整画像测试');
assert.equal(resolvedClient, '客户端完整画像测试');

const resolvedFallback = resolveUserCurrentProfileForDify(stubDb, 'lzhey', '');
assert.match(resolvedFallback, /能力匹配度=41%/);
assert.match(resolvedFallback, /Accent:UK/);

const dailyPackSrc = require('fs').readFileSync(
  require('path').join(__dirname, '../services/dailyPackService.js'),
  'utf8',
);
assert.match(dailyPackSrc, /buildInjectedUserCurrentProfile/, '日包 getUserCurrentProfile 须走完整注入');
assert.doesNotMatch(
  dailyPackSrc,
  /profile_content \|\| ''\)\)\.slice\(0, 280\)/,
  '不得再对画像回落做 280 截断',
);

const serverSrc = require('fs').readFileSync(
  require('path').join(__dirname, '../server.js'),
  'utf8',
);
assert.match(serverSrc, /function resolveProfileForDify/, 'server 须有 resolveProfileForDify');
assert.match(serverSrc, /resolveProfileForDify\(userId, user_current_profile\)/, 'Dify 调用须回落完整画像');

console.log('OK profileInject tests');
