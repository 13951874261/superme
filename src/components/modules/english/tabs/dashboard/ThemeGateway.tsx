import React from 'react';
import { AlertTriangle, Loader2, Trash2, Plus } from 'lucide-react';
import { StatusBadge } from '../ui/Badge/StatusBadge';
import { GhostButton } from '../ui/Button/GhostButton';

export interface ThemeGatewayProps {
  theme: string;
  setTheme: (theme: string) => void;
  themeSwitchError: React.ReactNode | null;
  setThemeSwitchError: (error: React.ReactNode | null) => void;
  runMasteryGate: () => Promise<boolean>;
  masteryData: any;
  customThemes: any[];
  currentCustomTheme: any;
  isDeletingTheme: boolean;
  setIsDeletingTheme: (val: boolean) => void;
  setIsCustomThemeModalOpen: (val: boolean) => void;
  getThemeOptions: (stage: 'business' | 'all') => any[];
  stage: string;
  refreshCustomThemes: () => Promise<void>;
  showNotice: (anchor: string, msg: string, type: string) => void;
  setThemeFocus: (arg: any) => Promise<void>;
  deleteCustomTheme: (id: string) => Promise<any>;
}

export function ThemeGateway({
  theme,
  setTheme,
  themeSwitchError,
  setThemeSwitchError,
  runMasteryGate,
  masteryData,
  customThemes,
  currentCustomTheme,
  isDeletingTheme,
  setIsDeletingTheme,
  setIsCustomThemeModalOpen,
  getThemeOptions,
  stage,
  refreshCustomThemes,
  showNotice,
  setThemeFocus,
  deleteCustomTheme
}: ThemeGatewayProps) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-1.5">当前闭环主题 <span className="text-slate-300">//</span> Theme Gateway</span>

      {themeSwitchError && (
        <div className="flex items-start gap-3 mb-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 animate-[fadeIn_0.2s_ease-out]">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
          <div className="flex-1">
            <p className="text-[11px] font-black uppercase tracking-widest text-red-600 mb-1">跨国高管拦截指令</p>
            <div className="text-xs font-medium leading-relaxed">{themeSwitchError}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setThemeSwitchError(null); }}
            className="text-red-400 hover:text-red-600 text-lg leading-none font-bold shrink-0 cursor-pointer"
          >×</button>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={theme}
          onChange={async (e) => {
            const target = e.target;
            const next = target.value;
            if (next === theme) return;
            setThemeSwitchError(null);

            const passed = await runMasteryGate();
            if (!passed) {
              target.value = theme;
              return;
            }

            setTheme(next);
            await setThemeFocus({ theme: next }).catch(() => {});
          }}
          onClick={(e) => {
            e.stopPropagation();
            setThemeSwitchError(null);
          }}
          className="flex-1 min-w-[10rem] bg-[var(--color-surface-mid)] border border-[var(--color-border)] text-slate-800 text-sm font-bold rounded-xl px-3 py-2 outline-none focus:border-[var(--color-brand)] focus:shadow-[0_0_0_3px_var(--color-brand-light)] transition-all cursor-pointer"
        >
          <optgroup label="系统预置主题">
            {getThemeOptions(stage as 'business' | 'all').map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
          {customThemes && customThemes.length > 0 && (
            <optgroup label="自定义场景主题">
              {customThemes.map((c) => (
                <option key={c.id} value={c.displayName || c.themeName}>
                  {c.displayName || c.themeName}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        {currentCustomTheme && (
          <button
            disabled={isDeletingTheme}
            onClick={async () => {
              if (!confirm(`确认删除自定义主题【${theme}】吗？这将同步删除在 Dify 知识库关联的文档。`)) return;
              setIsDeletingTheme(true);
              try {
                 const res = await deleteCustomTheme(currentCustomTheme.id);
                 if (res.success) {
                   showNotice('dashboard', '成功删除自定义场景', 'success');
                   const options = getThemeOptions(stage as 'business' | 'all');
                   setTheme(options[0].value);
                   await refreshCustomThemes();
                 }
              } catch (e: any) {
                 showNotice('dashboard', `删除失败: ${e.message}`, 'error');
              } finally {
                 setIsDeletingTheme(false);
              }
            }}
            className="text-red-500 hover:text-red-700 p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="删除当前自定义场景"
          >
            {isDeletingTheme ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        )}

        <GhostButton
          onClick={() => {
            console.log('[ThemeGateway] Opening CustomThemeModal');
            setIsCustomThemeModalOpen(true);
          }}
          className="flex items-center gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
        >
          <Plus className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">自定义</span>
        </GhostButton>

        {/* 使用新的 StatusBadge 替换硬编码红色区块，解决 P0-1 问题 */}
        <StatusBadge 
          status={masteryData?.isMastered ? 'unlocked' : 'locked'}
          label={masteryData?.isMastered ? '已通关 (解锁下沉)' : '未达标 (强制锁定)'}
        />
      </div>
    </div>
  );
}
