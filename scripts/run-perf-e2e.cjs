/**
 * 全站卡顿改善 — 第一阶段性能基准（生产站）
 * 访问: https://app.liujingzhuwo.site/  密码: 1
 * 阈值: 响应 < 8000ms；纯 UI 折叠/切页 > 300ms 记为卡顿。
 */
const fs = require('fs');
const path = require('path');

function loadPlaywright() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'playwright'),
    'C:\\Users\\lzhumy\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright',
  ];
  for (const p of candidates) {
    try {
      return require(p);
    } catch (_) {
      /* next */
    }
  }
  return require('playwright');
}

const { chromium } = loadPlaywright();

const BASE = 'https://app.liujingzhuwo.site/';
const PASSWORD = '1';
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'e2e-perf');
const SLA_MS = 8000;
const JANK_MS = 300;

fs.mkdirSync(OUT, { recursive: true });

const results = [];
const apiLog = [];

function grade(kind, ms) {
  if (ms == null || Number.isNaN(ms)) return '失败';
  if (ms > SLA_MS) return '超时';
  if (kind === 'ui' && ms > JANK_MS) return '卡顿';
  return '通过';
}

function record(row) {
  results.push(row);
  const extra = row.notes ? ` | ${row.notes}` : '';
  console.log(`[${row.status}] ${row.id} ${row.name} ${row.ms != null ? row.ms + 'ms' : ''}${extra}`);
}

async function main() {
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  }).catch(async () => chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  }));

  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    locale: 'zh-CN',
    permissions: ['microphone'],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('dialog', async (d) => {
    try { await d.accept(); } catch (_) { /* ignore */ }
  });
  const pendingReqs = new Map();
  page.on('request', (req) => {
    const url = req.url();
    if (!url.includes('/api/') && !url.includes('/dify/')) return;
    pendingReqs.set(req, { url: url.slice(0, 180), start: Date.now() });
  });
  page.on('requestfailed', (req) => {
    const rec = pendingReqs.get(req);
    if (!rec) return;
    pendingReqs.delete(req);
    apiLog.push({ url: rec.url, status: 'failed', ms: Date.now() - rec.start, at: Date.now(), error: req.failure()?.errorText || 'failed' });
  });
  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (!url.includes('/api/') && !url.includes('/dify/')) return;
      const rec = pendingReqs.get(res.request());
      pendingReqs.delete(res.request());
      const ms = rec ? Date.now() - rec.start : null;
      apiLog.push({
        url: url.replace(/^https?:\/\/[^/]+/, '').slice(0, 180),
        status: res.status(),
        ms,
        at: Date.now(),
      });
    } catch (_) { /* ignore */ }
  });

  const shot = async (name) => {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return `dist/e2e-perf/${name}.png`;
  };

  const injectProbe = async () => {
    await page.evaluate(() => {
      window.__perfProbe = window.__perfProbe || { longTasks: [], cls: 0 };
      try {
        const lt = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            window.__perfProbe.longTasks.push({ dur: e.duration, start: e.startTime });
          }
        });
        lt.observe({ type: 'longtask', buffered: true });
      } catch (_) { /* Safari/old */ }
      try {
        const cls = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (!e.hadRecentInput) window.__perfProbe.cls += e.value || 0;
          }
        });
        cls.observe({ type: 'layout-shift', buffered: true });
      } catch (_) { /* ignore */ }
    }).catch(() => {});
  };

  const snapshot = async () => page.evaluate(() => {
    const probe = window.__perfProbe || { longTasks: [], cls: 0 };
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      nodes: document.querySelectorAll('*').length,
      longTaskCount: probe.longTasks.length,
      longTaskMs: Math.round(probe.longTasks.reduce((s, t) => s + t.dur, 0)),
      maxLongTaskMs: Math.round(probe.longTasks.reduce((m, t) => Math.max(m, t.dur), 0)),
      cls: Number((probe.cls || 0).toFixed(3)),
      navDomContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      navLoad: nav ? Math.round(nav.loadEventEnd) : null,
    };
  }).catch(() => ({}));

  const markSlice = async () => {
    const before = await page.evaluate(() => (window.__perfProbe?.longTasks || []).length).catch(() => 0);
    return async () => {
      const after = await page.evaluate((n) => {
        const tasks = (window.__perfProbe?.longTasks || []).slice(n);
        return {
          count: tasks.length,
          ms: Math.round(tasks.reduce((s, t) => s + t.dur, 0)),
          max: Math.round(tasks.reduce((m, t) => Math.max(m, t.dur), 0)),
        };
      }, before).catch(() => ({ count: 0, ms: 0, max: 0 }));
      return after;
    };
  };

  const dismissOverlays = async () => {
    await page.addStyleTag({
      content: `
        #dify-chatbot-bubble-button, #dify-chatbot-bubble-window, iframe[id*="dify"] {
          display: none !important; pointer-events: none !important;
        }
      `,
    }).catch(() => {});
    for (let i = 0; i < 3; i++) {
      const backdrop = page.locator('div.fixed.inset-0.bg-black\\/40').first();
      if (await backdrop.isVisible().catch(() => false)) {
        await backdrop.click({ force: true, timeout: 1200 }).catch(() => {});
      }
      if (await page.getByText('后台任务中心').isVisible().catch(() => false)) {
        await page.keyboard.press('Escape').catch(() => {});
        const closeBtn = page.locator('div.fixed.top-0.right-0 button').first();
        await closeBtn.click({ force: true, timeout: 1200 }).catch(() => {});
      }
      for (const label of ['关闭', '稍后', '暂不', '我知道了', '跳过']) {
        const btn = page.getByRole('button', { name: label }).first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click({ force: true }).catch(() => {});
        }
      }
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(80);
    }
  };

  const waitPaint = async () => {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  };

  const measureClick = async ({ id, name, path: menuPath, requirement, kind, locator, settleMs = 0, waitFor }) => {
    await dismissOverlays();
    const loc = typeof locator === 'function' ? await locator() : locator;
    if (!loc || !(await loc.count().catch(() => 0))) {
      record({
        id, name, menuPath, requirement, kind,
        input: '目标元素未找到',
        expected: kind === 'ui' ? `交互 < ${JANK_MS}ms，且 < ${SLA_MS}ms` : `响应 < ${SLA_MS}ms`,
        ms: null, status: '失败', shot: await shot(`${id}-missing`), notes: '选择器未命中',
      });
      return null;
    }
    const apisBefore = apiLog.length;
    const endSlice = await markSlice();
    const t0 = Date.now();
    try {
      await loc.click({ force: true, timeout: 12000 });
    } catch (err) {
      record({
        id, name, menuPath, requirement, kind,
        input: '点击失败',
        expected: `响应 < ${SLA_MS}ms`,
        ms: Date.now() - t0, status: '失败', shot: await shot(`${id}-click-err`), notes: String(err).slice(0, 180),
      });
      return null;
    }
    if (waitFor) {
      try { await waitFor(); } catch (_) { /* timed out; still record elapsed */ }
    }
    if (settleMs) await page.waitForTimeout(settleMs);
    await waitPaint();
    const ms = Date.now() - t0;
    const long = await endSlice();
    const newApis = apiLog.slice(apisBefore);
    const slowApi = newApis.filter((a) => a.ms != null && a.ms > 1000);
    const notes = [
      long.count ? `longTasks=${long.count}/${long.ms}ms(max ${long.max})` : '',
      slowApi.length ? `slowApi=${slowApi.map((a) => `${a.ms}ms`).join(',')}` : '',
      `apis=${newApis.length}`,
    ].filter(Boolean).join('; ');
    const status = grade(kind, ms);
    const shotPath = await shot(id);
    record({
      id, name, menuPath, requirement, kind,
      input: '点击目标并等待下一帧/约定条件',
      expected: kind === 'ui' ? `交互 < ${JANK_MS}ms，硬阈值 < ${SLA_MS}ms` : `响应 < ${SLA_MS}ms`,
      ms, status, shot: shotPath, notes, apis: newApis.length, long,
    });
    return ms;
  };

  const hasText = async (text) => {
    const t = (await page.locator('body').innerText().catch(() => '')) || '';
    return t.includes(text);
  };

  // ---------- LOGIN ----------
  console.log('Opening', BASE);
  const navStart = Date.now();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('body', { timeout: 120000 });
  await injectProbe();
  const navMs = Date.now() - navStart;
  let loginShot = await shot('00-login');

  const loginInput = page.getByPlaceholder('请输入系统解锁秘钥');
  const tLogin = Date.now();
  if (await loginInput.count()) {
    await loginInput.fill(PASSWORD);
    await page.getByRole('button', { name: '解锁登录' }).click();
    await page.waitForFunction(
      () => document.body.innerText.includes('英语引擎'),
      null,
      { timeout: 90000 },
    ).catch(() => {});
  }
  const loginMs = Date.now() - tLogin;
  await dismissOverlays();
  await injectProbe();
  const loggedIn = await hasText('英语引擎');
  loginShot = await shot('00-home');
  const homeSnap = await snapshot();
  const pendingAtLogin = [...pendingReqs.values()].map((r) => ({
    url: r.url,
    waitedMs: Date.now() - r.start,
  }));
  if (pendingAtLogin.length) {
    fs.writeFileSync(path.join(OUT, 'pending-at-login.json'), JSON.stringify(pendingAtLogin, null, 2));
  }
  record({
    id: 'PERF-NAV-01',
    name: '首屏导航',
    menuPath: '打开站点',
    requirement: '全站卡顿改善 / 首屏',
    kind: 'nav',
    input: `GET ${BASE}`,
    expected: `domcontentloaded < ${SLA_MS}ms`,
    ms: navMs,
    status: grade('nav', navMs),
    shot: loginShot,
    notes: `nodes=${homeSnap.nodes}; dcl=${homeSnap.navDomContentLoaded}; load=${homeSnap.navLoad}`,
  });
  record({
    id: 'PERF-LOGIN-01',
    name: '解锁登录进入主界面',
    menuPath: '登录页 → 解锁登录',
    requirement: '全站卡顿改善 / 登录',
    kind: 'nav',
    input: '密码 1',
    expected: `出现「英语引擎」< ${SLA_MS}ms`,
    ms: loginMs,
    status: loggedIn ? grade('nav', loginMs) : '失败',
    shot: loginShot,
    notes: loggedIn
      ? `nodes=${homeSnap.nodes}`
      : `未进入主界面; pending=${JSON.stringify(pendingAtLogin).slice(0, 400)}; apis=${apiLog.length}`,
  });

  if (!loggedIn) {
    await browser.close();
    writeOutputs(startedAt);
    return;
  }

  const openTop = (label) => page.getByRole('button', { name: label }).first();

  // ---------- 顶栏模块切换 ----------
  const tabs = [
    { id: 'PERF-TAB-EN', label: '英语引擎', expect: '进度总控' },
    { id: 'PERF-TAB-LS', label: '洞察(听)', expect: '理论知识' },
    { id: 'PERF-TAB-SP', label: '破局(说)', expect: '破局' },
    { id: 'PERF-TAB-RD', label: '穿透(读)', expect: '穿透' },
    { id: 'PERF-TAB-WR', label: '文治(写)', expect: '文治' },
    { id: 'PERF-TAB-GT', label: '驭心博弈', expect: '驭' },
    { id: 'PERF-TAB-AE', label: '高阶审美', expect: '审美' },
  ];

  for (const tab of tabs) {
    await measureClick({
      id: tab.id,
      name: `顶栏切换：${tab.label}`,
      menuPath: `主界面顶栏 → ${tab.label}`,
      requirement: '全站卡顿改善 / 菜单切换',
      kind: 'ui',
      locator: openTop(tab.label),
      waitFor: async () => {
        await page.waitForFunction((text) => document.body.innerText.includes(text), tab.expect, { timeout: 15000 });
      },
      settleMs: 400,
    });
  }

  // 回到英语引擎做折叠与子页签
  await measureClick({
    id: 'PERF-TAB-EN-BACK',
    name: '回到英语引擎',
    menuPath: '顶栏 → 英语引擎',
    requirement: '全站卡顿改善 / 菜单切换',
    kind: 'ui',
    locator: openTop('英语引擎'),
    waitFor: async () => {
      await page.getByRole('button', { name: '进度总控' }).first().waitFor({ state: 'visible', timeout: 12000 });
    },
    settleMs: 200,
  });

  const enSubs = ['进度总控', '词汇矩阵', '精听盲听', '多角色沙盘', '纵深书面', '即兴演讲'];
  for (const label of enSubs) {
    await measureClick({
      id: `PERF-EN-SUB-${label}`,
      name: `英语子页签：${label}`,
      menuPath: `英语引擎 → ${label}`,
      requirement: '全站卡顿改善 / 英语子模块切换',
      kind: 'ui',
      locator: page.getByRole('button', { name: label }).first(),
      settleMs: 350,
    });
  }

  await page.getByRole('button', { name: '进度总控' }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(250);

  // ---------- 折叠交互 ----------
  await measureClick({
    id: 'PERF-FOLD-WAKE',
    name: '折叠每日唤醒模块',
    menuPath: '英语引擎 → 每日唤醒 → 折叠模块',
    requirement: '全站卡顿改善 / 收起折叠也卡',
    kind: 'ui',
    locator: page.getByRole('button', { name: '折叠模块' }).first(),
    settleMs: 200,
  });
  await measureClick({
    id: 'PERF-UNFOLD-WAKE',
    name: '展开每日唤醒模块',
    menuPath: '英语引擎 → 每日唤醒 → 展开模块',
    requirement: '全站卡顿改善 / 收起折叠也卡',
    kind: 'ui',
    locator: page.getByRole('button', { name: '展开模块' }).first(),
    settleMs: 200,
  });

  await measureClick({
    id: 'PERF-FOLD-CAL',
    name: '收起月历',
    menuPath: '左侧栏 → Monthly Calendar',
    requirement: '全站卡顿改善 / 收起折叠也卡',
    kind: 'ui',
    locator: page.getByText('Monthly Calendar', { exact: true }).first(),
    settleMs: 200,
  });
  await measureClick({
    id: 'PERF-UNFOLD-CAL',
    name: '展开月历',
    menuPath: '左侧栏 → Monthly Calendar',
    requirement: '全站卡顿改善 / 收起折叠也卡',
    kind: 'ui',
    locator: page.getByText('Monthly Calendar', { exact: true }).first(),
    settleMs: 200,
  });

  await measureClick({
    id: 'PERF-FOLD-UTIL',
    name: '展开 Utility Tools',
    menuPath: '左侧栏 → Utility Tools',
    requirement: '全站卡顿改善 / 收起折叠也卡',
    kind: 'ui',
    locator: page.getByText('Utility Tools', { exact: true }).first(),
    settleMs: 400,
  });
  await measureClick({
    id: 'PERF-FOLD-UTIL-CLOSE',
    name: '收起 Utility Tools',
    menuPath: '左侧栏 → Utility Tools',
    requirement: '全站卡顿改善 / 收起折叠也卡',
    kind: 'ui',
    locator: page.getByText('Utility Tools', { exact: true }).first(),
    settleMs: 400,
  });

  await measureClick({
    id: 'PERF-FOLD-SIDEBAR',
    name: '收起左侧栏',
    menuPath: '左侧栏边缘折叠按钮',
    requirement: '全站卡顿改善 / 收起折叠也卡',
    kind: 'ui',
    locator: page.locator('aside button').first(),
    settleMs: 350,
  });
  await measureClick({
    id: 'PERF-UNFOLD-SIDEBAR',
    name: '展开左侧栏',
    menuPath: '左侧栏边缘折叠按钮',
    requirement: '全站卡顿改善 / 收起折叠也卡',
    kind: 'ui',
    locator: page.locator('aside').locator('xpath=..').locator('button').first(),
    settleMs: 350,
  });

  // 资料抽屉开关
  await page.getByText('Utility Tools', { exact: true }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
  await measureClick({
    id: 'PERF-VAULT-OPEN',
    name: '打开资料抽屉',
    menuPath: '左侧栏 → Utility Tools → 资料抽屉',
    requirement: '全站卡顿改善 / 资料抽屉',
    kind: 'ui',
    locator: page.getByText('资料抽屉', { exact: true }).first(),
    waitFor: async () => {
      await page.waitForFunction(() => document.body.innerText.includes('知识库') || document.body.innerText.includes('资料'), { timeout: 12000 });
    },
    settleMs: 500,
  });
  await measureClick({
    id: 'PERF-VAULT-CLOSE',
    name: '关闭资料抽屉',
    menuPath: '资料抽屉 → 关闭',
    requirement: '全站卡顿改善 / 资料抽屉',
    kind: 'ui',
    locator: async () => {
      const close = page.getByRole('button', { name: /关闭|Close/ }).first();
      if (await close.count()) return close;
      return page.locator('button').filter({ has: page.locator('svg') }).nth(0);
    },
    settleMs: 300,
  });

  // 洞察(听) 全折叠
  await measureClick({
    id: 'PERF-LS-OPEN',
    name: '进入洞察(听)准备折叠',
    menuPath: '顶栏 → 洞察(听)',
    requirement: '全站卡顿改善 / 洞察折叠',
    kind: 'ui',
    locator: openTop('洞察(听)'),
    settleMs: 800,
  });
  const foldAll = page.getByTitle('全部折叠').or(page.getByText('全折叠')).first();
  await measureClick({
    id: 'PERF-LS-FOLD-ALL',
    name: '洞察理论知识全折叠',
    menuPath: '洞察(听) → 理论知识 → 全折叠',
    requirement: '全站卡顿改善 / 收起折叠也卡',
    kind: 'ui',
    locator: foldAll,
    settleMs: 400,
  });
  const unfoldAll = page.getByTitle('全部展开').or(page.getByText('全展开')).first();
  await measureClick({
    id: 'PERF-LS-UNFOLD-ALL',
    name: '洞察理论知识全展开',
    menuPath: '洞察(听) → 理论知识 → 全展开',
    requirement: '全站卡顿改善 / 收起折叠也卡',
    kind: 'ui',
    locator: unfoldAll,
    settleMs: 400,
  });

  // ---------- 生成路径（只测有限几次，避免刷爆 LLM） ----------
  const waitNetworkIdleish = async (timeoutMs) => {
    const start = Date.now();
    let lastCount = apiLog.length;
    let quietSince = Date.now();
    while (Date.now() - start < timeoutMs) {
      await page.waitForTimeout(250);
      if (apiLog.length !== lastCount) {
        lastCount = apiLog.length;
        quietSince = Date.now();
      }
      const last = apiLog[apiLog.length - 1];
      const busy = last && (Date.now() - last.at) < 400;
      if (!busy && Date.now() - quietSince > 900) break;
    }
  };

  await measureClick({
    id: 'PERF-GT-OPEN',
    name: '进入驭心博弈（会自动推送案例）',
    menuPath: '顶栏 → 驭心博弈',
    requirement: '全站卡顿改善 / 生成慢',
    kind: 'gen',
    locator: openTop('驭心博弈'),
    waitFor: async () => { await waitNetworkIdleish(25000); },
    settleMs: 200,
  });
  const swapCase = page.getByRole('button', { name: '换一条' }).first();
  await measureClick({
    id: 'PERF-GT-SWAP',
    name: '驭心博弈换一条案例',
    menuPath: '驭心博弈 → 高管斗争案例研判 → 换一条',
    requirement: '全站卡顿改善 / 生成慢',
    kind: 'gen',
    locator: swapCase,
    waitFor: async () => { await waitNetworkIdleish(25000); },
    settleMs: 200,
  });

  await measureClick({
    id: 'PERF-RD-OPEN',
    name: '进入穿透(读)',
    menuPath: '顶栏 → 穿透(读)',
    requirement: '全站卡顿改善 / 生成慢',
    kind: 'ui',
    locator: openTop('穿透(读)'),
    settleMs: 600,
  });
  await measureClick({
    id: 'PERF-RD-PUSH',
    name: '每日 AI 素材推送',
    menuPath: '穿透(读) → 每日 AI 素材推送',
    requirement: '全站卡顿改善 / 生成慢',
    kind: 'gen',
    locator: page.getByRole('button', { name: '每日 AI 素材推送' }).first(),
    waitFor: async () => { await waitNetworkIdleish(25000); },
    settleMs: 200,
  });

  await measureClick({
    id: 'PERF-EN-WAKE-REFRESH',
    name: '刷新今日包',
    menuPath: '英语引擎 → 每日唤醒 → 刷新今日包',
    requirement: '全站卡顿改善 / 生成慢',
    kind: 'gen',
    locator: async () => {
      await openTop('英语引擎').click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      return page.getByRole('button', { name: '刷新今日包' }).first();
    },
    waitFor: async () => { await waitNetworkIdleish(25000); },
    settleMs: 200,
  });

  const finalSnap = await snapshot();
  fs.writeFileSync(path.join(OUT, 'snapshot-final.json'), JSON.stringify(finalSnap, null, 2));
  await shot('zz-final');
  await browser.close();
  writeOutputs(startedAt, finalSnap);
}

function writeOutputs(startedAt, finalSnap = {}) {
  const finishedAt = new Date().toISOString();
  const counts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const payload = {
    startedAt,
    finishedAt,
    slaMs: SLA_MS,
    jankMs: JANK_MS,
    counts,
    finalSnap,
    results,
    slowApis: apiLog.filter((a) => a.ms != null && a.ms >= 1000).sort((a, b) => b.ms - a.ms).slice(0, 40),
    apiLog: apiLog.slice(-80),
  };
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(payload, null, 2));
  console.log('Wrote', path.join(OUT, 'results.json'));
  console.log('Counts', counts);
}

main().catch((err) => {
  console.error(err);
  writeOutputs(new Date().toISOString());
  process.exit(1);
});
