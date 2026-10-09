import React from 'react';
import { CheckCircle, WarningCircle } from '@phosphor-icons/react';

export interface StayAnalysisPanelProps {
  masteryData: any;
  impromptuPassed: boolean;
  stayStats: any;
}

const StatusIcon = ({ ok }: { ok: boolean }) =>
  ok
    ? <CheckCircle aria-hidden="true" className="w-4 h-4 text-emerald-500 inline" weight="fill" />
    : <WarningCircle aria-hidden="true" className="w-4 h-4 text-amber-500 inline" weight="fill" />;

const ProgressRing = ({ percentage }: { percentage: number }) => {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} className="stroke-slate-100" strokeWidth="7" fill="none" />
        <circle
          cx="36" cy="36" r={radius}
          className="stroke-[var(--color-brand)] transition-[stroke-dashoffset] duration-1000 ease-out"
          strokeWidth="7" fill="none"
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
    { label: `口语 (${oralCount}/10)`, ok: oralCount >= 10 },
    { label: `书面 (${maxWriteScore}/8)`, ok: maxWriteScore >= 8 },
    { label: '即兴演讲', ok: impromptuPassed }
  ];

  return (
    <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-[0_4px_14px_rgba(0,0,0,0.012)] flex flex-col gap-2 h-full min-h-0">
      {!masteryData?.isMastered && (
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="shrink-0 w-12 h-12">
            <ProgressRing percentage={percentage} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="eyebrow">能力匹配度</div>
            <div className="text-lg font-black tabular-nums text-[var(--color-ink-primary)] leading-tight">{percentage}%</div>
          </div>
          <div className="space-y-0.5 shrink-0 min-w-[7.5rem]">
            {items.map(item => (
              <div key={item.label} className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium text-[var(--color-ink-secondary)] truncate">{item.label}</span>
                <StatusIcon ok={item.ok} />
              </div>
            ))}
          </div>
        </div>
      )}

      {stayStats && (
        <div className="bg-slate-50 border border-slate-200/60 rounded-lg p-2 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between border-b border-slate-200/50 pb-1 mb-1.5 shrink-0">
            <h5 className="eyebrow text-slate-800 truncate">停留分析</h5>
            <span className="text-[10px] bg-slate-50 text-[var(--color-brand)] px-1.5 py-0.5 rounded-md font-bold shrink-0 border border-[var(--color-border)]">
              {stayStats.stayDays > 1 ? `${stayStats.stayDays} 天` : '第 1 天'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 shrink-0">
            <div className="bg-white border border-slate-100 rounded-md p-1.5">
              <p className="text-[9px] text-slate-400 font-bold mb-0.5">练习</p>
              <p className="text-slate-700 font-black text-[11px] tabular-nums">
                <span className="text-[var(--color-brand)]">{stayStats.articleCount}</span> 篇
              </p>
            </div>
            <div className="bg-white border border-slate-100 rounded-md p-1.5">
              <p className="text-[9px] text-slate-400 font-bold mb-0.5">词汇</p>
              <p className="text-slate-700 font-black text-[11px] tabular-nums">
                <span className="text-[var(--color-brand)]">{stayStats.wordCount}</span>/{stayStats.phraseCount}
              </p>
            </div>
            <div className="bg-white border border-slate-100 rounded-md p-1.5 min-w-0">
              <p className="text-[9px] text-slate-400 font-bold mb-0.5">薄弱点</p>
              <p className="text-[9px] font-medium truncate"><span className="text-red-500 font-bold">音</span> {stayStats.weakPoints.pronunciation}</p>
              <p className="text-[9px] font-medium truncate"><span className="text-[#FF5722] font-bold">法</span> {stayStats.weakPoints.grammar}</p>
            </div>
          </div>

          <div className="mt-1.5 bg-amber-50/60 border border-amber-100/60 rounded-md p-1.5 flex items-start gap-1.5 flex-1 min-h-0">
            <WarningCircle aria-hidden="true" className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" weight="fill" />
            <div className="text-[10px] leading-snug text-amber-800 font-medium min-w-0">
              <span className="font-bold">今日建议：</span>
              <span className="opacity-90 line-clamp-3">{stayStats.todaySuggestion}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
