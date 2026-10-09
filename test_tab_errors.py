import nodriver as uc
import asyncio, sys, json
sys.stdout.reconfigure(encoding='utf-8')

async def main():
    browser = await uc.start(headless=True)
    page = await browser.get('https://app.liujingzhuwo.site/')
    
    # 注入网络与控制台拦截器
    await page.evaluate("""
    window.__capturedErrors = [];
    window.__capturedRequests = [];
    
    // 拦截 console.error
    const origError = console.error;
    console.error = function(...args) {
        window.__capturedErrors.push({ type: 'console.error', text: args.map(a => String(a)).join(' ') });
        origError.apply(console, args);
    };
    
    // 拦截 window.onerror
    window.addEventListener('error', function(e) {
        window.__capturedErrors.push({ type: 'window.error', text: e.message, filename: e.filename, lineno: e.lineno });
    });
    
    // 拦截 fetch
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        const method = (args[1] && args[1].method) || 'GET';
        try {
            const res = await origFetch.apply(this, args);
            if (!res.ok) {
                const clone = res.clone();
                let body = '';
                try { body = await clone.text(); } catch(err) {}
                window.__capturedRequests.push({
                    url: url,
                    method: method,
                    status: res.status,
                    statusText: res.statusText,
                    responseBody: body.slice(0, 500)
                });
            }
            return res;
        } catch(err) {
            window.__capturedRequests.push({
                url: url,
                method: method,
                status: 0,
                error: err.message
            });
            throw err;
        }
    };
    """)
    
    # 登录
    await page.evaluate("""
        const pwdInput = document.querySelector('input[type="password"]');
        if (pwdInput) {
            pwdInput.focus();
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(pwdInput, '1');
            pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
            pwdInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('解锁登录'));
        if (btn) btn.click();
    """)
    await asyncio.sleep(4)
    
    # 菜单列表
    menu_tabs = [
        '英语学习',
        '听读',
        '表达',
        '精读',
        '写作',
        '博弈训练',
        '高阶审美',
        '每周一聊'
    ]
    
    results = {}
    
    for tab in menu_tabs:
        # 清空当前捕获
        await page.evaluate("window.__capturedErrors = []; window.__capturedRequests = [];")
        
        # 点击菜单
        clicked = await page.evaluate(f"""
        (() => {{
            const btns = Array.from(document.querySelectorAll('button'));
            const target = btns.find(b => b.innerText.trim() === '{tab}');
            if (target) {{
                target.click();
                return true;
            }}
            return false;
        }})()
        """)
        await asyncio.sleep(2)
        
        # 抓取页面上的报错与弹窗、网络错误
        tab_report = await page.evaluate("""
        (() => {
            const errDivs = Array.from(document.querySelectorAll('.text-red-500, .text-rose-500, .bg-red-50, .border-red-500, [role="alert"]'))
                .map(e => e.innerText.trim())
                .filter(t => t.length > 2 && !t.includes('睡眠') && !t.includes('饮食') && !t.includes('运动') && !t.includes('行善'));
                
            return JSON.stringify({
                uiErrors: errDivs,
                netErrors: window.__capturedRequests,
                consoleErrors: window.__capturedErrors
            });
        })()
        """)
        
        results[tab] = {
            'clicked': clicked,
            'report': json.loads(tab_report)
        }
        print(f"[{tab}] Clicked: {clicked}")
        print(f"    UI Errors: {results[tab]['report']['uiErrors']}")
        print(f"    Net Errors: {len(results[tab]['report']['netErrors'])}")
        print(f"    Console Errors: {len(results[tab]['report']['consoleErrors'])}")
        for ne in results[tab]['report']['netErrors']:
            print(f"      -> {ne['method']} {ne['url']} [{ne['status']}]: {ne.get('responseBody')}")
        for ce in results[tab]['report']['consoleErrors']:
            print(f"      -> Console: {ce['text']}")
            
    print("\n--- Summary All ---")
    print(json.dumps(results, ensure_ascii=False, indent=2))
    
    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
