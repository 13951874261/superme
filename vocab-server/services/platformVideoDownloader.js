const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const youtubedl = require('youtube-dl-exec');
const { getYoutubeProxy, getYoutubeCookiesFile } = require('./youtubeRuntimeConfig');

const TMP_VIDEO_DIR = process.env.TMP_VIDEO_DIR || path.join(__dirname, '../public/temp_videos');
const BROWSER_UA = process.env.YTDLP_BROWSER_UA
  || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const PLATFORM_RULES = [
  {
    id: 'youtube',
    label: 'YouTube',
    test: (hostname) => (
      hostname === 'youtu.be'
      || hostname.endsWith('youtube.com')
      || hostname.endsWith('youtube-nocookie.com')
    ),
  },
  {
    id: 'bilibili',
    label: '哔哩哔哩',
    test: (hostname) => (
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
  for (const rule of PLATFORM_RULES) {
    if (rule.test(hostname, parsed.pathname || '')) {
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

function extractBvid(urlString) {
  const parsed = parseHttpUrl(urlString);
  if (!parsed) return null;
  const fromPath = parsed.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/i);
  if (fromPath) return fromPath[1];
  const fromQuery = parsed.searchParams.get('bvid');
  return fromQuery && /^BV[0-9A-Za-z]+$/i.test(fromQuery) ? fromQuery : null;
}

function extractYoutubeId(urlString) {
  const parsed = parseHttpUrl(urlString);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be') {
    return parsed.pathname.replace(/^\//, '').split('/')[0] || null;
  }
  const v = parsed.searchParams.get('v');
  if (v) return v;
  const shorts = parsed.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/);
  return shorts ? shorts[1] : null;
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
  const prefixes = [`platform_audio_${taskId}`, `platform_cookies_${taskId}`];
  for (const name of fs.readdirSync(TMP_VIDEO_DIR)) {
    if (prefixes.some((prefix) => name.startsWith(prefix))) {
      try {
        fs.unlinkSync(path.join(TMP_VIDEO_DIR, name));
      } catch (_) {
        // ignore cleanup errors
      }
    }
  }
}

function ensureYtDlpExecutable() {
  try {
    const binaryPath = path.join(
      path.dirname(require.resolve('youtube-dl-exec')),
      'bin',
      process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp',
    );
    if (fs.existsSync(binaryPath)) {
      fs.chmodSync(binaryPath, 0o755);
    }
  } catch (_) {
    // ignore chmod errors
  }
}

function resolveYtDlpJsRuntime() {
  const fromEnv = String(process.env.YTDLP_JS_RUNTIME || '').trim();
  if (fromEnv) return fromEnv;

  const home = process.env.HOME || process.env.USERPROFILE || '';
  const candidates = [
    path.join(home, '.deno', 'bin', process.platform === 'win32' ? 'deno.exe' : 'deno'),
    '/home/ubuntu/.deno/bin/deno',
    '/usr/local/bin/deno',
    '/usr/bin/deno',
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return `deno:${candidate}`;
    }
  }
  return null;
}

function runCurl(args, { timeoutMs = 30000, maxBuffer = 8 * 1024 * 1024 } = {}) {
  return execFileSync('curl', args, {
    timeout: timeoutMs,
    maxBuffer,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function listCandidateProxies() {
  const fromEnv = getYoutubeProxy();
  const extras = [
    'http://127.0.0.1:17897',
    'socks5h://127.0.0.1:17897',
    'socks5h://127.0.0.1:40000',
    'socks5://127.0.0.1:40000',
    'http://127.0.0.1:7897',
    'socks5h://127.0.0.1:10808',
    'socks5://127.0.0.1:10808',
    'http://127.0.0.1:1080',
    'socks5h://127.0.0.1:1080',
  ];
  return [...new Set([fromEnv, ...extras].filter(Boolean))];
}

function resolveRedirectUrl(url) {
  try {
    const out = runCurl(['-Ls', '-o', '/dev/null', '-w', '%{url_effective}', '--max-time', '20', url]);
    const resolved = String(out || '').trim();
    return resolved || url;
  } catch (_) {
    return url;
  }
}

function warmupBilibiliCookies(pageUrl, taskId) {
  const cookiePath = path.join(TMP_VIDEO_DIR, `platform_cookies_${taskId}.txt`);
  // 默认 curl UA 才能拿到 200；带浏览器/伪造 curl UA 会 412
  runCurl(['-s', '-c', cookiePath, '-o', '/dev/null', '--max-time', '20', pageUrl]);
  return cookiePath;
}

function curlJson(url, { cookies, referer } = {}) {
  const args = ['-sS', '--max-time', '30', '-A', BROWSER_UA];
  if (referer) args.push('-e', referer);
  if (cookies) args.push('-b', cookies, '-c', cookies);
  args.push(url);
  const raw = runCurl(args);
  return JSON.parse(String(raw));
}

function pickDashAudio(playData) {
  const audios = playData?.dash?.audio;
  if (!Array.isArray(audios) || audios.length === 0) return null;
  const sorted = [...audios].sort((a, b) => (Number(b.bandwidth) || 0) - (Number(a.bandwidth) || 0));
  const best = sorted[0];
  return best.baseUrl || best.base_url || (Array.isArray(best.backupUrl) ? best.backupUrl[0] : null);
}

function downloadHttpFile(url, destPath, { cookies } = {}) {
  runCurl(
    [
      '-L', '--fail', '--max-time', '600',
      '-A', BROWSER_UA,
      '-H', 'Referer: https://www.bilibili.com/',
      '-H', 'Origin: https://www.bilibili.com',
      ...(cookies ? ['-b', cookies, '-c', cookies] : []),
      '-o', destPath,
      url,
    ],
    { timeoutMs: 10 * 60 * 1000 },
  );
}

async function downloadBilibiliAudio(url, taskId, maxMb) {
  const pageUrl = resolveRedirectUrl(url);
  const bvid = extractBvid(pageUrl) || extractBvid(url);
  if (!bvid) {
    throw new Error('无法从哔哩哔哩链接解析 BV 号');
  }

  const cookies = warmupBilibiliCookies(`https://www.bilibili.com/video/${bvid}/`, taskId);
  const view = curlJson(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
    { cookies, referer: 'https://www.bilibili.com/' },
  );
  if (view.code !== 0 || !view.data?.cid) {
    throw new Error(`哔哩哔哩接口返回异常: ${view.message || view.code || 'unknown'}`);
  }

  const cid = view.data.cid;
  const play = curlJson(
    `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(cid)}&fnval=16&qn=0&fourk=1`,
    { cookies, referer: 'https://www.bilibili.com/' },
  );
  if (play.code !== 0) {
    throw new Error(`哔哩哔哩播放地址获取失败: ${play.message || play.code || 'unknown'}`);
  }

  const audioUrl = pickDashAudio(play.data);
  if (!audioUrl) {
    throw new Error('哔哩哔哩未返回可用音频流');
  }

  const destPath = path.join(TMP_VIDEO_DIR, `platform_audio_${taskId}.m4a`);
  downloadHttpFile(audioUrl, destPath, { cookies });

  const maxBytes = (Number(maxMb) || 200) * 1024 * 1024;
  const stats = fs.statSync(destPath);
  if (stats.size > maxBytes) {
    throw new Error(`音频文件过大，超出系统限制 (${maxMb}MB)`);
  }
  if (stats.size < 1024) {
    throw new Error('哔哩哔哩音频下载结果过小，可能被风控拦截');
  }
  return destPath;
}

function buildYtDlpOptions(url, taskId, rule, maxFilesize, proxy) {
  const outputTemplate = path.join(TMP_VIDEO_DIR, `platform_audio_${taskId}.%(ext)s`);
  const options = {
    extractAudio: true,
    audioFormat: 'mp3',
    audioQuality: 0,
    output: outputTemplate,
    noPlaylist: true,
    maxFilesize,
    noWarnings: true,
    preferFreeFormats: true,
    forceIpv4: true,
    socketTimeout: 30,
    retries: 3,
  };

  const jsRuntime = resolveYtDlpJsRuntime();
  if (jsRuntime) options.jsRuntimes = jsRuntime;

  if (proxy) options.proxy = proxy;

  const cookiesFile = String(getYoutubeCookiesFile() || '').trim();
  if (cookiesFile && fs.existsSync(cookiesFile)) {
    options.cookies = cookiesFile;
  }

  return options;
}

function isNetworkBlocked(message) {
  return /network is unreachable|host unreachable|errno 101|errno 4|proxyerror|timed out|timeout|connection refused|und_err_connect/i.test(message);
}

function mapPlatformDownloadError(rule, message) {
  if (isNetworkBlocked(message)) {
    if (rule.id === 'youtube') {
      return `${rule.label} 在当前服务器网络环境下不可达，请配置 YTDLP_PROXY 后重试`;
    }
    return `${rule.label} 网络不可达，请稍后重试`;
  }
  if (/412|precondition failed/i.test(message) && rule.id === 'bilibili') {
    return `${rule.label} 触发风控校验，请稍后重试；若持续失败可配置 YTDLP_COOKIES_FILE`;
  }
  if (/private|login|sign in|members only|age|geo|region|blocked|403|not a bot/i.test(message)) {
    if (rule.id === 'youtube') {
      return `${rule.label} 触发人机校验，需要已登录账号的 Netscape cookies。请把 cookies.txt 放到服务器并设置 YTDLP_COOKIES_FILE 后重试`;
    }
    return `${rule.label} 视频无法下载，可能需要登录、无权限或受地区限制`;
  }
  return `${rule.label} 音频下载失败，请检查链接是否有效: ${message || '未知错误'}`;
}

async function downloadWithYtDlp(url, taskId, rule, maxMb) {
  const maxFilesize = `${Math.max(1, Number(maxMb) || 200)}M`;
  const envProxy = getYoutubeProxy();
  const proxies = [];
  if (rule.id === 'youtube') {
    proxies.push(...listCandidateProxies());
    proxies.push(null);
  } else {
    if (envProxy) proxies.push(envProxy);
    proxies.push(null);
  }

  let lastMessage = '';
  for (const proxy of [...new Set(proxies)]) {
    cleanupPlatformArtifacts(taskId);
    try {
      await youtubedl(url, buildYtDlpOptions(url, taskId, rule, maxFilesize, proxy));
      const downloadedPath = findDownloadedAudio(taskId);
      if (!downloadedPath) {
        throw new Error('未生成输出文件');
      }
      return downloadedPath;
    } catch (err) {
      lastMessage = String(err?.stderr || err?.message || err || '').trim();
      if (!isNetworkBlocked(lastMessage)) {
        throw new Error(mapPlatformDownloadError(rule, lastMessage));
      }
    }
  }
  throw new Error(mapPlatformDownloadError(rule, lastMessage));
}

/**
 * 使用官方接口（B 站）或 yt-dlp（YouTube）下载音频。
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
  ensureYtDlpExecutable();

  let downloadedPath;
  try {
    if (rule.id === 'bilibili') {
      downloadedPath = await downloadBilibiliAudio(url, taskId, maxMb);
    } else {
      downloadedPath = await downloadWithYtDlp(url, taskId, rule, maxMb);
    }
  } catch (err) {
    cleanupPlatformArtifacts(taskId);
    const message = String(err?.message || err || '').trim();
    if (message.startsWith(rule.label) || message.startsWith('无法')) {
      throw err;
    }
    throw new Error(mapPlatformDownloadError(rule, message));
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
  extractBvid,
  extractYoutubeId,
};
