### 一、 改造文档结构与总览

本次集成将触及前后端核心链路，具体涉及的文件树如下：

```text
superme/
├── vocab-server/
│   ├── package.json                     <-- [修改] 新增 node-cron 依赖
│   ├── cron/
│   │   └── dailyFeeder.js               <-- [新增] 核心引擎：调用 Dify 并将 JSON 拆解入库
│   └── server.js                        <-- [修改] 挂载 Cron 定时任务，新增防作弊拦截 API
└── src/
    ├── services/
    │   └── trainingAPI.ts               <-- [修改] 新增 checkThemeMastery 接口
    └── components/
        └── modules/
            └── EnglishModule.tsx        <-- [修改] 接管主题下拉框，实现未达标时的 UI 强锁定

```

---

### 二、 核心代码实现方案

#### 1. 后端依赖补全 (`vocab-server/package.json`)

请在 `dependencies` 中添加 `node-cron` 和 `node-fetch`：

```json
  "dependencies": {
    "better-sqlite3": "^9.4.3",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "uuid": "^9.0.0",
    "node-cron": "^3.0.3",
    "node-fetch": "^3.3.2"
  }

```

#### 2. 全自动投喂引擎 (`vocab-server/cron/dailyFeeder.js`)

在 `vocab-server` 目录下新建 `cron` 文件夹，并创建 `dailyFeeder.js`。该脚本负责每天自动调用您的 Dify 工作流，并将复杂的 JSON 无缝切片落库：

```javascript
const { v4: uuidv4 } = require('uuid');

async function runDailyFeeder(db, theme = '商务谈判：让步与施压', difficulty = 'B2') {
  console.log(`[Auto-Feeder] 启动战术投喂任务，当前主题：${theme}`);
  
  // 填入您刚刚生成的 API Key
  const apiKey = process.env.DIFY_AUTO_FEEDER_API_KEY || 'app-BvxaAkVfKNB19EfJ7qw1Zzsw';
  const baseUrl = process.env.DIFY_BASE_URL || 'https://dify.234124123.xyz';

  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(`${baseUrl}/v1/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: { theme, difficulty },
        response_mode: 'blocking',
        user: 'system-cron-worker'
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Dify Workflow 执行失败');

    // 提取并解析您示例中的标准 JSON
    const resultStr = data.data?.outputs?.result_json || data.data?.outputs?.result;
    const parsed = JSON.parse(resultStr);

    const now = Date.now();
    const nextReview = now + 5 * 60 * 1000; // 5分钟后进入艾宾浩斯首次复习

    // 1. 拆解写入词汇与短语 (艾宾浩斯生词本)
    const insertVocab = db.prepare(`
      INSERT INTO vocabulary 
      (id, word, user_id, dict_type, category, payload, added_at, repetitions, ease_factor, interval_days, next_review_date, review_history) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 2.5, 0, ?, '[]')
    `);

    db.transaction(() => {
      if (parsed.vocab && Array.isArray(parsed.vocab)) {
        parsed.vocab.forEach(v => {
          insertVocab.run(uuidv4(), v.word, 'default-user', 'auto_feeder', 'business', JSON.stringify({
            meaning: v.meaning, phonetic: v.phonetic, partOfSpeech: v.pos, definition_en: '', business_note: '', examples: []
          }), now, nextReview);
        });
      }
      if (parsed.phrases_and_sentences && Array.isArray(parsed.phrases_and_sentences)) {
        parsed.phrases_and_sentences.forEach(p => {
          insertVocab.run(uuidv4(), p.phrase, 'default-user', 'auto_feeder', 'business', JSON.stringify({
            meaning: p.meaning, examples: [p.example], source: '每日弹药投喂'
          }), now, nextReview);
        });
      }
    })();

    // 2. 拆解写入盲听舱语料
    const lm = parsed.listening_material;
    if (lm) {
      db.prepare(`
        INSERT INTO listening_materials 
        (id, title, content_text, audio_url, difficulty, category, duration, has_subtext, subtext_analysis, source_type, source_topic, created_at, updated_at) 
        VALUES (?, ?, ?, '', ?, '商务谈判', ?, 1, ?, 'tts', ?, ?, ?)
      `).run(uuidv4(), lm.title, lm.content_text, difficulty, lm.duration || 60, lm.subtext_analysis, theme, now, now);
    }

    // 3. 记录长文日志
    if (parsed.daily_article) {
       console.log(`[Auto-Feeder] 今日长文已截获: ${parsed.daily_article.title}`);
    }

    console.log(`[Auto-Feeder] 投喂成功！新增弹药: ${(parsed.vocab?.length||0) + (parsed.phrases_and_sentences?.length||0)} 发`);
  } catch (error) {
    console.error('[Auto-Feeder] 引擎运转异常:', error.message);
  }
}

module.exports = { runDailyFeeder };

```

#### 3. 挂载定时任务与防作弊 API (`vocab-server/server.js`)

在您的 `server.js` 顶部引入依赖，并在现有的 API 路由区加入以下代码：

```javascript
const cron = require('node-cron');
const { runDailyFeeder } = require('./cron/dailyFeeder');

// ... (现有的初始化代码) ...

// [自动化投喂引擎] 每天凌晨 02:00 自动执行
cron.schedule('0 2 * * *', () => {
  // 此处可从数据库读取用户的当前聚焦 Theme
  runDailyFeeder(db, "商务谈判：让步与施压", "B2");
});

// [测试后门] 手动触发投喂
app.post('/api/theme/trigger-feed', async (req, res) => {
  await runDailyFeeder(db, req.body.theme || "国际银团贷款", req.body.difficulty || "C1");
  res.json({ success: true, message: '全自动投喂指令已下达' });
});

// [防作弊拦截器] 强校验主题通关状态
app.get('/api/theme/check-mastery', (req, res) => {
  const theme = String(req.query.theme || '');
  try {
    // 1. 口语沙盘：统计该主题下真实交锋回合数
    const oralRow = db.prepare(`SELECT count(*) as c FROM training_attempts WHERE scene_type = ? AND module_type = 'oral'`).get(theme);
    const oralCount = oralRow ? oralRow.c : 0;

    // 2. 纵深书面：查询该主题下取得的历史最高分
    const writeRow = db.prepare(`SELECT MAX(score) as s FROM training_attempts WHERE scene_type = ? AND module_type = 'write'`).get(theme);
    const maxWriteScore = writeRow ? (writeRow.s || 0) : 0;

    // 硬性指标：口语对抗 ≥ 10轮，且书面 L3 批阅 ≥ 8分
    const isMastered = oralCount >= 10 && maxWriteScore >= 8;

    res.json({ success: true, theme, oralCount, maxWriteScore, isMastered });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

```

#### 4. 前端接口挂载 (`src/services/trainingAPI.ts`)

在文件中补充 API 调用：

```typescript
export async function checkThemeMastery(theme: string): Promise<{ isMastered: boolean; oralCount: number; maxWriteScore: number }> {
  const res = await fetch(`/api/theme/check-mastery?theme=${encodeURIComponent(theme)}`);
  if (!res.ok) throw new Error('Failed to check mastery');
  return res.json();
}

```

#### 5. 跨国高管级 UI 拦截 (`src/components/modules/EnglishModule.tsx`)

将原有的下拉框代码替换为带有数据绑定的强拦截状态，彻底封死随意切换主题的可能。

```tsx
import React, { useEffect, useMemo, useState } from 'react';
// ... 补充引入 API
import { checkThemeMastery } from '../../services/trainingAPI';

// ... 组件内部
const [theme, setTheme] = useState('商务谈判：让步与施压');
const [masteryData, setMasteryData] = useState({ isMastered: false, oralCount: 0, maxWriteScore: 0 });

// 监听主题切换，实时核对通关进度
useEffect(() => {
  checkThemeMastery(theme).then(res => setMasteryData(res)).catch(() => {});
}, [theme]);

// 找到原有渲染 theme 下拉框的地方，替换为：
<div className="flex flex-col flex-1">
  <span className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-3">当前闭环主题 (Theme Gateway)</span>
  <div className="flex items-center gap-3">
    <select 
      value={theme} 
      onChange={(e) => {
        // 残酷拦截逻辑
        if (!masteryData.isMastered && e.target.value !== theme) {
          alert(`🚫 跨国高管拦截指令：\n\n当前阵地【${theme}】尚未被攻克！\n\n当前战绩：\n- 沉浸式口语沙盘：${masteryData.oralCount}/10 轮\n- L3 级书面评估最高分：${masteryData.maxWriteScore}/10 分（及格线: 8分）\n\n请不要好高骛远，把当前阵地打透再拔营。`);
          return;
        }
        setTheme(e.target.value);
      }} 
      onClick={(e) => e.stopPropagation()} 
      className="flex-1 bg-[#f8f9fa] border border-gray-200 text-[#202124] text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-[#FF5722]"
    >
      <option value="商务谈判：让步与施压">商务谈判：让步与施压 (Day 4/10)</option>
      <option value="危机公关：外媒答疑">危机公关：外媒答疑 (Day 1/10)</option>
      <option value="项目汇报：跨国董事会">项目汇报：跨国董事会 (Day 1/10)</option>
    </select>
    
    <div className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all whitespace-nowrap border ${masteryData.isMastered ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
      {masteryData.isMastered ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
      <span className="text-xs font-black uppercase tracking-widest">
        {masteryData.isMastered ? '已通关 (解锁下沉)' : '未达标 (强制锁定)'}
      </span>
    </div>
  </div>
  {!masteryData.isMastered && (
    <div className="text-[10px] text-gray-500 font-medium mt-2">
      当前通关进度：口语对抗 {masteryData.oralCount}/10轮 | 顶级书面评估 {masteryData.maxWriteScore}/8分
    </div>
  )}
</div>

```

---

### 三、 一键部署指令 (PowerShell)

在项目根目录 (`D:\cursor\work\super-agent`) 运行以下命令，完成本轮代码的前后端同步部署：

```powershell
pnpm install; pnpm build; scp -r .\dist\* ubuntu@150.158.34.217:/var/www/super-agent/dist/; ssh ubuntu@150.158.34.217 "mkdir -p /opt/vocab-server/cron"; scp .\vocab-server\cron\dailyFeeder.js ubuntu@150.158.34.217:/opt/vocab-server/cron/dailyFeeder.js; scp .\vocab-server\package.json ubuntu@150.158.34.217:/opt/vocab-server/package.json; scp .\vocab-server\server.js ubuntu@150.158.34.217:/opt/vocab-server/server.js; ssh ubuntu@150.158.34.217 "cd /opt/vocab-server && npm install node-cron node-fetch && sudo systemctl restart super-agent-vocab.service && sudo nginx -t && sudo systemctl reload nginx"

```

---

### 四、 本轮验收测试用例 (Test Cases)

部署完成后，请依次执行以下测试以确保闭环严密：

**Test Case 1: 后门手动投喂测试 (验证解析引擎)**

* **操作**：在本地终端执行 `curl -X POST http://150.158.34.217:3001/api/theme/trigger-feed -H "Content-Type: application/json" -d "{\"theme\":\"国际银团贷款\",\"difficulty\":\"C1\"}"`
* **预期**：服务器后台应打印 `[Auto-Feeder] 成功投喂！写入词汇+短语...`。回到前端网页，刷新左下角**艾宾浩斯生词本**，应出现 `syndicate`, `repayment` 等新词，且**精听盲听舱**应多出一个名为 `Understanding Syndicated Loans` 的音频材料（暂无发音需后续补充 TTS）。

**Test Case 2: 纪律拦截测试 (验证防作弊 UI)**

* **操作**：在 `英语战略 ｜ 跨文化信任构建` 面板，查看 `进度总控`。
* **预期**：由于您的口语沙盘轮数和写作得分尚未达标，右侧状态强制显示红色的“未达标 (强制锁定)”。此时若试图在下拉框中选择“危机公关：外媒答疑”，浏览器将立刻弹出无情的警告弹窗，且下拉框值被强行重置，无法跳转。