import React, { useState, useEffect } from 'react';
import { BookOpen, RefreshCw, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { addWord } from '../../services/vocabAPI';
import { buildDailyPackQueryInput, getTodayDailyPack, regenerateDailyPack } from '../../services/dailyPackAPI';
import { playSuccess, playError } from '../../utils/soundEffects';
import SpeakButton from '../SpeakButton';
import { useEnglishContext } from './english/context/EnglishContext';

interface FlawVocabWord {
  word: string;
  ipa: string;
  pronunciation_note: string;
  meaning_zh: string;
  example: string;
}

export default function DailyErrorVocabularyModule() {
  const { theme } = useEnglishContext();
  const [words, setWords] = useState<FlawVocabWord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingWord, setAddingWord] = useState<Record<string, boolean>>({});
  const [addedWords, setAddedWords] = useState<Record<string, boolean>>({});

  const fetchFlawVocab = async (regenerate = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const queryInput = await buildDailyPackQueryInput(theme);
      const pack = regenerate
        ? await regenerateDailyPack('flaw', queryInput)
        : await getTodayDailyPack(queryInput);

      if (pack.status === 'ready' && Array.isArray(pack.flawVocab) && pack.flawVocab.length > 0) {
        setWords(pack.flawVocab.slice(0, 6));
        return;
      }

      if (pack.status === 'missing' || pack.status === 'failed') {
        setWords([]);
        setError(
          pack.status === 'failed'
            ? (pack.errorMessage || '今日破绽词生成失败，请点击刷新重试')
            : '暂无缓存，请点击「刷新词汇」手动生成',
        );
        return;
      }

      setWords([]);
      setError('暂无缓存，请点击「刷新词汇」手动生成');
    } catch (e: any) {
      setError(e.message || '获取每日破绽词汇失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchFlawVocab(false);
  }, []);

  const handleAddWord = async (word: FlawVocabWord) => {
    setAddingWord(prev => ({ ...prev, [word.word]: true }));
    try {
      await addWord({
        word: word.word,
        dictType: 'flaw-vocab',
        category: 'business',
        payload: {
          phonetic: word.ipa,
          meaning: word.meaning_zh,
          business_note: word.pronunciation_note,
          examples: [word.example]
        }
      });
      setAddedWords(prev => ({ ...prev, [word.word]: true }));
      playSuccess();
      window.dispatchEvent(new Event('vocab-updated'));
    } catch (e) {
      playError();
      console.error(e);
    } finally {
      setAddingWord(prev => ({ ...prev, [word.word]: false }));
    }
  };

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-5 md:p-6 border border-slate-800 shadow-[0_12px_30px_rgba(0,0,0,0.12)] relative overflow-hidden mb-6 animate-fade-in">
      <div className="absolute -right-16 -top-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="bg-[var(--color-brand)] text-white p-2.5 rounded-xl shadow-md">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h4 className="text-base font-black tracking-widest uppercase flex items-center gap-2">
              每日破绽词汇推送 <span className="text-indigo-400">// Daily Flaw Vocab</span>
            </h4>
            <p className="text-xs text-slate-400 mt-1 font-medium">今日预生成 · 可刷新</p>
          </div>
        </div>
        <button
          onClick={() => void fetchFlawVocab(true)}
          disabled={isLoading}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 border border-slate-700/50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          刷新词汇
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">正在加载今日破绽词汇…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mb-2" />
          <p className="text-sm text-red-400 font-semibold mb-4">{error}</p>
          <button
            onClick={() => void fetchFlawVocab(true)}
            className="px-5 py-2.5 bg-[var(--color-brand)] text-white text-xs font-black rounded-xl uppercase tracking-widest hover:bg-[var(--color-brand-hover)] transition-colors"
          >
            重试
          </button>
        </div>
      ) : words.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm font-medium">暂无数据，请尝试刷新</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
          {words.map((item) => (
            <div
              key={item.word}
              className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-5 hover:border-indigo-500/40 hover:bg-slate-800/60 transition-all group flex flex-col justify-between text-left"
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-lg font-black text-white group-hover:text-indigo-400 transition-colors">
                    {item.word}
                  </span>
                  <SpeakButton text={item.word} title={`朗读 ${item.word}`} className="text-slate-400 hover:text-indigo-400" />
                </div>
                <span className="text-xs font-mono text-indigo-400 block mb-2">{item.ipa}</span>
                <p className="text-sm text-slate-200 font-black mb-1">{item.meaning_zh}</p>
                <p className="text-xs text-slate-400 leading-relaxed font-medium mb-3">{item.pronunciation_note}</p>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-300 leading-relaxed italic relative mb-4">
                  <span className="absolute -top-2 left-3 px-1.5 bg-slate-900 rounded text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Example</span>
                  <div className="pt-1 flex items-start justify-between gap-2">
                    <span>{item.example}</span>
                    <SpeakButton text={item.example} title="朗读例句" className="shrink-0 text-slate-500 hover:text-indigo-400 mt-0.5" />
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleAddWord(item)}
                disabled={addingWord[item.word] || addedWords[item.word]}
                className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  addedWords[item.word]
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white shadow-md hover:shadow-[var(--color-brand)]/20'
                }`}
              >
                {addingWord[item.word] ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : addedWords[item.word] ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : null}
                {addingWord[item.word] ? '收录中...' : addedWords[item.word] ? '已收录' : '收录生词本'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
