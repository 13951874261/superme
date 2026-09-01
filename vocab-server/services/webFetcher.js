const https = require('https');
const http = require('http');
const { validateUrl } = require('./urlValidator');
const { sanitizeMarkdown } = require('./markdownSanitizer');

function isIpHostname(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_COUNT = 1;

/**
 * POST JSON to upstream; supports insecure TLS for IP hosts (same pattern as IMAGE_GEN).
 * @returns {Promise<{ status: number, text: string }>}
 */
function postJson(urlString, headers, body, insecureTls) {
  const parsed = new URL(urlString);
  const isHttps = parsed.protocol === 'https:';
  const transport = isHttps ? https : http;
  const payload = Buffer.from(body, 'utf8');

  const reqOptions = {
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: 'POST',
    headers: {
      ...headers,
      'Content-Length': payload.length,
    },
    ...(isHttps && insecureTls ? { rejectUnauthorized: false } : {}),
  };

  return new Promise((resolve, reject) => {
    const req = transport.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          text: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('ETIMEDOUT'));
    });
    req.write(payload);
    req.end();
  });
}

/**
 * Retry wrapper for transient network errors.
 * @returns {Promise<{ status: number, text: string }>}
 */
async function postJsonWithRetry(urlString, headers, body, insecureTls) {
  const retryable = /ETIMEDOUT|ECONNRESET|ENOTFOUND|ECONNREFUSED|ENETUNREACH|EAI_AGAIN/i;
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
    try {
      return await postJson(urlString, headers, body, insecureTls);
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_COUNT && retryable.test(err.message)) {
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

/**
 * Fetch webpage content and convert to Markdown.
 * @param {string} urlString
 * @returns {Promise<{success: boolean, title: string, markdown: string, length: number}>}
 */
async function fetchUrlContent(urlString, deps = {}) {
  const validate = deps.validateUrl || validateUrl;
  const post = deps.postJsonWithRetry || postJsonWithRetry;
  const isValid = await validate(urlString);
  if (!isValid) {
    throw new Error('Web fetch failed: invalid URL or restricted network address');
  }

  const apiKey = process.env.DIFY_FETCH_API_KEY;
  if (!apiKey) throw new Error('Server missing DIFY_FETCH_API_KEY');
  const endpointBase = (process.env.FETCH_ENDPOINT_BASE || 'https://fetch.234124123.xyz/v1').replace(/\/$/, '');
  const fetchUrl = `${endpointBase}/web/fetch`;
  const hostname = new URL(fetchUrl).hostname;
  const insecureTls = process.env.FETCH_INSECURE_TLS === '1'
    || process.env.FETCH_INSECURE_TLS === 'true'
    || isIpHostname(hostname);

  const body = JSON.stringify({
    model: 'firecrawl',
    url: urlString,
    format: 'markdown',
    max_characters: 0,
  });

  let primaryError = null;
  let response;
  try {
    response = await post(fetchUrl, {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }, body, insecureTls);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Remote web fetch failed: ${response.status} - ${response.text}`);
    }
  } catch (error) {
    primaryError = error;
    const aowKey = process.env.AOW_CRAWL_API_KEY;
    const aowUrl = process.env.AOW_CRAWL_ENDPOINT || 'https://aow2.234124123.xyz/aow/crawl';
    if (!aowKey) throw primaryError;
    const aowHostname = new URL(aowUrl).hostname;
    const aowInsecureTls = process.env.AOW_CRAWL_INSECURE_TLS === '1'
      || process.env.AOW_CRAWL_INSECURE_TLS === 'true'
      || isIpHostname(aowHostname);
    try {
      response = await post(aowUrl, {
        Authorization: `Bearer ${aowKey}`,
        'Content-Type': 'application/json',
      }, JSON.stringify({ url: urlString }), aowInsecureTls);
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`AOW crawl failed: ${response.status} - ${response.text}`);
      }
    } catch (fallbackError) {
      throw new Error(`${primaryError.message}; AOW fallback failed: ${fallbackError.message}`);
    }
  }

  let data = {};
  try {
    data = response.text ? JSON.parse(response.text) : {};
  } catch (err) {
    throw new Error(`Remote web fetch returned non-JSON: ${response.text.substring(0, 200)}`);
  }

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
