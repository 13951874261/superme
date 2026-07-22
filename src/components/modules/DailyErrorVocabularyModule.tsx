import React, { useState, useEffect } from 'react';
import { BookOpen, RefreshCw, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getAllWords, addWord } from '../../services/vocabAPI';
import { generateDailyFlawVocabulary, getFallbackFlawVocab } from '../../services/difyAPI';
import { playSuccess, playError } from '../../utils/soundEffects';
import SpeakButton from '../SpeakButton';

interface FlawVocabWord {
  word: string;
  ipa: string;
  pronunciation_note: string;
  meaning_zh: string;
  example: string;
}

export default function DailyErrorVocabularyModule() {
  const [words, setWords] = useState<FlawVocabWord[]>([]);
  const [sessionExclude, setSessionExclude] = useState<string[]>([]); // 记录本次刷新过的历史单词
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingWord, setAddingWord] = useState<Record<string, boolean>>({});
  const [addedWords, setAddedWords] = useState<Record<string, boolean>>({});

  const fetchFlawVocab = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // A. 获取当前生词本已有单词
      const dbWords = await getAllWords();
      const dbWordStrings = dbWords.map(w => w.word.toLowerCase().trim()).filter(Boolean);

      // B. 合并生词本与本次会话已刷新单词，并去重
      const allExclude = Array.from(new Set([...dbWordStrings, ...sessionExclude]));

      // C. 调用大模型接口生成（传递最新去重单词列表以让大模型避重，限制最近 50 个词防止 token 溢出）
      const apiExclude = allExclude.slice(-50);
      const data = await generateDailyFlawVocabulary(apiExclude);

      // D. 前端再次进行强校验排重过滤
      const filtered = data.filter(item => {
        const wLower = item.word.toLowerCase().trim();
        return !dbWordStrings.includes(wLower) && !sessionExclude.includes(wLower);
      });

      // E. 如果过滤后不足 6 个词，用备用词库进行补充（同样进行排重）
      let finalWords = [...filtered];
      if (finalWords.length < 6) {
        const fallbackList = getFallbackFlawVocab();
        for (const fb of fallbackList) {
          if (finalWords.length >= 6) break;
          const fbLower = fb.word.toLowerCase().trim();
          const notInDb = !dbWordStrings.includes(fbLower);
          const notInSession = !sessionExclude.includes(fbLower);
          const notInFinal = !finalWords.some(w => w.word.toLowerCase().trim() === fbLower);
          if (notInDb && notInSession && notInFinal) {
            finalWords.push(fb);
          }
        }
      }

      // F. 强力兜底：如果依然不足 6 个词（说明排除项过多导致备用池已消耗完毕），则忽略会话历史去重限制，重新使用备选词补足
      let usedReset = false;
      if (finalWords.length < 6) {
        usedReset = true;
        const fallbackList = getFallbackFlawVocab();
        for (const fb of fallbackList) {
          if (finalWords.length >= 6) break;
          const fbLower = fb.word.toLowerCase().trim();
          const notInDb = !dbWordStrings.includes(fbLower);
          const notInFinal = !finalWords.some(w => w.word.toLowerCase().trim() === fbLower);
          if (notInDb && notInFinal) {
            finalWords.push(fb);
          }
        }
      }

      // G. 终极兜底：如果用户几乎把备用词库的所有词都添加到了生词本中，导致不重复的词不足 6 个，允许重复显示生词本里的备用词补足，确保绝不出现空白卡片
      if (finalWords.length < 6) {
        const fallbackList = getFallbackFlawVocab();
        for (const fb of fallbackList) {
          if (finalWords.length >= 6) break;
          const fbLower = fb.word.toLowerCase().trim();
          const notInFinal = !finalWords.some(w => w.word.toLowerCase().trim() === fbLower);
          if (notInFinal) {
            finalWords.push(fb);
          }
        }
      }

      // H. 取前 6 个展示
      const displayWords = finalWords.slice(0, 6);
      setWords(displayWords);

      // I. 记录这 6 个新展示的词汇到会话排除列表中，防止下次刷新重复；如果触发了重置，则清空之前历史，重置为仅包含这 6 个新词
      const newSessionExclude = displayWords.map(w => w.word.toLowerCase().trim());
      if (usedReset) {
        setSessionExclude(newSessionExclude);
      } else {
        setSessionExclude(prev => Array.from(new Set([...prev, ...newSessionExclude])));
      }
    } catch (e: any) {
      setError(e.message || '获取每日破绽词汇失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlawVocab();
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
            <p className="text-xs text-slate-400 mt-1 font-medium">调用 Dify 接口动态提取与破绽分析相关的商业词汇与精准提问句式</p>
          </div>
        </div>
        <button
          onClick={fetchFlawVocab}
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
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">正在呼叫 Dify API 动态生成破绽词汇...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mb-2" />
          <p className="text-sm text-red-400 font-semibold mb-4">{error}</p>
          <button
            onClick={fetchFlawVocab}
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