import nodriver as uc
import asyncio, sys, json
sys.stdout.reconfigure(encoding='utf-8')

async def main():
    browser = await uc.start(headless=True)
    page = await browser.get('https://app.liujingzhuwo.site/')
    await asyncio.sleep(2)
    
    # 查找密码输入框和登录按钮
    pwd_elem = await page.select('input[type="password"]')
    if pwd_elem:
        await pwd_elem.send_keys('1')
        await asyncio.sleep(0.5)
        
    btn_elem = await page.select('button')
    if btn_elem:
        await btn_elem.click()
        await asyncio.sleep(3)
        
    # 检查当前页面的所有按钮和文本
    check_script = """
    (() => {
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim());
        const bodyText = document.body.innerText.slice(0, 300);
        return JSON.stringify({
            buttons: buttons,
            bodySnippet: bodyText
        });
    })()
    """
    res = await page.evaluate(check_script)
    print("Page state after click:", res)
    
    # 遍历主要模块
    tabs = ['英语学习', '听读', '表达', '精读', '写作', '博弈训练', '高阶审美', '每周一聊']
    for t in tabs:
        # 点击对应 tab
        click_res = await page.evaluate(f"""
        (() => {{
            const btns = Array.from(document.querySelectorAll('button'));
            const target = btns.find(b => b.innerText.trim() === '{t}');
            if (target) {{
                target.click();
                return true;
            }}
            return false;
        }})()
        """)
        await asyncio.sleep(1.5)
        
        # 扫描是否有错误提示
        info = await page.evaluate("""
        (() => {
            const errs = Array.from(document.querySelectorAll('.text-red-500, .text-rose-500, .bg-red-50, .border-red-500, [role="alert"]'))
                .map(e => e.innerText.trim())
                .filter(t => t.length > 2 && !t.includes('睡眠') && !t.includes('饮食'));
            const btns = Array.from(document.querySelectorAll('button'))
                .map(b => b.innerText.trim().replace(/\\n/g, ' '))
                .filter(Boolean);
            return JSON.stringify({
                errors: errs,
                buttonCount: btns.length,
                sampleButtons: btns.slice(0, 10)
            });
        })()
        """)
        print(f"=== Tab [{t}] (Clicked: {click_res}) ===")
        print(info)
        
    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
