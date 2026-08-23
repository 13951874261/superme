import nodriver as uc
import asyncio, sys, json
sys.stdout.reconfigure(encoding='utf-8')

async def main():
    browser = await uc.start(headless=True)
    page = await browser.get('https://app.liujingzhuwo.site/')
    
    pwd = await page.select('input[type="password"]')
    if pwd:
        await pwd.send_keys('1')
        await asyncio.sleep(0.5)
        
    btn = await page.select('button')
    if btn:
        await btn.click()
        
    await asyncio.sleep(4)
    
    # 抽取 API 请求到全局方法，用同步回调或单独的 await 执行单个 fetch
    endpoints = [
        {'name': 'login-ping', 'url': '/api/user/login-ping', 'method': 'POST', 'body': '{"userId":"lzhmy"}'},
        {'name': 'theme', 'url': '/api/user/theme?userId=lzhmy', 'method': 'GET'},
        {'name': 'daily-pack', 'url': '/api/daily-pack/today', 'method': 'POST', 'body': '{"userId":"lzhmy","date":"2026-08-23"}'},
        {'name': 'profile', 'url': '/api/user/profile/lzhmy', 'method': 'GET'},
        {'name': 'tasks', 'url': '/api/tasks', 'method': 'GET'}
    ]
    
    for ep in endpoints:
        fetch_js = f"""
        (() => {{
            return fetch('{ep['url']}', {{
                method: '{ep['method']}',
                headers: {{'Content-Type': 'application/json'}},
                body: {("'" + ep['body'] + "'") if 'body' in ep else "null"}
            }}).then(async res => {{
                return JSON.stringify({{
                    status: res.status,
                    ok: res.ok,
                    text: (await res.text()).slice(0, 200)
                }});
            }}).catch(err => {{
                return JSON.stringify({{error: err.message}});
            }});
        }})()
        """
        res = await page.evaluate(fetch_js)
        print(f"[{ep['name']}] =>", res)

    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
