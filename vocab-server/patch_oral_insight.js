// ==========================================
// 口语沙盘：场景启动与多轮对话（English_Oral_Sandbox Chatflow）
// 复用 DIFY_ORAL_API_KEY，与 /api/english/oral/chat 共享同一 Chatflow
// 前端 callOralSandbox() 传 { inputs, conversationId, userId }
// 返回 { reply: OralSandboxReply, conversationId }
// ==========================================
app.post('/api/english/oral-sandbox', async (req, res) => {
  const {
    inputs = {},
    conversationId = null,
    userId = 'default-user',
    stream = false,
  } = req.body || {};

  if (!inputs || typeof inputs !== 'object' || Object.keys(inputs).length === 0) {
    return res.status(400).json({ error: '缺少场景输入参数 (inputs)' });
  }

  const isStream = Boolean(stream === true || stream === 'true');
  const apiKey = process.env.DIFY_ORAL_API_KEY;
  const baseUrl = process.env.DIFY_API_BASE_URL
    || process.env.VITE_DIFY_API_BASE_URL
    || 'https://dify.234124123.xyz/v1';

  if (!apiKey) {
    console.warn('[口语沙盘] DIFY_ORAL_API_KEY 未配置');
    return res.status(500).json({ error: '口语沙盘服务未配置 API Key' });
  }

  // 构造首轮启动 query：当无 conversationId 时，用场景描述作为首轮 query
  const isFirstTurn = !conversationId;
  const query = isFirstTurn
    ? `场景启动：${inputs.scene_type || '通用商务场景'} | 角色：${inputs.roles || '未指定'} | 文化背景：${inputs.cultural_context || '通用'}${inputs.user_reply ? ' | 用户回应：' + inputs.user_reply : ''}`
    : (inputs.user_reply || '继续推演');

  console.log(`[口语沙盘] 正在启动场景推演 (${isFirstTurn ? '首轮启动' : '多轮对话'} | ${isStream ? '流式' : '标准'})...`);

  try {
    const response = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: injectOralSystemTime(inputs),
        query,
        response_mode: isStream ? 'streaming' : 'blocking',
        user: userId,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const { mapOralUpstreamError } = require('./services/oralChatUpstreamError');
      const mapped = mapOralUpstreamError(response.status, errorData);
      console.warn('[口语沙盘] 远程推演服务响应异常 (' + response.status + ' → ' + mapped.status + '):', mapped.body);
      return res.status(mapped.status).json(mapped.body);
    }

    if (isStream && response.body) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const reader = typeof response.body.getReader === 'function' ? response.body.getReader() : null;
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
            if (typeof res.flush === 'function') res.flush();
          }
        } finally {
          reader.releaseLock?.();
        }
        console.log('[口语沙盘] 流式输出完成');
        return res.end();
      } else if (typeof response.body.pipe === 'function') {
        response.body.pipe(res);
        return;
      }
      return res.end();
    }

    const data = await response.json().catch(() => ({}));
    console.log('[口语沙盘] 推演完成 (标准报文)');

    // 从 Dify Chatflow 响应中提取结构化 reply
    const rawAnswer = data?.answer || '';
    let reply;
    try {
      // 尝试解析 JSON 格式的 answer
      const cleanAnswer = rawAnswer.replace(/```json/g, '').replace(/```/g, '').trim();
      reply = JSON.parse(cleanAnswer);
    } catch {
      // 解析失败时构造最小 reply
      reply = {
        current_speaker: '系统',
        dialogue: rawAnswer || '场景推演已启动，请继续对话',
        hidden_intent: '',
        has_flaw: false,
        flaw_analysis: '',
        evaluation: '',
      };
    }

    return res.json({
      reply,
      conversationId: data?.conversation_id || conversationId || '',
    });
  } catch (err) {
    console.warn('[口语沙盘] 代理通道异常: ' + err.message);
    if (isStream && res.headersSent) {
      res.write(`data: ${JSON.stringify({ event: 'error', message: err.message || '推演中断' })}\n\n`);
      return res.end();
    }
    return res.status(500).json({ fallback: true, message: err.message || '口语沙盘代理失败' });
  }
});

// ==========================================
// 洞察听力：动态场景生成（Insight Listen Engine Workflow）
// 前端 fetchDynamicInsightScenario() 传 { category, userId }
// 返回 InsightScenarioResult 结构
// ==========================================
app.post('/api/insight/listen/scenario', async (req, res) => {
  const { category, userId = 'default-user' } = req.body || {};

  if (!category || typeof category !== 'string') {
    return res.status(400).json({ error: '缺少 category 参数' });
  }

  const apiKey = process.env.DIFY_INSIGHT_LISTEN_API_KEY || process.env.DIFY_ORAL_API_KEY;
  const baseUrl = process.env.DIFY_API_BASE_URL
    || process.env.VITE_DIFY_API_BASE_URL
    || 'https://dify.234124123.xyz/v1';

  if (!apiKey) {
    console.warn('[洞察听力] API Key 未配置');
    return res.status(500).json({ error: '洞察听力服务未配置 API Key' });
  }

  console.log(`[洞察听力] 正在生成动态场景 (category=${category})...`);

  try {
    const response = await fetch(`${baseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: injectOralSystemTime({
          category,
          user_current_profile: '',
        }),
        response_mode: 'blocking',
        user: userId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn(`[洞察听力] 远程服务响应异常 (${response.status}):`, errorData);
      return res.status(response.status).json({
        error: errorData?.message || `洞察听力服务异常 (HTTP ${response.status})`,
      });
    }

    const data = await response.json().catch(() => ({}));
    console.log('[洞察听力] 场景生成完成');

    // 从 workflow outputs 中提取结果
    const outputs = data?.data?.outputs || {};
    const rawResult = outputs.result || outputs.scenario || outputs.draft || data?.answer || '';

    // 尝试解析 JSON 结果
    let parsedResult;
    try {
      const cleanRaw = typeof rawResult === 'string'
        ? rawResult.replace(/```json/g, '').replace(/```/g, '').trim()
        : rawResult;
      parsedResult = typeof cleanRaw === 'string' ? JSON.parse(cleanRaw) : cleanRaw;
    } catch {
      // 解析失败时返回原始数据，前端 parseInsightScenarioPayload 会兜底处理
      parsedResult = { scenario: String(rawResult || ''), raw: data };
    }

    return res.json(parsedResult);
  } catch (err) {
    console.warn('[洞察听力] 代理通道异常: ' + err.message);
    return res.status(500).json({ error: err.message || '洞察听力场景生成失败' });
  }
});

