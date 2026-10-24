import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/lzhumy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const OUT_DIR = path.resolve('dist/e2e-verify');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
await page.goto('https://app.liujingzhuwo.site/?v=20260823-verify2', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.fill('input[placeholder="请输入系统解锁秘钥"]', '1');
await page.click('button:has-text("解锁登录")');
await page.waitForSelector('text=当前主题', { timeout: 25000 });
await page.waitForTimeout(2000);

const loc = await page.evaluate(() => {
  const needle = '商务谈判：让步与施压';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const hits = [];
  while (walker.nextNode()) {
    const t = walker.currentNode.textContent || '';
    if (t.includes(needle)) {
      const el = walker.currentNode.parentElement;
      hits.push({
        text: t.trim().slice(0, 160),
        tag: el?.tagName,
        className: (el?.className || '').toString().slice(0, 120),
      });
    }
  }
  const weakness = [...document.querySelectorAll('p, span, div')]
    .find((el) => el.previousElementSibling?.textContent?.includes('当前全局短板画像') || el.textContent === '暂无短板' || el.textContent === '英国 (UK)');
  return {
    negotiationHits: hits,
    weaknessNearby: weakness ? weakness.textContent.trim().slice(0, 80) : null,
    weaknessBlock: (document.body.innerText.match(/当前全局短板画像[\s\S]{0,120}/) || [])[0] || null,
  };
});

const weakness = page.locator('text=当前全局短板画像').first();
if (await weakness.count()) {
  await weakness.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, '14-review-weakness.png') });
}

fs.writeFileSync(path.join(OUT_DIR, 'verify-3items-followup.json'), JSON.stringify(loc, null, 2), 'utf8');
console.log(JSON.stringify(loc, null, 2));
await browser.close();
