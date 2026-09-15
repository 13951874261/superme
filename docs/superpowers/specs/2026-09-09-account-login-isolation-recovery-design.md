# 账号登录、隔离与生成恢复设计

## 状态

- 日期：2026-09-09
- 状态：已确认
- 正式账号：`lzhumy`
- 历史误拼账号：`lzhmy`

## 目标

1. 将邀请令牌改为可重复使用的登录令牌；Cookie 失效后用户可自行再次登录。
2. Cookie session 成为唯一权威账号；切换账号必须先退出，再使用另一账号和令牌登录。
3. 画像、学习数据、唤醒、破绽、长文、音频严格按账号隔离。
4. 登录后只读当日缓存；缺失项由用户决定是否手动生成。
5. 统一服务、邀请脚本、诊断脚本的数据库路径解析。

## 非目标

- 不合并、复制、迁移或回退读取 `lzhmy` 数据。
- 不新增密码、密码重置、角色或订阅权限体系。
- 不在登录或 login-ping 后自动补生成。
- 不改变 Cron 的预生成职责与时间窗口。
- 不新增 `lzhumy` 特例。

## 认证设计

### 登录令牌

管理员通过 `add` 或 `reissue` 生成随机令牌。数据库仅保存 SHA-256；明文只在签发时显示。

登录流程：

```text
账号 + 登录令牌
→ POST /api/auth/login
→ 精确匹配 invited_accounts.user_id
→ 比较令牌哈希
→ 签发 30 天 HttpOnly、SameSite=Lax Cookie
→ Cookie session 作为后续 API 的唯一身份
```

`redeemed_at` 保留首次成功使用时间，不能参与拒绝后续登录。相同有效令牌可重复签发新 session。

`reissue` 替换令牌并撤销该账号全部旧 session。`remove` 删除账号并撤销全部 session。未知账号、错误令牌、旧无令牌账号统一返回“登录凭据无效”，防止账号枚举。

### 后续登录指导

- Cookie 有效：自动登录。
- Cookie 失效：登录页从 `localStorage.super_agent_user_id` 预填并明确显示“上次登录账号”。
- 登录页说明“登录令牌可重复使用，请妥善保管；忘记或失效请联系管理员重新签发”。
- 浏览器不持久化登录令牌。

## 账号切换设计

删除设置中的直接修改 User ID 能力。设置页只显示当前账号和“退出登录”。

```text
当前账号
→ POST /api/auth/logout
→ 服务端撤销当前 session 并清 Cookie
→ 前端回到登录页
→ 输入另一账号和对应令牌
```

退出失败时保留当前登录态并提示重试，不伪装成功。

首次认证和换号时不得把旧本地账号的 learning UI flush 到新 Cookie 账号。认证后的服务端 session 用户直接成为本地当前账号；只加载该账号的画像和 learning UI。所有受保护 API 继续用 `bindAuthenticatedUser` 覆盖客户端账号字段。

## 数据隔离

`lzhumy` 与 `lzhmy` 永久视为两个独立账号。以下数据全部按认证 Cookie 中的精确 `userId` 读写：

- `user_memories` 画像与 learning UI；
- 本地 `sa_learn:<userId>:*` 学习桶；
- `daily_packs` 唤醒与破绽；
- `daily_extracted_articles` 长文；
- `daily_listen_articles`、`daily_listen_audios` 精听资产；
- `daily_cron_runs`、`daily_cron_steps` 任务记录。

生产业务路由不得做 `lzhumy`/`lzhmy` 别名回退。诊断脚本也应默认精确查询；需要比较两个账号时必须显式传入或分别执行。

## 四项缓存与手动生成

登录后仅查询 `lzhumy` 自己的当日缓存：

```text
有缓存 → 展示
无缓存 → 显示当前账号与缺失状态 → 用户选择手动生成
```

- 唤醒：保留“刷新今日包”手动生成。
- 破绽：保留“刷新词汇”手动生成。
- 长文：用户选择主题、题材、CEFR、时长后手动生成。
- 音频：已有长文时允许手动生成；无长文时明确提示先生成长文。
- 登录和 login-ping 不触发上述生成。
- Cron 可继续预生成，但不承担登录后的即时补齐。

## 数据库路径

服务、邀请脚本、诊断脚本统一使用：

```text
SUPER_AGENT_DB_PATH
→ VOCAB_DB_PATH（兼容旧部署）
→ /var/lib/super-agent/vocab.db（生产默认）
→ vocab-server/vocab.db（本地默认）
```

生产判定沿用各入口现有运行环境，但最终默认文件必须一致。日志可输出数据库路径，不得输出令牌、哈希或 API Key。

## 错误处理

- 认证失败：统一“登录凭据无效”。
- 认证限速：保留稳定 429 响应。
- 登录页辅助文案解释令牌复用和重新签发流程。
- 退出失败：保留当前页面并提供重试。
- 缓存缺失：明确“当前账号 `<userId>` 暂无缓存”，不自动生成。
- 音频缺失：区分“尚无长文”和“长文已有、音频未生成”。

## 最小修改范围

主要修改：

- `vocab-server/services/authService.js`
- `vocab-server/tests/inviteTokenAuth.test.js`
- `vocab-server/scripts/invite-account.js`
- `vocab-server/tests/inviteAccount.test.js`
- `src/components/LoginPage.tsx`
- `src/components/GlobalSettingsPanel.tsx`
- `src/App.tsx`
- 对应前端契约测试

仅在路径统一确有需要时修改诊断脚本。四项业务生成算法不改；只验证现有手动入口与账号隔离行为。

## 验收标准

1. 同一有效令牌连续登录两次均成功。
2. `reissue` 后旧令牌与旧 session 失效，新令牌可重复登录。
3. `remove` 后令牌与 session 均失效。
4. 登录页显示上次账号及令牌指导，不保存令牌。
5. 设置页不能直接修改账号；退出后才能换号。
6. 从账号 A 退出并登录账号 B，不把 A 的本地学习态写入 B。
7. `lzhumy`、`lzhmy` 的画像、学习数据和四项缓存严格隔离。
8. `lzhumy` 缓存缺失时不自动生成；手动按钮仍可触发对应生成。
9. 服务、邀请脚本、诊断脚本在相同环境下解析到同一数据库路径。
10. 定向测试、TypeScript 检查、生产构建通过；对抗式审查无高置信阻断问题。

## 测试用例

### 用例 1：重复登录

- 路径：登录页
- 数据：账号 `lzhumy`；同一有效令牌连续登录、退出、再登录
- 预期：两次登录成功；令牌不写入 localStorage
- 对应需求：可重复登录令牌

### 用例 2：重新签发

- 路径：管理员脚本 → 登录页
- 数据：对 `lzhumy` 执行 `reissue`
- 预期：旧令牌 401；旧 session 401；新令牌可重复登录
- 对应需求：凭据轮换

### 用例 3：安全换号

- 路径：全局设置 → 退出登录 → 登录页
- 数据：从账号 A 切换至账号 B
- 预期：设置无直接改号输入；B 不读取或接收 A 的画像与 learning UI
- 对应需求：账号隔离

### 用例 4：无缓存

- 路径：英语学习 → 唤醒 / 破绽 / 进度总控 / 精听
- 数据：`lzhumy` 当日四类缓存为空
- 预期：显示缺失状态；不自动调用生成 API；用户点击后才生成
- 对应需求：手动生成

### 用例 5：数据库路径

- 路径：服务路径解析、邀请脚本路径解析、诊断脚本路径解析
- 数据：分别设置 `SUPER_AGENT_DB_PATH`、仅设置 `VOCAB_DB_PATH`、生产无变量、本地无变量
- 预期：优先级和默认值完全一致
- 对应需求：部署一致性
