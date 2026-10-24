const dns = require('dns').promises;
const { URL } = require('url');

/**
 * 校验 URL 是否合法且不属于私有或本地回环网络 (SSRF 防御)
 * @param {string} urlString 
 * @returns {Promise<boolean>}
 */
async function validateUrl(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }

    const hostname = parsedUrl.hostname;
    // 基础回环域名检查
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }

    // 解析 DNS 获取目标真实 IP
    const lookup = await dns.lookup(hostname);
    const address = lookup.address;

    // 检查 IPv4 私有网段 (RFC 1918) 以及回环、本地链路
    const ipv4PrivateRegex = /^(127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|0\.|169\.254\.)/;
    if (ipv4PrivateRegex.test(address)) {
      return false;
    }

    // 检查 IPv6 私有/回环/本地链路
    if (address === '::1' || address.startsWith('fe80:') || address.startsWith('fc00:') || address.startsWith('fd00:')) {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { validateUrl };
