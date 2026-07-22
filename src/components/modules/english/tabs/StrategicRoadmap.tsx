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
    ? `已攻克 ${businessMasteredCount}/${businessTotal}`
    : `已攻克 ${allMasteredCount}/${allTotal}`;

  const businessExamples = BUSINESS_THEMES.slice(0, 3).map(item => toSceneChip(item.label));
  const allExamples = [ALL_THEMES[0], ALL_THEMES[10], ALL_THEMES[15]]
    .filter(Boolean)
    .map(item => toSceneChip(item.label));

  const customNote = customThemesCount > 0 ? ` · 自定义 ${customThemesCount}` : '';

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1.5 h-3.5 bg-[var(--color-brand)] rounded-full shrink-0" />
          <span className="text-xs uppercase tracking-[0.1em] font-black text-slate-800">战略路线图</span>
          <span className="text-[10px] text-slate-400 font-bold tabular-nums shrink-0">
            {Math.round(activeProgressRatio * 100)}% · {activeSummary}{customNote}
          </span>
        </div>
        <div className="text-[10px] text-slate-500 font-medium truncate max-w-[40%] text-right" title={currentTheme}>
          {currentTheme}
        </div>
      </div>

      <div className="relative px-1 pt-1 pb-0.5 shrink-0">
        <div className="absolute top-[7px] left-4 right-4 h-[2px] bg-slate-200/70 rounded-full" />
        <div className="absolute top-[7px] left-4 right-4 h-[2px] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-brand)] transition-all duration-500 ease-out"
            style={{ width: `${timelineFillPercent}%` }}
          />
        </div>
        <div className="flex justify-between relative z-10">
          {[
            { label: '0月', sub: '启动', active: true },
            { label: '6月', sub: '政务', active: stage === 'business' || stage === 'all' },
            { label: '12月', sub: '全场景', active: stage === 'all' },
          ].map((node) => (
            <div key={node.label} className="flex flex-col items-center">
              <div className={`w-3.5 h-3.5 rounded-full bg-white border-2 mb-0.5 ${
                node.active ? 'border-[var(--color-brand)]' : 'border-slate-300'
              }`}>
                <div className={`w-full h-full rounded-full scale-50 ${
                  node.active ? 'bg-[var(--color-brand)]' : 'bg-transparent'
                }`} />
              </div>
              <span className={`text-[9px] font-black ${node.active ? 'text-slate-800' : 'text-slate-400'}`}>{node.label}</span>
              <span className="text-[8px] text-slate-400 font-semibold leading-none">{node.sub}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 flex-1 min-h-0 items-stretch">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleTrackChange('business');
          }}
          className={`group text-left p-2 rounded-lg transition-all duration-200 cursor-pointer outline-none border h-full flex flex-col ${
            stage === 'business'
              ? 'bg-[var(--color-brand-subtle)] border-[var(--color-brand)] shadow-sm'
              : 'bg-slate-50/80 hover:bg-slate-50 border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`text-[11px] font-black tracking-wide truncate ${
              stage === 'business' ? 'text-[var(--color-brand)]' : 'text-slate-700'
            }`}>
              政务集中突破 · 0-6月
            </span>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
              stage === 'business'
                ? 'bg-[var(--color-brand)] text-white'
                : 'border border-slate-200 text-transparent'
            }`}>
              <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 mb-1">
            <span>10 核心场景 · {businessMasteredCount}/{businessTotal}</span>
            <span className="tabular-nums">{Math.round(businessProgressRatio * 100)}%</span>
          </div>
          <div className="h-1 rounded-full bg-slate-100 overflow-hidden mb-1">
            <div
              className="h-full rounded-full bg-[var(--color-brand)] transition-all duration-500"
              style={{ width: `${Math.max(6, businessProgressRatio * 100)}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-1 mt-auto">
            {businessExamples.map(scene => (
              <span key={scene} className="px-1.5 py-0.5 rounded bg-white text-[9px] font-bold text-slate-600 border border-slate-200">
                {scene}
              </span>
            ))}
          </div>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleTrackChange('all');
          }}
          className={`group text-left p-2 rounded-lg transition-all duration-200 cursor-pointer outline-none border h-full flex flex-col ${
            stage === 'all'
              ? 'bg-orange-50 border-[var(--color-accent)] shadow-sm'
              : 'bg-slate-50/80 hover:bg-slate-50 border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`text-[11px] font-black tracking-wide truncate ${
              stage === 'all' ? 'text-[var(--color-accent)]' : 'text-slate-700'
            }`}>
              全场景拓展 · 0-12月
            </span>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
              stage === 'all'
                ? 'bg-[var(--color-accent)] text-white'
                : 'border border-slate-200 text-transparent'
            }`}>
              <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 mb-1">
            <span>16 场景 · {allMasteredCount}/{allTotal}</span>
            <span className="tabular-nums">{Math.round(allProgressRatio * 100)}%</span>
          </div>
          <div className="h-1 rounded-full bg-slate-100 overflow-hidden mb-1">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
              style={{ width: `${Math.max(6, allProgressRatio * 100)}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-1 mt-auto">
            {allExamples.map(scene => (
              <span key={scene} className="px-1.5 py-0.5 rounded bg-white text-[9px] font-bold text-slate-600 border border-slate-200">
                {scene}
              </span>
            ))}
          </div>
        </button>
      </div>
    </div>
  );
}
