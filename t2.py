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

    # 单独测试 insight 用 120s 超时
    setup = """
    window.__ir = null; window.__id = false;
    (async function() {
        const s=Date.now(), c=new AbortController(), tm=setTimeout(()=>c.abort(),120000);
        try {
            const r=await fetch('/api/insight/listen/scenario',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:'business',userId:'lzhmy'}),signal:c.signal});
            clearTimeout(tm);
            const tx=await r.text();
            window.__ir={s:r.status,ok:r.ok,ms:Date.now()-s,b:tx.slice(0,300)};
        } catch(e) { clearTimeout(tm); window.__ir={s:0,ok:false,ms:Date.now()-s,e:e.message}; }
        window.__id=true;
    })();
    """
    await page.evaluate(setup)
    for i in range(130):
        await asyncio.sleep(1)
        if await page.evaluate('window.__id===true'): break
        if i % 20 == 19: print(f"  waiting... ({i+1}s)")
    raw = await page.evaluate("JSON.stringify(window.__ir)")
    print("Insight scenario result:", raw)
    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
