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
    
    def collect_errors():
        raw = page.run_js("return JSON.stringify({e: window.__errors, f: window.__failedReqs})")
        return json.loads(raw)

    def reset_errors():
        page.run_js("window.__errors = []; window.__failedReqs = [];")

    def safe_click(text_or_ele, by_js=False):
        try:
            if isinstance(text_or_ele, str):
                ele = page.ele(f'text:{text_or_ele}')
            else:
                ele = text_or_ele
            if ele:
                if by_js:
                    page.run_js('arguments[0].click()', ele)
                else:
                    ele.click()
                return True
        except Exception as e:
            # 尝试 JS 点击作为后备
            try:
                if isinstance(text_or_ele, str):
                    ele = page.ele(f'text:{text_or_ele}')
                else:
                    ele = text_or_ele
                if ele:
                    page.run_js('arguments[0].click()', ele)
                    return True
            except:
                pass
            return False

    def test_section(name, wait=2):
        time.sleep(wait)
        data = collect_errors()
        errors_str = ''
        failed_str = ''
        if data['e']:
            errors_str = '; '.join(e[:120] for e in data['e'][:3])
        if data['f']:
            failed_str = '; '.join(f"[{r.get('status')}] {r.get('url')}: {r.get('body', r.get('error',''))[:80]}" for r in data['f'][:3])
        status = 'OK'
        if data['e']: status = 'CONSOLE_ERROR'
        if data['f']: status = 'NET_FAIL'
        details = errors_str + (' | ' + failed_str if failed_str else '')
        print(f"  [{status}] {name}: {details}" if details else f"  [{status}] {name}")

    # 听读 Tab
    print("=== 听读模块 ===")
    reset_errors()
    safe_click('听读')
    test_section('听读 Tab 切换')
    
    # 听读内部按钮
    for btn_name in ['查询/生成今日长文', '重置今日', '今日长文', '沉浸式阅读', '展开全文']:
        reset_errors()
        result = safe_click(btn_name, by_js=True)
        test_section(f'听读 -> {btn_name} (found:{result})')

    # 表达 Tab
    print("\n=== 表达模块 ===")
    reset_errors()
    safe_click('表达')
    test_section('表达 Tab 切换')

    for btn_name in ['政务集中突破', '全场景拓展', '自定义']:
        reset_errors()
        result = safe_click(btn_name, by_js=True)
        test_section(f'表达 -> {btn_name} (found:{result})')

    # 精读 Tab  
    print("\n=== 精读模块 ===")
    reset_errors()
    safe_click('精读')
    test_section('精读 Tab 切换')

    # 写作 Tab
    print("\n=== 写作模块 ===")
    reset_errors()
    safe_click('写作')
    test_section('写作 Tab 切换')

    # 博弈训练 Tab
    print("\n=== 博弈训练模块 ===")
    reset_errors()
    safe_click('博弈训练')
    test_section('博弈训练 Tab 切换')

    for sub in ['人性博弈', '英语主题', '高管冲突', '博弈策略', '顶层认知提升', '晋升跳槽']:
        reset_errors()
        result = safe_click(sub, by_js=True)
        test_section(f'博弈训练 -> {sub} (found:{result})', wait=1.5)

    # 高阶审美 Tab
    print("\n=== 高阶审美模块 ===")
    reset_errors()
    safe_click('高阶审美')
    test_section('高阶审美 Tab 切换', wait=3)

    # 后台任务
    print("\n=== 后台任务队列 ===")
    reset_errors()
    safe_click('后台任务')
    test_section('后台任务队列', wait=2)
    
    for sub in ['清空已结束', '查看材料', '查看运行日志', '查看详情', '整次重新执行']:
        reset_errors()
        result = safe_click(sub, by_js=True)
        test_section(f'后台任务 -> {sub} (found:{result})', wait=1)

    # 开启四维度专属复盘
    print("\n=== 专属复盘 ===")
    reset_errors()
    safe_click('开启四维度专属复盘', by_js=True)
    test_section('开启四维度专属复盘', wait=2)

    # 本地文档/网页提取/视频字幕
    print("\n=== 资料处理工具 ===")
    for tool in ['本地文档', '网页提取', '视频字幕']:
        reset_errors()
        result = safe_click(tool, by_js=True)
        test_section(f'{tool} (found:{result})', wait=1)

finally:
    page.quit()
