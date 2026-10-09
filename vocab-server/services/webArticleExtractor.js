const https = require('https');
const http = require('http');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');
const { validateUrl } = require('./urlValidator');
const { sanitizeMarkdown } = require('./markdownSanitizer');

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_HTML_RESPONSE_BYTES = 10 * 1024 * 1024;

function postJson(urlString, headers, body, insecureTls, maxBytes = MAX_HTML_RESPONSE_BYTES) {
  const parsed = new URL(urlString);
  const isHttps = parsed.protocol === 'https:';
  const payload = Buffer.from(body, 'utf8');
  const transport = isHttps ? https : http;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      callback(value);
    };
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
      res.on('error', (error) => finish(reject, error));
      res.on('end', () => finish(resolve, { status: res.statusCode || 0, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', (error) => finish(reject, error));
    const deadline = setTimeout(() => req.destroy(new Error('ETIMEDOUT')), REQUEST_TIMEOUT_MS);
    req.end(payload);
  });
}

async function postJsonWithRetry(urlString, headers, body, insecureTls, maxBytes, deps = {}) {
  const post = deps.post || postJson;
  const now = deps.now || Date.now;
  const log = deps.log || console.info;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const startedAt = now();
    log(`[AOW HTML] attempt=${attempt} started timeoutMs=${REQUEST_TIMEOUT_MS}`);
    try {
      const response = await post(urlString, headers, body, insecureTls, maxBytes);
      const bytes = Buffer.byteLength(response.text || '', 'utf8');
      if (response.status < 200 || response.status >= 300) {
        const error = new Error(`AOW HTML crawl failed: ${response.status} - ${response.text.substring(0, 500)}`);
        error.status = response.status;
        error.bytes = bytes;
        throw error;
      }
      log(`[AOW HTML] attempt=${attempt} success elapsedMs=${now() - startedAt} status=${response.status} bytes=${bytes}`);
      return response;
    } catch (error) {
      log(`[AOW HTML] attempt=${attempt} failed elapsedMs=${now() - startedAt} status=${error.status || 0} bytes=${error.bytes || 0} error=${error.message}`);
      if (attempt === 2 || !/ETIMEDOUT|ECONNRESET|ENOTFOUND|ECONNREFUSED|ENETUNREACH|EAI_AGAIN/i.test(error.message)) throw error;
    }
  }
  throw new Error('AOW HTML request failed');
}

const END_SECTION_PATTERN = /^(?:#{1,6}\s*)?(?:up next|related (?:stories|articles|content)|recommended(?: articles| content| for you)?|you may also like|most popular(?: news| opinion)?|further reading|more from|reader comments?|comments?|join the conversation|videos?|choose your .*subscription|continue reading|footer links|content frame|相关推荐|推荐阅读|热门(?:新闻|文章)?|评论|参与讨论|更多内容|页脚)\s*[:.!：。]?$/i;
const DROP_LINE_PATTERN = /^(?:skip to(?: main content|\.\.\.)?|advertisement|sponsored content|listen|\(\d+\s+min\)|copyright\s+©?|©\s*\d{4}|this copy is for your personal|an error has occurred|already a subscriber\?|subscribe now|sign in|continue to checkout|you can cancel anytime|跳至正文|广告|赞助内容|版权|订阅|登录)\b/i;

function extractArticleFromMarkdown(markdown, fallbackTitle = 'Untitled web page') {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const titleIndex = lines.findIndex((line) => /^#\s+\S/.test(line.trim()));
  if (titleIndex < 0) throw new Error('Article title not found in Markdown');
  const title = lines[titleIndex].trim().replace(/^#\s+/, '').trim() || fallbackTitle;
  const kept = [`# ${title}`];
  let substantiveLines = 0;
  for (const rawLine of lines.slice(titleIndex + 1)) {
    const line = rawLine.trim();
    if (substantiveLines > 0 && END_SECTION_PATTERN.test(line)) break;
    if (DROP_LINE_PATTERN.test(line)) continue;
    if (/^https?:\/\/\S+$/.test(line) || /^\* \*$/.test(line)) continue;
    kept.push(rawLine.trimEnd());
    if (line && !/^#{1,6}\s/.test(line) && !/^By$/i.test(line) && !/^!\[/.test(line)) substantiveLines++;
  }
  const cleaned = sanitizeMarkdown(kept.join('\n'));
  if (substantiveLines < 1 || cleaned.length < title.length + 20) {
    throw new Error('Article body not found in Markdown');
  }
  return { success: true, title, markdown: cleaned, length: cleaned.length };
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
  return extractArticleFromMarkdown(markdown, title);
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

module.exports = { fetchAndExtractWebArticle, extractArticle, extractArticleFromMarkdown, postJson, postJsonWithRetry, REQUEST_TIMEOUT_MS };
