const { chromium } = require('@playwright/test');

function fakeCase(i, prefix = '局内试探') {
  return {
    id: `c${prefix}-${i}`,
    fingerprint: `fp${prefix}-${i}`,
    success: true,
    draft: {
      sceneTitle: `${prefix} ${i}`,
      sceneSummary: `摘要${i}`,
      characters: [],
      infoMatrix: [],
      phases: [1, 2, 3, 4].map((phaseId) => ({
        phaseId,
        title: `阶段${phaseId}`,
        targetDuration: '',
        targetWordsRange: '',
        targetRatio: 0.25,
        content: `对白${i}-${phaseId}`,
      })),
    },
    evaluation: {
      totalWords: 2200,
      estimatedMinutes: 8.8,
      passedDuration: true,
      scriptScore: 90,
      passedScript: true,
    },
    quality: 'ok',
    scenario: `场景正文 ${i}`,
  };
}

function categoryFromUrl(url) {
  try {
    return new URL(url).searchParams.get('category') || '体制内';
  } catch {
    return '体制内';
  }
}

(async () => {
  let backfillHits = 0;
  let scenarioHits = 0;
  let releasedExtra = 0;
  let pendingExtra = 0;
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--disable-software-rasterizer'],
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(() => {
    localStorage.setItem('superme_last_review_date', String(Date.now()));
    localStorage.removeItem('super_agent_pending_debt');
    localStorage.setItem('super_agent_bg_enabled', 'false');
  });
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes('/api/insight/listen/pool/backfill') && method === 'POST') {
      backfillHits += 1;
      pendingExtra += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, taskId: 'task_insight_case_backfill_e2e', status: 'running' }),
      });
    }
    if (url.includes('/api/insight/listen/pool') && method === 'GET') {
      const category = categoryFromUrl(url);
      let cases = [];
      if (category === '外企' || category === '外企职场') {
        cases = [1, 2].map((i) => fakeCase(i, '外企试探'));
      } else if (category === '通用社交') {
        cases = [];
      } else {
        cases = Array.from({ length: 10 + releasedExtra }, (_, idx) => fakeCase(idx + 1));
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          packDate: '2026-08-23',
          category: category.includes('外企') ? '外企' : category === '通用社交' ? '通用社交' : '体制内',
          target: 10,
          readyCount: cases.length,
          cases,
        }),
      });
    }
    if (url.includes('/api/insight/listen/scenario')) {
      scenarioHits += 1;
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'forbidden' }) });
    }
    if (url.includes('/api/tasks/task_insight_case_backfill_e2e')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          id: 'task_insight_case_backfill_e2e',
          type: 'insight_case_backfill',
          name: '洞察案例后台生成 · 体制内',
          status: 'running',
          progress: 40,
          logs: ['后台生成中，请稍后在任务中心查看'],
        }),
      });
    }
    return route.continue();
  });

  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByPlaceholder('请输入系统解锁秘钥').fill('1');
  const alias = page.getByPlaceholder('请输入您的固定账号ID');
  if (await alias.count()) await alias.fill('lzhmy');
  await page.getByRole('button', { name: '解锁登录' }).click();
  await page.getByRole('button', { name: /听读/ }).waitFor({ timeout: 15000 });
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('navigate-insight-listen'));
  });
  await page.getByRole('button', { name: '刷新案例' }).waitFor({ timeout: 15000 });
  const enterStarted = Date.now();
  await page.getByText('局内试探 1', { exact: true }).waitFor({ timeout: 15000 });
  const enterMs = Date.now() - enterStarted;
  if (enterMs > 1000) {
    throw new Error(`LS-POOL-01 enter took ${enterMs}ms after module mount`);
  }

  const refresh = page.getByRole('button', { name: '刷新案例' });
  for (let i = 2; i <= 10; i += 1) {
    await refresh.click({ force: true });
    await page.getByText(`局内试探 ${i}`, { exact: true }).waitFor();
  }
  await refresh.click({ force: true });
  await refresh.click({ force: true });
  await page.getByText('后台生成中，请稍后在任务中心查看').waitFor({ timeout: 8000 });
  await page.getByText('局内试探 10', { exact: true }).waitFor();

  await page.getByTitle('查看后台任务中心').click({ force: true });
  await page.getByText('后台任务中心').waitFor();
  await page.getByText('洞察案例后台生成 · 体制内').waitFor();

  await page.locator('div.fixed.inset-0.z-\\[90\\]').click({ force: true });
  await page.locator('div.fixed.inset-0.z-\\[90\\]').waitFor({ state: 'hidden', timeout: 5000 });
  releasedExtra = pendingExtra;
  await page.getByRole('button', { name: '刷新案例' }).click({ force: true });
  try {
    await page.getByText('局内试探 11', { exact: true }).waitFor({ timeout: 8000 });
  } catch (err) {
    const dump = await page.evaluate(() => (document.body.textContent || '').replace(/\s+/g, ' ').slice(0, 1200));
    console.log('DEBUG missing 11', dump);
    throw err;
  }

  await page.getByRole('button', { name: /外企职场/ }).click({ force: true });
  await page.getByText('外企试探 1', { exact: true }).waitFor({ timeout: 8000 });

  await page.getByRole('button', { name: '通用社交' }).click({ force: true });
  await page.getByText('今日案例尚未就绪，后台生成中，请稍后在任务中心查看').waitFor({ timeout: 8000 });

  if (scenarioHits !== 0) {
    throw new Error(`live scenario called ${scenarioHits} times`);
  }
  if (backfillHits < 2) {
    throw new Error(`expected >=2 backfill (exhaust + empty), got ${backfillHits}`);
  }
  console.log(`E2E PASS: enter ${enterMs}ms, 10 unique, exhaust keeps 10, task center, new 11, 外企独立, empty 通用社交, no live Dify`);
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
