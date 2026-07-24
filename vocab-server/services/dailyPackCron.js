const dailyPackService = require('./dailyPackService');
const dailyListenPreGenerateService = require('./dailyListenPreGenerateService');

let lastCronPackDate = null;

async function runDailyPackCronJob(db) {
  const packDate = dailyPackService.getPackDate();
  const users = dailyPackService.listUsersWithSyncedTheme(db);
  const summary = { packDate, total: users.length, ok: 0, skipped: 0, failed: 0, errors: [] };

  for (const row of users) {
    const existing = dailyPackService.getDailyPackRow(db, row.user_id, packDate);
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
  }
  console.log('[DailyPack Cron] done', summary);
  return summary;
}

function scheduleDailyPackCron(db) {
  if (process.env.DAILY_PACK_CRON_ENABLED === 'false') {
    console.log('[DailyPack Cron] disabled via DAILY_PACK_CRON_ENABLED=false');
    return;
  }
  setInterval(() => {
    const { hour, minute } = dailyPackService.getShanghaiHourMinute();
    const packDate = dailyPackService.getPackDate();
    if (hour === 2 && minute === 0 && lastCronPackDate !== packDate) {
      lastCronPackDate = packDate;
      (async () => {
        await runDailyPackCronJob(db);
        if (process.env.DAILY_LISTEN_CRON_ENABLED !== 'false') {
          await dailyListenPreGenerateService.runDailyListenCronJob(db);
        }
      })().catch((e) => console.error('[DailyPack/Listen Cron] failed:', e));
    }
  }, 60 * 1000);
  console.log('[DailyPack Cron] scheduled for 02:00 then DailyListen', dailyPackService.PACK_TZ);
}

module.exports = { runDailyPackCronJob, scheduleDailyPackCron };
