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

  const customNote = customThemesCount > 0 ? ` · 自定义 ${customThemesCount}` : '';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between border-b border-slate-50 pb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-3.5 bg-[var(--color-brand)] rounded-full" />
          <span className="text-xs uppercase tracking-[0.12em] font-black text-slate-800">
            战略路线图
          </span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Roadmap
          </span>
        </div>
        <div className="text-[10px] text-slate-400 font-medium hidden md:block">
          请选择当前推进阶段
        </div>
      </div>

      <div className="relative bg-slate-50/50 rounded-xl p-2.5 md:p-3 border border-slate-100/60">
        <div className="absolute top-[28px] left-6 right-6 h-[2px] bg-slate-200/60 rounded-full" />

        <div className="absolute top-[28px] left-6 right-6 h-[2px] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-brand)] transition-all duration-500 ease-out"
            style={{ width: `${timelineFillPercent}%` }}
          />
        </div>

        <div className="flex justify-between items-start relative z-10">
          <div className="flex flex-col items-center">
            <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center border-2 border-[var(--color-brand)] shadow-sm mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] animate-pulse" />
            </div>
            <span className="text-[10px] font-black text-slate-800 tracking-wider">0月</span>
            <span className="text-[9px] text-slate-400 font-semibold">立项启动</span>
          </div>

          <div className="flex flex-col items-center">
            <div className={`w-4 h-4 rounded-full bg-white flex items-center justify-center border-2 transition-all duration-300 mb-1 ${
              stage === 'business' || stage === 'all'
                ? 'border-[var(--color-brand)] shadow-sm'
                : 'border-slate-300'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                stage === 'business' || stage === 'all' ? 'bg-[var(--color-brand)]' : 'bg-slate-300'
              }`} />
            </div>
            <span className={`text-[10px] font-black tracking-wider transition-colors duration-300 ${
              stage === 'business' || stage === 'all' ? 'text-slate-800' : 'text-slate-400'
            }`}>6月</span>
            <span className="text-[9px] text-slate-400 font-semibold">政务攻坚</span>
          </div>

          <div className="flex flex-col items-center">
            <div className={`w-4 h-4 rounded-full bg-white flex items-center justify-center border-2 transition-all duration-300 mb-1 ${
              stage === 'all'
                ? 'border-[var(--color-accent)] shadow-sm'
                : 'border-slate-300'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                stage === 'all' ? 'bg-[var(--color-accent)]' : 'bg-slate-300'
              }`} />
            </div>
            <span className={`text-[10px] font-black tracking-wider transition-colors duration-300 ${
              stage === 'all' ? 'text-slate-800' : 'text-slate-400'
            }`}>12月</span>
            <span className="text-[9px] text-slate-400 font-semibold">全场景覆盖</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-1.5 mt-2.5 items-center">
          <div className="bg-white/90 border border-slate-200/70 rounded-lg px-2.5 py-1.5">
            <div className="text-[9px] text-slate-400 font-black uppercase tracking-[0.15em] mb-0.5">当前推进</div>
            <div className="text-sm font-black text-slate-800 tabular-nums leading-none">{Math.round(activeProgressRatio * 100)}%</div>
          </div>

          <div className="bg-white/80 border border-slate-200/60 rounded-lg px-2.5 py-1.5">
            <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 mb-1">
              <span>轨道战果</span>
              <span className="normal-case tracking-normal font-bold text-slate-500 truncate">{activeSummary}{customNote}</span>
            </div>
            <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${stage === 'business' ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-accent)]'}`}
                style={{ width: `${Math.max(8, activeProgressRatio * 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-white/90 border border-slate-200/70 rounded-lg px-2.5 py-1.5 min-w-0">
            <div className="text-[9px] text-slate-400 font-black uppercase tracking-[0.15em] mb-0.5">当前阵地</div>
            <div className="text-xs font-bold text-slate-800 truncate" title={currentTheme}>{currentTheme}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTrackChange('business');
            }}
            className={`group text-left p-2.5 rounded-lg transition-all duration-200 cursor-pointer outline-none relative overflow-hidden border ${
              stage === 'business'
                ? 'bg-slate-50 border-[var(--color-brand)] shadow-sm'
                : 'bg-white hover:bg-slate-50 border-slate-100 hover:border-slate-200'
            }`}
          >
            {stage === 'business' && (
              <span className="absolute top-0 left-0 w-1 h-full bg-[var(--color-brand)]" />
            )}

            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm">🎯</span>
                <span className={`text-[11px] font-black uppercase tracking-wider truncate transition-colors duration-300 ${
                  stage === 'business' ? 'text-[var(--color-brand)]' : 'text-slate-700'
                }`}>
                  政务集中突破期
                </span>
              </div>

              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                stage === 'business'
                  ? 'bg-[var(--color-brand)] text-white scale-100'
                  : 'border border-slate-200 text-transparent scale-90 group-hover:border-slate-300'
              }`}>
                <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] text-slate-600 leading-snug font-medium">
                <span className="font-bold text-slate-800 mr-1">0-6个月</span> · 攻克
                <span className={`font-bold ml-1 transition-colors ${
                  stage === 'business' ? 'text-[var(--color-brand)]' : 'text-slate-800'
                }`}>10个</span> 核心场景
              </p>
              <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                <span>已攻克 {businessMasteredCount}/{businessTotal}</span>
                <span className="tabular-nums">{Math.round(businessProgressRatio * 100)}%</span>
              </div>
              <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--color-brand)] transition-all duration-500"
                  style={{ width: `${Math.max(6, businessProgressRatio * 100)}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {businessExamples.slice(0, 3).map(scene => (
                  <span
                    key={scene}
                    className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[9px] font-bold text-slate-600 border border-slate-200"
                  >
                    {scene}
                  </span>
                ))}
              </div>
            </div>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTrackChange('all');
            }}
            className={`group text-left p-2.5 rounded-lg transition-all duration-200 cursor-pointer outline-none relative overflow-hidden border ${
              stage === 'all'
                ? 'bg-slate-50 border-[var(--color-accent)] shadow-sm'
                : 'bg-white hover:bg-slate-50 border-slate-100 hover:border-slate-200'
            }`}
          >
            {stage === 'all' && (
              <span className="absolute top-0 left-0 w-1 h-full bg-[var(--color-accent)]" />
            )}

            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm">🌐</span>
                <span className={`text-[11px] font-black uppercase tracking-wider truncate transition-colors duration-300 ${
                  stage === 'all' ? 'text-[var(--color-accent)]' : 'text-slate-700'
                }`}>
                  全场景拓展期
                </span>
              </div>

              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                stage === 'all'
                  ? 'bg-[var(--color-accent)] text-white scale-100'
                  : 'border border-slate-200 text-transparent scale-90 group-hover:border-slate-300'
              }`}>
                <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] text-slate-600 leading-snug font-medium">
                <span className="font-bold text-slate-800 mr-1">0-12个月</span> · 覆盖
                <span className={`font-bold ml-1 transition-colors ${
                  stage === 'all' ? 'text-[var(--color-accent)]' : 'text-slate-800'
                }`}>16个</span> 场景
              </p>
              <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                <span>已攻克 {allMasteredCount}/{allTotal}</span>
                <span className="tabular-nums">{Math.round(allProgressRatio * 100)}%</span>
              </div>
              <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
                  style={{ width: `${Math.max(6, allProgressRatio * 100)}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {allExamples.slice(0, 3).map(scene => (
                  <span
                    key={scene}
                    className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[9px] font-bold text-slate-600 border border-slate-200"
                  >
                    {scene}
                  </span>
                ))}
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
