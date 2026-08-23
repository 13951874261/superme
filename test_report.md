# 全站功能验证报告（三缺口复测）

## 测试概述

| 项 | 内容 |
| --- | --- |
| 执行时间 | 2026-08-23 14:31–14:33（UTC+8） |
| 测试环境 | 生产 [https://app.liujingzhuwo.site/](https://app.liujingzhuwo.site/) |
| 账号 / 密码 | User ID `lzhmy` / 解锁秘钥 `1` |
| 执行方式 | API 抽检 + Playwright 登录后走首页 / 进度总控 / 即兴演讲 / 任务中心 / 底部复盘（Cursor 内置 Browser MCP 本轮不可用，改用项目已有 Playwright） |
| 代码修改概述 | **本轮未改产品代码**。验证 8/23 已部署项：统一主题 `ea8d175`、声线≠短板 `92ff86e`、Cron 删除改隐藏 `752ed61`。 |
| 总测试用例数 | 6 |
| 通过 | 5 |
| 部分通过 / 无法复核 | 1 |
| 失败 | 0 |
| 截图目录 | `dist/e2e-verify/` |

**入口（共用）**

- 访问地址：`https://app.liujingzhuwo.site/`
- 前置：密码 `1` 解锁，账号 `lzhmy`

**关键结论（先看这个）**

复测清单上剩下的 3 类问题，**功能面已对齐**：

1. **当前主题**全站读同一本户口本「新人报到」。侧栏不再写「海外信贷谈判与博弈」。今日包 `currentTheme=新人报到`，`stale=false`。
2. **底部复盘**写「暂无短板」，不再把「英国 (UK)」当短板。顶栏声线仍是 `Libby (英国 (UK))`，这是口音，不是短板。
3. **任务中心**能看到今日 Cron `run_11ba7da3…`，四模块全成功。不再是空列表。

仍无法用今天这条成功 run 证明「精听失败不得标 completed」。软隐藏（点删除只藏不删）本轮没有点删除，未实测。

```
主题对照（同一用户 lzhmy、2026-08-23）

  GET /api/user/theme          → 新人报到
  GET /api/daily-pack/today    → theme=新人报到, currentTheme=新人报到, stale=false, source=cron
  侧栏                         → 当前主题：新人报到
  唤醒条 / 演讲页              → 新人报到
  wakeup.theme                 → Business Communication（课英文小标题，不当当前主题）
  主题下拉里的旧选项            → 商务谈判：让步与施压（仅 OPTION，不是当前主题）
```

---

## 功能测试用例与执行详情

| 编号 | 菜单路径 / 接口 | 测试输入 | 预期结果 | 实际结果 | 截图 | 对应需求 |
| --- | --- | --- | --- | --- | --- | --- |
| FV-THEME-SIDE | 侧栏 | 登录后首页 | 文案为「当前主题：{户口本}」，不再写死周主题 | **通过** `当前主题：新人报到` | `10-home-theme-weakness.png` | 侧栏跟户口本 |
| FV-CRON-02 | `GET /api/user/theme` + `GET /api/daily-pack/today` + 进度总控 / 即兴演讲 | userId=`lzhmy` | 当前主题四处同一中文 | **通过** 四处「新人报到」；`stale=false` | `11-dashboard-theme.png` / `12-speech-theme.png` | 主题单一数据源 |
| FV-REVIEW-UK | 底部「专属复盘与弱点扫描」 | 无 | 短板不是 TTS 声线 | **通过** 「当前全局短板画像」= **暂无短板**；顶栏仍 `Libby (英国 (UK))` | `14-review-weakness.png` | 声线 ≠ 短板 |
| FV-CRON-01 | 顶栏后台任务 / `GET /api/daily-cron/runs?userId=lzhmy&days=7` | lzhmy | 能看到今日四模块 | **通过** UI「每日定时任务 2026-08-23」；接口 1 条 run，`hiddenCount=0`；唤醒/破绽/长文/精听均为 1/1 或 64/64 | `13-task-center.png` | Cron 可观测 |
| FV-CRON-HIDE | 任务中心删除 | 本轮未点删除 | 删后列表没了、`hiddenCount≥1`、库行还在 | **未测** 有可见 run，未做破坏性删除 | — | 软隐藏 |
| FV-CRON-03 | 同一 run 状态 | 有失败不得标完成 | 失败则 `partial_failed` / `degraded` | **无法复核** 今日精听 1/1 成功，`status=completed` / `auditHealth=ok` 在成功路径上合理 | `13-task-center.png` | 失败态 |

`GET /api/vocab/health` → `{ok:true, service:"vocab-server"}`。

---

## 失败案例分析

无失败项。

### 附带、不判失败

1. **主题下拉仍有「商务谈判：让步与施压」**  
   只出现在 `<option>`，不是当前主题。成绩单/可选主题可以有很多名字。

2. **唤醒包 `wakeup.theme = Business Communication`**  
   规格已定：这是课的英文小标题，不当户口本。

3. **FV-CRON-03**  
   代码侧已改「失败不得 completed」。今天这条 run 没有失败步，现网仍缺一条失败样例。

4. **部署日志里其他用户的 `think_only_article`**  
   账号 `user_4d51a0fc-...` 的 Cron 精听仍可能因模型只吐思考、没有正文而失败。不在本次 3 项范围内。

---

## 具体解决方案（待你选下一步再改）

1. 要证明 FV-CRON-03：等下一次真实失败，或手动造一条精听失败 run（不要改今天已成功的记录）。
2. 要测软隐藏：在任务中心删一条已结束 run，看空态「已隐藏 N 条」和接口 `hiddenCount`。
3. 下一个产品缺口：修 DailyListen `think_only_article`（模型只返回思考标签、正文不可用）。

---

## 截图清单

| 文件 | 覆盖用例 |
| --- | --- |
| `dist/e2e-verify/10-home-theme-weakness.png` | 登录后首页、侧栏当前主题、每日包 |
| `dist/e2e-verify/11-dashboard-theme.png` | 进度总控主题「新人报到」 |
| `dist/e2e-verify/12-speech-theme.png` | 即兴演讲主题「新人报到」，无 HIGH-OBSTACLE |
| `dist/e2e-verify/13-task-center.png` | 今日 Cron 四模块成功 |
| `dist/e2e-verify/14-review-weakness.png` | 底部短板「暂无短板」 |
| `dist/e2e-verify/verify-3items.json` | Playwright 文本抽取 |

未执行：整次重跑 Cron、重置今日、点删除、提交文治/英语审阅、开始演讲录音。
