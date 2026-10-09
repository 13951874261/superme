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

    tests = [
        ('[1] TTS empty', 'fetch("/api/tts/speech",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:"",model:"test"})}).then(async r=>{const t=await r.text();return{ok:r.ok,s:r.status,t:t.slice(0,100)}}).catch(e=>({ok:false,s:0,e:e.message}))'),
        ('[2] TTS valid', 'fetch("/api/tts/speech",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:"Hello test",model:"edge-tts/en-GB-LibbyNeural"})}).then(async r=>{const t=await r.text();return{ok:r.ok,s:r.status,t:t.slice(0,100)}}).catch(e=>({ok:false,s:0,e:e.message}))'),
        ('[3] Insight', 'fetch("/api/insight/listen/scenario",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category:"test",userId:"lzhmy"})}).then(async r=>{const t=await r.text();return{ok:r.ok,s:r.status,t:t.slice(0,150)}}).catch(e=>({ok:false,s:0,e:e.message}))'),
        ('[4] Oral sandbox', 'fetch("/api/english/oral-sandbox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({inputs:{scene_type:"test",roles:"A,B",cultural_context:"test"},conversationId:null,userId:"lzhmy"})}).then(async r=>{const t=await r.text();return{ok:r.ok,s:r.status,t:t.slice(0,150)}}).catch(e=>({ok:false,s:0,e:e.message}))'),
    ]

    for name, js in tests:
        res_raw = await page.evaluate('('+js+')')
        try:
            d = json.loads(res_raw)
            label = "OK" if d.get("ok") else "FAIL"
            print(f"  [{label}] {name}: HTTP {d.get('s')}")
            if d.get("t"):
                print(f"    -> {d['t'][:100]}")
            if d.get("e"):
                print(f"    -> ERR: {d['e']}")
        except:
            print(f"  [PARSE] {name}: {res_raw}")
        await asyncio.sleep(0.3)

    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
