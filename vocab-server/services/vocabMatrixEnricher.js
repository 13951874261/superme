const https = require('https');

const LLM_URL = 'https://23.95.214.232/v1/chat/completions';
const LLM_MODEL = 'dify';
// 句式矩阵需要一次产出翻译、语法结构、替换表达与场景 SOP，耗时明显高于单词，
// 因此放宽单次生成时长；前端由 3 秒竞速托管到任务中心，不会因此卡住交互。
const REQUEST_TIMEOUT_MS = Number(process.env.VOCAB_MATRIX_LLM_TIMEOUT_MS || 90000);

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: REQUEST_TIMEOUT_MS,
});

const PLACEHOLDER_PATTERNS = [
  '目标词', '待补充', '待复习补充', '中文释义加载中', '暂无', 'TODO', 'N/A', 'null', 'undefined',
];

function isPlaceholder(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return true;
  return PLACEHOLDER_PATTERNS.some((p) => text.toLowerCase().includes(p.toLowerCase()));
}

function cleanText(value) {
  const text = String(value == null ? '' : value).trim();
  return isPlaceholder(text) ? '' : text;
}

function cleanList(value, limit = 6) {
  let list = [];
  if (Array.isArray(value)) {
    list = value.map((v) => (typeof v === 'string' ? v : (v && (v.en || v.text || v.term || v.word || v.phrase)) || ''));
  } else if (typeof value === 'string') {
    list = value.split(/[;\n|、；]/);
  }
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const text = cleanText(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function cleanExamples(value, limit = 3) {
  let list = Array.isArray(value) ? value : (value ? [value] : []);
  const result = [];
  for (const item of list) {
    let text = '';
    if (typeof item === 'string') {
      text = item;
    } else if (item && typeof item === 'object') {
      text = [item.en || item.example || '', item.zh || item.translation || ''].filter(Boolean).join(' ');
    }
    text = cleanText(text);
    if (text) result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

/** 依据收录来源标记判定矩阵生成口径：单词 / 短语 / 句式 */
function classifyKind({ isPhrase = false, isSentence = false, text = '' } = {}) {
  if (isSentence) return 'sentence';
  if (isPhrase) return 'phrase';
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 6 || /[.!?]$/.test(String(text || '').trim())) return 'sentence';
  if (words.length > 1) return 'phrase';
  return 'word';
}

function buildSystemPrompt(kind) {
  const common = '你是一位服务于跨国企业高管的商务英语词汇矩阵构建专家。'
    + '\n【强制要求】只返回合法 JSON，直接以大括号开始，禁止任何 markdown 代码围栏、禁止解释性文字。'
    + '\n释义、分析、场景与提示类字段必须使用简体中文；替换表达、搭配、例句中的英文部分必须保留英文原文，不得译成中文。'
    + '\n所有字段都必须给出真实内容，严禁输出「待补充」「暂无」「目标词」等占位符。';

  if (kind === 'sentence') {
    return common
      + '\n你将收到一条从商务长文中提纯出的英文句式，请输出该句式的完整学习矩阵。'
      + '\n返回的 JSON 结构必须严格如下：'
      + '\n{'
      + '\n  "translation_zh": "整句的中文翻译",'
      + '\n  "grammar_structure": "句子的语法结构分析（主干成分、时态语态、关键从句或固定搭配骨架）",'
      + '\n  "executive_alternatives": ["高管级英文替换句1（必须是可直接使用的完整英文句子，不得写中文）", "高管级英文替换句2", "高管级英文替换句3"],'
      + '\n  "key_phrases": ["句中可迁移的英文关键搭配1（英文，不得写中文）", "英文关键搭配2", "英文关键搭配3"],'
      + '\n  "scenario_sop": "该句式的实战场景 SOP：适合什么场合对什么对象说，以及需要回避的分寸风险",'
      + '\n  "register": "语态分寸标签（如 High Power / 决策级、Neutral / 协作级、Low Key / 缓冲级）",'
      + '\n  "scenarios": ["推荐应用场景1", "推荐应用场景2", "推荐应用场景3"],'
      + '\n  "memory_hook": "帮助记住该句式的一句记忆钩子",'
      + '\n  "examples": ["与该句式同结构的商务例句（英文 + 中文）"]'
      + '\n}';
  }

  const unit = kind === 'phrase' ? '英文短语' : '英文单词';
  return common
    + `\n你将收到一个从商务长文中提纯出的${unit}，请输出该词条的完整学习矩阵。`
    + '\n返回的 JSON 结构必须严格如下：'
    + '\n{'
    + '\n  "phonetic": "国际音标（短语给出整体连读音标，形如 /ˈlevərɪdʒ/）",'
    + '\n  "part_of_speech": "词性（短语可用 phrase）",'
    + '\n  "meaning_zh": "中文简明释义",'
    + '\n  "definition_en": "英文商务语境定义",'
    + '\n  "synonyms": ["同近义词1", "同近义词2", "同近义词3", "同近义词4"],'
    + '\n  "antonyms": ["反义词1", "反义词2"],'
    + '\n  "collocations": ["高频搭配词组1", "搭配2", "搭配3", "搭配4"],'
    + '\n  "business_note": "商务使用要点与常见误用提醒",'
    + '\n  "memory_hook": "词根拆解或联想记忆钩子",'
    + '\n  "register": "语态分寸标签（如 High Power / 决策级）",'
    + '\n  "scenarios": ["推荐应用场景1", "推荐应用场景2", "推荐应用场景3"],'
    + '\n  "sop_tip": "在高管商务沟通中使用该词条的分寸提示",'
    + '\n  "examples": ["商务例句（英文 + 中文）1", "商务例句2"]'
    + '\n}';
}

function buildUserPrompt({ text = '', kind = 'word', topic = '' } = {}) {
  const label = kind === 'sentence' ? '待建矩阵的句式' : (kind === 'phrase' ? '待建矩阵的短语' : '待建矩阵的单词');
  return `【长文主题】${topic || '商务实战'}\n\n【${label}】\n"""\n${String(text || '').trim()}\n"""`;
}

function callLLM(systemPrompt, userPrompt, apiKey) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      stream: false,
    });
    const req = https.request(LLM_URL, {
      method: 'POST',
      agent: httpsAgent,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
      rejectUnauthorized: false,
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Matrix LLM HTTP ${res.statusCode}: ${raw.slice(0, 200)}`));
        }
        try {
          const data = JSON.parse(raw);
          const content = data?.choices?.[0]?.message?.content || '';
          const match = content.match(/\{[\s\S]*\}/);
          if (!match) return reject(new Error('Matrix LLM did not return JSON'));
          resolve(JSON.parse(match[0]));
        } catch (error) {
          reject(new Error(`Matrix LLM parse failed: ${error.message}`));
        }
      });
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('Matrix LLM timeout')));
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

/**
 * 归一化为生词本 payload 片段。
 * 句式的高管替换表达映射到 synonyms、关键搭配映射到 collocations，
 * 使句式复用与单词/短语相同的圆形记忆矩阵节点渲染逻辑。
 */
function normalizeMatrix(raw, { text = '', kind = 'word' } = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const word = String(text || '').trim();
  const register = cleanText(source.register) || 'Neutral / 协作级';
  const scenarios = cleanList(source.scenarios, 4);
  const examples = cleanExamples(source.examples, 3);
  const memoryHook = cleanText(source.memory_hook);

  if (kind === 'sentence') {
    const translation = cleanText(source.translation_zh) || cleanText(source.meaning_zh);
    const alternatives = cleanList(source.executive_alternatives, 4);
    const keyPhrases = cleanList(source.key_phrases, 4);
    const scenarioSop = cleanText(source.scenario_sop);
    return {
      word,
      matrix_kind: 'sentence',
      phonetic: '',
      partOfSpeech: 'sentence',
      meaning: translation,
      translation_zh: translation,
      definition_en: cleanText(source.definition_en),
      grammar_structure: cleanText(source.grammar_structure),
      executive_alternatives: alternatives,
      key_phrases: keyPhrases,
      scenario_sop: scenarioSop,
      business_note: scenarioSop,
      synonyms: alternatives,
      antonyms: [],
      collocations: keyPhrases,
      examples,
      memory_hook: memoryHook,
      executive_sop: { register, scenarios, tip: scenarioSop },
      matrix_generated_at: Date.now(),
    };
  }

  const meaning = cleanText(source.meaning_zh) || cleanText(source.meaning) || cleanText(source.translation_main);
  const sopTip = cleanText(source.sop_tip);
  const businessNote = cleanText(source.business_note);
  return {
    word,
    matrix_kind: kind,
    phonetic: cleanText(source.phonetic),
    partOfSpeech: cleanText(source.part_of_speech) || (kind === 'phrase' ? 'phrase' : ''),
    meaning,
    translation_main: meaning,
    definition_en: cleanText(source.definition_en),
    business_note: businessNote,
    synonyms: cleanList(source.synonyms, 6),
    antonyms: cleanList(source.antonyms, 4),
    collocations: cleanList(source.collocations, 6),
    examples,
    memory_hook: memoryHook,
    executive_sop: { register, scenarios, tip: sopTip || businessNote },
    matrix_generated_at: Date.now(),
  };
}

/** 判定矩阵是否已补齐，避免重复计费与重复生成 */
function isMatrixComplete(payload = {}, kind = 'word') {
  const p = payload && typeof payload === 'object' ? payload : {};
  const hasSemantics = !isPlaceholder(p.meaning) || !isPlaceholder(p.translation_zh);
  const hasNodes = (Array.isArray(p.synonyms) && p.synonyms.length > 0)
    || (Array.isArray(p.collocations) && p.collocations.length > 0);
  const hasSop = !!(p.executive_sop && !isPlaceholder(p.executive_sop.register));
  if (kind === 'sentence') {
    return hasSemantics && hasNodes && hasSop && !isPlaceholder(p.grammar_structure) && !isPlaceholder(p.scenario_sop);
  }
  return hasSemantics && hasNodes && hasSop && !isPlaceholder(p.phonetic);
}

/** 生成单条词/短语/句式的词汇矩阵内容 */
async function generateVocabMatrix({ text = '', kind = 'word', topic = '', apiKey = '', callImpl = callLLM } = {}) {
  const cleanInput = String(text || '').trim();
  if (!cleanInput) throw new Error('text is required');
  if (!apiKey) throw new Error('Server missing VOCAB_MATRIX_LLM_API_KEY');

  const raw = await callImpl(buildSystemPrompt(kind), buildUserPrompt({ text: cleanInput, kind, topic }), apiKey);
  return normalizeMatrix(raw, { text: cleanInput, kind });
}

function parseWorkflowJson(resultStr) {
  if (!resultStr) return null;
  if (typeof resultStr !== 'string') return resultStr;
  let text = resultStr.trim();
  if (text.startsWith('```')) {
    const lines = text.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    if (lines.length && lines[lines.length - 1].startsWith('```')) lines.pop();
    text = lines.join('\n').trim();
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 调用既有 Dify 记忆辅助工作流，生成记忆节点所需的词根/联想/助记内容 */
async function runMemoryAidWorkflow({
  word = '',
  phonetic = '',
  pos = '',
  definition = '',
  examples = '',
  userProfile = '',
  apiKey = '',
  baseUrl = 'https://dify.234124123.xyz/v1',
  fetchImpl = fetch,
} = {}) {
  if (!apiKey) throw new Error('Server missing DIFY_MEMORY_AID_API_KEY');
  const response = await fetchImpl(`${String(baseUrl).replace(/\/$/, '')}/workflows/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: {
        word: String(word || '').trim(),
        phonetic: phonetic || '',
        pos: pos || '',
        definition: definition || '',
        examples: examples || '',
        user_current_profile: userProfile || '',
      },
      response_mode: 'blocking',
      user: 'vocab-matrix-enricher',
    }),
  });
  if (!response.ok) throw new Error(`Memory aid workflow HTTP ${response.status}`);
  const data = await response.json();
  const parsed = parseWorkflowJson(data?.data?.outputs?.result);
  if (!parsed) throw new Error('Memory aid workflow returned no JSON');
  return {
    root_memory: cleanText(parsed.root_memory),
    association_memory: cleanText(parsed.association_memory),
    mnemonic_phrase: cleanText(parsed.mnemonic_phrase),
    image_prompt: cleanText(parsed.image_prompt),
  };
}

/** 矩阵内容自带的记忆钩子兜底，确保记忆辅助与记忆节点不空缺 */
function buildFallbackMemoryAids(matrix = {}) {
  const hook = cleanText(matrix.memory_hook);
  const synonym = Array.isArray(matrix.synonyms) ? matrix.synonyms[0] : '';
  const collocation = Array.isArray(matrix.collocations) ? matrix.collocations[0] : '';
  return {
    root_memory: hook,
    association_memory: synonym ? `联想替换：${synonym}` : '',
    mnemonic_phrase: collocation || '',
    image_prompt: '',
  };
}

module.exports = {
  classifyKind,
  buildSystemPrompt,
  buildUserPrompt,
  normalizeMatrix,
  isMatrixComplete,
  generateVocabMatrix,
  runMemoryAidWorkflow,
  buildFallbackMemoryAids,
  parseWorkflowJson,
  isPlaceholder,
};
