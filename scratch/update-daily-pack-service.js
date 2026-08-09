const fs = require('fs');
const file = 'vocab-server/services/dailyPackService.js';
let content = fs.readFileSync(file, 'utf8');

const targetFunctionRegex = /function getDailyPackRow\(db, userId, packDate, inputSignature = null\) \{[\s\S]*?\n\}/;

const replacement = unction getDailyPackRow(db, userId, packDate, inputSignature = null, theme = null) {
  const uid = normalizeUserId(userId);
  // D1: 有签名则精确命中；无签名不宽回退到「任意 ready」
  if (inputSignature === null || inputSignature === undefined) return undefined;
  const exact = db.prepare(
    'SELECT * FROM daily_packs WHERE user_id = ? AND pack_date = ? AND input_signature = ?'
  ).get(uid, packDate, inputSignature);
  if (exact) return exact;

  const fallback = db.prepare(
    "SELECT * FROM daily_packs WHERE user_id = ? AND pack_date = ? AND status = 'ready' ORDER BY created_at DESC LIMIT 1"
  ).get(uid, packDate);
  if (fallback) {
    if (theme && fallback.theme !== theme) {
      return undefined;
    }
    console.log(\[DailyPack Row Fallback] userId=\ matched today's ready pack via fallback instead of exact signature.\);
    return fallback;
  }
  return undefined;
};

if (targetFunctionRegex.test(content)) {
  content = content.replace(targetFunctionRegex, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully updated getDailyPackRow in dailyPackService.js');
} else {
  console.error('Failed: Target getDailyPackRow function not found!');
  process.exit(1);
}
