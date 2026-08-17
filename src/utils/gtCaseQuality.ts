/** GT-CASE-02：案例推送与研判四节双硬卡质量门禁（字数下限 ∧ 密度启发式） */

export const GT_CASE_BG_MIN = 400;
export const GT_VERDICT_SECTIONS_MIN = 600;
export const GT_INCOMPLETE_MIN = 20;
export const GT_DECISION_MIN = 20;

export const GT_ROLE_HINT_RE =
  /董事长|CEO|COO|CFO|VP|总监|老板|下属|同事|投资人|董事|秘书|法务|创始人|大股东|总裁|经理|合伙人|业务线负责人/gi;

export const GT_CLICHE_RE =
  /高度重视|统筹兼顾|综上所述|战略定力|深刻理解|统一思想|狠抓落实|扎实推进|稳中求进/gi;

export const GT_OCCASION_RE =
  /周一|周二|周三|周四|周五|今晚|会议|董事会|闭门会|十分钟|截止|会前|对账|四十八小时|二十四小时|月底|复盘会/i;

export const GT_SHARP_RE =
  /若|否则|还是|签还是|站队|反噬|选边|清算|背叛|得罪|弃权|背锅|出局|对账|密报|保全/i;

export const GT_WIN_LOSE_RE =
  /赢|输|同盟|裂痕|利益|阵营|出局|背锅|架空|夺权|权衡|算盘/i;

export const GT_EMOTION_RE =
  /面子|恐惧|欲望|羞辱|难堪|怕|焦虑|猜忌|野心|自尊|失控|不安/i;

export const GT_ACTION_RE =
  /先|再|第.+步|会前|今晚|立刻|当众|私下|闭门|切忌|首要|取证/i;

export const GT_SCRIPT_RE =
  /「|」|“|”|"|'|说|原话|台词|表态话术/i;

export type GtQuality = 'ok' | 'below_standard';

export function countCompactChars(text?: string | null): number {
  return String(text || '').replace(/\s+/g, '').length;
}

export function countRoleHints(background?: string | null): number {
  const matches = String(background || '').match(GT_ROLE_HINT_RE);
  return matches ? matches.length : 0;
}

export function countMatches(text: string | null | undefined, regex: RegExp): number {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const re = new RegExp(regex.source, flags);
  const matches = String(text || '').match(re);
  return matches ? matches.length : 0;
}

export function evaluateCasePushQuality(caseLike?: {
  background?: string;
  incomplete_info?: string;
  decision_point?: string;
} | null): {
  quality: GtQuality;
  quality_note?: string;
  char_count: number;
  role_hints: number;
} {
  const bg = String(caseLike?.background || '');
  const incomplete = String(caseLike?.incomplete_info || '');
  const decision = String(caseLike?.decision_point || '');

  const char_count = countCompactChars(bg);
  const role_hints = countRoleHints(bg);
  const clicheCount = countMatches(bg, GT_CLICHE_RE);

  const occasionOk = GT_OCCASION_RE.test(bg) || GT_OCCASION_RE.test(decision);
  const incompleteOk = countCompactChars(incomplete) >= GT_INCOMPLETE_MIN;
  const decisionLenOk = countCompactChars(decision) >= GT_DECISION_MIN;
  const sharpSignalOk = GT_SHARP_RE.test(decision);

  const notes: string[] = [];
  if (char_count < GT_CASE_BG_MIN) {
    notes.push(`背景未达 ${GT_CASE_BG_MIN} 字详实门槛（当前 ${char_count}）`);
  }
  if (role_hints < 3) {
    notes.push(`角色线索不足 3 处（当前 ${role_hints}）`);
  }
  if (clicheCount >= 3) {
    notes.push(`包含较多套话词（命中 ${clicheCount} 处）`);
  }
  if (!occasionOk) {
    notes.push('缺少具体会议场合或时限要求');
  }
  if (!incompleteOk) {
    notes.push(`未知信息不完整（需 ≥${GT_INCOMPLETE_MIN} 字）`);
  }
  if (!decisionLenOk) {
    notes.push(`决策点过短（需 ≥${GT_DECISION_MIN} 字）`);
  } else if (!sharpSignalOk) {
    notes.push('决策点缺少尖锐两难或选边代价');
  }

  if (notes.length === 0) {
    return { quality: 'ok', char_count, role_hints };
  }
  return {
    quality: 'below_standard',
    quality_note: notes.join('；'),
    char_count,
    role_hints,
  };
}

export function evaluateVerdictSectionsQuality(sections?: {
  interest_chain?: string;
  emotion_motives?: string;
  actionable_strategy?: string;
  script_examples?: string;
} | null): {
  quality: GtQuality;
  quality_note?: string;
  sections_char_count: number;
} {
  const parts = [
    sections?.interest_chain,
    sections?.emotion_motives,
    sections?.actionable_strategy,
    sections?.script_examples,
  ].map((s) => String(s || '').trim());

  const empty = parts.some((p) => !p);
  const fullText = parts.join('');
  const sections_char_count = countCompactChars(fullText);
  const totalCliches = countMatches(fullText, GT_CLICHE_RE);

  const winLoseOk = GT_WIN_LOSE_RE.test(sections?.interest_chain || '');
  const emotionOk = GT_EMOTION_RE.test(sections?.emotion_motives || '');
  const actionOk = GT_ACTION_RE.test(sections?.actionable_strategy || '');
  const scriptOk = GT_SCRIPT_RE.test(sections?.script_examples || '');

  const notes: string[] = [];
  if (empty) {
    notes.push('研判四节有缺失');
  }
  if (sections_char_count < GT_VERDICT_SECTIONS_MIN) {
    notes.push(`四节合计未达 ${GT_VERDICT_SECTIONS_MIN} 字门槛（当前 ${sections_char_count}）`);
  }
  if (totalCliches >= 3) {
    notes.push(`研判套话过多（命中 ${totalCliches} 处）`);
  }
  if (!winLoseOk) {
    notes.push('利益链缺少清晰的输赢与阵营划分');
  }
  if (!emotionOk) {
    notes.push('情绪动机缺少面子、恐惧等心理锚点');
  }
  if (!actionOk) {
    notes.push('策略缺少明确的行动次序（先/再/步骤）');
  }
  if (!scriptOk) {
    notes.push('话术缺少可直接出口的台词示范');
  }

  if (notes.length === 0) {
    return { quality: 'ok', sections_char_count };
  }
  return {
    quality: 'below_standard',
    quality_note: notes.join('；'),
    sections_char_count,
  };
}

/** GT-SIM-02: 剥离玩家应对策略前缀 */
export function stripPlayerPrefix(text?: string | null): string {
  let s = String(text || '').trim();
  s = s.replace(/^[【\[(（]?(?:玩家应对策略|玩家应对|用户应对|应对策略|玩家输入|我的应对)[】\])）]?[：:\s]*/i, '');
  return s.trim();
}

export const GT_FALLBACK_SUGGESTED = '先确认对方关切，再说明边界与可协商空间的下一句';

export function isFallbackToneSuggested(suggested?: string | null): boolean {
  const s = String(suggested || '').trim();
  if (!s) return true;
  return s.includes(GT_FALLBACK_SUGGESTED) || s === '（未提供原话）';
}

/** 检查文本中是否贴合用户当句核心子串 */
export function matchUserPromptCue(targetText?: string | null, rawUserInput?: string | null): boolean {
  const cleanedTarget = String(targetText || '').replace(/\s+/g, '');
  const stripped = stripPlayerPrefix(rawUserInput).replace(/\s+/g, '');
  if (!stripped) return true; // 如果无输入原话，不强行因匹配失败拦截

  // 1. 去标点后的完整短句匹配
  const cleanInput = stripped.replace(/[，。！？、,.!?；;""''“”《》【】]/g, '');
  if (cleanInput.length >= 2 && cleanedTarget.includes(cleanInput)) {
    return true;
  }

  // 2. 提取 2~4 字关键子串匹配（过滤纯虚词/代词）
  if (cleanInput.length >= 2) {
    for (let len = Math.min(cleanInput.length, 4); len >= 2; len--) {
      for (let i = 0; i <= cleanInput.length - len; i++) {
        const chunk = cleanInput.slice(i, i + len);
        if (/^(?:我们|你们|他们|这个|那个|一下|什么|怎么|的话|以及|还有|因为|所以)$/.test(chunk)) {
          continue;
        }
        if (cleanedTarget.includes(chunk)) {
          return true;
        }
      }
    }
  }

  return false;
}

export type SimAdviceQualityInput = {
  user_answer?: string;
  strategy_guidance?: string[] | unknown;
  tone_corrections?: Array<{ original?: string; problem?: string; suggested?: string }> | unknown;
  interest_chain?: string;
  emotion_motives?: string;
  actionable_strategy?: string;
  script_examples?: string;
};

/** GT-SIM-02: 人机对战沙盘及会话复盘新硬卡质量判定 */
export function evaluateSimAdviceQuality(input?: SimAdviceQualityInput | null): {
  quality: GtQuality;
  quality_note?: string;
  details: {
    interestOk: boolean;
    emotionOk: boolean;
    clicheFail: boolean;
    guidanceOk: boolean;
    toneQuoteOk: boolean;
    toneRewriteOk: boolean;
  };
} {
  const interest = String(input?.interest_chain || '').trim();
  const emotion = String(input?.emotion_motives || '').trim();
  const rawUserAnswer = String(input?.user_answer || '').trim();

  // 1. 利益链 & 情绪动机检查
  const interestOk = Boolean(interest) && GT_WIN_LOSE_RE.test(interest);
  const emotionOk = Boolean(emotion) && GT_EMOTION_RE.test(emotion);

  const totalCliches = countMatches(interest + emotion, GT_CLICHE_RE);
  const clicheFail = totalCliches >= 3;

  // 2. strategy_guidance 检查 (条数 >= 2, 命中当句子串, 具备行动次序信号, 且非泛化套话)
  const rawGuidance = input?.strategy_guidance;
  const guidanceList = Array.isArray(rawGuidance)
    ? rawGuidance.map((g) => String(g || '').trim()).filter(Boolean)
    : [];
  const guidanceText = guidanceList.join(' ');
  const guidanceLenOk = guidanceList.length >= 2;
  const guidanceCueOk = matchUserPromptCue(guidanceText, rawUserAnswer);
  const guidanceActionOk = GT_ACTION_RE.test(guidanceText);
  const guidanceCliche = countMatches(guidanceText, GT_CLICHE_RE) >= 2 || isFallbackToneSuggested(guidanceText);

  const guidanceOk = guidanceLenOk && guidanceCueOk && guidanceActionOk && !guidanceCliche;

  // 3. tone_corrections 检查 (original 贴当句, suggested 非泛化兜底且有实际改写)
  const rawTone = input?.tone_corrections;
  const toneList = Array.isArray(rawTone) ? rawTone : [];
  const validToneItems = toneList.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const orig = String(item.original || '').trim();
    const prob = String(item.problem || '').trim();
    const sugg = String(item.suggested || '').trim();
    return Boolean(orig && prob && sugg);
  });

  const toneQuoteOk =
    validToneItems.length >= 1 &&
    validToneItems.some((item) => matchUserPromptCue(item.original, rawUserAnswer));

  const toneRewriteOk =
    validToneItems.length >= 1 &&
    validToneItems.some((item) => {
      const orig = String(item.original || '').trim();
      const sugg = String(item.suggested || '').trim();
      return sugg.length > 0 && sugg !== orig && !isFallbackToneSuggested(sugg);
    });

  const notes: string[] = [];
  if (!interestOk) {
    notes.push('利益链缺少输赢与利益格局分析');
  }
  if (!emotionOk) {
    notes.push('情绪动机缺少面子、恐惧等心理透视');
  }
  if (clicheFail) {
    notes.push(`利益与情绪部分包含较多套话（命中 ${totalCliches} 处）`);
  }
  if (!guidanceLenOk) {
    notes.push(`博弈策略示例条数不足（当前 ${guidanceList.length} 条，需 ≥2 条）`);
  } else if (!guidanceCueOk) {
    notes.push('博弈策略示例未贴合用户当句应对进行推演');
  } else if (!guidanceActionOk) {
    notes.push('博弈策略示例缺少先/再等行动次序指导');
  } else if (guidanceCliche) {
    notes.push('博弈策略示例包含泛化套话');
  }

  if (!toneQuoteOk) {
    notes.push('语气修正表原话未引用用户当句应对');
  }
  if (!toneRewriteOk) {
    notes.push('语气修正表建议说法为泛化兜底或未进行有效改写');
  }

  const allPassed =
    interestOk &&
    emotionOk &&
    !clicheFail &&
    guidanceOk &&
    toneQuoteOk &&
    toneRewriteOk;

  const details = {
    interestOk,
    emotionOk,
    clicheFail,
    guidanceOk,
    toneQuoteOk,
    toneRewriteOk,
  };

  if (allPassed) {
    return { quality: 'ok', details };
  }

  return {
    quality: 'below_standard',
    quality_note: notes.join('；'),
    details,
  };
}

