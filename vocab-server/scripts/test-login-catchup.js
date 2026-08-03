const assert = require('assert');
const fs = require('fs');

const dailyPackService = require('../services/dailyPackService');
const dailyListenService = require('../services/dailyListenPreGenerateService');

function createPackDb(status = null) {
  return {
    prepare(sql) {
      assert.match(sql, /FROM daily_packs/);
      return {
        get(userId, packDate) {
          if (!status) return undefined;
          return {
            user_id: userId,
            pack_date: packDate,
            status,
          };
        },
      };
    },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testDuplicateCallsShareOneTask() {
  const originalGeneratePack = dailyPackService.generateDailyPackForUser;
  const originalRunListen = dailyListenService.runDailyListenForUser;
  const gate = deferred();
  let packCalls = 0;
  let listenCalls = 0;
  let first;
  let second;

  dailyPackService.generateDailyPackForUser = async () => {
    packCalls += 1;
    await gate.promise;
  };
  dailyListenService.runDailyListenForUser = async () => {
    listenCalls += 1;
    return { combosOk: 0, combosFail: 0 };
  };

  try {
    first = dailyListenService.scheduleUserDailyCatchup(createPackDb(), {
      userId: ' Alice@example.com ',
      theme: '商务英语',
    });
    second = dailyListenService.scheduleUserDailyCatchup(createPackDb(), {
      userId: 'Alice',
      theme: '商务英语',
    });

    assert.strictEqual(first, second, '同用户同日期应返回同一个进行中 Promise');
    await Promise.resolve();
    assert.strictEqual(packCalls, 1, '重复调用只能启动一次 daily pack 生成');

    gate.resolve();
    const result = await first;
    assert.strictEqual(listenCalls, 1, '重复调用只能启动一次精听补跑');
    assert.strictEqual(result.userId, 'Alice');
    assert.strictEqual(result.packGenerated, true);
    assert.strictEqual(result.status, 'completed');
  } finally {
    gate.resolve();
    await Promise.allSettled([first, second].filter(Boolean));
    dailyPackService.generateDailyPackForUser = originalGeneratePack;
    dailyListenService.runDailyListenForUser = originalRunListen;
  }
}

async function testReadyPackIsNotRegenerated() {
  const originalGeneratePack = dailyPackService.generateDailyPackForUser;
  const originalRunListen = dailyListenService.runDailyListenForUser;
  let packCalls = 0;
  let listenCalls = 0;

  dailyPackService.generateDailyPackForUser = async () => {
    packCalls += 1;
  };
  dailyListenService.runDailyListenForUser = async () => {
    listenCalls += 1;
    return { combosOk: 0, combosFail: 0 };
  };

  try {
    const result = await dailyListenService.scheduleUserDailyCatchup(createPackDb('ready'), {
      userId: 'ready-user',
      theme: '商务英语',
    });

    assert.strictEqual(packCalls, 0, 'ready daily pack 不应重复生成');
    assert.strictEqual(listenCalls, 1, 'ready daily pack 仍应补齐当前用户缺失精听');
    assert.strictEqual(result.packGenerated, false);
  } finally {
    dailyPackService.generateDailyPackForUser = originalGeneratePack;
    dailyListenService.runDailyListenForUser = originalRunListen;
  }
}

async function testFailureCanRetry() {
  const originalGeneratePack = dailyPackService.generateDailyPackForUser;
  const originalRunListen = dailyListenService.runDailyListenForUser;
  const originalConsoleError = console.error;
  let packCalls = 0;
  let listenCalls = 0;
  const errorLogs = [];

  dailyPackService.generateDailyPackForUser = async () => {
    packCalls += 1;
    if (packCalls === 1) throw new Error('expected first failure');
  };
  dailyListenService.runDailyListenForUser = async () => {
    listenCalls += 1;
    return { combosOk: 0, combosFail: 0 };
  };
  console.error = (...args) => {
    errorLogs.push(args.map(String).join(' '));
  };

  try {
    await assert.rejects(
      dailyListenService.scheduleUserDailyCatchup(createPackDb(), {
        userId: 'retry-user',
        theme: '商务英语',
      }),
      /expected first failure/,
    );

    const result = await dailyListenService.scheduleUserDailyCatchup(createPackDb(), {
      userId: 'retry-user',
      theme: '商务英语',
    });

    assert.strictEqual(packCalls, 2, '失败 settle 后应允许再次生成');
    assert.strictEqual(listenCalls, 1, '首次失败不应运行精听，重试成功后运行一次');
    assert.strictEqual(result.status, 'completed');
    assert.ok(
      errorLogs.some((line) => line.includes('[Daily User Task]') && line.includes('expected first failure')),
      'rejected catch-up 应保留服务端错误日志',
    );
  } finally {
    console.error = originalConsoleError;
    dailyPackService.generateDailyPackForUser = originalGeneratePack;
    dailyListenService.runDailyListenForUser = originalRunListen;
  }
}

async function testSkipReadyAudioUsesExactCombo() {
  const userId = 'combo-audio-user';
  const packDate = dailyPackService.getPackDate();
  const readyArticle = {
    id: 'article-ready',
    user_id: userId, quota_date: packDate, theme: '商务英语',
    genre: 'meeting', cefr_level: 'B1', duration: 25,
    article: 'Ready article body', body_text: 'Ready article body',
    words_json: '[]', phrases_json: '[]', status: 'ready', file_path: null,
  };
  const missingArticle = {
    id: 'article-missing-audio',
    user_id: userId, quota_date: packDate, theme: '商务英语',
    genre: 'news', cefr_level: 'B2', duration: 15,
    article: 'Missing audio article body', body_text: 'Missing audio article body',
    words_json: '[]', phrases_json: '[]', status: 'ready', file_path: null,
  };
  const readyAudio = {
    id: 'ready-audio',
    status: 'ready',
    script_text: 'Ready article body',
    audio_path: null,
    audio_url: '/api/daily_listen_audio/combo-audio-user/existing.mp3',
  };
  const db = {
    prepare(sql) {
      return {
        all() {
          return /FROM daily_extracted_articles/.test(sql)
            ? [readyArticle, missingArticle]
            : [];
        },
        get(...args) {
          if (/FROM daily_listen_audios/.test(sql)) {
            const exactThemeQuery = args.length === 6;
            const actualUserId = args[0];
            const actualPackDate = args[1];
            const actualTheme = exactThemeQuery ? args[2] : '商务英语';
            const genre = args.length === 6 ? args[3] : args[2];
            const cefrLevel = args.length === 6 ? args[4] : args[3];
            const duration = args.length === 6 ? args[5] : args[4];
            return actualUserId === userId
              && actualPackDate === packDate
              && actualTheme === '商务英语'
              && genre === 'meeting'
              && cefrLevel === 'B1'
              && Number(duration) === 25
              ? readyAudio
              : undefined;
          }
          if (/FROM daily_listen_articles/.test(sql)) {
            const actualUserId = args[0];
            const actualPackDate = args[1];
            const genre = args.length === 6 ? args[3] : args[2];
            if (actualUserId !== userId || actualPackDate !== packDate) return undefined;
            if (genre === 'news') return missingArticle;
            if (genre === 'meeting') return readyArticle;
            return undefined;
          }
          if (/FROM daily_extracted_articles/.test(sql)) return missingArticle;
          return undefined;
        },
        run() {
          return { changes: 1 };
        },
      };
    },
  };
  let synthCalls = 0;
  const synthesizedTexts = [];
  dailyListenService.setGenerators({
    synthesizeAudioFile: async (text) => {
      synthCalls += 1;
      synthesizedTexts.push(text);
    },
  });

  try {
    const result = await dailyListenService.batchSyncAudiosFromLongArticles(
      db,
      userId,
      packDate,
      'login-catchup',
      { skipReadyAudio: true },
    );
    assert.strictEqual(synthCalls, 1, '只应为精确匹配为 missing 的组合合成音频');
    assert.deepStrictEqual(synthesizedTexts, ['Missing audio article body']);
    assert.deepStrictEqual(result, { total: 2, success: 1, failed: 0, skipped: 1 });
  } finally {
    fs.rmSync(`${dailyListenService.ARTICLE_ROOT}\\${userId}`, { recursive: true, force: true });
    fs.rmSync(`${dailyListenService.AUDIO_ROOT}\\${userId}`, { recursive: true, force: true });
  }
}

function createCoordinatorDb(users = [], { packStatus = 'ready', onPackGet } = {}) {
  const readyArticle = {
    id: 'ready-article',
    status: 'ready',
    body_text: 'ready',
    vocab_json: '[]',
    phrases_json: '[]',
    file_path: null,
  };
  const readyAudio = {
    id: 'ready-audio',
    status: 'ready',
    audio_url: '/ready.mp3',
  };
  return {
    prepare(sql) {
      return {
        all() {
          if (/FROM user_theme_prefs/.test(sql)) return users;
          return [];
        },
        get(userId, packDate) {
          if (/FROM daily_packs/.test(sql)) {
            if (onPackGet) onPackGet(userId, packDate);
            return packStatus
              ? { user_id: userId, pack_date: packDate, status: packStatus }
              : undefined;
          }
          if (/FROM daily_listen_articles/.test(sql)) return readyArticle;
          if (/FROM daily_listen_audios/.test(sql)) return readyAudio;
          return undefined;
        },
        run() {
          return { changes: 0 };
        },
      };
    },
  };
}

async function testCatchupsUseConcurrencyLimitTwo() {
  const originalRunListen = dailyListenService.runDailyListenForUser;
  const gates = new Map([
    ['queue-user-1', deferred()],
    ['queue-user-2', deferred()],
    ['queue-user-3', deferred()],
  ]);
  const starts = [];
  dailyListenService.runDailyListenForUser = async (db, user) => {
    starts.push(user.user_id);
    await gates.get(user.user_id).promise;
    return { syncedFromArticles: 0, combosOk: 0, combosFail: 0, errors: [] };
  };

  try {
    const db = createCoordinatorDb();
    const tasks = [1, 2, 3].map((index) => dailyListenService.scheduleUserDailyCatchup(db, {
      userId: `queue-user-${index}`, theme: `主题${index}`,
    }));
    await delay(0);
    const startsBeforeRelease = [...starts];
    gates.get('queue-user-1').resolve();
    await delay(0);
    const startsAfterOneRelease = [...starts];
    gates.forEach((gate) => gate.resolve());
    await Promise.all(tasks);

    assert.deepStrictEqual(
      startsBeforeRelease,
      ['queue-user-1', 'queue-user-2'],
      '有界队列应同时启动两个任务',
    );
    assert.deepStrictEqual(
      startsAfterOneRelease,
      ['queue-user-1', 'queue-user-2', 'queue-user-3'],
      '第三个任务应等待并发槽位释放',
    );
  } finally {
    gates.forEach((gate) => gate.resolve());
    dailyListenService.runDailyListenForUser = originalRunListen;
  }
}

async function testCronAndCatchupShareUserDateLock() {
  const originalRunListen = dailyListenService.runDailyListenForUser;
  const originalCleanup = dailyListenService.cleanupDailyListenStorage;
  const gate = deferred();
  const calls = [];
  dailyListenService.runDailyListenForUser = async (db, user, options) => {
    calls.push(options);
    if (calls.length === 1) await gate.promise;
    return { syncedFromArticles: 1, combosOk: 2, combosFail: 0, errors: [] };
  };
  dailyListenService.cleanupDailyListenStorage = () => ({ marker: 'cleanup' });

  try {
    const user = { user_id: 'shared-user', theme: '共享主题' };
    const db = createCoordinatorDb([user]);
    const catchup = dailyListenService.scheduleUserDailyCatchup(db, {
      userId: user.user_id, theme: user.theme,
    });
    await delay(0);
    const cron = dailyListenService.runDailyListenCronJob(db);
    const cronStateBeforeRelease = await Promise.race([
      cron.then(() => 'settled'),
      delay(20).then(() => 'waiting'),
    ]);
    gate.resolve();
    const [, cronResult] = await Promise.all([catchup, cron]);

    assert.strictEqual(cronStateBeforeRelease, 'waiting', 'cron 应等待同用户当天已进行的 catch-up');
    assert.deepStrictEqual(
      calls.map((options) => ({
        source: options.source,
        skipReadyAudio: options.skipReadyAudio || false,
        durations: options.durations || null,
      })),
      [
        { source: 'login-catchup', skipReadyAudio: true, durations: [1] },
        { source: 'cron', skipReadyAudio: false, durations: null },
      ],
      'cron 应在 catch-up 后按自己的 options 再执行',
    );
    assert.strictEqual(cronResult.summary.combosOk, 2);
  } finally {
    gate.resolve();
    dailyListenService.runDailyListenForUser = originalRunListen;
    dailyListenService.cleanupDailyListenStorage = originalCleanup;
  }
}

async function testCronFirstCatchupStillGeneratesMissingPack() {
  const originalGeneratePack = dailyPackService.generateDailyPackForUser;
  const originalRunListen = dailyListenService.runDailyListenForUser;
  const originalCleanup = dailyListenService.cleanupDailyListenStorage;
  const listenGate = deferred();
  let packCalls = 0;
  const listenCalls = [];

  dailyPackService.generateDailyPackForUser = async () => {
    packCalls += 1;
  };
  dailyListenService.runDailyListenForUser = async (db, user, options) => {
    listenCalls.push(options);
    if (listenCalls.length === 1) await listenGate.promise;
    return { syncedFromArticles: 0, combosOk: 1, combosFail: 0, errors: [] };
  };
  dailyListenService.cleanupDailyListenStorage = () => ({ marker: 'cleanup' });

  try {
    const user = { user_id: 'cron-first-user', theme: '先 cron 后登录' };
    const db = createCoordinatorDb([user], { packStatus: null });
    const cron = dailyListenService.runDailyListenCronJob(db);
    await delay(0);
    const catchup = dailyListenService.scheduleUserDailyCatchup(db, {
      userId: user.user_id,
      theme: user.theme,
    });
    await delay(0);
    const observedPackCalls = packCalls;
    const observedListenCalls = listenCalls.length;
    listenGate.resolve();
    const [cronResult, catchupResult] = await Promise.all([cron, catchup]);
    assert.strictEqual(observedPackCalls, 1, 'cron-first 时 catch-up 仍应独立补生成 daily pack');
    assert.strictEqual(observedListenCalls, 1, 'cron 与 catch-up 监听阶段不得并发');
    assert.deepStrictEqual(
      listenCalls.map((options) => ({
        source: options.source,
        skipReadyAudio: options.skipReadyAudio || false,
        durations: options.durations || null,
      })),
      [
        { source: 'cron', skipReadyAudio: false, durations: null },
        { source: 'login-catchup', skipReadyAudio: true, durations: [1] },
      ],
      'catch-up 应在 cron 后按自己的 options 再执行',
    );
    assert.strictEqual(cronResult.summary.combosOk, 1);
    assert.strictEqual(catchupResult.packGenerated, true);
  } finally {
    listenGate.resolve();
    dailyPackService.generateDailyPackForUser = originalGeneratePack;
    dailyListenService.runDailyListenForUser = originalRunListen;
    dailyListenService.cleanupDailyListenStorage = originalCleanup;
  }
}

async function testCatchupPackFailureDoesNotPoisonCronListen() {
  const originalGeneratePack = dailyPackService.generateDailyPackForUser;
  const originalRunListen = dailyListenService.runDailyListenForUser;
  const originalCleanup = dailyListenService.cleanupDailyListenStorage;
  const originalConsoleError = console.error;
  const packGate = deferred();
  let listenCalls = 0;

  dailyPackService.generateDailyPackForUser = async () => {
    await packGate.promise;
    throw new Error('expected pack failure');
  };
  dailyListenService.runDailyListenForUser = async () => {
    listenCalls += 1;
    return { syncedFromArticles: 0, combosOk: 1, combosFail: 0, errors: [] };
  };
  dailyListenService.cleanupDailyListenStorage = () => ({ marker: 'cleanup' });
  console.error = () => {};

  try {
    const user = { user_id: 'pack-failure-user', theme: '失败隔离' };
    const db = createCoordinatorDb([user], { packStatus: null });
    const catchup = dailyListenService.scheduleUserDailyCatchup(db, {
      userId: user.user_id,
      theme: user.theme,
    });
    await delay(0);
    const cron = dailyListenService.runDailyListenCronJob(db);
    await delay(0);
    packGate.resolve();

    await assert.rejects(catchup, /expected pack failure/);
    const cronResult = await cron;
    assert.strictEqual(listenCalls, 1, 'catch-up pack 失败不应污染 cron listen Promise');
    assert.strictEqual(cronResult.summary.combosOk, 1);
  } finally {
    packGate.resolve();
    console.error = originalConsoleError;
    dailyPackService.generateDailyPackForUser = originalGeneratePack;
    dailyListenService.runDailyListenForUser = originalRunListen;
    dailyListenService.cleanupDailyListenStorage = originalCleanup;
  }
}

async function testFailedListenDoesNotBlockNextCron() {
  const originalRunListen = dailyListenService.runDailyListenForUser;
  const originalCleanup = dailyListenService.cleanupDailyListenStorage;
  const originalConsoleError = console.error;
  const gate = deferred();
  const sources = [];
  dailyListenService.runDailyListenForUser = async (db, user, options) => {
    sources.push(options.source);
    if (options.source === 'login-catchup') {
      await gate.promise;
      throw new Error('expected listen failure');
    }
    return { syncedFromArticles: 0, combosOk: 1, combosFail: 0, errors: [] };
  };
  dailyListenService.cleanupDailyListenStorage = () => ({ marker: 'cleanup' });
  console.error = () => {};

  try {
    const user = { user_id: 'listen-failure-user', theme: '监听失败隔离' };
    const db = createCoordinatorDb([user]);
    const catchup = dailyListenService.scheduleUserDailyCatchup(db, {
      userId: user.user_id,
      theme: user.theme,
    });
    await delay(0);
    const cron = dailyListenService.runDailyListenCronJob(db);
    gate.resolve();

    await assert.rejects(catchup, /expected listen failure/);
    const cronResult = await cron;
    assert.deepStrictEqual(sources, ['login-catchup', 'cron']);
    assert.strictEqual(cronResult.summary.combosOk, 1);
  } finally {
    gate.resolve();
    console.error = originalConsoleError;
    dailyListenService.runDailyListenForUser = originalRunListen;
    dailyListenService.cleanupDailyListenStorage = originalCleanup;
  }
}

async function testQueuedCatchupUsesExecutionPackDateConsistently() {
  const originalGetPackDate = dailyPackService.getPackDate;
  const originalGeneratePack = dailyPackService.generateDailyPackForUser;
  const originalRunListen = dailyListenService.runDailyListenForUser;
  const gates = new Map([
    ['date-blocker-1', deferred()],
    ['date-blocker-2', deferred()],
  ]);
  const packQueries = [];
  const generatedDates = [];
  const listenDates = [];
  let currentDate = '2026-08-03';

  dailyPackService.getPackDate = () => currentDate;
  dailyPackService.generateDailyPackForUser = async (db, userId) => {
    generatedDates.push({ userId, packDate: dailyPackService.getPackDate() });
  };
  dailyListenService.runDailyListenForUser = async (db, user, options) => {
    if (gates.has(user.user_id)) await gates.get(user.user_id).promise;
    if (user.user_id === 'queued-date-user') listenDates.push(options.packDate);
    return { syncedFromArticles: 0, combosOk: 0, combosFail: 0, errors: [] };
  };

  try {
    const db = createCoordinatorDb([], {
      packStatus: null,
      onPackGet(userId, packDate) {
        packQueries.push({ userId, packDate });
      },
    });
    const blockers = [1, 2].map((index) => dailyListenService.scheduleUserDailyCatchup(db, {
      userId: `date-blocker-${index}`,
      theme: `阻塞主题${index}`,
    }));
    const queued = dailyListenService.scheduleUserDailyCatchup(db, {
      userId: 'queued-date-user',
      theme: '跨日主题',
    });
    await delay(0);
    currentDate = '2026-08-04';
    const duplicateAcrossDate = dailyListenService.scheduleUserDailyCatchup(db, {
      userId: 'queued-date-user',
      theme: '跨日主题',
    });
    gates.forEach((gate) => gate.resolve());

    const [, , result] = await Promise.all([...blockers, queued, duplicateAcrossDate]);
    const queuedPackQuery = packQueries.find((item) => item.userId === 'queued-date-user');
    const queuedGenerations = generatedDates.filter((item) => item.userId === 'queued-date-user');
    assert.strictEqual(queued, duplicateAcrossDate, '同用户跨日调用应复用唯一 pending catch-up');
    assert.strictEqual(queuedPackQuery.packDate, '2026-08-04');
    assert.deepStrictEqual(queuedGenerations, [{ userId: 'queued-date-user', packDate: '2026-08-04' }]);
    assert.deepStrictEqual(listenDates, ['2026-08-04']);
    assert.strictEqual(result.packDate, '2026-08-04');
  } finally {
    gates.forEach((gate) => gate.resolve());
    dailyPackService.getPackDate = originalGetPackDate;
    dailyPackService.generateDailyPackForUser = originalGeneratePack;
    dailyListenService.runDailyListenForUser = originalRunListen;
  }
}

async function testExecutingCatchupQueuesOneNextDateFollowup() {
  const originalGetPackDate = dailyPackService.getPackDate;
  const originalRunListen = dailyListenService.runDailyListenForUser;
  const firstGate = deferred();
  const secondGate = deferred();
  const listenDates = [];
  let currentDate = '2026-08-03';
  let active = 0;
  let maxActive = 0;

  dailyPackService.getPackDate = () => currentDate;
  dailyListenService.runDailyListenForUser = async (db, user, options) => {
    listenDates.push(options.packDate);
    active += 1;
    maxActive = Math.max(maxActive, active);
    try {
      if (listenDates.length === 1) await firstGate.promise;
      else await secondGate.promise;
      return { syncedFromArticles: 0, combosOk: 0, combosFail: 0, errors: [] };
    } finally {
      active -= 1;
    }
  };

  try {
    const db = createCoordinatorDb();
    const first = dailyListenService.scheduleUserDailyCatchup(db, {
      userId: 'midnight-user',
      theme: '跨零点主题',
    });
    await delay(0);
    currentDate = '2026-08-04';
    const second = dailyListenService.scheduleUserDailyCatchup(db, {
      userId: 'midnight-user',
      theme: '跨零点主题',
    });
    const third = dailyListenService.scheduleUserDailyCatchup(db, {
      userId: 'midnight-user',
      theme: '跨零点主题',
    });

    firstGate.resolve();
    await delay(0);
    secondGate.resolve();
    const [firstResult, secondResult] = await Promise.all([first, second, third]);

    assert.notStrictEqual(first, second, 'D2 follow-up 不应复用已在执行的 D1 Promise');
    assert.strictEqual(second, third, '同一天的多个 follow-up 调用应合并');
    assert.deepStrictEqual(listenDates, ['2026-08-03', '2026-08-04']);
    assert.strictEqual(maxActive, 1, '同用户跨日 follow-up 不得并发生成');
    assert.strictEqual(firstResult.packDate, '2026-08-03');
    assert.strictEqual(secondResult.packDate, '2026-08-04');
  } finally {
    firstGate.resolve();
    secondGate.resolve();
    dailyPackService.getPackDate = originalGetPackDate;
    dailyListenService.runDailyListenForUser = originalRunListen;
  }
}

async function testCronTraversalSummarySourceAndCleanup() {
  const originalRunListen = dailyListenService.runDailyListenForUser;
  const originalCleanup = dailyListenService.cleanupDailyListenStorage;
  const calls = [];
  dailyListenService.runDailyListenForUser = async (db, user, options) => {
    calls.push({ userId: user.user_id, options });
    if (user.user_id === 'cron-user-1') {
      return { syncedFromArticles: 1, combosOk: 2, combosFail: 1, errors: [{ userId: user.user_id, error: 'x' }] };
    }
    return { syncedFromArticles: 3, combosOk: 4, combosFail: 0, errors: [] };
  };
  dailyListenService.cleanupDailyListenStorage = () => ({ marker: 'cleanup' });

  try {
    const users = [
      { user_id: 'cron-user-1', theme: '主题一' },
      { user_id: 'cron-user-2', theme: '主题二' },
    ];
    const result = await dailyListenService.runDailyListenCronJob(createCoordinatorDb(users));
    assert.deepStrictEqual(calls.map((call) => call.userId), ['cron-user-1', 'cron-user-2']);
    assert.ok(calls.every((call) => call.options.source === 'cron'));
    assert.deepStrictEqual(result.summary, {
      packDate: dailyPackService.getPackDate(),
      users: 2,
      fallback: false,
      syncedFromArticles: 4,
      combosOk: 6,
      combosFail: 1,
      errors: [{ userId: 'cron-user-1', error: 'x' }],
    });
    assert.deepStrictEqual(result.cleanup, { marker: 'cleanup' });
  } finally {
    dailyListenService.runDailyListenForUser = originalRunListen;
    dailyListenService.cleanupDailyListenStorage = originalCleanup;
  }
}

async function main() {
  const tests = [
    testDuplicateCallsShareOneTask,
    testReadyPackIsNotRegenerated,
    testFailureCanRetry,
    testSkipReadyAudioUsesExactCombo,
    testCatchupsUseConcurrencyLimitTwo,
    testCronAndCatchupShareUserDateLock,
    testCronFirstCatchupStillGeneratesMissingPack,
    testCatchupPackFailureDoesNotPoisonCronListen,
    testFailedListenDoesNotBlockNextCron,
    testQueuedCatchupUsesExecutionPackDateConsistently,
    testExecutingCatchupQueuesOneNextDateFollowup,
    testCronTraversalSummarySourceAndCleanup,
  ];
  const failures = [];
  for (const test of tests) {
    try {
      await test();
    } catch (error) {
      failures.push({ name: test.name, error });
      console.error(`FAIL ${test.name}:`, error.message);
    }
  }
  if (failures.length > 0) {
    throw new Error(`${failures.length} test(s) failed`);
  }
  console.log('PASS test-login-catchup');
}

main().catch((error) => {
  console.error('FAIL test-login-catchup:', error);
  process.exitCode = 1;
});
