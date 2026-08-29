const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../config/youtube.runtime.json');
const SECRETS_DIR = path.join(__dirname, '../secrets');
const DEFAULT_COOKIES_FILE = path.join(SECRETS_DIR, 'youtube.cookies.txt');

function readConfigFile() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (_) {
    // ignore invalid json
  }
  return {};
}

function getYoutubeProxy() {
  const file = readConfigFile();
  return String(file.proxy || process.env.YTDLP_PROXY || '').trim();
}

function getYoutubeCookiesFile() {
  const file = readConfigFile();
  const fromFile = String(file.cookiesFile || '').trim();
  const fromEnv = String(process.env.YTDLP_COOKIES_FILE || '').trim();
  return fromFile || fromEnv || DEFAULT_COOKIES_FILE;
}

function getTunnelHint() {
  const file = readConfigFile();
  const tunnel = file.tunnel || {};
  const localPort = Number(tunnel.localProxyPort) || 7897;
  const remotePort = Number(tunnel.remoteBindPort) || 17897;
  const sshHost = String(tunnel.sshHost || process.env.YTDLP_TUNNEL_SSH_HOST || 'ubuntu@150.158.34.217').trim();
  return {
    localProxy: `127.0.0.1:${localPort}`,
    remoteProxy: `http://127.0.0.1:${remotePort}`,
    sshHost,
    command: `plink -N -R ${remotePort}:127.0.0.1:${localPort} ${sshHost}`,
    steps: [
      `在本机启动 Clash（或其它代理），确保 HTTP 代理监听 ${localPort}`,
      `在 PowerShell 执行反向隧道命令（保持窗口不要关闭）`,
      `在下方配置服务器代理地址为 ${`http://127.0.0.1:${remotePort}`} 并上传有效 YouTube cookies`,
      '点击「检测就绪」确认三项均为绿色后再提交 YouTube 链接',
    ],
  };
}

function saveConfig(partial) {
  const current = readConfigFile();
  const next = { ...current, ...partial };
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function ensureSecretsDir() {
  if (!fs.existsSync(SECRETS_DIR)) {
    fs.mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
  }
}

module.exports = {
  CONFIG_PATH,
  SECRETS_DIR,
  DEFAULT_COOKIES_FILE,
  getYoutubeProxy,
  getYoutubeCookiesFile,
  getTunnelHint,
  saveConfig,
  ensureSecretsDir,
};
