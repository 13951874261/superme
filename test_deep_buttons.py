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
    page.ele('text:解锁登录').click()
    time.sleep(3)
    
    # 注入拦截器
    page.run_js("""
    window.__errors = [];
    window.__failedReqs = [];
    const origFetch = window.fetch;
    window.fetch = async function() {
        const url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url || '');
        try {
            const res = await origFetch.apply(this, arguments);
            if (!res.ok) {
                const clone = res.clone();
                let body = ''; try { body = await clone.text(); } catch(e) {}
                window.__failedReqs.push({ url, status: res.status, body: body.slice(0, 200) });
            }
            return res;
        } catch(err) {
            window.__failedReqs.push({ url, status: 0, error: err.message });
            throw err;
        }
    };
    window.addEventListener('unhandledrejection', e => window.__errors.push('Rejection: ' + String(e.reason)));
    const origErr = console.error;
    console.error = function() {
        window.__errors.push(Array.from(arguments).map(String).join(' '));
        origErr.apply(console, arguments);
    };
    """)
    
    # 测试词典按钮
    print("=== 词典工具测试 ===")
    for dict_name in ['现代汉语词典', '英英词典', '英汉双向译制']:
        page.run_js("window.__errors = []; window.__failedReqs = [];")
        d = page.ele(f'text:{dict_name}')
        if d:
            d.click()
            time.sleep(1)
            # 查找弹出面板中的输入框
            inp = page.ele('tag:input@placeholder*输入') or page.ele('tag:input@placeholder*搜索') or page.ele('tag:input@placeholder*查询') or page.ele('tag:input@placeholder*词')
            if inp:
                inp.input('hello', clear=True)
                time.sleep(0.5)
                # 查找确认/查询按钮
                search_btn = page.ele('text:查询') or page.ele('text:搜索') or page.ele('tag:button@type=submit')
                if search_btn:
                    search_btn.click()
                    time.sleep(3)
            errors = page.run_js("return JSON.stringify({e: window.__errors, f: window.__failedReqs})")
            data = json.loads(errors)
            if data['e'] or data['f']:
                print(f"  [{dict_name}] Errors: {data['e'][:3]}, FailedReqs: {data['f'][:3]}")
            else:
                print(f"  [{dict_name}] OK")
            # 关闭弹窗
            close = page.ele('css:button.close') or page.ele('text:×') or page.ele('text:关闭')
            if close:
                try: close.click()
                except: pass
                time.sleep(0.5)
        else:
            print(f"  [{dict_name}] NOT FOUND")

    # 测试每周一聊
    print("\n=== 每周一聊 ===")
    page.run_js("window.__errors = []; window.__failedReqs = [];")
    weekly = page.ele('text:每周一聊')
    if weekly:
        weekly.click()
        time.sleep(2)
        errors = page.run_js("return JSON.stringify({e: window.__errors, f: window.__failedReqs})")
        data = json.loads(errors)
        if data['e'] or data['f']:
            print(f"  Errors: {data['e'][:3]}")
            print(f"  FailedReqs: {data['f'][:3]}")
        else:
            print("  OK")

    # 测试资料抽屉
    print("\n=== 资料抽屉 ===")
    page.run_js("window.__errors = []; window.__failedReqs = [];")
    drawer = page.ele('text:资料抽屉')
    if drawer:
        drawer.click()
        time.sleep(2)
        errors = page.run_js("return JSON.stringify({e: window.__errors, f: window.__failedReqs})")
        data = json.loads(errors)
        if data['e'] or data['f']:
            print(f"  Errors: {data['e'][:3]}")
            print(f"  FailedReqs: {data['f'][:3]}")
        else:
            print("  OK")
    
    # 切换到听读 Tab 后测试 查询/生成今日长文
    print("\n=== 听读 -> 查询/生成今日长文 ===")
    page.run_js("window.__errors = []; window.__failedReqs = [];")
    listen = page.ele('text=听读')
    if listen:
        listen.click()
        time.sleep(2)
        gen_btn = page.ele('text:查询') or page.ele('text:生成今日长文') or page.ele('text:查询/生成今日长文')
        if gen_btn:
            gen_btn.click()
            time.sleep(3)
        errors = page.run_js("return JSON.stringify({e: window.__errors, f: window.__failedReqs})")
        data = json.loads(errors)
        if data['e'] or data['f']:
            print(f"  Errors: {data['e'][:3]}")
            print(f"  FailedReqs: {data['f'][:3]}")
        else:
            print("  OK")

    # 切换到博弈训练
    print("\n=== 博弈训练内部按钮 ===")
    page.run_js("window.__errors = []; window.__failedReqs = [];")
    gt = page.ele('text=博弈训练')
    if gt:
        gt.click()
        time.sleep(2)
        # 点击 人性博弈/英语主题/高管冲突/博弈策略 等
        for sub in ['人性博弈', '英语主题', '高管冲突', '博弈策略', '顶层认知提升', '晋升跳槽']:
            sub_btn = page.ele(f'text={sub}')
            if sub_btn:
                page.run_js("window.__errors = []; window.__failedReqs = [];")
                sub_btn.click()
                time.sleep(1.5)
                errors = page.run_js("return JSON.stringify({e: window.__errors, f: window.__failedReqs})")
                data = json.loads(errors)
                status = 'OK'
                details = ''
                if data['e']:
                    status = 'ERROR'
                    details = data['e'][0][:100]
                if data['f']:
                    status = 'NET_FAIL'
                    details = json.dumps(data['f'][0], ensure_ascii=False)[:120]
                print(f"  [{status}] 博弈训练 -> {sub}: {details}")

    # 后台任务队列
    print("\n=== 后台任务:查看队列 ===")
    page.run_js("window.__errors = []; window.__failedReqs = [];")
    task_btn = page.ele('text:后台任务')
    if task_btn:
        task_btn.click()
        time.sleep(2)
        errors = page.run_js("return JSON.stringify({e: window.__errors, f: window.__failedReqs})")
        data = json.loads(errors)
        if data['e'] or data['f']:
            print(f"  Errors: {data['e'][:3]}")
            print(f"  FailedReqs: {data['f'][:3]}")
        else:
            print("  OK")

    # 高阶审美
    print("\n=== 高阶审美内部 ===")
    page.run_js("window.__errors = []; window.__failedReqs = [];")
    ae = page.ele('text=高阶审美')
    if ae:
        ae.click()
        time.sleep(3)
        errors = page.run_js("return JSON.stringify({e: window.__errors, f: window.__failedReqs})")
        data = json.loads(errors)
        if data['e'] or data['f']:
            print(f"  Errors: {data['e'][:3]}")
            print(f"  FailedReqs: {json.dumps(data['f'][:3], ensure_ascii=False)}")
        else:
            print("  OK")

finally:
    page.quit()
