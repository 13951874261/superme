const assert = require('assert');
const { initGameTheoryCasePushTables, createService } = require('../services/gameTheoryCasePushService');

function createMemoryDb() {
  const sqlCalls = [];
  return {
    sqlCalls,
    prepare(sql) {
      sqlCalls.push(String(sql || ''));
      return { run() {}, get() { return undefined; }, all() { return []; } };
    }
  };
}

async function main() {
  const db = createMemoryDb();
  initGameTheoryCasePushTables(db);

  const service = createService({
    db,
    apiKey: '',
    baseUrl: 'http://127.0.0.1:1'
  });

  const result = await service.getCasePush({
    userId: 'test-user',
    env: 'corp_clash'
  });

  assert.equal(result.source, 'fallback');
  assert.equal(result.env, 'corp_clash');
  assert.ok(result.id, 'fallback case must have id');
  assert.ok(result.title, 'fallback case must have title');
  assert.ok(result.dedupe_key, 'fallback case must have dedupe_key');
  assert.ok(result.background && result.background.length >= 80, 'background must be a deep briefing');
  assert.ok(result.incomplete_info && result.incomplete_info.length >= 20, 'must expose incomplete information');
  assert.ok(result.decision_point && result.decision_point.length >= 20, 'must stop at a decision point');

  const excluded = await service.getCasePush({
    userId: 'test-user',
    env: 'corp_clash',
    excludeIds: [result.id]
  });

  assert.equal(excluded.source, 'fallback');
  assert.equal(excluded.env, 'corp_clash');
  assert.notEqual(excluded.id, result.id, 'refresh must not repeat an excluded case');
  assert.ok(excluded.background && excluded.background.length >= 80);

  assert.ok(
    db.sqlCalls.some((sql) => /ORDER BY\s+RANDOM\(\)/i.test(sql)),
    'fallback must sample with SQLite ORDER BY RANDOM()'
  );

  const requests = [];
  const catalogDb = {
    prepare(sql) {
      return {
        run() {},
        get() { return undefined; },
        all() {
          if (/FROM game_theory_cases/i.test(String(sql))) {
            return [{
              id: 'corp-openai-board-72h',
              env: 'corp_clash',
              title: '董事会72小时突袭免职',
              dedupe_key: 'corp-openai-board-72h'
            }];
          }
          return [];
        }
      };
    }
  };
  const difyService = createService({
    db: catalogDb,
    apiKey: 'app-test-key',
    baseUrl: 'http://dify.test/v1',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          data: {
            outputs: {
              case_json: JSON.stringify({
                id: 'corp-pre-read-ambush-03',
                env: 'corp_clash',
                title: '预读材料里的合规狙击',
                dedupe_key: 'corp-pre-read-ambush-03',
                background: '你是亚太区CFO。全球COO把公开复盘改成闭门会，预读材料第三页已写本地合规漏洞，但附件没有给你。运营口径延迟十一天，财务口径超支百分之四点六，对不上。董事会十分钟后点名你。',
                incomplete_info: '你不知道董事长是否已私下承诺保护那位VP，也不确定法务是否已锁证据链。',
                decision_point: '十分钟后点名。你选择当众对账、会后单独报，还是先做证据保全？'
              })
            }
          }
        })
      };
    }
  });
  const generated = await difyService.getCasePush({ env: 'corp_clash' });
  assert.ok(requests.length, 'must call Dify when apiKey exists');
  const payload = JSON.parse(requests[0].options.body);
  assert.ok(
    String(payload.inputs.existing_cases).includes('董事会72小时突袭免职'),
    'Dify must receive cases already stored in the database'
  );
  assert.equal(generated.source, 'dify');
  assert.notEqual(generated.title, '董事会72小时突袭免职');

  console.log('gameTheoryCasePush.test.js passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
