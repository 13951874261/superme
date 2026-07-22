import React from 'react';
import { CheckCircle, WarningCircle } from '@phosphor-icons/react';

export interface StayAnalysisPanelProps {
  masteryData: any;
  impromptuPassed: boolean;
  stayStats: any;
}

const StatusIcon = ({ ok }: { ok: boolean }) =>
  ok
    ? <CheckCircle className="w-4 h-4 text-emerald-500 inline" weight="fill" />
    : <WarningCircle className="w-4 h-4 text-amber-500 inline" weight="fill" />;

const ProgressRing = ({ percentage }: { percentage: number }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40" cy="40" r={radius}
          className="stroke-slate-100" strokeWidth="8" fill="none"
        />
        <circle
          cx="40" cy="40" r={radius}
          className="stroke-[var(--color-brand)] transition-all duration-1000 ease-out"
          strokeWidth="8" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export function StayAnalysisPanel({ masteryData, impromptuPassed, stayStats }: StayAnalysisPanelProps) {
  const oralCount = masteryData?.oralCount || 0;
  const maxWriteScore = masteryData?.maxWriteScore || 0;
  let score = 0;
  score += Math.min(oralCount / 10, 1) * 33;
  score += Math.min(maxWriteScore / 8, 1) * 33;
  if (impromptuPassed) score += 34;
  const percentage = Math.round(score);

  const items = [
    { label: `口语对抗 (${oralCount}/10 轮)`, ok: oralCount >= 10 },
    { label: `L3 书面表达 (${maxWriteScore}/8 分)`, ok: maxWriteScore >= 8 },
    { label: '即兴演讲', ok: impromptuPassed }
  ];

  return (
    <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-[0_6px_20px_rgba(0,0,0,0.015)] flex flex-col gap-2.5">
      {!masteryData?.isMastered && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="shrink-0 w-14 h-14">
              <ProgressRing percentage={percentage} />
            </div>
            <div className="min-w-0 space-y-0">
              <div className="eyebrow">能力匹配度</div>
              <div className="text-xl font-black tabular-nums text-[var(--color-ink-primary)] leading-tight">{percentage}%</div>
              <div className="text-[10px] text-[var(--color-ink-muted)] font-medium">距合伙人目标</div>
            </div>
          </div>

          <div className="hidden sm:block w-px self-stretch bg-[var(--color-border)] shrink-0" />

          <div className="space-y-1 sm:min-w-[10rem] sm:shrink-0">
            {items.map(item => (
              <div key={item.label} className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-[var(--color-ink-secondary)] truncate">{item.label}</span>
                <StatusIcon ok={item.ok} />
              </div>
            ))}
          </div>
        </div>
      )}

      {stayStats && (
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 transition-all hover:shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200/50 pb-1.5 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <h5 className="eyebrow text-slate-800 truncate">闭环停留分析</h5>
            </div>
            <span className="text-[10px] bg-indigo-50 text-[var(--color-brand)] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider shrink-0">
              {stayStats.stayDays > 1 ? `已停留 ${stayStats.stayDays} 天` : '第 1 天'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold text-slate-600">
            <div className="bg-white/80 border border-slate-100 rounded-lg p-2">
              <p className="eyebrow mb-0.5 text-[9px]">练习</p>
              <p className="text-slate-700 font-black text-[11px] leading-snug">
                <span className="text-[var(--color-brand)] tabular-nums">{stayStats.articleCount}</span> 篇
              </p>
            </div>
            <div className="bg-white/80 border border-slate-100 rounded-lg p-2">
              <p className="eyebrow mb-0.5 text-[9px]">词汇</p>
              <p className="text-slate-700 font-black text-[11px] leading-snug">
                <span className="text-[var(--color-brand)] tabular-nums">{stayStats.wordCount}</span>/<span className="text-[var(--color-brand)] tabular-nums">{stayStats.phraseCount}</span>
              </p>
            </div>
            <div className="bg-white/80 border border-slate-100 rounded-lg p-2">
              <p className="eyebrow mb-0.5 text-[9px]">薄弱点</p>
              <div className="space-y-0 text-[9px] font-medium leading-snug">
                <p className="truncate"><span className="font-bold text-red-500">音</span> {stayStats.weakPoints.pronunciation}</p>
                <p className="truncate"><span className="font-bold text-[#FF5722]">法</span> {stayStats.weakPoints.grammar}</p>
              </div>
            </div>
          </div>

          <div className="mt-1.5 bg-amber-50/50 border border-amber-100/60 rounded-lg p-2 flex items-start gap-1.5">
            <WarningCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" weight="fill" />
            <div className="text-[10px] leading-snug text-amber-800 font-medium min-w-0">
              <span className="font-bold">今日建议：</span>
              <span className="opacity-90 line-clamp-2"> {stayStats.todaySuggestion}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
