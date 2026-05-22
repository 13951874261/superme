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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-[fadeIn_0.3s_ease-out]">
      <div className="bg-[#1C1C1E] border border-red-500/30 rounded-[2rem] p-10 text-center max-w-lg shadow-[0_0_80px_rgba(239,68,68,0.15)] animate-[slideUp_0.4s_ease-out] relative z-10 mx-4">
        {/* Glow alert icon container */}
        <div className="w-20 h-20 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20 relative">
          <div className="absolute inset-0 rounded-full bg-red-500/5 animate-ping opacity-75"></div>
          <Lock className="w-10 h-10" />
        </div>

        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-widest flex items-center justify-center gap-2">
          <ShieldAlert className="w-6 h-6 text-red-500" />
          控制论闭环阻断器激活
        </h2>
        <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest block mb-4">
          Cybernetic Closed-Loop Interceptor Active
        </span>

        <p className="text-gray-400 text-xs leading-relaxed mb-6">
          根据全局控制论规约，当前阵地未被完全攻克前，全站其他模块已被锁定。<br />
          请先在 <strong className="text-white">英语引擎</strong> 模块中完成当前主题的每日闭环指标。
        </p>

        {/* Current Theme Info */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left mb-6">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1.5">当前战役阵地</div>
          <div className="text-sm font-bold text-white mb-4">{theme}</div>

          <div className="grid grid-cols-2 gap-4">
            {/* Oral Stat Card */}
            <div className={`p-3.5 rounded-xl border transition-all ${isOralDone ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/5 border-red-500/10'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                  <Mic className="w-3 h-3" /> 口语沙盘
                </span>
                <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${isOralDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {isOralDone ? '已达标' : '未达标'}
                </span>
              </div>
              <div className="text-lg font-black text-white">
                {oralCount} <span className="text-xs text-gray-500 font-normal">/ 10 轮</span>
              </div>
            </div>

            {/* Write Stat Card */}
            <div className={`p-3.5 rounded-xl border transition-all ${isWriteDone ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/5 border-red-500/10'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> 纵深写作
                </span>
                <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${isWriteDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {isWriteDone ? '已达标' : '未达标'}
                </span>
              </div>
              <div className="text-lg font-black text-white">
                {maxWriteScore} <span className="text-xs text-gray-500 font-normal">/ 8 分</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full bg-red-600 text-white font-black uppercase tracking-widest py-3.5 rounded-xl hover:bg-red-500 transition-colors shadow-lg shadow-red-950/20 cursor-pointer flex items-center justify-center gap-2 text-xs"
        >
          重返核心战场
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
