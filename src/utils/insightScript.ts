import type { ScriptWorkshopDraft, ScriptPhaseData } from '../components/modules/GameTheory/ScriptWorkshopTypes';
import { countWords, estimateDurationMinutes, evaluateScriptDraft } from '../components/modules/GameTheory/scriptEvaluator';

export type InsightScriptQuality = 'ok' | 'below_standard';

export interface InsightScriptEvaluation {
  totalWords: number;
  estimatedMinutes: number;
  passedDuration: boolean;
  scriptScore?: number;
  passedScript?: boolean;
}

export interface InsightScenarioResult {
  draft: ScriptWorkshopDraft;
  evaluation: InsightScriptEvaluation;
  quality: InsightScriptQuality;
  scenario: string;
  retryCount?: number;
}

function emptyPhase(phaseId: 1 | 2 | 3 | 4, content = ''): ScriptPhaseData {
  return {
    phaseId,
    title: `阶段${phaseId}`,
    targetDuration: '',
    targetWordsRange: '',
    targetRatio: 0.25,
    content,
  };
}

export function flattenInsightScript(draft: ScriptWorkshopDraft): string {
  const lines: string[] = [];
  lines.push(`【场景】${draft.sceneTitle || ''}`);
  if (draft.sceneSummary) lines.push(draft.sceneSummary);
  for (const c of draft.characters || []) {
    lines.push(
      `【角色】${c.name}（${c.roleTitle}）表层：${c.surfaceGoal}；底牌：${c.hiddenMotive}；红线：${c.redLine}；赢面：${c.winCondition}`
    );
  }
  for (const p of draft.phases || []) {
    lines.push(`【${p.title || `阶段${p.phaseId}`}】`);
    lines.push(p.content || '');
  }
  return lines.join('\n').trim();
}

export function evaluateInsightScriptQuality(draft: ScriptWorkshopDraft): InsightScriptEvaluation & { quality: InsightScriptQuality } {
  const totalWords = (draft.phases || []).reduce((sum, p) => sum + countWords(p.content || ''), 0);
  const estimatedMinutes = estimateDurationMinutes(totalWords);
  const passedDuration = estimatedMinutes >= 8 && estimatedMinutes <= 12;
  const report = evaluateScriptDraft(draft);
  const scriptScore = report ? (Number(report.score) || 0) : 0;
  const passedScript = scriptScore >= 85 && Boolean(report && report.passed);
  const quality: InsightScriptQuality = (passedDuration && passedScript) ? 'ok' : 'below_standard';
  return {
    totalWords,
    estimatedMinutes,
    passedDuration,
    scriptScore,
    passedScript,
    quality,
  };
}

export function wrapPlainScenarioAsDraft(scenario: string, category = ''): ScriptWorkshopDraft {
  const text = String(scenario || '').trim() || '（空案例）';
  return {
    sceneTitle: category ? `【${category}】动态案例` : '动态案例',
    sceneSummary: '由纯文本案例包装的最小结构化草稿',
    characters: [],
    infoMatrix: [],
    phases: [
      emptyPhase(1, text),
      emptyPhase(2),
      emptyPhase(3),
      emptyPhase(4),
    ],
  };
}

function isDraftLike(value: unknown): value is ScriptWorkshopDraft {
  if (!value || typeof value !== 'object') return false;
  const d = value as ScriptWorkshopDraft;
  return Array.isArray(d.phases) && d.phases.length === 4 && typeof d.sceneTitle === 'string';
}

export function parseInsightScenarioPayload(data: any): InsightScenarioResult {
  if (isDraftLike(data?.draft)) {
    const report = evaluateScriptDraft(data.draft);
    const defaultEval = evaluateInsightScriptQuality(data.draft);
    const evaluation: InsightScriptEvaluation = data.evaluation && typeof data.evaluation === 'object'
      ? {
          totalWords: Number(data.evaluation.totalWords) || defaultEval.totalWords,
          estimatedMinutes: Number(data.evaluation.estimatedMinutes) || defaultEval.estimatedMinutes,
          passedDuration: typeof data.evaluation.passedDuration === 'boolean'
            ? data.evaluation.passedDuration
            : defaultEval.passedDuration,
          scriptScore: typeof data.evaluation.scriptScore === 'number'
            ? data.evaluation.scriptScore
            : defaultEval.scriptScore,
          passedScript: typeof data.evaluation.passedScript === 'boolean'
            ? data.evaluation.passedScript
            : defaultEval.passedScript,
        }
      : defaultEval;

    const quality: InsightScriptQuality =
      data.quality === 'ok' || data.quality === 'below_standard'
        ? data.quality
        : (evaluation.passedDuration && (evaluation.passedScript ?? true))
          ? 'ok'
          : 'below_standard';
    const scenario = String(data.scenario || flattenInsightScript(data.draft)).trim();
    const retryCount = typeof data.retryCount === 'number' ? data.retryCount : 0;
    return { draft: data.draft, evaluation, quality, scenario, retryCount };
  }

  const scenario = String(data?.scenario || '').trim();
  if (!scenario) throw new Error('未返回动态考题');
  const draft = wrapPlainScenarioAsDraft(scenario);
  const e = evaluateInsightScriptQuality(draft);
  return {
    draft,
    evaluation: {
      totalWords: e.totalWords,
      estimatedMinutes: e.estimatedMinutes,
      passedDuration: e.passedDuration,
      scriptScore: e.scriptScore,
      passedScript: e.passedScript,
    },
    quality: e.quality,
    scenario: flattenInsightScript(draft),
    retryCount: 0,
  };
}

export function nextInsightPoolAction(
  mode: 'enter' | 'refresh',
  cursor: number,
  readyCount: number,
): { action: 'show' | 'backfill'; cursor: number } {
  if (readyCount <= 0) return { action: 'backfill', cursor: Math.max(0, cursor) };
  if (mode === 'enter') return { action: 'show', cursor: 0 };
  const next = cursor + 1;
  if (next >= readyCount) return { action: 'backfill', cursor };
  return { action: 'show', cursor: next };
}
