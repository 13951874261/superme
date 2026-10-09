import nodriver as uc
import asyncio, sys, json
sys.stdout.reconfigure(encoding='utf-8')

async def main():
    browser = await uc.start(headless=True)
    page = await browser.get('https://app.liujingzhuwo.site/')
    # 等待更长时间让 React 挂载
    for _ in range(10):
        await asyncio.sleep(1)
        ready = await page.evaluate("document.readyState === 'complete' && !!document.querySelector('#root') && document.querySelector('#root').innerHTML.length > 50")
        if ready:
            break
            
    print("Page ready state check passed")
    
    # 模拟输入密码
    res_input = await page.evaluate("""
    (() => {
        const pwdInput = document.querySelector('input[type="password"]');
        if (!pwdInput) return 'no_pwd_input';
        pwdInput.focus();
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(pwdInput, '1');
        pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
        pwdInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        // 查找并点击登录按钮
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('解锁登录'));
        if (btn) {
            btn.click();
            return 'clicked_button';
        }
        return 'pwd_filled_no_button';
    })()
    """)
    print("Login action step 1:", res_input)
    
    # 等待登录后页面加载
    await asyncio.sleep(4)
    
    # 检查主页面是否加载成功
    page_info = await page.evaluate("""
    (() => {
        const btns = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
        return JSON.stringify({
            buttonsCount: btns.length,
            buttons: btns.slice(0, 30),
            textHead: document.body.innerText.slice(0, 150)
        });
    })()
    """)
    print("Page info after unlock:", page_info)
    
    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
