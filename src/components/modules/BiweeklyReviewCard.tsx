import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface BiweeklyReviewCardProps {
  daysSinceReview: number;
  onOpen: () => void;
}

export default function BiweeklyReviewCard({ daysSinceReview, onOpen }: BiweeklyReviewCardProps) {
  return (
    <div className="mx-5 my-3 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 animate-fade-in">
      <div className="flex items-center gap-2 text-amber-800 text-[11px] font-bold">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 animate-pulse" />
        <span>复盘纠偏窗口已开启</span>
      </div>
      <p className="text-[10px] text-amber-600 leading-relaxed font-medium">
        距离上次复盘已过 {daysSinceReview} 天。为保证训练方向的匹配度，请及时提交复盘报告。
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
      >
        <RefreshCw className="w-3 h-3" />
        立即开启弱点扫描
      </button>
    </div>
  );
}
