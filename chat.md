--

### **核心需求复述与对齐（启动确认）**
通过前端代码改造，在调用 Dify 工作流的请求入参 `inputs.theme` 中动态混入当前的日期与随机盐值（Salt），从而破坏请求的幂等性与缓存，使得每次刷新都可以呼叫大模型输出全新词汇，**且不需要修改 Dify 后台工作流本身**。

#### **具体修改效果示例：**
* **原先请求 payload**（固定不变）：
  ```json
  {
    "inputs": { "theme": "identifying logical flaws and business counterattack" },
    "response_mode": "blocking",
    "user": "default-user"
  }
  ```
* **修改后请求 payload**（以 2026-06-10 为例）：
  ```json
  {
    "inputs": { "theme": "identifying logical flaws and business counterattack (Date: 2026-06-10, Salt: 3829)" },
    "response_mode": "blocking",
    "user": "default-user"
  }
  ```

---

### **详细的修改方案与代码位置**

#### **1. 修改涉及的文件与菜单路径**
* **前端菜单位置**：英语学习模块 -> **每日破绽词汇推送** 模块。
* **修改文件绝对路径**：`D:\cursor\work\super-agent\src\services\difyAPI.ts`
* **修改方法名称**：`generateDailyFlawVocabulary`
* **代码修改行**：约第 286 行（原 `inputs: { theme: 'identifying logical flaws and business counterattack' }`）

#### **2. 详细代码变更设计 (Diff)**
```diff
@@ -282,10 +282,14 @@
     try {
+      const todayStr = new Date().toISOString().slice(0, 10);
+      const randomSalt = Math.floor(Math.random() * 10000);
+      const dynamicTheme = `identifying logical flaws and business counterattack (Date: ${todayStr}, Salt: ${randomSalt})`;
+
       const res = await fetch(`${DIFY_API_BASE_URL}/workflows/run`, {
         method: 'POST',
         headers: {
           Authorization: `Bearer ${apiKey}`,
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
-          inputs: { theme: 'identifying logical flaws and business counterattack' },
+          inputs: { theme: dynamicTheme },
           response_mode: 'blocking',
           user: userId,
         }),
       });
```

---

### **行动步骤计划（Planning Phase）**

1. **第一步【执行代码修改】**：使用工具对 `D:\cursor\work\super-agent\src\services\difyAPI.ts` 进行局部精确修改，加入动态 `Date` 和 `Salt` 逻辑。
2. **第二步【提交结果核对】**：提供代码修改完成后的快照，提请您核对。
3. **第三步【功能验证与用例】**：给出测试用例说明（包含菜单路径、测试步骤、测试数据和预期结果等），由您进行功能验证。

