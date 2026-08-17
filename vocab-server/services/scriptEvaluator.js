/**
 * 本地高精度 100 分制剧本审稿与因果诊断引擎 (CommonJS 服务端版)
 * 与前端 src/components/modules/GameTheory/scriptEvaluator.ts 保持算法一致
 */

/**
 * 统计中英文字符字数
 */
function countWords(text) {
  if (!text) return 0;
  const clean = String(text).replace(/\s+/g, '');
  return clean.length;
}

/**
 * 预估演播时长 (分钟) - 标准 240~260 字/分钟
 */
function estimateDurationMinutes(words) {
  return Number((Number(words) / 250).toFixed(1));
}

/**
 * 提取剧本中的轮次 (以角色发言为标识，如：角色A： 或 **角色A**（...）：)
 */
function countRounds(fullText) {
  const text = String(fullText || '');
  const roundMatches = text.match(/(?:^|\n)\s*(?:\*\*)?[\u4e00-\u9fa5a-zA-Z0-9_-]{2,10}(?:\*\*)?(?:（[^）]*）|\([^)]*\))?\s*[:：]/g);
  return roundMatches ? roundMatches.length : Math.max(1, Math.round(countWords(text) / 120));
}

/**
 * 剧本结构与质量评估核心函数
 */
function evaluateScriptDraft(draft) {
  if (!draft || typeof draft !== 'object') {
    return {
      score: 0,
      passed: false,
      totalWords: 0,
      estimatedMinutes: 0,
      totalRounds: 0,
      phaseDistribution: {
        phase1: { words: 0, ratio: 0 },
        phase2: { words: 0, ratio: 0 },
        phase3: { words: 0, ratio: 0 },
        phase4: { words: 0, ratio: 0 },
      },
      durationScore: { score: 0, details: ['草稿为空或格式不合法'] },
      causalityScore: { score: 0, details: ['草稿为空'], brokenLinks: [] },
      strategyScore: { score: 0, details: ['草稿为空'], highlights: [] },
    };
  }

  const phases = Array.isArray(draft.phases) ? draft.phases : [];
  const p1Words = countWords(phases[0] && phases[0].content);
  const p2Words = countWords(phases[1] && phases[1].content);
  const p3Words = countWords(phases[2] && phases[2].content);
  const p4Words = countWords(phases[3] && phases[3].content);
  const totalWords = p1Words + p2Words + p3Words + p4Words;
  const fullContent = phases.map(p => (p && p.content) || '').join('\n');
  const totalRounds = countRounds(fullContent);
  const estimatedMinutes = estimateDurationMinutes(totalWords);

  const p1Ratio = totalWords > 0 ? p1Words / totalWords : 0;
  const p2Ratio = totalWords > 0 ? p2Words / totalWords : 0;
  const p3Ratio = totalWords > 0 ? p3Words / totalWords : 0;
  const p4Ratio = totalWords > 0 ? p4Words / totalWords : 0;

  // 1. 时长与节奏评分 (满分 30 分)
  let durationScore = 30;
  const durationDetails = [];

  if (totalWords >= 2100 && totalWords <= 2600) {
    durationDetails.push(`总字数 ${totalWords} 字（预估时长 ${estimatedMinutes} 分钟），完美落在 8–10 分钟黄金标准区间 (满分 15 分)`);
  } else if (totalWords >= 1800 && totalWords < 2100) {
    durationScore -= 5;
    durationDetails.push(`总字数 ${totalWords} 字略低于 2100 字门槛（预估 ${estimatedMinutes} 分钟，偏短），建议适当充实台词细节 (-5分)`);
  } else if (totalWords > 2600 && totalWords <= 3000) {
    durationScore -= 5;
    durationDetails.push(`总字数 ${totalWords} 字略高于 2600 字上限（预估 ${estimatedMinutes} 分钟，偏长），建议精简冗余对白 (-5分)`);
  } else if (totalWords < 1800) {
    durationScore -= 15;
    durationDetails.push(`总字数仅 ${totalWords} 字（预估 ${estimatedMinutes} 分钟），严重不达标，无法支撑 8-10 分钟高强度对抗 (-15分)`);
  } else {
    durationScore -= 15;
    durationDetails.push(`总字数达 ${totalWords} 字（预估 ${estimatedMinutes} 分钟），超出正常演播耐受度 (-15分)`);
  }

  // 阶段配比检查 (理想目标 2:3:4:1，阶段三 >= 30%，阶段一 10~25%)
  const isP3Dominant = p3Ratio >= 0.30;
  const isP1Reasonable = p1Ratio >= 0.10 && p1Ratio <= 0.25;
  if (isP3Dominant && isP1Reasonable) {
    durationDetails.push(`四阶段节奏配比 (${(p1Ratio * 100).toFixed(0)}% : ${(p2Ratio * 100).toFixed(0)}% : ${(p3Ratio * 100).toFixed(0)}% : ${(p4Ratio * 100).toFixed(0)}%) 符合高潮爆发结构 (满分 15 分)`);
  } else {
    durationScore -= 7;
    durationDetails.push(`四阶段配比失衡：阶段三（高潮）占比 ${(p3Ratio * 100).toFixed(0)}%，未呈现清晰的节奏波峰 (-7分)`);
  }

  // 2. 因果闭环与逻辑一致性 (满分 40 分)
  let causalityScore = 40;
  const causalityDetails = [];
  const brokenLinks = [];

  const p1p2Text = ((phases[0] && phases[0].content) || '') + '\n' + ((phases[1] && phases[1].content) || '');
  const p3p4Text = ((phases[2] && phases[2].content) || '') + '\n' + ((phases[3] && phases[3].content) || '');

  const characters = Array.isArray(draft.characters) ? draft.characters : [];
  if (characters.length >= 3) {
    let characterMentionCount = 0;
    characters.forEach(char => {
      if (char && char.name && fullContent.includes(char.name)) {
        characterMentionCount++;
      } else {
        brokenLinks.push({
          phaseId: 1,
          character: (char && char.name) || '未知角色',
          quoteText: `角色【${(char && char.name) || '未知'}】在剧本设定中存在，但正文未登场发言`,
          issueType: '角色动机前后矛盾',
          description: `角色【${(char && char.name) || '未知'}】(${char && char.roleTitle}) 在设定中拥有独立隐秘动机，但剧本未安排对应戏份`,
          suggestion: `在阶段一或阶段二为【${(char && char.name) || '未知'}】增加至少 2 轮表态或试探对白`
        });
      }
    });

    if (characterMentionCount >= 3) {
      causalityDetails.push(`核心 ${characterMentionCount} 位角色全员登场，动机冲突鲜明 (得 20 分)`);
    } else {
      causalityScore -= 10;
      causalityDetails.push(`部分预设角色戏份缺失，影响多方博弈平衡 (-10分)`);
    }
  } else {
    causalityScore -= 10;
    causalityDetails.push(`角色人数少于 3 人，难以构成多边博弈矩阵 (-10分)`);
  }

  // 检查是否存在突兀关键词（契诃夫之枪）
  const abruptKeywords = ['其实我早就', '下毒', '没想到吧', '亲兄弟', '炸弹', '遗嘱'];
  abruptKeywords.forEach(kw => {
    if (p3p4Text.includes(kw) && !p1p2Text.includes(kw) && kw !== '没想到吧') {
      brokenLinks.push({
        phaseId: 3,
        quoteText: `“...${kw}...”`,
        issueType: '无前置伏笔突兀反转',
        description: `后半程高潮中使用了关键反制要素【${kw}】，但在前半程（阶段1-2）中未留下任何线索伏笔（违反契诃夫之枪原则）`,
        suggestion: `在阶段一或阶段二中，通过微表情、动作或侧面台词提前暗示该要素的存在。`
      });
      causalityScore -= 8;
    }
  });

  if (brokenLinks.length === 0) {
    causalityDetails.push('伏笔与反转闭环完整，未检测到机械降神或悬空因果 (得 20 分)');
  } else {
    causalityDetails.push(`检测到 ${brokenLinks.length} 处因果链薄弱点或契诃夫之枪遗漏 (扣除对应分数)`);
  }

  // 3. 策略强度与博弈快感 (满分 30 分)
  let strategyScore = 30;
  const strategyDetails = [];
  const highlights = [];

  const infoMatrix = Array.isArray(draft.infoMatrix) ? draft.infoMatrix : [];
  if (infoMatrix.length >= 2) {
    strategyDetails.push(`已配置 ${infoMatrix.length} 项信息差对抗矩阵 (得 15 分)`);
    highlights.push('利用信息不对称构建了多重视角盲区');
  } else {
    strategyScore -= 8;
    strategyDetails.push('信息差矩阵不足 2 项，缺乏深层博弈基础 (-8分)');
  }

  if (totalRounds >= 16) {
    strategyDetails.push(`交互轮次达到 ${totalRounds} 轮，满足高强度攻防拉扯深度 (得 15 分)`);
    highlights.push('攻防转换节奏紧凑，反制层次分明');
  } else {
    strategyScore -= 7;
    strategyDetails.push(`总轮次仅 ${totalRounds} 轮（少于 16 轮），博弈过程较为平铺直叙 (-7分)`);
  }

  const finalScore = Math.max(0, Math.min(100, durationScore + causalityScore + strategyScore));

  return {
    score: finalScore,
    passed: finalScore >= 85,
    totalWords,
    estimatedMinutes,
    totalRounds,
    phaseDistribution: {
      phase1: { words: p1Words, ratio: Number(p1Ratio.toFixed(2)) },
      phase2: { words: p2Words, ratio: Number(p2Ratio.toFixed(2)) },
      phase3: { words: p3Words, ratio: Number(p3Ratio.toFixed(2)) },
      phase4: { words: p4Words, ratio: Number(p4Ratio.toFixed(2)) },
    },
    durationScore: {
      score: Math.max(0, durationScore),
      details: durationDetails,
    },
    causalityScore: {
      score: Math.max(0, causalityScore),
      details: causalityDetails,
      brokenLinks,
    },
    strategyScore: {
      score: Math.max(0, strategyScore),
      details: strategyDetails,
      highlights,
    },
  };
}

module.exports = {
  countWords,
  estimateDurationMinutes,
  countRounds,
  evaluateScriptDraft,
};
