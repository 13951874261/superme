import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Target, AlertTriangle, CheckCircle2, Loader2, Zap, Volume2, BookOpen, RefreshCw, FileText, Trash2, Plus } from 'lucide-react';
import { useEnglishContext, getThemeOptions, StageTrack } from '../context/EnglishContext';
import StrategicRoadmap from './StrategicRoadmap';
import CustomThemeModal from './CustomThemeModal';
import MaterialUploader from '../../../MaterialUploader';
import Confetti from '../../../Confetti';
import { playSuccess, playError, playScan } from '../../../../utils/soundEffects';
import { checkThemeMastery, setThemeFocus } from '../../../../services/trainingAPI';
import { triggerEnglishMasteryExtraction, getDailyQuotaStatus } from '../../../../services/difyAPI';
import { addWord, getAllWords, batchAddWords, queryDictionaryWithCache, createConcurrencyLimiter, DictQueryParams } from '../../../../services/vocabAPI';
import SpeakButton, { speakEnglish } from '../../../SpeakButton';

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
    inlineNotice, noticeAnchor, setActiveTab, showNotice,
    customThemes, refreshCustomThemes,
    masteredThemes,
  } = useEnglishContext();

  const [isCustomThemeModalOpen, setIsCustomThemeModalOpen] = useState(false);
  const [isSopExpanded, setIsSopExpanded] = useState(false);
  const currentCustomTheme = customThemes?.find(c => (c.displayName || c.themeName) === theme);

  const [stayStats, setStayStats] = useState<{
    stayDays: number;
    articleCount: number;
    wordCount: number;
    phraseCount: number;
    weakPoints: { pronunciation: string; grammar: string };
    todaySuggestion: string;
  } | null>(null);

  const loadStayStats = async () => {
    if (!theme) return;
    try {
      const { getThemeStayStats } = await import('../../../../services/trainingAPI');
      const data = await getThemeStayStats(theme);
      setStayStats(data);
    } catch (err) {
      console.error('Failed to load theme stay stats:', err);
    }
  };

  useEffect(() => {
    loadStayStats();
    
    const handleUpdate = () => {
      loadStayStats();
    };
    window.addEventListener('vocab-updated', handleUpdate);
    return () => {
      window.removeEventListener('vocab-updated', handleUpdate);
    };
  }, [theme]);

  // 主题锁定机制 - 单一数据源
  // 与 EnglishContext.tsx 中 isMastered 判定保持一致：
  //   口语 >= 10 轮 && 写作最高分 >= 8 分 && emailCompleted
  const buildLockMessage = (
    currentTheme: string,
    m: { oralCount: number; maxWriteScore: number; emailCompleted: boolean }
  ) => {
    const oralOk = m.oralCount >= 10;
    const writeOk = m.maxWriteScore >= 8;
    const emailOk = !!m.emailCompleted;
    const mark = (ok: boolean) => (ok ? '✅ 已达标' : '⚠️ 未达标');
    return [
      `当前阵地【${currentTheme}】尚未被攻克！`,
      '',
      '通关三件套：',
      `• 沉浸式口语沙盘：${m.oralCount}/10 轮 ${mark(oralOk)}`,
      `• L3 书面最高分：${m.maxWriteScore}/8 分 ${mark(writeOk)}`,
      `• 邮件闭环：${emailOk ? '已完成' : '未完成'} ${mark(emailOk)}`,
      '',
      '三项全部达标后才可切换主题或阶段。',
    ].join('\n');
  };

  // 公共主题锁定校验：返回 true 表示放行，false 表示已被锁定（错误信息已写入）
  const runMasteryGate = async (): Promise<boolean> => {
    try {
      const m = await checkThemeMastery(theme);
      if (!m.isMastered) {
        setThemeSwitchError(buildLockMessage(theme, m));
        return false;
      }
      setThemeSwitchError(null);
      return true;
    } catch {
      setThemeSwitchError(
        '后端服务暂时不可访问，无法校验通关状态。\n请确认 super-agent-vocab.service 已启动（/api/theme/check-mastery）。'
      );
      return false;
    }
  };

  const handleTrackChange = async (newTrack: 'business' | 'all') => {
    // 核心修复：切回当前阶段时，不加限制并直接清理可能残留的弹窗
    if (newTrack === stage) {
      setThemeSwitchError(null);
      return;
    }

    // 堵住漏洞：切换阶段也会导致主题变更，必须执行强制拦截校验！
    const passed = await runMasteryGate();
    if (!passed) return;

    // 校验通过，放行阶段切换
    setStage(newTrack);
    const options = getThemeOptions(newTrack);
    if (!options.find(o => o.value === theme)) {
      setTheme(options[0].value);
      await setThemeFocus({ theme: options[0].value }).catch(() => {});
    }
  };

  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [isClearingAndReGenerating, setIsClearingAndReGenerating] = useState(false);
  const [isDeletingTheme, setIsDeletingTheme] = useState(false);
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
  const [extractedSentences, setExtractedSentences] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('super_agent_last_generated_sentences') || '[]');
    } catch {
      return [];
    }
  });

  const [intelSource, setIntelSource] = useState<string>(() => {
    return localStorage.getItem('super_agent_intel_source') || '每日系统生成';
  });

  const [isArticleExpanded, setIsArticleExpanded] = useState(false);

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

  useEffect(() => {
    const handleIntelRefresh = () => {
      setGeneratedArticle(localStorage.getItem('super_agent_last_generated_article') || '');
      setExtractedWords(JSON.parse(localStorage.getItem('super_agent_last_generated_words') || '[]'));
      setExtractedPhrases(JSON.parse(localStorage.getItem('super_agent_last_generated_phrases') || '[]'));
      setExtractedSentences(JSON.parse(localStorage.getItem('super_agent_last_generated_sentences') || '[]'));
      setIntelSource(localStorage.getItem('super_agent_intel_source') || '每日系统生成');
    };

    window.addEventListener('intel-data-refreshed', handleIntelRefresh);
    return () => window.removeEventListener('intel-data-refreshed', handleIntelRefresh);
  }, []);

  const currentVoiceName = (() => {
    if (typeof selectedVoice !== 'string') return 'Libby';
    const match = selectedVoice.match(/en-[A-Z]{2}-([A-Za-z0-9]+)Neural/);
    return match ? match[1] : 'Libby';
  })();

  // 缓存今日提纯词汇的音标和释义详情
  const [vocabDetailsMap, setVocabDetailsMap] = useState<Record<string, any>>({});
  const [asyncMeanings, setAsyncMeanings] = useState<Record<string, { meaning: string; phonetic?: string }>>({});

  /** 使用 ref 跟踪 pending 翻译请求（同步更新，避免 React 批处理导致的重复请求） */
  const pendingTranslationsRef = useRef<Set<string>>(new Set());

  // 过滤明显的占位词和无效文本
  const getDisplayMeaning = (text?: string) => {
    const val = (text || '').trim();
    if (!val) return '';
    if (val.includes('目标词的中文简明翻译')) return '';
    if (val.includes('中文释义加载中')) return '';
    return val;
  };

  // 自动调用英汉双向译制翻译接口补齐释义
  const fetchBilingualTranslation = async (text: string) => {
    const keyStr = text.toLowerCase().trim();
    if (!keyStr || pendingTranslationsRef.current.has(keyStr) || asyncMeanings[keyStr]) return;

    pendingTranslationsRef.current.add(keyStr);

    try {
      const res = await queryDictionaryWithCache({
        word: text,
        dictType: 'en_zh_bidirectional', // 复用英汉双向译制类型
      });

      if (res.ok && res.payload) {
        const payload = res.payload as any;
        const mainTrans = payload.translation_main || payload.meaning_zh || payload.meaning || '';
        const phone = payload.phonetic || '';

        if (mainTrans) {
          setAsyncMeanings(prev => ({
            ...prev,
            [keyStr]: { meaning: mainTrans, phonetic: phone }
          }));

          // 静默落库到本地 SQLite 词库中，以便持久化
          await addWord({
            word: text,
            dictType: 'en_zh_bidirectional',
            category: 'business',
            payload: {
              meaning: mainTrans,
              phonetic: phone,
              translation_main: mainTrans
            }
          }).catch(() => {});
        }
      }
    } catch (err) {
      // 自动翻译异常静默降级，不污染控制台
    } finally {
      pendingTranslationsRef.current.delete(keyStr);
    }
  };

  const loadVocabDetails = async () => {
    try {
      const allWords = await getAllWords();
      const detailsMap: Record<string, any> = {};

      const extractedKeys = new Set([
        ...extractedWords.map(w => w.toLowerCase().trim()),
        ...extractedPhrases.map(p => p.toLowerCase().trim()),
        ...extractedSentences.map(s => s.toLowerCase().trim())
      ]);

      allWords.forEach((item) => {
        if (item.word) {
          const key = item.word.toLowerCase().trim();
          if (extractedKeys.has(key)) {
            let payload = item.payload;
            if (typeof payload === 'string') {
              try {
                payload = JSON.parse(payload);
              } catch {
                payload = {};
              }
            }
            detailsMap[key] = {
              phonetic: payload?.phonetic || '',
              meaning: payload?.meaning || '',
              definition_en: payload?.definition_en || '',
              business_note: payload?.business_note || '',
            };
          }
        }
      });
      setVocabDetailsMap(detailsMap);
    } catch (err) {
      console.error('Failed to load vocab details:', err);
    }
  };

  // 1. 批量翻译与批量落库 useEffect (优化初始页面加载 N+1 请求过载)
  useEffect(() => {
    let active = true;
    const queryLimiter = createConcurrencyLimiter(3);

    const translateAndBatchSave = async () => {
      // 收集待翻译的生词、短语、句型
      const allTextItems = [
        ...extractedWords.map(w => w.trim()),
        ...extractedPhrases.map(p => p.trim()),
        ...extractedSentences.map(s => s.trim())
      ].filter(Boolean);

      const uniqueWords = [...new Set(allTextItems)];

      // 过滤出未翻译的词汇
      const toTranslate = uniqueWords.filter(word => {
        const key = word.toLowerCase().trim();
        return !vocabDetailsMap[key] && !asyncMeanings[key] && !pendingTranslationsRef.current.has(key);
      });

      if (toTranslate.length === 0) return;

      const batchWordsToSave: Array<{
        word: string;
        category?: 'business' | 'general';
        dictType: string;
        payload: any;
      }> = [];

      let completedCount = 0;
      const totalToTranslate = toTranslate.length;

      toTranslate.forEach((word) => {
        const key = word.toLowerCase().trim();
        pendingTranslationsRef.current.add(key);

        queryLimiter(async () => {
          try {
            const res = await queryDictionaryWithCache({
              word,
              dictType: 'en_zh_bidirectional',
            });
            if (!active) return;
            if (res.ok && res.payload) {
              const payload = res.payload as any;
              const mainTrans = payload.translation_main || payload.meaning_zh || payload.meaning || '';
              const phone = payload.phonetic || '';
              if (mainTrans) {
                // 更新前端缓存
                setAsyncMeanings(prev => ({
                  ...prev,
                  [key]: { meaning: mainTrans, phonetic: phone }
                }));

                // 区分生词、短语还是句型
                let dictType = 'en_zh_bidirectional';
                if (extractedPhrases.includes(word)) {
                  dictType = 'ai_phrase';
                } else if (extractedSentences.includes(word)) {
                  dictType = 'ai_sentence';
                } else if (extractedWords.includes(word)) {
                  dictType = 'ai_extracted';
                }

                batchWordsToSave.push({
                  word,
                  dictType,
                  category: 'business',
                  payload: {
                    meaning: mainTrans,
                    phonetic: phone,
                    translation_main: mainTrans,
                    source: 'auto_translation_batch',
                    topic: theme
                  }
                });
              }
            }
          } catch (err) {
            console.warn(`Failed to translate "${word}":`, err);
          } finally {
            pendingTranslationsRef.current.delete(key);
            completedCount++;

            // 所有异步请求处理完后触发批量落库
            if (completedCount === totalToTranslate && batchWordsToSave.length > 0 && active) {
              try {
                console.log(`[DashboardTab] Batch saving ${batchWordsToSave.length} words to SQLite...`);
                await batchAddWords(batchWordsToSave);
                window.dispatchEvent(new Event('vocab-updated'));
              } catch (batchErr) {
                console.error('Failed to batch save translated words:', batchErr);
              }
            }
          }
        });
      });
    };

    translateAndBatchSave();

    return () => {
      active = false;
    };
  }, [extractedWords, extractedPhrases, extractedSentences, vocabDetailsMap]);

  // 2. 加载词汇详情与监听 vocab-updated 事件的 useEffect
  useEffect(() => {
    if (extractedWords.length > 0) {
      loadVocabDetails();
    }
    const handleUpdate = () => {
      loadVocabDetails();
    };
    window.addEventListener('vocab-updated', handleUpdate);
    return () => window.removeEventListener('vocab-updated', handleUpdate);
  }, [extractedWords, extractedPhrases, extractedSentences]);

  // 一键将提纯出来的生词或短语手动加入生词本
  const handleAddWordToVocab = async (text: string, isPhrase: boolean = false) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    const cleanKey = cleanText.toLowerCase().trim();

    // 已收录则跳过
    if (vocabDetailsMap[cleanKey]) {
      showNotice('dashboard', `“${cleanText}” 已在生词本中`, 'info');
      return;
    }

    try {
      let meaning = asyncMeanings[cleanKey]?.meaning || '';
      let phonetic = asyncMeanings[cleanKey]?.phonetic || '';

      // 若释义未在缓存中，则尝试调用英汉双向译制接口快速补齐（使用缓存版本避免重复请求）
      if (!meaning) {
        try {
          const res = await queryDictionaryWithCache({
            word: cleanText,
            dictType: 'en_zh_bidirectional',
          });
          if (res.ok && res.payload) {
            const payload = res.payload as any;
            meaning = payload.translation_main || payload.meaning_zh || payload.meaning || '';
            phonetic = payload.phonetic || phonetic;
          }
        } catch {
          // 即使补齐失败，也允许继续添加
        }
      }

      await addWord({
        word: cleanText,
        dictType: isPhrase ? 'ai_phrase' : 'ai_extracted',
        category: 'business',
        payload: {
          meaning: meaning || '',
          phonetic: phonetic || '',
          translation_main: meaning || '',
          source: 'Material Upload',
          topic: theme,
        },
      });

      showNotice('dashboard', `“${cleanText}” 已成功加入生词本`, 'success');
      playSuccess();
      window.dispatchEvent(new Event('vocab-updated'));
      loadVocabDetails();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      showNotice('dashboard', `收录失败: ${msg}`, 'error');
      playError();
    }
  };

  // 加载每日配额状态（延迟执行，避免初始请求过载）
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
    const timer = setTimeout(() => {
      loadQuotaStatus();
    }, 1500);
    return () => clearTimeout(timer);
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
        setIsArticleExpanded(false);
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
      if (result.sentences) {
        setExtractedSentences(result.sentences);
        localStorage.setItem('super_agent_last_generated_sentences', JSON.stringify(result.sentences));
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
      setExtractedSentences([]);
      setIsArticleExpanded(false);
      localStorage.removeItem('super_agent_last_generated_article');
      localStorage.removeItem('super_agent_last_generated_words');
      localStorage.removeItem('super_agent_last_generated_phrases');
      localStorage.removeItem('super_agent_last_generated_sentences');
      
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
    <>
      <div className="space-y-8 animate-[fadeIn_0.3s_ease-out] relative">
      {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
      
      {/* 战术使用指南 SOP */}
      <div className="bg-indigo-50/30 border-l-4 border-indigo-500 rounded-r-2xl p-4 flex flex-col gap-3 shrink-0 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setIsSopExpanded(!isSopExpanded)}>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-md">
               <Target className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h5 className="text-[11px] font-black uppercase tracking-widest text-indigo-900 leading-tight">战术使用指南 // Tactical SOP</h5>
              <p className="text-[10px] text-indigo-800/80 font-medium mt-0.5">点击展开/收起模块使用说明</p>
            </div>
          </div>
          <button className="text-indigo-500 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors text-xs font-bold">
            {isSopExpanded ? '收起指南 ∧' : '展开指南 ∨'}
          </button>
        </div>

        {isSopExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-indigo-100/50 text-left animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10">
              <span className="text-amber-500 mt-0.5">💡</span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">操作说明：</span>在战局总览选择战略阶段，在弹药库一键“生成长文并提纯”获取语料弹药。</p>
            </div>
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10">
              <span className="text-amber-500 mt-0.5">💡</span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">功能亮点：</span>硬核“通关锁”机制——口语不练满 10 轮、邮件拿不到 8 分，阵地将被强制死锁。</p>
            </div>
            <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10">
              <span className="text-amber-500 mt-0.5">💡</span>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">生态定位：</span>它设定的 Theme 将统治全局场景；抽取的弹药将直接输送至 Vocab 矩阵。</p>
            </div>
          </div>
        )}
      </div>

      {/* 核心中枢：战局大纲与当前闭环主题控制 */}
      <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-100 shadow-[0_6px_20px_rgba(0,0,0,0.015)] flex flex-col gap-5 animate-[fadeIn_0.3s_ease-out]">
        <StrategicRoadmap
          stage={stage}
          handleTrackChange={handleTrackChange}
          masteredThemes={masteredThemes}
          customThemesCount={customThemes?.length || 0}
          currentTheme={theme}
        />

        {/* 当前闭环主题 */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-3">当前闭环主题 <span className="text-slate-300">//</span> Theme Gateway</span>

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

                  // 拦截逻辑收敛至 runMasteryGate()
                  const passed = await runMasteryGate();
                  if (!passed) {
                    target.value = theme;
                    return;
                  }

                  setTheme(next);
                  await setThemeFocus({ theme: next }).catch(() => {});
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setThemeSwitchError(null);
                }}
                className="flex-1 bg-[#f8f9fa] border border-gray-200 text-[#202124] text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-[#FF5722]"
              >
                <optgroup label="系统预置主题">
                  {getThemeOptions(stage as 'business' | 'all').map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
                {customThemes && customThemes.length > 0 && (
                  <optgroup label="自定义场景主题">
                    {customThemes.map((c) => (
                      <option key={c.id} value={c.displayName || c.themeName}>
                        {c.displayName || c.themeName}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {currentCustomTheme && (
                <button
                  disabled={isDeletingTheme}
                  onClick={async () => {
                    if (!confirm(`确认删除自定义主题【${theme}】吗？这将同步删除在 Dify 知识库关联的文档。`)) return;
                    setIsDeletingTheme(true);
                    try {
                       const { deleteCustomTheme } = await import('../../../../services/trainingAPI');
                       const res = await deleteCustomTheme(currentCustomTheme.id);
                       if (res.success) {
                         showNotice('dashboard', '成功删除自定义场景', 'success');
                         const options = getThemeOptions(stage as 'business' | 'all');
                         setTheme(options[0].value);
                         await refreshCustomThemes();
                       }
                    } catch (e: any) {
                       showNotice('dashboard', `删除失败: ${e.message}`, 'error');
                    } finally {
                       setIsDeletingTheme(false);
                    }
                  }}
                  className="bg-red-50 hover:bg-red-100 text-red-600 p-3 rounded-xl border border-red-200 transition-all cursor-pointer disabled:opacity-50"
                  title="删除当前自定义场景"
                >
                  {isDeletingTheme ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                </button>
              )}

              <button
                onClick={() => {
                  console.log('[DashboardTab] Opening CustomThemeModal');
                  setIsCustomThemeModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-3 rounded-xl border border-indigo-200 transition-all font-bold text-xs uppercase tracking-wider cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> 自定义
              </button>
              <div
                className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all whitespace-nowrap border ${
                  masteryData?.isMastered
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border-red-200 text-red-600'
                }`}
              >
                {masteryData?.isMastered ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                <span className="text-xs font-black uppercase tracking-widest">
                  {masteryData?.isMastered ? '已通关 (解锁下沉)' : '未达标 (强制锁定)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 状态与停留分析区 */}
        <div className="border-t border-gray-100 pt-5">
          {!masteryData?.isMastered && (
            <div className="text-[10px] text-gray-500 font-medium mb-3">
              当前通关进度：口语对抗 {masteryData?.oralCount || 0}/10 轮 | L3 书面最高分 {masteryData?.maxWriteScore || 0}/8 分 | 即兴演讲 {impromptuPassed ? '✅已达标' : '⚠️未达标'}
            </div>
          )}

          {stayStats && (
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 transition-all hover:shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-3 mb-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📊</span>
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    闭环停留分析 <span className="text-slate-400">// Stay Analysis</span>
                  </h5>
                </div>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  {stayStats.stayDays > 1 ? `已停留 ${stayStats.stayDays} 天` : '第 1 天'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-600">
                <div className="bg-white/80 border border-slate-100 rounded-xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">📅 停留期内练习</p>
                  <p className="text-slate-700 font-black">
                    已生成 <span className="text-indigo-600">{stayStats.articleCount}</span> 篇长文
                  </p>
                </div>
                <div className="bg-white/80 border border-slate-100 rounded-xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">📚 累积摄入词汇</p>
                  <p className="text-slate-700 font-black">
                    已学 <span className="text-indigo-600">{stayStats.wordCount}</span> 生词 / <span className="text-indigo-600">{stayStats.phraseCount}</span> 短语
                  </p>
                </div>
                <div className="bg-white/80 border border-slate-100 rounded-xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">⚠️ 薄弱点追踪</p>
                  <div className="space-y-0.5 text-[11px] font-medium leading-relaxed">
                    <p className="truncate"><span className="font-bold text-red-500">发音:</span> {stayStats.weakPoints.pronunciation}</p>
                    <p className="truncate"><span className="font-bold text-[#FF5722]">语法:</span> {stayStats.weakPoints.grammar}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 bg-amber-50/50 border border-amber-100/60 rounded-xl p-3.5 flex items-start gap-2.5">
                <span className="text-amber-500 shrink-0 text-sm">💡</span>
                <div className="text-[11px] leading-relaxed text-amber-800 font-medium">
                  <p className="font-bold mb-0.5">今日练习方向建议：</p>
                  <p className="opacity-90">{stayStats.todaySuggestion}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative animate-[fadeIn_0.3s_ease-out]">
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
        <div className="bg-white rounded-3xl border border-slate-100 p-5 md:p-6 shadow-[0_6px_20px_rgba(0,0,0,0.015)] mb-6 space-y-5">
          {/* 新设计的 UI 状态指示条 */}
          <div className="intel-source-banner" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            backgroundColor: '#1a202c',
            borderLeft: '4px solid #3182ce',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <div>
              <span style={{ color: '#718096', marginRight: '8px', fontSize: '12px', fontWeight: 'bold' }}>📂 当前情报源:</span>
              <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: '900', letterSpacing: '0.05em' }}>{intelSource}</span>
            </div>
            {intelSource !== '每日系统生成' && (
              <button 
                onClick={async () => {
                  localStorage.setItem('super_agent_intel_source', '每日系统生成');
                  setIntelSource('每日系统生成');
                  await handleAutoGenerate();
                }}
                disabled={isAutoGenerating}
                style={{ color: '#63b3ed', background: 'none', border: 'none', cursor: isAutoGenerating ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: isAutoGenerating ? 0.5 : 1 }}
              >
                [ 还原每日生成 ]
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest text-[#FF5722] mb-1 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                今日情报截获 // Immersive Intel Briefing
              </h4>
              <p className="text-xs text-gray-400 font-medium">
                基于主阵地主题【{theme}】生成的高阶商业实战材料，支持 {currentVoiceName} 语音收听与沉浸式阅读。
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
                            setExtractedSentences([]);
                            setIsArticleExpanded(false);
                            localStorage.removeItem('super_agent_last_generated_article');
                            localStorage.removeItem('super_agent_last_generated_words');
                            localStorage.removeItem('super_agent_last_generated_phrases');
                            localStorage.removeItem('super_agent_last_generated_sentences');
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
                  label={`收听全文 (${currentVoiceName})`} 
                  className="px-5 py-3 bg-[#202124] text-white hover:bg-[#FF5722] shadow-md font-black rounded-xl" 
                />
              </div>
            )}
          </div>

          {generatedArticle ? (
            <>
              <div className="relative">
                <div
                  className={`text-sm text-gray-800 leading-relaxed font-serif p-6 bg-[#f8f9fa]/60 rounded-2xl border border-gray-100 whitespace-pre-line select-text shadow-sm transition-all duration-300 ${
                    isArticleExpanded ? '' : 'line-clamp-6'
                  }`}
                >
                  {generatedArticle}
                </div>

                {generatedArticle.length > 300 && (
                  <button
                    type="button"
                    onClick={() => setIsArticleExpanded(prev => !prev)}
                    className="mt-3 inline-flex items-center px-4 py-2 rounded-full bg-orange-50 text-[#FF5722] text-xs font-black hover:bg-orange-100 transition-colors"
                  >
                    {isArticleExpanded ? '收起长文' : '展开全文'}
                  </button>
                )}
              </div>

              {(extractedWords.length > 0 || extractedPhrases.length > 0 || extractedSentences.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                  {extractedWords.length > 0 && (
                    <div className="flex flex-col max-h-[700px]">
                      <h5 className="text-[11px] font-black uppercase tracking-widest text-[#202124] flex items-center gap-1.5 shrink-0">
                        <span className="w-1.5 h-3 bg-indigo-550 rounded-full"></span>
                        成功提纯商战生词 ({extractedWords.length})
                      </h5>
                      <div className="flex-1 overflow-y-auto pr-2 mt-4" style={{ scrollbarWidth: 'thin' }}>
                        <div className="grid grid-cols-1 sm:grid-cols-1 gap-3.5">
                          {extractedWords.map((word) => {
                            const details = vocabDetailsMap[word.toLowerCase().trim()];
                            const phonetic = details?.phonetic || '';

                            // 过滤无意义模板占位释义
                            let rawMeaning = getDisplayMeaning(details?.meaning);
                            const cleanKey = word.toLowerCase().trim();

                            if (!rawMeaning) {
                              if (asyncMeanings[cleanKey]?.meaning) {
                                rawMeaning = asyncMeanings[cleanKey].meaning;
                              } else {
                                // 自动补齐释义
                                fetchBilingualTranslation(word);
                                rawMeaning = '释义查询中...';
                              }
                            }

                            const finalPhonetic = phonetic || asyncMeanings[cleanKey]?.phonetic || '';
                            const isStored = !!vocabDetailsMap[cleanKey];

                            return (
                              <div
                                key={word}
                                className="group relative flex flex-col justify-between p-4 bg-slate-50/50 hover:bg-white border border-slate-100 hover:border-indigo-150 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md transition-all duration-300 min-h-[96px] text-left overflow-hidden"
                              >
                                {/* Top Row: Word & Pronunciation/Save Button */}
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
                                        className="text-[9px] font-bold text-indigo-650 bg-indigo-50/80 hover:bg-indigo-600 hover:text-white px-2 py-0.5 rounded-lg border border-indigo-100 transition-all cursor-pointer shrink-0"
                                        title="收录入生词本"
                                      >
                                        + 收录
                                      </button>
                                    )}
                                    <SpeakButton
                                      text={word}
                                      iconClassName="w-3.5 h-3.5"
                                      className="w-7 h-7 bg-indigo-50/50 text-indigo-500 hover:bg-indigo-650 hover:text-white border-none shrink-0"
                                    />
                                  </div>
                                </div>

                                {/* Bottom Row: Hover Translation */}
                                <div className="mt-3 pt-2.5 border-t border-dashed border-slate-100/80">
                                  <div className="relative h-4 overflow-hidden">
                                    <span className="absolute inset-0 text-[10px] text-slate-350 font-black tracking-widest transition-all duration-300 group-hover:opacity-0 group-hover:translate-y-[-10px] uppercase">
                                      Hover to reveal
                                    </span>
                                    <span className="absolute inset-0 text-[11px] text-indigo-600 font-bold tracking-wide transition-all duration-300 opacity-0 translate-y-[10px] group-hover:opacity-100 group-hover:translate-y-0 truncate">
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
                    <div className="flex flex-col max-h-[700px]">
                      <h5 className="text-[11px] font-black uppercase tracking-widest text-[#202124] flex items-center gap-1.5 shrink-0">
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
                                {/* Left Border Highlight Line */}
                                <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#FFC107] rounded-r-lg group-hover:bg-[#FFC107]/80 transition-colors"></div>

                                {/* Phrase Content */}
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
                                        className="text-[9px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-600 hover:text-white px-2 py-0.5 rounded-lg border border-amber-100 transition-all cursor-pointer shrink-0"
                                        title="收录入生词本"
                                      >
                                        + 收录
                                      </button>
                                    )}
                                    {/* Speak Button */}
                                    <SpeakButton
                                      text={phrase}
                                      iconClassName="w-3.5 h-3.5"
                                      className="w-8 h-8 bg-amber-50/50 text-amber-600 hover:bg-amber-600 hover:text-white border-none shrink-0"
                                    />
                                  </div>
                                </div>

                                {/* Chinese Translation Display */}
                                {rawMeaning && (
                                  <div className="mt-2.5 pt-2 border-t border-dashed border-slate-100/80">
                                    <p className="text-xs text-indigo-600 font-bold tracking-wide">
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
                    <div className="flex flex-col max-h-[700px]">
                      <h5 className="text-[11px] font-black uppercase tracking-widest text-[#202124] flex items-center gap-1.5 shrink-0">
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
                                {/* Gold Left Border Highlight Line */}
                                <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-emerald-500 rounded-r-lg group-hover:bg-emerald-500/80 transition-colors"></div>

                                {/* Phrase Content */}
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 select-text">
                                    <p className="text-xs text-slate-705 font-serif leading-relaxed italic">
                                      "{phrase}"
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-2">
                                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                                        提纯金句 · 支持点读
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

                                {/* Sentence Translation Display */}
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

        <MaterialUploader 
          topicHint={theme} 
          onExtractionSuccess={(data) => {
            if (data) {
              setGeneratedArticle(data.article);
              localStorage.setItem('super_agent_last_generated_article', data.article);

              setExtractedWords(data.words);
              localStorage.setItem('super_agent_last_generated_words', JSON.stringify(data.words));

              setExtractedPhrases(data.phrases);
              localStorage.setItem('super_agent_last_generated_phrases', JSON.stringify(data.phrases));

              const sentences = (data as any).sentences || [];
              setExtractedSentences(sentences);
              localStorage.setItem('super_agent_last_generated_sentences', JSON.stringify(sentences));

              showNotice('dashboard', '提纯成功！材料与提纯词汇已下发至上方情报截获板块，可点击查看。', 'success');
              playSuccess();
              
              // 滚动到该板块区域以引起用户注意
              window.scrollTo({ top: 300, behavior: 'smooth' });
            } else {
              setActiveTab('vocab');
            }
          }} 
        />
      </div>

      {/* 沉浸式阅读空间 Fullscreen Modal */}
      {isImmersiveOpen && generatedArticle && createPortal(
        <div className={`fixed inset-0 z-[9999] flex flex-col transition-all duration-300 ${
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
                label={`收听全文 (${currentVoiceName})`}
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
        </div>,
        document.body
      )}

      {/* 自定义主题弹窗 - 必须在动画容器和条件渲染外部 */}
      <CustomThemeModal
        isOpen={isCustomThemeModalOpen}
        onClose={() => setIsCustomThemeModalOpen(false)}
        onSuccess={async (newThemeName) => {
          await refreshCustomThemes();
          setTheme(newThemeName);
          await setThemeFocus({ theme: newThemeName }).catch(() => {});
        }}
      />
    </>
  );
}
