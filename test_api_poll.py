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
    
    # 将测试结果挂载到 window 对象上，再读取
    setup_js = """
    window.testApi = async function() {
        const userId = 'lzhmy';
        const endpoints = [
            { name: 'login-ping', url: '/api/user/login-ping', method: 'POST', body: { userId } },
            { name: 'theme', url: '/api/user/theme?userId=' + userId, method: 'GET' },
            { name: 'daily-pack', url: '/api/daily-pack/today', method: 'POST', body: { userId, date: '2026-08-23' } },
            { name: 'profile', url: '/api/user/profile/' + userId, method: 'GET' },
            { name: 'tasks', url: '/api/tasks', method: 'GET' },
            { name: 'cron-runs', url: '/api/daily-cron/runs?userId=' + userId + '&days=7', method: 'GET' },
            { name: 'vocab-review', url: '/api/vocab/review?light=1&limit=50&userId=' + userId, method: 'GET' },
            { name: 'knowledge-vault', url: '/api/knowledge-vault/notes?userId=' + userId + '&type=all&includeTraces=1', method: 'GET' },
            { name: 'game-theory-history', url: '/api/game-theory/history?userId=' + userId, method: 'GET' },
            { name: 'aesthetics-daily', url: '/api/aesthetics/daily-push?userId=' + userId, method: 'GET' }
        ];
        
        window.apiResults = [];
        for (const ep of endpoints) {
            try {
                const opt = {
                    method: ep.method,
                    headers: { 'Content-Type': 'application/json' }
                };
                if (ep.body) opt.body = JSON.stringify(ep.body);
                const res = await fetch(ep.url, opt);
                const text = await res.text();
                window.apiResults.push({
                    name: ep.name,
                    url: ep.url,
                    status: res.status,
                    ok: res.ok,
                    textSnippet: text.slice(0, 150)
                });
            } catch(e) {
                window.apiResults.push({
                    name: ep.name,
                    url: ep.url,
                    status: 0,
                    ok: false,
                    error: e.message
                });
            }
        }
        window.apiDone = true;
    };
    window.testApi();
    """
    await page.evaluate(setup_js)
    
    # 轮询 window.apiDone
    for _ in range(20):
        await asyncio.sleep(1)
        done = await page.evaluate("window.apiDone === true")
        if done:
            break
            
    results_str = await page.evaluate("JSON.stringify(window.apiResults)")
    print("API Test Results:")
    try:
        data = json.loads(results_str)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except Exception as e:
        print("Raw:", results_str)

    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
