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

    # 第二轮：测试功能性接口
    setup_js = """
    window.testApi2 = async function() {
        const userId = 'lzhmy';
        const endpoints = [
            { name: 'aesthetics-daily', url: '/api/aesthetics/daily-push?userId=' + userId, method: 'GET' },
            { name: 'daily-quota', url: '/api/daily-quota/status?userId=' + userId, method: 'GET' },
            { name: 'tts-speech', url: '/api/tts/speech', method: 'POST', body: { text: 'Hello test', voiceId: 'Libby', userId } },
            { name: 'dict-query-zh', url: '/api/dify/dict-query', method: 'POST', body: { word: '测试', mode: 'zh_dict', userId }, timeout: 10000 },
            { name: 'wakeup-routine', url: '/api/english/wakeup', method: 'POST', body: { userId, theme: '新人报到' }, timeout: 10000 },
            { name: 'daily-extract-article', url: '/api/english/daily-extract/article?userId=' + userId, method: 'GET' },
            { name: 'grammar-polish', url: '/api/grammar-polish', method: 'POST', body: { text: 'I go to school yesterday.', userId }, timeout: 10000 },
            { name: 'pronunciation-assess', url: '/api/pronunciation-assessment', method: 'POST', body: { text: 'Hello world', userId }, timeout: 10000 },
            { name: 'game-theory-sessions', url: '/api/game-theory/sessions?userId=' + userId, method: 'GET' },
            { name: 'game-theory-cases-push', url: '/api/game-theory/cases/push?userId=' + userId + '&scene=corp_conflict', method: 'GET' },
            { name: 'material-list', url: '/api/material', method: 'GET' },
            { name: 'listen-pregen', url: '/api/listen/generate-material-long', method: 'POST', body: { userId, theme: '商务会议' }, timeout: 10000 }
        ];
        
        window.apiResults2 = [];
        for (const ep of endpoints) {
            const timeout = ep.timeout || 8000;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeout);
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
                window.apiResults2.push({
                    name: ep.name,
                    url: ep.url,
                    status: res.status,
                    ok: res.ok,
                    textSnippet: text.slice(0, 200)
                });
            } catch(e) {
                clearTimeout(timer);
                window.apiResults2.push({
                    name: ep.name,
                    url: ep.url,
                    status: 0,
                    ok: false,
                    error: e.message
                });
            }
        }
        window.apiDone2 = true;
    };
    window.testApi2();
    """
    await page.evaluate(setup_js)
    
    for _ in range(30):
        await asyncio.sleep(1)
        done = await page.evaluate("window.apiDone2 === true")
        if done:
            break
            
    results_str = await page.evaluate("JSON.stringify(window.apiResults2)")
    print("API Test Results (Round 2):")
    try:
        data = json.loads(results_str)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except Exception as e:
        print("Raw:", results_str)

    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
