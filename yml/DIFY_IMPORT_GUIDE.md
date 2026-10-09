# Dify 口语沙盘工作流导入与配置指南

本项目已对口语沙盘 Dify 工作流进行了二次开发，升级为 **`English_Oral_Sandbox (7)`**。
新版本通过引入 `Variable Assigner`（变量赋值器）和 `Conversation Variables`（会话变量），实现了跨对话轮次的用户弱点与画像自动累积与持久化。

本指南指导您将 YAML 文件导入 Dify 平台并完成最终配置。

---

## 一、文件目录说明

| 版本 | 文件路径 | 说明 |
|------|----------|------|
| **v7（推荐/最新）** | `yml/English_Oral_Sandbox (7).yml` | 手动从 Dify UI 导出的最终确认版本，含正确的变量赋值配置 |
| v6（参考） | `yml/English_Oral_Sandbox (6).yml` | 手动配置第一版，含 `operation: over-write`（已废弃） |
| v3（参考） | `yml/English_Oral_Sandbox_v3.yml` | DSL 导入修复尝试版，部分语法有误 |
| 原版 | `yml/English_Oral_Sandbox (4).yml` | 未修改的原始版本，无会话持久化 |

---

## 二、Dify 导入步骤

### 方式一：导入 YAML DSL 文件（推荐）

1. 登录 Dify 控制台。
2. 进入 **"工作室" (Studio)** 页面，点击 **"创建空白应用"** 或 **"导入 DSL 文件"**。
3. 选择 **"导入 DSL 文件" (Import DSL file)**。
4. 上传本地文件 **`d:\cursor\work\super-agent\yml\English_Oral_Sandbox (7).yml`**。
5. 应用类型：`Chatflow (高级助手)`，命名为 **`English_Oral_Sandbox`**。
6. 点击 **"创建" (Create)**。

> ⚠️ **注意**：Dify DSL 导入对版本敏感，若遇到 400 导入错误，请改用方式二（手动配置）。

### 方式二：手动在 Dify 画布中配置（备选/推荐用于 v7）

由于 Dify DSL 导入存在版本兼容性问题，建议直接在 Dify 画布编辑器中按以下步骤手动配置节点：

#### 节点拓扑结构（4 个节点）

```
开始 (start)
    │
    ▼
角色扮演引擎 (llm)
    │
    ▼
变量赋值 (variable_assigner)   ← 追加弱点画像
    │
    ▼
直接回复 (answer)
```

#### 步骤 1：配置会话变量（Conversation Variables）

- 点击左下角 **"会话变量" (Conversation Variables)** → **"添加变量"**
  - **名称**：`User_Current_Profile`
  - **类型**：`Array[String]`（数组字符串，支持追加操作）
  - **最大长度**：`5000`
  - **初始值**：`[]`（空数组）
  - **描述**：`用户弱点画像累积记录`

#### 步骤 2：开始节点

- 确认存在输入变量 `user_current_profile`（paragraph 类型）

#### 步骤 3：LLM 节点

**System Prompt 关键变量引用：**
```
必须参考【当前用户画像与弱点累积】: {{#conversation.User_Current_Profile#}}
在对话中，请实时根据当前学习者的国家/地区画像设定 {{user_current_profile}}...
```

**User Prompt：**
```
user_current_profile: {{user_current_profile}}

user_query: {{#sys.query#}}
```

#### 步骤 4：变量赋值器节点（关键！）

- **标题**：`追加弱点画像`
- **节点类型**：`variable-assigner`
- **变量赋值规则**：

| 属性 | 正确值 |
|------|--------|
| **变量（Var）** | `User_Current_Profile`（从会话变量列表选择） |
| **操作（Operation）** | `append`（追加） |
| **值（Value）** | `{{#llm.text#}}`（LLM 节点完整文本输出） |

> ⚠️ **关键**：必须选择 **`追加（append）`**，而非覆盖（overwrite）。覆盖模式会清空历史弱点，每轮只剩最新一条。

#### 步骤 5：直接回复节点

- 内容：`{{#llm.text#}}`

#### 步骤 6：确认节点连线

```
start → llm → variable_assigner → answer
```

---

## 三、导入后画布校验

### 节点拓扑

确认画布上应有 4 个节点，连线顺序为：
```
start → llm → 追加弱点画像 → 直接回复
```

### 校验 Variable Assigner 节点

| 属性 | 正确值 |
|------|--------|
| **操作** | `追加 (append)` ❌ 不是 `覆盖 (overwrite)` |
| **变量** | `User_Current_Profile` |
| **值** | `{{#llm.text#}}` |

### 校验 LLM 节点 System Prompt

确认以下两处变量引用都存在：
- `{{#conversation.User_Current_Profile#}}`（会话历史弱点）
- `{{user_current_profile}}`（当前轮次注入的画像）

---

## 四、前端 API Key 配置

1. 在 Dify 编辑器左侧导航栏，进入 **"API 访问" (API Access)** 页面。
2. 点击 **"API 密钥" (API Key)** → **"创建密钥" (Create Key)**。
3. 复制生成的密钥。
4. 打开 **`d:\cursor\work\super-agent\.env.local`**，添加/更新：
   ```env
   VITE_DIFY_ORAL_API_KEY="您的新 Dify API Key"
   ```
5. 重启前端：
   ```bash
   pnpm dev
   ```

---

## 五、数据流说明（弱点闭环）

```
┌─────────────────────────────────────────────────────────────┐
│  用户输入                                                    │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼ 前端 difyAPI.ts
┌──────────────────────────────────────────────────────────────┐
│  injectUserProfile() ──→ user_current_profile (含弱点标签)   │
│  fetch(/chat-messages, inputs:{user_current_profile,...})   │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼ Dify Chatflow
┌──────────────────────────────────────────────────────────────┐
│  start 节点读取 user_current_profile                         │
│  llm 节点：参考弱点 → 在 dialogue 中植入更精准的破绽        │
│  variable_assigner：{{#llm.text#}} → 追加到 User_Current_   │
│    Profile（Dify 自动跨轮次持久化）                         │
│  answer 节点：返回完整 LLM JSON                              │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼ 前端 difyAPI.ts
┌──────────────────────────────────────────────────────────────┐
│  interceptOutputText(response) ──→ 解析 flaw_point 字段       │
│  appendUserProfileFactor(flaw_point) ──→ 更新 localStorage │
│  返回给 OralWarRoom 组件渲染                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 六、联调测试验证路径

### 测试 1：弱点追加闭环

1. 打开口语沙盘（OralWarRoom），发送任意开场白。
2. 观察 AI 回复中是否包含 JSON（含 `flaw_point` 字段）。
3. 检查浏览器 `localStorage` 中的 `user_current_profile` 键，是否追加了新内容。
4. 继续对话，观察后续轮次中 AI 是否参考了历史弱点标签。

### 测试 2：UI 渲染验证

1. 检查 `OralWarRoom.tsx` 是否正确渲染了弱点扫描区和 XP 积分。
2. 检查 `difyAPI.ts` 中的 `interceptOutputText()` 是否被调用。

### 测试 3：会话持久化验证

1. 刷新页面后，`User_Current_Profile` 是否仍然存在。
2. 新建一轮对话，AI 是否识别了历史弱点标签。

### 测试 4：v7 配置验证清单

- [ ] 会话变量 `User_Current_Profile` 类型为 `Array[String]`
- [ ] 初始值为 `[]`
- [ ] Variable Assigner 操作类型为 `append`（非 `overwrite`）
- [ ] LLM System Prompt 包含 `{{#conversation.User_Current_Profile#}}`
- [ ] LLM User Prompt 包含 `{{user_current_profile}}`
- [ ] 节点拓扑为 `start → llm → variable_assigner → answer`

---

## 七、已知限制与解决方案

| 限制 | 说明 | 解决方案 |
|------|------|---------|
| `variable-assigner` 无法解析 JSON 内部字段 | 只能追加完整 LLM 文本，无法直接提取 `flaw_point` | 前端 `interceptOutputText()` 在收到响应后自动解析并追加到 `localStorage` |
| `User_Current_Profile` 最大长度 5000 | 超出后旧数据被截断 | 前端 `appendUserProfileFactor()` 自动限制为最近 5 条弱点标签 |
| 画像数据仅存在 localStorage | 换浏览器/设备丢失 | Dify `User_Current_Profile` 会话变量提供 Dify 侧持久化兜底 |
| DSL 导入 400 错误 | Dify 版本兼容性导致 YAML 解析失败 | 使用方式二手动在 Dify UI 中配置节点 |
