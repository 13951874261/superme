/**
 * 清洗 Markdown 内容，移除 Bom、Null 字符以及潜在的脚本标签安全风险
 * @param {string} content 
 * @returns {string}
 */
function sanitizeMarkdown(content) {
  if (typeof content !== 'string') return '';
  
  // 1. 移除 BOM (Byte Order Mark)
  let cleaned = content.replace(/^\uFEFF/, '');
  
  // 2. 移除 Null 字节 (\x00)
  cleaned = cleaned.replace(/\x00/g, '');
  
  // 3. 移除 <script> 标签
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 4. 移除 <iframe> 标签
  cleaned = cleaned.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // 5. 移除 inline 事件 (如 onerror, onload)
  cleaned = cleaned.replace(/on\w+\s*=\s*(['"])(.*?)\1/gi, '');
  cleaned = cleaned.replace(/on\w+\s*=\s*([^\s>]+)/gi, '');

  // 6. 移除 javascript: 协议链接
  cleaned = cleaned.replace(/javascript\s*:\s*[^)\s]*/gi, '#');
  
  return cleaned;
}

module.exports = { sanitizeMarkdown };
