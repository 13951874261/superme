/**
 * GT-TAC：驭人术资料异步提炼（限额 / 解析 / 入库编排）
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const TACTICS_INGEST_MAX_MB = 200;
const TACTICS_INGEST_MAX_MINUTES = 30;
const TACTICS_INGEST_MAX_BYTES = TACTICS_INGEST_MAX_MB * 1024 * 1024;
const TACTICS_INGEST_MAX_SECONDS = TACTICS_INGEST_MAX_MINUTES * 60;

function assertWithinLimits({ sizeBytes, durationSec } = {}) {
  const size = Number(sizeBytes);
  if (Number.isFinite(size) && size > TACTICS_INGEST_MAX_BYTES) {
    return {
      ok: false,
      error: `文件超过 ${TACTICS_INGEST_MAX_MB}MB 限制`,
    };
  }
  if (durationSec != null && durationSec !== '') {
    const sec = Number(durationSec);
    if (Number.isFinite(sec) && sec > TACTICS_INGEST_MAX_SECONDS) {
      return {
        ok: false,
        error: `视频超过 ${TACTICS_INGEST_MAX_MINUTES} 分钟限制`,
      };
    }
  }
  return { ok: true };
}

function isVideoFileName(fileName) {
  return /\.(mp4|webm|mov|mkv|m4v|avi)$/i.test(String(fileName || ''));
}

function isDocFileName(fileName) {
  return /\.(pdf|txt|md|text|html|htm)$/i.test(String(fileName || ''));
}

function parseTacticsLlmJson(rawAnswer) {
  const cleanJson = String(rawAnswer || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  let tactics = [];
  try {
    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed)) tactics = parsed;
  } catch {
    const match = cleanJson.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) tactics = parsed;
      } catch {
        tactics = [];
      }
    }
  }
  return tactics
    .filter((t) => t && typeof t === 'object' && String(t.name || '').trim())
    .map((t) => ({
      name: String(t.name).trim().slice(0, 40),
      category: t.category === 'upward' ? 'upward' : 'downward',
      description: String(t.description || '').trim().slice(0, 2000),
    }));
}

function buildTacticsExtractPrompt(excerpt) {
  return `你是一位资深权术大师与博弈学家，精通商场、职场的权力博弈与人性驾驭之道。

请从下面这段书籍/材料文本中，提取出所有的"驭人手段"或"博弈技巧"，每条手段必须：
1. 有一个精炼的名称（2-6个字，如：捧杀、借刀杀人、架空、投石问路等）
2. 有一个分类：downward（用于管理/驾驭下属或博弈中控制局面的主动手段）或 upward（用于应对、突破或反制上级/强势一方的以弱克强之术）
3. 有一段具体详实、逻辑清晰、可借鉴的描述（100-200字，要包含手段的核心逻辑、适用场景、实施步骤或注意事项）

请输出如下格式的纯JSON数组（不要有任何说明文字或markdown标记，直接输出JSON）：
[
  {"name":"手段名称","category":"downward","description":"详细描述..."},
  {"name":"手段名称","category":"upward","description":"详细描述..."}
]

原始材料文本：
${excerpt}`;
}

function planTacticInserts(db, userId, tactics, { sourceFile, mediaId } = {}) {
  const planned = [];
  const skipped = [];
  for (const t of tactics || []) {
    if (!t || !t.name) continue;
    const existing = db.prepare(
      'SELECT id FROM game_theory_tactics WHERE user_id = ? AND name = ?'
    ).get(userId, t.name);
    if (existing) {
      skipped.push(t.name);
      continue;
    }
    planned.push({
      id: crypto.randomUUID(),
      userId,
      name: t.name,
      category: t.category || 'downward',
      description: t.description || '',
      sourceFile: sourceFile || '',
      mediaId: mediaId || null,
    });
  }
  return { planned, skipped };
}

function insertPlannedTactics(db, planned) {
  const hasMediaCol = (() => {
    try {
      const cols = db.prepare('PRAGMA table_info(game_theory_tactics)').all();
      return cols.some((c) => c.name === 'media_id');
    } catch {
      return false;
    }
  })();
  const inserted = [];
  if (hasMediaCol) {
    const stmt = db.prepare(`
      INSERT INTO game_theory_tactics (id, user_id, name, category, description, is_custom, source_file, media_id, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);
    for (const row of planned) {
      stmt.run(row.id, row.userId, row.name, row.category, row.description, row.sourceFile, row.mediaId, Date.now());
      inserted.push(row);
    }
  } else {
    const stmt = db.prepare(`
      INSERT INTO game_theory_tactics (id, user_id, name, category, description, is_custom, source_file, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `);
    for (const row of planned) {
      stmt.run(row.id, row.userId, row.name, row.category, row.description, row.sourceFile, Date.now());
      inserted.push(row);
    }
  }
  return inserted;
}

async function extractTextFromDocBuffer(fileName, buffer) {
  const name = String(fileName || '');
  const isPlainText = /\.(txt|md|text|html|htm)$/i.test(name);
  const isPdf = /\.pdf$/i.test(name) || (buffer.length > 4 && buffer.slice(0, 5).toString() === '%PDF-');
  if (isPlainText) return buffer.toString('utf-8');
  if (isPdf) {
    try {
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(buffer);
      return String(pdfData?.text || '').replace(/\r\n/g, '\n').trim();
    } catch (e) {
      console.warn('[tacticsIngest] PDF parse failed:', e.message);
      return '';
    }
  }
  return '';
}

function probeDurationSeconds(filePath) {
  return new Promise((resolve, reject) => {
    const cmd = `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`;
    exec(cmd, { timeout: 30000 }, (err, stdout) => {
      if (err) {
        reject(new Error('无法读取视频时长（请确认已安装 ffprobe）: ' + err.message));
        return;
      }
      const sec = parseFloat(String(stdout || '').trim());
      if (!Number.isFinite(sec) || sec <= 0) {
        reject(new Error('无法解析视频时长'));
        return;
      }
      resolve(sec);
    });
  });
}

async function callTacticsExtractLlm(excerpt, userId) {
  const baseUrl = process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  const gameApiKey = process.env.DIFY_GAME_THEORY_API_KEY || process.env.VITE_DIFY_GAME_THEORY_KEY;
  if (!gameApiKey) throw new Error('未配置博弈 LLM API Key');
  const prompt = buildTacticsExtractPrompt(excerpt);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gameApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: prompt,
        response_mode: 'blocking',
        conversation_id: '',
        user: userId || 'default-user',
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI服务暂时不可用 (${response.status}): ${errText.slice(0, 120)}`);
    }
    const data = await response.json();
    const rawAnswer = data?.answer || data?.data?.outputs?.text || '';
    return parseTacticsLlmJson(rawAnswer);
  } finally {
    clearTimeout(timeout);
  }
}

function ensureTacticsMediaDir(baseDir) {
  const dir = baseDir || path.join(__dirname, '../public/tactics_media');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = {
  TACTICS_INGEST_MAX_MB,
  TACTICS_INGEST_MAX_MINUTES,
  TACTICS_INGEST_MAX_BYTES,
  TACTICS_INGEST_MAX_SECONDS,
  assertWithinLimits,
  isVideoFileName,
  isDocFileName,
  parseTacticsLlmJson,
  buildTacticsExtractPrompt,
  planTacticInserts,
  insertPlannedTactics,
  extractTextFromDocBuffer,
  probeDurationSeconds,
  callTacticsExtractLlm,
  ensureTacticsMediaDir,
};
