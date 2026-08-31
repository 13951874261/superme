const assert = require('assert');
const dailyPackService = require('../services/dailyPackService');

const DAY_MS = 24 * 60 * 60 * 1000;

function openDatabase() {
  try {
    const Database = require('better-sqlite3');
    return new Database(':memory:');
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.transaction = (fn) => (...args) => {
      db.exec('BEGIN');
      try {
        const result = fn(...args);
        db.exec('COMMIT');
        return result;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    };
    return db;
  }
}

function createDb() {
  const db = openDatabase();
  dailyPackService.initDailyPackTables(db);
  return db;
}

function word(w) {
  return { word: w, ipa: `/${w}/`, meaning_zh: w, pronunciation_note: 'tip', example: `Use ${w}.` };
}

function words(...list) {
  return list.map(word);
}

async function testHardFilterRejectsRecent() {
  console.log('=== 用例 1：硬过滤剔除近窗口已推送词 ===');
  const db = createDb();
  dailyPackService.recordPushedWords(db, 'u1', 'wakeup', words('alpha', 'beta'));

  let calls = 0;
  const wakeup = await dailyPackService.generateWakeupVocabForUser(db, 'u1', {
    theme: '商务谈判',
    historyExclude: '',
    callLlm: async (excludeCsv) => {
      calls += 1;
      assert.ok(excludeCsv.includes('alpha'), '传给 LLM 的排除名单必须含历史推送词');
      assert.ok(excludeCsv.includes('beta'), '传给 LLM 的排除名单必须含历史推送词');
      if (calls === 1) {
        // 首轮混入重复词；目标改为 5 后，9 个新词已够，不必再断言重试
        return { theme: '商务谈判', vocab: words('alpha', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda') };
      }
      return { theme: '商务谈判', vocab: words('gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu') };
    },
  });

  const names = wakeup.vocab.map((v) => v.word);
  assert.ok(!names.includes('alpha'), '硬过滤后不得再出现近窗口词 alpha');
  assert.ok(!names.includes('beta'), '硬过滤后不得再出现近窗口词 beta');
  assert.ok(names.length <= 5, '唤醒最终不得超过 5 词');
  console.log('  通过');
  db.close();
}

async function testRetryOnceOnShortage() {
  console.log('=== 用例 2：数量不足时重试 1 次并把拒收词追加排除 ===');
  const db = createDb();
  dailyPackService.recordPushedWords(db, 'u1', 'wakeup', words('old1', 'old2', 'old3', 'old4', 'old5', 'old6', 'old7', 'old8'));

  const excludesSeen = [];
  let calls = 0;
  const wakeup = await dailyPackService.generateWakeupVocabForUser(db, 'u1', {
    theme: 't',
    callLlm: async (excludeCsv) => {
      calls += 1;
      excludesSeen.push(excludeCsv);
      if (calls === 1) {
        // 首轮：8 个撞历史 + 2 个新词
        return { vocab: words('old1', 'old2', 'old3', 'old4', 'old5', 'old6', 'old7', 'old8', 'newA', 'newB') };
      }
      // 次轮：再给 8 个新词
      return { vocab: words('newC', 'newD', 'newE', 'newF', 'newG', 'newH', 'newI', 'newJ', 'newK', 'newL') };
    },
  });

  assert.ok(calls >= 2, '不足满额或博弈槽不足时应至少重试（≥2 次调用）');
  assert.ok(excludesSeen[1].includes('old1'), '第二次排除名单应包含首轮拒收词');
  const names = wakeup.vocab.map((v) => v.word);
  assert.ok(names.length <= 5);
  for (const n of ['old1', 'old2', 'old3', 'old4', 'old5', 'old6', 'old7', 'old8']) {
    assert.ok(!names.includes(n), `最终结果不得含近窗口词 ${n}`);
  }
  console.log('  通过');
  db.close();
}

async function testWakeupDoesNotBackfill() {
  console.log('=== 用例 3：唤醒数量不足时不拿旧词凑数 ===');
  const db = createDb();
  const ancients = ['ancient1', 'ancient2', 'ancient3', 'ancient4', 'ancient5'];
  dailyPackService.recordPushedWords(db, 'u1', 'wakeup', words(...ancients, 'recentX'));
  ancients.forEach((w, i) => {
    db.prepare('UPDATE pushed_vocab_history SET pushed_at = ? WHERE word = ?')
      .run(Date.now() - (50 + i) * DAY_MS, w);
  });
  const wakeup = await dailyPackService.generateWakeupVocabForUser(db, 'u1', {
    theme: 't',
    callLlm: async () => ({ vocab: words('recentX', 'onlyOne') }),
  });
  assert.ok(wakeup.vocab.length <= 5);
  assert.ok(!wakeup.vocab.some((v) => String(v.word).startsWith('ancient')));
  assert.ok(wakeup.vocab.every((v) => v.word !== 'recentX'));
  assert.strictEqual(wakeup._dedupeNotice, dailyPackService.DEDUPE_SHORT_NOTICE);
  db.close();
  console.log('  通过');
}

async function testSharedPoolWakeupBlocksFlaw() {
  console.log('=== 用例 4：唤醒推过的词，破绽模块不得再推（共享池） ===');
  const db = createDb();

  const wakeup = await dailyPackService.generateWakeupVocabForUser(db, 'u1', {
    theme: 't',
    callLlm: async () => ({
      vocab: words('w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10'),
    }),
  });
  assert.ok(wakeup.vocab.length <= 5, '唤醒结果不得超过 5 词');

  const flaw = await dailyPackService.generateFlawVocabForUser(db, 'u1', 't', {
    callLlm: async (excludeCsv) => {
      assert.ok(excludeCsv.includes('w1'), '破绽生成排除名单须含唤醒刚推的词');
      return { vocab: words('w1', 'w2', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6') };
    },
  });

  const names = flaw.map((v) => v.word);
  assert.strictEqual(names.length, 6);
  assert.ok(!names.includes('w1') && !names.includes('w2'), '破绽结果不得含唤醒刚推的词');
  console.log('  通过');
  db.close();
}

async function testConsecutiveWakeupNoOverlap() {
  console.log('=== 用例 5：连续三次重新生成，批次间无交集 ===');
  const db = createDb();
  const batches = [];
  const pool = [];
  for (let i = 0; i < 40; i++) pool.push(`term${i}`);

  for (let round = 0; round < 3; round++) {
    const slice = pool.slice(round * 5, round * 5 + 5);
    const wakeup = await dailyPackService.generateWakeupVocabForUser(db, 'u1', {
      theme: 't',
      callLlm: async () => ({ vocab: words(...slice) }),
    });
    batches.push(wakeup.vocab.map((v) => v.word));
  }

  assert.ok(batches[0].length <= 5);
  assert.ok(batches[1].length <= 5);
  assert.ok(batches[2].length <= 5);
  const overlap01 = batches[0].filter((w) => batches[1].includes(w));
  const overlap12 = batches[1].filter((w) => batches[2].includes(w));
  const overlap02 = batches[0].filter((w) => batches[2].includes(w));
  assert.deepStrictEqual(overlap01, [], '第1批与第2批不得有交集');
  assert.deepStrictEqual(overlap12, [], '第2批与第3批不得有交集');
  assert.deepStrictEqual(overlap02, [], '第1批与第3批不得有交集');
  console.log('  通过');
  db.close();
}

async function testSignatureUnchangedByPushedHistory() {
  console.log('=== 用例 6：推送历史不进入 input_signature（不破坏缓存键） ===');
  const db = createDb();
  const base = 'apple, banana';
  const sigBefore = dailyPackService.computeInputSignature('主题', base, 'profile');
  dailyPackService.recordPushedWords(db, 'u1', 'wakeup', words('alpha'));
  const effective = dailyPackService.buildEffectiveHistoryExclude(db, 'u1', base);
  assert.ok(effective.includes('alpha'), 'effective exclude 含推送历史');
  const sigAfter = dailyPackService.computeInputSignature('主题', base, 'profile');
  assert.strictEqual(sigBefore, sigAfter, '签名仍只用原生词本 exclude，与推送历史无关');
  console.log('  通过');
  db.close();
}

async function testRecordsAfterSuccess() {
  console.log('=== 用例 7：生成成功后写入推送历史 ===');
  const db = createDb();
  await dailyPackService.generateFlawVocabForUser(db, 'u1', 't', {
    callLlm: async () => ({ vocab: words('f1', 'f2', 'f3', 'f4', 'f5', 'f6') }),
  });
  const recent = dailyPackService.getRecentPushedWords(db, 'u1');
  for (const w of ['f1', 'f2', 'f3', 'f4', 'f5', 'f6']) {
    assert.ok(recent.includes(w), `历史表应记录 ${w}`);
  }
  console.log('  通过');
  db.close();
}

async function testStemBlocksRefresh() {
  console.log('=== 用例 8：negotiate 已推则 negotiation 不得再入唤醒 ===');
  const db = createDb();
  dailyPackService.recordPushedWords(db, 'u1', 'wakeup', words('negotiate'));
  const { kept, rejected } = dailyPackService.filterVocabAgainstExclude(
    words('negotiation', 'BATNA'),
    dailyPackService.getRecentPushedWords(db, 'u1'),
  );
  assert.strictEqual(kept.map((x) => x.word).join(','), 'BATNA');
  assert.ok(rejected.some((x) => dailyPackService.stemsMatch(x, 'negotiation')));
  db.close();
  console.log('  通过');
}

function seedVocabAndSiblings(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vocabulary (
      id TEXT, user_id TEXT, word TEXT, added_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS daily_extracted_articles (
      id TEXT, user_id TEXT, quota_date TEXT, words_json TEXT, phrases_json TEXT
    );
    CREATE TABLE IF NOT EXISTS daily_listen_articles (
      id TEXT, user_id TEXT, pack_date TEXT, vocab_json TEXT, phrases_json TEXT
    );
  `);
}

async function testHistoryExcludeFiltersByUser() {
  console.log('=== 用例 10：排重按用户过滤，不含他人生词 ===');
  const db = createDb();
  seedVocabAndSiblings(db);
  const now = Date.now();
  db.prepare('INSERT INTO vocabulary VALUES (?,?,?,?)').run('v1', 'u1', 'alpha-mine', now);
  db.prepare('INSERT INTO vocabulary VALUES (?,?,?,?)').run('v2', 'u2', 'other-secret', now);
  const mine = dailyPackService.getHistoryExclude(db, 'u1');
  assert.ok(mine.includes('alpha-mine'), '本用户生词应进入签名用 exclude');
  assert.ok(!mine.includes('other-secret'), '他人生词不得进入本用户 exclude');
  db.close();
  console.log('  通过');
}

async function testLlmExcludeIsPushedAndSameDayOnly() {
  console.log('=== 用例 11：LLM 排除 = 近30天已推送 + 当日长文/精听，不含整本生词与他人词 ===');
  const db = createDb();
  seedVocabAndSiblings(db);
  const day = dailyPackService.getPackDate();
  const now = Date.now();
  db.prepare('INSERT INTO vocabulary VALUES (?,?,?,?)').run('v1', 'u1', 'book-only', now);
  db.prepare('INSERT INTO vocabulary VALUES (?,?,?,?)').run('v2', 'u2', 'other-book', now);
  dailyPackService.recordPushedWords(db, 'u1', 'wakeup', words('pushed-mine'));
  dailyPackService.recordPushedWords(db, 'u2', 'wakeup', words('pushed-other'));
  db.prepare('INSERT INTO daily_extracted_articles VALUES (?,?,?,?,?)')
    .run('a1', 'u1', day, JSON.stringify([{ word: 'sibling-article' }]), '[]');
  db.prepare('INSERT INTO daily_listen_articles VALUES (?,?,?,?,?)')
    .run('l1', 'u1', day, JSON.stringify(['sibling-listen']), '[]');
  db.prepare('INSERT INTO daily_extracted_articles VALUES (?,?,?,?,?)')
    .run('a2', 'u2', day, JSON.stringify([{ word: 'other-sibling' }]), '[]');

  let excludeCsv = '';
  await dailyPackService.generateWakeupVocabForUser(db, 'u1', {
    theme: 't',
    historyExclude: 'book-only, other-book',
    callLlm: async (csv) => {
      excludeCsv = csv;
      return { vocab: words('BATNA', 'anchoring', 'reservation price', "prisoner's dilemma", 'Nash equilibrium') };
    },
  });
  assert.ok(excludeCsv.includes('pushed-mine'), '须含本用户近30天已推送词');
  assert.ok(excludeCsv.includes('sibling-article'), '须含当日长文提纯词');
  assert.ok(excludeCsv.includes('sibling-listen'), '须含当日精听提纯词');
  assert.ok(!excludeCsv.includes('book-only'), '不得把整本生词塞进 Dify history_exclude');
  assert.ok(!excludeCsv.includes('other-book'), '不得含他人生词');
  assert.ok(!excludeCsv.includes('pushed-other'), '不得含他人已推送词');
  assert.ok(!excludeCsv.includes('other-sibling'), '不得含他人当日长文词');
  assert.ok(excludeCsv.length < 65535, '发给 Dify 的 history_exclude 必须小于 65535');
  db.close();
  console.log('  通过');
}

async function testLlmExcludeCappedUnderDifyLimit() {
  console.log('=== 用例 12：当日提纯词极多时截断，避免 Dify 65535 拒收 ===');
  const db = createDb();
  seedVocabAndSiblings(db);
  const day = dailyPackService.getPackDate();
  const huge = Array.from({ length: 8000 }, (_, i) => `term${String(i).padStart(4, '0')}xxxxx`);
  db.prepare('INSERT INTO daily_extracted_articles VALUES (?,?,?,?,?)')
    .run('a1', 'u1', day, JSON.stringify(huge.map((word) => ({ word }))), '[]');
  let excludeCsv = '';
  await dailyPackService.generateWakeupVocabForUser(db, 'u1', {
    theme: 't',
    callLlm: async (csv) => {
      excludeCsv = csv;
      return { vocab: words('BATNA', 'anchoring', 'reservation price', "prisoner's dilemma", 'Nash equilibrium') };
    },
  });
  assert.ok(excludeCsv.length < 65535, `超长 exclude 必须截断，实际 ${excludeCsv.length}`);
  assert.ok(excludeCsv.includes('term0000xxxxx') || excludeCsv.includes('term'), '截断后仍应保留部分当日提纯词');
  db.close();
  console.log('  通过');
}

async function testWakeupSlotsAndBan() {
  console.log('=== 用例 9：唤醒 3+2 且拒绝 modeling ===');
  const db = createDb();
  const wakeup = await dailyPackService.generateWakeupVocabForUser(db, 'u1', {
    theme: '商务谈判',
    callLlm: async () => ({
      vocab: [
        ...words('modeling', 'agenda', 'BATNA', 'reservation price', 'anchoring'),
        { word: "prisoner's dilemma", slot: 'theory', ipa: '/p/', meaning_zh: '囚徒困境', pronunciation_note: 't', example: 'x' },
        { word: 'Nash equilibrium', slot: 'theory', ipa: '/n/', meaning_zh: '纳什', pronunciation_note: 't', example: 'x' },
      ],
    }),
  });
  const names = wakeup.vocab.map((v) => v.word);
  assert.ok(names.length <= 5);
  assert.ok(!names.includes('modeling') && !names.includes('agenda'));
  assert.ok(names.includes('BATNA'));
  assert.ok(names.includes("prisoner's dilemma"));
  db.close();
  console.log('  通过');
}

async function run() {
  console.log('=== 测试：生成链路去重接入 ===\n');
  await testHardFilterRejectsRecent();
  await testRetryOnceOnShortage();
  await testWakeupDoesNotBackfill();
  await testSharedPoolWakeupBlocksFlaw();
  await testConsecutiveWakeupNoOverlap();
  await testSignatureUnchangedByPushedHistory();
  await testRecordsAfterSuccess();
  await testStemBlocksRefresh();
  await testWakeupSlotsAndBan();
  await testHistoryExcludeFiltersByUser();
  await testLlmExcludeIsPushedAndSameDayOnly();
  await testLlmExcludeCappedUnderDifyLimit();
  console.log('\n✅ vocabDedupePipeline.test.js 全部用例通过！');
}

run().catch((err) => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
