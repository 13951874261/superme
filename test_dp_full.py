import sys, time, json
sys.stdout.reconfigure(encoding='utf-8')
from DrissionPage import ChromiumPage, ChromiumOptions

co = ChromiumOptions()
co.headless(True)
co.set_argument('--no-sandbox')
co.set_argument('--disable-gpu')
co.auto_port()

page = ChromiumPage(co)
try:
    page.get('https://app.liujingzhuwo.site/')
    time.sleep(2)
    
    pwd_inp = page.ele('tag:input@type=password')
    if pwd_inp:
        pwd_inp.input('1', clear=True)
    btn = page.ele('text:解锁登录')
    if btn:
        btn.click()
    time.sleep(3)
    
    # 注入拦截器（在登录完成后注入）
    page.run_js("""
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
    
    # 测试顶栏 Tab
    tabs = ['英语学习', '听读', '表达', '精读', '写作', '博弈训练', '高阶审美']
    
    for tab_name in tabs:
        page.run_js("window.__errors = []; window.__failedRequests = [];")
        tab_btn = page.ele(f'text={tab_name}')
        if not tab_btn:
            print(f'=== {tab_name}: NOT FOUND ===')
            continue
        tab_btn.click()
        time.sleep(2.5)
        
        result_raw = page.run_js("return JSON.stringify({errors: window.__errors, failedReqs: window.__failedRequests})")
        data = json.loads(result_raw)
        print(f'=== {tab_name} ===')
        if data['errors']:
            print(f'  Console Errors ({len(data["errors"])}):')
            for e in data['errors'][:5]:
                print(f'    - {e[:200]}')
        if data['failedReqs']:
            print(f'  Failed Requests ({len(data["failedReqs"])}):')
            for r in data['failedReqs']:
                print(f'    - [{r.get("status")}] {r.get("url")}: {r.get("body", r.get("error", ""))[:120]}')
        if not data['errors'] and not data['failedReqs']:
            print('  OK')

    # 测试功能按钮
    print('\n=== Functional Buttons ===')
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
        '答疑'
    ]
    
    for bname in functional_btns:
        page.run_js("window.__errors = []; window.__failedRequests = [];")
        b = page.ele(f'text={bname}')
        found = bool(b)
        if b:
            try:
                b.click()
            except Exception:
                pass
        time.sleep(1.5)
        
        result_raw = page.run_js("return JSON.stringify({errors: window.__errors, failedReqs: window.__failedRequests})")
        data = json.loads(result_raw)
        status = 'OK'
        details = ''
        if data['errors']:
            status = 'CONSOLE_ERROR'
            details = '; '.join(e[:100] for e in data['errors'][:3])
        if data['failedReqs']:
            status = 'NET_FAIL'
            details = '; '.join(f"[{r.get('status')}] {r.get('url')}" for r in data['failedReqs'][:3])
        print(f'  [{status}] {bname} (found:{found}) {details}')

finally:
    page.quit()
