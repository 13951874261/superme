import nodriver as uc
import asyncio, sys, json
sys.stdout.reconfigure(encoding="utf-8")

async def main():
    browser = await uc.start(headless=True)
    page = await browser.get("https://app.liujingzhuwo.site/")
    await asyncio.sleep(2)
    
    pwd = await page.select("input[type="password"]")
    if pwd:
        await pwd.send_keys("1")
        await asyncio.sleep(0.5)
    btn = await page.select("button")
    if btn:
        await btn.click()
    await asyncio.sleep(3)

    # Test 1: TTS with empty input - should not crash, should get friendly error
    js1 = """
    (async () => {
        try {
            const res = await fetch("/api/tts/speech", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ input: "", model: "test" })
            });
            const text = await res.text();
            return { ok: res.ok, status: res.status, text: text.slice(0, 100) };
        } catch(e) { return { ok: false, status: 0, error: e.message }; }
    })()
    """
    res1 = await page.evaluate(js1)
    r1 = json.loads(res1)
    print(f"[1] TTS empty input: ok={r1['ok']} status={r1.get('status')} text={r1.get('text')[:80]}")
    
    # Test 2: TTS with valid input
    js2 = """
    (async () => {
        try {
            const res = await fetch("/api/tts/speech", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ input: "Hello test", model: "edge-tts/en-GB-LibbyNeural" })
            });
            const text = await res.text();
            return { ok: res.ok, status: res.status, text: text.slice(0, 100) };
        } catch(e) { return { ok: false, status: 0, error: e.message }; }
    })()
    """
    res2 = await page.evaluate(js2)
    r2 = json.loads(res2)
    print(f"[2] TTS valid input: ok={r2['ok']} status={r2.get("status")} text={r2.get("text")[:80]}")
    
    # Test 3: Insight scenario with valid params
    js3 = """
    (async () => {
        try {
            const res = await fetch("/api/insight/listen/scenario", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ category: "test", userId: "lzhmy" })
            });
            const text = await res.text();
            return { ok: res.ok, status: res.status, text: text.slice(0, 150) };
        } catch(e) { return { ok: false, status: 0, error: e.message }; }
    })()
    """
    res3 = await page.evaluate(js3)
    r3 = json.loads(res3)
    print(f"[3] Insight scenario: ok={r3['ok']} status={r3.get("status")} text={r3.get("text")[:80]}")
    
    # Test 4: Oral sandbox with valid params
    js4 = """
    (async () => {
        try {
            const res = await fetch("/api/english/oral-sandbox", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ inputs: { scene_type: "test", roles: "A,B", cultural_context: "test" }, conversationId: null, userId: "lzhmy" })
            });
            const text = await res.text();
            return { ok: res.ok, status: res.status, text: text.slice(0, 150) };
        } catch(e) { return { ok: false, status: 0, error: e.message }; }
    })()
    """
    res4 = await page.evaluate(js4)
    r4 = json.loads(res4)
    print(f"[4] Oral sandbox: ok={r4['ok']} status={r4.get("status")} text={r4.get("text")[:80]}")
    
    browser.stop()

if __name__ == "__main__":
    asyncio.run(main())
