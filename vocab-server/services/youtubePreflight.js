const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  getYoutubeProxy,
  getYoutubeCookiesFile,
  getTunnelHint,
} = require('./youtubeRuntimeConfig');

const PROBE_VIDEO_ID = 'YoBc3zII7lg';

function parseCookieNames(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const names = new Set();
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length >= 6 && parts[5]) names.add(parts[5]);
  }
  return [...names];
}

function checkProxy(proxy) {
  if (!proxy) {
    return { ok: false, configured: '', message: '未配置服务器代理（YTDLP_PROXY）' };
  }
  try {
    const out = execFileSync('curl', [
      '-sS', '--max-time', '12', '-x', proxy,
      '-o', process.platform === 'win32' ? 'NUL' : '/dev/null',
      '-w', '%{http_code}',
      'https://www.youtube.com',
    ], { encoding: 'utf8', timeout: 15000 });
    const code = String(out).trim();
    const ok = ['200', '301', '302'].includes(code);
    return {
      ok,
      configured: proxy,
      httpCode: code,
      message: ok
        ? '服务器经代理可访问 YouTube（隧道/代理正常）'
        : `服务器经代理无法访问 YouTube（HTTP ${code || '失败'}），请检查本机 Clash 与 plink 反向隧道`,
    };
  } catch (err) {
    return {
      ok: false,
      configured: proxy,
      message: `代理检测失败：${String(err.message || err).trim()}`,
    };
  }
}

function checkCookies(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      path: filePath,
      hasLoginInfo: false,
      ageDays: null,
      cookieCount: 0,
      message: '未找到 cookies 文件，请上传 Netscape 格式 youtube.cookies.txt',
    };
  }
  const stat = fs.statSync(filePath);
  const ageMs = Date.now() - stat.mtimeMs;
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  const names = parseCookieNames(filePath);
  const hasLoginInfo = names.includes('LOGIN_INFO');
  const ok = hasLoginInfo && stat.size > 20;
  let message = ok
    ? `cookies 有效（含 LOGIN_INFO，${names.length} 项，${ageDays} 天前更新）`
    : 'cookies 无效或缺少 LOGIN_INFO，请重新导出并上传';
  if (ok && ageDays >= 12) {
    message += '；建议 2 周内刷新 cookies';
  }
  return {
    ok,
    path: filePath,
    hasLoginInfo,
    ageDays,
    cookieCount: names.length,
    message,
  };
}

function checkDownloadProbe({ proxy, cookiesFile }) {
  try {
    const ytdlp = path.join(
      path.dirname(require.resolve('youtube-dl-exec')),
      'bin',
      process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp',
    );
    if (!fs.existsSync(ytdlp)) {
      return { ok: false, skipped: true, message: 'yt-dlp 二进制不可用，已跳过下载探针' };
    }
    const args = [
      '--simulate', '--no-warnings',
      '--proxy', proxy,
      '--cookies', cookiesFile,
      `https://www.youtube.com/watch?v=${PROBE_VIDEO_ID}`,
    ];
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const deno = path.join(home, '.deno', 'bin', process.platform === 'win32' ? 'deno.exe' : 'deno');
    if (fs.existsSync(deno)) {
      args.push('--js-runtimes', `deno:${deno}`);
    }
    execFileSync(ytdlp, args, { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, skipped: false, message: 'yt-dlp 探针通过，可解析 YouTube 音频' };
  } catch (err) {
    const detail = String(err.stderr || err.message || err).trim().slice(0, 240);
    return {
      ok: false,
      skipped: false,
      message: `yt-dlp 探针失败：${detail || '未知错误'}`,
    };
  }
}

function runYoutubePreflight({ probe = false } = {}) {
  const proxy = getYoutubeProxy();
  const cookiesFile = getYoutubeCookiesFile();
  const proxyCheck = checkProxy(proxy);
  const cookiesCheck = checkCookies(cookiesFile);
  let downloadProbe = { ok: true, skipped: true, message: '未执行下载探针（仅检测代理与 cookies）' };

  if (probe && proxyCheck.ok && cookiesCheck.ok) {
    downloadProbe = checkDownloadProbe({ proxy, cookiesFile });
  }

  const ready = proxyCheck.ok
    && cookiesCheck.ok
    && (downloadProbe.skipped || downloadProbe.ok);

  return {
    success: true,
    ready,
    checks: {
      proxy: proxyCheck,
      cookies: cookiesCheck,
      downloadProbe,
    },
    tunnel: getTunnelHint(),
    configured: {
      proxy,
      cookiesFile,
    },
  };
}

module.exports = {
  runYoutubePreflight,
  checkProxy,
  checkCookies,
};
