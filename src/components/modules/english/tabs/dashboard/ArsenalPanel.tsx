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
  quotaStatus
}: ArsenalPanelProps) {
  return (
    <div className="relative animate-[fadeIn_0.3s_ease-out]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center">
          <Target className="w-5 h-5 mr-3 text-[var(--color-brand)]" /> 弹药补给库 (Arsenal)
        </h4>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">题材 (Genre):</span>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value as any)}
              className="bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-[var(--color-brand)] cursor-pointer shadow-sm"
            >
              <option value="meeting">高管会议 (Meeting)</option>
              <option value="news">财经新闻 (News)</option>
              <option value="podcast">深度播客 (Podcast)</option>
              <option value="reading">沉浸阅读 (Reading)</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">难度 (Level):</span>
            <select
              value={cefrLevel}
              onChange={(e) => setCefrLevel(e.target.value as any)}
              className="bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-[var(--color-brand)] cursor-pointer shadow-sm animate-none"
            >
              <option value="A2">A2 初阶</option>
              <option value="B1">B1 进阶</option>
              <option value="B2">B2 高阶</option>
              <option value="C1">C1 母语级</option>
            </select>
          </div>

          <button
            onClick={handleAutoGenerate}
            disabled={isAutoGenerating || isClearingAndReGenerating}
            className="flex items-center bg-[var(--color-brand)] text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[var(--color-brand-dark)] transition-colors disabled:opacity-50 cursor-pointer shadow-lg btn-press"
          >
            {isAutoGenerating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> AI 执行中...</>
            ) : (
              <><Zap className="w-4 h-4 mr-2 text-amber-300"/> AI 自动生成今日长文并提纯</>
            )}
          </button>

          <div className="relative inline-block">
            <button
              onClick={() => setShowClearConfirm(!showClearConfirm)}
              disabled={isAutoGenerating || isClearingAndReGenerating}
              className="flex items-center bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-slate-200 disabled:opacity-50 cursor-pointer shadow-sm btn-press"
              title="清空今日提纯数据与生词，重置配额并重新运行AI生成"
            >
              {isClearingAndReGenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> 正在清理并生成...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2 text-red-500"/> 清空今日数据并重新生成</>
              )}
            </button>

            {showClearConfirm && (
              <div className="absolute right-0 top-full mt-2.5 z-50 w-80 bg-white border border-red-100 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-5 text-left border-t-4 border-t-red-500 animate-[fadeIn_0.15s_ease-out]">
                <div className="flex items-start gap-3">
                  <div className="bg-red-50 p-2 rounded-xl text-red-500 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">确认清空今日数据与配额吗？</h5>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                      此操作将彻底删除您今天在此主题下生成的全部生词和短语，并重置今日配额，随后自动重新运行 AI 生成与提纯。
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2.5 mt-5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      setShowClearConfirm(false);
                      handleClearTodayAndReGenerate();
                    }}
                    className="px-3.5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all shadow-sm flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> 确认清空并重构
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 每日配额指示器：修复 P0-4，移除 bg-indigo-505，使用 OKLCH 变量色与柔和渐变 */}
      {quotaStatus && (
        <div className="flex gap-6 mb-6 bg-slate-50/80 rounded-2xl p-5 border border-slate-200/60 shadow-sm">
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">每日词汇配额</span>
              <span className="text-[11px] font-black text-slate-800 bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100">{quotaStatus.wordsUsed}/{quotaStatus.wordsLimit}</span>
            </div>
            <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden border border-slate-200/50">
              <div
                className={`h-full rounded-full transition-all duration-700 ${quotaStatus.wordsLeft === 0 ? 'bg-red-400' : 'bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-light)]'}`}
                style={{ width: `${(quotaStatus.wordsUsed / quotaStatus.wordsLimit) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-bold">{quotaStatus.wordsLeft} 个剩余</span>
          </div>
          <div className="w-px bg-slate-200/60 shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">每日短语配额</span>
              <span className="text-[11px] font-black text-slate-800 bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100">{quotaStatus.phrasesUsed}/{quotaStatus.phrasesLimit}</span>
            </div>
            <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden border border-slate-200/50">
              <div
                className={`h-full rounded-full transition-all duration-700 ${quotaStatus.phrasesLeft === 0 ? 'bg-red-400' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}`}
                style={{ width: `${(quotaStatus.phrasesUsed / quotaStatus.phrasesLimit) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-bold">{quotaStatus.phrasesLeft} 个剩余</span>
          </div>
        </div>
      )}
    </div>
  );
}
