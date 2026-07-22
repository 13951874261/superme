import React from 'react';
import SpeakButton from '../../../../SpeakButton';
import { Eye } from 'lucide-react';

export interface VocabularyGridProps {
  extractedWords: string[];
  extractedPhrases: string[];
  extractedSentences: string[];
  vocabDetailsMap: Record<string, any>;
  asyncMeanings: Record<string, { meaning: string; phonetic?: string }>;
  handleAddWordToVocab: (text: string, isPhrase?: boolean) => Promise<void>;
  fetchBilingualTranslation: (text: string) => Promise<void>;
}

export function VocabularyGrid({
  extractedWords,
  extractedPhrases,
  extractedSentences,
  vocabDetailsMap,
  asyncMeanings,
  handleAddWordToVocab,
  fetchBilingualTranslation
}: VocabularyGridProps) {
  
  if (extractedWords.length === 0 && extractedPhrases.length === 0 && extractedSentences.length === 0) {
    return null;
  }

  const getDisplayMeaning = (text?: string) => {
    const val = (text || '').trim();
    if (!val) return '';
    if (val.includes('目标词的中文简明翻译')) return '';
    if (val.includes('中文释义加载中')) return '';
    return val;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4">
      {/* 词汇专区 - 权重 5 */}
      {extractedWords.length > 0 && (
        <div className="flex flex-col max-h-[700px] lg:col-span-4">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-3 bg-[var(--color-brand)] rounded-full"></span>
            成功提纯商战生词 ({extractedWords.length})
          </h5>
          <div className="flex-1 overflow-y-auto pr-2 mt-4" style={{ scrollbarWidth: 'thin' }}>
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-3.5">
              {extractedWords.map((word) => {
                const details = vocabDetailsMap[word.toLowerCase().trim()];
                const phonetic = details?.phonetic || '';

                let rawMeaning = getDisplayMeaning(details?.meaning);
                const cleanKey = word.toLowerCase().trim();

                if (!rawMeaning) {
                  if (asyncMeanings[cleanKey]?.meaning) {
                    rawMeaning = asyncMeanings[cleanKey].meaning;
                  } else {
                    fetchBilingualTranslation(word);
                    rawMeaning = '释义查询中...';
                  }
                }

                const finalPhonetic = phonetic || asyncMeanings[cleanKey]?.phonetic || '';
                const isStored = !!vocabDetailsMap[cleanKey];

                return (
                  <div
                    key={word}
                    className="group relative flex flex-col justify-between p-4 bg-slate-50/50 hover:bg-white border border-slate-100 hover:border-[var(--color-border)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md transition-all duration-300 min-h-[96px] text-left overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-serif font-black text-slate-800 text-sm tracking-wide break-all">
                          {word}
                        </span>
                        {finalPhonetic && (
                          <span className="text-[10px] text-slate-400 font-sans mt-0.5 font-medium">
                            {finalPhonetic}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isStored ? (
                          <span className="text-[9px] font-bold text-green-700 bg-green-50 border border-green-200/50 px-2 py-0.5 rounded-lg flex items-center shrink-0">
                            ✓ 已收录
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddWordToVocab(word, false);
                            }}
                            className="text-[9px] font-bold text-[var(--color-brand)] bg-slate-50 hover:bg-[var(--color-brand)] hover:text-white px-2 py-0.5 rounded-lg border border-[var(--color-border)] transition-all cursor-pointer shrink-0 btn-press"
                            title="收录入生词本"
                          >
                            + 收录
                          </button>
                        )}
                        <SpeakButton
                          text={word}
                          iconClassName="w-3.5 h-3.5"
                          className="w-7 h-7 bg-slate-50 text-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white border-none shrink-0 btn-press"
                        />
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-dashed border-slate-100/80">
                      <div className="relative h-4 overflow-hidden">
                        {/* P0-3 Fix: Removed "HOVER TO REVEAL" with an elegant icon + text */}
                        <span className="absolute inset-0 text-[10px] text-slate-400 font-medium tracking-wider transition-all duration-300 group-hover:opacity-0 group-hover:translate-y-[-10px] flex items-center gap-1">
                          <Eye className="w-3 h-3 opacity-70" /> 悬浮查看释义
                        </span>
                        <span className="absolute inset-0 text-[11px] text-[var(--color-brand)] font-bold tracking-wide transition-all duration-300 opacity-0 translate-y-[10px] group-hover:opacity-100 group-hover:translate-y-0 truncate">
                          {rawMeaning}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 短语专区 - 权重 4 */}
      {extractedPhrases.length > 0 && (
        <div className="flex flex-col max-h-[700px] lg:col-span-4">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-3 bg-amber-500 rounded-full"></span>
            成功提纯高频短语 ({extractedPhrases.length})
          </h5>
          <div className="flex-1 overflow-y-auto pr-2 mt-4" style={{ scrollbarWidth: 'thin' }}>
            <div className="space-y-3">
              {extractedPhrases.map((phrase, idx) => {
                const details = vocabDetailsMap[phrase.toLowerCase().trim()];
                let rawMeaning = getDisplayMeaning(details?.meaning);
                const cleanKey = phrase.toLowerCase().trim();
                const isPhraseStored = !!vocabDetailsMap[cleanKey];

                if (!rawMeaning) {
                  if (asyncMeanings[cleanKey]?.meaning) {
                    rawMeaning = asyncMeanings[cleanKey].meaning;
                  } else {
                    fetchBilingualTranslation(phrase);
                    rawMeaning = '释义查询中...';
                  }
                }

                return (
                  <div
                    key={idx}
                    className="group flex flex-col justify-between p-4 bg-white border border-slate-100 hover:border-amber-100 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md transition-all duration-300 relative overflow-hidden pl-5 text-left"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#FFC107] rounded-r-lg group-hover:bg-[#FFC107]/80 transition-colors"></div>

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 select-text">
                        <p className="text-sm text-slate-800 font-serif leading-relaxed font-bold">
                          {phrase}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                            核心短语
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isPhraseStored ? (
                          <span className="text-[9px] font-bold text-green-700 bg-green-50 border border-green-200/50 px-2 py-0.5 rounded-lg flex items-center shrink-0">
                            ✓ 已收录
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddWordToVocab(phrase, true);
                            }}
                            className="text-[9px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-600 hover:text-white px-2 py-0.5 rounded-lg border border-amber-100 transition-all cursor-pointer shrink-0 btn-press"
                            title="收录入生词本"
                          >
                            + 收录
                          </button>
                        )}
                        <SpeakButton
                          text={phrase}
                          iconClassName="w-3.5 h-3.5"
                          className="w-8 h-8 bg-amber-50/50 text-amber-600 hover:bg-amber-600 hover:text-white border-none shrink-0 btn-press"
                        />
                      </div>
                    </div>

                    {rawMeaning && (
                      <div className="mt-2.5 pt-2 border-t border-dashed border-slate-100/80">
                        <p className="text-xs text-[var(--color-brand)] font-bold tracking-wide">
                          {rawMeaning}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 句型专区 - 权重 3 */}
      {extractedSentences.length > 0 && (
        <div className="flex flex-col max-h-[700px] lg:col-span-4">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-3 bg-emerald-500 rounded-full"></span>
            成功提纯高频句型 ({extractedSentences.length})
          </h5>
          <div className="flex-1 overflow-y-auto pr-2 mt-4" style={{ scrollbarWidth: 'thin' }}>
            <div className="space-y-3">
              {extractedSentences.map((phrase, idx) => {
                const details = vocabDetailsMap[phrase.toLowerCase().trim()];
                let rawMeaning = getDisplayMeaning(details?.meaning);
                const cleanKey = phrase.toLowerCase().trim();

                if (!rawMeaning) {
                  if (asyncMeanings[cleanKey]?.meaning) {
                    rawMeaning = asyncMeanings[cleanKey].meaning;
                  } else {
                    fetchBilingualTranslation(phrase);
                    rawMeaning = '翻译查询中...';
                  }
                }

                return (
                  <div
                    key={idx}
                    className="group flex flex-col justify-between p-4 bg-white border border-slate-100 hover:border-emerald-100 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md transition-all duration-300 relative overflow-hidden pl-5 text-left"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-emerald-500 rounded-r-lg group-hover:bg-emerald-500/80 transition-colors"></div>

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 select-text">
                        <p className="text-xs text-slate-700 font-serif leading-relaxed italic">
                          "{phrase}"
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                            提纯金句 · 支持点读
                          </span>
                        </div>
                      </div>

                      <SpeakButton
                        text={phrase}
                        iconClassName="w-3.5 h-3.5"
                        className="w-8 h-8 bg-emerald-50/50 text-emerald-600 hover:bg-emerald-600 hover:text-white border-none shrink-0 btn-press"
                      />
                    </div>

                    {rawMeaning && (
                      <div className="mt-2.5 pt-2 border-t border-dashed border-slate-100/80">
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                          {rawMeaning}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
