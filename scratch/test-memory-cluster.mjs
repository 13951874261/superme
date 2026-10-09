/** Phase 3 聚类逻辑单元测试（纯函数，与 server.js 规则对齐） */

function getEpisodeText(ep) {
  return String(ep.summary || ep.preview || '').trim();
}

function normalizeClusterText(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, '');
}

function prefixSimilarity(a, b) {
  const x = normalizeClusterText(a);
  const y = normalizeClusterText(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const shorter = x.length <= y.length ? x : y;
  const longer = x.length <= y.length ? y : x;
  if (shorter.length >= 4 && longer.includes(shorter)) {
    return shorter.length / longer.length;
  }
  let i = 0;
  const minLen = Math.min(x.length, y.length);
  while (i < minLen && x[i] === y[i]) i += 1;
  const lcpScore = i === 0 ? 0 : (2 * i) / (x.length + y.length);
  let sharedScore = 0;
  for (let len = Math.min(shorter.length, 20); len >= 6; len -= 1) {
    for (let j = 0; j <= shorter.length - len; j += 1) {
      const sub = shorter.slice(j, j + len);
      if (longer.includes(sub)) {
        sharedScore = Math.max(sharedScore, (2 * len) / (x.length + y.length));
        break;
      }
    }
    if (sharedScore > 0) break;
  }
  return Math.max(lcpScore, sharedScore);
}

function episodesAreSimilar(a, b, minSim) {
  if (prefixSimilarity(a, b) >= minSim) return true;
  const x = normalizeClusterText(a);
  const y = normalizeClusterText(b);
  if (!x || !y) return false;
  const shorter = x.length <= y.length ? x : y;
  const longer = x.length <= y.length ? y : x;
  for (let len = Math.min(shorter.length, 20); len >= 6; len -= 1) {
    for (let j = 0; j <= shorter.length - len; j += 1) {
      if (longer.includes(shorter.slice(j, j + len))) return true;
    }
  }
  return false;
}

function getEpisodeClusterGroupKey(ep, windowMs) {
  const source = String(ep.source || 'unknown').trim() || 'unknown';
  const at = Number(ep.at || Date.now());
  return `${source}:${Math.floor(at / windowMs)}`;
}

function clusterEpisodesInGroup(episodes, batchSize, minSim) {
  const remaining = [...episodes].sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
  const clusters = [];
  while (remaining.length) {
    const seed = remaining.shift();
    const cluster = [seed];
    const seedText = getEpisodeText(seed);
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      if (cluster.length >= batchSize) break;
      if (episodesAreSimilar(seedText, getEpisodeText(remaining[i]), minSim)) {
        cluster.push(remaining.splice(i, 1)[0]);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

function clusterPendingEpisodes(pending, batchSize, windowMs = 7 * 86400000, minSim = 0.6) {
  const byGroup = new Map();
  for (const ep of pending) {
    const key = getEpisodeClusterGroupKey(ep, windowMs);
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(ep);
  }
  const clusters = [];
  for (const groupEps of byGroup.values()) {
    clusters.push(...clusterEpisodesInGroup(groupEps, batchSize, minSim));
  }
  clusters.sort((a, b) => Math.min(...a.map((e) => e.at)) - Math.min(...b.map((e) => e.at)));
  return clusters;
}

const windowMs = 7 * 86400000;
const base = 1_700_000_000_000;
const pending = [
  { summary: '用户偏好英音，正在练即兴表达', source: 'manual', at: base + 1 },
  { summary: '用户偏好英音，强化发音与语调', source: 'manual', at: base + 2 },
  { summary: '听力弱项：连读识别困难', source: 'manual', at: base + 3 },
  { summary: '听力弱项：连读与弱读混淆', source: 'manual', at: base + 4 },
];

const clusters = clusterPendingEpisodes(pending, 5, windowMs, 0.6);
const firstBatch = clusters[0] || [];

const ok =
  clusters.length === 2 &&
  firstBatch.length === 2 &&
  getEpisodeText(firstBatch[0]).includes('英音');

console.log(JSON.stringify({
  ok,
  clusterCount: clusters.length,
  firstBatchSize: firstBatch.length,
  sim: prefixSimilarity(pending[0].summary, pending[1].summary),
  firstBatchTopics: firstBatch.map((e) => getEpisodeText(e).slice(0, 12)),
}));

process.exit(ok ? 0 : 1);
