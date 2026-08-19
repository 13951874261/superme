const dailyPackService = require('./dailyPackService');
const dailyListenPreGenerateService = require('./dailyListenPreGenerateService');
const dailyCronRunService = require('./dailyCronRunService');

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
      friendlyDescription: '从生词库按最近添加时间取最多50个词，逗号拼接',
      sourceType: 'database',
      sourceRef: 'vocabulary.word via getHistoryExclude()',
      queryRule: 'ORDER BY added_at DESC（当前实现未按 user_id 过滤）',
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
    const historyExclude = dailyPackService.getHistoryExclude(db);
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

    // Step 3: 长文预生成（G003 将改为 await extract 终态；此处先写步骤并调用现有路径）
    let GENRES = dailyCronRunService.LONG_GENRES;
    let CEFR_LEVELS = dailyCronRunService.LONG_CEFR;
    let DURATIONS = dailyCronRunService.LONG_DURATIONS;

    if (process.env.MVP_MODE === 'true') {
      GENRES = ['meeting'];
      CEFR_LEVELS = ['B1'];
      DURATIONS = [1];
    }

    for (const genre of GENRES) {
      if (filterOptions?.genre && genre !== filterOptions.genre) continue;
      for (const cefrLevel of CEFR_LEVELS) {
        if (filterOptions?.cefrLevel && cefrLevel !== filterOptions.cefrLevel) continue;
        for (const duration of DURATIONS) {
          if (filterOptions?.duration && String(duration) !== String(filterOptions.duration)) continue;
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
              errorMessage: msg === 'timeout' || msg === 'task_lost' ? msg : msg,
              resultSummary: { reason: msg === 'timeout' || msg === 'task_lost' ? msg : 'extract_failed' },
            });
            console.warn(`[DailyPack Cron] Long article generate warn user=${row.user_id} (${genre}/${cefrLevel}/${duration}m):`, artErr.message);
          }
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }

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

function scheduleDailyPackCron(db) {
  if (process.env.DAILY_PACK_CRON_ENABLED === 'false') {
    console.log('[DailyPack Cron] disabled via DAILY_PACK_CRON_ENABLED=false');
    return;
  }
  const cronHour = resolveCronHour();
  setInterval(() => {
    const { hour, minute } = dailyPackService.getShanghaiHourMinute();
    const packDate = dailyPackService.getPackDate();
    if (hour === cronHour && minute === 0 && lastCronPackDate !== packDate) {
      lastCronPackDate = packDate;
      (async () => {
        const packSummary = await runDailyPackCronJob(db);
        if (process.env.DAILY_LISTEN_CRON_ENABLED !== 'false') {
          await dailyListenPreGenerateService.runDailyListenCronJob(db, {
            cronTickId: packSummary.cronTickId,
          });
        }
      })().catch((e) => console.error('[DailyPack/Listen Cron] failed:', e));
    }
  }, 60 * 1000);
  console.log(
    '[DailyPack Cron] scheduled for %s:00 then DailyListen (%s; DAILY_PACK_CRON_HOUR=%s)',
    String(cronHour).padStart(2, '0'),
    dailyPackService.PACK_TZ,
    cronHour,
  );
}

module.exports = { runDailyPackCronJob, scheduleDailyPackCron };
