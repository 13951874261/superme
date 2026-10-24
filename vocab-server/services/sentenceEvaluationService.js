const { chatCompletions, extractJsonObject } = require('./openaiCompatLlm');

const REQUEST_TIMEOUT_MS = 30000;

function buildSystemPrompt() {
  return '你是一位严苛的外企高管兼语言专家。用户正在进行商务词汇闪卡造句训练。请评估：1. 语法准确性；2. 商务分寸感和地道程度；3. 是否正确使用目标词汇。\n\n必须返回合法 JSON，不要 Markdown。评分必须是 0 到 5 的整数：5=准确、地道、符合场景；4=轻微瑕疵；3=基本合格但需改进；2=明显问题；1=严重问题；0=未使用目标词或无法理解。is_pass 仅在 score >= 3 且正确使用目标词时为 true。\n\n返回严格结构：\n{\n  "score": 0到5的整数,\n  "feedback": "简短犀利的中文点评，包含语法、目标词使用和商务分寸建议",\n  "is_pass": true或false,\n  "corrected_sentence": "改进后的地道商务英文句子"\n}';
}

function buildUserPrompt(targetWord, userSentence, theme) {
  return `【目标词汇】${targetWord}\n【用户造句】${userSentence}\n【实战主题】${theme || '商务沟通'}`;
}

async function callLLM(systemPrompt, userPrompt, apiKey) {
  const data = await chatCompletions({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    timeoutMs: REQUEST_TIMEOUT_MS,
    apiKey,
  });
  return extractJsonObject(data?.choices?.[0]?.message?.content || '');
}

function normalizeScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(5, Math.round(number)));
}

function normalizeResult(raw, targetWord) {
  const score = normalizeScore(raw?.score);
  const correctedSentence = String(raw?.corrected_sentence || '').trim();
  const feedback = String(raw?.feedback || '').trim();
  const targetUsed = new RegExp(`\\b${String(targetWord || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  const isPass = score >= 3 && Boolean(raw?.is_pass) && targetUsed.test(correctedSentence || String(raw?.user_sentence || ''));
  return { score, is_pass: isPass, feedback, corrected_sentence: correctedSentence };
}

async function evaluateSentence({ targetWord = '', userSentence = '', theme = '' }, apiKey) {
  if (!apiKey) throw new Error('Server missing EVALUATION_LLM_API_KEY');
  if (!String(targetWord).trim()) throw new Error('targetWord is required');
  if (!String(userSentence).trim()) throw new Error('userSentence is required');
  const raw = await callLLM(buildSystemPrompt(), buildUserPrompt(targetWord, userSentence, theme), apiKey);
  return normalizeResult(raw, targetWord);
}

module.exports = { evaluateSentence, normalizeResult, normalizeScore };