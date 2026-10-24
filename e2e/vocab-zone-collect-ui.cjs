/**
 * 收录分区双按钮 UI 验收（线上）
 * 运行：node e2e/vocab-zone-collect-ui.cjs
 */
const { chromium } = require('@playwright/test');

const BASE = process.env.E2E_BASE_URL || 'https://app.liujingzhuwo.site';
const USER = process.env.E2E_USER_ID || 'lzhumy';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--disable-software-rasterizer'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const t0 = Date.now();

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const accountInput = page.locator('input[type="text"], input:not([type="hidden"])').first();
    await accountInput.waitFor({ state: 'visible', timeout: 30000 });
    await accountInput.fill(USER);
    await page.getByRole('button', { name: /进入|验证|登录|确认|提交/i }).first().click({ timeout: 15000 }).catch(async () => {
      await page.locator('form').first().press('Enter');
    });

    await page.waitForFunction(
      () => !document.body.innerText.includes('请输入受邀账号') || document.body.innerText.includes('进度总控'),
      { timeout: 60000 },
    );

    const sidebarToggle = page.getByRole('button', { name: /展开侧边栏|收起侧边栏/i }).first();
    if (await sidebarToggle.isVisible().catch(() => false)) {
      const label = await sidebarToggle.getAttribute('aria-label');
      if (label && label.includes('展开')) {
        await sidebarToggle.click();
        await page.waitForTimeout(400);
      }
    }

    const englishTab = page.getByRole('button', { name: /英语学习/i }).first();
    if (await englishTab.isVisible().catch(() => false)) {
      await englishTab.click();
    }

    const dashboardTab = page.getByRole('button', { name: /进度总控/i }).first();
    if (await dashboardTab.isVisible().catch(() => false)) {
      await dashboardTab.click();
    }

    const utilityToggle = page.getByRole('button', { name: /Utility Tools/i }).first();
    await utilityToggle.waitFor({ state: 'visible', timeout: 30000 });
    await utilityToggle.scrollIntoViewIfNeeded();
    await utilityToggle.click();
    await page.waitForTimeout(500);

    const enZhDict = page.getByRole('button', { name: /英汉双向译制/i }).first();
    await enZhDict.waitFor({ state: 'visible', timeout: 15000 });
    await enZhDict.click();
    await page.waitForTimeout(300);

    const dictInput = page.getByPlaceholder('切入精准词条...');
    await dictInput.waitFor({ state: 'visible', timeout: 45000 });
    await dictInput.fill('legal');
    await dictInput.press('Enter');

    const bizBtn = page.getByRole('button', { name: /\+ 政商务/i }).first();
    const genBtn = page.getByRole('button', { name: /\+ 全场景/i }).first();
    await bizBtn.waitFor({ state: 'visible', timeout: 90000 });
    await genBtn.waitFor({ state: 'visible', timeout: 10000 });

    const bizCount = await page.getByRole('button', { name: /\+ 政商务/i }).count();
    const genCount = await page.getByRole('button', { name: /\+ 全场景/i }).count();
    if (bizCount < 1 || genCount < 1) {
      throw new Error(`双按钮未出现：政商务=${bizCount} 全场景=${genCount}`);
    }

    console.log(`PASS vocab-zone-collect-ui ${Date.now() - t0}ms`);
    console.log(`  base=${BASE} user=${USER} dualButtons business=${bizCount} general=${genCount}`);
    process.exit(0);
  } catch (err) {
    console.error('FAIL vocab-zone-collect-ui', err.message || err);
    try {
      await page.screenshot({ path: 'e2e/vocab-zone-collect-ui-fail.png', fullPage: true });
      console.error('  screenshot=e2e/vocab-zone-collect-ui-fail.png');
    } catch (_) {}
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
