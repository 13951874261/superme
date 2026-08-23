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
    window.__vr = []; window.__vd = false;
    (async function() {
        const tests = [
            { n:'oral-sandbox', u:'/api/english/oral-sandbox', b:{inputs:{scene_type:'t',roles:'A',cultural_context:'t'},userId:'lzhmy'}, t:30000 },
            { n:'insight-scenario', u:'/api/insight/listen/scenario', b:{category:'test',userId:'lzhmy'}, t:30000 },
        ];
        for (const t of tests) {
            const s=Date.now(), c=new AbortController(), tm=setTimeout(()=>c.abort(),t.t);
            try {
                const r=await fetch(t.u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t.b),signal:c.signal});
                clearTimeout(tm);
                const tx=await r.text();
                window.__vr.push({n:t.n,s:r.status,ok:r.ok,ms:Date.now()-s,b:tx.slice(0,150)});
            } catch(e) { clearTimeout(tm); window.__vr.push({n:t.n,s:0,ok:false,ms:Date.now()-s,e:e.message}); }
        }
        window.__vd=true;
    })();
    """
    await page.evaluate(setup)
    for i in range(60):
        await asyncio.sleep(1)
        if await page.evaluate('window.__vd===true'): break
    raw = await page.evaluate("JSON.stringify(window.__vr)")
    data = json.loads(raw)
    for r in data:
        label = "PASS" if r.get('ok') else ("TIMEOUT" if r.get('s')==0 else f"HTTP_{r.get('s')}")
        print(f"[{label}] {r['n']}: {r.get('s')} ({r.get('ms')}ms) -> {r.get('b','')[:100]}{r.get('e','')}")
    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
