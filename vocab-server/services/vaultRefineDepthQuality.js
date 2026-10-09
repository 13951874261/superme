/**
 * XF-FEED-02：知识加深深度硬卡纯函数 evaluateVaultRefineDepth
 * 门禁规则：
 * 1. 原一级枝标题必须全部保留；
 * 2. 必须新增至少 1 个有效命名的二级（或更深）子枝（非空且不等于父枝，且非通用空洞词）；
 * 3. 至少 1 条知识点讲解包含可执行步骤（序号/首先然后）或明确反例。
 */

const GENERIC_SUBBRANCH_BLOCKLIST = new Set([
  '详情', '补充', '其他', '其它', '概述', '无', '子节点', '细则', '暂无',
  'etc', 'etc.', 'details', 'more', 'node', 'sub'
]);

const STEP_PATTERNS = [
  /(\d+[\.、]|步骤\s*\d+|Step\s*\d+|第[一二三四五六七八九十\d]步)/i,
  /(首先|接下来|然后|最后|第一阶段|第二阶段|其一|其二)/,
  /1\..+2\..+/s,
];

const COUNTEREXAMPLE_PATTERNS = [
  /(反例|错误示范|避坑|常见误区|错误做法|反面案例|切忌|禁忌|避免.*误区|反向证明)/i,
  /【反例】|【避坑】|【常见误区】|【禁忌】/i,
];

function normalizeTitle(t) {
  return String(t || '').trim().toLowerCase();
}

function extractBranchTitles(branch) {
  if (!branch) return [];
  if (typeof branch === 'string') return [branch.trim()];
  const titles = [];
  if (branch.title) titles.push(String(branch.title).trim());
  if (Array.isArray(branch.children)) {
    branch.children.forEach((c) => {
      titles.push(...extractBranchTitles(c));
    });
  }
  return titles;
}

function getLevel1BranchMap(mindmap) {
  const map = new Map();
  if (!mindmap || !Array.isArray(mindmap.branches)) return map;
  for (const b of mindmap.branches) {
    const title = typeof b === 'string' ? b.trim() : String(b?.title || '').trim();
    if (title) {
      const children = Array.isArray(b.children) ? b.children : [];
      map.set(normalizeTitle(title), { originalTitle: title, rawBranch: b, children });
    }
  }
  return map;
}

function collectSubBranchTitles(branch) {
  const list = [];
  if (!branch || typeof branch === 'string') return list;
  const parentTitleNorm = normalizeTitle(branch.title);
  if (Array.isArray(branch.children)) {
    for (const child of branch.children) {
      const childTitle = typeof child === 'string' ? child.trim() : String(child?.title || '').trim();
      const childNorm = normalizeTitle(childTitle);
      if (
        childTitle.length >= 2 &&
        childNorm !== parentTitleNorm &&
        !GENERIC_SUBBRANCH_BLOCKLIST.has(childNorm)
      ) {
        list.push(childTitle);
      }
      if (typeof child === 'object' && child !== null) {
        list.push(...collectSubBranchTitles(child));
      }
    }
  }
  return list;
}

function hasExecutableSteps(text) {
  const s = String(text || '');
  return STEP_PATTERNS.some((pat) => pat.test(s));
}

function hasCounterexample(text) {
  const s = String(text || '');
  return COUNTEREXAMPLE_PATTERNS.some((pat) => pat.test(s));
}

function evaluateVaultRefineDepth(originalData = {}, refinedData = {}) {
  const passedChecks = [];
  const failedChecks = [];

  const origMindmap = originalData.mindmap || {};
  const refMindmap = refinedData.mindmap || {};

  const origL1Map = getLevel1BranchMap(origMindmap);
  const refL1Map = getLevel1BranchMap(refMindmap);

  // 1. 检查原一级枝是否全部保留
  let branchesPreserved = true;
  for (const [origKey, origObj] of origL1Map.entries()) {
    if (!refL1Map.has(origKey)) {
      branchesPreserved = false;
      failedChecks.push(`missing_level1_branch:${origObj.originalTitle}`);
    }
  }
  if (branchesPreserved && origL1Map.size > 0) {
    passedChecks.push('branches_preserved');
  } else if (origL1Map.size === 0 && refL1Map.size > 0) {
    passedChecks.push('branches_preserved');
  }

  // 2. 检查是否至少新增 1 个有效命名的二级（或更深）子枝
  const origSubBranches = new Set();
  if (Array.isArray(origMindmap.branches)) {
    for (const b of origMindmap.branches) {
      collectSubBranchTitles(b).forEach((t) => origSubBranches.add(normalizeTitle(t)));
    }
  }

  const refSubBranches = [];
  if (Array.isArray(refMindmap.branches)) {
    for (const b of refMindmap.branches) {
      collectSubBranchTitles(b).forEach((t) => refSubBranches.push(t));
    }
  }

  const newValidSubBranches = refSubBranches.filter(
    (t) => !origSubBranches.has(normalizeTitle(t))
  );

  let subBranchesExpanded = false;
  if (newValidSubBranches.length > 0) {
    subBranchesExpanded = true;
    passedChecks.push(`subbranches_expanded:${newValidSubBranches.join(',')}`);
  } else {
    failedChecks.push('no_new_valid_subbranches');
  }

  // 3. 检查讲解是否加厚（至少 1 条含步骤或反例，且有实质内容）
  const allTexts = [];
  if (refinedData.summary) allTexts.push(String(refinedData.summary));
  if (refinedData.content) allTexts.push(String(refinedData.content));
  if (Array.isArray(refinedData.items)) {
    for (const it of refinedData.items) {
      if (typeof it === 'string') allTexts.push(it);
      else if (it && typeof it === 'object') {
        if (it.explanation) allTexts.push(String(it.explanation));
        if (it.summary) allTexts.push(String(it.summary));
        if (it.content) allTexts.push(String(it.content));
        if (Array.isArray(it.points)) {
          allTexts.push(it.points.join('\n'));
        }
      }
    }
  }

  let explanationDeepened = false;
  for (const text of allTexts) {
    const compactLen = text.replace(/\s+/g, '').length;
    const hasSteps = hasExecutableSteps(text);
    const hasCounter = hasCounterexample(text);
    if (compactLen >= 20 && (hasSteps || hasCounter)) {
      explanationDeepened = true;
      if (hasSteps) passedChecks.push('has_executable_steps');
      if (hasCounter) passedChecks.push('has_counterexample');
      break;
    }
  }

  if (!explanationDeepened) {
    failedChecks.push('explanation_lacks_steps_or_counterexamples');
  }

  const ok = Boolean(branchesPreserved && subBranchesExpanded && explanationDeepened);
  const reason = ok
    ? 'ok'
    : failedChecks.length > 0
    ? failedChecks.join(';')
    : 'below_standard';

  return {
    ok,
    reason,
    passedChecks,
    failedChecks,
    details: {
      origL1Count: origL1Map.size,
      refL1Count: refL1Map.size,
      newValidSubBranches,
      explanationDeepened,
    },
  };
}

module.exports = {
  evaluateVaultRefineDepth,
  hasExecutableSteps,
  hasCounterexample,
  collectSubBranchTitles,
  getLevel1BranchMap,
  GENERIC_SUBBRANCH_BLOCKLIST,
};
