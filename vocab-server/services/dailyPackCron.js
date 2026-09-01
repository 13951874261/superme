const dailyPackService = require('./dailyPackService');
const dailyListenPreGenerateService = require('./dailyListenPreGenerateService');
const dailyCronRunService = require('./dailyCronRunService');

const LONG_ARTICLE_CONCURRENCY_DEFAULT = 3;
const LONG_ARTICLE_CONCURRENCY_CAP = 4;

function resolveLongArticleConcurrency() {
  const raw = process.env.DAILY_LONG_ARTICLE_CONCURRENCY;
  if (raw === undefined || raw === '') return LONG_ARTICLE_CONCURRENCY_DEFAULT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return LONG_ARTICLE_CONCURRENCY_DEFAULT;
  return Math.min(n, LONG_ARTICLE_CONCURRENCY_CAP);
}

async function mapPool(items, concurrency, worker) {
  const list = [...items];
  const results = [];
  if (list.length === 0) return results;
  let idx = 0;
  const runners = Array.from({ length: Math.min(concurrency, list.length) }, async () => {
    while (idx < list.length) {
      const cur = idx;
      idx += 1;
      const item = list[cur];
      try {
        results[cur] = { ok: true, item, value: await worker(item, cur) };
      } catch (err) {
        results[cur] = { ok: false, item, error: err };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

let lastCronPackDate = null;

function buildWakeupFlawInputSources({ theme, historyExclude, userCurrentProfile, userId }) {
  return [
    dailyCronRunService.buildInputSource({
      name: 'theme',
      value: theme,
      friendlyDescription: '从用户主题偏好表读取当前学习主题',
      sourceType: 'database',
      sourceRef: 'user_theme_prefs.theme via listCronTargetUsers',
      queryRule: '近7天登录且 theme 非空；否则回退最近登录用户',
      transform: 'trim',
      fallback: '商务谈判：让步与施压',
    }),
    dailyCronRunService.buildInputSource({
      name: 'history_exclude',
      value: historyExclude,
      sensitive: true,
      valuePreview: String(historyExclude || '').split(', ').slice(0, 3).join(', ') + (historyExclude ? '…' : ''),
      friendlyDescription: '缓存签名用：当前用户生词本最近 50 词。LLM 避重另用近 30 天已推送词 + 当日长文/精听提纯词',
      sourceType: 'database',
      sourceRef: 'vocabulary.word via getHistoryExclude(db, userId)',
      queryRule: 'WHERE user_id = 当前用户 ORDER BY added_at DESC LIMIT 50（仅签名；不按全库）',
      transform: 'slice(0,50).join(", ")',
      fallback: "''",
    }),
    dailyCronRunService.buildInputSource({
      name: 'user_current_profile',
      value: userCurrentProfile,
      sensitive: true,
      friendlyDescription: '从用户记忆画像读取并截断',
      sourceType: 'database',
      sourceRef: 'user_memories.profile_content via getUserCurrentProfile()',
      queryRule: `user_id = ${dailyCronRunService.normalizeUserId(userId)}`,
      transform: 'trim().slice(0,280)',
      fallback: "''",
    }),
    dailyCronRunService.buildInputSource({
      name: '_system_time',
      value: '(runtime)',
      friendlyDescription: '服务端按上海时区格式化当前时间',
      sourceType: 'runtime',
      sourceRef: 'getSystemFormattedTime()',
      transform: 'Asia/Shanghai formatted string',
      fallback: 'n/a',
    }),
    dailyCronRunService.buildInputSource({
      name: '_system_timestamp_ms',
      value: '(runtime Date.now())',
      friendlyDescription: '服务端调用时的毫秒时间戳',
      sourceType: 'runtime',
      sourceRef: 'Date.now()',
      fallback: 'n/a',
    }),
    dailyCronRunService.buildInputSource({
      name: 'user',
      value: dailyCronRunService.normalizeUserId(userId),
      friendlyDescription: 'Dify 外层用户标识（去邮箱后缀）',
      sourceType: 'runtime',
      sourceRef: 'normalizeUserId(userId)',
      fallback: 'default-user',
    }),
  ];
}

async function runDailyPackCronJob(db, targetUserId = null, filterOptions = null) {
  const packDate = dailyPackService.getPackDate();
  const cronTickId = dailyCronRunService.createCronTickId();
  let users = dailyListenPreGenerateService.listCronTargetUsers(db);
  if (targetUserId) {
    const uid = dailyCronRunService.normalizeUserId(targetUserId);
    const found = users.find((u) => dailyCronRunService.normalizeUserId(u.user_id) === uid);
    if (found) {
      users = [found];
    } else {
      const pref = db.prepare(`
        SELECT theme FROM user_theme_prefs
        WHERE user_id = ? AND theme IS NOT NULL AND TRIM(theme) != ''
      `).get(uid);
      users = [{
        user_id: uid,
        theme: pref?.theme || '商务谈判：让步与施压',
        fallback: false,
      }];
    }
  }
  const summary = {
    packDate,
    cronTickId,
    total: users.length,
    fallback: users.some((u) => u.fallback),
    ok: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
  if (users.length === 0) {
    console.warn('[DailyPack Cron] no cron target users (no login logs)');
  } else if (summary.fallback) {
    console.warn(
      '[DailyPack Cron] no active users in window; fallback to latest login user=%s',
      users[0].user_id,
    );
  }

  console.log('[DailyPack Cron] tick=%s packDate=%s users=%s', cronTickId, packDate, users.length);

  for (const row of users) {
    const historyExclude = dailyPackService.getHistoryExclude(db, row.user_id);
    const userCurrentProfile = dailyCronRunService.sanitizeCronLogPayload(
      dailyPackService.getUserCurrentProfile(db, row.user_id),
    );
    const inputSignature = dailyPackService.computeInputSignature(
      row.theme,
      historyExclude,
      userCurrentProfile,
    );
    const inputSources = buildWakeupFlawInputSources({
      theme: row.theme,
      historyExclude,
      userCurrentProfile,
      userId: row.user_id,
    });
    const inputsSnapshot = {
      theme: row.theme,
      history_exclude: historyExclude,
      user_current_profile: userCurrentProfile,
      input_signature: inputSignature,
      response_mode: 'blocking',
      user: dailyCronRunService.normalizeUserId(row.user_id),
    };

    const run = dailyCronRunService.createPerUserRun(db, {
      cronTickId,
      userId: row.user_id,
      packDate,
      triggerSource: 'cron',
    });
    dailyCronRunService.appendLogEvent(db, {
      runId: run.id,
      level: 'info',
      message: 'per-user run materialized',
      context: { cronTickId, userId: row.user_id, packDate },
    });

    const existing = dailyPackService.getDailyPackRow(db, row.user_id, packDate, inputSignature);
    if (existing?.status === 'ready' && existing?.source === 'cron') {
      // 标记 wakeup 与 flaw 复用已有缓存，继续向下执行 Step 3 长文预生成与 Listen
      dailyCronRunService.upsertStep(db, {
        runId: run.id,
        userId: row.user_id,
        module: 'wakeup',
        status: 'skipped',
        progress: 100,
        finishedAt: Date.now(),
        resultSummary: { reason: 'daily_pack_ready_cron_cache' },
      });
      dailyCronRunService.upsertStep(db, {
        runId: run.id,
        userId: row.user_id,
        module: 'flaw',
        status: 'skipped',
        progress: 100,
        finishedAt: Date.now(),
        resultSummary: { reason: 'daily_pack_ready_cron_cache' },
      });
      summary.skipped += 1;
    } else {
      const wakeupStep = dailyCronRunService.upsertStep(db, {
        runId: run.id,
        userId: row.user_id,
        module: 'wakeup',
        status: 'running',
        inputs: inputsSnapshot,
        inputSources,
      });
      const flawStep = dailyCronRunService.upsertStep(db, {
        runId: run.id,
        userId: row.user_id,
        module: 'flaw',
        status: 'running',
        inputs: { ...inputsSnapshot, note: 'flaw uses dynamicTheme + slice(-50) inside generateFlawVocabForUser' },
        inputSources,
      });

      try {
        await dailyPackService.generateDailyPackForUser(db, row.user_id, row.theme, 'cron');
        dailyCronRunService.upsertStep(db, {
          id: wakeupStep.id,
          runId: run.id,
          userId: row.user_id,
          module: 'wakeup',
          status: 'completed',
          progress: 100,
          finishedAt: Date.now(),
          resultSummary: { ok: true },
        });
        dailyCronRunService.upsertStep(db, {
          id: flawStep.id,
          runId: run.id,
          userId: row.user_id,
          module: 'flaw',
          status: 'completed',
          progress: 100,
          finishedAt: Date.now(),
        });
        summary.ok += 1;
      } catch (err) {
        const msg = err.message || String(err);
        dailyCronRunService.upsertStep(db, {
          id: wakeupStep.id,
          runId: run.id,
          userId: row.user_id,
          module: 'wakeup',
          status: 'failed',
          progress: 100,
          errorMessage: msg,
          finishedAt: Date.now(),
        });
        dailyCronRunService.upsertStep(db, {
          id: flawStep.id,
          runId: run.id,
          userId: row.user_id,
          module: 'flaw',
          status: 'failed',
          progress: 100,
          errorMessage: msg,
          finishedAt: Date.now(),
        });
        summary.failed += 1;
        summary.errors.push({ userId: row.user_id, error: msg });
        console.error('[DailyPack Cron] user=%s fail: %s', row.user_id, err.message);
      }
    }

    // Step 3: 每日仅预生成 4体裁 x 4等级 x 1分钟 = 16 组；长时材料由用户按需生成。
    const GENRES = dailyCronRunService.LONG_GENRES;
    const CEFR_LEVELS = dailyCronRunService.LONG_CEFR;
    const DURATIONS = [1];
    const combos = [];
    for (const genre of GENRES) {
      if (filterOptions?.genre && genre !== filterOptions.genre) continue;
      for (const cefrLevel of CEFR_LEVELS) {
        if (filterOptions?.cefrLevel && cefrLevel !== filterOptions.cefrLevel) continue;
        for (const duration of DURATIONS) {
          if (filterOptions?.duration && String(duration) !== String(filterOptions.duration)) continue;
          combos.push({ genre, cefrLevel, duration });
        }
      }
    }

    const concurrency = resolveLongArticleConcurrency();
    console.log(
      `[DailyPack Cron] long_article pool user=%s combos=%s concurrency=%s`,
      row.user_id,
      combos.length,
      concurrency,
    );

    await mapPool(combos, concurrency, async ({ genre, cefrLevel, duration }) => {
      const comboKey = `${genre}|${cefrLevel}|${duration}`;
      const step = dailyCronRunService.upsertStep(db, {
        runId: run.id,
        userId: row.user_id,
        module: 'long_article',
        comboKey,
        status: 'running',
        inputs: {
          theme: row.theme,
          genre,
          cefr_level: cefrLevel,
          duration: String(duration),
        },
      });
      try {
        const result = await dailyPackService.generateLongArticleForUser(
          db,
          row.user_id,
          row.theme,
          'cron',
          genre,
          cefrLevel,
          String(duration),
        );
        const skipped = result?.status === 'skipped';
        dailyCronRunService.upsertStep(db, {
          id: step.id,
          runId: run.id,
          userId: row.user_id,
          module: 'long_article',
          comboKey,
          status: skipped ? 'skipped' : 'completed',
          progress: 100,
          finishedAt: Date.now(),
          resultSummary: result || { ok: true },
          errorMessage: skipped ? (result?.reason || 'already_generated') : null,
        });
        return result;
      } catch (artErr) {
        const msg = artErr.message || String(artErr);
        dailyCronRunService.upsertStep(db, {
          id: step.id,
          runId: run.id,
          userId: row.user_id,
          module: 'long_article',
          comboKey,
          status: 'failed',
          progress: 100,
          finishedAt: Date.now(),
          errorMessage: msg,
          resultSummary: { reason: msg === 'timeout' || msg === 'task_lost' ? msg : 'extract_failed' },
        });
        console.warn(`[DailyPack Cron] Long article generate warn user=${row.user_id} (${genre}/${cefrLevel}/${duration}m):`, artErr.message);
        return { success: false, error: msg };
      }
    });

    dailyCronRunService.refreshRunAggregation(db, run.id);
  }

  console.log('[DailyPack Cron] done', summary);
  return summary;
}

function resolveCronHour() {
  const raw = process.env.DAILY_PACK_CRON_HOUR;
  if (raw === undefined || raw === '') return 2;
  const hour = Number(raw);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    console.warn('[DailyPack Cron] invalid DAILY_PACK_CRON_HOUR=%s, fallback to 2', raw);
    return 2;
  }
  return hour;
}

let isExecutingCron = false;

function hasCronRunToday(db, packDate) {
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as cnt FROM daily_cron_runs
      WHERE pack_date = ? AND trigger_source = 'cron'
    `).get(packDate);
    return Number(row?.cnt || 0) > 0;
  } catch (e) {
    return false;
  }
}

function scheduleDailyPackCron(db) {
  if (process.env.DAILY_PACK_CRON_ENABLED === 'false') {
    console.log('[DailyPack Cron] disabled via DAILY_PACK_CRON_ENABLED=false');
    return;
  }
  const cronHour = resolveCronHour();
  const WINDOW_MINUTES = 15; // 02:00 ~ 02:15 容错触发窗口

  setInterval(() => {
    if (isExecutingCron) return;

    const { hour, minute } = dailyPackService.getShanghaiHourMinute();
    const packDate = dailyPackService.getPackDate();

    // 处于 02:00 ~ 02:15 窗口内，且内存与数据库记录均显示当天 cron 尚未运行，即触发
    const inWindow = hour === cronHour && minute >= 0 && minute <= WINDOW_MINUTES;
    const shouldRun = inWindow && lastCronPackDate !== packDate && !hasCronRunToday(db, packDate);

    if (shouldRun) {
      lastCronPackDate = packDate;
      isExecutingCron = true;
      console.log(`⏰ [DailyPack Cron Triggered] 上海时间 ${hour}:${String(minute).padStart(2, '0')} (packDate: ${packDate}) 满足定时触发条件`);
      (async () => {
        try {
          const packSummary = await runDailyPackCronJob(db);
          if (process.env.DAILY_LISTEN_CRON_ENABLED !== 'false') {
            await dailyListenPreGenerateService.runDailyListenCronJob(db, {
              cronTickId: packSummary.cronTickId,
            });
          }
          if (process.env.DAILY_ORAL_OPENING_CRON_ENABLED !== 'false') {
            const oralOpeningCacheService = require('./oralOpeningCacheService');
            await oralOpeningCacheService.runDailyOralOpeningCronJob(db, {
              cronTickId: packSummary.cronTickId,
            });
          }
        } finally {
          isExecutingCron = false;
        }
      })().catch((e) => {
        isExecutingCron = false;
        console.error('[DailyPack/Listen Cron] failed:', e);
      });
    }
  }, 30 * 1000); // 每 30 秒检查一次

  console.log(
    '[DailyPack Cron] scheduled for %s:00-%s:%s window then DailyListen (%s; DAILY_PACK_CRON_HOUR=%s)',
    String(cronHour).padStart(2, '0'),
    String(cronHour).padStart(2, '0'),
    WINDOW_MINUTES,
    dailyPackService.PACK_TZ,
    cronHour,
  );
}

module.exports = {
  runDailyPackCronJob,
  scheduleDailyPackCron,
  resolveLongArticleConcurrency,
  mapPool,
  LONG_ARTICLE_CONCURRENCY_DEFAULT,
  LONG_ARTICLE_CONCURRENCY_CAP,
};
