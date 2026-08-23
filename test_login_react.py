import nodriver as uc
import asyncio, sys, json
sys.stdout.reconfigure(encoding='utf-8')

async def main():
    browser = await uc.start(headless=True)
    page = await browser.get('https://app.liujingzhuwo.site/')
    await asyncio.sleep(2)
    
    # 诊断 LoginPage 的 input 和 handleUnlock
    diag = await page.evaluate("""
    (() => {
        const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
            type: i.type,
            placeholder: i.placeholder,
            value: i.value
        }));
        const correctPassword = localStorage.getItem('super_agent_lock_password') || '1';
        return JSON.stringify({
            inputs: inputs,
            correctPassword: correctPassword
        });
    })()
    """)
    print("Diagnosis before login:", diag)
    
    # 用原生 JS 设置 React 状态输入并提交表单
    do_login = await page.evaluate("""
    (() => {
        const pwdInput = document.querySelector('input[type="password"]');
        if (pwdInput) {
            // Trigger React onChange
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(pwdInput, '1');
            const ev = new Event('input', { bubbles: true });
            pwdInput.dispatchEvent(ev);
        }
        const form = document.querySelector('form');
        if (form) {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            return 'form submitted';
        }
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('解锁登录'));
        if (btn) {
            btn.click();
            return 'button clicked';
        }
        return 'no form/button found';
    })()
    """)
    print("Login execution result:", do_login)
    
    # 等待登录完成与页面切换
    await asyncio.sleep(4)
    
    status_after = await page.evaluate("""
    (() => {
        const text = document.body.innerText;
        const isLoginStill = text.includes('解锁登录');
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
        return JSON.stringify({
            isLoginStill: isLoginStill,
            bodySnippet: text.slice(0, 200),
            buttons: buttons.slice(0, 20)
        });
    })()
    """)
    print("Status after login attempt:", status_after)
    
    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
