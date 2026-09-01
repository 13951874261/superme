const { chatCompletions, extractAssistantContent } = require('./openaiCompatLlm');

const SYSTEM_PROMPT = `你是通用网页正文提取器。
只从输入 Markdown 中提取原文正文，保留标题、副标题、作者、日期、正文小标题、段落、引用和正文列表。
删除导航、广告、行情、推荐、登录、订阅、Cookie、分享、评论、页脚、版权菜单、重复内容及无关链接目录。
不得摘要、翻译、改写、补写、纠正事实或改变原文措辞；无法判断时保留原文。
只返回 Markdown，不要解释。`;

function defaultCallLlm({ systemPrompt, userPrompt, temperature, models }) {
  return chatCompletions({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    models,
    timeoutMs: 60000,
  }).then((data) => extractAssistantContent(data));
}

function normalizeLine(value) {
  return String(value || '').replace(/^\s{0,3}(?:#{1,6}|[-*+]|>\s*)\s*/, '').replace(/\s+/g, ' ').trim();
}

function isSafeCleanedResult(original, cleaned) {
  const source = String(original || '').trim();
  const result = String(cleaned || '').trim();
  if (!result || result.length < Math.min(240, source.length * 0.2)) return false;
  const sourceLines = new Set(source.split(/\r?\n/).map(normalizeLine).filter(Boolean));
  const resultLines = result.split(/\r?\n/).map(normalizeLine).filter(Boolean);
  return resultLines.length > 0 && resultLines.every((line) => sourceLines.has(line));
}

async function cleanWebArticleMarkdown(markdown, { callLlm = defaultCallLlm } = {}) {
  const source = String(markdown || '');
  if (!source.trim()) return source;
  try {
    const cleaned = await callLlm({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `【网页 Markdown】\n${source}`,
      temperature: 0,
      models: ['mart-paid'],
    });
    return isSafeCleanedResult(source, cleaned) ? String(cleaned).trim() : source;
  } catch (error) {
    console.warn('[Web Article Cleaner] LLM failed, preserving fetched content:', error.message);
    return source;
  }
}

module.exports = { cleanWebArticleMarkdown, isSafeCleanedResult, SYSTEM_PROMPT };
