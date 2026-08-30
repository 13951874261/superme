# 邀请制登录首页设计

## 状态

- 日期：2026-08-30
- 状态：已确认（用户四段设计均回复「符合」）
- 范围：登录首屏 + 后台受邀名单 + 初始化脚本；不改动进入系统后的工作台、模块、设置内旧「系统密钥」逻辑

## 目标

将当前简陋的本地密钥登录页，升级为**仅限受邀账户访问**的 AI 原生产品大门，突出 **AI 原生 · Agent · 自主学习 · 不断迭代 · 因您而变** 的理念。

## 非目标

- 密码、邀请码、一次性展示密码、忘记密码 / 重置密码
- 应用内邀请管理页
- 为全部 `/api/*` 增加登录中间件（本轮只挡登录门）
- 进入系统后的 UI 一致性大改

## 已确认决策

| 项 | 决策 |
|---|---|
| 准入方式 | 仅受邀账号，无密码 |
| 名单来源 | 管理员手动执行脚本写入 SQLite |
| 页面布局 | 方案 1：左右分栏（左侧理念场，右侧邀请门） |
| 刷新后 | 需重新填账号登录（与现有一致） |
| 本地默认密钥 `1` | 不再可用 |

## 用户流程

```
打开站点
  → 填写受邀账号
  → POST /api/auth/verify-invite
  → 在名单内：initializeUserSession + login-ping → 进入应用
  → 不在名单：显示「该账号未被邀请」，不进入应用
```

**示例**

1. 管理员执行 `node scripts/invite-account.js add lzhmy`
2. 用户打开站点，输入 `lzhmy` → 进入系统
3. 输入 `guest`（不在名单）→ 拒绝
4. 管理员执行 `node scripts/invite-account.js remove lzhmy` → 该账号无法再进

## 数据模型

沿用现有 SQLite（本机 `vocab-server/vocab.db`，生产 `/var/www/super-agent/vocab.db`）。

```sql
CREATE TABLE IF NOT EXISTS invited_accounts (
  user_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
```

- 空表 = 无人可进
- 服务启动时**不**自动灌入任何账号
- 账号匹配为**精确相等**；`lzhmy` 与 `lzhumy` 为两个独立名额

## 初始化脚本

路径：`vocab-server/scripts/invite-account.js`

```bash
# 加入（已存在则提示，不报错）
node scripts/invite-account.js add lzhmy

# 查看名单
node scripts/invite-account.js list

# 撤权
node scripts/invite-account.js remove lzhmy
```

脚本应复用现有 `resolveDatabasePath` 模式（`VOCAB_DB_PATH` / 生产路径 / 本地 `vocab.db`）。

## API

### `POST /api/auth/verify-invite`

请求：

```json
{ "userId": "lzhmy" }
```

响应：

| 情况 | 返回 |
|---|---|
| 在名单内 | `{ "success": true }` |
| 不在名单 / 空账号 | `{ "success": false, "error": "该账号未被邀请" }` |
| 服务端错误 | `{ "success": false, "error": "..." }` + 500 |

约束：

- 不返回完整名单，防止枚举
- 不区分「从未邀请」与「已 remove」，统一文案

验证通过后，前端继续现有 `initializeUserSession` + `recordUserLoginPing` 流程。

## 前端：`LoginPage.tsx`

### 布局（桌面）

```
+--------------------------------------+------------------------+
|  SUPER AGENT                         |  仅限受邀访问            |
|  因您而变                             |  进入系统               |
|  这是一套会学、会改、会贴着你迭代的     |  受邀账号 [        ]   |
|  AI 原生 Agent。                      |  [ 验证并进入 ]         |
|  [GSAP 节点动画]                       |  未在名单内无法访问      |
|  AI 原生 · Agent · 自主学习 · 不断迭代 |                        |
+--------------------------------------+------------------------+
```

窄屏：上理念、下表单。

### 文案

| 位置 | 文案 |
|---|---|
| 眉题 | SUPER AGENT |
| 主句 | 因您而变 |
| 副句 | 这是一套会学、会改、会贴着你迭代的 AI 原生 Agent。 |
| 四词 | AI 原生 · Agent · 自主学习 · 不断迭代 |
| 表单标题 | 进入系统 |
| 账号标签 | 受邀账号 |
| 占位 | 请输入受邀账号… |
| 按钮 | 验证并进入 / 验证中… |
| 拒绝 | 该账号未被邀请 |
| 页脚 | 仅限受邀账户 |

移除：「默认密钥」「解锁登录」「高层管理者锻造系统」「系统密码已硬编码保护」等旧文案。

### 动效（GSAP）

- 使用 `@gsap/react` 的 `useGSAP`，`scope` 绑定页面根节点
- 入场：左侧标题与四词 stagger 淡入上移；右侧表单稍后出现
- 循环：左侧节点簇缓慢生长/重组（表达迭代与因您而变）
- 仅动画 `opacity` / `transform`
- `prefers-reduced-motion: reduce`：取消循环与位移，内容默认可见
- 现有 `motion/react` 页面退出可保留极短淡出；新动画以 GSAP 为主

### 可访问性（Web Interface Guidelines）

- 账号有可见 `<label>`，`name` + `autocomplete="username"`，`spellCheck={false}`
- `focus-visible` 焦点环
- 错误用 `aria-live="polite"`
- 图标按钮有 `aria-label`；装饰节点 `aria-hidden`
- 提交中按钮禁用并显示「验证中…」

### 移除的逻辑

- `localStorage.getItem('super_agent_lock_password')` 校验
- 密码输入框、显示/隐藏密码
- 旧「系统解锁秘钥」表单字段

## 错误处理

| 情况 | 界面 | 焦点 |
|---|---|---|
| 账号空 | 「请输入受邀账号」，不发请求 | 输入框 |
| 不在名单 | 「该账号未被邀请」 | 输入框（不清空） |
| 网络 / 500 | 「暂时无法验证，请稍后重试」 | 输入框 |
| 验证中 | 按钮「验证中…」禁用 | 不抢焦点 |
| 通过 | 短促成功反馈后进入应用 | — |

不弹 `alert`。

## 涉及文件（实现时）

| 文件 | 变更 |
|---|---|
| `vocab-server/server.js` | 建表 + `POST /api/auth/verify-invite` |
| `vocab-server/scripts/invite-account.js` | 新建：add / list / remove |
| `vocab-server/tests/inviteAccount.test.js` | 新建：接口与脚本契约测试 |
| `src/components/LoginPage.tsx` | 重写 UI + GSAP + 调用新 API |
| `src/services/authAPI.ts`（或同类） | 新建：`verifyInvite(userId)` |
| `DESIGN.md` | 补充登录页 open question 结论 |

本轮**不修改**：`GlobalSettingsPanel` 旧密钥设置、`App.tsx` 鉴权壳以外的逻辑。

## 验收 / 测试用例

按顺序执行，前一个通过再做下一个。

### 用例 1：未邀请账号被拒

- 路径：打开站点登录页
- 数据：名单仅有 `lzhmy`；输入 `guest`
- 预期：不进入系统；「该账号未被邀请」；焦点在输入框

### 用例 2：受邀账号进入

- 路径：登录页 → 验证并进入
- 数据：已 `add lzhmy`；输入 `lzhmy`
- 预期：进入工作台；模块与登录前行为一致

### 用例 3：空提交

- 路径：账号留空点按钮
- 预期：不发请求；「请输入受邀账号」

### 用例 4：撤权后不能再进

- 路径：用例 2 成功后 → `remove lzhmy` → 刷新再填 `lzhmy`
- 预期：再次「该账号未被邀请」

### 用例 5：减少动效

- 路径：系统开启「减少动态效果」后打开登录页
- 预期：无循环位移；文案与表单立即可见；仍可登录

## 安全说明

无密码模式下，知道受邀账号 ID 即可登录。名单应仅包含可信任用户；账号 ID 不宜公开传播。本轮接受此 trade-off。

## 开放问题

- [ ] 是否在本轮部署时默认 `add lzhmy`（建议：生产首次部署文档中写明需手动执行，不自动灌入）
- [ ] 后续是否给 API 加 session token（超出本轮）
