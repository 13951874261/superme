import React, { useState } from 'react';
import { useTask, TaskItem } from './TaskContext';
import {
  fetchDailyCronRunDetail,
  rerunDailyCronRun,
  DailyCronRunDetail,
  DailyCronRunSummary,
  DailyCronInputSource,
} from '../services/dailyCronAPI';
import {
  X, Video, Globe, Loader2, CheckCircle2, XCircle, Terminal, FileText,
  ChevronDown, ChevronUp, Download, Import, Brain, ExternalLink, Headphones, CalendarClock, Mic,
  Trash2,
} from 'lucide-react';

type FeedItem =
  | { kind: 'cron'; sortAt: number; run: DailyCronRunSummary }
  | { kind: 'task'; sortAt: number; task: TaskItem };

function sortKey(createdAt?: number, updatedAt?: number, completedAt?: number) {
  return Number(createdAt ?? updatedAt ?? completedAt ?? 0);
}

function StatusBadge({ status, progress }: { status: string; progress?: number }) {
  if (status === 'pending') {
    return (
      <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> 排队中
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className="text-[9px] font-bold text-[#E64A19] bg-[#FF5722]/15 px-2 py-0.5 rounded-full flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> 处理中 {progress ?? 0}%
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="text-[9px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" /> 已就绪
      </span>
    );
  }
  if (status === 'partial_failed') {
    return (
      <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
        <XCircle className="w-3 h-3" /> 部分失败
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="text-[9px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
        <XCircle className="w-3 h-3" /> 失败
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{status}</span>
  );
}

function InputSourceRow({ src, key }: { src: DailyCronInputSource; key?: string }) {
  const [showTech, setShowTech] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  const preview = src.sensitive && !showSensitive
    ? (src.valuePreview || '（敏感内容已折叠）')
    : (src.valuePreview ?? String(src.value ?? ''));

  return (
    <div className="border border-gray-100 rounded-lg p-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black text-gray-700">{src.name}</span>
        {src.sensitive && (
          <button
            type="button"
            className="text-[9px] text-amber-600 font-bold"
            onClick={() => setShowSensitive((v) => !v)}
          >
            {showSensitive ? '折叠' : '展开实际值'}
          </button>
        )}
      </div>
      <p className="text-[9px] text-gray-600 break-all font-mono">{preview}</p>
      <p className="text-[9px] text-gray-500">{src.friendlyDescription}</p>
      <button
        type="button"
        className="text-[9px] text-blue-600 font-bold"
        onClick={() => setShowTech((v) => !v)}
      >
        {showTech ? '收起技术详情' : '技术详情'}
      </button>
      {showTech && src.technicalDetails && (
        <pre className="text-[8px] bg-gray-50 p-2 rounded overflow-x-auto text-gray-600">
{JSON.stringify(src.technicalDetails, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ModuleStatCell({
  label,
  completed,
  total,
  failed,
}: {
  label: string;
  completed: number;
  total: number;
  failed: number;
}) {
  const hasFail = failed > 0;
  return (
    <div
      className={`rounded-lg px-1.5 py-2 text-center ${
        hasFail ? 'bg-amber-50 border border-amber-100' : 'bg-white/70 border border-gray-100'
      }`}
    >
      <div className="text-[9px] font-bold text-gray-500">{label}</div>
      <div className="text-[11px] font-black text-gray-800 mt-0.5">
        {completed}/{Math.max(total, 1)}
      </div>
      <div className={`text-[8px] mt-0.5 font-medium ${hasFail ? 'text-amber-700' : 'text-gray-400'}`}>
        失败 {failed}
      </div>
    </div>
  );
}

function DailyCronCard({
  run,
  onChanged,
  onDelete,
  deleting,
}: {
  run: DailyCronRunSummary;
  onChanged: () => void;
  onDelete: () => Promise<void> | void;
  deleting?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<DailyCronRunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canDelete = ['completed', 'failed', 'partial_failed'].includes(run.status);

  const loadDetail = async () => {
    setLoading(true);
    setErr(null);
    try {
      const d = await fetchDailyCronRunDetail(run.id);
      setDetail(d);
      setExpanded(true);
    } catch (e: any) {
      setErr(e.message || '加载详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRerun = async (mode: 'all_current' | 'failed_snapshot') => {
    const label = mode === 'all_current'
      ? '将使用当前入参重新执行本用户的四模块，确认？'
      : '将使用原始入参快照仅重跑失败项，确认？';
    if (!window.confirm(label)) return;
    setBusy(true);
    setErr(null);
    try {
      await rerunDailyCronRun(run.id, mode);
      onChanged();
    } catch (e: any) {
      setErr(e.message || '重跑失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setErr(null);
    try {
      await onDelete();
    } catch (e: any) {
      setErr(e.message || '删除失败');
    }
  };

  const long = run.modules.long_article;
  const failedLong = detail?.steps.filter((s) => s.module === 'long_article' && s.status === 'failed') || [];

  return (
    <div className="p-5 rounded-2xl border border-indigo-100 bg-indigo-50/20 space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl shrink-0 bg-indigo-50 text-indigo-600">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-black text-gray-800 truncate">{run.name}</h4>
            <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate" title={run.id}>
              {run.triggerSource} · {run.auditHealth === 'degraded' ? '审计降级 · ' : ''}
              ID: {run.id.slice(0, 12)}…
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge status={run.status} progress={run.progress} />
          <button
            type="button"
            disabled={!canDelete || !!deleting}
            onClick={handleDelete}
            title={canDelete ? '删除记录' : '进行中的任务不能删除'}
            aria-label={canDelete ? '删除记录' : '进行中的任务不能删除'}
            aria-busy={!!deleting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <ModuleStatCell
          label="唤醒"
          completed={run.modules.wakeup.completed}
          total={run.modules.wakeup.total}
          failed={run.modules.wakeup.failed}
        />
        <ModuleStatCell
          label="破绽"
          completed={run.modules.flaw.completed}
          total={run.modules.flaw.total}
          failed={run.modules.flaw.failed}
        />
        <ModuleStatCell
          label="长文"
          completed={long.completed + long.skipped}
          total={long.total}
          failed={long.failed}
        />
        <ModuleStatCell
          label="精听"
          completed={run.modules.listen.completed}
          total={run.modules.listen.total}
          failed={run.modules.listen.failed}
        />
      </div>

      {(run.status === 'pending' || run.status === 'running') && (
        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-amber-400 h-full transition-all duration-500"
            style={{ width: `${run.progress}%` }}
          />
        </div>
      )}

      {run.error && (
        <p className="text-[11px] text-red-500 bg-red-50/50 p-2 rounded-xl border border-red-50">{run.error}</p>
      )}
      {err && (
        <p className="text-[11px] text-red-500 bg-red-50/50 p-2 rounded-xl border border-red-50">{err}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => (expanded ? setExpanded(false) : loadDetail())}
          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-gray-200 bg-white hover:border-indigo-200"
        >
          {loading ? '加载中…' : expanded ? '收起详情' : '查看详情'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handleRerun('all_current')}
          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          整次重新执行
        </button>
        {(run.status === 'failed' || run.status === 'partial_failed') && (
          <button
            type="button"
            disabled={busy}
            onClick={() => handleRerun('failed_snapshot')}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-amber-300 text-amber-800 bg-amber-50 disabled:opacity-50"
          >
            重跑失败项
          </button>
        )}
      </div>

      {expanded && detail && (
        <div className="space-y-3 border-t border-indigo-50 pt-3">
          {(['wakeup', 'flaw', 'long_article', 'listen'] as const).map((mod) => {
            const steps = detail.steps.filter((s) => s.module === mod);
            const title = ({ wakeup: '每日唤醒', flaw: '每日破绽词汇', long_article: '每日长文', listen: '每日精听' } as const)[mod];
            return (
              <div key={mod} className="rounded-xl border border-gray-100 p-2.5 bg-white/80">
                <h5 className="text-[10px] font-black text-gray-800 mb-1.5">{title}</h5>
                {mod === 'long_article' && (
                  <p className="text-[9px] text-gray-500 mb-2">
                    汇总：完成 {long.completed} · 跳过 {long.skipped} · 失败 {long.failed} / 共 {long.total}
                  </p>
                )}
                {mod === 'long_article' && failedLong.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {failedLong.map((s) => (
                      <div key={s.id} className="text-[9px] text-red-600 bg-red-50 rounded p-1.5">
                        {s.comboKey} · {s.error || 'failed'}
                      </div>
                    ))}
                  </div>
                )}
                {steps.slice(0, mod === 'long_article' ? 3 : 5).map((s) => (
                  <div key={s.id} className="mb-2 last:mb-0">
                    <div className="flex items-center justify-between text-[9px] text-gray-600 mb-1">
                      <span>{s.comboKey || s.module} · {s.status}</span>
                    </div>
                    {Array.isArray(s.inputSources) && s.inputSources.length > 0 && (
                      <div className="space-y-1">
                        {s.inputSources.map((src) => (
                          <InputSourceRow key={`${s.id}-${src.name}`} src={src} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {mod === 'long_article' && steps.length > 3 && (
                  <p className="text-[9px] text-gray-400">成功组合已折叠；失败项见上方明细。</p>
                )}
              </div>
            );
          })}
          {detail.events.length > 0 && (
            <div className="bg-gray-900 text-gray-300 rounded-xl p-3 max-h-36 overflow-y-auto text-[9px] font-mono space-y-1">
              {detail.events.slice(-80).map((e) => (
                <div key={e.id}>[{e.level}] {e.message}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GlobalTaskCenter() {
  const {
    tasks,
    cronRuns,
    isOpen,
    setIsOpen,
    pendingCount,
    fetchCronRuns,
    deleteTask,
    deleteCronRun,
    clearFinished,
  } = useTask();
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearSuccess, setClearSuccess] = useState<string | null>(null);
  const [deletingCronIds, setDeletingCronIds] = useState<Record<string, boolean>>({});
  const [deletingTaskIds, setDeletingTaskIds] = useState<Record<string, boolean>>({});
  const [taskDeleteErrors, setTaskDeleteErrors] = useState<Record<string, string>>({});

  const finishedCount =
    cronRuns.filter((r) => ['completed', 'failed', 'partial_failed'].includes(r.status)).length +
    tasks.filter((t) => t.status === 'completed' || t.status === 'failed').length;

  const feed: FeedItem[] = [
    ...cronRuns.map((run) => ({ kind: 'cron' as const, sortAt: sortKey(run.createdAt, run.updatedAt), run })),
    ...tasks.map((task) => ({ kind: 'task' as const, sortAt: sortKey(task.createdAt, task.updatedAt, task.completedAt), task })),
  ].sort((a, b) => b.sortAt - a.sortAt);

  const toggleLogs = (taskId: string) => {
    setExpandedLogs(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const handleClearFinished = async () => {
    const n = finishedCount;
    if (!window.confirm(`将删除 ${n} 条已结束记录，不可恢复。确定？`)) return;
    setClearing(true);
    setClearError(null);
    setClearSuccess(null);
    try {
      const { deletedTasks, deletedCronRuns } = await clearFinished();
      setClearSuccess(`已删除 ${deletedTasks + deletedCronRuns} 条`);
    } catch (e: any) {
      setClearError(e.message || '清空失败');
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteCron = async (id: string) => {
    setDeletingCronIds((prev) => ({ ...prev, [id]: true }));
    try {
      await deleteCronRun(id);
    } finally {
      setDeletingCronIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleDeleteTask = async (id: string) => {
    setDeletingTaskIds((prev) => ({ ...prev, [id]: true }));
    setTaskDeleteErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      await deleteTask(id);
    } catch (e: any) {
      setTaskDeleteErrors((prev) => ({ ...prev, [id]: e.message || '删除失败' }));
    } finally {
      setDeletingTaskIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleOpenInsightListen = (task: TaskItem) => {
    if (!task.result?.feedback) return;
    sessionStorage.setItem('insight_listen_result', JSON.stringify(task.result));
    window.dispatchEvent(new CustomEvent('navigate-insight-listen'));
    setIsOpen(false);
  };

  const handleOpenSpeak = (task: TaskItem) => {
    if (!task.result) return;
    sessionStorage.setItem('speak_influence_result', JSON.stringify(task.result));
    window.dispatchEvent(new CustomEvent('navigate-speak'));
    setIsOpen(false);
  };

  const handleOpenGameTheoryHistory = (task: TaskItem) => {
    const historyId = task.result?.historyId;
    if (!historyId) return;
    window.dispatchEvent(new CustomEvent('navigate-game-theory-history', {
      detail: { historyId },
    }));
    setIsOpen(false);
  };

  const handleOpenListenPregenerated = (task: TaskItem) => {
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('listen-pregenerated-ready', {
      detail: task.result,
    }));
  };

  const handleImport = (task: TaskItem) => {
    if (!task.result) return;
    window.dispatchEvent(new CustomEvent('import-virtual-material', {
      detail: {
        name: task.result.name,
        content: task.result.content,
        mimeType: task.result.mimeType
      }
    }));
    setIsOpen(false);
  };

  const handleDownload = (task: TaskItem) => {
    if (!task.result) return;
    const downloadTypes = new Set(['vocab_export', 'tactics_export', 'vault_export']);
    const isFileExport = downloadTypes.has(task.type);
    const mime = isFileExport
      ? (task.result.mimeType || 'text/csv;charset=utf-8;')
      : 'text/markdown';
    const filename = task.result.name || (isFileExport ? 'export-download' : 'download.md');
    let blob: Blob;
    if (task.result.encoding === 'base64' && task.result.content) {
      const binary = atob(task.result.content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      blob = new Blob([bytes], { type: mime });
    } else {
      blob = new Blob([task.result.content || ''], { type: mime });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const mergedEmpty = tasks.length === 0 && cronRuns.length === 0;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] transition-opacity duration-300 animate-in fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[440px] bg-white shadow-2xl z-[100] flex flex-col transition-all duration-300 ease-in-out border-l border-gray-100 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-[#F8F9FA]">
          <div>
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
              后台任务中心
              {pendingCount > 0 && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5722] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF5722]"></span>
                </span>
              )}
            </h3>
            <p className="text-[11px] text-gray-400 font-medium mt-1">
              查看网页提取、视频转写与每日定时生成的后台进度
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {finishedCount > 0 && (
              <button
                type="button"
                disabled={clearing}
                onClick={handleClearFinished}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-gray-200 bg-white text-gray-600 hover:border-red-200 hover:text-red-600 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {clearing ? '清空中…' : '清空已结束'}
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {(clearError || clearSuccess) && (
          <div className="px-6 pt-3">
            {clearError && (
              <p className="text-[11px] text-red-500 bg-red-50/50 p-2.5 rounded-xl border border-red-50">
                {clearError}
              </p>
            )}
            {clearSuccess && (
              <p className="text-[11px] text-green-700 bg-green-50/50 p-2.5 rounded-xl border border-green-50">
                {clearSuccess}
              </p>
            )}
          </div>
        )}

        <div className="flex-grow overflow-y-auto p-6 space-y-4">
          {mergedEmpty ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <FileText className="w-12 h-12 text-gray-300 stroke-[1.5]" />
              <div>
                <p className="text-xs font-bold text-gray-600">暂无任何后台任务</p>
                <p className="text-[10px] text-gray-400 mt-1 max-w-[220px] leading-relaxed">
                  网页提取、视频转写或每日定时任务的记录会出现在这里。
                </p>
              </div>
            </div>
          ) : (
            feed.map((item) => {
              if (item.kind === 'cron') {
                const { run } = item;
                return (
                  <DailyCronCard
                    key={`cron-${run.id}`}
                    run={run}
                    onChanged={fetchCronRuns}
                    onDelete={() => handleDeleteCron(run.id)}
                    deleting={!!deletingCronIds[run.id]}
                  />
                );
              }

              const { task } = item;
              const isExpanded = !!expandedLogs[task.id];
              const canDelete = task.status === 'completed' || task.status === 'failed';
              const deleting = !!deletingTaskIds[task.id];
              const deleteErr = taskDeleteErrors[task.id];

              return (
                <div
                  key={`task-${task.id}`}
                  className={`p-5 rounded-2xl border transition-all duration-300 ${
                    task.status === 'completed'
                      ? 'border-green-100 bg-green-50/10'
                      : task.status === 'failed'
                        ? 'border-red-100 bg-red-50/10'
                        : 'border-gray-100 bg-[#F8F9FA]/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2 rounded-xl shrink-0 ${
                        task.type === 'video' || task.type === 'tactics_ingest'
                          ? 'bg-[#FF5722]/10 text-[#FF5722]'
                          : task.type === 'game_theory'
                            ? 'bg-zinc-100 text-zinc-700'
                            : task.type === 'insight_listen' || task.type === 'listen_backfill'
                              ? 'bg-[#FF5722]/10 text-[#FF5722]'
                              : task.type === 'speak'
                                ? 'bg-indigo-50 text-indigo-600'
                              : task.type === 'vocab_export' || task.type === 'tactics_export' || task.type === 'vault_export'
                                ? 'bg-green-50 text-green-600'
                                : 'bg-blue-50 text-blue-600'
                      }`}>
                        {task.type === 'video' || task.type === 'tactics_ingest' ? (
                          <Video className="w-4 h-4" />
                        ) : task.type === 'game_theory' ? (
                          <Brain className="w-4 h-4" />
                        ) : task.type === 'insight_listen' ? (
                          <Headphones className="w-4 h-4" />
                        ) : task.type === 'speak' ? (
                          <Mic className="w-4 h-4" />
                        ) : task.type === 'listen_backfill' ? (
                          <Headphones className="w-4 h-4" />
                        ) : task.type === 'vocab_export' || task.type === 'tactics_export' || task.type === 'vault_export' || task.type === 'vocab_add' || task.type === 'theme_delete' ? (
                          <FileText className="w-4 h-4" />
                        ) : (
                          <Globe className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-gray-800 truncate" title={task.name}>
                          {task.name}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {task.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge status={task.status} progress={task.progress} />
                      <button
                        type="button"
                        disabled={!canDelete || deleting}
                        onClick={() => handleDeleteTask(task.id)}
                        title={canDelete ? '删除记录' : '进行中的任务不能删除'}
                        aria-label={canDelete ? '删除记录' : '进行中的任务不能删除'}
                        aria-busy={deleting}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {(task.status === 'pending' || task.status === 'running') && (
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-3">
                      <div
                        className="bg-gradient-to-r from-[#FF5722] to-amber-400 h-full transition-all duration-500"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  )}

                  {task.status === 'failed' && task.error && (
                    <p className="text-[11px] text-red-500 bg-red-50/50 p-2.5 rounded-xl border border-red-50 mb-3 leading-relaxed">
                      {task.error}
                    </p>
                  )}
                  {deleteErr && (
                    <p className="text-[11px] text-red-500 bg-red-50/50 p-2.5 rounded-xl border border-red-50 mb-3 leading-relaxed">
                      {deleteErr}
                    </p>
                  )}

                  {task.status === 'completed' && task.result && task.type === 'listen_backfill' && (
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => handleOpenListenPregenerated(task)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#FF5722] hover:bg-[#E64A19] text-white rounded-lg text-[10px] font-bold tracking-wider transition-colors cursor-pointer"
                      >
                        <Headphones className="w-3 h-3" />
                        在听力页查看
                      </button>
                    </div>
                  )}
                  {task.status === 'completed' && task.result && task.type === 'game_theory' && task.result.historyId && (
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => handleOpenGameTheoryHistory(task)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-[10px] font-bold tracking-wider transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        前往对局历史
                      </button>
                    </div>
                  )}
                  {task.status === 'completed' && task.result && (task.type === 'vocab_export' || task.type === 'tactics_export' || task.type === 'vault_export') && (
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => handleDownload(task)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-bold tracking-wider transition-colors cursor-pointer"
                        title="下载导出文件"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {task.type === 'vocab_export'
                          ? '下载生词本 (.csv)'
                          : task.type === 'tactics_export'
                            ? '下载手段库 (.csv)'
                            : `下载资料抽屉${task.result.encoding === 'base64' ? ' (.docx)' : ' (.csv)'}`}
                      </button>
                    </div>
                  )}
                  {task.status === 'completed' && task.result && task.type === 'insight_listen' && task.result.feedback && (
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => handleOpenInsightListen(task)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-[10px] font-bold tracking-wider transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        前往听点评结果
                      </button>
                    </div>
                  )}
                  {task.status === 'completed' && task.result && task.type === 'speak' && (
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => handleOpenSpeak(task)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-[10px] font-bold tracking-wider transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        前往说评估结果
                      </button>
                    </div>
                  )}
                  {task.status === 'completed' && task.result && task.type === 'tactics_ingest' && (
                    <div className="flex flex-col gap-2 mb-3">
                      <p className="text-[10px] text-zinc-500">
                        新增手段 {Number(task.result.inserted || 0)} 条
                        {task.result.sourceName ? ` · ${task.result.sourceName}` : ''}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('tactics-ingest-updated'));
                            window.dispatchEvent(new CustomEvent('navigate-gametheory-tactics'));
                          }}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-[10px] font-bold tracking-wider transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          刷新手段库
                        </button>
                      </div>
                    </div>
                  )}
                  {task.status === 'completed' && task.result && task.type !== 'game_theory' && task.type !== 'listen_backfill' && task.type !== 'vocab_export' && task.type !== 'tactics_export' && task.type !== 'vault_export' && task.type !== 'insight_listen' && task.type !== 'speak' && task.type !== 'tactics_ingest' && (
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => handleImport(task)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#FF5722] hover:bg-[#E64A19] text-white rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer"
                      >
                        <Import className="w-3 h-3" />
                        导入并整理
                      </button>
                      <button
                        onClick={() => handleDownload(task)}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 border border-gray-200 hover:border-gray-300 text-gray-600 rounded-lg text-[10px] font-bold transition-colors cursor-pointer bg-white"
                        title="下载转写好的 Markdown"
                      >
                        <Download className="w-3 h-3" />
                        下载
                      </button>
                    </div>
                  )}

                  <div className="border-t border-gray-100/50 pt-2.5">
                    <button
                      onClick={() => toggleLogs(task.id)}
                      className="flex items-center text-[10px] text-gray-400 hover:text-gray-600 font-bold transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 mr-0.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 mr-0.5" />
                      )}
                      <Terminal className="w-3 h-3 mr-1" />
                      {isExpanded ? '隐藏运行日志' : '查看运行日志'}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 bg-gray-900 text-gray-300 rounded-xl p-3 max-h-36 overflow-y-auto text-[9px] font-mono space-y-1.5 border border-gray-800 animate-in slide-in-from-top-1 duration-200">
                        {task.logs && task.logs.length > 0 ? (
                          task.logs.map((log, idx) => <div key={`${task.id}-log-${idx}`}>{log}</div>)
                        ) : (
                          <div className="text-gray-500">尚无运行日志...</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
