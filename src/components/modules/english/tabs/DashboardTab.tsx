import React, { useState, useEffect } from 'react';
import { Target, AlertTriangle, CheckCircle2, Clock, Loader2, Zap, Volume2, BookOpen, RefreshCw, FileText, Trash2, Globe, User } from 'lucide-react';
import { useEnglishContext, getThemeOptions } from '../context/EnglishContext';
import PronunciationTrainer from '../../PronunciationTrainer';
import GrammarPolishTrainer from '../../GrammarPolishTrainer';
import MaterialUploader from '../../../MaterialUploader';
import Confetti from '../../../Confetti';
import { playSuccess, playError, playScan } from '../../../../utils/soundEffects';
import { checkThemeMastery, setThemeFocus } from '../../../../services/trainingAPI';
import { generateDailyFlawVocabulary, triggerEnglishMasteryExtraction, getDailyQuotaStatus } from '../../../../services/difyAPI';
import { addWord, getAllWords } from '../../../../services/vocabAPI';
import SpeakButton, { speakEnglish } from '../../../SpeakButton';

interface FlawVocabWord {
  word: string;
  ipa: string;
  pronunciation_note: string;
  meaning_zh: string;
  example: string;
}

function DailyFlawVocabCard() {
  const [words, setWords] = useState<FlawVocabWord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingWord, setAddingWord] = useState<Record<string, boolean>>({});
  const [addedWords, setAddedWords] = useState<Record<string, boolean>>({});

  const fetchFlawVocab = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await generateDailyFlawVocabulary();
      setWords(data.slice(0, 6));
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
    <div className="bg-slate-900 text-white rounded-[2rem] p-8 border border-slate-800 shadow-[0_4px_25px_rgba(0,0,0,0.15)] relative overflow-hidden mt-6">
      <div className="absolute -right-16 -top-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-md">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
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
            className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl uppercase tracking-widest hover:bg-indigo-700 transition-colors"
          >
            重试
          </button>
        </div>
      ) : words.length === 0 ? (
        <div className="text-center py-12 text-slate-550 text-sm font-medium">暂无数据，请尝试刷新</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
          {words.map((item) => (
            <div 
              key={item.word} 
              className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-5 hover:border-indigo-500/40 hover:bg-slate-800/60 transition-all group flex flex-col justify-between"
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
                
                <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-3 text-[11px] text-slate-300 leading-relaxed italic relative mb-4">
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
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-indigo-600/20'
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

import { VOICE_OPTIONS } from '../../../../config/voices';


export default function DashboardTab() {
  const {
    stage, setStage,
    theme, setTheme,
    masteryData,
    themeSwitchError, setThemeSwitchError,
    pronunciationNotes, setPronunciationNotes,
    grammarNotes, setGrammarNotes,
    impromptuPassed,
    inlineNotice, noticeAnchor, setActiveTab, showNotice
  } = useEnglishContext();

  const handleStageChange = async (newStage: '0-6' | '6-12') => {
    // 核心修复：切回当前阶段时，不加限制并直接清理可能残留的弹窗
    if (newStage === stage) {
      setThemeSwitchError(null);
      return;
    }
    
    // 堵住漏洞：切换阶段也会导致主题变更，必须执行强制拦截校验！
    try {
      const m = await checkThemeMastery(theme);
      if (!m.isMastered) {
        setThemeSwitchError(
          `当前阵地【${theme}】尚未被攻克！\n\n当前战绩：\n• 沉浸式口语沙盘：${m.oralCount}/10 轮\n• L3 书面评估最高分：${m.maxWriteScore}/10 分（及格线: 8分）\n\n请把当前阵地打透再拔营。`
        );
        return;
      }
      
      // 校验通过，放行阶段切换
      setThemeSwitchError(null);
      setStage(newStage);
      const options = getThemeOptions(newStage);
      if (!options.find(o => o.value === theme)) {
        setTheme(options[0].value);
        await setThemeFocus({ theme: options[0].value }).catch(() => {});
      }
    } catch {
      setThemeSwitchError('后端服务暂时不可访问，无法校验通关状态。');
    }
  };

  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [isClearingAndReGenerating, setIsClearingAndReGenerating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [quotaStatus, setQuotaStatus] = useState<{
    wordsUsed: number;
    wordsLimit: number;
    phrasesUsed: number;
    phrasesLimit: number;
    wordsLeft: number;
    phrasesLeft: number;
  } | null>(null);

  const [generatedArticle, setGeneratedArticle] = useState<string>(() => {
    return localStorage.getItem('super_agent_last_generated_article') || '';
  });
  const [extractedWords, setExtractedWords] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('super_agent_last_generated_words') || '[]');
    } catch {
      return [];
    }
  });
  const [extractedPhrases, setExtractedPhrases] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('super_agent_last_generated_phrases') || '[]');
    } catch {
      return [];
    }
  });

  // 题材与难度等级控制
  const [cefrLevel, setCefrLevel] = useState<'A2' | 'B1' | 'B2' | 'C1'>('B1');
  const [genre, setGenre] = useState<'news' | 'meeting' | 'podcast' | 'reading'>('meeting');

  // 沉浸式阅读空间状态
  const [isImmersiveOpen, setIsImmersiveOpen] = useState(false);
  const [immersiveTheme, setImmersiveTheme] = useState<'paper' | 'parchment' | 'dark'>('parchment');
  const [immersiveFontSize, setImmersiveFontSize] = useState<'base' | 'lg' | 'xl'>('lg');
  const [selectedWord, setSelectedWord] = useState('');
  const [isAddingSelected, setIsAddingSelected] = useState(false);
  const [customText, setCustomText] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // 全局发音角色状态同步
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem('super_agent_default_voice') || 'en-GB-LibbyNeural';
  });

  useEffect(() => {
    const handleVoiceChange = () => {
      setSelectedVoice(localStorage.getItem('super_agent_default_voice') || 'en-GB-LibbyNeural');
    };
    window.addEventListener('global-voice-changed', handleVoiceChange);
    return () => window.removeEventListener('global-voice-changed', handleVoiceChange);
  }, []);

  // 缓存今日提纯词汇的音标和释义详情
  const [vocabDetailsMap, setVocabDetailsMap] = useState<Record<string, any>>({});

  const loadVocabDetails = async () => {
    try {
      const allWords = await getAllWords();
      const detailsMap: Record<string, any> = {};
      allWords.forEach((item) => {
        if (item.word) {
          let payload = item.payload;
          if (typeof payload === 'string') {
            try {
              payload = JSON.parse(payload);
            } catch {
              payload = {};
            }
          }
          detailsMap[item.word.toLowerCase().trim()] = {
            phonetic: payload?.phonetic || '',
            meaning: payload?.meaning || '',
            definition_en: payload?.definition_en || '',
            business_note: payload?.business_note || '',
          };
        }
      });
      setVocabDetailsMap(detailsMap);
    } catch (err) {
      console.error('Failed to load vocab details:', err);
    }
  };

  useEffect(() => {
    if (extractedWords.length > 0) {
      loadVocabDetails();
    }
  }, [extractedWords]);

  // 加载每日配额状态
  const loadQuotaStatus = async () => {
    try {
      const { getDailyQuotaStatus } = await import('../../../../services/difyAPI');
      const data = await getDailyQuotaStatus();
      setQuotaStatus(data.quota);
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    loadQuotaStatus();
  }, []);

  const handleAutoGenerate = async () => {
    setIsAutoGenerating(true);
    playScan();
    showNotice('dashboard', '正在呼叫 AI 提纯弹药...', 'info');
    try {
      const { runListenMaterialGenerator, triggerEnglishMasteryExtraction } = await import('../../../../services/difyAPI');
      let script = '';

      // 尝试生成一段引导语料（若工作流可用），否则跳过
      try {
        const listenGenre = genre === 'reading' ? 'meeting' : genre;
        script = await runListenMaterialGenerator(theme, listenGenre, cefrLevel);
      } catch {
        script = '';
      }

      const result = await triggerEnglishMasteryExtraction(theme, script, 'default-user', cefrLevel, genre);

      // 更新配额状态
      if (result.quota) {
        setQuotaStatus(result.quota);
      }

      // 配额耗尽时的特殊处理
      if (result.quotaExceeded) {
        showNotice('dashboard', result.message, 'error');
        playError();
        return;
      }

      // 保存生成的文章和提取出来的词汇/短语
      if (result.article) {
        setGeneratedArticle(result.article);
        localStorage.setItem('super_agent_last_generated_article', result.article);
      }
      if (result.words) {
        setExtractedWords(result.words);
        localStorage.setItem('super_agent_last_generated_words', JSON.stringify(result.words));
      }
      if (result.phrases) {
        setExtractedPhrases(result.phrases);
        localStorage.setItem('super_agent_last_generated_phrases', JSON.stringify(result.phrases));
      }

      // 根据配额状态给出差异化提示
      const { wordsLeft = 0, phrasesLeft = 0, wordsAddedCount = 0, phrasesAddedCount = 0 } = result as any;
      
      // 只要生成成功，始终播放提示音和五彩纸屑
      playSuccess();
      setShowConfetti(true);

      if (wordsAddedCount > 0 && wordsLeft === 0) {
        showNotice('dashboard', `今日词汇配额已满(${result.quota?.wordsLimit}/${result.quota?.wordsLimit})，入库 ${wordsAddedCount} 词 ${phrasesAddedCount} 短语`, 'info');
      } else if (phrasesAddedCount > 0 && phrasesLeft === 0) {
        showNotice('dashboard', `今日短语配额已满(${result.quota?.phrasesLimit}/${result.quota?.phrasesLimit})，入库 ${wordsAddedCount} 词 ${phrasesAddedCount} 短语`, 'info');
      } else if (wordsAddedCount > 0 || phrasesAddedCount > 0) {
        showNotice('dashboard', `入库 ${wordsAddedCount} 词 ${phrasesAddedCount} 短语 | 剩余配额：${wordsLeft} 词 ${phrasesLeft} 短语`, 'success');
      } else {
        showNotice('dashboard', '本次生成长文成功，未提取到新词汇（可能有重复/配额满）', 'success');
      }

      window.dispatchEvent(new Event('vocab-updated'));
    } catch (e: any) {
      playError();
      showNotice('dashboard', `提取失败: ${e.message}`, 'error');
    } finally {
      setIsAutoGenerating(false);
    }
  };

  const handleClearTodayAndReGenerate = async () => {
    setIsClearingAndReGenerating(true);
    playScan();
    showNotice('dashboard', '正在清理今日配额与生词数据...', 'info');

    try {
      const { clearTodayQuotaAndData } = await import('../../../../services/difyAPI');
      
      // 调用后端 API 清除今日配额与数据
      await clearTodayQuotaAndData();
      
      // 清空本地状态与 localStorage
      setGeneratedArticle('');
      setExtractedWords([]);
      setExtractedPhrases([]);
      localStorage.removeItem('super_agent_last_generated_article');
      localStorage.removeItem('super_agent_last_generated_words');
      localStorage.removeItem('super_agent_last_generated_phrases');
      
      // 重新拉取最新的配额状态
      await loadQuotaStatus();
      
      showNotice('dashboard', '今日配额和数据已清空，正在重新呼叫 AI 生成...', 'info');
      
      // 触发重新生成 (由于 handleAutoGenerate 内部调用了 setIsAutoGenerating，这里我们可以直接执行)
      // 为了确保 setIsClearingAndReGenerating 已经为 false, 我们在 handleAutoGenerate 之前或之后设为 false
      setIsClearingAndReGenerating(false);
      
      // 直接调用 handleAutoGenerate
      await handleAutoGenerate();
    } catch (e: any) {
      playError();
      showNotice('dashboard', `重置并生成失败: ${e.message}`, 'error');
      setIsClearingAndReGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease-out] relative">
      {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
      
      {/* 战术使用指南 SOP */}
      <div className="bg-indigo-50/30 border-l-4 border-indigo-500 rounded-r-2xl p-5 flex items-start gap-4 shrink-0 shadow-sm">
        <div className="bg-indigo-600 text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-md">
           <Target className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-indigo-900 mb-1">战术使用指南 // Tactical SOP</h5>
          <p className="text-xs text-indigo-800/80 font-medium">请遵循以下战术指南，以最大化利用本模块的高阶商业实战材料与AI提纯引擎。</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-left">
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-all duration-300 transform hover:-translate-y-0.5">
              <span className="text-amber-500 mt-0.5">💡</span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">操作说明：</span>在上方选择战略阶段与闭环主题，在下方一键“生成今日长文并提纯”获取语料弹药。</p>
            </div>
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-all duration-300 transform translate-y-1 hover:translate-y-0.5">
              <span className="text-amber-500 mt-0.5">💡</span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">功能亮点：</span>硬核“通关锁”机制——口语不练满 10 轮、邮件拿不到 8 分，阵地将被强制死锁。</p>
            </div>
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-all duration-300 transform -translate-y-0.5 hover:translate-y-[-4px]">
              <span className="text-amber-500 mt-0.5">💡</span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">生态定位：</span>【全局中枢】它设定的 Theme 将统治后续所有模块的场景；它抽取的弹药将直接输送至 Vocab 矩阵。</p>
            </div>
          </div>
        </div>
      </div>

      {/* 每日破绽词汇推送板块 */}
      <DailyFlawVocabCard />

      <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col md:flex-row gap-8">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest font-black text-[#FF5722] mb-3">战略阶段 (Stage)</span>
          <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100">
            <button onClick={(e) => { e.stopPropagation(); handleStageChange('0-6'); }} className={`px-5 py-2.5 text-xs font-black tracking-widest uppercase rounded-lg transition-all ${stage === '0-6' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400 hover:text-[#202124]'}`}>0-6个月: 政商务</button>
            <button onClick={(e) => { e.stopPropagation(); handleStageChange('6-12'); }} className={`px-5 py-2.5 text-xs font-black tracking-widest uppercase rounded-lg transition-all ${stage === '6-12' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400 hover:text-[#202124]'}`}>6-12个月: 全场景</button>
          </div>
        </div>
        <div className="flex flex-col flex-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-3">当前闭环主题 (Theme Gateway)</span>

          {themeSwitchError && (
            <div className="flex items-start gap-3 mb-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 animate-[fadeIn_0.2s_ease-out]">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
              <div className="flex-1">
                <p className="text-[11px] font-black uppercase tracking-widest text-red-600 mb-1">🚫 跨国高管拦截指令</p>
                <p className="text-xs font-medium leading-relaxed whitespace-pre-line">{themeSwitchError}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setThemeSwitchError(null); }}
                className="text-red-400 hover:text-red-600 text-lg leading-none font-bold shrink-0"
              >×</button>
            </div>
          )}

          <div className="flex items-center gap-3">
            <select
              value={theme}
              onChange={async (e) => {
                const target = e.target;
                const next = target.value;
                if (next === theme) return;
                setThemeSwitchError(null);
                try {
                  const m = await checkThemeMastery(theme);
                  if (!m.isMastered) {
                    target.value = theme;
                    setThemeSwitchError(
                      `当前阵地【${theme}】尚未被攻克！\n\n当前战绩：\n• 沉浸式口语沙盘：${m.oralCount}/10 轮\n• L3 书面评估最高分：${m.maxWriteScore}/10 分（及格线: 8分）\n\n请把当前阵地打透再拔营。`
                    );
                    return;
                  }
                  setTheme(next);
                  await setThemeFocus({ theme: next }).catch(() => {});
                } catch {
                  target.value = theme;
                  setThemeSwitchError('后端服务暂时不可访问，无法校验通关状态。\n请确认 super-agent-vocab.service 已启动（/api/theme/check-mastery）。');
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                // 核心修复：一旦用户重新点击下拉框（意图切回当前任务/阶段），立刻清理旧的红色拦截弹窗
                setThemeSwitchError(null);
              }}
              className="flex-1 bg-[#f8f9fa] border border-gray-200 text-[#202124] text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-[#FF5722]"
            >
              {getThemeOptions(stage).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div
              className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all whitespace-nowrap border ${
                masteryData.isMastered
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}
            >
              {masteryData.isMastered ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              <span className="text-xs font-black uppercase tracking-widest">
                {masteryData.isMastered ? '已通关 (解锁下沉)' : '未达标 (强制锁定)'}
              </span>
            </div>
          </div>
          {!masteryData.isMastered && (
            <div className="text-[10px] text-gray-500 font-medium mt-2">
              当前通关进度：口语对抗 {masteryData.oralCount}/10 轮 | L3 书面最高分 {masteryData.maxWriteScore}/8 分 | 即兴演讲 {impromptuPassed ? '✅已达标' : '⚠️未达标'}
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#202124] rounded-[2rem] p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF5722]/10 rounded-full blur-3xl pointer-events-none"></div>
        <h4 className="text-sm font-black uppercase tracking-widest text-[#FF5722] mb-6 flex items-center">
          <Clock className="w-5 h-5 mr-3" /> 基础唤醒追踪 (Foundation)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-2 flex-shrink-0">发音纠正 (10min/Day)</span>
            <div className="flex-1 min-h-0">
              <PronunciationTrainer 
                initialNotes={pronunciationNotes} 
                onNotesChange={setPronunciationNotes} 
                userId="default-user" 
              />
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-2 flex-shrink-0">核心语法复健 (8-10个核心点)</span>
            <div className="flex-1 min-h-0">
              <GrammarPolishTrainer 
                initialNotes={grammarNotes} 
                onNotesChange={setGrammarNotes} 
                userId="default-user" 
              />
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <h4 className="text-sm font-black uppercase tracking-widest text-[#202124] flex items-center">
            <Target className="w-5 h-5 mr-3 text-[#FF5722]" /> 弹药补给库 (Arsenal)
          </h4>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">题材 (Genre):</span>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value as any)}
                className="bg-white border border-gray-200 text-[#202124] text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-[#FF5722] cursor-pointer shadow-sm"
              >
                <option value="meeting">高管会议 (Meeting)</option>
                <option value="news">财经新闻 (News)</option>
                <option value="podcast">深度播客 (Podcast)</option>
                <option value="reading">沉浸阅读 (Reading)</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">难度 (Level):</span>
              <select
                value={cefrLevel}
                onChange={(e) => setCefrLevel(e.target.value as any)}
                className="bg-white border border-gray-200 text-[#202124] text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-[#FF5722] cursor-pointer shadow-sm animate-none"
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
              className="flex items-center bg-[#202124] text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#FF5722] transition-colors disabled:opacity-50 cursor-pointer shadow-lg"
            >
              {isAutoGenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> AI 执行中...</>
              ) : (
                <><Zap className="w-4 h-4 mr-2 text-amber-400"/> AI 自动生成今日长文并提纯</>
              )}
            </button>

            <div className="relative inline-block">
              <button
                onClick={() => setShowClearConfirm(!showClearConfirm)}
                disabled={isAutoGenerating || isClearingAndReGenerating}
                className="flex items-center bg-gray-100 text-gray-750 hover:bg-red-50 hover:text-red-600 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-gray-200 disabled:opacity-50 cursor-pointer shadow-sm"
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
                      <p className="text-[11px] text-gray-400 font-medium leading-relaxed mt-1">
                        此操作将彻底删除您今天在此主题下生成的全部生词和短语（删除本地与数据库记录），并重置今日配额，随后自动为您重新运行 AI 长文生成与提纯。
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2.5 mt-5 pt-3 border-t border-gray-50">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
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

        {/* 每日配额指示器 */}
        {quotaStatus && (
          <div className="flex gap-6 mb-6 bg-slate-100 rounded-2xl p-4 border border-slate-200">
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">每日词汇配额</span>
                <span className="text-[11px] font-black text-slate-700">{quotaStatus.wordsUsed}/{quotaStatus.wordsLimit}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${quotaStatus.wordsLeft === 0 ? 'bg-red-400' : quotaStatus.wordsUsed === 0 ? 'bg-indigo-505' : 'bg-indigo-500'}`}
                  style={{ width: `${(quotaStatus.wordsUsed / quotaStatus.wordsLimit) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 font-medium">{quotaStatus.wordsLeft} 个剩余</span>
            </div>
            <div className="w-px bg-slate-200 shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">每日短语配额</span>
                <span className="text-[11px] font-black text-slate-700">{quotaStatus.phrasesUsed}/{quotaStatus.phrasesLimit}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${quotaStatus.phrasesLeft === 0 ? 'bg-red-400' : 'bg-emerald-500'}`}
                  style={{ width: `${(quotaStatus.phrasesUsed / quotaStatus.phrasesLimit) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 font-medium">{quotaStatus.phrasesLeft} 个剩余</span>
            </div>
          </div>
        )}

        {inlineNotice && noticeAnchor === 'dashboard' && (
          <div className={`absolute right-0 top-16 z-20 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-lg border ${inlineNotice.tone === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : inlineNotice.tone === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-blue-500 text-white border-blue-400'}`}>
            {inlineNotice.text}
          </div>
        )}

        {/* 沉浸式阅读与收听 */}
        <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mb-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest text-[#FF5722] mb-1 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                今日情报截获 // Immersive Intel Briefing
              </h4>
              <p className="text-xs text-gray-400 font-medium">
                基于主阵地主题【{theme}】生成的高阶商业实战材料，支持 EmmaNeural 语音收听与沉浸式阅读。
              </p>
            </div>
            {generatedArticle && (
              <div className="flex items-center gap-3 shrink-0">
                <div className="relative inline-block">
                  <button
                    onClick={() => setShowResetConfirm(!showResetConfirm)}
                    className="flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-750 transition-colors shadow-sm font-black rounded-xl text-xs uppercase tracking-widest cursor-pointer"
                    title="清空已生成内容，重新配置生成"
                  >
                    <RefreshCw className="w-4 h-4" /> 重新初始化
                  </button>

                  {showResetConfirm && (
                    <div className="absolute right-0 top-full mt-2.5 z-50 w-72 bg-white border border-indigo-100 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-5 text-left border-t-4 border-t-indigo-500 animate-[fadeIn_0.15s_ease-out]">
                      <div className="flex items-start gap-3">
                        <div className="bg-indigo-50 p-2 rounded-xl text-indigo-500 shrink-0">
                          <RefreshCw className="w-5 h-5 animate-spin-slow" />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">确认重新初始化吗？</h5>
                          <p className="text-[11px] text-gray-400 font-medium leading-relaxed mt-1">
                            这只会清除当前页面展示的今日长文和本地缓存，以便您可以重新配置生成。它**不会**删除生词库里已入库的单词。
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2.5 mt-5 pt-3 border-t border-gray-50">
                        <button
                          onClick={() => setShowResetConfirm(false)}
                          className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          取消
                        </button>
                        <button
                          onClick={() => {
                            setShowResetConfirm(false);
                            setGeneratedArticle('');
                            setExtractedWords([]);
                            setExtractedPhrases([]);
                            localStorage.removeItem('super_agent_last_generated_article');
                            localStorage.removeItem('super_agent_last_generated_words');
                            localStorage.removeItem('super_agent_last_generated_phrases');
                            showNotice('dashboard', '已成功初始化生成器，可以重新配置生成。', 'success');
                            playSuccess();
                          }}
                          className="px-3.5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all shadow-sm"
                        >
                          确认初始化
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setIsImmersiveOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-md font-black rounded-xl text-xs uppercase tracking-widest cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" /> 沉浸式阅读
                </button>
                <SpeakButton 
                  text={generatedArticle} 
                  label="收听全文 (Emma)" 
                  className="px-5 py-3 bg-[#202124] text-white hover:bg-[#FF5722] shadow-md font-black rounded-xl" 
                />
              </div>
            )}
          </div>

          {generatedArticle ? (
            <>
              <div className="text-sm text-gray-800 leading-relaxed font-serif p-6 bg-[#f8f9fa]/60 rounded-2xl border border-gray-100 whitespace-pre-line select-text shadow-sm">
                {generatedArticle}
              </div>

              {(extractedWords.length > 0 || extractedPhrases.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                  {extractedWords.length > 0 && (
                    <div className="space-y-4">
                      <h5 className="text-[11px] font-black uppercase tracking-widest text-[#202124] flex items-center gap-1.5">
                        <span className="w-1.5 h-3 bg-indigo-550 rounded-full"></span>
                        成功提纯商战生词 ({extractedWords.length})
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {extractedWords.map((word) => {
                          const details = vocabDetailsMap[word.toLowerCase().trim()];
                          const phonetic = details?.phonetic || '';
                          const meaning = details?.meaning || '中文释义加载中...';
                          return (
                            <div
                              key={word}
                              className="group relative flex flex-col justify-between p-4 bg-slate-50/50 hover:bg-white border border-slate-100 hover:border-indigo-150 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md transition-all duration-300 min-h-[96px] text-left overflow-hidden"
                            >
                              {/* Top Row: Word & Pronunciation Button */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-col">
                                  <span className="font-serif font-black text-slate-800 text-sm tracking-wide break-all">
                                    {word}
                                  </span>
                                  {phonetic && (
                                    <span className="text-[10px] text-slate-400 font-sans mt-0.5 font-medium">
                                      {phonetic}
                                    </span>
                                  )}
                                </div>
                                <SpeakButton
                                  text={word}
                                  iconClassName="w-3.5 h-3.5"
                                  className="w-7 h-7 bg-indigo-50/50 text-indigo-500 hover:bg-indigo-650 hover:text-white border-none shrink-0"
                                />
                              </div>

                              {/* Bottom Row: Hover Translation */}
                              <div className="mt-3 pt-2.5 border-t border-dashed border-slate-100/80">
                                <div className="relative h-4 overflow-hidden">
                                  <span className="absolute inset-0 text-[10px] text-slate-350 font-black tracking-widest transition-all duration-300 group-hover:opacity-0 group-hover:translate-y-[-10px] uppercase">
                                    Hover to reveal
                                  </span>
                                  <span className="absolute inset-0 text-[11px] text-indigo-600 font-bold tracking-wide transition-all duration-300 opacity-0 translate-y-[10px] group-hover:opacity-100 group-hover:translate-y-0 truncate">
                                    {meaning}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {extractedPhrases.length > 0 && (
                    <div className="space-y-4">
                      <h5 className="text-[11px] font-black uppercase tracking-widest text-[#202124] flex items-center gap-1.5">
                        <span className="w-1.5 h-3 bg-amber-500 rounded-full"></span>
                        成功提纯高频句型 ({extractedPhrases.length})
                      </h5>
                      <div className="space-y-3">
                        {extractedPhrases.map((phrase, idx) => (
                          <div
                            key={idx}
                            className="group flex items-center justify-between gap-4 p-4 bg-white border border-slate-100 hover:border-emerald-100 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md transition-all duration-300 relative overflow-hidden pl-5"
                          >
                            {/* Gold Left Border Highlight Line */}
                            <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#FF5722] rounded-r-lg group-hover:bg-[#FF5722]/80 transition-colors"></div>

                            {/* Phrase Content */}
                            <div className="flex-1 select-text text-left">
                              <p className="text-xs text-slate-700 font-serif leading-relaxed italic">
                                "{phrase}"
                              </p>
                              <div className="flex items-center gap-1.5 mt-2">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                                  艾宾浩斯已入库 · 复习阶段: 1
                                </span>
                              </div>
                            </div>

                            {/* Speak Button */}
                            <SpeakButton
                              text={phrase}
                              iconClassName="w-3.5 h-3.5"
                              className="w-8 h-8 bg-emerald-50/50 text-emerald-600 hover:bg-emerald-600 hover:text-white border-none shrink-0"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="w-full grid grid-cols-1 lg:grid-cols-10 gap-8 items-stretch">
              
              {/* Left Column: Guidelines & Daily Quote (4 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-5 text-left">
                {/* 1. Guideline Card */}
                <div className="flex-1 bg-white/70 backdrop-blur-[4px] rounded-[1.5rem] border border-slate-100 p-6 flex flex-col justify-between shadow-sm relative overflow-hidden">
                  <div className="absolute right-[-20px] top-[-20px] w-24 h-24 rounded-full bg-indigo-50/35 blur-xl pointer-events-none"></div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-500 shadow-inner">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                          AI 智能提纯引擎
                        </h5>
                        <span className="text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider mt-0.5 inline-block">
                          Active Intel Engine
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                      本模块是您的高能英文训练场。通过在右侧输入框粘贴英文商业段落、会议纪要或财经新闻，AI 引擎将自动提供以下强力补给：
                    </p>
                    
                    <ul className="space-y-2.5 pt-1.5">
                      <li className="flex items-start gap-2 text-[11px] text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></span>
                        <span><strong>句子级高保真点读</strong>：采用先进的语音发音人进行极速流式朗读。</span>
                      </li>
                      <li className="flex items-start gap-2 text-[11px] text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></span>
                        <span><strong>商战词汇与短语提取</strong>：自动匹配并标记难词与高频词伙。</span>
                      </li>
                      <li className="flex items-start gap-2 text-[11px] text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></span>
                        <span><strong>艾宾浩斯智能复习</strong>：成功提取的生词将一键加入您的长期记忆复习曲线。</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-dashed border-slate-100 mt-4">
                    <button
                      onClick={() => {
                        const samples = [
                          "Apple Inc. plans to adjust its supply chain pricing strategy to mitigate macroeconomic tariffs and currency fluctuations.",
                          "The board of directors raised concerns about the company's Q3 revenue margins, emphasizing the need for stricter operational cost-cutting measures.",
                          "Our priority in this bilateral negotiation is to secure a long-term licensing agreement while maintaining absolute control over our intellectual property rights."
                        ];
                        const randomSample = samples[Math.floor(Math.random() * samples.length)];
                        setCustomText(randomSample);
                        showNotice('dashboard', '已成功加载商业研读示例文本', 'success');
                        playSuccess();
                      }}
                      className="w-full py-2 bg-indigo-50/60 hover:bg-indigo-100/80 text-indigo-650 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all border border-indigo-100/40 cursor-pointer"
                    >
                      💡 随机加载商业研读示例
                    </button>
                  </div>
                </div>

                {/* 2. Daily Quote Card */}
                <div className="bg-[#FAF6F0]/70 rounded-[1.5rem] border border-[#F0E5D8]/80 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#B8860B]">
                        Daily Quote // 今日商战箴言
                      </span>
                    </div>
                    <p className="text-xs text-slate-705 font-serif italic leading-relaxed">
                      "In business, you don't get what you deserve, you get what you negotiate."
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold text-right">
                      — Chester L. Karrass
                    </p>
                  </div>
                  <div className="flex justify-end mt-2">
                    <SpeakButton
                      text="In business, you don't get what you deserve, you get what you negotiate."
                      iconClassName="w-3 h-3"
                      className="w-6 h-6 bg-amber-50/80 text-amber-700 hover:bg-amber-600 hover:text-white border-none rounded-full cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Custom Text Input Area (6 cols) */}
              <div className="lg:col-span-6 bg-white/50 backdrop-blur-[2px] rounded-[1.5rem] border border-slate-100 p-6 flex flex-col justify-between shadow-sm">
                <div className="space-y-3 flex-1 flex flex-col text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      研读段落情报输入 (Input Material)
                    </span>
                    {customText.length > 0 && (
                      <span className="text-[9px] text-gray-405 font-bold">
                        已输入 {customText.length} 字符
                      </span>
                    )}
                  </div>
                  <textarea
                    placeholder="在此处输入或粘贴您要研读的英文段落材料..."
                    className="w-full flex-1 min-h-[280px] p-5 text-sm bg-white border border-gray-150 rounded-2xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 font-sans resize-none shadow-[0_2px_12px_rgba(0,0,0,0.01)] transition-all text-slate-800 leading-relaxed placeholder:text-gray-350"
                    onChange={(e) => setCustomText(e.target.value)}
                    value={customText}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    {customText.trim() ? "👉 准备就绪，请选择操作" : "✍️ 请在上方输入段落开始研读"}
                  </div>
                  
                  {customText.trim() && (
                    <div className="flex gap-2.5 animate-[fadeIn_0.2s_ease-out]">
                      <SpeakButton 
                        text={customText} 
                        label="立即收听" 
                        className="px-4.5 py-2.5 bg-[#202124] text-white hover:bg-[#FF5722] shadow-sm font-black rounded-xl text-[10px] uppercase tracking-widest cursor-pointer" 
                      />
                      <button
                        onClick={() => {
                          setGeneratedArticle(customText);
                          localStorage.setItem('super_agent_last_generated_article', customText);
                          setIsImmersiveOpen(true);
                          showNotice('dashboard', '已加载自定义文本进入沉浸式阅读空间', 'success');
                          playSuccess();
                        }}
                        className="flex items-center gap-2 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm font-black rounded-xl text-[10px] uppercase tracking-widest cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" /> 进入沉浸式阅读
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
            </div>
          )}
        </div>

        <MaterialUploader topicHint={theme} onExtractionSuccess={() => setActiveTab('vocab')} />
      </div>

      {/* 沉浸式阅读空间 Fullscreen Modal */}
      {isImmersiveOpen && generatedArticle && (
        <div className={`fixed inset-0 z-50 flex flex-col transition-all duration-300 ${
          immersiveTheme === 'dark' ? 'bg-[#0f172a] text-slate-205' :
          immersiveTheme === 'parchment' ? 'bg-[#fcf8f2] text-slate-800' : 'bg-white text-slate-900'
        }`}>
          {/* Header */}
          <div className={`flex items-center justify-between px-8 py-5 border-b shrink-0 ${
            immersiveTheme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200/60 bg-gray-50'
          }`}>
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-[#FF5722]" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-[#FF5722]">
                  沉浸式阅读空间 // Immersive Reading Room
                </h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                  Theme: {theme} | cefr: {cefrLevel} | genre: {genre}
                </p>
              </div>
            </div>

            {/* Typography Controls */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 bg-black/5 p-1 rounded-lg">
                <button
                  onClick={() => setImmersiveTheme('paper')}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded ${
                    immersiveTheme === 'paper' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  纸张
                </button>
                <button
                  onClick={() => setImmersiveTheme('parchment')}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded ${
                    immersiveTheme === 'parchment' ? 'bg-[#f5e6d3] shadow-sm text-[#5c3e21]' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  雅致
                </button>
                <button
                  onClick={() => setImmersiveTheme('dark')}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded ${
                    immersiveTheme === 'dark' ? 'bg-slate-800 shadow-sm text-slate-200' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  深邃
                </button>
              </div>

              <div className="flex items-center gap-1.5 bg-black/5 p-1 rounded-lg">
                <button
                  onClick={() => setImmersiveFontSize('base')}
                  className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded ${
                    immersiveFontSize === 'base' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-800'
                  }`}
                  title="较小字号"
                >
                  A-
                </button>
                <button
                  onClick={() => setImmersiveFontSize('lg')}
                  className={`w-7 h-7 flex items-center justify-center text-sm font-bold rounded ${
                    immersiveFontSize === 'lg' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-800'
                  }`}
                  title="中等字号"
                >
                  A
                </button>
                <button
                  onClick={() => setImmersiveFontSize('xl')}
                  className={`w-7 h-7 flex items-center justify-center text-base font-bold rounded ${
                    immersiveFontSize === 'xl' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-gray-800'
                  }`}
                  title="较大字号"
                >
                  A+
                </button>
              </div>

              <div className="h-5 w-px bg-gray-300" />

              <SpeakButton
                text={generatedArticle}
                label="收听全文 (Emma)"
                className="px-4 py-2 bg-[#FF5722] text-white hover:bg-[#e64a19] shadow-sm text-[10px] font-black"
              />

              <button
                onClick={() => {
                  setIsImmersiveOpen(false);
                  setSelectedWord('');
                }}
                className="w-9 h-9 flex items-center justify-center bg-black/5 hover:bg-black/10 rounded-full transition-colors cursor-pointer text-gray-500 font-bold"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Reading body */}
          <div 
            className="flex-1 overflow-y-auto px-8 py-12 flex justify-center"
            style={{ scrollbarWidth: 'thin' }}
          >
            <div 
              className={`max-w-3xl w-full font-serif leading-loose select-text cursor-text ${
                immersiveFontSize === 'base' ? 'text-base' :
                immersiveFontSize === 'lg' ? 'text-lg md:text-xl' : 'text-xl md:text-2xl'
              }`}
              onMouseUp={() => {
                const sel = window.getSelection()?.toString().trim();
                // 仅当选择字数在 1-5 个单词之间时触发
                if (sel && sel.split(/\s+/).length <= 5) {
                  setSelectedWord(sel);
                }
              }}
            >
              {generatedArticle.split('\n\n').map((paragraph, index) => (
                <div key={index} className="group relative flex items-start gap-4 mb-8">
                  <div className="absolute -left-12 top-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                    <SpeakButton
                      text={paragraph}
                      className="w-8 h-8 bg-[#FF5722]/10 hover:bg-[#FF5722] text-[#FF5722] hover:text-white rounded-full shadow-sm cursor-pointer"
                      iconClassName="w-3.5 h-3.5"
                      title="朗读本段"
                    />
                  </div>
                  <p className="indent-8 leading-relaxed hover:opacity-100 transition-opacity flex-1">
                    {paragraph}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Floating Selection Tooltip */}
          {selectedWord && (
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-55 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl border animate-[fadeIn_0.2s_ease-out] ${
              immersiveTheme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <span className="text-xs font-black text-[#FF5722]">“{selectedWord}”</span>
              <button
                disabled={isAddingSelected}
                onClick={async () => {
                  setIsAddingSelected(true);
                  try {
                    await addWord({
                      word: selectedWord,
                      dictType: 'immersive-highlight',
                      category: 'business',
                      payload: { source: 'immersive_reading', theme }
                    });
                    showNotice('dashboard', `“${selectedWord}” 已成功加入生词本`, 'success');
                    window.dispatchEvent(new Event('vocab-updated'));
                    playSuccess();
                  } catch (e) {
                    playError();
                  } finally {
                    setIsAddingSelected(false);
                    setSelectedWord('');
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {isAddingSelected ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '加入词库'}
              </button>
              <button
                onClick={() => setSelectedWord('')}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold ml-1"
              >
                取消
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
