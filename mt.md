太棒了，拿到 API Key (`app-PCvZEHnNFOGT6NppMqtudw60`) 意味着后端的“大脑”已经准备就绪。接下来我们需要在前端 React/Vite 项目中打通“任督二脉”，将 UI 与真实的 AI 推演能力连接起来。

为了保证代码的清晰和可维护性，我们将分三步进行集成：**环境配置、服务封装、组件对接**。

### 第一步：环境变里配置 (Security & Config)

在你的项目根目录找到 `.env` 或 `.env.local` 文件。为了安全起见，我们将 API Key 存放在环境变量中。

```env
# Dify API 基础路径 (如果是私有化部署请替换为你的实际域名，例如 http://xxx.xxx/v1)
VITE_DIFY_API_URL=https://api.dify.ai/v1

# 洞察(听) 模块专属 API Key
VITE_DIFY_INSIGHT_LISTEN_KEY=app-PCvZEHnNFOGT6NppMqtudw60

```

### 第二步：封装 Dify API 服务 (`src/services/difyAPI.ts`)

为了隔离网络请求逻辑，在现有的 `difyAPI.ts`（或者新建一个 `insightAPI.ts`）中，编写针对 Workflow 的调用函数。Dify 的工作流推荐使用 `blocking`（阻塞）模式来获取最终结果。

```typescript
// src/services/difyAPI.ts

const API_URL = import.meta.env.VITE_DIFY_API_URL || 'https://api.dify.ai/v1';
const INSIGHT_LISTEN_KEY = import.meta.env.VITE_DIFY_INSIGHT_LISTEN_KEY;

export interface InsightListenInputs {
  scenario_text: string;
  user_analysis: string;
}

export const fetchInsightFeedback = async (inputs: InsightListenInputs): Promise<string> => {
  if (!INSIGHT_LISTEN_KEY) {
    throw new Error("Missing Dify API Key for Insight Listen module.");
  }

  try {
    const response = await fetch(`${API_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${INSIGHT_LISTEN_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: inputs,
        response_mode: "blocking", // 阻塞模式，等待执行完毕返回完整结果
        user: "superme-admin-01"   // 标识当前用户
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Dify API Error: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    
    // 解析 Dify Workflow 的标准返回结构
    // 假设你在 Dify 中将结束节点的输出变量命名为 'ai_feedback'
    if (data.data && data.data.status === 'succeeded') {
      return data.data.outputs.ai_feedback || "未获取到有效反馈，请检查 Dify 工作流输出变量配置。";
    } else {
      throw new Error("Workflow execution failed or was interrupted.");
    }
  } catch (error) {
    console.error("Failed to fetch insight feedback:", error);
    throw error;
  }
};

```

### 第三步：在前端组件中对接真实数据 (`ListenModule.tsx`)

现在，回到我们之前编写的 `ListenModule.tsx` 组件，将模拟的 `setTimeout` 替换为真实的 API 调用。

找到组件中的 `handleSubmit` 函数并进行替换：

```tsx
import { fetchInsightFeedback } from '../../services/difyAPI'; // 引入刚才封装的API

// ... (保持原有的组件骨架和状态不变)

  const handleSubmit = async () => {
    if (!userInput.trim()) return;
    
    setIsSubmitting(true);
    setFeedback(null); // 清空历史反馈

    try {
      // 提取当前选中的场景文本
      const currentScenario = DAILY_SCENARIOS[activeTab];
      
      // 调用真实 Dify API
      const result = await fetchInsightFeedback({
        scenario_text: currentScenario,
        user_analysis: userInput
      });

      // 将 Dify 返回的 Markdown 文本设置到状态中
      setFeedback(result);
    } catch (error) {
      console.error(error);
      setFeedback(`### ⚠️ 解析失败\n与智囊系统连接中断，请检查网络或 API Key 配置。\n\n**详细信息**: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

// ... (组件的 return 部分保持原样即可，你的 UI 代码已经写得非常好了)

```

### 集成检查清单与后续优化建议

1. **测试运行**：保存代码后，在你的开发环境 (`npm run dev` 或 `pnpm dev`) 中打开该模块。输入一段简单的测试拆解，点击“提交侧写”，观察右侧是否能正确渲染出 AI 导师的 Markdown 格式点评。
2. **跨域问题 (CORS)**：如果在本地测试时浏览器报 CORS 跨域错误，这是由于前端直接请求了 Dify 服务器。你有两种解决方式：
* **方案 A（快速）**：使用 Vite 的 `server.proxy` 功能，在 `vite.config.ts` 中配置代理，将请求转发到 Dify API。
* **方案 B（生产级）**：借助你项目中现有的 Cloudflare Workers / Nginx 进行反向代理，隐藏真实的 API Key 和请求地址。


3. **渲染优化**：由于 Dify 返回的是 Markdown 格式的文本，右侧区域目前是 `whitespace-pre-wrap` 渲染。为了达到最顶级的视觉效果，建议后续引入 `react-markdown` 库，配合 Tailwind Typography 插件，让标题、列表、加粗文本的渲染更具层次感。