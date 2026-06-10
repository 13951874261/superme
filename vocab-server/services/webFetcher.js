const { validateUrl } = require('./urlValidator');
const { sanitizeMarkdown } = require('./markdownSanitizer');

/**
 * 抓取网页内容并转换为 Markdown
 * @param {string} urlString 
 * @returns {Promise<{title: string, markdown: string, length: number}>}
 */
async function fetchUrlContent(urlString) {
  // 1. SSRF 校验
  const isValid = await validateUrl(urlString);
  if (!isValid) {
    throw new Error('网页抓取失败：目标 URL 格式非法或属于受限的网络地址');
  }

  const apiKey = process.env.DIFY_FETCH_API_KEY || 'sk-899c9c34738f61b5-2u53op-6ed8a313'; // 默认回落到公共 Key
  const endpointBase = process.env.FETCH_ENDPOINT_BASE || 'https://9router.234124123.xyz/v1';

  // 2. 调用 Dify Fetch 代理 API
  const response = await fetch(`${endpointBase}/web/fetch`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'fetch-combo',
      url: urlString,
      format: 'markdown'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`远程网页提取服务异常: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  // 3. 数据解析与清洗
  let markdown = data.markdown || data.content || '';
  if (!markdown) {
    throw new Error('网页解析成功，但未能在目标网页中提取出有效文本内容');
  }

  // 清洗 Markdown
  markdown = sanitizeMarkdown(markdown);

  // 4. 提取标题
  let title = data.title;
  if (!title) {
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    title = titleMatch ? titleMatch[1].trim() : '未命名网页材料';
  }

  return {
    success: true,
    title,
    markdown,
    length: markdown.length
  };
}

module.exports = { fetchUrlContent };
