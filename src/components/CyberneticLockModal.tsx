import React from 'react';
import { ShieldAlert, Lock, ArrowRight, BookOpen, Mic } from 'lucide-react';

interface CyberneticLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  oralCount: number;
  maxWriteScore: number;
}

export default function CyberneticLockModal({
  isOpen,
  onClose,
  theme,
  oralCount,
  maxWriteScore
}: CyberneticLockModalProps) {
  if (!isOpen) return null;

  const isOralDone = oralCount >= 10;
  const isWriteDone = maxWriteScore >= 8;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]">
      <div className="bg-white border border-slate-200 rounded-[2rem] p-10 text-center max-w-lg shadow-[0_15px_50px_rgba(0,0,0,0.06)] animate-[slideUp_0.4s_ease-out] relative z-10 mx-4">
        {/* Elegant static icon container */}
        <div className="w-16 h-16 bg-slate-50 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-150 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
          <Lock className="w-6 h-6 text-slate-650" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-wide flex items-center justify-center gap-2">
          <ShieldAlert className="w-5 h-5 text-slate-600" />
          主题目标闭环提示
        </h2>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-4">
          Theme Target Achievement Requirement
        </span>

        <p className="text-slate-500 text-xs leading-relaxed mb-6 px-4">
          根据学习规约，当前主题的核心板块指标达成前，其他高级探索模块已锁定。
          请先在<strong className="text-slate-900 mx-1">英语引擎</strong>中完成每日口语和写作的指标闭环。
        </p>

        {/* Current Theme Info with Admin Style */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-left mb-6">
          <div className="text-[10px] text-slate-450 uppercase tracking-widest font-bold mb-1.5">当前主题阵地</div>
          <div className="text-sm font-bold text-slate-800 mb-4">{theme}</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Oral Stat Card */}
            <div className={`p-4 rounded-xl border transition-all ${
              isOralDone 
                ? 'bg-emerald-50/50 border-emerald-100' 
                : 'bg-slate-100/70 border-slate-200/60'
            }`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                  <Mic className="w-3 h-3" /> 口语沙盘
                </span>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  isOralDone 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {isOralDone ? '已达标' : '未达标'}
                </span>
              </div>
              <div className="text-base font-bold text-slate-800">
                {oralCount} <span className="text-xs text-slate-400 font-normal">/ 10 轮</span>
              </div>
            </div>

            {/* Write Stat Card */}
            <div className={`p-4 rounded-xl border transition-all ${
              isWriteDone 
                ? 'bg-emerald-50/50 border-emerald-100' 
                : 'bg-slate-100/70 border-slate-200/60'
            }`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> 纵深写作
                </span>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  isWriteDone 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {isWriteDone ? '已达标' : '未达标'}
                </span>
              </div>
              <div className="text-base font-bold text-slate-800">
                {maxWriteScore} <span className="text-xs text-slate-400 font-normal">/ 8 分</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full bg-slate-900 text-white font-bold uppercase tracking-wide py-3 rounded-xl hover:bg-slate-800 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2 text-xs"
        >
          返回主题战场
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
