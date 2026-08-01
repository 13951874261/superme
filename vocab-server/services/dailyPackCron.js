const dailyPackService = require('./dailyPackService');
const dailyListenPreGenerateService = require('./dailyListenPreGenerateService');

let lastCronPackDate = null;

async function runDailyPackCronJob(db) {
  const packDate = dailyPackService.getPackDate();
  const users = dailyPackService.listUsersWithSyncedTheme(db);
  const summary = { packDate, total: users.length, ok: 0, skipped: 0, failed: 0, errors: [] };

  for (const row of users) {
    const historyExclude = dailyPackService.getHistoryExclude(db);
    const userCurrentProfile = dailyPackService.getUserCurrentProfile(db, row.user_id);
    const inputSignature = dailyPackService.computeInputSignature(
      row.theme,
      historyExclude,
      userCurrentProfile,
    );
    const existing = dailyPackService.getDailyPackRow(db, row.user_id, packDate, inputSignature);
    if (existing?.status === 'ready' && existing?.source === 'cron') {
      summary.skipped += 1;
      continue;
    }
    try {
      await dailyPackService.generateDailyPackForUser(db, row.user_id, row.theme, 'cron');
      summary.ok += 1;
    } catch (err) {
      summary.failed += 1;
      summary.errors.push({ userId: row.user_id, error: err.message || String(err) });
      console.error('[DailyPack Cron] user=%s fail: %s', row.user_id, err.message);
    }

    // Step 3: 长文预生成与精听盲听音频联动
    const GENRES = ['meeting', 'news', 'podcast', 'reading'];
    const CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1'];
    const DURATIONS = [1, 15, 25, 35];

    for (const genre of GENRES) {
      for (const cefrLevel of CEFR_LEVELS) {
        for (const duration of DURATIONS) {
          try {
            await dailyPackService.generateLongArticleForUser(
              db,
              row.user_id,
              row.theme,
              'cron',
              genre,
              cefrLevel,
              String(duration)
            );
          } catch (artErr) {
            console.warn(`[DailyPack Cron] Long article generate warn user=${row.user_id} (${genre}/${cefrLevel}/${duration}m):`, artErr.message);
          }
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }
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
