# Super-Agent 开发与排错经验库 (Experience Log)

本文档用于记录项目开发、全栈联调与部署过程中遇到的典型坑点及终极解决方案，作为防雷避坑指南。

---

## 1. Dify STT 语音识别 415 Unsupported Media Type
**【现象描述】**
在接入私有化部署的 Dify 0.6.0 STT 接口时，无论是 Node 后端转发还是前端直传，均被 Dify 强行拦截并返回 415 错误。
**【根本原因】**
私有化部署的 Dify 引擎（或其底层模型）对音频文件格式白名单存在极其严格的物理层校验，完全不接受浏览器原生 `MediaRecorder` 录制的 `audio/webm` 格式，单纯在 formData 中修改文件后缀（如 `recording.wav`）无效。
**【终极方案】**
在前端实行“硬核转码”。利用浏览器底层的 `AudioContext` 芯片级 API，将收集到的 WebM Blob 暴力解码并重新按标准协议编码为血统纯正的 PCM `.wav` 格式，再将纯正的 Wav Blob 发送给 Dify，彻底规避后端文件类型限制。（核心代码参考 `listeningAPI.ts` 中的 `convertToWav` 函数）。

## 2. 发音录音抛出 EncodingError: Unable to decode audio data
**【现象描述】**
在点击发音纠正录音时，偶尔出现浏览器终端飘红报错，提示无法解析音频数据。
**【根本原因】**
用户的点击动作过快（秒按秒松），导致 `MediaRecorder` 收集到的音频区块为空（size=0）或严重残缺。传入 `AudioContext.decodeAudioData()` 时，由于数据不是一个合法的多媒体容器而报错。
**【终极方案】**
（交互层解决）教育用户必须“长按”录音，保持说话至少 1-2 秒以上。同时，可在代码中增加对 `audioBlob.size` 的前置判断，若过小则直接给 Toast 提示“录音时间太短”，拦截后续的网络和解码请求。

## 3. 新增后端 API 后部署前端出现 404 Cannot POST
**【现象描述】**
在开发了新的工作流接口（如 `/api/grammar-polish`）并在本地联调通过后，尝试在服务器上运行，前端疯狂报 404 Not Found。
**【根本原因】**
全栈开发时的**“偏科部署”**。只执行了 `pnpm build` 并把静态资源 scp 上了服务器，却忘记了把修改过的后端 `server.js` 覆盖上去并重启 Node 守护进程。此时 Nginx 会把请求转发给依旧跑着旧代码的本地 3001 端口，从而报 404。
**【终极方案】**
严格执行部署 SOP 的“双端双切”策略：
1. 上传前端：`scp -r .\dist\* ubuntu@...`
2. 上传后端：`scp .\vocab-server\server.js ubuntu@...`
3. 重启服务：`ssh -t ubuntu@... "sudo systemctl restart super-agent-vocab.service"`

## 4. Node 后端重启后偶发 401 Unauthorized
**【现象描述】**
部署了含有新 Dify 工作流（需要新 API Key）的代码后，重启系统服务，调用接口瞬间全部返回 401。
**【根本原因】**
本地的 `.env.local` 添加了新的 API Key（如 `DIFY_GRAMMAR_API_KEY`），但往往会忘记同步修改服务器上的环境配置（如 `/opt/vocab-server/.env` 或系统的 Bash profile）。
**【终极方案】**
“无状态容灾（Fallback）机制”。在 `server.js` 中读取环境变量时，直接为核心应用写入硬编码的真实 Key 作为兜底：
`const workflowApiKey = process.env.DIFY_GRAMMAR_API_KEY || 'app-真实的Key';`
这样即使服务器端的环境配置文件滞后，系统依然能够凭借代码中的 Fallback 自我修复并正常运转。

## 5. UI 布局被极限压缩，长文本无法显示
**【现象描述】**
左侧发音纠正和右侧语法复健组件放在 CSS Grid 里，因为父级限定了 `h-full min-h-[160px]`，导致内部的 `textarea` 被严重压扁，Dify 返回的长篇大论需要滚轮操作，极其破坏高管级体验。
**【根本原因】**
过度使用了硬编码的绝对高度和 flex 的满屏约束，导致内容被截断（Overflow）。
**【终极方案】**
解除枷锁。移除父容器强加的 `h-full min-h-[xxx]`，改为纯粹的 `flex flex-col`。给输入框设置 `rows={6}` 撑开基础高度，并允许 `resize-y`，外层 grid 自动 `auto-rows-max`，让内容本身决定容器的最终高度，实现自适应流式排版。
