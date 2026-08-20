import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ShieldAlert, Lock, ArrowRight, BookOpen, Mic, Mail } from 'lucide-react';
import { playGentleWarning } from '../utils/soundEffects';

interface CyberneticLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  oralCount: number;
  maxWriteScore: number;
  emailCompleted: boolean;
  pendingSentenceDebt?: string | null;
}

export default function CyberneticLockModal({
  isOpen,
  onClose,
  theme,
  oralCount,
  maxWriteScore,
  emailCompleted,
  pendingSentenceDebt
}: CyberneticLockModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      playGentleWarning();

      if (backdropRef.current && cardRef.current) {
        gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
        gsap.fromTo(
          cardRef.current,
          { opacity: 0, scale: 0.95, y: 15 },
          { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.6)' }
        );
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isOralDone = oralCount >= 10;
  const isWriteDone = maxWriteScore >= 8;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        ref={backdropRef}
        onClick={onClose}
        className="lock-modal-backdrop absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
      />

      {/* 弹窗内容 */}
      <div
        ref={cardRef}
        className="lock-modal-card bg-white border border-zinc-200/80 rounded-[2rem] p-10 text-center max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.06)] relative z-10 mx-4 w-full"
      >
        {/* Elegant static icon container */}
        <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500 shadow-sm">
          <ShieldAlert className="w-8 h-8 stroke-[1.75]" />
        </div>

        <h3 className="text-xl font-bold text-zinc-900 mb-2">日常唤醒学习未解锁</h3>
        <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
          主题：<span className="font-semibold text-zinc-800">「{theme}」</span><br />
          请先完成对应模块的训练任务，以获得全面沉浸体验。
        </p>

        {/* 校验列表 */}
        <div className="space-y-3 text-left mb-8 bg-zinc-50/80 p-5 rounded-2xl border border-zinc-100">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-medium text-zinc-700">
              <Mic className="w-4 h-4 text-zinc-400" />
              口语对练 (≥10次)
            </span>
            <span className={`px-2.5 py-1 rounded-full font-semibold ${isOralDone ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {oralCount} / 10 次
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-medium text-zinc-700">
              <BookOpen className="w-4 h-4 text-zinc-400" />
              写作打分 (≥80分)
            </span>
            <span className={`px-2.5 py-1 rounded-full font-semibold ${isWriteDone ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {maxWriteScore > 0 ? `${maxWriteScore * 10} 分` : '未打分'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-medium text-zinc-700">
              <Mail className="w-4 h-4 text-zinc-400" />
              商务 Email 处理
            </span>
            <span className={`px-2.5 py-1 rounded-full font-semibold ${emailCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {emailCompleted ? '已完成' : '未处理'}
            </span>
          </div>
        </div>

        {/* 提示信息 */}
        {pendingSentenceDebt && (
          <div className="mb-6 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 font-medium">
            提示：您尚有未清偿的生词卡片（债务：{pendingSentenceDebt}）。
          </div>
        )}

        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="w-full py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] cursor-pointer"
        >
          <span>我知道了</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}