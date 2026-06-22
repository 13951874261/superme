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
    <div className="border-t border-gray-100 pt-5 space-y-6">
      {!masteryData?.isMastered && (
        <div className="flex flex-col gap-6 md:gap-8 mt-2">
          {/* 进度展示区 */}
          <div className="flex items-center gap-6">
            {/* 环形图 */}
            <div className="shrink-0 w-20 h-20 md:w-24 md:h-24">
              <ProgressRing percentage={percentage} />
            </div>
            {/* 标签文字 */}
            <div className="flex-1 space-y-2">
              <div className="eyebrow">能力匹配度</div>
              <div className="text-3xl font-black text-[var(--color-ink-primary)]">{percentage}%</div>
              <div className="text-xs text-[var(--color-ink-muted)] font-medium">距合伙人目标</div>
            </div>
          </div>

          {/* 视觉分隔 */}
          <div className="h-px bg-[var(--color-border)] mx-2" />

          {/* 三件套状态 */}
          <div className="space-y-3 px-1">
            {items.map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--color-ink-secondary)]">{item.label}</span>
                <StatusIcon ok={item.ok} />
              </div>
            ))}
          </div>
        </div>
      )}

      {stayStats && (
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 transition-all hover:shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200/50 pb-3 mb-3.5">
            <div className="flex items-center gap-2">
              <h5 className="eyebrow text-slate-800">闭环停留分析 // Stay Analysis</h5>
            </div>
            <span className="text-[10px] bg-indigo-50 text-[var(--color-brand)] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {stayStats.stayDays > 1 ? `已停留 ${stayStats.stayDays} 天` : '第 1 天'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-600">
            <div className="bg-white/80 border border-slate-100 rounded-xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:border-indigo-100 transition-colors">
              <p className="eyebrow mb-1">停留期内练习</p>
              <p className="text-slate-700 font-black">
                已生成 <span className="text-[var(--color-brand)]">{stayStats.articleCount}</span> 篇长文
              </p>
            </div>
            <div className="bg-white/80 border border-slate-100 rounded-xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:border-indigo-100 transition-colors">
              <p className="eyebrow mb-1">累积摄入词汇</p>
              <p className="text-slate-700 font-black">
                已学 <span className="text-[var(--color-brand)]">{stayStats.wordCount}</span> 生词 / <span className="text-[var(--color-brand)]">{stayStats.phraseCount}</span> 短语
              </p>
            </div>
            <div className="bg-white/80 border border-slate-100 rounded-xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:border-red-100 transition-colors">
              <p className="eyebrow mb-1">薄弱点追踪</p>
              <div className="space-y-0.5 text-[11px] font-medium leading-relaxed">
                <p className="truncate"><span className="font-bold text-red-500">发音:</span> {stayStats.weakPoints.pronunciation}</p>
                <p className="truncate"><span className="font-bold text-[#FF5722]">语法:</span> {stayStats.weakPoints.grammar}</p>
              </div>
            </div>
          </div>

          <div className="mt-3.5 bg-amber-50/50 border border-amber-100/60 rounded-xl p-3.5 flex items-start gap-2.5">
            <WarningCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" weight="fill" />
            <div className="text-[11px] leading-relaxed text-amber-800 font-medium">
              <p className="font-bold mb-0.5">今日练习方向建议：</p>
              <p className="opacity-90">{stayStats.todaySuggestion}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
