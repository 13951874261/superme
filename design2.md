I will now output the demand restatement, the detailed analysis, the solution, the examples, and wait for your confirmation.

---

### **您的问题**
“分析项目中的【语音输入】功能未生效的原因，并给出解决方案。”

---

### **第一步：需求复述与对齐确认**

#### **1. 问题根源分析**
* **接口硬编码与解析失败**：
  在 `vocab-server/server.js` 后端的 `/api/audio/transcriptions`（语音转文字中转接口）中，调用 Whisper 推理接口的地址被硬编码为：
  `https://9router.234124123.xyz/v1/audio/transcriptions`
  目前该域名 `9router.234124123.xyz` 的 DNS 解析已彻底失效（报错：`queryA ECONNREFUSED` 或连接超时），导致后端中转调用语音识别服务时，所有的模型均重试失败，最终接口返回 `500` 错误。
* **IP 直连的 TLS 证书校验限制**：
  项目中有可用的 IP 级备用接口 `https://23.95.214.232/v1/audio/transcriptions`，但在 Node.js 中使用原生 `fetch` 请求该 IP 时，由于证书不匹配（证书属于 `9router.234124123.xyz`），Node.js 会由于安全限制直接拦截请求并报错 `fetch failed`。

#### **2. 解决方案设计**
为了彻底解决此问题，我们将采用项目中成熟的 **“双端点轮询 + 自动旁路 TLS 校验”** 机制：
1. **多端点配置**：
   在 `vocab-server/server.js` 中，新增类似 TTS 模块的 `getSttUpstreamUrls` 辅助函数：
   ```javascript
   function getSttUpstreamUrls() {
     const primary = process.env.STT_API_URL || 'https://9router.234124123.xyz/v1/audio/transcriptions';
     const fallback = process.env.STT_API_FALLBACK_URL || 'https://23.95.214.232/v1/audio/transcriptions';
     return [...new Set([primary, fallback].filter(Boolean))];
   }
   ```
2. **原生 HTTPS Multipart 上传工具**：
   不依赖任何外部三方 FormData 库，在 `server.js` 中实现一个使用 Node.js 原生 `https` 模块上传语音文件的工具函数 `postSttUpstream`，通过 `rejectUnauthorized: false` 绕过对 IP `23.95.214.232` 的 TLS 证书校验。
3. **改造转写中转端点**：
   遍历获取的所有 STT 上传地址，如果主地址失效，自动切换为备用 IP 地址进行转录。

---

### **示例确认**

#### **当前失败示例**：
* **用户行为**：点击录音按钮，说了一句英文并结束。
* **调用链路**：
  `前端 (SpeechRecognition/difyAPI.ts)` 
  $\rightarrow$ 发送语音数据至 `/api/audio/transcriptions`
  $\rightarrow$ `后端 (vocab-server/server.js)` 
  $\rightarrow$ 尝试 fetch `https://9router.234124123.xyz/v1/audio/transcriptions` 
  $\rightarrow$ **[报错]** DNS 解析失败 
  $\rightarrow$ 依次尝试三个模型均失败 
  $\rightarrow$ 返回前端 `500 All transcription APIs failed.` 
  $\rightarrow$ **[现象]** 页面提示语音识别服务不可用，功能失效。

#### **修复后预期行为**：
* **用户行为**：点击录音按钮，说了一句英文并结束。
* **调用链路**：
  `前端` 
  $\rightarrow$ 发送语音数据至 `/api/audio/transcriptions`
  $\rightarrow$ `后端`
  $\rightarrow$ 尝试调用 `https://9router.234124123.xyz/...`（由于 DNS 故障失败）
  $\rightarrow$ **[自动降级]** 调用备用 IP `https://23.95.214.232/...` 并且设置 `rejectUnauthorized: false`
  $\rightarrow$ 成功获取转录文本 
  $\rightarrow$ 返回前端 `200 { "text": "Recognized speech text" }`
  $\rightarrow$ **[现象]** 语音文本顺利填充到输入框，功能恢复正常。

---

### **执行计划**
1. **步骤一**：用户确认本方案设计。
2. **步骤二**：在 `vocab-server/server.js` 中新增 `getSttUpstreamUrls` 和 `postSttUpstream`，并改造 `/api/audio/transcriptions` 接口。
3. **步骤三**：在本地运行测试脚本模拟发送音频，验证修复后的接口可以正确使用备用 IP 转录并返回文本。
4. **步骤四**：提供部署建议及包含菜单路径、测试数据的测试用例，并完成复盘记录。

---

