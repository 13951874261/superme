const USER_MARKERS = [/^我(本人|自己)?$/, /^用户(本人)?$/, /^本人$/, /^我的/, /^你的/, /用户画像/, /自我性格/, /我(的)?性格/, /^我$/];
const USER_DESC_MARKERS = [/对(我|用户)本人的描述/, /用户本人的性格/, /自我性格画像/];

function isUserPrototype(name, description) {
  if (!name) return false;
  if (USER_MARKERS.some(r => r.test(name))) return true;
  if (description && USER_DESC_MARKERS.some(r => r.test(description))) return true;
  return false;
}

function normalizePrototypeArchive(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  if (!name) return null;
  if (isUserPrototype(name, raw.description)) return null;
  return {
    name,
    type: String(raw.type || '未分类').trim() || '未分类',
    description: String(raw.description || '').trim(),
  };
}

module.exports = { normalizePrototypeArchive, isUserPrototype };