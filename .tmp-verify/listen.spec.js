import { test, expect } from '@playwright/test';

test('verify listen tab duration dropdown', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '精听盲听' }).click();
  await expect(page.getByText('Daily Interception')).toBeVisible();
  await expect(page.getByText('Shadowing Dictation')).toBeVisible();

  const selects = page.locator('select');
  const count = await selects.count();
  const data = [];
  for (let i = 0; i < count; i++) {
    const options = await selects.nth(i).locator('option').allTextContents();
    data.push(options.map(v => v.trim()));
  }

  console.log('SELECT_OPTIONS_JSON:' + JSON.stringify({ selectCount: count, options: data }, null, 2));
  await page.screenshot({ path: 'listen-tab-verification.png', fullPage: true });
});
