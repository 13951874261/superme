const fs = require('fs');
const path = require('path');
const youtubedl = require('youtube-dl-exec');

const TMP_VIDEO_DIR = process.env.TMP_VIDEO_DIR || path.join(__dirname, '../public/temp_videos');

const PLATFORM_RULES = [
  {
    id: 'youtube',
    label: 'YouTube',
    test: (hostname, pathname) => (
      hostname === 'youtu.be'
      || hostname.endsWith('youtube.com')
      || hostname.endsWith('youtube-nocookie.com')
    ),
  },
  {
    id: 'bilibili',
    label: '哔哩哔哩',
    test: (hostname, pathname) => (
      hostname.endsWith('bilibili.com')
      || hostname === 'b23.tv'
    ),
  },
];

function parseHttpUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}

function matchPlatformRule(urlString) {
  const parsed = parseHttpUrl(urlString);
  if (!parsed) return null;

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const pathname = parsed.pathname || '';

  for (const rule of PLATFORM_RULES) {
    if (rule.test(hostname, pathname)) {
      return rule;
    }
  }
  return null;
}

function isPlatformVideoUrl(urlString) {
  return Boolean(matchPlatformRule(String(urlString || '').trim()));
}

function getPlatformLabel(urlString) {
  return matchPlatformRule(String(urlString || '').trim())?.label || '平台视频';
}

function findDownloadedAudio(taskId) {
  if (!fs.existsSync(TMP_VIDEO_DIR)) {
    return null;
  }
  const prefix = `platform_audio_${taskId}`;
  const candidates = fs.readdirSync(TMP_VIDEO_DIR)
    .filter((name) => name.startsWith(prefix))
    .map((name) => path.join(TMP_VIDEO_DIR, name))
    .filter((filePath) => fs.existsSync(filePath) && fs.statSync(filePath).isFile())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  return candidates[0] || null;
}

function cleanupPlatformArtifacts(taskId) {
  if (!fs.existsSync(TMP_VIDEO_DIR)) return;
  const prefix = `platform_audio_${taskId}`;
  for (const name of fs.readdirSync(TMP_VIDEO_DIR)) {
    if (name.startsWith(prefix)) {
      try {
        fs.unlinkSync(path.join(TMP_VIDEO_DIR, name));
      } catch (_) {
        // ignore cleanup errors
      }
    }
  }
}

/**
 * 使用 yt-dlp（youtube-dl-exec）从 YouTube / Bilibili 等平台下载音频。
 * @returns {Promise<string>} 下载后的本地音频文件路径
 */
async function downloadAudioFromPlatformUrl(urlString, taskId, { maxMb = 200 } = {}) {
  const url = String(urlString || '').trim();
  const rule = matchPlatformRule(url);
  if (!rule) {
    throw new Error('无法识别该平台链接，目前仅支持 YouTube 与哔哩哔哩');
  }

  if (!fs.existsSync(TMP_VIDEO_DIR)) {
    fs.mkdirSync(TMP_VIDEO_DIR, { recursive: true });
  }

  cleanupPlatformArtifacts(taskId);

  const outputTemplate = path.join(TMP_VIDEO_DIR, `platform_audio_${taskId}.%(ext)s`);
  const maxFilesize = `${Math.max(1, Number(maxMb) || 200)}M`;

  try {
    await youtubedl(url, {
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: 0,
      output: outputTemplate,
      noPlaylist: true,
      maxFilesize,
      noWarnings: true,
      preferFreeFormats: true,
      socketTimeout: 30,
      retries: 3,
    });
  } catch (err) {
    cleanupPlatformArtifacts(taskId);
    const message = String(err?.stderr || err?.message || err || '').trim();
    if (/private|login|sign in|members only|age|geo|region|blocked/i.test(message)) {
      throw new Error(`${rule.label} 视频无法下载，可能需要登录、无权限或受地区限制`);
    }
    throw new Error(`${rule.label} 音频下载失败，请检查链接是否有效: ${message || '未知错误'}`);
  }

  const downloadedPath = findDownloadedAudio(taskId);
  if (!downloadedPath) {
    cleanupPlatformArtifacts(taskId);
    throw new Error(`${rule.label} 音频下载失败：未生成输出文件`);
  }

  const maxBytes = (Number(maxMb) || 200) * 1024 * 1024;
  const stats = fs.statSync(downloadedPath);
  if (stats.size > maxBytes) {
    cleanupPlatformArtifacts(taskId);
    throw new Error(`音频文件过大，超出系统限制 (${maxMb}MB)`);
  }

  return downloadedPath;
}

module.exports = {
  isPlatformVideoUrl,
  getPlatformLabel,
  downloadAudioFromPlatformUrl,
  cleanupPlatformArtifacts,
  matchPlatformRule,
};
