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
    await asyncio.sleep(3)

    setup = """
    window.__fixResults = [];
    window.__fixDone = false;
    
    (async function runFixTests() {
        const tests = [
            { name: 'TTS_empty', url: '/api/tts/speech', body: {input:'',model:'test'}, timeout: 5000 },
            { name: 'TTS_valid', url: '/api/tts/speech', body: {input:'Hello',model:'edge-tts/en-GB-LibbyNeural'}, timeout: 20000 },
            { name: 'Insight_scenario', url: '/api/insight/listen/scenario', body: {category:'test',userId:'lzhmy'}, timeout: 30000 },
            { name: 'Oral_sandbox', url: '/api/english/oral-sandbox', body: {inputs:{scene_type:'test',roles:'A,B',cultural_context:'test'},conversationId:null,userId:'lzhmy'}, timeout: 60000 },
        ];
        
        for (const t of tests) {
            const start = Date.now();
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), t.timeout);
            try {
                const res = await fetch(t.url, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(t.body),
                    signal: controller.signal
                });
                clearTimeout(timer);
                const text = await res.text();
                window.__fixResults.push({name:t.name, status:res.status, ok:res.ok, ms:Date.now()-start, body:text.slice(0,150)});
            } catch(e) {
                clearTimeout(timer);
                window.__fixResults.push({name:t.name, status:0, ok:false, ms:Date.now()-start, error:e.message});
            }
        }
        window.__fixDone = true;
    })();
    """
    await page.evaluate(setup)
    
    for i in range(120):
        await asyncio.sleep(1)
        done_raw = await page.evaluate('window.__fixDone === true')
        if done_raw:
            break
        if i % 20 == 19:
            print(f"  ... still waiting ({i+1}s)")
            
    results_raw = await page.evaluate("JSON.stringify(window.__fixResults)")
    print("=== Fix Verification Results ===")
    try:
        results = json.loads(results_raw)
        for r in results:
            label = "OK" if r.get('ok') else ("TIMEOUT" if r.get('status') == 0 else "HTTP_ERR")
            print(f"  [{label}] {r['name']}: HTTP {r.get('status')} ({r.get('ms')}ms)")
            if r.get('body'):
                print(f"      -> {r['body'][:120]}")
            if r.get('error'):
                print(f"      -> ERR: {r['error']}")
    except Exception as e:
        print("Raw:", results_raw)

    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
