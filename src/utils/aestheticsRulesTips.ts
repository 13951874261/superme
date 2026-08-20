/** AE-TIP-01：场合规则（rules）至少 5 条 */
export const AESTHETICS_RULES_MIN = 5;

const DEFAULT_RULE_PAD = [
  '先观察场合与尊卑/宾主结构，再决定发言时机',
  '先描述可见事实，再给出克制判断',
  '给对方留下回应空间，避免连问压迫',
  '身体与语气保持松弛，不抢主位节奏',
  '离场或转场时致谢，不把话题强行收束到自己',
];

/** 将 string | string[] 规范为去空条目的字符串数组 */
export function normalizeRulesList(rules: string | string[] | undefined | null): string[] {
  if (Array.isArray(rules)) {
    return rules.map((r) => String(r || '').trim()).filter(Boolean);
  }
  const raw = String(rules || '').trim();
  if (!raw) return [];
  return raw
    .split(/[。；;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 确保至少 min 条；不足用默认垫条（不重复已有文案） */
export function ensureMinRules(
  rules: string | string[] | undefined | null,
  min = AESTHETICS_RULES_MIN
): string[] {
  const list = normalizeRulesList(rules);
  if (list.length >= min) return list;
  const seen = new Set(list);
  for (const pad of DEFAULT_RULE_PAD) {
    if (list.length >= min) break;
    if (seen.has(pad)) continue;
    list.push(pad);
    seen.add(pad);
  }
  while (list.length < min) {
    list.push(`补充实操要点 ${list.length + 1}：保持观察、克制与礼貌边界`);
  }
  return list;
}

export function evaluateRulesTipQuality(rules: string | string[] | undefined | null): {
  count: number;
  quality: 'ok' | 'below_standard';
  rules: string[];
} {
  const normalized = ensureMinRules(rules);
  const rawCount = normalizeRulesList(rules).length;
  return {
    count: rawCount,
    quality: rawCount >= AESTHETICS_RULES_MIN ? 'ok' : 'below_standard',
    rules: normalized,
  };
}
