import React from 'react';
import { Brain, Sparkles, Image as ImageIcon, Volume2, ShieldCheck, Zap } from 'lucide-react';
import SpeakButton from '../../../../SpeakButton';
import { extractSynonymsAntonymsCollocations } from '../../../../../utils/vocabCsvExport';

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

  return (
    <div className="w-full bg-gradient-to-b from-slate-900/95 via-indigo-950/90 to-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden flex flex-col items-center">
      {/* 极光背景辉光装饰 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#FF5722]/10 rounded-full blur-2xl pointer-events-none" />

      {/* 顶部标识 */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800/80 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[11px] font-black text-indigo-300 uppercase tracking-widest">
            圆形记忆矩阵主舞台 // Memory Matrix Stage
          </span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
          全息联想卡
        </span>
      </div>

      {/* 核心舞台（圆形环状布局结构） */}
      <div className="relative w-full max-w-lg h-[340px] flex items-center justify-center my-2">
        {/* 外外环（第二环轨道） */}
        <div className="absolute inset-4 rounded-full border border-dashed border-indigo-400/20 animate-[spin_60s_linear_infinite] pointer-events-none" />
        
        {/* 内环（第一环轨道） */}
        <div className="absolute inset-20 rounded-full border border-indigo-500/30 pointer-events-none" />

        {/* ------------------ 圆心层 (Center Node) ------------------ */}
        <div className="z-20 bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 border-2 border-indigo-400/50 rounded-full w-44 h-44 shadow-[0_0_30px_rgba(79,70,229,0.3)] flex flex-col items-center justify-center p-3 text-center transform transition-transform hover:scale-105 duration-300">
          <div className="text-[10px] font-black text-indigo-200 tracking-wider flex items-center gap-1 mb-0.5">
            <Zap className="w-3 h-3 text-amber-400" />
            TARGET
          </div>
          <div className="text-xs md:text-sm font-black text-white leading-tight tracking-tight whitespace-normal max-h-12 overflow-y-auto custom-scrollbar select-all px-1">
            {cleanWord}
          </div>
          <div className="text-[10px] text-indigo-200/90 font-medium leading-tight mt-1 px-1 max-h-16 overflow-y-auto custom-scrollbar">
            {meaning}
          </div>
        </div>

        {/* ------------------ 第一环节点 (Ring 1 Nodes) ------------------ */}
        {ring1Nodes.map((node, idx) => {
          const total = ring1Nodes.length;
          const angle = (idx * (360 / total) - 90) * (Math.PI / 180);
          const radius = 135; // 距离圆心的像素半径
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <div
              key={idx}
              style={{ transform: `translate(${x}px, ${y}px)` }}
              className="absolute z-10 bg-slate-800/95 hover:bg-indigo-950 border border-indigo-400/50 hover:border-indigo-300 text-slate-100 px-3 py-1.5 rounded-2xl text-[11px] font-bold shadow-lg backdrop-blur-md transition-[background-color,border-color,box-shadow,opacity,transform] duration-300 flex items-center gap-1.5 cursor-default hover:scale-110 max-w-[160px]"
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${node.type === 'synonym' ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
              <span className="whitespace-normal leading-tight text-center max-h-12 overflow-y-auto custom-scrollbar">{node.text}</span>
            </div>
          );
        })}

        {/* ------------------ 第二环节点 (Ring 2 Outer Nodes) ------------------ */}
        {/* 左上: 词根词缀 */}
        {rootText && (
          <div className="absolute top-0 left-0 z-10 bg-slate-900/95 border border-slate-700 text-slate-200 p-2.5 rounded-xl text-[10px] font-medium shadow-md backdrop-blur-sm max-w-[200px] max-h-20 overflow-y-auto leading-relaxed custom-scrollbar">
            🌱 {rootText}
          </div>
        )}

        {/* 右上: 趣味联想 */}
        {assocText && (
          <div className="absolute top-0 right-0 z-10 bg-slate-900/95 border border-slate-700 text-slate-200 p-2.5 rounded-xl text-[10px] font-medium shadow-md backdrop-blur-sm max-w-[200px] max-h-20 overflow-y-auto leading-relaxed custom-scrollbar">
            💡 {assocText}
          </div>
        )}

        {/* 右下: AI 脑图画卷入口 */}
        <div className="absolute bottom-1 right-1 z-10">
          {imageUrl ? (
            <div className="w-14 h-14 rounded-xl border border-indigo-400/50 overflow-hidden shadow-lg group relative">
              <img src={imageUrl} alt="AI 记忆脑图" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ImageIcon className="w-4 h-4 text-white" />
              </div>
            </div>
          ) : (
            <button
              onClick={onGenerateImageClick}
              className="bg-indigo-600/80 hover:bg-indigo-500 border border-indigo-400/50 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-md transition-colors active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              生成脑图
            </button>
          )}
        </div>
      </div>

      {/* ------------------ 下沿记忆钩子与操作辅助条 ------------------ */}
      <div className="w-full border-t border-slate-800/90 pt-3 mt-2 flex items-start justify-between gap-3 text-xs text-slate-300 font-medium">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Brain className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-indigo-200 italic leading-relaxed max-h-16 overflow-y-auto custom-scrollbar pr-1">
            "{memoryAids?.mnemonic_phrase || `掌握 ${cleanWord} 的核心搭配与场景分寸，提升商务表达气场`}"
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SpeakButton text={cleanWord} title="播放音轨" className="w-7 h-7 bg-slate-800 hover:bg-indigo-600 border border-slate-700 rounded-lg flex items-center justify-center" iconClassName="w-3.5 h-3.5 text-white" />
        </div>
      </div>
    </div>
  );
}
