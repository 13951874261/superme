const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { gunzipSync } = require('node:zlib');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    await page.route('**/api/**', route => {
      const url = route.request().url();
      if (url.endsWith('/api/auth/session')) return route.fulfill({ json: { authenticated: true, userId: 'embed-fixture@example.com' } });
      if (url.includes('/api/dify/embed-session')) return route.fulfill({ json: { conversationId: null, sessionUserId: 'fixture-session' } });
      return route.fulfill({ status: 503, json: { success: false, error: '测试替身未提供此接口' } });
    });
    await page.route('https://dify.234124123.xyz/**', route => route.request().resourceType() === 'script'
      ? route.fulfill({ contentType: 'application/javascript', body: '' })
      : route.fulfill({ contentType: 'text/html', body: '<p>Dify 测试替身，不发送真实会话</p>' }));
    await page.addInitScript(() => {
      localStorage.setItem('super_agent_user_id', 'embed-fixture@example.com');
      localStorage.setItem('sa_learn:embed-fixture@example.com:User_Current_Profile', '目标：沟通清晰；弱点：表达缺乏条理');
      localStorage.removeItem('dify_embed_input_overrides');
    });
    await page.goto('https://app.liujingzhuwo.site/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('toggle-right-panel', { detail: { open: true, tab: 'assistant' } })));
    const iframe = page.locator('iframe[title="全局 AI 助手"]');
    await iframe.waitFor({ state: 'attached', timeout: 15000 });
    const decode = value => gunzipSync(Buffer.from(value, 'base64')).toString('utf8');
    let params = new URL(await iframe.getAttribute('src')).searchParams;
    assert.equal(decode(params.get('app_user_id')), 'embed-fixture@example.com');
    assert.equal(decode(params.get('memory_pack')), '目标：沟通清晰; 弱点：表达缺乏条理');
    assert.equal(await iframe.evaluate(el => getComputedStyle(el).minHeight), '700px');
    await page.getByRole('button', { name: '对话设置', exact: true }).click();
    const account = page.locator('input[readonly]');
    assert.equal(await account.inputValue(), 'embed-fixture@example.com');
    await page.getByPlaceholder('留空时使用「专属复盘与弱点扫描」的当前短板画像').fill('测试手填说明');
    await page.getByRole('button', { name: '保存并重新打开', exact: true }).click();
    await page.waitForTimeout(1000);
    params = new URL(await iframe.getAttribute('src')).searchParams;
    assert.equal(decode(params.get('memory_pack')), '测试手填说明');
    console.log('线上发布资源浏览器验证通过：账号、默认画像、手填优先、只读账号、700px。API 与 Dify 使用测试替身，不代表真实登录及 Dify 回复验证。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
