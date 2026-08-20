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
        // 首轮故意混入重复词，只贡献 9 个新词 → 触发重试
        return { theme: '商务谈判', vocab: words('alpha', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda') };
      }
      return { theme: '商务谈判', vocab: words('gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu') };
    },
  });

  const names = wakeup.vocab.map((v) => v.word);
  assert.ok(!names.includes('alpha'), '硬过滤后不得再出现近窗口词 alpha');
  assert.ok(!names.includes('beta'), '硬过滤后不得再出现近窗口词 beta');
  assert.strictEqual(names.length, 10, '最终必须凑满 10 词');
  assert.strictEqual(calls, 2, '首轮不足时应重试一次');
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

  assert.strictEqual(calls, 2, '不足满额时应恰好重试 1 次（共 2 次调用）');
  assert.ok(excludesSeen[1].includes('old1'), '第二次排除名单应包含首轮拒收词');
  const names = wakeup.vocab.map((v) => v.word);
  assert.strictEqual(names.length, 10);
  for (const n of ['old1', 'old2', 'old3', 'old4', 'old5', 'old6', 'old7', 'old8']) {
    assert.ok(!names.includes(n), `最终结果不得含近窗口词 ${n}`);
  }
  console.log('  通过');
  db.close();
}

async function testBackfillOldestWhenStillShort() {
  console.log('=== 用例 3：重试后仍不足则用最久未出现词补齐并带提示 ===');
  const db = createDb();
  // 写入一批历史；把 ancient* 回拨到窗口外，作为「最久未出现」候选
  const ancients = ['ancient1', 'ancient2', 'ancient3', 'ancient4', 'ancient5',
    'ancient6', 'ancient7', 'ancient8', 'ancient9', 'ancient10', 'ancient11', 'ancient12'];
  dailyPackService.recordPushedWords(db, 'u1', 'wakeup', words(...ancients, 'recentX'));
  ancients.forEach((w, i) => {
    db.prepare('UPDATE pushed_vocab_history SET pushed_at = ? WHERE word = ?')
      .run(Date.now() - (50 + i) * DAY_MS, w);
  });

  const wakeup = await dailyPackService.generateWakeupVocabForUser(db, 'u1', {
    theme: 't',
    callLlm: async () => ({ vocab: words('recentX', 'onlyOne') }),
  });

  assert.strictEqual(wakeup.vocab.length, 10, '必须补齐到 10');
  assert.ok(wakeup._dedupeNotice, '补齐时必须带提示文案');
  assert.strictEqual(wakeup._dedupeNotice, dailyPackService.DEDUPE_BACKFILL_NOTICE);
  const names = wakeup.vocab.map((v) => v.word);
  assert.ok(names.includes('onlyOne'));
  assert.ok(names.some((n) => n.startsWith('ancient')), '应包含窗口外最久词');
  assert.ok(!names.includes('recentX'), '窗口内 recentX 不应被优先补齐（有更旧候选时）');
  console.log('  通过');
  db.close();
}

async function testSharedPoolWakeupBlocksFlaw() {
  console.log('=== 用例 4：唤醒推过的词，破绽模块不得再推（共享池） ===');
  const db = createDb();

  await dailyPackService.generateWakeupVocabForUser(db, 'u1', {
    theme: 't',
    callLlm: async () => ({
      vocab: words('w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10'),
    }),
  });

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
    const slice = pool.slice(round * 10, round * 10 + 10);
    const wakeup = await dailyPackService.generateWakeupVocabForUser(db, 'u1', {
      theme: 't',
      callLlm: async () => ({ vocab: words(...slice) }),
    });
    batches.push(wakeup.vocab.map((v) => v.word));
  }

  assert.strictEqual(new Set(batches[0]).size, 10);
  assert.strictEqual(new Set(batches[1]).size, 10);
  assert.strictEqual(new Set(batches[2]).size, 10);
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

async function run() {
  console.log('=== 测试：生成链路去重接入 ===\n');
  await testHardFilterRejectsRecent();
  await testRetryOnceOnShortage();
  await testBackfillOldestWhenStillShort();
  await testSharedPoolWakeupBlocksFlaw();
  await testConsecutiveWakeupNoOverlap();
  await testSignatureUnchangedByPushedHistory();
  await testRecordsAfterSuccess();
  console.log('\n✅ vocabDedupePipeline.test.js 全部用例通过！');
}

run().catch((err) => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
