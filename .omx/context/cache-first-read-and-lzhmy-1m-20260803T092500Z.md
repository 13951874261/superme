# Context Snapshot: cache-first-read-and-lzhmy-1m

- Task statement: 登录后唤醒/破绽/长文优先读缓存毫秒级展示；无缓存提示手动生成；改代码；给部署脚本；立即为 lzhmy 生成 1 分钟数据且仅 2 个 mp3
- Desired outcome: 有缓存秒开；无缓存可手动生成；lzhmy 具备可用的 1 分钟长文+2 个音频
- Stated solution: 改前后端读路径为 cache-first；提供上传脚本；按后台方式生成 lzhmy duration=1 且 mp3 仅 2 个
- Probable intent: 结束「有库数据却超时/0词」与「切换条件触发慢生成」；同时快速补齐可演示的最小 1 分钟听读资产
- Known facts/evidence:
  - `/api/daily-pack/today` 本为纯读；前端 45s 超时且可重试 3 次
  - 登录 catch-up 写 `daily_listen_*`；Dashboard 读 `daily_extracted_articles`（今日常为 0）
  - 本地已有 R3 选人改动未确认是否一并部署
- Constraints: AGENTS 要求中文、确认后改代码；deep-interview 本模式不直接实现
- Round 2 answer [from-user]: 生成策略 A2 = 强制重生成文章 + mp3（覆盖）
- Round 3 answer [from-user]: 执行地点 S3 = 先部署代码到服务器，再在服务器执行生成脚本
- Round 4 answer [from-user]: Non-goal N1 = 完全关闭登录自动补跑；缺包靠手动生成 + 02:00 cron
- Round 5 answer [from-user]: U1 = 无缓存时提示+立即生成按钮；点之前不调 Dify（含长文）
- Pressure pass: 已用下午首登场景复核 N1 → 收敛为 U1
- Updated unknowns: Decision Boundaries（含 R3 是否同批、超时秒数等可自决项）；验收清单最终化


- Decision-boundary unknowns: 无缓存时是否禁止一切自动 Dify；是否允许别名 lzhumy 合并读
- Likely touchpoints: dailyPackAPI.ts, DailyWakeup/ErrorVocab modules, DashboardTab, daily-extract handler, dailyListen*, deploy-smart.ps1
- Relevant docs: docs/superpowers/specs|plans/2026-08-03-login-cron-catchup-*; AGENTS.md
- Terminology: 「后台方式」= cron/catch-up 预生成链路；「其他条件」= genre/cefr/duration/theme
- Prompt-safe initial-context summary status: not_needed
