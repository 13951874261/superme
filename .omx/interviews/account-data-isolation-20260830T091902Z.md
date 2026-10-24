# Deep Interview Transcript: account-data-isolation

- interview_id: 4226d535-15c9-4e36-ad88-fa70335fe700
- profile: standard (threshold ≤ 0.20)
- type: brownfield
- rounds: 7
- final ambiguity: ~0.11
- context snapshot: `.omx/context/account-data-isolation-20260830T090530Z.md`
- timestamp: 2026-08-30T09:19:02Z

## Transcript

| Round | Dimension | Answer |
|-------|-----------|--------|
| 1 | Intent | 主失败 = 同机换号串界面：后登录者绝不能看到上一账号的画像、复盘、生词、长文 |
| 2 | Outcome | 分桶 + 把复盘/夜话存到该账号服务端，换回原账号可恢复 |
| 3 | Scope (Contrarian) | 本轮必须上云：分桶不够，换回也要从服务器恢复复盘/夜话 |
| 4 | Scope (Simplifier) | 初选「所有学习类本地缓存都上云」 |
| 5 | Scope (Terminologist) | 澄清为：服务端已有的换号后按当前账号重拉；只把服务端还没有的复盘/夜话/计划/模块草稿新建账号存储 |
| 6 | Non-goals | 不加 session；不拆界面偏好；不修生成串号/清今日；不回滚历史脏数据；不改视觉 |
| 7 | Decision Boundaries | 实现可自决（键前缀、user_memories vs 新表、重拉顺序、缺省 userId 改为拒绝）；扩范围必须先问 |

## Pressure-pass finding

Round 3 回访 Round 2「分桶+上云」：隔离本身只需分桶，上云是换回恢复。用户明确 **本轮必须上云**，不能先只分桶。

Round 5 回访 Round 4「全部上云」：否决字面双写长文/生词；改为服务端已有资源重拉 + 仅补齐服务端缺失的本地学习态。

## User scheme

方案 A（相对 B/C）：全模块学习数据随账号隔离；不做 session token。
