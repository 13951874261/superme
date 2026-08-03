import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Target, AlertTriangle, CheckCircle2, Loader2, Zap, Volume2, BookOpen, RefreshCw, FileText, Trash2, Plus, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import { useEnglishContext, getThemeOptions, StageTrack } from '../context/EnglishContext';
import StrategicRoadmap from './StrategicRoadmap';
import CustomThemeModal from './CustomThemeModal';
import { ThemeGateway } from './dashboard/ThemeGateway';
import { ArsenalPanel, GenreType } from './dashboard/ArsenalPanel';
import { IntelBriefing } from './dashboard/IntelBriefing';
import { DailyBriefingCard } from './dashboard/DailyBriefingCard';
import { ImmersiveReader } from './dashboard/ImmersiveReader';
import { SOPGuide } from './dashboard/SOPGuide';
import { StayAnalysisPanel } from './dashboard/StayAnalysisPanel';
import MaterialUploader from '../../../MaterialUploader';
import Confetti from '../../../Confetti';
import { playSuccess, playError, playScan } from '../../../../utils/soundEffects';
import { checkThemeMastery, setThemeFocus } from '../../../../services/trainingAPI';
import { triggerEnglishMasteryExtraction, getDailyQuotaStatus } from '../../../../services/difyAPI';
import { getAppUserId } from '../../../../utils/profileHelper';
import { addWord, getAllWords, batchAddWords, queryDictionaryWithCache, createConcurrencyLimiter, DictQueryParams } from '../../../../services/vocabAPI';
import SpeakButton, { speakEnglish } from '../../../SpeakButton';

import { VOICE_OPTIONS } from '../../../../config/voices';


const safeToStr = (item: any) => (typeof item === 'string' ? item : (item?.word || item?.phrase || item?.text || String(item || ''))).trim();

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
    stayStats,
  } = useEnglishContext();

  const [isCustomThemeModalOpen, setIsCustomThemeModalOpen] = useState(false);
  const [isSopExpanded, setIsSopExpanded] = useState(false);
  const currentCustomTheme = customThemes?.find(c => (c.displayName || c.themeName) === theme);

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
    const mark = (ok: boolean) => ok ? (
      <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-4 h-4" />已达标</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-amber-500"><AlertCircle className="w-4 h-4" />未达标</span>
    );
    
    return (
      <div className="space-y-3">
        <p className="font-bold text-slate-800 text-sm">当前阵地【{currentTheme}】尚未被攻克！</p>
        <div className="space-y-2 text-sm text-slate-600">
          <p className="font-semibold">通关三件套：</p>
          <div className="flex items-center gap-2">• 沉浸式口语沙盘：{m.oralCount}/10 轮 {mark(oralOk)}</div>
          <div className="flex items-center gap-2">• L3 书面最高分：{m.maxWriteScore}/8 分 {mark(writeOk)}</div>
          <div className="flex items-center gap-2">• 邮件闭环：{emailOk ? '已完成' : '未完成'} {mark(emailOk)}</div>
        </div>
        <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">三项全部达标后才可切换主题或阶段。</p>
      </div>
    );
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
    // 政商务 / 全场景轨道可自由切换，不做通关锁定；主题切换仍走 runMasteryGate
    if (newTrack === stage) {
      setThemeSwitchError(null);
      return;
    }

    setThemeSwitchError(null);
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

  // 题材、难度等级与时长控制
  const [cefrLevel, setCefrLevel] = useState<'A2' | 'B1' | 'B2' | 'C1'>('B1');
  const [genre, setGenre] = useState<GenreType>('meeting');
  const [duration, setDuration] = useState<'1' | '15' | '25' | '35'>('1');

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

  // 监听 intel-data-refreshed 事件，触发情报面板即时更新
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

  const refreshIntelData = useCallback(() => {
    setGeneratedArticle(localStorage.getItem('super_agent_last_generated_article') || '');
    setExtractedWords(JSON.parse(localStorage.getItem('super_agent_last_generated_words') || '[]'));
    setExtractedPhrases(JSON.parse(localStorage.getItem('super_agent_last_generated_phrases') || '[]'));
    setExtractedSentences(JSON.parse(localStorage.getItem('super_agent_last_generated_sentences') || '[]'));
    setIntelSource(localStorage.getItem('super_agent_intel_source') || '每日系统生成');
  }, []);

  // 监听 extraction-success 事件，触发提纯完成后的即时 UI 更新（toast + 音效）
  useEffect(() => {
    const handleExtractionSuccess = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.article) {
        setGeneratedArticle(detail.article);
      }
      if (detail?.words) {
        setExtractedWords(detail.words);
      }
      if (detail?.phrases) {
        setExtractedPhrases(detail.phrases);
      }
      if (detail?.sentences) {
        setExtractedSentences(detail.sentences);
      }
      // 触发批量翻译和落库
      refreshIntelData();
    };

    window.addEventListener('extraction-success', handleExtractionSuccess);
    return () => window.removeEventListener('extraction-success', handleExtractionSuccess);
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
    } finally {
      pendingTranslationsRef.current.delete(keyStr);
    }
  };

  const loadVocabDetails = async () => {
    try {
      const allWords = await getAllWords();
      const detailsMap: Record<string, any> = {};

      const extractedKeys = new Set([
        ...extractedWords.map(w => safeToStr(w).toLowerCase()).filter(Boolean),
        ...extractedPhrases.map(p => safeToStr(p).toLowerCase()).filter(Boolean),
        ...extractedSentences.map(s => safeToStr(s).toLowerCase()).filter(Boolean)
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
        ...extractedWords.map(w => safeToStr(w)),
        ...extractedPhrases.map(p => safeToStr(p)),
        ...extractedSentences.map(s => safeToStr(s))
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

  // 3. 自动拉取后端 SQLite 当日长文缓存（仅读缓存，未命中不自动 Dify）
  const lastAutoGeneratedKeyRef = useRef<string>('');

  useEffect(() => {
    let active = true;
    const fetchPersistedArticle = async () => {
      try {
        const { getDailyExtractedArticle } = await import('../../../../services/difyAPI');
        const durationStr = String(duration || '1');
        const res = await getDailyExtractedArticle(getAppUserId(), genre, cefrLevel, durationStr, theme);
        if (!active) return;

        if (res.found && res.data?.article) {
          setGeneratedArticle(res.data.article);
          setExtractedWords(res.data.words || []);
          setExtractedPhrases(res.data.phrases || []);
          setExtractedSentences(res.data.sentences || []);
          setIsArticleExpanded(false);
          setIntelSource('每日系统生成');

          localStorage.setItem('super_agent_intel_source', '每日系统生成');
          localStorage.setItem('super_agent_last_generated_article', res.data.article);
          localStorage.setItem('super_agent_last_generated_words', JSON.stringify(res.data.words || []));
          localStorage.setItem('super_agent_last_generated_phrases', JSON.stringify(res.data.phrases || []));
          localStorage.setItem('super_agent_last_generated_sentences', JSON.stringify(res.data.sentences || []));
        } else {
          setGeneratedArticle('');
          setExtractedWords([]);
          setExtractedPhrases([]);
          setExtractedSentences([]);
          setIntelSource('每日系统生成');
          showNotice('dashboard', '暂无该条件长文缓存，请点击「查询/生成今日长文」手动生成', 'info');
        }
      } catch (e) {
        if (active) {
          showNotice('dashboard', '读取长文缓存失败，请稍后重试或手动生成', 'error');
        }
      }
    };

    fetchPersistedArticle();

    return () => {
      active = false;
    };
  }, [genre, cefrLevel, duration, theme, intelSource]);


  const handleAutoGenerate = async () => {
    setIsAutoGenerating(true);
    playScan();
    showNotice('dashboard', '正在查询缓存 / 准备生成...', 'info');
    try {
      const { fetchExactArticleIfExists, runListenMaterialGenerator, triggerEnglishMasteryExtraction } = await import('../../../../services/difyAPI');

      // 1. 先查：优先校验数据库中是否存在匹配当前多维度组合的已生成长文
      const exactRes = await fetchExactArticleIfExists({
        userId: getAppUserId(),
        genre,
        cefrLevel,
        duration,
        topic: theme
      });

      if (exactRes.found && exactRes.data) {
        showNotice('dashboard', '已成功命中库中精准生成的长文与提纯词汇（零消耗重用）', 'success');
        setGeneratedArticle(exactRes.data.article);
        setIsArticleExpanded(false);
        setExtractedWords(exactRes.data.words || []);
        setExtractedPhrases(exactRes.data.phrases || []);
        setExtractedSentences(exactRes.data.sentences || []);
        localStorage.setItem('super_agent_last_generated_article', exactRes.data.article);
        localStorage.setItem('super_agent_last_generated_words', JSON.stringify(exactRes.data.words || []));
        localStorage.setItem('super_agent_last_generated_phrases', JSON.stringify(exactRes.data.phrases || []));
        localStorage.setItem('super_agent_last_generated_sentences', JSON.stringify(exactRes.data.sentences || []));
        playSuccess();
        setIsAutoGenerating(false);
        return;
      }

      // 未命中：用户主动点击后才生成
      showNotice('dashboard', '缓存未命中，开始手动生成...', 'info');

      let script = '';

      // 尝试生成一段引导语料（若工作流可用），否则跳过
      try {
        const listenGenre = genre === 'reading' ? 'meeting' : genre;
        script = await runListenMaterialGenerator(theme, listenGenre, cefrLevel, 'short', getAppUserId());
      } catch {
        script = '';
      }

      const result = await triggerEnglishMasteryExtraction(theme, script, getAppUserId(), cefrLevel, genre, duration);

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
      <div className="space-y-3 animate-[fadeIn_0.3s_ease-out] relative">
      {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
      
      {/* 战术使用指南 SOP — 默认收起的细条 */}
      <div className="card-sop px-3 py-2 flex flex-col gap-2 shrink-0 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setIsSopExpanded(!isSopExpanded)}>
          <div className="flex items-center gap-2">
            <div className="bg-[var(--color-brand)] text-white p-1 rounded-md shadow-sm">
               <Target className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <h5 className="eyebrow text-[var(--color-brand)]/80">战术使用指南 // Tactical SOP</h5>
              <p className="text-[10px] text-[var(--color-ink-secondary)] font-medium">点击展开/收起模块使用说明</p>
            </div>
          </div>
          <button className="flex items-center gap-1 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 px-2 py-0.5 rounded-md transition-colors text-xs font-bold">
            {isSopExpanded ? '收起指南' : '展开指南'}
            {isSopExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <SOPGuide isSopExpanded={isSopExpanded} />
      </div>

      {/* 均分布局：上/中两行对开等高，弹药库通栏 */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-stretch">
          <div className="lg:col-span-7 bg-white rounded-xl p-2.5 border border-slate-100 shadow-[0_4px_14px_rgba(0,0,0,0.012)] flex flex-col h-full min-h-[11rem]">
            <StrategicRoadmap
              stage={stage}
              handleTrackChange={handleTrackChange}
              masteredThemes={masteredThemes}
              customThemesCount={customThemes?.length || 0}
              currentTheme={theme}
            />
          </div>

          <div className="lg:col-span-5 h-full min-h-[11rem] flex flex-col">
            <StayAnalysisPanel 
              masteryData={masteryData}
              impromptuPassed={impromptuPassed}
              stayStats={stayStats}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-stretch">
          <div className="lg:col-span-7 bg-white rounded-xl p-2.5 border border-slate-100 shadow-[0_4px_14px_rgba(0,0,0,0.012)] h-full min-h-[5.5rem] flex flex-col justify-center">
            <ThemeGateway 
              theme={theme}
              setTheme={setTheme}
              themeSwitchError={themeSwitchError}
              setThemeSwitchError={setThemeSwitchError}
              runMasteryGate={runMasteryGate}
              masteryData={masteryData}
              customThemes={customThemes || []}
              currentCustomTheme={currentCustomTheme}
              isDeletingTheme={isDeletingTheme}
              setIsDeletingTheme={setIsDeletingTheme}
              setIsCustomThemeModalOpen={setIsCustomThemeModalOpen}
              getThemeOptions={getThemeOptions}
              stage={stage}
              refreshCustomThemes={refreshCustomThemes}
              showNotice={showNotice}
              setThemeFocus={async (params) => {
                await setThemeFocus(params).catch(() => {});
              }}
              deleteCustomTheme={async (id) => {
                 const { deleteCustomTheme } = await import('../../../../services/trainingAPI');
                 return deleteCustomTheme(id);
              }}
            />
          </div>

          <div className="lg:col-span-5 h-full min-h-[5.5rem] flex flex-col">
            <DailyBriefingCard 
               quotaStatus={quotaStatus}
               generatedArticle={generatedArticle}
               extractedWordsCount={extractedWords.length}
               extractedPhrasesCount={extractedPhrases.length}
            />
          </div>
        </div>

        <ArsenalPanel
          genre={genre}
          setGenre={setGenre}
          cefrLevel={cefrLevel}
          setCefrLevel={setCefrLevel}
          duration={duration}
          setDuration={setDuration}
          isAutoGenerating={isAutoGenerating}
          handleAutoGenerate={handleAutoGenerate}
          isClearingAndReGenerating={isClearingAndReGenerating}
          handleClearTodayAndReGenerate={handleClearTodayAndReGenerate}
          showClearConfirm={showClearConfirm}
          setShowClearConfirm={setShowClearConfirm}
          quotaStatus={quotaStatus}
          compact={false}
        />
      </div>

        {inlineNotice && noticeAnchor === 'dashboard' && (
          <div className={`absolute right-0 top-12 z-20 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-lg border ${inlineNotice.tone === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : inlineNotice.tone === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-blue-500 text-white border-blue-400'}`}>
            {inlineNotice.text}
          </div>
        )}

        <IntelBriefing 
          generatedArticle={generatedArticle}
          setGeneratedArticle={setGeneratedArticle}
          intelSource={intelSource}
          setIntelSource={setIntelSource}
          isAutoGenerating={isAutoGenerating}
          handleAutoGenerate={handleAutoGenerate}
          theme={theme}
          currentVoiceName={currentVoiceName}
          showResetConfirm={showResetConfirm}
          setShowResetConfirm={setShowResetConfirm}
          setExtractedWords={setExtractedWords}
          setExtractedPhrases={setExtractedPhrases}
          setExtractedSentences={setExtractedSentences}
          isArticleExpanded={isArticleExpanded}
          setIsArticleExpanded={setIsArticleExpanded}
          showNotice={showNotice}
          setIsImmersiveOpen={setIsImmersiveOpen}
          customText={customText}
          setCustomText={setCustomText}
          extractedWords={extractedWords}
          extractedPhrases={extractedPhrases}
          extractedSentences={extractedSentences}
          vocabDetailsMap={vocabDetailsMap}
          asyncMeanings={asyncMeanings}
          handleAddWordToVocab={handleAddWordToVocab}
          fetchBilingualTranslation={fetchBilingualTranslation}
        />

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

      {/* 沉浸式阅读空间 Fullscreen Modal（已抽离） */}
      <ImmersiveReader 
        isOpen={isImmersiveOpen}
        onClose={() => setIsImmersiveOpen(false)}
        generatedArticle={generatedArticle}
        theme={theme}
        cefrLevel={cefrLevel}
        genre={genre}
        currentVoiceName={currentVoiceName}
        immersiveTheme={immersiveTheme}
        setImmersiveTheme={setImmersiveTheme}
        immersiveFontSize={immersiveFontSize}
        setImmersiveFontSize={setImmersiveFontSize}
        selectedWord={selectedWord}
        setSelectedWord={setSelectedWord}
        isAddingSelected={isAddingSelected}
        setIsAddingSelected={setIsAddingSelected}
        showNotice={showNotice}
      />

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

      {isAutoGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center mx-auto">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                正在为您生成【{
                  {
                    meeting: '高管会议',
                    email: '商务邮件',
                    report: '行业研报',
                    negotiation: '谈判拉扯',
                    presentation: '路演汇报',
                    reading: '沉浸阅读',
                    news: '财经新闻'
                  }[genre] || genre
                } / {cefrLevel} / {duration}分钟】商业长文
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                AI 大模型正在深度解析语境并提纯核心词汇、精选短语与实战句型，预计需 15~30 秒...
              </p>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-[var(--color-brand)] h-full w-2/3 animate-pulse" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
