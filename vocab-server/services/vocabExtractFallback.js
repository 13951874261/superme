const { chatCompletions, getLlmModels, DEFAULT_LLM_KEY } = require('./openaiCompatLlm');

const STOPWORDS = new Set([
  'that', 'this', 'with', 'from', 'have', 'been', 'were', 'they', 'their', 'there',
  'what', 'when', 'where', 'which', 'while', 'would', 'could', 'should', 'about',
  'into', 'your', 'you', 'our', 'are', 'was', 'the', 'and', 'for', 'not', 'but',
  'can', 'just', 'like', 'know', 'think', 'going', 'really', 'very', 'also', 'then',
]);

function sampleArticleForLlm(body, maxLen = 18000) {
  const text = String(body || '').trim();
  if (text.length <= maxLen) return text;
  const headLen = Math.floor(maxLen * 0.65);
  const tailLen = maxLen - headLen - 40;
  return `${text.slice(0, headLen)}\n\n...[transcript truncated]...\n\n${text.slice(-tailLen)}`;
}

function parseAssistantJson(content) {
  const raw = String(content || '').trim();
  if (!raw) throw new Error('Received empty assistant content');

  let clean = raw;
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  } else {
    if (clean.toLowerCase().startsWith('```json')) clean = clean.slice(7);
    else if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);
    clean = clean.trim();
  }
  return JSON.parse(clean);
}

/**
 * 当 Dify 工作流提取词汇为空时，调用本地 LLM 动态提取生词、短语与句型。
 */
async function extractVocabFallback(body, cefrLevel = 'B1', genre = 'meeting', duration = '15', theme = '') {
  const apiKey = process.env.LISTEN_LLM_API_KEY
    || process.env.VOCAB_PURIFY_LLM_API_KEY
    || DEFAULT_LLM_KEY;
  const article = sampleArticleForLlm(body);

  const systemPrompt = `You are a senior business English pedagogy expert. Read the English article provided below and extract key business vocabulary words, business phrases, and key business sentence structures.

【TARGET CEFR LEVEL】
${cefrLevel}

【THEME / TOPIC】
${theme || genre || 'General English learning'}

【EXTRACTION REQUIREMENTS】
Based on the length of the input article and the target CEFR level, dynamically determine the number of items to extract (e.g. for a short 1-minute article, extract around 5-8 words, 3-5 phrases, and 1-2 sentence structures; for longer articles, extract more but no more than 30 words, 20 phrases, and 8 sentence structures). All extracted items must be present in the input article.

For each word/phrase/sentence structure, provide:
- phonetic: IPA notation (American standard or British standard)
- partOfSpeech: part of speech (for words only, e.g. adj. / n. / v. / adv.)
- meaning: concise Chinese meaning
- definition_en: concise English definition/explanation
- examples: an array containing the exact original sentence from the article that contains the word/phrase/sentence structure.

【OUTPUT FORMAT】
Output ONLY a single valid JSON object. Do not wrap it in markdown code blocks, and do not include any extra text.
The JSON schema must be exactly:
{
  "words": [{ "word": "word", "phonetic": "", "partOfSpeech": "", "meaning": "", "definition_en": "", "examples": [] }],
  "phrases": [{ "phrase": "phrase", "meaning": "", "definition_en": "", "examples": [] }],
  "sentences": [{ "sentence": "the full sentence structure", "meaning": "", "definition_en": "", "examples": [] }]
}`;

  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  const modelsToTry = getLlmModels();

  for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
    const selectedModel = modelsToTry[attempt];
    console.log(`[Vocab Fallback] attempt ${attempt + 1}/${modelsToTry.length} model=${selectedModel}`);
    try {
      const data = await chatCompletions({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Input Article:\n"""\n${article}\n"""` },
        ],
        temperature: 0.2,
        timeoutMs: 90000,
        apiKey,
        models: [selectedModel],
      });
      const content = String(data?.choices?.[0]?.message?.content || '').trim();
      const parsed = parseAssistantJson(content);
      const vocab = parsed.words || parsed.vocab || [];
      const phrases = parsed.phrases || [];
      const sentences = parsed.sentences || [];
      if (vocab.length + phrases.length + sentences.length > 0) {
        console.log(`[Vocab Fallback] ok words=${vocab.length} phrases=${phrases.length} sentences=${sentences.length}`);
        return { vocab, phrases, sentences };
      }
      console.warn(`[Vocab Fallback] attempt ${attempt + 1} returned empty arrays`);
    } catch (err) {
      console.warn(`[Vocab Fallback] attempt ${attempt + 1} failed:`, err.message);
      if (attempt < modelsToTry.length - 1) await delay(1000);
    }
  }

  return { vocab: [], phrases: [], sentences: [] };
}

function itemToText(item, preferredField) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item !== 'object') return String(item).trim();
  return String(
    item[preferredField]
    || item.word
    || item.phrase
    || item.sentence
    || item.text
    || item.name
    || '',
  ).trim();
}

function classifyFallbackResult(fallbackRes) {
  const words = (fallbackRes?.vocab || []).map((item) => itemToText(item, 'word')).filter(Boolean);
  const phrases = (fallbackRes?.phrases || []).map((item) => itemToText(item, 'phrase')).filter(Boolean);
  const sentences = (fallbackRes?.sentences || []).map((item) => itemToText(item, 'sentence')).filter(Boolean);
  return { words, phrases, sentences };
}

function isMostlyChinese(text) {
  const sample = String(text || '').slice(0, 4000);
  if (!sample) return false;
  const chinese = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = (sample.match(/[a-zA-Z]/g) || []).length;
  return chinese > latin * 0.6;
}

function heuristicExtractVocabZh(transcript) {
  const text = String(transcript || '').trim();
  if (!text) return { words: [], phrases: [], sentences: [] };

  const sentences = text
    .split(/[。！？\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && s.length <= 120)
    .slice(0, 5);

  const tokens = text.match(/[\u4e00-\u9fff]{2,4}/g) || [];
  const freq = new Map();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  const words = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 14);

  const phrases = [];
  for (const sentence of sentences) {
    const parts = sentence.match(/[\u4e00-\u9fff]{4,12}/g) || [];
    for (const part of parts) {
      if (!phrases.includes(part)) phrases.push(part);
      if (phrases.length >= 8) break;
    }
    if (phrases.length >= 8) break;
  }

  const english = heuristicExtractVocabEn(text);
  return {
    words: [...new Set([...english.words, ...words])].slice(0, 14),
    phrases: [...new Set([...english.phrases, ...phrases])].slice(0, 8),
    sentences: sentences.length ? sentences : english.sentences,
  };
}

function heuristicExtractVocabEn(transcript) {
  const text = String(transcript || '').trim();
  if (!text) return { words: [], phrases: [], sentences: [] };

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 6 && s.length <= 220)
    .slice(0, 5);

  const tokens = (text.match(/\b[a-zA-Z]{4,}\b/g) || [])
    .map((w) => w.toLowerCase())
    .filter((w) => !STOPWORDS.has(w));
  const freq = new Map();
  for (const token of tokens) freq.set(token, (freq.get(token) || 0) + 1);
  const words = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 14);

  const phrases = [];
  const parts = text.split(/\s+/);
  for (let i = 0; i < parts.length - 1 && phrases.length < 8; i++) {
    const a = parts[i].replace(/[^a-zA-Z'-]/g, '');
    const b = parts[i + 1].replace(/[^a-zA-Z'-]/g, '');
    if (a.length >= 3 && b.length >= 3) {
      const phrase = `${a} ${b}`.toLowerCase();
      if (!phrases.includes(phrase)) phrases.push(phrase);
    }
  }

  return { words, phrases, sentences };
}

/** 规则兜底：长文转写在 LLM 全失败时仍给出基础候选（自动识别中英文） */
function heuristicExtractVocab(transcript) {
  const text = String(transcript || '').trim();
  if (!text) return { words: [], phrases: [], sentences: [] };
  if (isMostlyChinese(text)) return heuristicExtractVocabZh(text);
  return heuristicExtractVocabEn(text);
}

module.exports = {
  extractVocabFallback,
  classifyFallbackResult,
  heuristicExtractVocab,
  sampleArticleForLlm,
};
