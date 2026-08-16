import type { ScriptWorkshopDraft, ScriptPhaseData } from '../components/modules/GameTheory/ScriptWorkshopTypes';
import { countWords, estimateDurationMinutes } from '../components/modules/GameTheory/scriptEvaluator';

export type InsightScriptQuality = 'ok' | 'below_standard';

export interface InsightScriptEvaluation {
  totalWords: number;
  estimatedMinutes: number;
  passedDuration: boolean;
}

export interface InsightScenarioResult {
  draft: ScriptWorkshopDraft;
  evaluation: InsightScriptEvaluation;
  quality: InsightScriptQuality;
  scenario: string;
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
  return {
    totalWords,
    estimatedMinutes,
    passedDuration,
    quality: passedDuration ? 'ok' : 'below_standard',
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
    const evaluation = data.evaluation && typeof data.evaluation === 'object'
      ? {
          totalWords: Number(data.evaluation.totalWords) || 0,
          estimatedMinutes: Number(data.evaluation.estimatedMinutes) || 0,
          passedDuration: Boolean(data.evaluation.passedDuration),
        }
      : (() => {
          const e = evaluateInsightScriptQuality(data.draft);
          return { totalWords: e.totalWords, estimatedMinutes: e.estimatedMinutes, passedDuration: e.passedDuration };
        })();
    const quality: InsightScriptQuality =
      data.quality === 'ok' || data.quality === 'below_standard'
        ? data.quality
        : evaluation.passedDuration
          ? 'ok'
          : 'below_standard';
    const scenario = String(data.scenario || flattenInsightScript(data.draft)).trim();
    return { draft: data.draft, evaluation, quality, scenario };
  }

  const scenario = String(data?.scenario || '').trim();
  if (!scenario) throw new Error('未返回动态考题');
  const draft = wrapPlainScenarioAsDraft(scenario);
  const e = evaluateInsightScriptQuality(draft);
  return {
    draft,
    evaluation: { totalWords: e.totalWords, estimatedMinutes: e.estimatedMinutes, passedDuration: e.passedDuration },
    quality: e.quality,
    scenario: flattenInsightScript(draft),
  };
}
