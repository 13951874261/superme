/** AE-JUD-01：高阶审美研判结果防串台（前端二次校验） */

export function looksLikeVocabCrossover(feedback: string): boolean {
  const t = String(feedback || '').trim();
  if (!t) return true;
  const vocabSignals =
    /音标|英式拼写|美式拼写|词性[：:]|复数形式|过去分词|不定式|\[名\]|\[动\]|\[形\]|\[副\]|dictionary|phonetic|\/[ˈˌa-zɪæɑɒʊəŋθðʃʒʌɛ]+\//i;
  const socialSignals =
    /社交|礼仪|分寸|敬酒|场合|得体|失分|禁忌|体面|饭局|茶席|雪茄|高尔夫|主宾|杯口|潜规则|避坑/;
  if (vocabSignals.test(t) && !socialSignals.test(t)) return true;
  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  if (cjk < 24 && /[A-Za-z]{4,}/.test(t) && !socialSignals.test(t)) return true;
  return false;
}

export function buildSocialFallbackFeedback(sceneCategory?: string): string {
  const scene = String(sceneCategory || '当前场景').trim() || '当前场景';
  return (
    `【社交指数量化点评】针对「${scene}」的应对：请把注意力放在场合规则、尊卑/宾主分寸与表达克制上。` +
    '建议先对齐主宾节奏，再用短而具体的得体话术回应；避免术语炫耀、抢戏或把价格/词汇讲解当成社交评价。'
  );
}

export type AestheticsVerdict = {
  feedback: string;
  score: number;
  is_passed: boolean;
};

export function ensureAestheticsResult(
  raw: Partial<AestheticsVerdict> | null | undefined,
  sceneCategory?: string
): AestheticsVerdict & { repaired: boolean } {
  let score = Math.max(0, Math.min(10, Math.round(Number(raw?.score) || 0)));
  let feedback = String(raw?.feedback || '').trim();
  let isPassed = Boolean(raw?.is_passed);
  let repaired = false;

  if (!feedback || looksLikeVocabCrossover(feedback)) {
    feedback = buildSocialFallbackFeedback(sceneCategory);
    repaired = true;
    if (!Number.isFinite(Number(raw?.score))) score = 5;
  }

  isPassed = Boolean(isPassed) && score >= 6;
  return { feedback, score, is_passed: isPassed, repaired };
}
