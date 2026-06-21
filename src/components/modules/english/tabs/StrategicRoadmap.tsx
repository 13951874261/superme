import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ALL_THEMES, BUSINESS_THEMES, StageTrack } from '../context/EnglishContext';

interface StrategicRoadmapProps {
  stage: StageTrack;
  handleTrackChange: (newTrack: StageTrack) => void;
  masteredThemes: string[];
  customThemesCount: number;
  currentTheme: string;
}

const businessThemeValues = BUSINESS_THEMES.map(item => item.value);
const allThemeValues = ALL_THEMES.map(item => item.value);

const toSceneChip = (label: string) => label.split('：')[0] || label;

export default function StrategicRoadmap({
  stage,
  handleTrackChange,
  masteredThemes,
  customThemesCount,
  currentTheme,
}: StrategicRoadmapProps) {
  const uniqueMasteredThemes = Array.from(new Set(masteredThemes));
  const businessThemeSet = new Set(businessThemeValues);
  const allThemeSet = new Set(allThemeValues);

  const businessTotal = businessThemeValues.length;
  const allTotal = allThemeValues.length;

  const businessMasteredCount = uniqueMasteredThemes.filter(theme => businessThemeSet.has(theme)).length;
  const allMasteredCount = uniqueMasteredThemes.filter(theme => allThemeSet.has(theme)).length;

  const businessProgressRatio = businessTotal > 0 ? businessMasteredCount / businessTotal : 0;
  const allProgressRatio = allTotal > 0 ? allMasteredCount / allTotal : 0;
  const activeProgressRatio = stage === 'business' ? businessProgressRatio : allProgressRatio;

  const timelineFillPercent = stage === 'business'
    ? Math.min(50, Math.max(0, businessProgressRatio * 50))
    : Math.min(100, Math.max(0, allProgressRatio * 100));

  const activeSummary = stage === 'business'
    ? `已攻克 ${businessMasteredCount}/${businessTotal} 个政务场景`
    : `已攻克 ${allMasteredCount}/${allTotal} 个全场景主题`;

  const businessExamples = BUSINESS_THEMES.slice(0, 4).map(item => toSceneChip(item.label));
  const allExamples = [ALL_THEMES[0], ALL_THEMES[10], ALL_THEMES[11], ALL_THEMES[15]]
    .filter(Boolean)
    .map(item => toSceneChip(item.label));

  const currentThemeInBusinessTrack = businessThemeSet.has(currentTheme);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between border-b border-slate-50 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-4 bg-[var(--color-brand)] rounded-full" />
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

      <div className="relative bg-slate-50/50 rounded-2xl p-6 md:p-8 border border-slate-100/60">
        <div className="absolute top-[43px] left-10 right-10 h-[3px] bg-slate-200/60 rounded-full" />

        <div className="absolute top-[43px] left-10 right-10 h-[3px] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-brand)] transition-all duration-500 ease-out"
            style={{ width: `${timelineFillPercent}%` }}
          />
        </div>

        <div className="flex justify-between items-start relative z-10">
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border-2 border-[var(--color-brand)] shadow-[0_2px_8px_rgba(0,0,0,0.05)] mb-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-brand)] animate-pulse" />
            </div>
            <span className="text-[11px] font-black text-slate-800 tracking-wider">0月</span>
            <span className="text-[9px] text-slate-400 font-semibold mt-0.5">立项启动</span>
          </div>

          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full bg-white flex items-center justify-center border-2 transition-all duration-300 mb-2.5 ${
              stage === 'business' || stage === 'all'
                ? 'border-[var(--color-brand)] shadow-[0_2px_8px_rgba(0,0,0,0.05)]'
                : 'border-slate-300'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                stage === 'business' || stage === 'all' ? 'bg-[var(--color-brand)]' : 'bg-slate-300'
              }`} />
            </div>
            <span className={`text-[11px] font-black tracking-wider transition-colors duration-300 ${
              stage === 'business' || stage === 'all' ? 'text-slate-800' : 'text-slate-400'
            }`}>6月</span>
            <span className="text-[9px] text-slate-400 font-semibold mt-0.5">政务攻坚</span>
          </div>

          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full bg-white flex items-center justify-center border-2 transition-all duration-300 mb-2.5 ${
              stage === 'all'
                ? 'border-[var(--color-accent)] shadow-[0_2px_8px_rgba(0,0,0,0.05)]'
                : 'border-slate-300'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                stage === 'all' ? 'bg-[var(--color-accent)]' : 'bg-slate-300'
              }`} />
            </div>
            <span className={`text-[11px] font-black tracking-wider transition-colors duration-300 ${
              stage === 'all' ? 'text-slate-800' : 'text-slate-400'
            }`}>12月</span>
            <span className="text-[9px] text-slate-400 font-semibold mt-0.5">全场景覆盖</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-3 mt-7 items-center">
          <div className="bg-white/90 border border-slate-200/70 rounded-xl px-3.5 py-2.5 shadow-[0_4px_12px_rgba(0,0,0,0.015)]">
            <div className="text-[9px] text-slate-400 font-black uppercase tracking-[0.18em] mb-1">当前推进</div>
            <div className="text-sm font-black text-slate-800">{Math.round(activeProgressRatio * 100)}%</div>
          </div>

          <div className="bg-white/80 border border-slate-200/60 rounded-xl px-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.015)]">
            <div className="flex items-center justify-between gap-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 mb-2">
              <span>轨道战果</span>
              <span>{activeSummary}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${stage === 'business' ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-accent)]'}`}
                style={{ width: `${Math.max(8, activeProgressRatio * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500 font-medium">
              <span>{stage === 'business' ? '主线推进至 6 月节点' : '主线推进至 12 月节点'}</span>
              <span>{customThemesCount > 0 ? `另有 ${customThemesCount} 个自定义场景` : '系统主线 16 个固定场景'}</span>
            </div>
          </div>

          <div className="bg-white/90 border border-slate-200/70 rounded-xl px-3.5 py-2.5 shadow-[0_4px_12px_rgba(0,0,0,0.015)] min-w-0">
            <div className="text-[9px] text-slate-400 font-black uppercase tracking-[0.18em] mb-1">当前阵地</div>
            <div className="text-xs font-bold text-slate-800 truncate" title={currentTheme}>{currentTheme}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-8">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTrackChange('business');
            }}
            className={`group text-left p-6 rounded-2xl transition-all duration-300 cursor-pointer outline-none relative overflow-hidden border ${
              stage === 'business'
                ? 'bg-slate-50 border-[var(--color-brand)] shadow-sm'
                : 'bg-white hover:bg-slate-50 border-slate-100 hover:border-slate-200'
            }`}
          >
            {stage === 'business' && (
              <span className="absolute top-0 left-0 w-1.5 h-full bg-[var(--color-brand)]" />
            )}

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl filter drop-shadow-sm group-hover:scale-110 transition-transform duration-300">🎯</span>
                <span className={`text-xs font-black uppercase tracking-wider transition-colors duration-300 ${
                  stage === 'business' ? 'text-[var(--color-brand)]' : 'text-slate-700'
                }`}>
                  政务集中突破期
                </span>
              </div>

              <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
                stage === 'business'
                  ? 'bg-[var(--color-brand)] text-white scale-100'
                  : 'border border-slate-200 text-transparent scale-90 group-hover:border-slate-300'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                <span className="font-bold text-slate-800 mr-1.5">0-6个月</span> · 集中攻克
                <span className={`font-bold ml-1.5 transition-colors ${
                  stage === 'business' ? 'text-[var(--color-brand)]' : 'text-slate-800'
                }`}>10个</span> 核心商务场景
              </p>
              <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                <span>已攻克 {businessMasteredCount}/{businessTotal}</span>
                <span>{Math.round(businessProgressRatio * 100)}% 已推进</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--color-brand)] transition-all duration-500"
                  style={{ width: `${Math.max(6, businessProgressRatio * 100)}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {businessExamples.map(scene => (
                  <span
                    key={scene}
                    className="px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 border border-slate-200"
                  >
                    {scene}
                  </span>
                ))}
              </div>
              <div className="pt-1 text-[10px] text-slate-500 font-medium leading-relaxed">
                {currentThemeInBusinessTrack
                  ? '当前阵地位于政务主线，可直接在本轨道内推进闭环。'
                  : '当前阵地不在政务主线内，可先打通主线后再向外扩展。'}
              </div>
            </div>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTrackChange('all');
            }}
            className={`group text-left p-6 rounded-2xl transition-all duration-300 cursor-pointer outline-none relative overflow-hidden border ${
              stage === 'all'
                ? 'bg-slate-50 border-[var(--color-accent)] shadow-sm'
                : 'bg-white hover:bg-slate-50 border-slate-100 hover:border-slate-200'
            }`}
          >
            {stage === 'all' && (
              <span className="absolute top-0 left-0 w-1.5 h-full bg-[var(--color-accent)]" />
            )}

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl filter drop-shadow-sm group-hover:scale-110 transition-transform duration-300">🌐</span>
                <span className={`text-xs font-black uppercase tracking-wider transition-colors duration-300 ${
                  stage === 'all' ? 'text-[var(--color-accent)]' : 'text-slate-700'
                }`}>
                  全场景拓展期
                </span>
              </div>

              <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
                stage === 'all'
                  ? 'bg-[var(--color-accent)] text-white scale-100'
                  : 'border border-slate-200 text-transparent scale-90 group-hover:border-slate-300'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                <span className="font-bold text-slate-800 mr-1.5">0-12个月</span> · 覆盖
                <span className={`font-bold ml-1.5 transition-colors ${
                  stage === 'all' ? 'text-[var(--color-accent)]' : 'text-slate-800'
                }`}>16个</span> 场景（含政务10场景）
              </p>
              <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                <span>已攻克 {allMasteredCount}/{allTotal}</span>
                <span>{Math.round(allProgressRatio * 100)}% 已推进</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
                  style={{ width: `${Math.max(6, allProgressRatio * 100)}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {allExamples.map(scene => (
                  <span
                    key={scene}
                    className="px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 border border-slate-200"
                  >
                    {scene}
                  </span>
                ))}
              </div>
              <div className="pt-1 text-[10px] text-slate-500 font-medium leading-relaxed">
                覆盖政务、跨文化社交、应急沟通等复合语境，适合作为主线打通后的外延扩张轨道。
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
