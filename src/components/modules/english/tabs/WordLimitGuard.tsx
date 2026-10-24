import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  /** 字数上限 */
  limit: 50 | 100 | 200;
  /** 当前文本 */
  value: string;
  /** 文本变化回调 */
  onChange: (text: string) => void;
  /** 子组件（textarea） */
  children: React.ReactNode;
}

export default function WordLimitGuard({ limit, value, onChange, children }: Props) {
  const trimmed = value.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const isOver = wordCount > limit;
  const isNear = wordCount >= limit * 0.8;
  const isClose = wordCount >= limit * 0.95;

  return (
    <div className="relative">
      {children}
      {/* 字数计数器 */}
      <div className={`absolute bottom-3 right-3 text-[10px] font-black tracking-widest px-3 py-1.5 rounded-xl transition-[background-color,border-color,box-shadow,opacity,transform] duration-300 ${
        isOver
          ? 'bg-red-500 text-white animate-pulse shadow-[0_2px_12px_rgba(239,68,68,0.5)]'
          : isClose
            ? 'bg-amber-500 text-white'
            : isNear
              ? 'bg-amber-400 text-white'
              : 'bg-zinc-200 text-zinc-500'
      }`}>
        {wordCount} / {limit} 词
        {isOver && ' ⚠️ 超限！'}
      </div>
      {/* 超限遮罩 */}
      {isOver && (
        <div className="absolute inset-0 bg-red-500/10 rounded-2xl border-2 border-red-400 pointer-events-none flex items-center justify-center">
          <div className="bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg">
            <AlertTriangle aria-hidden="true" className="w-4 h-4" />
            超限！请压缩至 {limit} 词以内
          </div>
        </div>
      )}
    </div>
  );
}
