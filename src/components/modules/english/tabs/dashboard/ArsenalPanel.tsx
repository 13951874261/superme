import React from 'react';
import { Target, Loader2, Zap, Trash2, AlertTriangle } from 'lucide-react';

export type GenreType = 'news' | 'meeting' | 'podcast' | 'reading' | 'email' | 'report' | 'negotiation' | 'presentation';

export interface ArsenalPanelProps {
  genre: GenreType;
  setGenre: (val: GenreType) => void;
  cefrLevel: 'A2' | 'B1' | 'B2' | 'C1';
  setCefrLevel: (val: 'A2' | 'B1' | 'B2' | 'C1') => void;
  duration?: '1' | '15' | '25' | '35';
  setDuration?: (val: '1' | '15' | '25' | '35') => void;
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
  duration = '15',
  setDuration,
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
    <div className={`relative animate-[fadeIn_0.3s_ease-out] bg-white border border-slate-100 shadow-[0_4px_14px_rgba(0,0,0,0.012)] ${
      compact
        ? 'rounded-xl p-2.5 h-full flex flex-col gap-2'
        : 'rounded-xl px-3 py-2.5'
    }`}>
      <div className={`flex ${compact ? 'flex-col gap-2' : 'flex-col xl:flex-row xl:items-center gap-2.5'}`}>
        <div className={`flex items-center gap-2 shrink-0 ${compact ? '' : 'xl:mr-1'}`}>
          <Target className="w-3.5 h-3.5 text-[var(--color-brand)]" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-800">
            弹药补给库
          </h4>
        </div>

        <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'flex-1'}`}>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-[var(--color-brand)] cursor-pointer"
            title="题材"
          >
            <option value="meeting">高管会议</option>
            <option value="email">商务邮件</option>
            <option value="report">行业研报</option>
            <option value="negotiation">谈判拉扯</option>
            <option value="presentation">路演汇报</option>
            <option value="reading">沉浸阅读</option>
            <option value="news">财经新闻</option>
          </select>

          <select
            value={cefrLevel}
            onChange={(e) => setCefrLevel(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-[var(--color-brand)] cursor-pointer"
            title="难度"
          >
            <option value="A2">A2</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="C1">C1</option>
          </select>

          <select
            value={duration}
            onChange={(e) => setDuration && setDuration(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-[var(--color-brand)] cursor-pointer"
            title="时长"
          >
            <option value="1">1分钟</option>
            <option value="15">15分钟</option>
            <option value="25">25分钟</option>
            <option value="35">35分钟</option>
          </select>

          <button
            onClick={handleAutoGenerate}
            disabled={isAutoGenerating || isClearingAndReGenerating}
            className="flex items-center justify-center bg-[var(--color-brand)] text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[var(--color-brand-dark)] transition-colors disabled:opacity-50 cursor-pointer shadow-sm btn-press px-3 py-1.5"
          >
            {isAutoGenerating ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin"/> 正在查询/生成今日内容...</>
            ) : (
              <><Zap className="w-3.5 h-3.5 mr-1.5 text-amber-300"/> 查询/生成今日长文</>
            )}
          </button>

          <div className="relative inline-block">
            <button
              onClick={() => setShowClearConfirm(!showClearConfirm)}
              disabled={isAutoGenerating || isClearingAndReGenerating}
              className="flex items-center bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border border-slate-200 disabled:opacity-50 cursor-pointer btn-press px-2.5 py-1.5"
              title="清空今日配额与生词，并删除当前题材/难度/时长下的长文与音频后重新生成"
            >
              {isClearingAndReGenerating ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin"/> 清理中</>
              ) : (
                <><Trash2 className="w-3.5 h-3.5 mr-1 text-red-500"/> 重置今日</>
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
                      将删除今日生词与短语、重置配额，并删除当前条件下的长文与对应音频，然后重新生成。
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

          {quotaStatus && (
            <div className={`flex flex-col gap-1 ${compact ? 'w-full mt-auto pt-1 border-t border-slate-100' : 'ml-auto min-w-[14rem]'}`}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-[6rem]">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">词</span>
                    <span className="text-[10px] font-black tabular-nums text-slate-700">
                      {quotaStatus.wordsUsed}/{quotaStatus.wordsLimit}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${quotaStatus.wordsLeft === 0 ? 'bg-red-400' : 'bg-[var(--color-brand)]'}`}
                      style={{ width: `${(quotaStatus.wordsUsed / quotaStatus.wordsLimit) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex-1 min-w-[6rem]">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">短语</span>
                    <span className="text-[10px] font-black tabular-nums text-slate-700">
                      {quotaStatus.phrasesUsed}/{quotaStatus.phrasesLimit}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${quotaStatus.phrasesLeft === 0 ? 'bg-red-400' : 'bg-emerald-500'}`}
                      style={{ width: `${(quotaStatus.phrasesUsed / quotaStatus.phrasesLimit) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              {quotaStatus.wordsLeft === 0 && quotaStatus.phrasesLeft === 0 && (
                <p className="text-[9px] font-bold text-red-500/90 leading-snug">
                  今日入库配额已满（非提取失败）。请点「重置今日」清空后再生成。
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
