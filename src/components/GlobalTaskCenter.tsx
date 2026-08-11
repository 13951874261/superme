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
  ChevronDown, ChevronUp, Download, Import, Brain, ExternalLink, Headphones, CalendarClock,
} from 'lucide-react';

function StatusBadge({ status, progress }: { status: string; progress?: number }) {
  if (status === 'pending') {
    return (
      <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> 排队中
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className="text-[9px] font-bold text-[#FF5722] bg-[#FF5722]/10 px-2 py-0.5 rounded-full flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> 处理中 {progress ?? 0}%
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="text-[9px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" /> 已就绪
      </span>
    );
  }
  if (status === 'partial_failed') {
    return (
      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
        <XCircle className="w-3 h-3" /> 部分失败
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
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

function DailyCronCard({
  run,
  onChanged,
}: {
  run: DailyCronRunSummary;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<DailyCronRunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  const long = run.modules.long_article;
  const failedLong = detail?.steps.filter((s) => s.module === 'long_article' && s.status === 'failed') || [];

  return (
    <div className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/20 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl shrink-0 bg-indigo-50 text-indigo-600">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-black text-gray-800 truncate">{run.name}</h4>
            <p className="text-[10px] text-gray-400 font-mono mt-0.5">
              {run.triggerSource} · {run.auditHealth === 'degraded' ? '审计降级 · ' : ''}
              ID: {run.id.slice(0, 12)}…
            </p>
          </div>
        </div>
        <StatusBadge status={run.status} progress={run.progress} />
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[9px] text-gray-600">
        <div>唤醒 {run.modules.wakeup.completed}/{Math.max(run.modules.wakeup.total, 1)} · 失败 {run.modules.wakeup.failed}</div>
        <div>破绽 {run.modules.flaw.completed}/{Math.max(run.modules.flaw.total, 1)} · 失败 {run.modules.flaw.failed}</div>
        <div>长文 {long.completed + long.skipped}/{Math.max(long.total, 1)} · 失败 {long.failed}</div>
        <div>精听 {run.modules.listen.completed}/{Math.max(run.modules.listen.total, 1)} · 失败 {run.modules.listen.failed}</div>
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
  const { tasks, cronRuns, isOpen, setIsOpen, pendingCount, fetchCronRuns } = useTask();
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  const toggleLogs = (taskId: string) => {
    setExpandedLogs(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
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
    const isVocab = task.type === 'vocab_export';
    const mime = isVocab ? (task.result.mimeType || 'text/csv;charset=utf-8;') : 'text/markdown';
    const filename = task.result.name || (isVocab ? 'vocab-export.csv' : 'download.md');

    const blob = new Blob([task.result.content || ''], { type: mime });
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
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
            <>
              {cronRuns.map((run) => (
                <React.Fragment key={run.id}><DailyCronCard run={run} onChanged={fetchCronRuns} /></React.Fragment>
              ))}

              {tasks.map(task => {
                const isExpanded = !!expandedLogs[task.id];
                return (
                  <div
                    key={task.id}
                    className={`p-4 rounded-2xl border transition-all duration-300 ${
                      task.status === 'completed'
                        ? 'border-green-100 bg-green-50/5'
                        : task.status === 'failed'
                          ? 'border-red-100 bg-red-50/5'
                          : 'border-gray-100 bg-[#F8F9FA]/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-2 rounded-xl shrink-0 ${
                          task.type === 'video'
                            ? 'bg-[#FF5722]/10 text-[#FF5722]'
                            : task.type === 'game_theory'
                              ? 'bg-zinc-100 text-zinc-700'
                              : task.type === 'listen_backfill'
                                ? 'bg-[#FF5722]/10 text-[#FF5722]'
                                : task.type === 'vocab_export'
                                  ? 'bg-green-50 text-green-600'
                                  : 'bg-blue-50 text-blue-600'
                        }`}>
                          {task.type === 'video' ? (
                            <Video className="w-4 h-4" />
                          ) : task.type === 'game_theory' ? (
                            <Brain className="w-4 h-4" />
                          ) : task.type === 'listen_backfill' ? (
                            <Headphones className="w-4 h-4" />
                          ) : task.type === 'vocab_export' ? (
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
                      <StatusBadge status={task.status} progress={task.progress} />
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
                    {task.status === 'completed' && task.result && task.type === 'vocab_export' && (
                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => handleDownload(task)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-bold tracking-wider transition-colors cursor-pointer"
                          title="下载导出的 CSV 文件"
                        >
                          <Download className="w-3.5 h-3.5" />
                          下载生词本 (.csv)
                        </button>
                      </div>
                    )}
                    {task.status === 'completed' && task.result && task.type !== 'game_theory' && task.type !== 'listen_backfill' && task.type !== 'vocab_export' && (
                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => handleImport(task)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#FF5722] hover:bg-[#E64A19] text-white rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer"
                        >
                          <Import className="w-3 h-3" />
                          导入并提纯
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

                    <div className="border-t border-gray-100/50 pt-2">
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
              })}
            </>
          )}
        </div>
      </div>
    </>
  );
}