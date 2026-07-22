import React from 'react';
import { Globe, Star, Users } from 'lucide-react';
import type { SceneEntry } from './oralWarRoom/types';

interface Props {
  scenes: SceneEntry[];
  selectedSceneId: string;
  onSelect: (sceneId: string) => void;
  activeTierFilter: '全部' | '初阶' | '高阶' | '跨文化' | '定制';
  onTierFilterChange: (tier: Props['activeTierFilter']) => void;
  activeLevelFilter: '全部' | '4' | '5';
  onLevelFilterChange: (level: Props['activeLevelFilter']) => void;
  activeRoleCountFilter: '全部' | '三方' | '四方+';
  onRoleCountFilterChange: (filter: Props['activeRoleCountFilter']) => void;
  filteredScenes: SceneEntry[];
  sceneDifficultyStats: { level4: number; level5: number; level4Pct: number; level5Pct: number };
  getPartyCount: (scene: SceneEntry) => number;
}

function renderStars(level: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={`w-3 h-3 ${i < level ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
  ));
}

export default function OralWarRoomSceneSelector({
  scenes: _scenes,
  selectedSceneId,
  onSelect,
  activeTierFilter,
  onTierFilterChange,
  activeLevelFilter,
  onLevelFilterChange,
  activeRoleCountFilter,
  onRoleCountFilterChange,
  filteredScenes,
  sceneDifficultyStats,
  getPartyCount,
}: Props) {
  return (
    <div className="mb-4 bg-white px-5 py-4 rounded-2xl border border-[var(--color-border)] shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-black text-[var(--color-accent)] tracking-widest uppercase">
          <Globe className="w-4 h-4" /> 场景库 SCENE LIBRARY
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {(['全部', '初阶', '高阶', '跨文化', '定制'] as const).map((tier) => {
            const isActive = activeTierFilter === tier;
            return (
              <button
                key={tier}
                type="button"
                onClick={() => onTierFilterChange(tier)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer
                  ${isActive
                    ? 'bg-[var(--color-accent)] text-white shadow-[var(--shadow-sm)]'
                    : 'bg-[var(--color-canvas)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-border)]'
                  }`}
              >
                {tier}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3 pb-3 border-b border-[var(--color-border)]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-ink-muted)]">难度分布</span>
            <span className="text-[9px] text-[var(--color-ink-secondary)]">
              L4 ×{sceneDifficultyStats.level4} · L5 ×{sceneDifficultyStats.level5}
            </span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-[var(--color-canvas)]">
            <div className="bg-emerald-400 transition-all duration-500" style={{ width: `${sceneDifficultyStats.level4Pct}%` }} />
            <div className="bg-[var(--color-accent)] transition-all duration-500" style={{ width: `${sceneDifficultyStats.level5Pct}%` }} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-black text-[var(--color-ink-muted)] uppercase w-8">难度</span>
            {(['全部', '4', '5'] as const).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => onLevelFilterChange(lv === '全部' ? '全部' : lv)}
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold cursor-pointer transition-all
                  ${activeLevelFilter === (lv === '全部' ? '全部' : lv)
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'bg-[var(--color-canvas)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-border)]'
                  }`}
              >
                {lv === '全部' ? '全部' : `L${lv}`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-black text-[var(--color-ink-muted)] uppercase w-8">博弈</span>
            {(['全部', '三方', '四方+'] as const).map((rc) => (
              <button
                key={rc}
                type="button"
                onClick={() => onRoleCountFilterChange(rc)}
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold cursor-pointer transition-all
                  ${activeRoleCountFilter === rc
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'bg-[var(--color-canvas)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-border)]'
                  }`}
              >
                {rc}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
        {filteredScenes.length === 0 ? (
          <div className="col-span-full py-6 text-center text-xs text-[var(--color-ink-muted)]">当前筛选条件下无匹配场景</div>
        ) : filteredScenes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={`text-left p-3 rounded-xl border transition-all cursor-pointer spotlight-border ${
              selectedSceneId === s.id
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 ring-2 ring-[var(--color-accent)]/30'
                : 'border-[var(--color-border)] bg-[var(--color-canvas)] hover:border-[var(--color-accent)]/50'
            }`}
          >
            <div className="flex items-center gap-1 mb-1">
              <Users className="w-3 h-3 text-[var(--color-ink-muted)]" />
              <span className="text-[8px] text-[var(--color-ink-muted)]">{getPartyCount(s)}方博弈</span>
            </div>
            <div className="text-[10px] font-black text-[var(--color-ink-primary)] leading-tight mb-1 line-clamp-2">{s.shortTitle}</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5">{renderStars(s.level)}</div>
              <div className="flex items-center gap-0.5">
                {s.allies.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                {s.blockers.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                {s.neutrals.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />}
              </div>
            </div>
            <span className={`text-[8px] font-bold uppercase tracking-wider ${
              s.tier === '初阶' ? 'text-emerald-500' :
              s.tier === '高阶' ? 'text-[var(--color-accent)]' :
              s.tier === '跨文化' ? 'text-[var(--color-info)]' : 'text-amber-500'
            }`}>{s.tier}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
