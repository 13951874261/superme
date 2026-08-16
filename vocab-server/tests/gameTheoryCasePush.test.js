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
  assert.ok(result.background && result.background.replace(/\s+/g, '').length >= 400, 'background must be >=400 compact chars');
  assert.ok(result.incomplete_info && result.incomplete_info.length >= 20, 'must expose incomplete information');
  assert.ok(result.decision_point && result.decision_point.length >= 20, 'must stop at a decision point');
  assert.equal(result.quality, 'ok', 'seed fallback must pass GT-CASE-02 quality');
  assert.ok(typeof result.char_count === 'number');

  const excluded = await service.getCasePush({
    userId: 'test-user',
    env: 'corp_clash',
    excludeIds: [result.id]
  });

  assert.equal(excluded.source, 'fallback');
  assert.equal(excluded.env, 'corp_clash');
  assert.notEqual(excluded.id, result.id, 'refresh must not repeat an excluded case');
  assert.ok(excluded.background && excluded.background.replace(/\s+/g, '').length >= 400);
  assert.equal(excluded.quality, 'ok');

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
                background: [
                  '你是亚太区CFO。全球COO把公开复盘改成闭门会，预读材料第三页已写本地合规漏洞，但附件没有给你。',
                  '运营口径延迟十一天，财务口径超支百分之四点六，对不上。董事会十分钟后点名你。',
                  '董事长要求你当场表态，CEO已提前与投资人通气，法务与秘书只把完整附件发给部分董事，',
                  '下属财务经理盯着你的措辞，同事开始猜测谁会背锅。',
                  '你必须在极度信息不对称下决定如何陈述数字与责任边界，任何一句过硬或过软都可能触发合规审查与编制调整。',
                  '此局中董事长、CEO、投资人、法务与多名VP的利益链彼此咬合，任何口头承诺都可能在董事会纪要里被改写，下属与同事的站队信号也在实时变化。',
                  '预读材料与口头口径互相打架，你既要守住数字真相，又要避免被写成不配合重组的阻力。',
                  '会议室时钟已走到点名前两分钟，投资人代表正在走廊打电话，你的每一次措辞都会被记录进会后纪要。',
                  'CFO席位本就敏感：既要服务CEO的重组叙事，又要对董事长与大股东负责，稍有偏颇就会被两边同时清算。',
                ].join(''),
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
