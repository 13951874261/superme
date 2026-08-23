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

    # 注入全局错误与请求拦截器
    await page.evaluate("""
    window.__errors = [];
    window.__failedRequests = [];
    
    const origError = console.error;
    console.error = function() {
        window.__errors.push(Array.from(arguments).map(a => String(a)).join(' '));
        origError.apply(console, arguments);
    };
    
    window.addEventListener('error', function(e) {
        window.__errors.push('WindowError: ' + e.message + ' at ' + e.filename + ':' + e.lineno);
    });
    
    window.addEventListener('unhandledrejection', function(e) {
        window.__errors.push('UnhandledRejection: ' + String(e.reason));
    });
    
    const origFetch = window.fetch;
    window.fetch = async function() {
        const url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url || '');
        try {
            const res = await origFetch.apply(this, arguments);
            if (!res.ok) {
                const clone = res.clone();
                let body = '';
                try { body = await clone.text(); } catch(e) {}
                window.__failedRequests.push({
                    url: url,
                    status: res.status,
                    body: body.slice(0, 200)
                });
            }
            return res;
        } catch(err) {
            window.__failedRequests.push({
                url: url,
                status: 0,
                error: err.message
            });
            throw err;
        }
    };
    """)

    # 逐个切换 Tab 并采集错误
    tabs = ['英语学习', '听读', '表达', '精读', '写作', '博弈训练', '高阶审美']
    
    for tab in tabs:
        await page.evaluate("window.__errors = []; window.__failedRequests = [];")
        
        click_result = await page.evaluate(f"""
        (() => {{
            const btns = Array.from(document.querySelectorAll('button'));
            const t = btns.find(b => b.innerText.trim() === '{tab}');
            if (t) {{ t.click(); return true; }}
            return false;
        }})()
        """)
        await asyncio.sleep(3)
        
        errors_str = await page.evaluate("JSON.stringify({errors: window.__errors, failedRequests: window.__failedRequests})")
        print(f"=== {tab} (clicked: {click_result}) ===")
        try:
            data = json.loads(errors_str)
            if data['errors']:
                print(f"  Console Errors ({len(data['errors'])}):")
                for e in data['errors'][:5]:
                    print(f"    - {e[:200]}")
            if data['failedRequests']:
                print(f"  Failed Requests ({len(data['failedRequests'])}):")
                for r in data['failedRequests']:
                    print(f"    - [{r.get('status')}] {r.get('url')}: {r.get('body', r.get('error', ''))[:150]}")
            if not data['errors'] and not data['failedRequests']:
                print("  OK - No errors or failed requests")
        except Exception as e:
            print(f"  Parse error: {e}, raw: {errors_str}")

    # 测试主要功能按钮
    functional_btns = [
        '呼出独立对话大屏',
        '沉浸式专注模式',
        '开始练习',
        '重新生成',
        '完成打卡',
        '刷新词汇',
        '进度总控',
        '生词复习',
        '精听盲听',
        '多角色练习',
        '纵深书面',
        '即兴演讲',
        '查询/生成今日长文',
        '上传材料',
        '开启四维度专属复盘',
        '提交输入并更新训练计划',
        '答疑'
    ]
    
    print("\n=== Functional Button Scan ===")
    for btn_name in functional_btns:
        await page.evaluate("window.__errors = []; window.__failedRequests = [];")
        exists = await page.evaluate(f"""
        (() => {{
            const btns = Array.from(document.querySelectorAll('button'));
            const t = btns.find(b => b.innerText.trim().startsWith('{btn_name}'));
            if (t) {{ t.click(); return true; }}
            return false;
        }})()
        """)
        await asyncio.sleep(1.5)
        
        errors_str = await page.evaluate("JSON.stringify({errors: window.__errors, failedRequests: window.__failedRequests})")
        data = json.loads(errors_str)
        status = 'OK'
        details = ''
        if data['errors']:
            status = 'ERROR'
            details = '; '.join(e[:100] for e in data['errors'][:3])
        if data['failedRequests']:
            status = 'NET_FAIL'
            details = '; '.join(f"[{r.get('status')}] {r.get('url')}" for r in data['failedRequests'][:3])
        
        print(f"  [{status}] {btn_name} (found: {exists}) {details}")

    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
