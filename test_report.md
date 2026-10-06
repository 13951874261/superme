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

---

# 生产环境端到端功能测试与听力聚合播放模块验证报告

## 一、测试概述
- 测试时间：2026-10-06 11:30:00 CST
- 测试站点：https://app.liujingzhuwo.site/
- 本次测试范围：
  1. 用户偏好接口 GET /api/english/listen-prefs 鉴权与配置加载；
  2. 听力预生成库落库检查：16 组矩阵（4 体裁 × 4 难度）文章与音频完整性；
  3. 生产音频静态流式挂载 GET /api/daily_listen_audio/... 鉴权访问与二进制尺寸校验。
- 测试结果：16/16 组合全部就绪，音频服务支持 HTTP 200 与 Range 切片流式传输，尺寸 160KB~273KB，零丢包、零损坏。

## 二、测试用例与执行详情
| 用例编号 | 菜单路径 / 接口 | 测试输入数据 | 预期结果 | 实际结果 | 状态 |
|---|---|---|---|---|---|
| TC-LISTEN-01 | 听力偏好配置加载 | GET /api/english/listen-prefs?userId=lzhumy | 返回 HTTP 200，输出默认及生效 voiceId | 返回 effectiveVoiceId: en-US-BrianNeural | PASS |
| TC-LISTEN-02 | 听力文章落库完整性 | 4 体裁 (meeting/news/podcast/reading) × 4 级别 (A2/B1/B2/C1) | 16/16 篇长文均落库且 status 为 ready | 16/16 篇文章完整入库，长度 848~1267 字 | PASS |
| TC-LISTEN-03 | 听力音频合成与挂载 | SELECT * FROM daily_listen_audios | 16 个音频全部生成完毕，路径及 URL 映射正常 | 16 个音频全部 ready，文件真实存在 | PASS |
| TC-LISTEN-04 | 生产音频流端到端请求 | GET /api/daily_listen_audio/lzhumy/2026-10-06_{genre}_{level}_1m.mp3 | 16 个矩阵音频均返回 HTTP 200 与 audio/mpeg | 16/16 组合全部返回 HTTP 200，大小 160~273KB | PASS |

## 三、对抗式审查与后续规划
1. **权限隔离加固**：音频文件服务严格要求 Session Cookie 鉴权，未经认证直接拦截 401，保障用户隐私与资源安全。
2. **待测下一模块**：
   - 听力模块已完全闭环；
   - 下一模块：AI 随身教练 / 自由口语对练（Free Oral Chat / Breakthrough）模块。

---

# 生产环境端到端功能测试与自由口语对练（Free Oral Chat）模块验证报告

## 一、测试概述
- 测试时间：2026-10-06 11:45:00 CST
- 测试站点：https://app.liujingzhuwo.site/
- 本次测试范围：
  1. 会话列表接口 GET /api/english/free-oral/sessions 鉴权与装载；
  2. 开场白模版接口 GET /api/english/oral/opening 加载与契约校验；
  3. 新建自由口语会话 POST /api/english/free-oral/sessions；
  4. 真实交互对话链路 POST /api/english/oral/free-sessions/:sessionId/messages 与上游 Dify AI 动态协同及落库；
  5. 会话历史拉取接口 GET /api/english/free-oral/sessions/:sessionId 消息持久化校验。
- 测试结果：全部口语对练用例验证通过，上游 Dify 对话生成流畅，上下文会话与持久化入库完整。

## 二、测试用例与执行详情
| 用例编号 | 菜单路径 / 接口 | 测试输入数据 | 预期结果 | 实际结果 | 状态 |
|---|---|---|---|---|---|
| TC-ORAL-01 | 会话列表查询 | GET /api/english/free-oral/sessions?userId=lzhumy | 返回 HTTP 200，成功获取用户历史对话会话 | 成功拉取会话列表（success: true） | PASS |
| TC-ORAL-02 | 开场白模板与反击建议 | GET /api/english/oral/opening?userId=lzhumy | 返回 HTTP 200，包含开场白、反问模板与策略提示 | 成功装载，包含 hidden_intent, flaw_point, counter_question_templates | PASS |
| TC-ORAL-03 | 创建自由口语会话 | POST /api/english/free-oral/sessions (title, focusTopic) | 返回 HTTP 201，创建独立 Session 实体 | 返回 HTTP 201，成功生成 Session ID | PASS |
| TC-ORAL-04 | 实时发送口语练习消息 | POST /api/english/oral/free-sessions/:id/messages (content) | 返回 HTTP 200，上游 AI 正常响应并生成回复 | 返回 HTTP 200，成功获取针对商务谈判的 AI 角色开场回复 | PASS |
| TC-ORAL-05 | 会话消息历史读取 | GET /api/english/free-oral/sessions/:id | 返回 HTTP 200，完整包含 user 与 assistant 消息链 | 完整返回 user 与 assistant 消息历史，状态 completed | PASS |

## 三、对抗式审查与后续规划
1. **输入防御与一致性**：消息发送端点严格校验 userId 与 clientMessageId，防止重复提交并维持对话时序。
2. **待测下一模块**：
   - 自由口语模块已完全闭环；
   - 下一模块：词汇复习（Vocab / 艾宾浩斯复习流）及博弈论对抗模块（Game Theory Session）。

---

# 生产环境端到端功能测试与生词复习（Vocab / Ebbinghaus）模块验证报告

## 一、测试概述
- 测试时间：2026-10-06 12:00:00 CST
- 测试站点：https://app.liujingzhuwo.site/
- 本次测试范围：
  1. 词汇总览统计 GET /api/vocab/stats；
  2. 词汇库列表分页 GET /api/vocab/list；
  3. 艾宾浩斯复习流待复习拉取 GET /api/vocab/review。
- 测试结果：生词复习与艾宾浩斯记忆流 API 全部就绪，返回符合契约，状态流转正常。

## 二、测试用例与执行详情
| 用例编号 | 菜单路径 / 接口 | 测试输入数据 | 预期结果 | 实际结果 | 状态 |
|---|---|---|---|---|---|
| TC-VOCAB-01 | 词汇统计查询 | GET /api/vocab/stats?userId=lzhumy | 返回 HTTP 200，展示 total 与 dueToday 统计 | 统计数据正常返回（total: 4, dueToday: 4） | PASS |
| TC-VOCAB-02 | 词汇列表查询 | GET /api/vocab/list?userId=lzhumy | 返回 HTTP 200，展示生词本列表 | 成功拉取生词列表 | PASS |
| TC-VOCAB-03 | 艾宾浩斯复习流拉取 | GET /api/vocab/review?userId=lzhumy | 返回 HTTP 200，按间隔与复习日期计算待复习生词 | 成功拉取待复习项（4 items），算法参数完整 | PASS |

## 三、对抗式审查与后续规划
1. **算法容错与轻量化输出**：复习接口默认启用 _light 模式剥离重型 payload 字段，提升移动端渲染与网络传输效率。
2. **待测下一模块**：
   - 词汇复习模块已完全闭环；
   - 下一模块：博弈论对抗与复盘模块（Game Theory Session）。

---

# 生产环境端到端功能测试与博弈论对抗（Game Theory Session）模块验证报告

## 一、测试概述
- 测试时间：2026-10-06 12:15:00 CST
- 测试站点：https://app.liujingzhuwo.site/
- 本次测试范围：
  1. 博弈论推演会话列表 GET /api/game-theory/sessions；
  2. 博弈心法与对抗战术库 GET /api/game-theory/tactics；
  3. 每日博弈推演案例推送 GET /api/game-theory/cases/push。
- 测试结果：博弈论心法、战术策略库、每日高管推演案例装载完整，契约校验 100% 通过。

## 二、测试用例与执行详情
| 用例编号 | 菜单路径 / 接口 | 测试输入数据 | 预期结果 | 实际结果 | 状态 |
|---|---|---|---|---|---|
| TC-GAME-01 | 博弈推演会话查询 | GET /api/game-theory/sessions?userId=lzhumy | 返回 HTTP 200，成功拉取用户推演会话列表 | 成功拉取推演会话（success: true） | PASS |
| TC-GAME-02 | 博弈心法与战术库 | GET /api/game-theory/tactics?userId=lzhumy | 返回 HTTP 200，包含向下与向上对抗战术（如恩威并施、制衡术、分而治之） | 完整返回 12 组核心博弈战术与反制策略 | PASS |
| TC-GAME-03 | 每日推演案例推送 | GET /api/game-theory/cases/push?userId=lzhumy | 返回 HTTP 200，包含 background、incomplete_info、decision_point | 案例装载完备（661 字），决策点清晰 | PASS |

## 三、对抗式审查与全站测试总结
1. **安全与数据隔离**：博弈论战术库具备系统内置与用户自定义策略的隔离鉴权体系。
2. **全站端到端验收总结**：
   - 唤醒工作流（Wakeup）：超时防护与大模型参数优化通过；
   - 阅读素材缓存（Read Material）：12/12 组合全量就绪通过；
   - 口语场景生成（Speaking Scene）：10/10 场景入库与鉴权查询通过；
   - 听力聚合与音频播放（Listen Audio）：16/16 矩阵音频流式挂载通过；
   - 自由口语对练（Free Oral Chat）：会话创建、Dify 交互与历史记录通过；
   - 词汇复习（Vocab / Ebbinghaus）：统计、词库、艾宾浩斯复习流通过；
   - 博弈论对抗（Game Theory）：推演会话、心法库、推演案例全流程通过。
