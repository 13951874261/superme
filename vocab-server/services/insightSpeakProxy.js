function extractJsonFromString(raw) {
  const rawStr = String(raw ?? '').trim();
  const jsonBlockMatch = rawStr.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    return jsonBlockMatch[1].trim();
  }
  const startIdx = rawStr.indexOf('{');
  const endIdx = rawStr.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return rawStr.substring(startIdx, endIdx + 1).trim();
  }
  return rawStr.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function parseListenFeedback(data) {
  return String(
    data?.data?.outputs?.ai_feedback
    ?? data?.data?.outputs?.text
    ?? data?.answer
    ?? data?.message
    ?? ''
  );
}

function normalizeSpeakFlaws(flaws, critique) {
  if (Array.isArray(flaws) && flaws.length > 0) {
    const validFlaws = flaws
      .filter(item => item && typeof item === 'object' && !Array.isArray(item))
      .map((item, idx) => {
        const detail = String(item.detail || item.description || item.content || item.title || '').trim();
        let title = String(item.title || '').trim();
        if (!title && detail) {
          title = detail.slice(0, 24);
        } else if (title.length > 24) {
          title = title.slice(0, 24);
        }
        if (!title) {
          title = `失分点 ${idx + 1}`;
        }
        let dimension = String(item.dimension || '').trim().toLowerCase();
        if (!['logic', 'expression', 'other'].includes(dimension)) {
          dimension = 'other';
        }
        const id = String(item.id || `f${idx + 1}`).trim();
        return {
          id,
          title,
          detail: detail || title,
          dimension
        };
      })
      .filter(f => Boolean(f.detail || f.title));

    if (validFlaws.length > 0) {
      return validFlaws.slice(0, 8);
    }
  }

  const trimmedCritique = String(critique || '').trim();
  if (trimmedCritique) {
    let segments = trimmedCritique
      .split(/(?:\r?\n+|(?<=[。！？；\n])\s*(?=[0-9]+[、.．]|\([0-9]+\)|[①②③④⑤⑥⑦⑧⑨⑩]))/)
      .map(s => s.trim())
      .filter(Boolean);

    if (segments.length === 1 && segments[0].length > 40) {
      segments = segments[0]
        .split(/(?<=[。！？；])/)
        .map(s => s.trim())
        .filter(Boolean);
    }

    const flawsFromCritique = segments.map((seg, idx) => {
      const cleanSeg = seg.replace(/^(?:[0-9]+[、.．]|\([0-9]+\)|[①②③④⑤⑥⑦⑧⑨⑩])\s*/, '').trim();
      const text = cleanSeg || seg;
      return {
        id: `f${idx + 1}`,
        title: text.slice(0, 24),
        detail: text,
        dimension: 'other'
      };
    }).filter(f => Boolean(f.detail));

    if (flawsFromCritique.length > 0) {
      return flawsFromCritique.slice(0, 8);
    }
  }

  return [
    {
      id: 'f0',
      title: '综合失分点',
      detail: trimmedCritique || '暂无破绽文本，可追问本次分数含义。',
      dimension: 'other'
    }
  ];
}

function parseSpeakResult(raw) {
  const parsed = JSON.parse(extractJsonFromString(raw));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('speak result is not an object');
  }
  const critique = String(parsed.critique || '');
  const flaws = normalizeSpeakFlaws(parsed.flaws, critique);
  return {
    score: Number(parsed.score) || 0,
    critique,
    framework_analysis: String(parsed.framework_analysis || ''),
    revised_version: String(parsed.revised_version || ''),
    flaws
  };
}

function buildTimedInputs(inputs, profile) {
  const base = inputs && typeof inputs === 'object' ? { ...inputs } : {};
  base.user_current_profile = profile || '';
  if (!base._system_time) base._system_time = new Date().toISOString();
  if (base._system_timestamp_ms == null || base._system_timestamp_ms === '') {
    base._system_timestamp_ms = Date.now();
  }
  return base;
}

async function runDifyWorkflow({ apiKey, baseUrl, inputs, userId }) {
  if (!apiKey) {
    const err = new Error('后端未配置对应 Dify 密钥');
    err.statusCode = 503;
    throw err;
  }
  const response = await fetch(`${baseUrl}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs,
      response_mode: 'blocking',
      user: userId
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Dify 请求失败: ${response.status} - ${errText}`);
    err.statusCode = response.status;
    throw err;
  }
  return response.json();
}

function resolveInsightGenApiKey(env) {
  const source = env && typeof env === 'object' ? env : process.env;
  return String(source.DIFY_INSIGHT_GEN_KEY || source.VITE_DIFY_INSIGHT_GEN_KEY || '').trim();
}

function buildInsightGenInputs(body) {
  const category = String((body && body.category) || '').trim();
  if (!category) throw new Error('category required');
  return {
    category,
    inputs: { category }
  };
}

function parseInsightGenAnswer(data) {
  return String((data && data.answer) || '').trim();
}

async function runDifyCompletion({ apiKey, baseUrl, inputs, userId, query = '' }) {
  if (!apiKey) {
    const err = new Error('后端未配置对应 Dify 密钥');
    err.statusCode = 503;
    throw err;
  }
  const response = await fetch(`${String(baseUrl || '').replace(/\/$/, '')}/completion-messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs,
      query,
      response_mode: 'blocking',
      user: userId
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Dify 请求失败: ${response.status} - ${errText}`);
    err.statusCode = response.status;
    throw err;
  }
  return response.json();
}

function buildCritiqueChatPrompt({ query, evalSnapshot = {}, messages = [] }) {
  const totalScore = evalSnapshot.totalScore ?? evalSnapshot.score ?? '';
  const logicScore = evalSnapshot.logicScore ?? '';
  const expressionScore = evalSnapshot.expressionScore ?? '';
  const critique = String(evalSnapshot.critique || '').slice(0, 1200);
  const flawsStr = Array.isArray(evalSnapshot.flaws)
    ? JSON.stringify(evalSnapshot.flaws.slice(0, 8)).slice(0, 1000)
    : '';
  const revisedVersion = String(evalSnapshot.revisedVersion || evalSnapshot.revised_version || '').slice(0, 400);
  const userInputExcerpt = String(evalSnapshot.userInputExcerpt || evalSnapshot.user_input || '').slice(0, 600);

  const recentMessages = Array.isArray(messages)
    ? messages.slice(-8).map(m => `${m.sender === 'user' ? '学员' : '教练'}: ${String(m.text || '').slice(0, 300)}`).join('\n')
    : '';

  const snapshotContext = [
    '【本次评估快照】',
    totalScore !== '' ? `总分: ${totalScore}/10` : '',
    logicScore !== '' ? `逻辑战力: ${logicScore}/5` : '',
    expressionScore !== '' ? `表达分寸: ${expressionScore}/5` : '',
    critique ? `破绽综述: ${critique}` : '',
    flawsStr ? `结构化失分点: ${flawsStr}` : '',
    revisedVersion ? `高维重构范文: ${revisedVersion}` : '',
    userInputExcerpt ? `学员原稿摘要: ${userInputExcerpt}` : '',
    recentMessages ? `\n【近期追问记录】\n${recentMessages}` : '',
    `\n【学员本轮追问】\n${query}`
  ].filter(Boolean).join('\n');

  return snapshotContext;
}

function generateMockCritiqueReply({ query, evalSnapshot = {} }) {
  const q = String(query || '').trim();
  const flaws = Array.isArray(evalSnapshot.flaws) ? evalSnapshot.flaws : [];

  const matchedFlaw = flaws.find(f =>
    (f.title && q.includes(f.title)) || (f.detail && q.includes(f.detail.slice(0, 10)))
  ) || flaws[0];

  if (q.includes('逻辑战力')) {
    return '针对逻辑战力评分，核心在于结论先行与事实依据支撑。建议改法：1. 先明确核心结论与交付截止时间点；2. 补充具体责任分工与前置风险预案，避免使用模糊词汇。';
  }
  if (q.includes('表达分寸')) {
    return '针对表达分寸评分，体制内沟通重在姿态端正与请示尊重。建议替换句：1. “处长，关于这项工作，我向您专题汇报一下目前的推进构想，请您把关指导”；2. “我们计划今天下班前完成初稿梳理，届时再呈送您审阅批示”。';
  }
  if (matchedFlaw) {
    return `针对失分点【${matchedFlaw.title}】（${matchedFlaw.detail || ''}），在职场与体制内场景中，关键是要将口语化推诿转为明确的责任闭环。建议直接开口说：“领导，这件事我今天下午下班前先梳理出关键节点清单向您汇报，确保推进节奏受控。”`;
  }
  if (q.includes('处长') || q.includes('委婉') || q.includes('漏洞')) {
    return '委婉指出处长或领导逻辑漏洞的核心原则是“借力请示、数据说话、把决策权留给领导”。建议开口表达：“处长，按照您刚才指示的方向，我在细化落地步骤时发现两处数据逻辑可能需要跟您确认一下，以便后续推进行动更稳妥。”';
  }
  return '收到您的追问。基于本次表达评估，建议在开口时强化结构化表达与分寸感，明确时间节点，保持请示姿态。';
}

module.exports = {
  extractJsonFromString,
  parseListenFeedback,
  parseSpeakResult,
  normalizeSpeakFlaws,
  buildTimedInputs,
  runDifyWorkflow,
  resolveInsightGenApiKey,
  buildInsightGenInputs,
  parseInsightGenAnswer,
  runDifyCompletion,
  buildCritiqueChatPrompt,
  generateMockCritiqueReply
};
