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

    # 红队验证：之前 404 的两个接口
    setup_js = """
    window.testFix = async function() {
        const userId = 'lzhmy';
        const endpoints = [
            { name: 'oral-sandbox-fix', url: '/api/english/oral-sandbox', method: 'POST', body: { inputs: { scene_type: 'test', roles: 'A,B', cultural_context: 'test' }, conversationId: null, userId }, timeout: 30000 },
            { name: 'insight-listen-fix', url: '/api/insight/listen/scenario', method: 'POST', body: { category: 'business', userId }, timeout: 30000 },
            { name: 'tts-empty-guard', url: '/api/tts/speech', method: 'POST', body: { input: '', model: 'test' }, timeout: 5000 },
            { name: 'tts-valid', url: '/api/tts/speech', method: 'POST', body: { input: 'Hello test', model: 'edge-tts/en-GB-LibbyNeural' }, timeout: 15000 }
        ];
        
        window.fixResults = [];
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
                window.fixResults.push({
                    name: ep.name,
                    url: ep.url,
                    status: res.status,
                    ok: res.ok,
                    durationMs: Date.now() - start,
                    textSnippet: text.slice(0, 200)
                });
            } catch(e) {
                clearTimeout(timer);
                window.fixResults.push({
                    name: ep.name,
                    url: ep.url,
                    status: 0,
                    ok: false,
                    durationMs: Date.now() - start,
                    error: e.message
                });
            }
        }
        window.fixDone = true;
    };
    window.testFix();
    """
    await page.evaluate(setup_js)
    
    for i in range(60):
        await asyncio.sleep(1)
        done = await page.evaluate("window.fixDone === true")
        if done:
            break
        if i % 15 == 14:
            print(f"  ... waiting ({i+1}s)")
            
    results_str = await page.evaluate("JSON.stringify(window.fixResults)")
    print("=== Red Team Verification Results ===")
    try:
        data = json.loads(results_str)
        for item in data:
            status_label = "OK" if item.get('ok') else "FAIL"
            if item.get('status') == 0:
                status_label = "ERROR"
            print(f"[{status_label}] {item['name']}: HTTP {item.get('status', '?')} ({item.get('durationMs', '?')}ms)")
            if item.get('textSnippet'):
                print(f"    Response: {item['textSnippet'][:150]}")
            if item.get('error'):
                print(f"    Error: {item['error']}")
    except Exception as e:
        print("Raw:", results_str)

    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
