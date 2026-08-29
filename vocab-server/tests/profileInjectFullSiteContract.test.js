/**
 * 全站 user_current_profile 完整注入契约
 * Run: node vocab-server/tests/profileInjectFullSiteContract.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// —— 前端：凡传 Dify 画像不得裸用 getUserCurrentProfile ——
const frontendFiles = [
  'src/services/difyAPI.ts',
  'src/services/listeningAPI.ts',
  'src/services/vocabAPI.ts',
  'src/services/trainingAPI.ts',
  'src/services/dailyPackAPI.ts',
  'src/utils/difyChatbot.ts',
];

for (const rel of frontendFiles) {
  const src = read(rel);
  assert.doesNotMatch(
    src,
    /user_current_profile:\s*getUserCurrentProfile\(\)/,
    `${rel} 不得裸传 getUserCurrentProfile 为 user_current_profile`,
  );
  assert.doesNotMatch(
    src,
    /userCurrentProfile:\s*getUserCurrentProfile\(\)/,
    `${rel} 不得裸传 getUserCurrentProfile 为 userCurrentProfile`,
  );
}

assert.match(read('src/utils/profileHelper.ts'), /export function getInjectedUserCurrentProfile/);
assert.match(read('src/services/listeningAPI.ts'), /injectUserProfileAndTime|getInjectedUserCurrentProfile/);
assert.match(read('src/services/vocabAPI.ts'), /getInjectedUserCurrentProfile/);
assert.match(read('src/services/trainingAPI.ts'), /getInjectedUserCurrentProfile/);
assert.match(read('src/services/dailyPackAPI.ts'), /getInjectedUserCurrentProfile/);
assert.match(read('src/utils/difyChatbot.ts'), /getInjectedUserCurrentProfile/);

// —— Chat B1 shrink 顺序 ——
const chatbot = read('src/utils/difyChatbot.ts');
const packIdx = chatbot.indexOf('delete inputs.memory_pack');
const profileDelIdx = chatbot.indexOf('delete inputs.user_current_profile');
assert.ok(packIdx >= 0 && profileDelIdx > packIdx, 'B1：先删 memory_pack 再删 profile');

// —— 后端：拼装 + 回落 ——
const profileInject = read('vocab-server/services/profileInject.js');
assert.match(profileInject, /function buildInjectedUserCurrentProfile/);
assert.match(profileInject, /function resolveUserCurrentProfileForDify/);
assert.match(profileInject, /career_path/);
assert.match(profileInject, /formatL3VarsForProfile|Accent:/);
assert.match(profileInject, /error_ledger|formatErrorLedgerSummary/);
assert.match(profileInject, /l2_graph|Graph:/);

const dailyPack = read('vocab-server/services/dailyPackService.js');
assert.match(dailyPack, /buildInjectedUserCurrentProfile/);
assert.doesNotMatch(dailyPack, /\.slice\(0,\s*280\)/, '日包画像回落不得 280 截断');

const server = read('vocab-server/server.js');
assert.match(server, /function resolveProfileForDify/);
assert.match(server, /withResolvedGameTheoryProfile/);
const resolveHits = server.match(/resolveProfileForDify\(/g) || [];
assert.ok(resolveHits.length >= 10, `server 应多处回落完整画像，实际 ${resolveHits.length}`);

// —— 行为级 stub（与 profileInject.test 对齐） ——
const {
  buildInjectedUserCurrentProfile,
  resolveUserCurrentProfileForDify,
} = require('../services/profileInject');

const stubDb = {
  prepare() {
    return {
      get() {
        return {
          profile_content: '英国；商务英文听辨断层',
          error_ledger: JSON.stringify({ oral: [{ flaw: 'causal_fallacy' }] }),
          memory_layers: JSON.stringify({
            career_path: {
              history: '高级经理',
              current: '总监',
              target: '合伙人',
              progress: 41,
            },
            l3_vars: { accent: 'UK', training_goal: '即兴表达' },
            l2_graph: {
              relations: [{ from: '用户', rel: '弱点', to: '商务听辨' }],
            },
          }),
        };
      },
    };
  },
};

const full = buildInjectedUserCurrentProfile(stubDb, 'lzhey', { recallQuery: '听辨' });
assert.match(full, /能力匹配度=41%/);
assert.match(full, /Accent:UK/);
assert.match(full, /oral:causal_fallacy/);
assert.match(full, /Graph:/);
assert.match(full, /Recall:/);

assert.equal(
  resolveUserCurrentProfileForDify(stubDb, 'lzhey', '前端已注入'),
  '前端已注入',
);
assert.match(resolveUserCurrentProfileForDify(stubDb, 'lzhey', ''), /能力匹配度=41%/);

console.log('OK profileInjectFullSiteContract');
