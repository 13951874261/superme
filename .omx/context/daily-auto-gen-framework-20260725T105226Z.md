# Context Snapshot: daily-auto-gen-framework

- Task statement: 在现有项目上按前台查询条件定时自动生成内容并存储；每日查询仅取当日满足条件数据。模块含每日唤醒、每日破绽词汇、AI长文提纯、精听盲听。同时明确实现所需 skills。
- Desired outcome: 可执行规格 + skills 清单（非实现）
- Stated solution: 复用 02:00 cron + SQLite/磁盘预生成 + 当日查询优先
- Probable intent hypothesis: 降低白天实时生成延迟/成本，统一四模块的预生成与取数路径
- Known facts/evidence: dailyPackCron/Service 已有；dailyListenPregenerate 有计划与部分实现；taskQueue 已有；Dify/EdgeTTS 已有
- Constraints: AGENTS.md 要求中文、确认后改代码；deep-interview 禁止本模式直接实现
- Unknowns: 四模块统一程度、查询参数传递方式、存储是否变更、Dify/TTS 复用、skills 选型边界
- Decision-boundary unknowns: OMX/agent 可自行决定的架构细节 vs 必须用户确认
- Likely touchpoints: vocab-server/services/dailyPack*.js, dailyListenPreGenerateService.js, taskQueue.js, ListenTab, DailyWakeup/ErrorVocab modules
- Relevant repo docs inspected: docs/superpowers/specs/2026-07-23-daily-pack-cron-design.md, docs/superpowers/plans/2026-07-24-daily-listen-pregenerate.md, .omx/context/daily-listen-pregenerate-deploy-*
- Terminology conflicts: TBD
- Prompt-safe initial-context summary status: not_needed
