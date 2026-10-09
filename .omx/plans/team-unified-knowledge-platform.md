# Team Plan: 全产品知识中台 Wave 1

> 来源规格：`.omx/specs/deep-interview-unified-knowledge-platform.md`
> 协调方式：分文件所有权并行；共享文件（`server.js`、模块 TSX）禁止双写。

## 车道所有权

| 车道 | 可写路径 | 禁止 |
|------|----------|------|
| A 类型与适配 | `src/types/knowledge.ts`（新建）、`src/utils/knowledgeAdapter.ts`（新建） | 不改模块、不改 server |
| B Dify YAML | `yml/Insight_Listen_Engine.yml`、`yml/speak_engine.yml`、`yml/Game_Theory_Engine.yml`、`yml/Cognitive_Ascension_Engine.yml` | 不改 time_base 副本、不改前端 |
| C 后端持久化 | `vocab-server/server.js` 中 knowledge_vault 表/CRUD/新路由；`vocab-server/tests/` 新增本地测试 | 不改前端、不改 YAML |

## Wave 1 完成定义（本波结束后才能开听/说/博弈 UI）
- 旧 notes 读写不坏
- 新字段能写入 extra_json 并读回
- `/linked` 只返回已确认同步到指定模块的条目
- traces 追加不覆盖
- 四份 YAML 开始节点有可选 `knowledge_context`，提示词引用该变量
- `toKnowledgeItem` / 三模块 adapter 有上限 5 条与 6000 字截断

## 后续波次（本波不要做）
- Wave 2：抽屉 UI 同步/状态/来源/使用记录
- Wave 3：博弈 analyze/ascension 转发 + 成功写 traces
- Wave 4：听上传→草稿；说/听任务中心化与密钥后端
- Wave 5：图谱表与抽屉图谱面板
- Wave 6：战术/档案映射；写作审美接入
