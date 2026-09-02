const https = require('https');
const http = require('http');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');
const { validateUrl } = require('./urlValidator');
const { sanitizeMarkdown } = require('./markdownSanitizer');

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_HTML_RESPONSE_BYTES = 10 * 1024 * 1024;

function postJson(urlString, headers, body, insecureTls, maxBytes = MAX_HTML_RESPONSE_BYTES) {
  const parsed = new URL(urlString);
  const isHttps = parsed.protocol === 'https:';
  const payload = Buffer.from(body, 'utf8');
  const transport = isHttps ? https : http;
  return new Promise((resolve, reject) => {
    const req = transport.request({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': payload.length },
      ...(isHttps && insecureTls ? { rejectUnauthorized: false } : {}),
    }, (res) => {
      const chunks = [];
      let received = 0;
      res.on('data', (chunk) => {
        received += chunk.length;
        if (received > maxBytes) {
          res.destroy(new Error(`AOW HTML response exceeds ${maxBytes} bytes`));
          return;
        }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('ETIMEDOUT')));
    req.end(payload);
  });
}

async function postJsonWithRetry(...args) {
  try {
    return await postJson(...args);
  } catch (error) {
    if (!/ETIMEDOUT|ECONNRESET|ENOTFOUND|ECONNREFUSED|ENETUNREACH|EAI_AGAIN/i.test(error.message)) throw error;
    return postJson(...args);
  }
}

function extractArticle(html, urlString) {
  const dom = new JSDOM(html, { url: urlString });
  const article = new Readability(dom.window.document).parse();
  dom.window.close();
  if (!article?.content || !article.textContent?.trim()) {
    throw new Error('Readability found no article content');
  }
  const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
  turndown.remove(['script', 'style', 'noscript', 'iframe', 'form']);
  const body = sanitizeMarkdown(turndown.turndown(article.content));
  if (!body) throw new Error('Readability found no article content');
  const title = String(article.title || 'Untitled web page').trim();
  const markdown = body.match(/^#\s+/) ? body : `# ${title}\n\n${body}`;
  return { success: true, title, markdown, length: markdown.length };
}

async function fetchAndExtractWebArticle(urlString, deps = {}) {
  const validate = deps.validateUrl || validateUrl;
  if (!await validate(urlString)) {
    throw new Error('Web fetch failed: invalid URL or restricted network address');
  }
  const apiKey = process.env.AOW_CRAWL_API_KEY;
  if (!apiKey) throw new Error('Server missing AOW_CRAWL_API_KEY');
  const endpoint = process.env.AOW_CRAWL_ENDPOINT || 'https://aow2.234124123.xyz/aow/crawl';
  const insecureTls = /^(1|true)$/i.test(process.env.AOW_CRAWL_INSECURE_TLS || '')
    || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(new URL(endpoint).hostname);
  const post = deps.postJsonWithRetry || postJsonWithRetry;
  const response = await post(endpoint, {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }, JSON.stringify({ url: urlString, format: 'html' }), insecureTls);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`AOW HTML crawl failed: ${response.status} - ${response.text.substring(0, 500)}`);
  }
  let data;
  try {
    data = JSON.parse(response.text || '{}');
  } catch {
    throw new Error(`AOW HTML crawl returned non-JSON: ${response.text.substring(0, 200)}`);
  }
  if (typeof data.html !== 'string' || !data.html.trim()) {
    throw new Error('AOW HTML crawl returned no HTML');
  }
  return extractArticle(data.html, urlString);
}

module.exports = { fetchAndExtractWebArticle, extractArticle, postJson };
