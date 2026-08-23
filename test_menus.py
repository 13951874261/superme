import nodriver as uc
import asyncio, sys, json
sys.stdout.reconfigure(encoding='utf-8')

async def main():
    browser = await uc.start(headless=True)
    page = await browser.get('https://app.liujingzhuwo.site/')
    await asyncio.sleep(2)
    
    login_js = """
        const pwd = document.querySelector('input[type="password"]');
        if (pwd) {
            pwd.value = '1';
            pwd.dispatchEvent(new Event('input', { bubbles: true }));
            pwd.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('解锁登录'));
        if (btn) btn.click();
        "login_attempted";
    """
    await page.evaluate(login_js)
    await asyncio.sleep(3)
    
    # 逐个点击菜单并提取报错与页面信息
    tabs = ['英语学习', '听读', '表达', '精读', '写作', '博弈训练', '高阶审美', '每周一聊']
    result = {}
    
    for t in tabs:
        click_js = f"""
            (() => {{
                const btns = Array.from(document.querySelectorAll('button'));
                const target = btns.find(b => b.innerText.trim() === '{t}');
                if (target) {{
                    target.click();
                    return true;
                }}
                return false;
            }})()
        """
        found = await page.evaluate(click_js)
        await asyncio.sleep(2)
        
        check_js = """
            (() => {
                const errElements = Array.from(document.querySelectorAll('.text-red-500, .text-rose-500, .bg-red-50, .border-red-500, [role="alert"]'));
                const errors = errElements.map(el => el.innerText.trim()).filter(txt => txt.length > 2);
                
                const buttons = Array.from(document.querySelectorAll('button'))
                    .map(b => b.innerText.trim().replace(/\\n/g, ' '))
                    .filter(t => t.length > 0 && t.length < 30);
                    
                return JSON.stringify({
                    errors: errors,
                    buttonCount: buttons.length,
                    sampleButtons: buttons.slice(0, 15)
                });
            })()
        """
        raw_data = await page.evaluate(check_js)
        try:
            parsed = json.loads(raw_data)
        except Exception:
            parsed = str(raw_data)
            
        result[t] = {
            'found': bool(found),
            'info': parsed
        }
    
    print(json.dumps(result, ensure_ascii=False, indent=2))
    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
