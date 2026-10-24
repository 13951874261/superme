# 项目答疑按钮功能设计方案

**日期**：2026-06-16
**模块**：Super Agent 前端界面
**状态**：已设计

---

## 一、需求概述

在 Super Agent 项目中增加“项目答疑”功能，用户点击侧边栏中的“答疑”按钮后，可对项目实现进行说明和答疑。

**核心技术**：使用 Dify Chatbot 嵌入脚本 (dify.234124123.xyz/embed.min.js)

---

## 二、UI 布局设计

### 2.1 按钮位置
- **文件**：src/components/Sidebar.tsx
- **位置**：侧边栏底部，位于 ChatModule（即时通讯模块）下方，VocabularyBook（词汇书）上方
- **布局**：独占一行，与其他工具按钮保持一致的间距

### 2.2 按钮样式
- **图标**：HelpCircle（来自 lucide-react）
- **文字**：“项目答疑”
- **颜色**：
  - 默认：背景 g-white，边框 order-gray-100，文字 	ext-zinc-700
  - 悬停：背景 g-emerald-50，边框 order-emerald-300，文字 	ext-emerald-700
- **圆角**：ounded-xl
- **内边距**：p-3.5
- **字体**：	ext-xs font-bold tracking-wider

---

## 三、技术实现

### 3.1 文件修改清单

| 文件 | 操作 | 说明 |
|------|------|------|
| index.html | 修改 | 添加 Dify 嵌入脚本，隐藏默认浮窗按钮 |
| src/components/Sidebar.tsx | 修改 | 在侧边栏底部添加“答疑”按钮组件 |

### 3.2 index.html 修改

`html
<!-- Dify Chatbot 配置 -->
<script>
  window.difyChatbotConfig = {
    token: 'SQb8O34NAVGEV18I',
    baseUrl: 'https://dify.234124123.xyz',
    inputs: {},
    systemVariables: {},
    userVariables: {},
  };
</script>
<script
  src="https://dify.234124123.xyz/embed.min.js"
  id="SQb8O34NAVGEV18I"
  defer
></script>

<!-- 自定义样式：隐藏默认浮窗按钮 -->
<style>
  #dify-chatbot-bubble-button {
    display: none !important;
  }
  #dify-chatbot-bubble-window {
    width: 24rem !important;
    height: 40rem !important;
  }
</style>
`

### 3.3 Sidebar.tsx 修改

**新增导入**：
`	sx
import { HelpCircle } from 'lucide-react';
`

**新增按钮代码**（放置在侧边栏底部）：
`	sx
{/* 6. 项目答疑按钮 */}
<div className=\"px-5 xl:px-6 py-4 border-t border-gray-200/50 bg-zinc-50/40 mt-auto shrink-0\">
  <button
    onClick={() => {
      if (window.difyChatbot) {
        window.difyChatbot.open();
      } else {
        const bubbleBtn = document.getElementById('dify-chatbot-bubble-button');
        if (bubbleBtn) {
          bubbleBtn.click();
        }
      }
    }}
    className=\"w-full flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer bg-white border-gray-100 text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 shadow-sm\"
  >
    <div className=\"flex items-center gap-2.5\">
      <HelpCircle className=\"w-4 h-4\" />
      <span className=\"text-xs font-bold tracking-wider\">项目答疑</span>
    </div>
    <ChevronRight className=\"w-3.5 h-3.5 opacity-60\" />
  </button>
</div>
`

---

## 四、交互流程

`
用户点击“项目答疑”按钮
        │
        ▼
Sidebar.tsx 的 onClick 事件触发
        │
        ▼
调用 window.difyChatbot.open() 方法
        │
        ▼
Dify 聊天窗口从屏幕右侧滑入展开
        │
        ▼
用户可在窗口中提问项目相关问题
        │
        ▼
Dify 机器人根据内置提示词进行回答
`

---

## 五、测试用例

### 5.1 UI 测试

| 测试场景 | 测试步骤 | 预期结果 | 对应需求 |
|----------|----------|----------|----------|
| 按钮显示 | 打开页面，侧边栏底部显示“项目答疑”按钮 | 按钮正确显示，图标和文字完整 | UI 布局需求 |
| 按钮悬停 | 鼠标悬停在按钮上 | 按钮背景变更为 g-emerald-50，文字变更为 	ext-emerald-700 | UI 交互需求 |

### 5.2 功能测试

| 测试场景 | 测试步骤 | 预期结果 | 对应需求 |
|----------|----------|----------|----------|
| 按钮点击 | 点击“项目答疑”按钮 | Dify 聊天窗口自动打开 | 功能触发需求 |
| 默认按钮隐藏 | 检查页面右下角 | 默认的 Dify 浮窗按钮不显示 | 隐藏默认按钮需求 |
| 对话功能 | 在 Dify 窗口中输入项目相关问题 | Dify 机器人正常回答 | 答疑功能需求 |

---

## 六、待确认事项

- [x] 确认使用方案C（自定义按钮 + 触发器）
- [x] 确认隐藏默认的 Dify 浮窗按钮
- [x] 确认按钮放置在侧边栏底部

---

**设计人**：AIM
**审核人**：[待用户确认]
