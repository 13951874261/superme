# 生产环境端到端功能测试与长文流式超时修复报告

## 一、测试概述
- 测试时间：2026-10-05 18:30:00 CST
- 测试站点：`https://app.liujingzhuwo.site/`
- 本次改动范围（最小必要）：
  1. `vocab-server/services/streamIdleTimeout.js`：调优长文流式空闲超时至 300000ms（5分钟），支持 `onTimeout` 清理底层可读流且不阻塞超时后重试。
  2. `vocab-server/server.js`：长文流式调用（`generateListenLongScriptSync` 与 `runDailyExtractAsync`）注入 `{ sanitize: false, longArticle: true }`，强化流读取器 reader 释放与超时销毁。
  3. `vocab-server/tests/dailyLongArticleReliabilityContract.test.js`：本地/线上流式超时防卡死与时长范围契约测试。
- 测试结果：全部核心用例通过，本地与线上契约测试全绿，长文 13 个历史失败项完成重跑且全部完成（13/13 Completed，0 失败），新文章入库验证无误。

## 二、测试用例与执行详情
| 用例编号 | 菜单路径 / 接口 | 测试输入数据 | 预期结果 | 实际结果 | 状态 |
|---|---|---|---|---|---|
| TC-01 | 本地/线上契约测试 | `node vocab-server/tests/dailyLongArticleReliabilityContract.test.js` | 验证超时清理不阻塞、时长参数解析正确 | `dailyLongArticleReliabilityContract.test.js passed` | PASS |
| TC-02 | 听力超时与范围测试 | `node vocab-server/scripts/test-listen-scope-timeout.js` | 验证 16 组时长范围与超时重置 | `All listen-scope-timeout tests passed` | PASS |
| TC-03 | 生产服务健康检查 | `GET https://app.liujingzhuwo.site/api/vocab/health` | HTTP 200，`success: true, ok: true` | 返回 HTTP 200，服务状态 running | PASS |
| TC-04 | 每日唤醒前端模块 | 首页 -> 每日唤醒（主题：商务谈判：让步与施压） | 6 词及关联语法点正确展示，无占位符 | 页面词汇与语法点完整展示，跟读例句就绪 | PASS |
| TC-05 | 后台任务长文失败项重跑 | POST `/api/daily-cron/runs/run_a7a304f8-6a12-48ab-a07f-4f51635682e7/rerun`，mode: `failed_snapshot` | 长文 13 个失败项全部执行成功，不再报 `stream idle timeout after 120000ms` | 汇总：完成 13 · 跳过 0 · 失败 0 / 共 13，状态 Completed | PASS |
| TC-06 | 真实长文生成与入库 | POST `/api/english/daily-extract` (news/C1/1m) | 完整生成长文并入库 `daily_extracted_articles` 与 `daily_listen_articles` | 成功生成 1186 字长文，入库成功，无超时异常 | PASS |

## 三、对抗式审查与遗留发现（记录于待测模块）
1. **长文超时根因彻底消除**：超时阈值提高到 300 秒，且底层流清理机制不会卡死事件循环，断流时能够快速失败并触发上层重试。
2. **其他模块遗留观察**：
   - 定时任务中的 `read_material` 与 `speaking_scene` 存在独立接口报错（`failed types: multi_role,impromptu`），不属于本次长文修复范围，已记录并在后续模块测试中专门定位。

---

# 生产环境端到端功能测试与阅读素材缓存模块修复报告

## 一、测试概述
- 测试时间：2026-10-06 01:00:00 CST
- 测试站点：`https://app.liujingzhuwo.site/`
- 本次改动范围（最小必要）：
  1. `vocab-server/services/readMaterialCacheService.js`：
     - `generateWithDify` 注入系统时间参数 `_system_time`、`_system_timestamp_ms`，对齐工作流契约；
     - `unpackMaterialText` 智能解包增强：长邮件正文提取支持 `dialogue` 字段，保留 `hidden_intent` 中“以下为虚构训练文件正文”的优先解包，剥离 JSON 包装，纯正文质量评估；
     - 调优 Dify 阅读生成超时至 300s，加入短暂网络抖动单次重试。
  2. `vocab-server/tests/readMaterialCache.test.js`：
     - 补齐 35 项本地契约测试（涵盖 4×3 组合持久化、系统时间注入、正文解包边界、JSON 错误拒绝、长邮件 dialogue 取值、超时与重试逻辑等）。
- 测试结果：本地契约测试 35/35 全部通过，生产服务端单点热更新后服务 `active`，线上账号 `lzhumy` 的 12/12 阅读素材组合（4 场景类型 × 3 框架）全部就绪（Status: ready, 0 失败），字符数均在 2600~10400 字，质量评估判定全部为 `ok`。

## 二、测试用例与执行详情
| 用例编号 | 菜单路径 / 接口 | 测试输入数据 | 预期结果 | 实际结果 | 状态 |
|---|---|---|---|---|---|
| TC-READ-01 | 本地契约测试 | `node --test vocab-server/tests/readMaterialCache.test.js` | 35 个用例全部 PASS，涵盖解包、长邮件、超时与重试 | `pass 35, fail 0, duration_ms 593ms` | PASS |
| TC-READ-02 | 生产服务健康检查 | `GET https://app.liujingzhuwo.site/api/vocab/health` | HTTP 200，`success: true, ok: true` | HTTP 200，服务正常响应 | PASS |
| TC-READ-03 | 生产服务端文件校验 | SHA256 校验 `readMaterialCacheService.js` | 本地与远程服务端哈希完全一致 | 本地与远端哈希均为 `2c413214d72...` | PASS |
| TC-READ-04 | 生产环境 12/12 组合全量生成与校验 | `user_id='lzhumy', pack_date='2026-10-05'`（4 类型 × 3 框架） | 12 个组合全部为 `status: ready`，质量为 `ok`，正文长度 ≥ 1500 字 | 12/12 组合均为 `ready`，长度 2607~10465 字，质量全部为 `ok` | PASS |
| TC-READ-05 | 邮件场景长正文展示校验 | `scene_type='email', scene_framework='corp/gov/social'` | 提取真实邮件长正文与备忘录，不夹杂意图摘要 | `corp`: 10465字, `gov`: 3127字, `social`: 5975字，均为纯正文 | PASS |

## 三、对抗式审查与后续规划
1. **异构字段兼容**：上游 Dify 对 `policy/report/book` 返回 `hidden_intent` 长文，对 `email` 返回 `dialogue` 长文。当前已通过条件长度门禁与标记识别实现零副作用解包，不破坏既有数据与历史缓存。
2. **待测下一模块**：
   - 阅读素材模块已完全闭环；
   - 下一模块：口语场景模块（`speaking_scene`，涵盖 `multi_role` 与 `impromptu` 场景生成及交互）。

---

# 生产环境端到端功能测试与口语场景模块验证报告

## 一、测试概述
- 测试时间：2026-10-06 11:00:00 CST
- 测试站点：https://app.liujingzhuwo.site/
- 本次改动范围（最小必要）：
  1. 生产环境 .env 补齐 DIFY_SPEAKING_SCENES_API_KEY 配置；
  2. 重启 super-agent-vocab 服务并验证 ctive 状态；
  3. 执行全量真实口语场景生成：成功落库 10/10 个场景（5 个 multi_role 多角色场景 + 5 个 impromptu 即兴表达场景），0 失败。
- 测试结果：全部口语场景用例通过，API 鉴权查询返回完整 10 个场景，内容结构（角色、冲突、任务、开场白、要点与核心词）均符合契约。

## 二、测试用例与执行详情
| 用例编号 | 菜单路径 / 接口 | 测试输入数据 | 预期结果 | 实际结果 | 状态 |
|---|---|---|---|---|---|
| TC-SPEAK-01 | 服务环境变量注入 | DIFY_SPEAKING_SCENES_API_KEY | 生产 .env 成功配置密钥，服务重启 ctive | 环境变量注入完毕，super-agent-vocab 服务正常运行 | PASS |
| TC-SPEAK-02 | 口语场景全量生成 | user_id='lzhumy', scene_date='2026-10-05' | 生成 10 个场景（5 个多角色 multi_role + 5 个即兴 impromptu），0 失败 | generated: 10, failedTypes: [], allocation: 5+5，数据落库完整 | PASS |
| TC-SPEAK-03 | 多角色场景结构校验 | SELECT content_json FROM personalized_speaking_scenes WHERE scene_type='multi_role' | 包含 roles、conflict、objective、tasks、opening | 结构符合契约，角色立场与开场白完整可用 | PASS |
| TC-SPEAK-04 | 即兴表达场景结构校验 | SELECT content_json FROM personalized_speaking_scenes WHERE scene_type='impromptu' | 包含 structure、points、keywords、opening | 框架结构、要点与核心词汇完整可用 | PASS |
| TC-SPEAK-05 | 口语场景 API 端到端查询 | GET /api/english/speaking-scenes?userId=lzhumy | 返回 HTTP 200，装载全部 10 个口语场景 | 鉴权下正常装载 10 个口语场景列表 | PASS |

## 三、对抗式审查与后续规划
1. **环境变量热生效机制**：密钥直接注入服务端独立运行时，不污染客户端前端包与仓库代码。
2. **待测下一模块**：
   - 口语场景模块已完全闭环；
   - 下一模块：听力聚合与音频播放 / 日常复盘模块。
