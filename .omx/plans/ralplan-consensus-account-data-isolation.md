# Ralplan Consensus Handoff — account-data-isolation

```json
{
  "mode": "ralplan",
  "slug": "account-data-isolation",
  "deliberate": true,
  "planning_artifacts": {
    "prd": ".omx/plans/prd-account-data-isolation.md",
    "test_spec": ".omx/plans/test-spec-account-data-isolation.md",
    "architect_archive": ".omx/plans/architect-review-account-data-isolation.md",
    "critic_archive": ".omx/plans/critic-review-account-data-isolation.md",
    "requirements_spec": ".omx/specs/deep-interview-account-data-isolation.md",
    "context": ".omx/context/account-data-isolation-20260830T090530Z.md",
    "interview": ".omx/interviews/account-data-isolation-20260830T091902Z.md"
  },
  "ralplan_architect_review": {
    "round": 2,
    "verdict": "APPROVE",
    "order": "before_critic"
  },
  "ralplan_critic_review": {
    "round": 1,
    "verdict": "APPROVE",
    "order": "after_architect",
    "improvements_merged": true
  },
  "ralplan_consensus_gate": {
    "complete": true,
    "architect_then_critic": true
  },
  "execution_status": "complete_waiting_for_user_lane_choice",
  "recommended_lane": "ultragoal"
}
```

## Consensus summary

- **Chosen:** Option A′ — `user_memories.learning_ui_json` sidecar + C 写纪律（独立 persist，不进 upsert、不 bump 画像 `updated_at`）+ localStorage 分桶且禁止无前缀回退 + `switchAccountSession` 与 `App key={userId}` 重挂。
- **Gates:** Architect R1 ITERATE → Planner R2 → Architect R2 APPROVE → Critic APPROVE → R3 改进已合并。
- **Do not implement in this planning session.** 用户需另选执行车道。

## ADR（终稿）

| 项 | 内容 |
|----|------|
| Decision | Option A′ |
| Drivers | 同机换号串界面；换回要恢复复盘；存储可自决但写路径必须与画像/dreaming 绝缘 |
| Alternatives | B memory_layers（否决）；C 新表（sidecar 失败再升级）；折进 profile SAVE（否决）；只分桶不上云（访谈否决） |
| Why chosen | 不新表；写路径像独立表；满足上云与隔离两车道 |
| Consequences | 共享行但不共享时钟；工作台 GET 可含夜话，Dify 必须列裁剪；旧全局键不迁移 |
| Follow-ups | session、生成串号、脏数据回滚、Dify 跨设备会话恢复 |

## Goal-Mode Follow-up

- **推荐 `$ultragoal`**：按 PRD 九步顺序做完并对照 test-spec。
- **`$team`**：前后端并行，换号 E1–E7 单车道收口；建议与 ultragoal 一起。
- **`$ralph`**：仅当用户明确要单人验收到底。
