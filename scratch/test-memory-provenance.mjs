/** Phase 1 L0/L1 溯源逻辑单元测试（纯函数） */

function getEpisodeText(ep) {
  return String(ep.summary || ep.preview || '').trim();
}

function generateId(prefix, at) {
  return `${prefix}_${at}_abc`;
}

function ensureL1(summary, at) {
  const item = { ...summary };
  if (!item._id) item._id = generateId('l1', item.at || at);
  if (!item.summary) item.summary = String(item.text || '').trim();
  return item;
}

function ensureEp(ep, at) {
  const item = { ...ep };
  if (!item._id) item._id = generateId('ep', item.at || at);
  return item;
}

function ingestSessionSummary(layers, input, source, now, promote = true) {
  const s = ensureL1({ ...input, source, at: input.at || now }, now);
  layers.l1_summaries = [s, ...(layers.l1_summaries || [])];
  if (promote) {
    const ep = ensureEp({
      summary: s.summary,
      source_l1_id: s._id,
      source_l0_ids: s.source_l0_ids || [],
      source,
      at: now,
    }, now);
    layers.l2_episodes = [ep, ...(layers.l2_episodes || [])];
    s._materialized = true;
    return { l1: s, episode: ep };
  }
  return { l1: s, episode: null };
}

const now = Date.now();
const layers = { l0_turns: [], l1_summaries: [], l2_episodes: [] };
const l0Id = generateId('l0', now);
layers.l0_turns.push({ _id: l0Id, role: 'user', text: '我想练英音', _summarized: false });

const { l1, episode } = ingestSessionSummary(layers, {
  summary: '用户想练英音口语',
  title: '周聊摘要',
  source_l0_ids: [l0Id],
}, 'weekly_chat', now);

const ok =
  Boolean(l1?._id)
  && Boolean(episode?.source_l1_id)
  && episode.source_l1_id === l1._id
  && episode.source_l0_ids?.includes(l0Id)
  && getEpisodeText(episode).includes('英音');

console.log(JSON.stringify({
  ok,
  l1_id: l1?._id,
  episode_id: episode?._id,
  source_l1_id: episode?.source_l1_id,
  source_l0_ids: episode?.source_l0_ids,
}));

process.exit(ok ? 0 : 1);
