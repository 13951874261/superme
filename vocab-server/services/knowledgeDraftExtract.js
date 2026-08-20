/**
 * 听模块上传 → 资料抽屉理论框架草稿（不自动同步）。
 */
const crypto = require('crypto');
const extra = require('./knowledgeVaultExtra');

const THEORY_CATEGORIES = ['game_theory', 'psychology', 'logic'];
const MAX_EXCERPT_CHARS = 6000;
const MIN_TEXT_FOR_LLM = 50;

function stripBase64(raw) {
  return String(raw || '').replace(/^data:.*?;base64,/, '');
}

function guessSourceType(fileName, mimeType) {
  const name = String(fileName || '').toLowerCase();
  const mime = String(mimeType || '').toLowerCase();
  if (
    /\.(mp4|mp3|wav|m4a|mov|webm|aac)$/i.test(name)
    || mime.startsWith('audio/')
    || mime.startsWith('video/')
  ) {
    return 'upload_video';
  }
  return 'upload_book';
}

function sanitizeCategory(value) {
  return THEORY_CATEGORIES.includes(value) ? value : 'game_theory';
}

function parseExtractedDraft(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const title = String(raw.title || '').trim().slice(0, 40);
  const summary = String(raw.summary || '').trim();
  if (!title || !summary) return null;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((tag) => typeof tag === 'string' && tag.trim()).slice(0, 8)
    : [];
  return {
    title,
    summary: summary.slice(0, 2000),
    category: sanitizeCategory(raw.category),
    tags
  };
}

function buildFallbackDraft({ fileName, sourceUrl, text }) {
  const fromName = String(fileName || '').replace(/\.[^.]+$/, '').trim();
  const title = (fromName || sourceUrl || '上传素材').slice(0, 40);
  const clipped = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const summary = clipped
    || `来自上传「${fileName || sourceUrl || '素材'}」的待提炼草稿。请在资料抽屉确认后再同步到训练。`;
  return {
    title,
    category: 'game_theory',
    summary,
    tags: ['listen_upload']
  };
}

async function extractTextFromBuffer(fileName, buffer) {
  const name = String(fileName || '');
  const isPlainText = /\.(txt|md|text|html|htm)$/i.test(name);
  const isPdf = /\.pdf$/i.test(name) || (buffer.length > 4 && buffer.slice(0, 5).toString() === '%PDF-');
  if (isPlainText) {
    return buffer.toString('utf-8');
  }
  if (isPdf) {
    try {
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(buffer);
      return String(pdfData?.text || '').replace(/\r\n/g, '\n').trim();
    } catch (err) {
      console.warn('[knowledgeDraftExtract] PDF parse failed:', err.message);
      return '';
    }
  }
  return '';
}

function extractJsonObject(text) {
  const value = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('LLM did not return JSON object');
  return JSON.parse(match[0]);
}

function callExtractLLM(excerpt, meta, apiKey) {
  const https = require('https');
  const llmUrl = process.env.WRITE_GOVERNANCE_LLM_URL || 'https://23.95.214.232/v1/chat/completions';
  const systemPrompt = [
    '你是政商务洞察教练。请把材料提炼成资料抽屉「理论框架」草稿。',
    '必须返回严格 JSON，禁止 Markdown 代码块和额外说明。',
    '字段：title（不超过20字）、category（game_theory|psychology|logic）、summary（80-300字）、tags（字符串数组，最多8个）。',
  ].join('\n');
  const userPrompt = [
    meta && meta.fileName ? `【文件名】${meta.fileName}` : '',
    meta && meta.sourceUrl ? `【来源网址】${meta.sourceUrl}` : '',
    '【材料摘录】',
    excerpt,
  ].filter(Boolean).join('\n');

  const requestBody = JSON.stringify({
    model: 'dify',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    stream: false,
  });

  return new Promise((resolve, reject) => {
    const request = https.request(llmUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
      rejectUnauthorized: false,
    }, (response) => {
      let raw = '';
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error('LLM HTTP ' + response.statusCode + ': ' + raw.slice(0, 200)));
          return;
        }
        try {
          const payload = JSON.parse(raw);
          const content = String(payload?.choices?.[0]?.message?.content || '');
          const parsed = parseExtractedDraft(extractJsonObject(content));
          if (!parsed) reject(new Error('LLM draft missing title/summary'));
          else resolve(parsed);
        } catch (error) {
          reject(new Error('LLM parse failed: ' + error.message));
        }
      });
    });
    request.setTimeout(45000, () => request.destroy(new Error('LLM timeout')));
    request.on('error', reject);
    request.write(requestBody);
    request.end();
  });
}

function insertTheoryDraft(db, params) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const sourceValue = params.source || 'listen_upload';
  const extraJson = extra.buildKnowledgeVaultExtra('{}', {
    moduleTargets: [],
    sourceType: params.sourceType || 'upload_book',
    sourceRef: params.sourceRef || '',
    syncStatus: 'draft',
    confirmedAt: null,
    difficulty: params.difficulty,
    refineStatus: params.refineStatus,
    usageCount: params.usageCount,
    lastRefineUsage: params.lastRefineUsage,
    mindmap: params.mindmap,
  }, sourceValue);
  const tagList = Array.isArray(params.tags) ? params.tags : [];
  db.prepare(`
    INSERT INTO knowledge_vault (id, user_id, type, word, meaning, example, title, category, summary, content, source, added_at, tags, extra_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.userId,
    'theory',
    '',
    '',
    '',
    params.title || '',
    sanitizeCategory(params.category),
    params.summary || '',
    params.content || params.summary || '',
    sourceValue,
    now,
    JSON.stringify(tagList),
    JSON.stringify(extraJson)
  );
  const row = db.prepare('SELECT * FROM knowledge_vault WHERE id = ?').get(id);
  return extra.formatKnowledgeVaultRow(row);
}

async function createListenUploadDraft(db, input, deps = {}) {
  const userId = input && input.userId;
  if (!userId) throw new Error('userId required');
  const fileName = String((input && input.fileName) || '').trim();
  const sourceUrl = String((input && input.sourceUrl) || '').trim();
  const base64Content = input && input.base64Content;
  if (!base64Content && !sourceUrl) throw new Error('file or sourceUrl required');

  const sourceType = guessSourceType(fileName, input && input.mimeType);
  const sourceRef = {};
  if (fileName) sourceRef.fileName = fileName;
  if (sourceUrl) sourceRef.sourceUrl = sourceUrl;

  let text = '';
  if (base64Content) {
    const buffer = Buffer.from(stripBase64(base64Content), 'base64');
    const extractText = deps.extractTextFromBuffer || extractTextFromBuffer;
    text = await extractText(fileName, buffer);
  } else if (sourceUrl) {
    const fetchUrl = deps.fetchUrlContent || (async (url) => {
      const { fetchUrlContent } = require('./webFetcher');
      const result = await fetchUrlContent(url);
      return result.markdown || '';
    });
    try {
      text = await fetchUrl(sourceUrl);
    } catch (err) {
      console.warn('[knowledgeDraftExtract] fetchUrl failed:', err.message);
      text = '';
    }
  }

  const fallback = buildFallbackDraft({ fileName, sourceUrl, text });
  let draft = fallback;
  let extracted = false;
  const excerpt = text.length > MAX_EXCERPT_CHARS ? text.slice(0, MAX_EXCERPT_CHARS) : text;
  const apiKey = process.env.LISTEN_LLM_API_KEY || '';
  if (excerpt.length >= MIN_TEXT_FOR_LLM) {
    try {
      const extractWithLLM = deps.extractWithLLM || ((body, meta) => {
        if (!apiKey) throw new Error('LISTEN_LLM_API_KEY missing');
        return callExtractLLM(body, meta, apiKey);
      });
      const parsed = await extractWithLLM(excerpt, { fileName, sourceUrl });
      if (parsed) {
        draft = {
          title: parsed.title,
          category: parsed.category,
          summary: parsed.summary,
          tags: parsed.tags && parsed.tags.length ? parsed.tags : fallback.tags
        };
        extracted = true;
      }
    } catch (err) {
      console.warn('[knowledgeDraftExtract] LLM extract failed, using fallback:', err.message);
    }
  }

  const row = insertTheoryDraft(db, {
    userId,
    title: draft.title,
    category: draft.category,
    summary: draft.summary,
    content: draft.summary,
    tags: draft.tags,
    source: fileName || sourceUrl || 'listen_upload',
    sourceType,
    sourceRef
  });

  return { row, extracted, draft };
}

module.exports = {
  THEORY_CATEGORIES,
  guessSourceType,
  parseExtractedDraft,
  buildFallbackDraft,
  extractTextFromBuffer,
  insertTheoryDraft,
  createListenUploadDraft
};
