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

    # 逐个测试，避免互相阻塞
    endpoints = [
        ('oral-sandbox-fix', '/api/english/oral-sandbox', 'POST', { inputs: { scene_type: 'test', roles: 'A,B', cultural_context: 'test' }, conversationId: None, userId: 'lzhmy' }, 30000),
        ('insight-listen-fix', '/api/insight/listen/scenario', 'POST', { category: 'business', userId: 'lzhmy' }, 30000),
        ('tts-empty-guard', '/api/tts/speech', 'POST', { input: '', model: 'test' }, 5000),
        ('tts-valid', '/api/tts/speech', 'POST', { input: 'Hello test', model: 'edge-tts/en-GB-LibbyNeural' }, 20000),
    ]
    
    print("=== Red Team Verification Results ===")
    for name, url, method, body, timeout in endpoints:
        js = f"""
        (async () => {{
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), {timeout});
            try {{
                const res = await fetch('{url}', {{
                    method: '{method}',
                    headers: {{'Content-Type': 'application/json'}},
                    body: JSON.stringify({json.dumps(body)}),
                    signal: controller.signal
                }});
                clearTimeout(timer);
                const text = await res.text();
                return JSON.stringify({{status: res.status, ok: res.ok, text: text.slice(0, 150)}});
            }} catch(e) {{
                clearTimeout(timer);
                return JSON.stringify({{status: 0, ok: false, error: e.message}});
            }}
        }})()
        """
        res = await page.evaluate(js)
        try:
            data = json.loads(res)
            status_label = "OK" if data.get('ok') else "FAIL"
            if data.get('status') == 0:
                status_label = "ERROR"
            print(f"[{status_label}] {name}: HTTP {data.get('status', '?')}")
            if data.get('text'):
                print(f"    Response: {data['text'][:120]}")
            if data.get('error'):
                print(f"    Error: {data['error']}")
        except:
            print(f"[PARSE_ERROR] {name}: {res}")
        await asyncio.sleep(0.5)

    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
