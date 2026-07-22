import React from 'react';
import { Target, Loader2, Zap, Trash2, AlertTriangle } from 'lucide-react';

export interface ArsenalPanelProps {
  genre: 'news' | 'meeting' | 'podcast' | 'reading';
  setGenre: (val: 'news' | 'meeting' | 'podcast' | 'reading') => void;
  cefrLevel: 'A2' | 'B1' | 'B2' | 'C1';
  setCefrLevel: (val: 'A2' | 'B1' | 'B2' | 'C1') => void;
  isAutoGenerating: boolean;
  handleAutoGenerate: () => void;
  isClearingAndReGenerating: boolean;
  handleClearTodayAndReGenerate: () => void;
  showClearConfirm: boolean;
  setShowClearConfirm: (val: boolean) => void;
  quotaStatus: {
    wordsUsed: number;
    wordsLimit: number;
    phrasesUsed: number;
    phrasesLimit: number;
    wordsLeft: number;
    phrasesLeft: number;
  } | null;
  compact?: boolean;
}

export function ArsenalPanel({
  genre,
  setGenre,
  cefrLevel,
  setCefrLevel,
  isAutoGenerating,
  handleAutoGenerate,
  isClearingAndReGenerating,
  handleClearTodayAndReGenerate,
  showClearConfirm,
  setShowClearConfirm,
  quotaStatus,
  compact = false
}: ArsenalPanelProps) {
  return (
    <div className={`relative animate-[fadeIn_0.3s_ease-out] h-full ${
      compact
        ? 'bg-white rounded-2xl p-3 border border-slate-100 shadow-[0_6px_20px_rgba(0,0,0,0.015)] flex flex-col gap-2.5'
        : ''
    }`}>
      <div className={`flex flex-col ${compact ? 'gap-2' : 'lg:flex-row lg:items-center justify-between gap-4 mb-4'}`}>
        <h4 className={`font-black uppercase tracking-widest text-slate-800 flex items-center ${compact ? 'text-[10px]' : 'text-sm'}`}>
          <Target className={`${compact ? 'w-3.5 h-3.5 mr-1.5' : 'w-5 h-5 mr-3'} text-[var(--color-brand)]`} />
          弹药补给库 {compact ? '' : '(Arsenal)'}
        </h4>
        <div className={`flex flex-wrap items-center ${compact ? 'gap-2' : 'gap-3'}`}>
          <div className="flex items-center gap-1.5">
            {!compact && <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">题材 (Genre):</span>}
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value as any)}
              className={`bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg outline-none focus:border-[var(--color-brand)] cursor-pointer shadow-sm ${
                compact ? 'px-2 py-1.5 flex-1 min-w-0' : 'px-3 py-2'
              }`}
              title="题材"
            >
              <option value="meeting">高管会议</option>
              <option value="news">财经新闻</option>
              <option value="podcast">深度播客</option>
              <option value="reading">沉浸阅读</option>
            </select>
          </div>
          
          <div className="flex items-center gap-1.5">
            {!compact && <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">难度 (Level):</span>}
            <select
              value={cefrLevel}
              onChange={(e) => setCefrLevel(e.target.value as any)}
              className={`bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg outline-none focus:border-[var(--color-brand)] cursor-pointer shadow-sm ${
                compact ? 'px-2 py-1.5' : 'px-3 py-2'
              }`}
              title="难度"
            >
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
              <option value="C1">C1</option>
            </select>
          </div>

          <button
            onClick={handleAutoGenerate}
            disabled={isAutoGenerating || isClearingAndReGenerating}
            className={`flex items-center justify-center bg-[var(--color-brand)] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[var(--color-brand-dark)] transition-colors disabled:opacity-50 cursor-pointer shadow-md btn-press ${
              compact ? 'px-3 py-1.5 flex-1' : 'px-5 py-2.5 text-xs'
            }`}
          >
            {isAutoGenerating ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin"/> 执行中</>
            ) : (
              <><Zap className="w-3.5 h-3.5 mr-1.5 text-amber-300"/> {compact ? 'AI 生成长文' : 'AI 自动生成今日长文并提纯'}</>
            )}
          </button>

          <div className="relative inline-block">
            <button
              onClick={() => setShowClearConfirm(!showClearConfirm)}
              disabled={isAutoGenerating || isClearingAndReGenerating}
              className={`flex items-center bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border border-slate-200 disabled:opacity-50 cursor-pointer shadow-sm btn-press ${
                compact ? 'px-2.5 py-1.5' : 'px-5 py-2.5 text-xs'
              }`}
              title="清空今日提纯数据与生词，重置配额并重新运行AI生成"
            >
              {isClearingAndReGenerating ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin"/> 清理中</>
              ) : (
                <><Trash2 className="w-3.5 h-3.5 mr-1 text-red-500"/> {compact ? '重置' : '清空今日数据并重新生成'}</>
              )}
            </button>

            {showClearConfirm && (
              <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white border border-red-100 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-3.5 text-left border-t-4 border-t-red-500 animate-[fadeIn_0.15s_ease-out]">
                <div className="flex items-start gap-2.5">
                  <div className="bg-red-50 p-1.5 rounded-lg text-red-500 shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">确认清空今日数据？</h5>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                      将删除今日生词与短语，重置配额后重新生成。
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      setShowClearConfirm(false);
                      handleClearTodayAndReGenerate();
                    }}
                    className="px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all shadow-sm flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> 确认
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {quotaStatus && (
        <div className={`flex gap-3 bg-slate-50/80 rounded-xl border border-slate-200/60 ${
          compact ? 'p-2.5 mt-auto' : 'gap-6 mb-6 p-5 shadow-sm rounded-2xl'
        }`}>
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate">词汇配额</span>
              <span className="text-[10px] font-black text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-100 tabular-nums shrink-0">
                {quotaStatus.wordsUsed}/{quotaStatus.wordsLimit}
              </span>
            </div>
            <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${quotaStatus.wordsLeft === 0 ? 'bg-red-400' : 'bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-light)]'}`}
                style={{ width: `${(quotaStatus.wordsUsed / quotaStatus.wordsLimit) * 100}%` }}
              />
            </div>
          </div>
          <div className="w-px bg-slate-200/60 shrink-0" />
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate">短语配额</span>
              <span className="text-[10px] font-black text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-100 tabular-nums shrink-0">
                {quotaStatus.phrasesUsed}/{quotaStatus.phrasesLimit}
              </span>
            </div>
            <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${quotaStatus.phrasesLeft === 0 ? 'bg-red-400' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}`}
                style={{ width: `${(quotaStatus.phrasesUsed / quotaStatus.phrasesLimit) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
