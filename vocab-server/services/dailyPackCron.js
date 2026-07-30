const dailyPackService = require('./dailyPackService');
const dailyListenPreGenerateService = require('./dailyListenPreGenerateService');

let lastCronPackDate = null;

async function runDailyPackCronJob(db, targetUserId = null) {
  const packDate = dailyPackService.getPackDate();
  let users = dailyPackService.listUsersWithSyncedTheme(db);
  if (targetUserId) {
    const found = users.filter(u => u.user_id === targetUserId);
    if (found.length > 0) {
      users = found;
    } else {
      const pref = db.prepare('SELECT theme FROM user_theme_prefs WHERE user_id = ?').get(targetUserId);
      users = [{ user_id: targetUserId, theme: pref?.theme || '商务谈判：让步与施压' }];
    }
  }
  const summary = {
    packDate,
    totalUsers: users.length,
    step12Success: 0,
    step12Failed: 0,
    step3Success: 0,
    step3Failed: 0,
    errors: []
  };

  console.log(`[DailyPack Cron Orchestration] Starting 2:00 AM daily cron pipeline for date=${packDate}, totalUsers=${users.length}`);

  for (const row of users) {
    const userId = row.user_id;
    const theme = row.theme;

    console.log(`\n[DailyPack Cron Orchestration] >>> Processing user=${userId}, theme="${theme}"`);

    // ── 步骤 1 & 2: 每日唤醒 + 破绽词汇 ──
    const historyExclude = dailyPackService.getHistoryExclude(db);
    const userCurrentProfile = dailyPackService.getUserCurrentProfile(db, userId);
    const inputSignature = dailyPackService.computeInputSignature(
      theme,
      historyExclude,
      userCurrentProfile,
    );

    const existingPack = dailyPackService.getDailyPackRow(db, userId, packDate, inputSignature);

    if (existingPack?.status === 'ready' && existingPack?.source === 'cron') {
      console.log(`[DailyPack Cron Orchestration] Step 1 & 2 (Wakeup/Flaw): SKIPPED (already generated for user=${userId})`);
      summary.step12Success += 1;
    } else {
      try {
        console.log(`[DailyPack Cron Orchestration] Step 1 & 2 (Wakeup/Flaw): STARTING for user=${userId}...`);
        await dailyPackService.generateDailyPackForUser(db, userId, theme, 'cron');
        console.log(`[DailyPack Cron Orchestration] Step 1 & 2 (Wakeup/Flaw): SUCCESS for user=${userId}`);
        summary.step12Success += 1;
      } catch (err) {
        summary.step12Failed += 1;
        summary.errors.push({ userId, step: 'step1_2_wakeup_flaw', error: err.message || String(err) });
        console.error(`[DailyPack Cron Orchestration] Step 1 & 2 (Wakeup/Flaw): FAILED for user=${userId} (non-blocking):`, err.message);
      }
    }

    // ── 步骤 3: AI 生成长文并提纯（基于 Dify 工作流多维入参矩阵，预生成多组合长文落库） ──
    const COMBINATIONS = [
      { genre: 'meeting', cefrLevel: 'B1', duration: '25' },
      { genre: 'email', cefrLevel: 'B2', duration: '15' },
      { genre: 'report', cefrLevel: 'C1', duration: '35' },
      { genre: 'negotiation', cefrLevel: 'B2', duration: '25' },
      { genre: 'presentation', cefrLevel: 'C1', duration: '25' },
    ];

    try {
      console.log(`[DailyPack Cron Orchestration] Step 3 (Long Article): STARTING for user=${userId} (${COMBINATIONS.length} combinations)...`);
      let successCount = 0;
      for (const combo of COMBINATIONS) {
        try {
          await dailyPackService.generateLongArticleForUser(
            db,
            userId,
            theme,
            'cron',
            combo.genre,
            combo.cefrLevel,
            combo.duration
          );
          successCount++;
          await new Promise((r) => setTimeout(r, 2000));
        } catch (comboErr) {
          console.warn(`[DailyPack Cron Orchestration] Combo ${combo.genre}/${combo.cefrLevel}/${combo.duration} failed (non-blocking):`, comboErr.message);
        }
      }
      if (successCount > 0) {
        console.log(`[DailyPack Cron Orchestration] Step 3 (Long Article): SUCCESS for user=${userId} (${successCount}/${COMBINATIONS.length} combinations generated)`);
        summary.step3Success += 1;
      } else {
        throw new Error('All article combinations failed');
      }
    } catch (err) {
      summary.step3Failed += 1;
      summary.errors.push({ userId, step: 'step3_long_article', error: err.message || String(err) });
      console.error(`[DailyPack Cron Orchestration] Step 3 (Long Article): FAILED for user=${userId}:`, err.message);
    }
  }

  console.log('\n[DailyPack Cron Orchestration] Pipeline Completed:', summary);
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
        await runDailyPackCronJob(db);
        if (process.env.DAILY_LISTEN_CRON_ENABLED !== 'false') {
          await dailyListenPreGenerateService.runDailyListenCronJob(db);
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
