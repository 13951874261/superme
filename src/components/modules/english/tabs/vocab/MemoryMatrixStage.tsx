import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Brain, Sparkles, Image as ImageIcon, Zap } from 'lucide-react';
import SpeakButton from '../../../../SpeakButton';
import { extractSynonymsAntonymsCollocations } from '../../../../../utils/vocabCsvExport';

gsap.registerPlugin(useGSAP);

interface MemoryMatrixStageProps {
  word: string;
  payload: any;
  memoryAids?: {
    root_memory?: string;
    association_memory?: string;
    mnemonic_phrase?: string;
    image_url?: string;
    image_prompt?: string;
  } | null;
  onGenerateImageClick?: () => void;
}

export default function MemoryMatrixStage({
  word,
  payload,
  memoryAids,
  onGenerateImageClick,
}: MemoryMatrixStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const { synonyms, collocations } = extractSynonymsAntonymsCollocations(word, payload);

  const cleanWord = (word || '').trim();
  const meaning = payload?.meaning_zh || payload?.translation_main || payload?.definition || payload?.meaning || '核心商务词汇';

  // 1. 第一环节点（4 ~ 6 个）：近义词 + 高频搭配
  const ring1Nodes: Array<{ text: string; type: 'synonym' | 'collocation' }> = [];
  synonyms.slice(0, 3).forEach((s) => ring1Nodes.push({ text: s, type: 'synonym' }));
  collocations.slice(0, 3).forEach((c) => ring1Nodes.push({ text: c, type: 'collocation' }));

  // 2. 第二环节点：助记钩子、词根摘要、脑图图例（全量展示，取消截断）
  const rootText = memoryAids?.root_memory ? `词根: ${memoryAids.root_memory}` : null;
  const assocText = memoryAids?.association_memory ? `联想: ${memoryAids.association_memory}` : null;
  const imageUrl = memoryAids?.image_url;

  useGSAP(
    () => {
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) return;

      gsap.from('.mm-center', {
        opacity: 0,
        scale: 0.85,
        duration: 0.35,
        ease: 'power2.out',
      });
      gsap.from('.mm-node', {
        opacity: 0,
        scale: 0.9,
        y: 8,
        duration: 0.32,
        stagger: 0.06,
        delay: 0.08,
        ease: 'power2.out',
      });
    },
    {
      scope: stageRef,
      dependencies: [cleanWord, ring1Nodes.length, rootText, assocText, imageUrl],
      revertOnUpdate: true,
    }
  );

  return (
    <div
      ref={stageRef}
      className="w-full bg-gradient-to-b from-slate-700/40 via-slate-900 to-slate-950 text-white rounded-xl p-3.5 border border-slate-700/60 shadow-md relative overflow-hidden flex flex-col items-center"
    >
      {/* 极光背景辉光装饰（减弱） */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-indigo-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#FF5722]/8 rounded-full blur-2xl pointer-events-none" />

      {/* 顶部标识 */}
      <div className="w-full flex items-center justify-between pb-2 border-b border-slate-700/70 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
            圆形记忆矩阵 // Memory Matrix
          </span>
        </div>
        <span className="text-[9px] font-bold text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
          全息联想卡
        </span>
      </div>

      {/* 核心舞台（圆形环状布局结构） */}
      <div className="relative w-full max-w-md h-[220px] flex items-center justify-center my-0">
        {/* 外外环（第二环轨道） */}
        <div className="absolute inset-2 rounded-full border border-dashed border-indigo-400/20 animate-[spin_60s_linear_infinite] pointer-events-none" />

        {/* 内环（第一环轨道） */}
        <div className="absolute inset-12 rounded-full border border-indigo-500/30 pointer-events-none" />

        {/* ------------------ 圆心层 (Center Node) ------------------ */}
        <div className="mm-center z-20 bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 border-2 border-indigo-400/50 rounded-full w-28 h-28 shadow-[0_0_18px_rgba(79,70,229,0.22)] flex flex-col items-center justify-center p-2 text-center transform transition-transform hover:scale-105 duration-300">
          <div className="text-[9px] font-black text-indigo-200 tracking-wider flex items-center gap-1 mb-0.5">
            <Zap className="w-3 h-3 text-amber-400" />
            TARGET
          </div>
          <div className="text-xs font-black text-white leading-tight tracking-tight whitespace-normal max-h-10 overflow-y-auto custom-scrollbar select-all px-1">
            {cleanWord}
          </div>
          <div className="text-[9px] text-indigo-200/90 font-medium leading-tight mt-1 px-1 max-h-12 overflow-y-auto custom-scrollbar">
            {meaning}
          </div>
        </div>

        {/* ------------------ 第一环节点 (Ring 1 Nodes) ------------------ */}
        {ring1Nodes.map((node, idx) => {
          const total = ring1Nodes.length;
          const angle = (idx * (360 / total) - 90) * (Math.PI / 180);
          const radius = 88;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <div
              key={idx}
              style={{ transform: `translate(${x}px, ${y}px)` }}
              className="mm-node absolute z-10 bg-slate-800/95 hover:bg-indigo-950 border border-indigo-400/50 hover:border-indigo-300 text-slate-100 px-2.5 py-1 rounded-xl text-[10px] font-bold shadow-lg backdrop-blur-md transition-[background-color,border-color,box-shadow,opacity,transform] duration-300 flex items-center gap-1.5 cursor-default hover:scale-110 max-w-[140px]"
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${node.type === 'synonym' ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
              <span className="whitespace-normal leading-tight text-center max-h-10 overflow-y-auto custom-scrollbar">{node.text}</span>
            </div>
          );
        })}

        {/* ------------------ 第二环节点 (Ring 2 Outer Nodes) ------------------ */}
        {rootText && (
          <div className="mm-node absolute top-0 left-0 z-10 bg-slate-900/95 border border-slate-700 text-slate-200 p-2 rounded-lg text-[9px] font-medium shadow-md backdrop-blur-sm max-w-[170px] max-h-16 overflow-y-auto leading-relaxed custom-scrollbar">
            🌱 {rootText}
          </div>
        )}

        {assocText && (
          <div className="mm-node absolute top-0 right-0 z-10 bg-slate-900/95 border border-slate-700 text-slate-200 p-2 rounded-lg text-[9px] font-medium shadow-md backdrop-blur-sm max-w-[170px] max-h-16 overflow-y-auto leading-relaxed custom-scrollbar">
            💡 {assocText}
          </div>
        )}

        <div className="mm-node absolute bottom-1 right-1 z-10">
          {imageUrl ? (
            <div className="w-12 h-12 rounded-lg border border-indigo-400/50 overflow-hidden shadow-lg group relative">
              <img src={imageUrl} alt="AI 记忆脑图" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ImageIcon className="w-4 h-4 text-white" />
              </div>
            </div>
          ) : (
            <button
              onClick={onGenerateImageClick}
              className="bg-indigo-600/80 hover:bg-indigo-500 border border-indigo-400/50 text-white text-[9px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-md transition-colors active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              生成脑图
            </button>
          )}
        </div>
      </div>

      {/* ------------------ 下沿记忆钩子与操作辅助条 ------------------ */}
      <div className="w-full border-t border-slate-800/90 pt-2 mt-1.5 flex items-start justify-between gap-2 text-xs text-slate-300 font-medium">
        <div className="flex items-start gap-1.5 flex-1 min-w-0">
          <Brain className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-[10px] text-indigo-200 italic leading-relaxed max-h-12 overflow-y-auto custom-scrollbar pr-1">
            "{memoryAids?.mnemonic_phrase || `掌握 ${cleanWord} 的核心搭配与场景分寸，提升商务表达气场`}"
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SpeakButton text={cleanWord} title="播放音轨" className="w-6 h-6 bg-slate-800 hover:bg-indigo-600 border border-slate-700 rounded-md flex items-center justify-center" iconClassName="w-3 h-3 text-white" />
        </div>
      </div>
    </div>
  );
}
