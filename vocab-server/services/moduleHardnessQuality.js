/**
 * XF-FEED-02：听 / 说 / 博弈 三模块出题与生成变难启发式硬卡
 * 
 * 门禁规则：
 * 1. 洞察(听) evaluateListenScriptHardness：对白或剧本须包含隐藏底牌/信息缺口/多方张力，禁止浅层复述书摘；
 * 2. 破局(说) evaluateSpeakScenarioHardness：场景须包含冲突目标与明确约束条件，禁止仅简单背景描述；
 * 3. 驭心博弈 evaluateGameTheoryCaseHardness：案例须包含博弈对抗、隐藏底线或策略矩阵张力，禁止浅层简案。
 */

// 听模块：隐藏底牌、信息差、多方张力
const LISTEN_TENSION_RE =
  /(隐藏|底牌|底线|真实底线|信息差|信息不对称|隐瞒|防备|试探|潜台词|筹码|对立|张力|破绽|反直觉|算盘|暗流|利益交换|话里有话|各怀鬼胎)/i;

const LISTEN_DIALOGUE_TURNS_RE =
  /(:|：|「|」|“|”|说道|回应|问|答|表示|——)/;

// 浅层复述排查（只有名词定义或空洞套话）
const LISTEN_SHALLOW_CLICHE_RE =
  /^(所谓|简单来说|正如书中所说|正如定义|我们应当记住).{0,100}(重要性|的含义|的概念)。?$/s;

// 说模块：冲突目标与约束条件
const SPEAK_CONFLICT_RE =
  /(冲突|分歧|博弈|诉求对立|强硬|施压|争执|不同意|僵局|挑战|阻碍|不肯让步|反对)/i;

const SPEAK_CONSTRAINT_RE =
  /(必须|否则|限制|死线|deadline|预算|不可逾越|时间紧|底线|保密|约束|条件|限期|上限|下限|不能失去|底线是)/i;

const SPEAK_GOAL_RE =
  /(目标|任务|要求|达成|争取|拿下|说服|促成|谈下|捍卫|促使)/i;

// 博弈模块：对抗、隐藏底线、策略权衡
const GT_HARD_DEPTH_RE =
  /(公开底线|真实底线|信息不对称|BATNA|占优策略|纳什均衡|混合策略|博弈攻防|不可逆承诺|信号传递|逆向选择|信息差|利益矩阵|出局威胁|筹码置换)/i;

const GT_CONFLICT_DILEMMA_RE =
  /(若|否则|还是|站队|反噬|选边|背叛|得罪|出局|背锅|架空|两难|权衡|双输|破局)/i;

function countCompactChars(text) {
  return String(text || '').replace(/\s+/g, '').length;
}

/**
 * 评估洞察(听) 长剧本 / 对白 / 动态题目生成质量
 */
function evaluateListenScriptHardness(scriptText, { injectedKnowledge } = {}) {
  const text = String(scriptText || '').trim();
  const compactLen = countCompactChars(text);
  const passedChecks = [];
  const failedChecks = [];

  if (compactLen < 80) {
    failedChecks.push('length_too_short');
  } else {
    passedChecks.push('length_ok');
  }

  const hasTension = LISTEN_TENSION_RE.test(text);
  if (hasTension) {
    passedChecks.push('has_hidden_card_or_tension');
  } else {
    failedChecks.push('missing_tension_or_hidden_card');
  }

  const isShallow = LISTEN_SHALLOW_CLICHE_RE.test(text);
  if (!isShallow) {
    passedChecks.push('not_shallow_book_copy');
  } else {
    failedChecks.push('shallow_book_copy_detected');
  }

  const hasDialogue = LISTEN_DIALOGUE_TURNS_RE.test(text) || compactLen >= 150;
  if (hasDialogue) {
    passedChecks.push('has_dialogue_structure');
  } else {
    failedChecks.push('lacks_dialogue_structure');
  }

  const ok = Boolean(compactLen >= 80 && hasTension && !isShallow && hasDialogue);
  return {
    ok,
    reason: ok ? 'ok' : failedChecks.join(';'),
    passedChecks,
    failedChecks,
    details: { compactLen, hasTension, isShallow },
  };
}

/**
 * 评估破局(说) 场景生成质量
 */
function evaluateSpeakScenarioHardness(scenarioText, { injectedKnowledge } = {}) {
  const text = String(scenarioText || '').trim();
  const compactLen = countCompactChars(text);
  const passedChecks = [];
  const failedChecks = [];

  if (compactLen < 80) {
    failedChecks.push('length_too_short');
  } else {
    passedChecks.push('length_ok');
  }

  const hasConflict = SPEAK_CONFLICT_RE.test(text);
  if (hasConflict) {
    passedChecks.push('has_conflict');
  } else {
    failedChecks.push('missing_conflict_goal');
  }

  const hasConstraint = SPEAK_CONSTRAINT_RE.test(text);
  if (hasConstraint) {
    passedChecks.push('has_constraints');
  } else {
    failedChecks.push('missing_constraints');
  }

  const hasGoal = SPEAK_GOAL_RE.test(text) || hasConflict;
  if (hasGoal) {
    passedChecks.push('has_goal');
  } else {
    failedChecks.push('missing_goal');
  }

  const ok = Boolean(compactLen >= 80 && hasConflict && hasConstraint && hasGoal);
  return {
    ok,
    reason: ok ? 'ok' : failedChecks.join(';'),
    passedChecks,
    failedChecks,
    details: { compactLen, hasConflict, hasConstraint },
  };
}

/**
 * 评估驭心博弈 案例生成质量
 */
function evaluateGameTheoryCaseHardness(caseDataOrText, { injectedKnowledge } = {}) {
  const text = typeof caseDataOrText === 'string'
    ? caseDataOrText
    : [
        caseDataOrText?.background,
        caseDataOrText?.incomplete_info,
        caseDataOrText?.decision_point,
        caseDataOrText?.title,
      ].filter(Boolean).join('\n');

  const compactLen = countCompactChars(text);
  const passedChecks = [];
  const failedChecks = [];

  if (compactLen < 100) {
    failedChecks.push('length_too_short');
  } else {
    passedChecks.push('length_ok');
  }

  const hasDepthConcept = GT_HARD_DEPTH_RE.test(text);
  if (hasDepthConcept) {
    passedChecks.push('has_game_depth_concept');
  } else {
    failedChecks.push('missing_game_depth_concept');
  }

  const hasDilemma = GT_CONFLICT_DILEMMA_RE.test(text);
  if (hasDilemma) {
    passedChecks.push('has_dilemma_or_tension');
  } else {
    failedChecks.push('missing_dilemma_or_tension');
  }

  const ok = Boolean(compactLen >= 100 && hasDepthConcept && hasDilemma);
  return {
    ok,
    reason: ok ? 'ok' : failedChecks.join(';'),
    passedChecks,
    failedChecks,
    details: { compactLen, hasDepthConcept, hasDilemma },
  };
}

module.exports = {
  evaluateListenScriptHardness,
  evaluateSpeakScenarioHardness,
  evaluateGameTheoryCaseHardness,
  LISTEN_TENSION_RE,
  SPEAK_CONFLICT_RE,
  SPEAK_CONSTRAINT_RE,
  GT_HARD_DEPTH_RE,
};
