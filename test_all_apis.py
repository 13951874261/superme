import nodriver as uc
import asyncio, sys, json
sys.stdout.reconfigure(encoding='utf-8')

async def main():
    browser = await uc.start(headless=True)
    page = await browser.get('https://app.liujingzhuwo.site/')
    
    # 模拟真实按键输入密码 1
    pwd = await page.select('input[type="password"]')
    if pwd:
        await pwd.send_keys('1')
        await asyncio.sleep(0.5)
        
    btn = await page.select('button')
    if btn:
        await btn.click()
        
    await asyncio.sleep(3)
    
    # 执行自动化探测脚本：测试各个主要接口的连通性与返回状态
    test_endpoints_js = """
    (async () => {
        const userId = localStorage.getItem('super_agent_user_id') || 'lzhmy';
        const endpoints = [
            { name: '登录心跳 ping', url: '/api/user/login-ping', method: 'POST', body: { userId, clientVersion: '2.0.0' } },
            { name: '每日主题 theme', url: `/api/user/theme?userId=${encodeURIComponent(userId)}`, method: 'GET' },
            { name: '今日大礼包 daily-pack', url: '/api/daily-pack/today', method: 'POST', body: { userId, date: '2026-08-23' } },
            { name: '用户画像 profile', url: `/api/user/profile/${encodeURIComponent(userId)}`, method: 'GET' },
            { name: '高阶审美推送', url: `/api/aesthetics/daily-push?userId=${encodeURIComponent(userId)}`, method: 'GET' },
            { name: '生词复习库', url: `/api/vocab/review?light=1&limit=50&userId=${encodeURIComponent(userId)}`, method: 'GET' },
            { name: '知识库笔记', url: `/api/knowledge-vault/notes?userId=${encodeURIComponent(userId)}&type=all&includeTraces=1`, method: 'GET' },
            { name: '每日配额状态', url: `/api/daily-quota/status?userId=${encodeURIComponent(userId)}`, method: 'GET' },
            { name: '博弈历史记录', url: `/api/game-theory/history?userId=${encodeURIComponent(userId)}`, method: 'GET' },
            { name: '后台任务列表', url: '/api/tasks', method: 'GET' },
            { name: '每日Cron任务列表', url: `/api/daily-cron/runs?userId=${encodeURIComponent(userId)}&days=7`, method: 'GET' },
            { name: '现代汉语/词典工具', url: '/api/dify/dict-query', method: 'POST', body: { word: '测试', mode: 'zh_dict', userId } }
        ];
        
        const results = [];
        for (const ep of endpoints) {
            const start = Date.now();
            try {
                const opt = {
                    method: ep.method,
                    headers: { 'Content-Type': 'application/json' }
                };
                if (ep.body) opt.body = JSON.stringify(ep.body);
                const res = await fetch(ep.url, opt);
                const duration = Date.now() - start;
                let text = '';
                try { text = await res.text(); } catch(e) {}
                results.push({
                    name: ep.name,
                    url: ep.url,
                    method: ep.method,
                    status: res.status,
                    ok: res.ok,
                    durationMs: duration,
                    responseSnippet: text.slice(0, 150)
                });
            } catch (err) {
                results.push({
                    name: ep.name,
                    url: ep.url,
                    method: ep.method,
                    status: 0,
                    ok: false,
                    error: err.message
                });
            }
        }
        return JSON.stringify(results);
    })()
    """
    res = await page.evaluate(test_endpoints_js)
    try:
        parsed = json.loads(res)
        print(json.dumps(parsed, ensure_ascii=False, indent=2))
    except Exception as e:
        print("Raw response:", res)
        
    browser.stop()

if __name__ == '__main__':
    asyncio.run(main())
