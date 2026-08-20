import React from 'react';
import type { ScriptWorkshopDraft } from '../GameTheory/ScriptWorkshopTypes';

type Props = {
  draft: ScriptWorkshopDraft;
  evaluation: {
    totalWords: number;
    estimatedMinutes: number;
    passedDuration?: boolean;
    scriptScore?: number;
    passedScript?: boolean;
  };
  quality: 'ok' | 'below_standard';
  loading?: boolean;
};

export default function InsightScriptReadonlyView({
  draft,
  evaluation,
  quality,
  loading = false,
}: Props) {
  const characters = draft.characters || [];
  const phases = draft.phases || [];

  return (
    <div
      className={`relative space-y-4 text-slate-100 ${loading ? 'opacity-60 pointer-events-none' : ''}`}
      aria-busy={loading || undefined}
    >
      {quality === 'below_standard' && (
        <div
          className="rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 flex items-center justify-between"
          role="status"
        >
          <span>
            {evaluation.passedDuration === false && evaluation.passedScript === false
              ? `未达 8–10 分钟与博弈标准（当前约 ${evaluation.estimatedMinutes} 分钟，博弈分 ${evaluation.scriptScore ?? '—'}）`
              : evaluation.passedDuration === false
                ? `未达 8–10 分钟时长标准（当前约 ${evaluation.estimatedMinutes} 分钟）`
                : evaluation.passedScript === false
                  ? `未达博弈深度标准（当前博弈分 ${evaluation.scriptScore ?? '—'} / 需≥85）`
                  : `未达 8–10 分钟标杆标准（当前约 ${evaluation.estimatedMinutes} 分钟）`}
          </span>
          <span className="text-[10px] text-amber-300/80 font-normal ml-2">可正常侧写答题</span>
        </div>
      )}

      <div className="space-y-1.5">
        <h3 className="text-sm font-black text-slate-50 tracking-wide">
          {draft.sceneTitle || '未命名场景'}
        </h3>
        {draft.sceneSummary ? (
          <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
            {draft.sceneSummary}
          </p>
        ) : null}
      </div>

      {characters.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            角色卡
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {characters.map((c) => (
              <div
                key={c.id || `${c.name}-${c.roleTitle}`}
                className="rounded-xl border border-zinc-700/80 bg-zinc-900/60 p-3 space-y-1.5"
              >
                <div className="text-xs font-black text-slate-100">
                  {c.name}
                  {c.roleTitle ? (
                    <span className="ml-1.5 font-medium text-slate-400">（{c.roleTitle}）</span>
                  ) : null}
                </div>
                <div className="text-[11px] leading-relaxed text-slate-300 space-y-1">
                  <p>
                    <span className="text-slate-500">表层目标：</span>
                    {c.surfaceGoal || '—'}
                  </p>
                  <p>
                    <span className="text-amber-400/90">隐藏底牌：</span>
                    {c.hiddenMotive || '—'}
                  </p>
                  <p>
                    <span className="text-slate-500">利益红线：</span>
                    {c.redLine || '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {phases.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            四幕剧本
          </div>
          <div className="space-y-2">
            {phases.map((phase) => (
              <details
                key={phase.phaseId}
                className="rounded-xl border border-zinc-700/80 bg-zinc-900/40 open:bg-zinc-900/70"
                open={phase.phaseId === 1}
              >
                <summary className="cursor-pointer select-none px-3 py-2 text-xs font-bold text-slate-200">
                  {phase.title || `阶段${phase.phaseId}`}
                </summary>
                <div className="px-3 pb-3 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
                  {phase.content || '（暂无正文）'}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-400 border-t border-zinc-700/60 pt-3">
        <span>字数 {evaluation.totalWords}</span>
        <span>约 {evaluation.estimatedMinutes} 分钟</span>
        {evaluation.scriptScore !== undefined && (
          <span>博弈分 {evaluation.scriptScore}</span>
        )}
        {quality === 'ok' ? (
          <span className="text-emerald-400/90 font-bold">质量达标</span>
        ) : (
          <span className="text-amber-400/90 font-bold">质量待提升</span>
        )}
      </div>
    </div>
  );
}
