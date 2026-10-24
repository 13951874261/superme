import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/lzhumy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const OUT_DIR = path.resolve('dist/e2e-verify');
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.setDefaultTimeout(25000);

const result = {
  url: 'https://app.liujingzhuwo.site/',
  startedAt: new Date().toISOString(),
};

try {
  await page.goto('https://app.liujingzhuwo.site/?v=20260823-verify', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForSelector('input[placeholder="请输入系统解锁秘钥"]', { timeout: 20000 });
  await page.fill('input[placeholder="请输入系统解锁秘钥"]', '1');
  await page.click('button:has-text("解锁登录")');
  await page.waitForSelector('text=当前主题', { timeout: 25000 });
  await page.waitForTimeout(2500);

  result.home = await page.evaluate(() => {
    const body = document.body.innerText || '';
    const themeMatch = body.match(/当前主题[：: ]*([^\n]+)/);
    const weaknessLabel = body.includes('当前全局短板画像');
    const ukAsWeakness = /当前全局短板画像[\s\S]{0,80}英国 \(UK\)/.test(body);
    const noWeakness = body.includes('暂无短板');
    const oldSidebar = body.includes('海外信贷谈判与博弈');
    const negotiation = body.includes('商务谈判：让步与施压');
    return {
      title: document.title,
      currentThemeLine: themeMatch ? themeMatch[0].trim() : null,
      hasWeaknessLabel: weaknessLabel,
      ukAsWeakness,
      noWeakness,
      oldSidebarTheme: oldSidebar,
      negotiationThemeVisible: negotiation,
      snippet: body.slice(0, 2500),
    };
  });
  await page.screenshot({ path: path.join(OUT_DIR, '10-home-theme-weakness.png'), fullPage: true });

  const dash = page.locator('button, a, [role="tab"]').filter({ hasText: '进度总控' }).first();
  if (await dash.count()) {
    await dash.click();
    await page.waitForTimeout(2000);
  }
  result.dashboard = await page.evaluate(() => {
    const body = document.body.innerText || '';
    return {
      hasXinren: body.includes('新人报到'),
      hasNegotiation: body.includes('商务谈判：让步与施压'),
      currentThemeLine: (body.match(/当前主题[：: ]*([^\n]+)/) || [])[0] || null,
    };
  });
  await page.screenshot({ path: path.join(OUT_DIR, '11-dashboard-theme.png') });

  const speech = page.locator('button, a, [role="tab"]').filter({ hasText: '即兴演讲' }).first();
  if (await speech.count()) {
    await speech.click();
    await page.waitForTimeout(2000);
  }
  result.speech = await page.evaluate(() => {
    const body = document.body.innerText || '';
    return {
      hasXinren: body.includes('新人报到'),
      hasHighObstacle: /HIGH-OBSTACLE|已靶向侦测/.test(body),
      ukAsWeakness: body.includes('能力短板') && body.includes('英国 (UK)'),
      currentThemeLine: (body.match(/当前主题[：: ]*([^\n]+)/) || [])[0] || null,
    };
  });
  await page.screenshot({ path: path.join(OUT_DIR, '12-speech-theme.png') });

  await page.locator('[data-task-center-trigger]').click();
  await page.waitForSelector('text=后台任务中心', { timeout: 10000 });
  await page.waitForTimeout(1500);
  result.taskCenter = await page.evaluate(() => {
    const body = document.body.innerText || '';
    return {
      hasTodayRun: body.includes('每日定时任务 2026-08-23') || body.includes('2026-08-23'),
      emptyToday: body.includes('今日尚未调度'),
      hiddenHint: /已隐藏\s*\d+\s*条/.test(body),
      noTasksOldCopy: body.includes('暂无任何后台任务'),
      snippet: body.match(/后台任务中心[\s\S]{0,800}/)?.[0] || body.slice(0, 800),
    };
  });
  await page.screenshot({ path: path.join(OUT_DIR, '13-task-center.png') });

  result.ok = true;
} catch (error) {
  result.ok = false;
  result.error = String(error);
  await page.screenshot({ path: path.join(OUT_DIR, '99-verify-error.png') }).catch(() => {});
} finally {
  result.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, 'verify-3items.json'), JSON.stringify(result, null, 2), 'utf8');
  await browser.close();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}
