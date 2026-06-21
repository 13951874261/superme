import React from 'react';

export interface StayAnalysisPanelProps {
  masteryData: any;
  impromptuPassed: boolean;
  stayStats: any;
}

export function StayAnalysisPanel({ masteryData, impromptuPassed, stayStats }: StayAnalysisPanelProps) {
  return (
    <div className="border-t border-gray-100 pt-5">
      {!masteryData?.isMastered && (
        <div className="text-[10px] text-gray-500 font-medium mb-3">
          当前通关进度：口语对抗 {masteryData?.oralCount || 0}/10 轮 | L3 书面最高分 {masteryData?.maxWriteScore || 0}/8 分 | 即兴演讲 {impromptuPassed ? '✅已达标' : '⚠️未达标'}
        </div>
      )}

      {stayStats && (
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 transition-all hover:shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200/50 pb-3 mb-3.5">
            <div className="flex items-center gap-2">
              <span className="text-sm">📊</span>
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-800">
                闭环停留分析 <span className="text-slate-400">// Stay Analysis</span>
              </h5>
            </div>
            <span className="text-[10px] bg-indigo-50 text-[var(--color-brand)] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {stayStats.stayDays > 1 ? `已停留 ${stayStats.stayDays} 天` : '第 1 天'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-600">
            <div className="bg-white/80 border border-slate-100 rounded-xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:border-indigo-100 transition-colors">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">📅 停留期内练习</p>
              <p className="text-slate-700 font-black">
                已生成 <span className="text-[var(--color-brand)]">{stayStats.articleCount}</span> 篇长文
              </p>
            </div>
            <div className="bg-white/80 border border-slate-100 rounded-xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:border-indigo-100 transition-colors">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">📚 累积摄入词汇</p>
              <p className="text-slate-700 font-black">
                已学 <span className="text-[var(--color-brand)]">{stayStats.wordCount}</span> 生词 / <span className="text-[var(--color-brand)]">{stayStats.phraseCount}</span> 短语
              </p>
            </div>
            <div className="bg-white/80 border border-slate-100 rounded-xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:border-red-100 transition-colors">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">⚠️ 薄弱点追踪</p>
              <div className="space-y-0.5 text-[11px] font-medium leading-relaxed">
                <p className="truncate"><span className="font-bold text-red-500">发音:</span> {stayStats.weakPoints.pronunciation}</p>
                <p className="truncate"><span className="font-bold text-[#FF5722]">语法:</span> {stayStats.weakPoints.grammar}</p>
              </div>
            </div>
          </div>

          <div className="mt-3.5 bg-amber-50/50 border border-amber-100/60 rounded-xl p-3.5 flex items-start gap-2.5">
            <span className="text-amber-500 shrink-0 text-sm mt-0.5">💡</span>
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
