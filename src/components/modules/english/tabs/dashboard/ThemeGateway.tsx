import React from 'react';
import { AlertTriangle, Loader2, Trash2, Plus } from 'lucide-react';
import { GhostButton } from '../ui/Button/GhostButton';
import { useTask } from '../../../../TaskContext';
import { notifyBackgroundHandoff } from '../../../../../utils/backgroundHandoff';
import {
  deleteCustomTheme,
  deleteCustomThemeAsync,
  withThemeDeleteTimeout,
  THEME_DELETE_RACE_MS,
  CustomTheme,
} from '../../../../../services/trainingAPI';

export interface ThemeGatewayProps {
  theme: string;
  setTheme: (theme: string) => void;
  themeSwitchError: React.ReactNode | null;
  setThemeSwitchError: (error: React.ReactNode | null) => void;
  runMasteryGate: () => Promise<boolean>;
  masteryData: any;
  customThemes: CustomTheme[];
  setCustomThemes: React.Dispatch<React.SetStateAction<CustomTheme[]>>;
  currentCustomTheme: CustomTheme | undefined;
  isDeletingTheme: boolean;
  setIsDeletingTheme: (val: boolean) => void;
  setIsCustomThemeModalOpen: (val: boolean) => void;
  getThemeOptions: (stage: 'business' | 'all') => { value: string; label: string }[];
  stage: string;
  refreshCustomThemes: () => Promise<void>;
  showNotice: (anchor: string, msg: string, type: string) => void;
  setThemeFocus: (arg: any) => Promise<void>;
}

function toRestorableTheme(snapshot: any, fallback: CustomTheme): CustomTheme {
  return {
    id: snapshot?.id || fallback.id,
    themeName: snapshot?.themeName || snapshot?.theme_name || fallback.themeName,
    displayName: snapshot?.displayName || snapshot?.display_name || fallback.displayName,
    associatedFile: snapshot?.associatedFile || snapshot?.associated_file || fallback.associatedFile,
    difyDocumentId: snapshot?.difyDocumentId || snapshot?.dify_document_id || fallback.difyDocumentId,
    difyDatasetId: snapshot?.difyDatasetId || snapshot?.dify_dataset_id || fallback.difyDatasetId,
    extractedKeywords: snapshot?.extractedKeywords || fallback.extractedKeywords || [],
    source: 'custom',
    createdAt: snapshot?.createdAt || snapshot?.created_at || fallback.createdAt,
  };
}

export function ThemeGateway({
  theme,
  setTheme,
  themeSwitchError,
  setThemeSwitchError,
  runMasteryGate,
  masteryData,
  customThemes,
  setCustomThemes,
  currentCustomTheme,
  isDeletingTheme,
  setIsDeletingTheme,
  setIsCustomThemeModalOpen,
  getThemeOptions,
  stage,
  refreshCustomThemes,
  showNotice,
  setThemeFocus,
}: ThemeGatewayProps) {
  const { addTask, startPolling } = useTask();

  const handleDeleteCustomTheme = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (!currentCustomTheme) return;
    if (!confirm(`确定删除练习场景「${theme}」吗？删除后，这个场景里的学习材料和练习记录也会一起清掉，且无法恢复。`)) return;
    const handoffAnchor = (e?.currentTarget as HTMLElement) || null;

    const snapshot = currentCustomTheme;
    const options = getThemeOptions(stage as 'business' | 'all');
    const fallbackTheme = options[0]?.value || theme;

    // 乐观移除：下拉立刻消失并切回系统主题
    setCustomThemes((prev) => prev.filter((t) => t.id !== snapshot.id));
    setTheme(fallbackTheme);
    void setThemeFocus({ theme: fallbackTheme }).catch(() => {});
    showNotice('dashboard', '正在清理该场景下的学习资料与练习记录…', 'info');

    setIsDeletingTheme(true);
    try {
      const action = deleteCustomTheme(snapshot.id);
      action.catch(() => {});
      const race = await withThemeDeleteTimeout(action, THEME_DELETE_RACE_MS);

      if (race.isTimeout) {
        const queued = await deleteCustomThemeAsync(snapshot.id);
        if (queued.alreadyDeleted || !queued.taskId) {
          showNotice('dashboard', queued.message || '场景及相关学习资料已清理', 'success');
          await refreshCustomThemes();
          return;
        }
        addTask({
          id: queued.taskId,
          type: 'theme_delete',
          name: `清理练习场景：${(snapshot.displayName || snapshot.themeName || '').slice(0, 40)}`,
          status: 'running',
          progress: 20,
          logs: ['清理时间较长，已转入后台继续处理该场景的相关学习资料…'],
        });
        startPolling(queued.taskId);
        const handoffMsg = '场景清理已转入后台，稍后可在【任务中心】查看进度';
        notifyBackgroundHandoff({ anchor: handoffAnchor, message: handoffMsg, tone: 'info' });
        if (!handoffAnchor) showNotice('dashboard', handoffMsg, 'info');
        return;
      }

      if (!race.result.success) {
        throw new Error(race.result.error || '场景清理失败');
      }

      const msg = race.result.dify?.cloudCleanupIncomplete
        ? '这个场景的学习资料已大部分清理；还有少量线上资料未清理完，可稍后在【任务中心】查看'
        : (race.result.message || '场景及相关学习资料已清理');
      showNotice('dashboard', msg, race.result.dify?.cloudCleanupIncomplete ? 'info' : 'success');
      await refreshCustomThemes();
    } catch (e: any) {
      console.error('场景清理失败:', e);
      // 失败恢复：把主题选项加回列表并可选切回
      setCustomThemes((prev) => {
        if (prev.some((t) => t.id === snapshot.id)) return prev;
        return [toRestorableTheme(null, snapshot), ...prev];
      });
      setTheme(snapshot.displayName || snapshot.themeName);
      showNotice(
        'dashboard',
        '删除失败，已把该场景加回列表，请稍后重试',
        'error'
      );
    } finally {
      setIsDeletingTheme(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="theme-gateway-select" className="text-[10px] uppercase tracking-widest font-black text-gray-400">
        当前练习主题
      </label>

      {themeSwitchError && (
        <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 animate-[fadeIn_0.2s_ease-out]">
          <AlertTriangle aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-0.5">暂时无法切换</p>
            <div className="text-xs font-medium leading-snug">{themeSwitchError}</div>
          </div>
          <button
            type="button"
            aria-label="关闭提示"
            onClick={(e) => { e.stopPropagation(); setThemeSwitchError(null); }}
            className="text-red-400 hover:text-red-600 text-lg leading-none font-bold shrink-0 cursor-pointer"
          >×</button>
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <select
          id="theme-gateway-select"
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
          className="flex-1 min-w-[8rem] bg-[var(--color-surface-mid)] border border-[var(--color-border)] text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus-visible:border-[var(--color-brand)] focus-visible:shadow-[0_0_0_3px_var(--color-brand-light)] transition-[border-color,box-shadow] cursor-pointer"
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
            type="button"
            disabled={isDeletingTheme}
            onClick={(e) => void handleDeleteCustomTheme(e)}
            aria-label="删除当前自定义场景"
            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="删除当前自定义场景"
          >
            {isDeletingTheme ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        )}

        <GhostButton
          onClick={() => {
            setIsCustomThemeModalOpen(true);
          }}
          className="flex items-center gap-1 text-[var(--color-brand)] border-[var(--color-border)] hover:bg-slate-50 !px-2 !py-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">自定义</span>
        </GhostButton>

        <span className="text-[10px] text-slate-400 font-medium">
          {masteryData?.isMastered ? '已通关' : '未达标'}
        </span>
      </div>
    </div>
  );
}
