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
    time.sleep(3)
    
    # 用 JS 方式设置密码并提交
    page.run_js("""
        const pwdInput = document.querySelector('input[type="password"]');
        if (pwdInput) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(pwdInput, '1');
            pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        setTimeout(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('解锁登录'));
            if (btn) btn.click();
        }, 500);
    """)
    time.sleep(4)

    print("Login status:", "logged_in" if not page.ele('text:解锁登录') else "still_login")
    
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
        try:
            raw = page.run_js("return JSON.stringify({e: window.__errors, f: window.__failedReqs})")
            return json.loads(raw)
        except Exception as ex:
            return {'e': [f'collect_error: {str(ex)[:100]}'], 'f': []}

    def reset_errors():
        try:
            page.run_js("window.__errors = []; window.__failedReqs = [];")
        except:
            pass

    def safe_click(text_or_ele, by_js=False):
        try:
            if isinstance(text_or_ele, str):
                ele = page.ele(f'text:{text_or_ele}')
            else:
                ele = text_or_ele
            if ele and hasattr(ele, 'click'):
                try:
                    ele.click()
                    return True
                except:
                    pass
                try:
                    if isinstance(text_or_ele, str):
                        ele2 = page.ele(f'text:{text_or_ele}')
                    else:
                        ele2 = text_or_ele
                    page.run_js('arguments[0].click()', ele2)
                    return True
                except:
                    pass
            return False
        except Exception:
            return False

    def test_section(name, wait=2):
        time.sleep(wait)
        data = collect_errors()
        errors_str = ''
        failed_str = ''
        if data['e']:
            errors_str = '; '.join(str(e)[:150] for e in data['e'][:3])
        if data['f']:
            failed_str = '; '.join(f"[{r.get('status')}] {r.get('url')}: {r.get('body', r.get('error',''))[:80]}" for r in data['f'][:3])
        status = 'OK'
        if data['e']: status = 'CONSOLE_ERROR'
        if data['f']: status = 'NET_FAIL'
        details = errors_str + (' | ' + failed_str if failed_str else '')
        print(f"  [{status}] {name}: {details}" if details else f"  [{status}] {name}")

    # 测试剩余模块
    tests = [
        ('开启四维度专属复盘', '专属复盘'),
        ('本地文档', '资料-本地文档'),
        ('网页提取', '资料-网页提取'),
        ('视频字幕', '资料-视频字幕'),
        ('使用说明', '使用说明'),
        ('进度总控', '进度总控'),
        ('生词复习', '生词复习'),
        ('精听盲听', '精听盲听'),
        ('多角色练习', '多角色练习'),
        ('纵深书面', '纵深书面'),
        ('即兴演讲', '即兴演讲'),
    ]
    
    for target_text, label in tests:
        reset_errors()
        result = safe_click(target_text, by_js=True)
        test_section(f'{label} (found:{result})', wait=1.5)

finally:
    try:
        page.quit()
    except:
        pass
