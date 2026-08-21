import React, { useEffect, useRef, useState } from 'react';
import { Download, ChevronDown, Loader2 } from 'lucide-react';
import type { VocabEntry } from '../services/vocabAPI';
import {
  type VocabExportScope,
  type VocabTabCategory,
} from '../utils/vocabCsvExport';
import { useTask } from './TaskContext';
import { notifyBackgroundHandoff } from '../utils/backgroundHandoff';

interface VocabExportControlProps {
  currentTab: VocabTabCategory;
  /** 若已有词表缓存可传入，避免重复请求；否则内部拉取 getAllWords */
  words?: VocabEntry[];
  /** 紧凑侧栏样式 */
  compact?: boolean;
  className?: string;
  onExported?: (count: number, scope: VocabExportScope) => void;
  onError?: (message: string) => void;
}

const ADVANCED_OPTIONS: Array<{ scope: VocabExportScope; label: string; hint: string }> = [
  { scope: 'all', label: '全部词条', hint: '合并导出' },
  { scope: 'words_only', label: '仅导出单词', hint: '仅 Word (.csv)' },
  { scope: 'phrases_only', label: '仅导出短语', hint: '仅 Phrase (.csv)' },
  { scope: 'sentences_only', label: '仅导出句子', hint: '仅 Sentence (.csv)' },
  { scope: 'current_tab', label: '当前分区', hint: '仅当前 Tab' },
  { scope: 'due_today', label: '今日待复习', hint: '到期未归档' },
];

/**
 * 主路径：一键导出全部；高级：菜单选范围（对齐 deep-interview R8）
 */
export default function VocabExportControl({
  currentTab,
  words,
  compact = false,
  className = '',
  onExported,
  onError,
}: VocabExportControlProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { addTask } = useTask();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const runExport = async (scope: VocabExportScope, anchor?: HTMLElement | null) => {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    try {
      const response = await fetch('/api/vocab/export-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, currentTab }),
      });
      if (!response.ok) {
        throw new Error(`发起后台导出任务失败: HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!data.success || !data.taskId) {
        throw new Error(data.error || '创建后台导出任务失败');
      }

      // 添加
      addTask({
        id: data.taskId,
        type: 'vocab_export' as any,
        name: `导出生词本: ${ADVANCED_OPTIONS.find((o) => o.scope === scope)?.label || scope}`,
        status: data.status || 'pending',
        progress: 0,
        logs: ['[系统] 后台导出任务已提交...'],
      });

      notifyBackgroundHandoff({
        anchor: anchor || null,
        message: '导出任务已在后台执行，请前往【任务中心】查看进度并下载文件',
        tone: 'success',
      });

      onExported?.(0, scope);
    } catch (e: any) {
      onError?.(e?.message || '导出失败');
      try {
        const { showToast } = await import('./Toast');
        showToast({ message: e?.message || '发起导出失败', type: 'error' });
      } catch (err) {}
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative inline-flex items-stretch ${className}`}>
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          void runExport('all', e.currentTarget);
        }}
        title="导出全部词条为 CSV（Excel）"
        className={
          compact
            ? 'inline-flex items-center gap-1 border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-bold px-2 py-1 rounded-l-lg transition disabled:opacity-50'
            : 'inline-flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold px-3 py-2 rounded-l-xl transition disabled:opacity-50'
        }
      >
        {busy ? (
          <Loader2 className={compact ? 'w-3 h-3 animate-spin' : 'w-3.5 h-3.5 animate-spin'} />
        ) : (
          <Download className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        )}
        导出
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="更多导出范围"
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          compact
            ? 'inline-flex items-center justify-center border border-l-0 border-slate-200 text-slate-500 hover:bg-slate-50 px-1 rounded-r-lg transition disabled:opacity-50'
            : 'inline-flex items-center justify-center border border-l-0 border-slate-200 text-slate-500 hover:bg-slate-50 px-1.5 rounded-r-xl transition disabled:opacity-50'
        }
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 min-w-[148px] bg-white border border-slate-100 rounded-xl shadow-lg py-1 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-50">
            导出范围
          </div>
          {ADVANCED_OPTIONS.map((opt) => (
            <button
              key={opt.scope}
              type="button"
              role="menuitem"
              onClick={() => void runExport(opt.scope)}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 transition"
            >
              <div className="text-[11px] font-bold text-slate-700">{opt.label}</div>
              <div className="text-[9px] text-slate-400">{opt.hint}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
