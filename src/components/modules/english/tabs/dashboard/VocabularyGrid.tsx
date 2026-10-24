import React from 'react';
import SpeakButton from '../../../../SpeakButton';
import { Eye } from 'lucide-react';
import VocabZoneCollectButtons from '../../../../VocabZoneCollectButtons';
import type { VocabCategory } from '../../../../../utils/vocabZoneLabels';

export interface VocabularyGridProps {
  extractedWords: string[];
  extractedPhrases: string[];
  extractedSentences: string[];
  vocabDetailsMap: Record<string, any>;
  asyncMeanings: Record<string, { meaning: string; phonetic?: string }>;
  handleAddWordToVocab: (
    text: string,
    category: VocabCategory,
    isPhrase?: boolean,
    isSentence?: boolean,
    anchor?: HTMLElement | null
  ) => Promise<void>;
  fetchBilingualTranslation: (text: string) => Promise<void>;
  getCollectingZone?: (text: string) => VocabCategory | null;
  getQueuedZone?: (text: string) => VocabCategory | null;
  onBlockedWhileCollecting?: (text: string, activeZone: VocabCategory) => void;
}

export function VocabularyGrid({
  extractedWords,
  extractedPhrases,
  extractedSentences,
  vocabDetailsMap,
  asyncMeanings,
  handleAddWordToVocab,
  fetchBilingualTranslation,
  getCollectingZone,
  getQueuedZone,
  onBlockedWhileCollecting,
}: VocabularyGridProps) {

  if (extractedWords.length === 0 && extractedPhrases.length === 0 && extractedSentences.length === 0) {
    return null;
  }

  const safeStr = (v: any) => (typeof v === 'string' ? v : (v?.word || v?.phrase || v?.text || String(v || ''))).trim();

  const renderZoneButtons = (text: string, isPhrase: boolean, isSentence: boolean) => {
    const cleanKey = text.toLowerCase().trim();
    const details = vocabDetailsMap[cleanKey];
    return (
      <VocabZoneCollectButtons
        text={text}
        storedCategory={details?.category}
        matrixReady={!!details?.matrixReady}
        collectingZone={getCollectingZone?.(text) ?? null}
        queuedZone={getQueuedZone?.(text) ?? null}
        onCollect={(category, anchor) => {
          void handleAddWordToVocab(text, category, isPhrase, isSentence, anchor);
        }}
        onBlockedWhileCollecting={(activeZone) => {
          onBlockedWhileCollecting?.(text, activeZone);
        }}
      />
    );
  };

  const getDisplayMeaning = (text?: string) => {
    const val = (text || '').trim();
    if (!val) return '';
    if (val.includes('目标词的中文简明翻译')) return '';
    if (val.includes('中文释义加载中')) return '';
    return val;
  };

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {extractedWords.length > 0 && (
          <div className="flex flex-col max-h-[700px] lg:col-span-4">
            <div className="flex items-center justify-between shrink-0 mb-3">
              <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-[var(--color-brand)] rounded-full"></span>
                已整理出的商务生词 ({extractedWords.length})
              </h5>
            </div>
            <div className="flex-1 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
              <div className="grid grid-cols-1 sm:grid-cols-1 gap-3.5">
                {extractedWords.map((rawWordItem) => {
                  const word = safeStr(rawWordItem);
                  if (!word) return null;
                  const details = vocabDetailsMap[word.toLowerCase().trim()];
                  const phonetic = details?.phonetic || '';

                  let rawMeaning = getDisplayMeaning(details?.meaning);
                  const cleanKey = word.toLowerCase().trim();

                  if (!rawMeaning) {
                    if (asyncMeanings[cleanKey]?.meaning) {
                      rawMeaning = asyncMeanings[cleanKey].meaning;
                    } else {
                      fetchBilingualTranslation(word);
                      rawMeaning = '释义查询中…';
                    }
                  }

                  const finalPhonetic = phonetic || asyncMeanings[cleanKey]?.phonetic || '';

                  return (
                    <div
                      key={word}
                      className="group relative flex flex-col justify-between p-4 bg-slate-50/50 hover:bg-white border border-slate-100 hover:border-[var(--color-border)] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md transition-[background-color,border-color,box-shadow] duration-300 min-h-[96px] text-left overflow-hidden"
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
                        <div className="flex items-center gap-1.5 shrink-0 flex-col sm:flex-row">
                          {renderZoneButtons(word, false, false)}
                          <SpeakButton
                            text={word}
                            iconClassName="w-3.5 h-3.5"
                            className="w-7 h-7 bg-slate-50 text-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white border-none shrink-0 btn-press"
                          />
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-dashed border-slate-100/80">
                        <div className="relative h-4 overflow-hidden">
                          <span className="absolute inset-0 text-[10px] text-slate-400 font-medium tracking-wider transition-[opacity,transform] duration-300 group-hover:opacity-0 group-hover:translate-y-[-10px] flex items-center gap-1">
                            <Eye aria-hidden="true" className="w-3 h-3 opacity-70" /> 悬浮查看释义
                          </span>
                          <span className="absolute inset-0 text-[11px] text-[var(--color-brand)] font-bold tracking-wide transition-[opacity,transform] duration-300 opacity-0 translate-y-[10px] group-hover:opacity-100 group-hover:translate-y-0 truncate">
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

        {extractedPhrases.length > 0 && (
          <div className="flex flex-col max-h-[700px] lg:col-span-4">
            <div className="flex items-center justify-between shrink-0 mb-3">
              <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-amber-500 rounded-full"></span>
                已整理出的高频短语 ({extractedPhrases.length})
              </h5>
            </div>
            <div className="flex-1 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
              <div className="space-y-3">
                {extractedPhrases.map((rawPhraseItem, idx) => {
                  const phrase = safeStr(rawPhraseItem);
                  if (!phrase) return null;
                  const cleanKey = phrase.toLowerCase();
                  const details = vocabDetailsMap[cleanKey];
                  let rawMeaning = getDisplayMeaning(details?.meaning);

                  if (!rawMeaning) {
                    if (asyncMeanings[cleanKey]?.meaning) {
                      rawMeaning = asyncMeanings[cleanKey].meaning;
                    } else {
                      fetchBilingualTranslation(phrase);
                      rawMeaning = '释义查询中…';
                    }
                  }

                  return (
                    <div
                      key={idx}
                      className="group flex flex-col justify-between p-4 bg-white border border-slate-100 hover:border-amber-100 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md transition-[background-color,border-color,box-shadow] duration-300 relative overflow-hidden pl-5 text-left"
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

                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
                          {renderZoneButtons(phrase, true, false)}
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

        {extractedSentences.length > 0 && (
          <div className="flex flex-col max-h-[700px] lg:col-span-4">
            <div className="flex items-center justify-between shrink-0 mb-3">
              <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-800 flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-emerald-500 rounded-full"></span>
                已整理出的高频句型 ({extractedSentences.length})
              </h5>
            </div>
            <div className="flex-1 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
              <div className="space-y-3">
                {extractedSentences.map((rawSentenceItem, idx) => {
                  const phrase = safeStr(rawSentenceItem);
                  if (!phrase) return null;
                  const cleanKey = phrase.toLowerCase();
                  const details = vocabDetailsMap[cleanKey];
                  let rawMeaning = getDisplayMeaning(details?.meaning);

                  if (!rawMeaning) {
                    if (asyncMeanings[cleanKey]?.meaning) {
                      rawMeaning = asyncMeanings[cleanKey].meaning;
                    } else {
                      fetchBilingualTranslation(phrase);
                      rawMeaning = '翻译查询中…';
                    }
                  }

                  return (
                    <div
                      key={idx}
                      className="group flex flex-col justify-between p-4 bg-white border border-slate-100 hover:border-emerald-100 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md transition-[background-color,border-color,box-shadow] duration-300 relative overflow-hidden pl-5 text-left"
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
                              精选句型 · 支持点读
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
                          {renderZoneButtons(phrase, false, true)}
                          <SpeakButton
                            text={phrase}
                            iconClassName="w-3.5 h-3.5"
                            className="w-8 h-8 bg-emerald-50/50 text-emerald-600 hover:bg-emerald-600 hover:text-white border-none shrink-0 btn-press"
                          />
                        </div>
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
    </div>
  );
}
