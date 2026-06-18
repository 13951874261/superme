import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { StageTrack } from '../context/EnglishContext';

interface StrategicRoadmapProps {
  stage: StageTrack;
  handleTrackChange: (newTrack: StageTrack) => void;
}

export default function StrategicRoadmap({ stage, handleTrackChange }: StrategicRoadmapProps) {
  // Determine timeline progress based on selected stage
  // 'business' means completed up to 6 months (50%)
  // 'all' means completed up to 12 months (100%)
  const progressPercent = stage === 'all' ? 'w-full' : 'w-1/2';

 return (
    <div className="flex flex-col gap-5">
      {/* 标题区 */}
      <div className="flex items-center justify-between border-b border-slate-50 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-4 bg-gradient-to-b from-[#FF5722] to-orange-400 rounded-full" />
          <span className="text-xs uppercase tracking-[0.15em] font-black text-slate-800">
            战略路线图
          </span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Roadmap
          </span>
        </div>
        <div className="text-[10px] text-slate-400 font-medium">
          请选择当前推进阶段 · Select Track Stage
        </div>
      </div>

      {/* 时间轴进度模块 */}
      <div className="relative bg-slate-50/50 rounded-2xl p-6 md:p-8 border border-slate-100/60">
        {/* 背景轨道线 */}
        <div className="absolute top-[43px] left-10 right-10 h-[3px] bg-slate-200/60 rounded-full" />

        {/* 动态激活进度条 */}
        <div className="absolute top-[43px] left-10 right-10 h-[3px] rounded-full overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r from-orange-500 via-orange-400 to-indigo-500 transition-all duration-500 ease-out ${progressPercent}`} 
          />
        </div>

        {/* 时间节点 */}
        <div className="flex justify-between items-start relative z-10">
          {/* 0月节点 - 起始阶段 (始终激活) */}
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border-2 border-orange-500 shadow-sm shadow-orange-100 mb-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
            </div>
            <span className="text-[11px] font-black text-slate-800 tracking-wider">0月</span>
            <span className="text-[9px] text-slate-400 font-semibold mt-0.5">立项启动</span>
          </div>

          {/* 6月节点 - 突破期 (在 business 或 all 时处于激活态) */}
          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full bg-white flex items-center justify-center border-2 transition-all duration-300 mb-2.5 ${
              stage === 'business' || stage === 'all'
                ? 'border-orange-500 shadow-sm shadow-orange-100'
                : 'border-slate-300'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                stage === 'business' || stage === 'all' ? 'bg-orange-500' : 'bg-slate-300'
              }`} />
            </div>
            <span className={`text-[11px] font-black tracking-wider transition-colors duration-300 ${
              stage === 'business' || stage === 'all' ? 'text-slate-800' : 'text-slate-400'
            }`}>6月</span>
            <span className="text-[9px] text-slate-400 font-semibold mt-0.5">政务攻坚</span>
          </div>

          {/* 12月节点 - 拓展期 (仅在 all 时处于激活态) */}
          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full bg-white flex items-center justify-center border-2 transition-all duration-300 mb-2.5 ${
              stage === 'all'
                ? 'border-indigo-500 shadow-sm shadow-indigo-100'
                : 'border-slate-300'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                stage === 'all' ? 'bg-indigo-500' : 'bg-slate-300'
              }`} />
            </div>
            <span className={`text-[11px] font-black tracking-wider transition-colors duration-300 ${
              stage === 'all' ? 'text-slate-800' : 'text-slate-400'
            }`}>12月</span>
            <span className="text-[9px] text-slate-400 font-semibold mt-0.5">全场景覆盖</span>
          </div>
        </div>

        {/* 双轨道卡片区 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-8">
          {/* 政务集中突破期轨道 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTrackChange('business');
            }}
            className={`group text-left p-6 rounded-2xl transition-all duration-300 cursor-pointer outline-none relative overflow-hidden border ${
              stage === 'business'
                ? 'bg-gradient-to-br from-orange-50/40 via-white to-white border-orange-500/80 shadow-[0_12px_24px_rgba(255,87,34,0.06)]'
                : 'bg-white hover:bg-slate-50/50 border-slate-100 hover:border-slate-200 hover:shadow-sm'
            }`}
          >
            {/* 选中光晕效果 */}
            {stage === 'business' && (
              <span className="absolute top-0 left-0 w-1.5 h-full bg-orange-500" />
            )}

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl filter drop-shadow-sm group-hover:scale-110 transition-transform duration-300">🎯</span>
                <span className={`text-xs font-black uppercase tracking-wider transition-colors duration-300 ${
                  stage === 'business' ? 'text-[#FF5722]' : 'text-slate-700'
                }`}>
                  政务集中突破期
                </span>
              </div>
              
              {/* 精细化复选标记 */}
              <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
                stage === 'business' 
                  ? 'bg-orange-500 text-white scale-100' 
                  : 'border border-slate-200 text-transparent scale-90 group-hover:border-slate-300'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                <span className="font-bold text-slate-800 mr-1.5">0-6个月</span> · 集中攻克
                <span className={`font-bold ml-1.5 transition-colors ${
                  stage === 'business' ? 'text-[#FF5722]' : 'text-slate-800'
                }`}>10个</span> 核心商务场景
              </p>
              <p className="text-[10px] text-slate-400/90 font-medium">
                商务谈判、危机公关、项目汇报...
              </p>
            </div>
          </button>

          {/* 全场景拓展期轨道 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTrackChange('all');
            }}
            className={`group text-left p-6 rounded-2xl transition-all duration-300 cursor-pointer outline-none relative overflow-hidden border ${
              stage === 'all'
                ? 'bg-gradient-to-br from-indigo-50/40 via-white to-white border-indigo-500/80 shadow-[0_12px_24px_rgba(99,102,241,0.06)]'
                : 'bg-white hover:bg-slate-50/50 border-slate-100 hover:border-slate-200 hover:shadow-sm'
            }`}
          >
            {/* 选中光晕效果 */}
            {stage === 'all' && (
              <span className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
            )}

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl filter drop-shadow-sm group-hover:scale-110 transition-transform duration-300">🌐</span>
                <span className={`text-xs font-black uppercase tracking-wider transition-colors duration-300 ${
                  stage === 'all' ? 'text-indigo-600' : 'text-slate-700'
                }`}>
                  全场景拓展期
                </span>
              </div>

              {/* 精细化复选标记 */}
              <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
                stage === 'all' 
                  ? 'bg-indigo-500 text-white scale-100' 
                  : 'border border-slate-200 text-transparent scale-90 group-hover:border-slate-300'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                <span className="font-bold text-slate-800 mr-1.5">0-12个月</span> · 覆盖
                <span className={`font-bold ml-1.5 transition-colors ${
                  stage === 'all' ? 'text-indigo-500' : 'text-slate-800'
                }`}>16个</span> 场景（含政务10场景）
              </p>
              <p className="text-[10px] text-slate-400/90 font-medium">
                政务 + 跨文化社交 + 应急沟通...
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
