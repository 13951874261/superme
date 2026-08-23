const dailyPackService = require('./dailyPackService');
const pool = require('./insightDailyPoolService');

const DEFAULT_HOUR = 4;
const WINDOW_MINUTES = 15;
const CONCURRENCY_DEFAULT = 3;
const CONCURRENCY_CAP = 4;

let lastInsightPackDate = null;
let isExecuting = false;

function resolveInsightCronHour() {
  const raw = process.env.INSIGHT_DAILY_CRON_HOUR;
  if (raw === undefined || raw === '') return DEFAULT_HOUR;
  const hour = Number(raw);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return DEFAULT_HOUR;
  return hour;
}

function resolveConcurrency() {
  const n = Number(process.env.INSIGHT_DAILY_CONCURRENCY);
  if (!Number.isInteger(n) || n < 1) return CONCURRENCY_DEFAULT;
  return Math.min(n, CONCURRENCY_CAP);
}

async function runInsightDailyCronJob(db, {
  generateFn,
  listUsers,
  taskQueue,
  concurrency = resolveConcurrency(),
} = {}) {
  const packDate = dailyPackService.getPackDate();
  pool.pruneExpired(db, packDate);
  const users = typeof listUsers === 'function'
    ? listUsers()
    : require('./dailyListenPreGenerateService').listCronTargetUsers(db);

  const jobs = [];
  for (const row of users) {
    for (const category of pool.CATEGORIES) {
      jobs.push({ userId: row.user_id, category });
    }
  }

  let task = null;
  if (taskQueue) {
    task = taskQueue.createTask('insight_daily_cron', `洞察案例预生成 ${packDate}`);
    taskQueue.updateTask(task.id, {
      status: 'running',
      progress: 1,
      logs: ['后台生成中，请稍后在任务中心查看'],
    });
  }

  const { mapPool } = require('./dailyPackCron');
  const results = await mapPool(jobs, Math.max(1, concurrency), async (job) => {
    const filled = await pool.fillCategory(db, {
      userId: job.userId,
      packDate,
      category: job.category,
      generateFn,
    });
    if ((filled.ready || []).length < pool.TARGET_PER_CATEGORY && (filled.added || []).length === 0) {
      throw new Error(`${job.category} 未能写入新案例`);
    }
    return filled;
  });

  const failed = results.filter((r) => !r.ok).length;
  const ok = results.filter((r) => r.ok).length;
  if (task && taskQueue) {
    taskQueue.updateTask(task.id, {
      status: failed && !ok ? 'failed' : 'completed',
      progress: 100,
      error: failed && !ok ? `${failed} 组失败` : null,
      logs: [`完成 ${ok}/${jobs.length} 组，失败 ${failed}`],
      result: { packDate, ok, failed, total: jobs.length },
    });
  }
  return { packDate, ok, failed, total: jobs.length };
}

function scheduleInsightDailyCron(db, opts = {}) {
  if (process.env.INSIGHT_DAILY_CRON_ENABLED === 'false') {
    console.log('[InsightDaily Cron] disabled');
    return;
  }
  const cronHour = resolveInsightCronHour();
  setInterval(() => {
    if (isExecuting) return;
    const { hour, minute } = dailyPackService.getShanghaiHourMinute();
    const packDate = dailyPackService.getPackDate();
    const inWindow = hour === cronHour && minute >= 0 && minute <= WINDOW_MINUTES;
    if (!inWindow || lastInsightPackDate === packDate) return;
    isExecuting = true;
    console.log(`[InsightDaily Cron] 上海 ${hour}:${String(minute).padStart(2, '0')} packDate=${packDate}`);
    runInsightDailyCronJob(db, opts).then((summary) => {
      if (summary && summary.failed === 0) {
        lastInsightPackDate = packDate;
      }
    }).catch((e) => {
      console.error('[InsightDaily Cron] failed:', e);
    }).finally(() => {
      isExecuting = false;
    });
  }, 30 * 1000);
  console.log('[InsightDaily Cron] scheduled for %s:00-%s:%s', String(cronHour).padStart(2, '0'), String(cronHour).padStart(2, '0'), WINDOW_MINUTES);
}

async function runBackfill(db, { userId, category, generateFn } = {}) {
  const packDate = dailyPackService.getPackDate();
  const cat = pool.normalizeCategory(category);
  const current = pool.countReady(db, userId, packDate, cat);
  return pool.fillCategory(db, {
    userId,
    packDate,
    category: cat,
    target: current + 1,
    generateFn,
  });
}

module.exports = {
  DEFAULT_HOUR,
  resolveInsightCronHour,
  runInsightDailyCronJob,
  scheduleInsightDailyCron,
  runBackfill,
};
