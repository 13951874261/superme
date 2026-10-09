# Context Snapshot: video-purify-empty-transcript

## Task statement
分析视频上传提纯失败原因并解决。症状：提纯任务中心视频转写任务失败，错误为「语音识别成功，但返回的文本为空」。

## Desired outcome
视频上传后能成功转写出非空文本，并继续完成提纯入库（或至少定位并修复导致空文本的可修链路）。

## Stated solution
用户要求分析原因并解决；尚未指定具体修复方案。后续可能经 deploy-smart 部署。

## Probable intent hypothesis
生产/本机视频上传转写链路在 Dify ASR 工作流阶段返回空 outputs，用户希望恢复可用的视频提纯能力。

## Known facts/evidence
- [from-code][auto-confirmed] 报错抛出点：ocab-server/services/videoTranscriber.js L193-196，在 Dify workflow locking 返回后读取 outputs.transcript_text|transcript|text|result，全空则抛该错。
- [from-code][auto-confirmed] 日志链路与截图一致：FFmpeg 16kHz mono MP3 成功 → /files/upload 成功得 file_id → /workflows/run → 空文本失败。说明失败点在「解析/使用 Dify 转写输出」，不是下载/FFmpeg。
- [from-code][auto-confirmed] 工作流定义 yml/video_subtitle_transcription_workflow.yml：ASR(通义 paraformer-realtime-v1) → LLM JSON(	ranscript_text,srt_text) → Code 解析 → End 输出 	ranscript_text/srt_text。
- [from-code][auto-confirmed] ASR 节点仅绑定 udio_file，**未把 start 节点的 language 传给 ASR**；后端虽传 language，工作流 ASR 可能忽略。
- [from-code][auto-confirmed] 后端未记录完整 workflowResult（status/error/outputs），排障信息不足。
- [from-code] API：POST /api/materials/fetch-video 与分片 merge 后调用 startTranscribeTask。
- 相关 docs：docs/user_maual.md 提纯任务中心/音视频转写说明。

## Constraints
- AGENTS.md：中文；改前需复述+示例确认；分步确认；仅改必要部分。
- Dify-related：方案须先对齐 Dify 文档/现有工作流契约。
- 用户附加技能：deep-interview（先澄清不直接改）→ 确认后再修 → deploy-smart 部署。

## Unknowns/open questions
- 失败视频是否确实含清晰人声？语言是否匹配？
- 线上 Dify 工作流是否与仓库 yml 一致？ASR/LLM 是否正常？
- 空文本是 ASR 真空，还是 LLM/Code 解析后变空，或 API outputs 字段结构变化？
- 修复范围：仅加日志诊断 / 修解析 / 修工作流 / 换 ASR 模型？

## Decision-boundary unknowns
- 允许改后端解析与日志？允许改/重导 Dify yml？允许换 ASR 模型？是否必须本轮 deploy-smart？

## Likely codebase touchpoints
- ocab-server/services/videoTranscriber.js
- yml/video_subtitle_transcription_workflow.yml
- ocab-server/server.js (/api/materials/fetch-video, chunk merge)
- src/components/VideoTranscribePanel.tsx
- 可能：生产 Dify 工作流配置 / DIFY_SPEECH_API_KEY

## Relevant repo docs/rules/context inspected
- AGENTS.md
- docs/user_maual.md（提纯任务中心）
- .omx/specs/deep-interview-webpage-purify-500-v2.md（同类提纯失败访谈范式）
- yml/video_subtitle_transcription_workflow.yml
- vocab-server/services/videoTranscriber.js

## Terminology
- 「视频提纯」= 上传/链接视频 → FFmpeg 抽音 → Dify 语音转写工作流 → 转写 markdown → 知识库导入 → 词汇提纯工作流
- 当前失败发生在「转写」阶段，尚未进入知识库/词汇提纯。

## Prompt-safe initial-context summary status
not_needed
