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

  const stats = [
    {
      icon: <AlignLeft aria-hidden="true" className="w-3 h-3 text-emerald-400 shrink-0" />,
      label: '研读长文',
      value: generatedArticle ? '1' : '0',
      limit: '1',
      done: !!generatedArticle,
    },
    {
      icon: <Hash aria-hidden="true" className="w-3 h-3 text-orange-400 shrink-0" />,
      label: '战术词',
      value: String(wordsUsed),
      limit: String(wordsLimit),
      done: wordsUsed >= wordsLimit,
    },
    {
      icon: <Zap aria-hidden="true" className="w-3 h-3 text-[#FF5722] shrink-0" />,
      label: '短语',
      value: String(phrasesUsed),
      limit: String(phrasesLimit),
      done: phrasesUsed >= phrasesLimit,
    },
  ];

  return (
    <div className="bg-[#202124] rounded-xl p-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.12)] relative overflow-hidden h-full flex flex-col min-h-0">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-[50px] rounded-full pointer-events-none" aria-hidden="true" />
      
      <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-1.5 shrink-0 relative z-10">
        <Target aria-hidden="true" className="w-3.5 h-3.5 text-emerald-400" />
        <h3 className="text-[10px] font-black text-white uppercase tracking-widest">今日战区简报</h3>
      </div>

      <div className="grid grid-cols-3 gap-1.5 flex-1 min-h-0 relative z-10">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white/5 border border-white/10 rounded-lg p-2 flex flex-col justify-between hover:bg-white/10 transition-colors min-w-0 relative overflow-hidden h-full"
          >
            {stat.done && <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500" />}
            <div className="flex items-center gap-1 min-w-0">
              {stat.icon}
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 truncate">{stat.label}</span>
            </div>
            <div className="text-sm font-black text-white tabular-nums mt-1">
              {stat.value} <span className="text-[10px] text-gray-500 font-medium">/{stat.limit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
