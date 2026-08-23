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

    # 第四轮：用正确参数测试之前 400 的接口 + 更多功能接口
    setup_js = """
    window.testApi4 = async function() {
        const userId = 'lzhmy';
        const endpoints = [
            { name: 'tts-speech-correct', url: '/api/tts/speech', method: 'POST', body: { text: 'Hello world test', voiceId: 'Libby', userId, ssml: false }, timeout: 30000 },
            { name: 'wakeup-correct', url: '/api/english/wakeup', method: 'POST', body: { userId, theme: '新人报到', scenario: 'morning_routine' }, timeout: 60000 },
            { name: 'grammar-polish-correct', url: '/api/grammar-polish', method: 'POST', body: { originalText: 'I go to school yesterday.', userId }, timeout: 60000 },
            { name: 'pronunciation-correct', url: '/api/pronunciation-assessment', method: 'POST', body: { targetText: 'Hello world', userId, audioData: '' }, timeout: 15000 },
            { name: 'vocab-purify', url: '/api/vocab/purify', method: 'POST', body: { words: ['hello', 'world'], userId }, timeout: 30000 },
            { name: 'game-theory-session-start', url: '/api/game-theory/session/start', method: 'POST', body: { userId, sceneType: 'corp_clash', title: '测试会话' }, timeout: 30000 },
            { name: 'oral-sandbox', url: '/api/english/oral-sandbox', method: 'POST', body: { userId, message: 'Hello', scenario: 'greeting' }, timeout: 30000 },
            { name: 'write-governance', url: '/api/english/write-governance', method: 'POST', body: { userId, text: 'Test writing sample.', mode: 'review' }, timeout: 60000 },
            { name: 'knowledge-vault-extract', url: '/api/knowledge-vault/extract-draft', method: 'POST', body: { userId, content: 'Test content for extraction.' }, timeout: 30000 },
            { name: 'material-upload-check', url: '/api/material/upload', method: 'POST', body: { userId, fileName: 'test.txt', content: 'test' }, timeout: 15000 },
            { name: 'speak-influence', url: '/api/speak/influence', method: 'POST', body: { userId, text: 'Test influence analysis.' }, timeout: 30000 },
            { name: 'read-penetration', url: '/api/read/penetration/analyze', method: 'POST', body: { userId, text: 'Test reading penetration.' }, timeout: 30000 },
            { name: 'insight-listen-scenario', url: '/api/insight/listen/scenario', method: 'GET', timeout: 15000 },
            { name: 'vocab-export-background', url: '/api/vocab/export-background', method: 'POST', body: { userId, format: 'csv' }, timeout: 15000 },
            { name: 'user-error-ledger', url: '/api/user/error-ledger/append', method: 'POST', body: { userId, entry: { scene: 'test', flaw: 'test', fix: 'test' } }, timeout: 10000 }
        ];
        
        window.apiResults4 = [];
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
                window.apiResults4.push({
                    name: ep.name,
                    url: ep.url,
                    status: res.status,
                    ok: res.ok,
                    durationMs: Date.now() - start,
                    textSnippet: text.slice(0, 200)
                });
            } catch(e) {
                clearTimeout(timer);
                window.apiResults4.push({
                    name: ep.name,
                    url: ep.url,
                    status: 0,
                    ok: false,
                    durationMs: Date.now() - start,
                    error: e.message
                });
            }
        }
        window.apiDone4 = true;
    };
    window.testApi4();
    """
    await page.evaluate(setup_js)
    
    for i in range(300):
        await asyncio.sleep(1)
        done = await page.evaluate("window.apiDone4 === true")
        if done:
            break
        if i % 30 == 29:
            print(f"  ... still waiting ({i+1}s)")
            
    results_str = await page.evaluate("JSON.stringify(window.apiResults4)")
    print("API Test Results (Round 4 - Correct params):")
    try:
        data = json.loads(results_str)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except Exception as e:
        print("Raw:", results_str)

    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
