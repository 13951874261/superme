# Ultragoal Brief — lzhmy-daily-pack-missing

Source: `.omx/specs/deep-interview-lzhmy-daily-pack-missing.md`  
Transcript: `.omx/interviews/lzhmy-daily-pack-missing-20260804T115509Z.md`  
Context: `.omx/context/lzhmy-daily-pack-missing-20260804T112059Z.md`

## Objective
修复 `lzhmy` 今日唤醒/破绽「暂无缓存 / 0 词」，并保证最小听读资产就绪：进站不点刷新即可看到唤醒 10 词 + 破绽 6 词；`meeting/B1/1` 与 `news/B1/1` 长文+音频 ready；读写满足 Dify 稳定入参。

## Constraints / Non-goals
- 不重开登录 catch-up；不做 64 组全量；不改 Dify 工作流；不做 UI 大改；不做多账号体系重构。
- 稳态失败 = 提示 + 手动（U1），不自动调 Dify。
- 本轮交付须含一次运维补生成，写入真库 `/var/www/super-agent/vocab.db`。
- 代理可自决：前端超时/签名对齐改法、后端缓存键细节、补生成脚本组织、日志/文案微调。

## Acceptance
1. `lzhmy` 打开英语页：唤醒 10 词、破绽 6 词可见，无需先点刷新。
2. `/api/daily-pack/today` 在前端实际稳定入参下 `ready`，且 vocab/flaw 数量达标。
3. `meeting/B1/1`、`news/B1/1` 长文+音频对 `lzhmy` ready。
4. 空/错签名时走 U1，不偷偷自动 Dify。
5. 运维补生成可复现且写真库。
