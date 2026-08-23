import nodriver as uc
import asyncio, sys, json
sys.stdout.reconfigure(encoding='utf-8')

async def main():
    browser = await uc.start(headless=True)
    page = await browser.get('https://app.liujingzhuwo.site/')
    await asyncio.sleep(2)
    
    pwd = await page.select('input[type="password"]')
    if pwd:
        await pwd.send_keys('1')
        await asyncio.sleep(0.5)
    btn = await page.select('button')
    if btn:
        await btn.click()
    await asyncio.sleep(4)

    # 测试超时接口，使用 60 秒超时
    setup_js = """
    window.testApi3 = async function() {
        const userId = 'lzhmy';
        const endpoints = [
            { name: 'aesthetics-daily-push', url: '/api/aesthetics/daily-push?userId=' + userId, method: 'GET', timeout: 60000 },
            { name: 'aesthetics-regenerate', url: '/api/aesthetics/daily-push/regenerate', method: 'POST', body: { userId }, timeout: 60000 },
            { name: 'dict-query-en-en', url: '/api/dify/dict-query', method: 'POST', body: { word: 'hello', mode: 'en_en_dict', userId }, timeout: 120000 },
            { name: 'dict-query-zh-dict', url: '/api/dify/dict-query', method: 'POST', body: { word: '策略', mode: 'zh_dict', userId }, timeout: 120000 },
            { name: 'memory-recall', url: '/api/user/memory/recall?userId=' + userId + '&query=英语', method: 'GET', timeout: 15000 },
            { name: 'profile-save', url: '/api/user/profile/save', method: 'POST', body: { userId, profileContent: '', errorLedger: '{}' }, timeout: 15000 }
        ];
        
        window.apiResults3 = [];
        for (const ep of endpoints) {
            const start = Date.now();
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), ep.timeout);
            try {
                const opt = {
                    method: ep.method,
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal
                };
                if (ep.body) opt.body = JSON.stringify(ep.body);
                const res = await fetch(ep.url, opt);
                clearTimeout(timer);
                const text = await res.text();
                window.apiResults3.push({
                    name: ep.name,
                    url: ep.url,
                    status: res.status,
                    ok: res.ok,
                    durationMs: Date.now() - start,
                    textSnippet: text.slice(0, 300)
                });
            } catch(e) {
                clearTimeout(timer);
                window.apiResults3.push({
                    name: ep.name,
                    url: ep.url,
                    status: 0,
                    ok: false,
                    durationMs: Date.now() - start,
                    error: e.message
                });
            }
        }
        window.apiDone3 = true;
    };
    window.testApi3();
    """
    await page.evaluate(setup_js)
    
    # 轮询，最多等 180 秒
    for i in range(180):
        await asyncio.sleep(1)
        done = await page.evaluate("window.apiDone3 === true")
        if done:
            break
        if i % 30 == 29:
            print(f"  ... still waiting ({i+1}s)")
            
    results_str = await page.evaluate("JSON.stringify(window.apiResults3)")
    print("API Test Results (Round 3 - Timeout/Heavy endpoints):")
    try:
        data = json.loads(results_str)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except Exception as e:
        print("Raw:", results_str)

    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
