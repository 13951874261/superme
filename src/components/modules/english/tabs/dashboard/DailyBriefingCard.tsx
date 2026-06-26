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
    <div className="bg-[#202124] rounded-3xl p-6 md:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.1)] mb-8 animate-[fadeIn_0.4s_ease-out] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[80px] rounded-full pointer-events-none"></div>
      
      <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
        <Target className="w-5 h-5 text-emerald-400" />
        <h3 className="text-xs font-black text-white uppercase tracking-widest">今日战区简报 // Daily Briefing</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/10 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <AlignLeft className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">今日研读长文</span>
          </div>
          <div className="text-2xl font-black text-white">
            {generatedArticle ? '1' : '0'} <span className="text-xs text-gray-500 font-medium ml-1">/ 1 篇</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/10 transition-colors relative overflow-hidden">
          {wordsUsed >= wordsLimit && <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>}
          <div className="flex items-center gap-2 mb-3">
            <Hash className="w-4 h-4 text-orange-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">待攻克战术词汇</span>
          </div>
          <div className="text-2xl font-black text-white">
            {wordsUsed} <span className="text-xs text-gray-500 font-medium ml-1">/ {wordsLimit} 词</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/10 transition-colors relative overflow-hidden">
          {phrasesUsed >= phrasesLimit && <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>}
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-[#FF5722]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">待掌握核心短语</span>
          </div>
          <div className="text-2xl font-black text-white">
            {phrasesUsed} <span className="text-xs text-gray-500 font-medium ml-1">/ {phrasesLimit} 组</span>
          </div>
        </div>
      </div>
    </div>
  );
}
