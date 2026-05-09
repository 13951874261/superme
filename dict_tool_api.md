# 智能词典工作流（dict_tool_workflow）HTTP API 调用规范

对应编排与 DSL：`dict_tool_workflow.yml`。以下与当前部署实例对齐。

## 1. 环境与控制台

| 项 | 值 |
|----|-----|
| **API Base（OpenAPI v1）** | `https://dify.234124123.xyz/v1` |
| **应用编排 / 调试** | `https://dify.234124123.xyz/app/988b1ce3-1845-40f1-9211-f7b6668ec7ca/develop` |
| **鉴权** | `Authorization: Bearer <Workflow App API Key>` |
| **Content-Type** | `application/json` |

**密钥**：在 Dify 该应用内打开 **「访问 API」/「API 访问」**，复制 **Workflow 应用 API Key**（通常以 `app-` 开头）。  
**安全**：不要将密钥写入 Git 或前端代码；本地/服务器用环境变量（如 `DIFY_DICT_TOOL_API_KEY`）注入。

---

## 2. 执行工作流

### 2.1 请求

- **方法 / 路径**：`POST /v1/workflows/run`
- **完整 URL**：`https://dify.234124123.xyz/v1/workflows/run`

### 2.2 Headers

```http
Authorization: Bearer <Workflow App API Key>
Content-Type: application/json
```

### 2.3 Body（JSON）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `inputs` | object | 是 | 与「开始」节点变量名一致，见下表 |
| `response_mode` | string | 建议填 | `blocking`：同步等待结果；`streaming`：SSE 流式 |
| `user` | string | 是 | 终端用户唯一标识，用于统计与限流（任意稳定字符串即可） |

### 2.4 `inputs` 与开始节点对应关系

| 键 | 类型 | 必填 | 说明 |
|----|------|------|------|
| `word` | string | 是 | 词条或短语（≤512 字符） |
| `dict_type` | string | 是 | `zh_modern` \| `en_en_business` \| `en_zh_bidirectional` |
| `direction` | string | 是 | `auto` \| `en_to_zh` \| `zh_to_en`；**仅** `en_zh_bidirectional` 时语义重要，其余类型可固定 `auto` |
| `user_context` | string | 否 | 用户场景/写作背景（例句贴脸），段落 |
| `locale` | string | 否 | 区域与语言标记（如 `en-US`、`zh-CN`） |

**注意**：键名必须为上述英文标识，与 YAML 中 `variable` 一致；**不要使用** `type` 作为词典类型字段名（已改为 `dict_type`）。

---

## 3. 响应（`response_mode: blocking`）

成功时 HTTP 200，Body 为 JSON，核心结构（字段名以你部署的 Dify 版本为准，常见如下）：

- `workflow_run_id`：本次运行 ID  
- `data.status`：如 `succeeded` / `failed`  
- **`data.outputs`**：结束节点输出对象  
- **`data.outputs.result`**：**字符串**，内容为「封装 API JSON」节点产出的 **JSON 文本**（需再 `JSON.parse`）

### 3.1 `result` 解析后的业务结构

解析 `JSON.parse(data.outputs.result)` 后常见形态：

**成功：**

```json
{
  "ok": true,
  "type": "zh_modern | en_en_business | en_zh_bidirectional",
  "payload": { }
}
```

`payload` 随 `type` 不同，字段分别为现代汉语 / 英英 / 英汉双向词典 JSON（与 DSL 中各分支 LLM 约定一致）。

**失败：**

```json
{
  "ok": false,
  "error_code": "INPUT | PARSE | ...",
  "message": "...",
  "word": "...",
  "type": "..."
}
```

---

## 4. 调用示例

### 4.1 cURL（密钥从环境变量读取）

```bash
export DIFY_DICT_TOOL_API_KEY='你的_Workflow_App_API_Key'

curl -sS -X POST 'https://dify.234124123.xyz/v1/workflows/run' \
  -H "Authorization: Bearer app-zGyrsyvvzHAIO5yx11OcYdpa" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "word": "leverage",
      "dict_type": "en_en_business",
      "direction": "auto",
      "user_context": "并购邮件",
      "locale": "en-US"
    },
    "response_mode": "blocking",
    "user": "api-client-001"
  }'
```

### 4.2 Python（简要）

```python
import json
import os
import urllib.request

BASE = "https://dify.234124123.xyz/v1"
KEY = os.environ["DIFY_DICT_TOOL_API_KEY"]

body = {
    "inputs": {
        "word": "未雨绸缪",
        "dict_type": "zh_modern",
        "direction": "auto",
        "user_context": "",
        "locale": "",
    },
    "response_mode": "blocking",
    "user": "python-client-001",
}

req = urllib.request.Request(
    f"{BASE}/workflows/run",
    data=json.dumps(body).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
    },
    method="POST",
)
with urllib.request.urlopen(req, timeout=120) as resp:
    outer = json.loads(resp.read().decode("utf-8"))

result_str = outer["data"]["outputs"]["result"]
payload = json.loads(result_str)
print(json.dumps(payload, ensure_ascii=False, indent=2))
```

---

## 5. 运维与排错

- **发布**：控制台中应用需 **已发布**，API Key 对应已发布版本；改 DSL 后需重新发布再测 API。  
- **超时**：`blocking` 受网关超时限制（常见约 100s）；长耗时请改用 `streaming` 或调大代理超时。  
- **DSL 版本**：导入的 `version: 0.6.0` 须 **不高于** 当前实例支持的 DSL 版本，否则导入或运行异常。  
- **追踪**：与面板「测试运行 → 追踪」对照，确认 `inputs` 已传入「开始」节点且 LLM/Context 正常。

---

## 6. 参考

- Dify 工作流执行 API：[Run Workflow](https://docs.dify.ai/api-reference/workflows/run-workflow)  
- 本仓库规则：`.cursor/rules/dify-knowledge-yml.mdc`（IF、`dict_type`、LLM Context 等）
