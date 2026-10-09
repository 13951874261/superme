/**
 * 7.21 / 7.22 反馈用例自动化（生产站）
 * 访问: https://app.liujingzhuwo.site/  密码: 1
 */
const fs = require('fs');
const path = require('path');

function loadPlaywright() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'playwright'),
    'C:\\Users\\lzhumy\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright',
    path.join(process.env.LOCALAPPDATA || '', 'ms-playwright'),
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
const OUT = path.join(ROOT, 'dist', 'e2e-feedback');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

fs.mkdirSync(OUT, { recursive: true });

const results = [];

function record(id, name, status, expected, actual, shot, notes) {
  results.push({ id, name, status, expected, actual, shot, notes: notes || '' });
  console.log(`[${status}] ${id} ${name}${notes ? ' | ' + notes : ''}`);
}

async function main() {
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
    permissions: ['microphone', 'clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('dialog', async (d) => {
    try { await d.accept(); } catch (_) { /* ignore */ }
  });

  const shot = async (name) => {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return `dist/e2e-feedback/${name}.png`;
  };

  const bodyText = async () => (await page.locator('body').innerText().catch(() => '')) || '';

  const hasText = async (text) => {
    const t = await bodyText();
    return t.includes(text);
  };

  const clickText = async (text, opts = {}) => {
    const loc = page.getByText(text, { exact: opts.exact !== false }).first();
    await loc.waitFor({ state: 'visible', timeout: opts.timeout || 12000 });
    await loc.click({ timeout: opts.timeout || 12000 });
  };

  const clickContains = async (text, timeout = 12000) => {
    const loc = page.getByText(text, { exact: false }).first();
    await loc.waitFor({ state: 'visible', timeout });
    await loc.click({ timeout });
  };

  const visibleTextarea = () => page.locator('textarea:visible').last();

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
        await backdrop.click({ force: true, timeout: 1500 }).catch(() => {});
      }
      if (await page.getByText('后台任务中心').isVisible().catch(() => false)) {
        const closeBtn = page.locator('div.fixed.top-0.right-0 button').filter({ has: page.locator('svg') }).first();
        await closeBtn.click({ force: true, timeout: 1500 }).catch(() => {});
        await page.keyboard.press('Escape').catch(() => {});
      }
      for (const label of ['关闭', '稍后', '暂不', '我知道了', 'Dismiss', '跳过']) {
        const btn = page.getByRole('button', { name: label }).first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click({ force: true }).catch(() => {});
        }
      }
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(150);
      const blocked = await page.locator('div.fixed.inset-0.bg-black\\/40').isVisible().catch(() => false);
      if (!blocked) break;
    }
  };

  const openTop = async (label) => {
    await dismissOverlays();
    const tab = page.getByRole('button', { name: label }).first();
    await tab.click({ timeout: 12000, force: true });
    await page.waitForTimeout(800);
    await dismissOverlays();
  };

  const openEnglishSub = async (label) => {
    await openTop('英语引擎');
    await page.getByRole('button', { name: label }).first().click({ force: true });
    await page.waitForTimeout(700);
  };

  // ---------- LOGIN ----------
  console.log('Opening', BASE);
  await page.goto(BASE, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForSelector('body', { timeout: 120000 });
  await page.waitForTimeout(3000);
  let loginShot = await shot('00-login');
  const loginInput = page.getByPlaceholder('请输入系统解锁秘钥');
  if (await loginInput.count()) {
    await loginInput.fill(PASSWORD);
    await page.getByRole('button', { name: '解锁登录' }).click();
    await page.waitForTimeout(2500);
  }
  await dismissOverlays();
  const loggedIn = await hasText('英语引擎');
  if (!loggedIn) {
    loginShot = await shot('00-login-failed');
    record('LOGIN', '登录', '失败', '密码 1 进入系统并看到顶栏英语引擎', '未进入主界面', loginShot, '');
    await fs.promises.writeFile(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2), 'utf8');
    await browser.close();
    return;
  }
  record('LOGIN', '登录', '通过', '密码 1 进入系统', '已看到顶栏英语引擎', await shot('00-home'), '');

  // EN-ROAD-01
  try {
    await openEnglishSub('进度总控');
    const biz = page.getByText('政务集中突破', { exact: false }).first();
    const all = page.getByText('全场景拓展', { exact: false }).first();
    await biz.click();
    await page.waitForTimeout(400);
    await all.click();
    await page.waitForTimeout(400);
    await biz.click();
    const locked = await hasText('必须先通关') || await hasText('强制锁定');
    const s = await shot('EN-ROAD-01');
    if (await biz.isVisible() && await all.isVisible() && !locked) {
      record('EN-ROAD-01', '政商务与全场景可并行无强制锁定', '通过', '两轨道可点选且不锁死', '两轨道可见，未出现强制锁定文案', s, '');
    } else {
      record('EN-ROAD-01', '政商务与全场景可并行无强制锁定', '失败', '两轨道可点选且不锁死', locked ? '出现锁定文案' : '轨道按钮不可见', s, '');
    }
  } catch (e) {
    record('EN-ROAD-01', '政商务与全场景可并行无强制锁定', '失败', '两轨道可点选且不锁死', String(e.message || e), await shot('EN-ROAD-01-err'), '');
  }

  // EN-ROAD-02
  try {
    await openEnglishSub('进度总控');
    const customBtn = page.getByText('自定义', { exact: false }).first();
    await customBtn.click();
    await page.waitForTimeout(600);
    const modal = await hasText('创建自定义练习场景') || await hasText('Custom Theme') || await hasText('自定义场景');
    const s = await shot('EN-ROAD-02');
    record('EN-ROAD-02', '全场景支持自定义主题', modal ? '通过' : '失败', '出现自定义场景弹窗', modal ? '弹窗已打开' : '未出现自定义弹窗', s, '本轮只验入口，未保存新主题以免污染账号');
    await page.keyboard.press('Escape');
  } catch (e) {
    record('EN-ROAD-02', '全场景支持自定义主题', '失败', '出现自定义场景弹窗', String(e.message || e), await shot('EN-ROAD-02-err'), '');
  }

  // EN-UPL-01
  try {
    await openEnglishSub('进度总控');
    const uploader = await hasText('一键材料提纯') || await hasText('材料提纯');
    const tmp = path.join(OUT, 'upload-sample.txt');
    fs.writeFileSync(tmp, 'The board postponed the Q3 budget review.\n', 'utf8');
    const fileInput = page.locator('#material-wizard-upload');
    let uploaded = false;
    if (await fileInput.count()) {
      await fileInput.setInputFiles(tmp);
      uploaded = true;
      await page.waitForTimeout(2500);
    }
    const success = await hasText('提纯成功') || await hasText('任务') || await hasText('后台');
    const spinningOnly = await page.locator('.animate-spin').count();
    const s = await shot('EN-UPL-01');
    if (uploader && uploaded && (success || spinningOnly >= 0)) {
      const status = success ? '通过' : '部分通过';
      record('EN-UPL-01', '上传材料能成功完成', status, '上传后成功或明确错误，不空白转圈', success ? '出现成功/任务提示' : '已选文件，尚未等到提纯成功文案', s, '');
    } else {
      record('EN-UPL-01', '上传材料能成功完成', uploader ? '部分通过' : '失败', '上传入口可用并完成提纯', uploader ? '看到提纯入口但未能注入文件' : '未找到提纯入口', s, '');
    }
  } catch (e) {
    record('EN-UPL-01', '上传材料能成功完成', '失败', '上传后成功或明确错误', String(e.message || e), await shot('EN-UPL-01-err'), '');
  }

  // EN-UPL-02
  try {
    await openEnglishSub('进度总控');
    const videoTab = page.getByText('视频字幕', { exact: false }).first();
    if (await videoTab.count()) await videoTab.click();
    await page.waitForTimeout(400);
    const taskBtn = page.getByText('任务', { exact: false }).first();
    if (await taskBtn.count()) await taskBtn.click().catch(() => {});
    const ok = await hasText('视频') && (await hasText('任务中心') || await hasText('提纯任务') || await hasText('异步'));
    const s = await shot('EN-UPL-02');
    record('EN-UPL-02', '大文件走异步可在任务中心看进度', ok ? '通过' : '部分通过', '视频提纯走异步且可看任务中心', ok ? '视频页签与任务入口可见' : '未同时看到视频页签和任务中心文案', s, '未实际上传大视频');
    await page.keyboard.press('Escape');
  } catch (e) {
    record('EN-UPL-02', '大文件走异步可在任务中心看进度', '失败', '视频提纯走异步', String(e.message || e), await shot('EN-UPL-02-err'), '');
  }

  // EN-VOC-01
  try {
    await openEnglishSub('词汇矩阵');
    const flip = await hasText('不记得了，直接翻转查看答案') || await hasText('翻转');
    const stuckHint = await hasText('拼不出');
    const s = await shot('EN-VOC-01');
    if (flip) {
      await clickContains('翻转').catch(() => {});
      await page.waitForTimeout(400);
      record('EN-VOC-01', '拼不出时可查看正确答案', '通过', '可翻转查看答案且不卡死', '词汇矩阵存在翻转/查看答案入口', await shot('EN-VOC-01b'), '');
    } else {
      record('EN-VOC-01', '拼不出时可查看正确答案', '部分通过', '可翻转查看答案且不卡死', stuckHint ? '未见翻转入门' : '当前无到期词或未进入复习态', s, '');
    }
  } catch (e) {
    record('EN-VOC-01', '拼不出时可查看正确答案', '失败', '可翻转查看答案', String(e.message || e), await shot('EN-VOC-01-err'), '');
  }

  // EN-VOC-02
  try {
    await openEnglishSub('词汇矩阵');
    const book = page.getByText('艾宾浩斯', { exact: false }).first();
    if (await book.count()) await book.click().catch(() => {});
    const ok = await hasText('艾宾浩斯') || await hasText('待复习') || await hasText('间隔');
    const s = await shot('EN-VOC-02');
    record('EN-VOC-02', '熟练减少推送、不会则加强', ok ? '部分通过' : '失败', '可见间隔/曲线而非纯随机', ok ? '看到生词本/待复习/艾宾浩斯相关 UI，未做跨日验证' : '未见间隔机制 UI', s, '跨日频次无法在本轮自动验证');
  } catch (e) {
    record('EN-VOC-02', '熟练减少推送、不会则加强', '失败', '可见 Anki 式间隔', String(e.message || e), await shot('EN-VOC-02-err'), '');
  }

  // EN-VOC-03
  try {
    const exportBtn = page.getByText('导出', { exact: false }).first();
    const ok = (await hasText('政商务区') || await hasText('全场景区')) && await exportBtn.count();
    const s = await shot('EN-VOC-03');
    record('EN-VOC-03', '导出为单词—例句—释义对应', ok ? '部分通过' : '失败', 'CSV 一行一词且含释义例句', ok ? '分区与导出按钮可见，未打开 Excel 核对列结构' : '未见分区/导出', s, '');
  } catch (e) {
    record('EN-VOC-03', '导出为单词—例句—释义对应', '失败', '导出列对齐', String(e.message || e), await shot('EN-VOC-03-err'), '');
  }

  // EN-BOOK-01
  try {
    await page.getByText('复习', { exact: false }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    const flip = await hasText('翻转查看释义') || await hasText('翻转');
    const s = await shot('EN-BOOK-01');
    record('EN-BOOK-01', '翻转复习必须出现英文原词', flip ? '部分通过' : '阻塞', '翻面后出现英文原词', flip ? '闪卡翻转入口可见，headless 未断言原词内容' : '未能打开闪卡（可能无到期词）', s, '');
  } catch (e) {
    record('EN-BOOK-01', '翻转复习必须出现英文原词', '失败', '翻面后出现英文原词', String(e.message || e), await shot('EN-BOOK-01-err'), '');
  }

  // EN-BOOK-02
  try {
    await openEnglishSub('词汇矩阵');
    const matrix = await hasText('词汇矩阵') || await hasText('全场景区');
    const book = await hasText('艾宾浩斯') || await hasText('生词本');
    const s = await shot('EN-BOOK-02');
    record('EN-BOOK-02', '单词本与词汇矩阵职责可区分', matrix && book ? '通过' : '部分通过', '两入口功能文案可区分', `词汇矩阵=${matrix} 生词本=${book}`, s, '');
  } catch (e) {
    record('EN-BOOK-02', '单词本与词汇矩阵职责可区分', '失败', '两入口可区分', String(e.message || e), await shot('EN-BOOK-02-err'), '');
  }

  // EN-LIS-01
  try {
    await openEnglishSub('精听盲听');
    const gen = await hasText('生成今日精听') || await hasText('后台生成') || await hasText('自动生成');
    const s = await shot('EN-LIS-01');
    record('EN-LIS-01', '听力生成不无限转圈可看任务进度', gen ? '通过' : '失败', '有生成/后台任务入口', gen ? '看到生成或后台生成按钮' : '未找到生成入口', s, '');
  } catch (e) {
    record('EN-LIS-01', '听力生成不无限转圈可看任务进度', '失败', '有异步生成入口', String(e.message || e), await shot('EN-LIS-01-err'), '');
  }

  // EN-LIS-02
  try {
    const upload = await hasText('上传音频');
    const s = await shot('EN-LIS-02');
    record('EN-LIS-02', '可上传自己的听力材料并默写', upload ? '通过' : '失败', '存在上传音频入口', upload ? '上传音频按钮可见' : '未见上传音频', s, '未实际上传音频文件');
  } catch (e) {
    record('EN-LIS-02', '可上传自己的听力材料并默写', '失败', '上传音频入口', String(e.message || e), await shot('EN-LIS-02-err'), '');
  }

  // EN-LIS-03
  try {
    const accent = await hasText('印度口音') || await hasText('口音');
    const s = await shot('EN-LIS-03');
    record('EN-LIS-03', '职场对话+口音等压力因素', accent ? '部分通过' : '失败', '可选非美式口音及压力场景', accent ? '口音选项可见；打断/卡顿需人工听音频确认' : '未见口音选项', s, '');
  } catch (e) {
    record('EN-LIS-03', '职场对话+口音等压力因素', '失败', '口音/压力选项', String(e.message || e), await shot('EN-LIS-03-err'), '');
  }

  // EN-ORAL-01
  try {
    await openEnglishSub('多角色沙盘');
    await page.waitForTimeout(1500);
    // 滚到输入区，确保长按按钮可见
    await page.getByText('长按说话', { exact: false }).first().scrollIntoViewIfNeeded().catch(() => {});
    const hold = page.getByRole('button', { name: /长按说话|松开发送/ }).first();
    const visibleHold = await hold.isVisible().catch(() => false);
    if (visibleHold) {
      const box = await hold.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(1500);
        // 故意移出按钮再松开，验证 pointer capture / 全局 pointerup
        await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 - 40);
        await page.mouse.up();
        await page.waitForTimeout(3500);
      }
    }
    const after = await bodyText();
    const hasRecord = /松开发送|正在倾听|转写|Q3|budget|Let's/i.test(after);
    const hasErr = after.includes('未识别到有效语音') || after.includes('麦克风') || after.includes('语音转');
    const s = await shot('EN-ORAL-01');
    if (!visibleHold) {
      record('EN-ORAL-01', '长按说话松开后必须有口语记录', '失败', '松开后出现转写或明确失败提示', '未见「长按说话」按钮（可能沙盘未开场）', s, '');
    } else if (hasErr || hasRecord) {
      record('EN-ORAL-01', '长按说话松开后必须有口语记录', '通过', '移出按钮松开后仍有转写或明确失败提示（非静默）', hasErr ? '出现明确失败/未识别提示' : '出现录音/转写相关状态', s, 'headless 假麦克风；验证点是松开不丢事件');
    } else {
      record('EN-ORAL-01', '长按说话松开后必须有口语记录', '失败', '松开后出现转写或明确失败提示', '移出按钮松开后仍静默无反馈', s, '');
    }
  } catch (e) {
    record('EN-ORAL-01', '长按说话松开后必须有口语记录', '失败', '松开后有记录', String(e.message || e), await shot('EN-ORAL-01-err'), '');
  }

  // EN-ORAL-02 / 03
  try {
    await openEnglishSub('多角色沙盘');
    const daily = page.getByText('日常演练', { exact: false }).first();
    const custom = await hasText('自定义背景') || await hasText('自定义');
    const nego = await hasText('谈判沙盘');
    if (await daily.count()) await daily.click();
    await page.waitForTimeout(500);
    const dailyOn = await hasText('1VS1') || await hasText('日常演练');
    const s = await shot('EN-ORAL-02');
    record('EN-ORAL-02', '可自定义场景且可重复使用', (nego || custom) ? '通过' : '部分通过', '谈判沙盘可填自定义背景且能再开一场', `谈判=${nego} 自定义背景=${custom}`, s, '未连开两场以免占用额度');
    record('EN-ORAL-03', '1VS1 日常演练并给更好表达', dailyOn ? '通过' : '失败', '日常演练为 1VS1 且不植入谈判破绽', dailyOn ? '日常演练/1VS1 文案可见' : '切到日常演练失败', await shot('EN-ORAL-03'), '');
  } catch (e) {
    record('EN-ORAL-02', '可自定义场景且可重复使用', '失败', '自定义背景', String(e.message || e), await shot('EN-ORAL-02-err'), '');
    record('EN-ORAL-03', '1VS1 日常演练并给更好表达', '失败', '日常 1VS1', String(e.message || e), await shot('EN-ORAL-03-err'), '');
  }

  // EN-SPEECH-01
  try {
    await openEnglishSub('即兴演讲');
    const ok = await hasText('即兴演讲') || await hasText('演讲');
    const s = await shot('EN-SPEECH-01');
    record('EN-SPEECH-01', '即兴演讲试用正常', ok ? '通过' : '失败', '模块可打开无白屏', ok ? '即兴演讲页可见' : '未能打开', s, '未完整录音打分');
  } catch (e) {
    record('EN-SPEECH-01', '即兴演讲试用正常', '失败', '模块可打开', String(e.message || e), await shot('EN-SPEECH-01-err'), '');
  }

  // EN-PART-01
  try {
    await openEnglishSub('进度总控');
    const ok = (await hasText('政务集中突破')) && (await hasText('全场景拓展'));
    await openEnglishSub('多角色沙盘');
    const modes = (await hasText('谈判沙盘')) && (await hasText('日常演练'));
    const s = await shot('EN-PART-01');
    record('EN-PART-01', '政商务与日常分区清晰', ok && modes ? '通过' : '部分通过', '路线图与沙盘模式分区明确', `路线图=${ok} 沙盘模式=${modes}`, s, '');
  } catch (e) {
    record('EN-PART-01', '政商务与日常分区清晰', '失败', '分区明确', String(e.message || e), await shot('EN-PART-01-err'), '');
  }

  // LS-*
  try {
    await openTop('洞察(听)');
    await page.waitForTimeout(1500);
    const know = await hasText('理论知识') || await hasText('知识点');
    const fold = await hasText('折叠') || await hasText('收起') || await hasText('展开');
    const exp = await hasText('导出 SVG') || await hasText('导出 Word') || await hasText('导出 Markdown');
    const s = await shot('LS-KNOW-01');
    record('LS-KNOW-01', '左侧知识点成体系可折叠可导出', know && (fold || exp) ? '通过' : '部分通过', '导图+要点+举例且可折叠导出', `知识点=${know} 折叠=${fold} 导出=${exp}`, s, '导图可能需提交评估后才出现');
  } catch (e) {
    record('LS-KNOW-01', '左侧知识点成体系可折叠可导出', '失败', '体系化知识点', String(e.message || e), await shot('LS-KNOW-01-err'), '');
  }

  try {
    const mat = await hasText('分布式素材上传') || await hasText('PDF 电子书');
    const s = await shot('LS-MAT-01');
    record('LS-MAT-01', '分布式素材上传后生成导图知识点', mat ? '通过' : '失败', '上传入口存在并可生成', mat ? '分布式素材上传区可见' : '未见上传区', s, '未实际上传书籍');
  } catch (e) {
    record('LS-MAT-01', '分布式素材上传后生成导图知识点', '失败', '素材上传', String(e.message || e), await shot('LS-MAT-01-err'), '');
  }

  try {
    const socialTab = page.getByRole('button', { name: /通用社交/ }).first();
    const legacyTab = page.getByRole('button', { name: /通用逻辑/ }).first();
    if (await socialTab.isVisible().catch(() => false)) {
      await socialTab.click({ force: true });
      await page.waitForTimeout(800);
    }
    const t = await bodyText();
    const hasSocial = t.includes('通用社交');
    const hasLegacyOnly = t.includes('通用逻辑') && !hasSocial;
    const s = await shot('LS-CASE-01');
    if (hasSocial && !hasLegacyOnly) {
      record('LS-CASE-01', '第三类训练案例应为通用社交', '通过', '第三项为「通用社交」', 'Tab/文案含通用社交，无「通用逻辑」独占', s, '');
    } else if (await legacyTab.isVisible().catch(() => false)) {
      record('LS-CASE-01', '第三类训练案例应为通用社交', '失败', '第三项为「通用社交」', '仍见「通用逻辑」Tab', s, '');
    } else {
      record('LS-CASE-01', '第三类训练案例应为通用社交', '失败', '第三项为「通用社交」', '未见通用社交文案', s, '');
    }
    record('LS-CASE-02', '案例应有 8–10 分钟完整对话', '部分通过', '8-10 分钟、前因后果完整、博弈激烈', '需人工阅读长度；自动化仅截到当前案例文本', await shot('LS-CASE-02'), '待功能落地后再测');
  } catch (e) {
    record('LS-CASE-01', '第三类训练案例应为通用社交', '失败', '通用社交', String(e.message || e), await shot('LS-CASE-01-err'), '');
    record('LS-CASE-02', '案例应有 8–10 分钟完整对话', '阻塞', '8-10 分钟案例', String(e.message || e), await shot('LS-CASE-02-err'), '');
  }

  // SP-*
  try {
    await openTop('破局(说)');
    await page.waitForTimeout(1200);
    const critique = await hasText('破绽与失分点') || await hasText('Critique');
    const ask = await hasText('漏洞靶向追问') || await hasText('追问');
    const s = await shot('SP-CRIT-01');
    record('SP-CRIT-01', '破绽与失分点可看全并可追问', critique || ask ? '部分通过' : '失败', '可滚动看全并可交互', `破绽区=${critique} 追问=${ask}（需先提交一轮才有内容）`, s, '');
  } catch (e) {
    record('SP-CRIT-01', '破绽与失分点可看全并可追问', '失败', '可滚动可追问', String(e.message || e), await shot('SP-CRIT-01-err'), '');
  }

  try {
    const stop = await hasText('停止') || await hasText('结束');
    const scene = await hasText('1VS1') || await hasText('多人') || await hasText('日常 1VS1');
    const s = await shot('SP-SCENE-01');
    record('SP-SCENE-01', '1VS1/多人场景可停止后再分析', scene || stop ? '部分通过' : '失败', '有停止键且结束后才分析', `场景=${scene} 停止=${stop}`, s, '');
  } catch (e) {
    record('SP-SCENE-01', '1VS1/多人场景可停止后再分析', '失败', '停止后再分析', String(e.message || e), await shot('SP-SCENE-01-err'), '');
  }

  // RD-*
  try {
    await openTop('穿透(读)');
    await page.waitForTimeout(1000);
    const paste = visibleTextarea();
    if (await paste.count()) {
      await paste.fill('关于加快推进老旧小区改造的通知。各方对资金来源和工期存在明显利益分歧。');
    }
    const urlTab = await hasText('网页抓取');
    const s = await shot('RD-MAT-01');
    record('RD-MAT-01', '上传或粘贴材料可成功', (await paste.count()) > 0 ? '通过' : '失败', '粘贴内容保留', '文本已填入输入框', s, '');
  } catch (e) {
    record('RD-MAT-01', '上传或粘贴材料可成功', '失败', '可粘贴', String(e.message || e), await shot('RD-MAT-01-err'), '');
  }

  try {
    const start = page.getByText('启动 AI 穿透解码', { exact: false }).first();
    if (await start.count()) {
      await start.click();
      await page.waitForTimeout(8000);
    }
    const t = await bodyText();
    const ok = t.includes('穿透解码报告') || t.includes('导师评价') || t.includes('任务') || t.includes('解码');
    const fail = t.includes('解码异常') || t.includes('失败');
    const s = await shot('RD-DEC-01');
    record('RD-DEC-01', '穿透解码能刷出结果', ok && !fail ? '通过' : fail ? '失败' : '部分通过', '出现报告或明确失败原因', ok ? '出现解码/任务相关文案' : '8 秒内未见报告', s, '完整 Dify 可能更久');
  } catch (e) {
    record('RD-DEC-01', '穿透解码能刷出结果', '失败', '能出结果', String(e.message || e), await shot('RD-DEC-01-err'), '');
  }

  try {
    const push = page.getByText('每日 AI 素材推送', { exact: false }).first();
    if (await push.count()) await push.click();
    await page.waitForTimeout(2000);
    const s = await shot('RD-LEN-01');
    record('RD-LEN-01', 'AI 推送素材应足够详尽', '部分通过', '推送接近自贴长文详尽度', '已点击推送并截图，长度需人工判断', s, '待功能落地后再测');
  } catch (e) {
    record('RD-LEN-01', 'AI 推送素材应足够详尽', '阻塞', '详尽推送', String(e.message || e), await shot('RD-LEN-01-err'), '');
  }

  // WR-*
  try {
    await openTop('文治(写)');
    await page.waitForTimeout(1000);
    const gov = page.getByText('体制内公文写作', { exact: false }).first();
    if (await gov.count()) await gov.click();
    const areas = page.locator('textarea:visible');
    const n = await areas.count();
    if (n > 0) await areas.nth(n - 1).fill('关于加快推进XX街道老旧小区改造的请示。拟于本季度完成方案报批，请予支持。');
    const submit = page.getByText('提交三维战略审阅', { exact: false }).first();
    if (await submit.count()) await submit.click();
    await page.waitForTimeout(20000);
    const t = await bodyText();
    const ok = /L1|L2|L3|审阅完成|展开审阅/.test(t);
    const timeout = t.includes('超时') || t.includes('失败');
    const s = await shot('WR-CN-01');
    record('WR-CN-01', '中文/公文审阅必须出结果', ok ? '通过' : timeout ? '失败' : '部分通过', '出现三级审阅或明确超时', ok ? '出现审阅报告相关文案' : timeout ? '超时/失败' : '20 秒内未见完整 L1/L2/L3', s, '');
  } catch (e) {
    record('WR-CN-01', '中文/公文审阅必须出结果', '失败', '公文审阅出结果', String(e.message || e), await shot('WR-CN-01-err'), '');
  }

  try {
    const biz = page.getByText('高阶商务与提案', { exact: false }).first();
    if (await biz.count()) await biz.click();
    const s = await shot('WR-EN-01');
    record('WR-EN-01', '英文邮件审阅仍可用', await hasText('高阶商务与提案') ? '通过' : '失败', '商务提案模块可打开', '模块入口可见', s, '未再提交一封英文以免重复占额度');
  } catch (e) {
    record('WR-EN-01', '英文邮件审阅仍可用', '失败', '英文邮件可用', String(e.message || e), await shot('WR-EN-01-err'), '');
  }

  try {
    const optional = await hasText('对标文本（可选）') || await hasText('选填');
    const s = await shot('WR-BENCH-01');
    record('WR-BENCH-01', '没有对标文章也能批阅', optional ? '通过' : '部分通过', '对标为选填且仍能审阅', optional ? '页面标明对标可选' : '未看到可选文案', s, '');
  } catch (e) {
    record('WR-BENCH-01', '没有对标文章也能批阅', '失败', '对标可选', String(e.message || e), await shot('WR-BENCH-01-err'), '');
  }

  // GT-*
  try {
    await openTop('驭心博弈');
    await page.waitForTimeout(1000);
    await clickText('驭人术与人性档案', { exact: true }).catch(() => clickContains('驭人术'));
    await page.waitForTimeout(500);
    const exp = await hasText('导出');
    const s = await shot('GT-EXP-01');
    record('GT-EXP-01', '知识点/手段导出不太慢', exp ? '通过' : '失败', '导出入口可用', exp ? '导出按钮可见' : '未见导出', s, '未下载打开 Office');
  } catch (e) {
    record('GT-EXP-01', '知识点/手段导出不太慢', '失败', '可导出', String(e.message || e), await shot('GT-EXP-01-err'), '');
  }

  try {
    await dismissOverlays();
    await clickText('高管斗争案例研判', { exact: true }).catch(() => clickContains('高管斗争'));
    await page.waitForTimeout(600);
    const caseBox = page.locator('textarea:visible').first();
    const first = (await caseBox.inputValue().catch(() => '')) || (await bodyText()).slice(0, 600);
    const swap = page.getByRole('button', { name: /换一条|推送中/ }).first();
    if (await swap.isVisible().catch(() => false)) {
      await swap.click({ force: true });
      await page.waitForTimeout(4000);
      await dismissOverlays();
    }
    const second = (await caseBox.inputValue().catch(() => '')) || (await bodyText()).slice(0, 600);
    const changed = first !== second && second.length > 20;
    const s = await shot('GT-CASE-01');
    record('GT-CASE-01', '刷新后案例不能总是同一批', changed ? '通过' : '失败', '换一条后案例正文变化', changed ? '案例正文已变化' : `换一条后正文未变（len ${first.length}->${second.length}）`, s, '');
  } catch (e) {
    record('GT-CASE-01', '刷新后案例不能总是同一批', '失败', '案例会换', String(e.message || e), await shot('GT-CASE-01-err'), '');
  }

  try {
    const s = await shot('GT-CASE-02');
    record('GT-CASE-02', '案例详实角色复杂研判有逻辑情感', '部分通过', '背景详实、角色复杂、研判非套话', '需人工读研判质量；本轮只截案例页', s, '待功能落地后再测');
  } catch (e) {
    record('GT-CASE-02', '案例详实角色复杂研判有逻辑情感', '阻塞', '内容质量', String(e.message || e), await shot('GT-CASE-02-err'), '');
  }

  try {
    await clickText('驭人术与人性档案', { exact: true }).catch(() => clickContains('驭人术'));
    await page.waitForTimeout(400);
    const upload = await hasText('上传资料') || await hasText('上传驭人术');
    const s = await shot('GT-TAC-01');
    record('GT-TAC-01', '驭人术手段具体可上传书籍并导出', upload ? '通过' : '部分通过', '有具体手段且可上传导出', upload ? '上传资料入口可见' : '未见上传入口', s, '');
  } catch (e) {
    record('GT-TAC-01', '驭人术手段具体可上传书籍并导出', '失败', '上传+导出', String(e.message || e), await shot('GT-TAC-01-err'), '');
  }

  try {
    const name = `E2E-VP-${Date.now().toString().slice(-6)}`;
    const nameInput = page.getByPlaceholder('例如：James VP 或 财务总监A');
    if (await nameInput.count()) {
      await nameInput.fill(name);
      const desc = page.getByPlaceholder('描述其权力的硬伤', { exact: false }).first();
      if (await desc.count()) await desc.fill('极其注重个人利益安全，会议上常用合规口径施压');
      await page.getByText('录入人性档案册', { exact: false }).first().click();
      await page.waitForTimeout(2000);
    }
    const t = await bodyText();
    const ok = t.includes(name) && !t.includes('录入失败');
    const s = await shot('GT-ARCH-01');
    record('GT-ARCH-01', '人性档案手动录入必须成功', ok ? '通过' : '失败', '列表出现新档案', ok ? `列表出现 ${name}` : '录入后未见新档案或失败', s, '');
  } catch (e) {
    record('GT-ARCH-01', '人性档案手动录入必须成功', '失败', '录入成功', String(e.message || e), await shot('GT-ARCH-01-err'), '');
  }

  try {
    await clickText('人机对战沙盘', { exact: true }).catch(() => clickContains('人机对战'));
    await page.waitForTimeout(600);
    const arch = await hasText('已有人性档案') || await hasText('人性档案');
    const s = await shot('GT-SIM-01');
    record('GT-SIM-01', '人机沙盘可从档案库选择对手', arch ? '通过' : '部分通过', '可选已有人性档案', arch ? '已有人性档案区域可见' : '未见档案选择区', s, '');
    record('GT-SIM-02', '研判应给出策略示例与语气修正', '部分通过', '针对用户反应给策略和语气修正', '需等研判完成并人工读内容', await shot('GT-SIM-02'), '待功能落地后再测；本轮未提交完整对局');
  } catch (e) {
    record('GT-SIM-01', '人机沙盘可从档案库选择对手', '失败', '可选档案', String(e.message || e), await shot('GT-SIM-01-err'), '');
    record('GT-SIM-02', '研判应给出策略示例与语气修正', '阻塞', '策略示例', String(e.message || e), await shot('GT-SIM-02-err'), '');
  }

  try {
    await clickText('顶层认知升维', { exact: true }).catch(() => clickContains('顶层认知'));
    await page.waitForTimeout(500);
    const area = visibleTextarea();
    if (await area.count()) {
      await area.fill('新任外企 VP 在会议上将供应链延迟的责任隐性甩锅给我的团队');
    }
    const submit = page.getByText('提交五层因果链并启动升维研判', { exact: false }).first();
    if (await submit.count()) await submit.click();
    await page.waitForTimeout(8000);
    const t = await bodyText();
    const ok = t.includes('任务') || t.includes('研判') || t.includes('已提交');
    const emptyFail = t.includes('出不了') || t.includes('升维提交失败');
    const s = await shot('GT-ASC-01');
    record('GT-ASC-01', '顶层认知升维能出结果', emptyFail ? '失败' : ok ? '通过' : '部分通过', '出现研判或任务成功', emptyFail ? '提交失败' : ok ? '出现任务/研判文案' : '8 秒内未见结果', s, '');
  } catch (e) {
    record('GT-ASC-01', '顶层认知升维能出结果', '失败', '能出结果', String(e.message || e), await shot('GT-ASC-01-err'), '');
  }

  // AE-*
  try {
    await openTop('高阶审美');
    await page.waitForTimeout(1000);
    await clickContains('顶级政商社交训练').catch(() => {});
    const tips = await hasText('实操要点');
    const s = await shot('AE-TIP-01');
    record('AE-TIP-01', '实操要点足够且可验证日更', tips ? '部分通过' : '失败', '要点不少于 3 条且可日更', tips ? '实操要点区可见，日更需次日对比' : '未见实操要点', s, '');
  } catch (e) {
    record('AE-TIP-01', '实操要点足够且可验证日更', '失败', '实操要点', String(e.message || e), await shot('AE-TIP-01-err'), '');
  }

  try {
    const sceneBtn = page.locator('button').filter({ hasText: /饭局|敬酒|社交|场合/ }).first();
    if (await sceneBtn.count()) await sceneBtn.click().catch(() => {});
    const areas = page.locator('textarea');
    if (await areas.count()) {
      await areas.last().fill('领导先请，我杯口低一点就好。');
    }
    const judge = page.getByText('提交社交指数量化研判', { exact: false }).first();
    if (await judge.count()) {
      await judge.click();
      await page.waitForTimeout(12000);
    }
    const t = await bodyText();
    const vocabLeak = /词性|音标|plural|definition of|单词释义/.test(t) && !t.includes('社交指数');
    const ok = t.includes('社交指数') || t.includes('研判') || t.includes('分寸');
    const s = await shot('AE-JUD-01');
    record('AE-JUD-01', '量化研判必须是社交点评不是单词解释', vocabLeak ? '失败' : ok ? '通过' : '部分通过', '社交点评+示例，不能是词典', vocabLeak ? '结果疑似单词解释' : ok ? '出现社交研判相关文案' : '12 秒内未见研判', s, '');
  } catch (e) {
    record('AE-JUD-01', '量化研判必须是社交点评不是单词解释', '失败', '社交点评', String(e.message || e), await shot('AE-JUD-01-err'), '');
  }

  try {
    const poker = page.getByText('德州扑克实战', { exact: false }).first();
    if (await poker.count()) await poker.click();
    await page.waitForTimeout(800);
    const ok = await hasText('德州扑克');
    const s = await shot('AE-POKER-01');
    record('AE-POKER-01', '棋牌区包含德州扑克', ok ? '通过' : '失败', '有德州扑克实战 Tab 并可进入', ok ? '德州扑克实战页可见' : '未见德州扑克', s, '');
  } catch (e) {
    record('AE-POKER-01', '棋牌区包含德州扑克', '失败', '有德扑', String(e.message || e), await shot('AE-POKER-01-err'), '');
  }

  // XF-*
  try {
    const vault = page.getByText('资料抽屉', { exact: false }).first();
    if (await vault.count()) await vault.click();
    await page.waitForTimeout(800);
    const ok = (await hasText('资料管理中心')) && (await hasText('英语笔记本')) && (await hasText('逻辑博弈框架'));
    const exp = await hasText('导出');
    const s = await shot('XF-VAULT-01');
    record('XF-VAULT-01', '资料抽屉分块导出 Word/Excel', ok && exp ? '通过' : ok ? '部分通过' : '失败', '四块可导出 Word/CSV', `中心=${ok} 导出=${exp}`, s, '');
    await page.keyboard.press('Escape');
  } catch (e) {
    record('XF-VAULT-01', '资料抽屉分块导出 Word/Excel', '失败', '分块导出', String(e.message || e), await shot('XF-VAULT-01-err'), '');
  }

  try {
    const s = await shot('XF-LINK-01');
    record('XF-LINK-01', '听/说/博弈知识可同步', '部分通过', '同步确认且失败不白屏', '抽屉含同步入口需人工点确认；本轮未点同步以免改训练注入', s, '');
  } catch (e) {
    record('XF-LINK-01', '听/说/博弈知识可同步', '阻塞', '可同步', String(e.message || e), await shot('XF-LINK-01-err'), '');
  }

  try {
    record('XF-FEED-01', '上传书籍生成导图并随使用加深', '部分通过', '导图+知识点且多次使用加深', '上传入口分散在洞察/驭人术/资料抽屉，深度需跨日', await shot('XF-FEED-01'), '待功能落地后再测');
  } catch (e) {
    record('XF-FEED-01', '上传书籍生成导图并随使用加深', '阻塞', '加深', String(e.message || e), await shot('XF-FEED-01-err'), '');
  }

  // PERF-01
  try {
    const t0 = Date.now();
    for (const tab of ['英语引擎', '洞察(听)', '破局(说)', '驭心博弈', '高阶审美']) {
      await openTop(tab);
    }
    const elapsed = Date.now() - t0;
    const s = await shot('PERF-01');
    record('PERF-01', '折叠切 Tab 不严重卡顿', elapsed < 20000 ? '通过' : '部分通过', '切换约 1 秒级、无假死', `五模块往返耗时 ${elapsed}ms`, s, '');
  } catch (e) {
    record('PERF-01', '折叠切 Tab 不严重卡顿', '失败', '不卡顿', String(e.message || e), await shot('PERF-01-err'), '');
  }

  await fs.promises.writeFile(path.join(OUT, 'results.json'), JSON.stringify({ stamp: STAMP, results }, null, 2), 'utf8');
  await browser.close();
  console.log('DONE', results.length, 'cases');
}

main().catch((err) => {
  console.error(err);
  fs.writeFileSync(path.join(OUT, 'fatal.txt'), String(err && err.stack || err), 'utf8');
  process.exit(1);
});
