const { chatCompletions, extractJsonObject } = require('./openaiCompatLlm');

// 句式矩阵需要一次产出翻译、语法结构、替换表达与场景 SOP，耗时明显高于单词，
// 因此放宽单次生成时长；前端由 3 秒竞速托管到任务中心，不会因此卡住交互。
const REQUEST_TIMEOUT_MS = Number(process.env.VOCAB_MATRIX_LLM_TIMEOUT_MS || 90000);

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
    + '\n  "antonyms": ["反义词1"],'
    + '\n  "collocations": ["高频搭配词组1", "搭配2", "搭配3", "搭配4"],'
    + '\n说明：antonyms 仅填真正成立的反义词；若无公认反义词必须输出空数组 []，禁止编造。'
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

async function callLLM(systemPrompt, userPrompt, apiKey) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const reinforcedUser = attempt === 0
      ? userPrompt
      : `${userPrompt}\n\n【重试】上一次未输出合法 JSON。请立刻只输出一个以 { 开头、以 } 结尾的 JSON 对象，不要 Markdown、不要解释、不要思考过程。`;
    const data = await chatCompletions({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: reinforcedUser },
      ],
      temperature: attempt === 0 ? 0.3 : 0.1,
      timeoutMs: REQUEST_TIMEOUT_MS,
      apiKey,
    });
    const content = data?.choices?.[0]?.message?.content || '';
    try {
      return extractJsonObject(content);
    } catch (error) {
      lastError = error;
      const preview = String(content).replace(/\s+/g, ' ').slice(0, 200);
      console.warn(`[Vocab Matrix] LLM JSON parse fail attempt=${attempt + 1}: ${error.message}; preview=${preview}`);
    }
  }
  throw new Error(`Matrix LLM parse failed: ${lastError?.message || 'LLM did not return JSON'}`);
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
  if (/^missing input/i.test(text)) return null;
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

/** Dify 开始节点把空串当成缺参，超长字段会整包拒绝。 */
function clipDifyInput(value, maxLen, fallback) {
  const text = String(value == null ? '' : value).trim();
  const filled = text || String(fallback || '-');
  return filled.length > maxLen ? filled.slice(0, maxLen) : filled;
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
        word: clipDifyInput(word, 200, 'word'),
        phonetic: clipDifyInput(phonetic, 200, '-'),
        pos: clipDifyInput(pos, 50, '-'),
        definition: clipDifyInput(definition, 500, String(word || '').trim() || '-'),
        examples: clipDifyInput(examples, 2000, '-'),
        user_current_profile: clipDifyInput(userProfile, 800, '（未设置学习者画像）'),
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

/**
 * 当矩阵 LLM 失败时，用已有词典 payload（如 en_zh_bidirectional）种子化矩阵，
 * 避免「词已入库但矩阵永久 pending」。字段不足时返回 null。
 */
function seedMatrixFromDictPayload(payload = {}, { text = '', kind = 'word' } = {}) {
  if (kind === 'sentence') return null;
  const source = payload && typeof payload === 'object' ? payload : {};
  const meaning = cleanText(source.translation_main)
    || cleanText(source.meaning_zh)
    || cleanText(source.meaning)
    || cleanText(source.definition);
  const phonetic = cleanText(source.phonetic);
  if (!meaning || !phonetic) return null;

  const synonyms = cleanList(source.synonyms, 6);
  const collocations = cleanList(source.collocations, 6);
  if (!synonyms.length && !collocations.length) return null;

  const examples = cleanExamples(
    source.examples || source.example_sentences || source.business_examples,
    3,
  );
  const seeded = normalizeMatrix({
    phonetic,
    part_of_speech: cleanText(source.pos) || cleanText(source.partOfSpeech) || (kind === 'phrase' ? 'phrase' : ''),
    meaning_zh: meaning,
    definition_en: cleanText(source.definition_en),
    synonyms,
    antonyms: cleanList(source.antonyms, 4),
    collocations,
    business_note: cleanText(source.business_note) || cleanText(source.etymology),
    memory_hook: cleanText(source.memory_hook) || cleanText(source.etymology),
    register: 'Neutral / 协作级',
    scenarios: ['商务沟通', '书面表达'],
    sop_tip: '沿用词典释义，矩阵 LLM 待重试时可覆盖',
    examples,
  }, { text, kind });

  seeded.matrix_seeded_from_dict = true;
  return isMatrixComplete(seeded, kind) ? seeded : null;
}

/** 矩阵内容自带的记忆钩子兜底，确保记忆辅助与记忆节点不空缺 */
function buildFallbackMemoryAids(matrix = {}, word = '') {
  const hook = cleanText(matrix.memory_hook) || cleanText(matrix.etymology);
  const synonym = Array.isArray(matrix.synonyms) ? matrix.synonyms[0] : '';
  const collocation = Array.isArray(matrix.collocations) ? matrix.collocations[0] : '';
  const meaning = cleanText(matrix.meaning)
    || cleanText(matrix.translation_main)
    || cleanText(matrix.meaning_zh)
    || cleanText(matrix.definition);
  const promptWord = cleanText(word) || cleanText(matrix.headword) || 'the target word';
  return {
    root_memory: hook || (meaning ? `核心义：${meaning}` : ''),
    association_memory: synonym ? `联想替换：${synonym}` : (meaning ? `画面联想：${meaning}` : ''),
    mnemonic_phrase: collocation || '',
    image_prompt: `A clear realistic illustration of "${promptWord}"${meaning ? `: ${meaning}` : ''}. Educational, high detail, no letters or watermarks.`,
  };
}

module.exports = {
  classifyKind,
  buildSystemPrompt,
  buildUserPrompt,
  normalizeMatrix,
  isMatrixComplete,
  generateVocabMatrix,
  seedMatrixFromDictPayload,
  runMemoryAidWorkflow,
  buildFallbackMemoryAids,
  parseWorkflowJson,
  clipDifyInput,
  isPlaceholder,
};
