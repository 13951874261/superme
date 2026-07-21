import React from 'react';
import { Target, AlignLeft, Hash, Zap } from 'lucide-react';

export interface DailyBriefingCardProps {
  quotaStatus: any;
  generatedArticle: string;
  extractedWordsCount: number;
  extractedPhrasesCount: number;
}

export function DailyBriefingCard({
  quotaStatus,
  generatedArticle,
  extractedWordsCount,
  extractedPhrasesCount
}: DailyBriefingCardProps) {
  const wordsLimit = quotaStatus?.wordsLimit || 50;
  const phrasesLimit = quotaStatus?.phrasesLimit || 30;
  const wordsUsed = quotaStatus?.wordsUsed || extractedWordsCount || 0;
  const phrasesUsed = quotaStatus?.phrasesUsed || extractedPhrasesCount || 0;

  return (
    <div className="bg-[#202124] rounded-2xl p-3 md:p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.1)] animate-[fadeIn_0.4s_ease-out] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 blur-[60px] rounded-full pointer-events-none"></div>
      
      <div className="flex items-center gap-2 mb-2.5 border-b border-white/10 pb-2">
        <Target className="w-3.5 h-3.5 text-emerald-400" />
        <h3 className="text-[10px] font-black text-white uppercase tracking-widest">今日战区简报 // Daily Briefing</h3>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex flex-col justify-between hover:bg-white/10 transition-colors min-w-0">
          <div className="flex items-center gap-1 mb-1.5 min-w-0">
            <AlignLeft className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 truncate">研读长文</span>
          </div>
          <div className="text-base font-black text-white tabular-nums">
            {generatedArticle ? '1' : '0'} <span className="text-[10px] text-gray-500 font-medium">/1</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex flex-col justify-between hover:bg-white/10 transition-colors relative overflow-hidden min-w-0">
          {wordsUsed >= wordsLimit && <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500"></div>}
          <div className="flex items-center gap-1 mb-1.5 min-w-0">
            <Hash className="w-3 h-3 text-orange-400 shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 truncate">战术词</span>
          </div>
          <div className="text-base font-black text-white tabular-nums">
            {wordsUsed} <span className="text-[10px] text-gray-500 font-medium">/{wordsLimit}</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex flex-col justify-between hover:bg-white/10 transition-colors relative overflow-hidden min-w-0">
          {phrasesUsed >= phrasesLimit && <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500"></div>}
          <div className="flex items-center gap-1 mb-1.5 min-w-0">
            <Zap className="w-3 h-3 text-[#FF5722] shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 truncate">短语</span>
          </div>
          <div className="text-base font-black text-white tabular-nums">
            {phrasesUsed} <span className="text-[10px] text-gray-500 font-medium">/{phrasesLimit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
