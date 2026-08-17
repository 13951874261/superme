/** GT-CASE-02：与前端 gtCaseQuality.ts 同规则的服务端镜像（字数下限 ∧ 密度启发式） */

const GT_CASE_BG_MIN = 400;
const GT_VERDICT_SECTIONS_MIN = 600;
const GT_INCOMPLETE_MIN = 20;
const GT_DECISION_MIN = 20;

const GT_ROLE_HINT_RE =
  /董事长|CEO|COO|CFO|VP|总监|老板|下属|同事|投资人|董事|秘书|法务|创始人|大股东|总裁|经理|合伙人|业务线负责人/gi;

const GT_CLICHE_RE =
  /高度重视|统筹兼顾|综上所述|战略定力|深刻理解|统一思想|狠抓落实|扎实推进|稳中求进/gi;

const GT_OCCASION_RE =
  /周一|周二|周三|周四|周五|今晚|会议|董事会|闭门会|十分钟|截止|会前|对账|四十八小时|二十四小时|月底|复盘会/i;

const GT_SHARP_RE =
  /若|否则|还是|签还是|站队|反噬|选边|清算|背叛|得罪|弃权|背锅|出局|对账|密报|保全/i;

const GT_WIN_LOSE_RE =
  /赢|输|同盟|裂痕|利益|阵营|出局|背锅|架空|夺权|权衡|算盘/i;

const GT_EMOTION_RE =
  /面子|恐惧|欲望|羞辱|难堪|怕|焦虑|猜忌|野心|自尊|失控|不安/i;

const GT_ACTION_RE =
  /先|再|第.+步|会前|今晚|立刻|当众|私下|闭门|切忌|首要|取证/i;

const GT_SCRIPT_RE =
  /「|」|“|”|"|'|说|原话|台词|表态话术/i;

function countCompactChars(text) {
  return String(text || '').replace(/\s+/g, '').length;
}

function countRoleHints(background) {
  const matches = String(background || '').match(GT_ROLE_HINT_RE);
  return matches ? matches.length : 0;
}

function countMatches(text, regex) {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const re = new RegExp(regex.source, flags);
  const matches = String(text || '').match(re);
  return matches ? matches.length : 0;
}

function evaluateCasePushQuality(caseLike) {
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

  const notes = [];
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

function evaluateVerdictSectionsQuality(sections) {
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

  const notes = [];
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

module.exports = {
  GT_CASE_BG_MIN,
  GT_VERDICT_SECTIONS_MIN,
  GT_INCOMPLETE_MIN,
  GT_DECISION_MIN,
  GT_ROLE_HINT_RE,
  GT_CLICHE_RE,
  GT_OCCASION_RE,
  GT_SHARP_RE,
  GT_WIN_LOSE_RE,
  GT_EMOTION_RE,
  GT_ACTION_RE,
  GT_SCRIPT_RE,
  countCompactChars,
  countRoleHints,
  countMatches,
  evaluateCasePushQuality,
  evaluateVerdictSectionsQuality,
};
