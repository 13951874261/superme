const { Agent } = require('undici');
const { validateUrl } = require('./urlValidator');
const { sanitizeMarkdown } = require('./markdownSanitizer');

function isIpHostname(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

/**
 * Fetch webpage content and convert to Markdown.
 * @param {string} urlString
 * @returns {Promise<{success: boolean, title: string, markdown: string, length: number}>}
 */
async function fetchUrlContent(urlString) {
  const isValid = await validateUrl(urlString);
  if (!isValid) {
    throw new Error('Web fetch failed: invalid URL or restricted network address');
  }

  const apiKey = process.env.DIFY_FETCH_API_KEY || 'sk-899c9c34738f61b5-2u53op-6ed8a313';
  const endpointBase = (process.env.FETCH_ENDPOINT_BASE || 'https://23.95.214.232/v1').replace(/\/$/, '');
  const fetchUrl = `${endpointBase}/web/fetch`;
  const hostname = new URL(fetchUrl).hostname;
  // IP hosts (e.g. 23.95.214.232) present a cert for 9router.234124123.xyz only.
  // Match IMAGE_GEN / TTS: skip TLS name check for IP or when FETCH_INSECURE_TLS=1.
  const insecureTls = process.env.FETCH_INSECURE_TLS === '1'
    || process.env.FETCH_INSECURE_TLS === 'true'
    || isIpHostname(hostname);

  const response = await fetch(fetchUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'fetch-combo',
      url: urlString,
      format: 'markdown',
    }),
    ...(insecureTls ? { dispatcher: new Agent({ connect: { rejectUnauthorized: false } }) } : {}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Remote web fetch failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  let markdown = '';
  if (typeof data.markdown === 'string') {
    markdown = data.markdown;
  } else if (typeof data.content === 'string') {
    markdown = data.content;
  } else if (data.content && typeof data.content === 'object') {
    markdown = data.content.markdown || data.content.text || '';
  }
  if (!markdown) {
    throw new Error('Web page parsed but no readable text content was extracted');
  }

  markdown = sanitizeMarkdown(markdown);

  let title = data.title;
  if (!title) {
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    title = titleMatch ? titleMatch[1].trim() : 'Untitled web page';
  }

  return {
    success: true,
    title,
    markdown,
    length: markdown.length,
  };
}

module.exports = { fetchUrlContent };
