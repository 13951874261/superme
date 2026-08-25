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
import { getAppUserId } from '../../../../utils/profileHelper';
import { lookupVocabWords, getVocabItem, queryDictionaryWithCache, createConcurrencyLimiter } from '../../../../services/vocabAPI';
import { useVocabCollect } from '../../../../hooks/useVocabCollect';
import { notifyBackgroundHandoff } from '../../../../utils/backgroundHandoff';
import SpeakButton, { speakEnglish } from '../../../SpeakButton';
import { useTask } from '../../../TaskContext';

import { VOICE_OPTIONS } from '../../../../config/voices';


const safeToStr = (item: any) => (typeof item === 'string' ? item : (item?.word || item?.phrase || item?.text || String(item || ''))).trim();

/**
 * 判断词条是否已具备完整词汇矩阵。
 * 自动翻译缓存也会把词句写入生词库，因此仅凭"库里有这条"不能算已收录，
 * 必须矩阵（释义 + 记忆节点 + 高管 SOP）齐备才视为收录完成。
 */
const isVocabMatrixReady = (payload: any): boolean => {
  if (!payload) return false;
  if (payload.matrix_generated_at) return true;
  const hasNodes = (Array.isArray(payload.synonyms) && payload.synonyms.length > 0)
    || (Array.isArray(payload.collocations) && payload.collocations.length > 0);
  const hasSop = !!payload.executive_sop?.register;
  return hasNodes && hasSop;
};

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
    customThemes, setCustomThemes, refreshCustomThemes,
    masteredThemes,
    practicedThemes,
    stayStats,
  } = useEnglishContext();
  const {
    collect: collectVocab,
    isCollecting: isVocabCollecting,
    isQueued: isVocabQueued,
    isCollected: isVocabCollectedLocal,
  } = useVocabCollect({
    notify: (message, type) => showNotice('dashboard', message, type),
  });
  const { addTask, startPolling } = useTask();

  const [isCustomThemeModalOpen, setIsCustomThemeModalOpen] = useState(false);
  const [isSopExpanded, setIsSopExpanded] = useState(false);
  const currentCustomTheme = customThemes?.find(c => (c.displayName || c.themeName) === theme);

  // 主题锁定机制 - 单一数据源
  // 与 EnglishContext.tsx 中 isMastered 判定保持一致：
  //   口语 >= 10 轮 && 写作最高分 >= 8 分 && emailCompleted

  // 公共主题锁定校验：返回 true 表示放行，false 表示已被锁定（错误信息已写入）
  const runMasteryGate = async (): Promise<boolean> => {
    // 彻底解除强制锁定校验，直接放行，但依然静默调用以拉取最新通关进度
    setThemeSwitchError(null);
    void checkThemeMastery(theme).catch(() => {});
    return true;
  };

  const handleTrackChange = async (newTrack: 'business' | 'all') => {
    // 政商务 / 全场景轨道可自由切换，不做通关锁定；主题切换仍走 runMasteryGate
    if (newTrack === stage) {
      setThemeSwitchError(null);
      return;
    }

    setThemeSwitchError(null);
    setStage(newTrack);
    
    // 切换轨道时自动跳转到该轨道的第一个场景，让用户能立即试用新场景内容
    const options = getThemeOptions(newTrack);
    const isFirstInNewTrack = !options.find(o => o.value === theme);
    if (isFirstInNewTrack || options.indexOf(options.find(o => o.value === theme)!) < 0) {
      // 自动选择该轨道的第一个主题
      const newTheme = options[0].value;
      setTheme(newTheme);
      await setThemeFocus({ theme: newTheme }).catch(() => {});
    }
  };

  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [isBackgroundGenerating, setIsBackgroundGenerating] = useState(false);
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

  const readStoredArray = (key: string): string[] => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const [briefingTab, setBriefingTab] = useState<'longform' | 'material'>('longform');
  const [materialArticle, setMaterialArticle] = useState<string>(() => localStorage.getItem('super_agent_material_article') || '');
  const [materialWords, setMaterialWords] = useState<string[]>(() => readStoredArray('super_agent_material_words'));
  const [materialPhrases, setMaterialPhrases] = useState<string[]>(() => readStoredArray('super_agent_material_phrases'));
  const [materialSentences, setMaterialSentences] = useState<string[]>(() => readStoredArray('super_agent_material_sentences'));
  const [materialSource, setMaterialSource] = useState<string>(() => localStorage.getItem('super_agent_material_source') || '上传材料');

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

  // 自定义场景后台级联删除完成/失败：刷新列表；失败则恢复选项
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.status === 'failed') {
        const snap = detail.themeSnapshot;
        if (snap?.id) {
          setCustomThemes((prev) => {
            if (prev.some((t) => t.id === snap.id)) return prev;
            return [{
              id: snap.id,
              themeName: snap.themeName || snap.theme_name || '',
              displayName: snap.displayName || snap.display_name || '',
              associatedFile: snap.associatedFile || snap.associated_file || '',
              difyDocumentId: snap.difyDocumentId || snap.dify_document_id || '',
              difyDatasetId: snap.difyDatasetId || snap.dify_dataset_id || '',
              extractedKeywords: snap.extractedKeywords || [],
              source: 'custom' as const,
              createdAt: snap.createdAt || snap.created_at || Date.now(),
            }, ...prev];
          });
        }
        if (detail.error) console.error('场景后台删除失败:', detail.error);
        showNotice(
          'dashboard',
          '删除失败，已把该场景加回列表，请稍后重试',
          'error'
        );
        return;
      }
      void refreshCustomThemes();
      if (detail.status === 'completed') {
        showNotice(
          'dashboard',
          detail.message || '场景及相关学习资料已清理',
          'success'
        );
      }
    };
    window.addEventListener('custom-theme-delete-finished', handler);
    return () => window.removeEventListener('custom-theme-delete-finished', handler);
  }, [refreshCustomThemes, setCustomThemes, showNotice]);

  // 监听 intel-data-refreshed 事件，触发情报面板即时更新
  useEffect(() => {
    const handleIntelRefresh = () => {
      const article = localStorage.getItem('super_agent_last_generated_article') || '';
      setGeneratedArticle(article);
      setExtractedWords(JSON.parse(localStorage.getItem('super_agent_last_generated_words') || '[]'));
      setExtractedPhrases(JSON.parse(localStorage.getItem('super_agent_last_generated_phrases') || '[]'));
      setExtractedSentences(JSON.parse(localStorage.getItem('super_agent_last_generated_sentences') || '[]'));
      setIntelSource(localStorage.getItem('super_agent_intel_source') || '每日系统生成');
      if (article) setBriefingTab('longform');
    };

    window.addEventListener('intel-data-refreshed', handleIntelRefresh);
    return () => window.removeEventListener('intel-data-refreshed', handleIntelRefresh);
  }, []);

  useEffect(() => {
    const applyMaterial = () => {
      setMaterialArticle(localStorage.getItem('super_agent_material_article') || '');
      setMaterialWords(readStoredArray('super_agent_material_words'));
      setMaterialPhrases(readStoredArray('super_agent_material_phrases'));
      setMaterialSentences(readStoredArray('super_agent_material_sentences'));
      setMaterialSource(localStorage.getItem('super_agent_material_source') || '上传材料');
      setBriefingTab('material');
    };
    window.addEventListener('material-data-refreshed', applyMaterial);
    return () => window.removeEventListener('material-data-refreshed', applyMaterial);
  }, []);

  useEffect(() => {
    const openMaterial = () => {
      setBriefingTab('material');
      const preferReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 280, behavior: preferReducedMotion ? 'auto' : 'smooth' });
    };
    window.addEventListener('open-uploaded-material', openMaterial);
    return () => window.removeEventListener('open-uploaded-material', openMaterial);
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
      if (detail?.source === 'material') {
        if (detail?.article) setMaterialArticle(detail.article);
        if (detail?.words) setMaterialWords(detail.words);
        if (detail?.phrases) setMaterialPhrases(detail.phrases);
        if (detail?.sentences) setMaterialSentences(detail.sentences);
        setBriefingTab('material');
        return;
      }
      if (detail?.article) {
        setGeneratedArticle(detail.article);
        setBriefingTab('longform');
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

  // 限制字典并行查询的辅助类，防止连接池耗尽
  class ConcurrencyLimiter {
    private activeCount = 0;
    private queue: (() => void)[] = [];
    constructor(private maxConcurrency: number) {}

    async run<T>(fn: () => Promise<T>): Promise<T> {
      if (this.activeCount >= this.maxConcurrency) {
        await new Promise<void>((resolve) => this.queue.push(resolve));
      }
      this.activeCount++;
      try {
        return await fn();
      } finally {
        this.activeCount--;
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }

  // 限制最大并行字典查询数为 3，避免阻塞主接口请求
  const translationLimiter = React.useMemo(() => new ConcurrencyLimiter(3), []);

  // 自动调用英汉双向译制翻译接口补齐释义
  const fetchBilingualTranslation = async (text: string) => {
    const keyStr = text.toLowerCase().trim();
    if (!keyStr || pendingTranslationsRef.current.has(keyStr) || asyncMeanings[keyStr]) return;

    pendingTranslationsRef.current.add(keyStr);

    try {
      const res = await translationLimiter.run(() => queryDictionaryWithCache({
        word: text,
        dictType: 'en_zh_bidirectional', // 复用英汉双向译制类型
      }));

      if (res.ok && res.payload) {
        const payload = res.payload as any;
        const mainTrans = payload.translation_main || payload.meaning_zh || payload.meaning || '';
        const phone = payload.phonetic || '';

        if (mainTrans) {
          // 仅缓存到界面展示，不落生词本：入库只能由用户逐条点击「+ 收录」触发
          setAsyncMeanings(prev => ({
            ...prev,
            [keyStr]: { meaning: mainTrans, phonetic: phone }
          }));
        }
      }
    } finally {
      pendingTranslationsRef.current.delete(keyStr);
    }
  };

  const loadVocabDetails = async () => {
    try {
      const extractedKeyList = Array.from(new Set([
        ...extractedWords.map(w => safeToStr(w).toLowerCase()).filter(Boolean),
        ...extractedPhrases.map(p => safeToStr(p).toLowerCase()).filter(Boolean),
        ...extractedSentences.map(s => safeToStr(s).toLowerCase()).filter(Boolean),
        ...materialWords.map(w => safeToStr(w).toLowerCase()).filter(Boolean),
        ...materialPhrases.map(p => safeToStr(p).toLowerCase()).filter(Boolean),
        ...materialSentences.map(s => safeToStr(s).toLowerCase()).filter(Boolean)
      ]));

      if (extractedKeyList.length === 0) {
        setVocabDetailsMap({});
        return;
      }

      // 分批批量点查生词库（每批最多 100 词）
      const matchedEntries: any[] = [];
      for (let i = 0; i < extractedKeyList.length; i += 100) {
        const batch = extractedKeyList.slice(i, i + 100);
        const res = await lookupVocabWords(batch);
        if (Array.isArray(res)) {
          matchedEntries.push(...res);
        }
      }

      if (matchedEntries.length === 0) {
        setVocabDetailsMap({});
        return;
      }

      // 对命中的生词按需补全 payload 详情
      const detailedEntries = await Promise.all(
        matchedEntries.map(async (item) => {
          if (!item?.id) return item;
          try {
            return await getVocabItem(item.id);
          } catch {
            return item;
          }
        })
      );

      const detailsMap: Record<string, any> = {};
      detailedEntries.forEach((item) => {
        if (item?.word) {
          const key = item.word.toLowerCase().trim();
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
            matrixReady: isVocabMatrixReady(payload),
          };
        }
      });
      setVocabDetailsMap(detailsMap);
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        console.error('Failed to load vocab details:', err);
      }
    }
  };

  // 1. 批量翻译 useEffect（仅补齐界面释义缓存，不入库；入库只能逐条手动收录）
  useEffect(() => {
    let active = true;
    const queryLimiter = createConcurrencyLimiter(3);

    const translateExtractedItems = async () => {
      // 收集待翻译的生词、短语、句型
      const allTextItems = [
        ...extractedWords.map(w => safeToStr(w)),
        ...extractedPhrases.map(p => safeToStr(p)),
        ...extractedSentences.map(s => safeToStr(s)),
        ...materialWords.map(w => safeToStr(w)),
        ...materialPhrases.map(p => safeToStr(p)),
        ...materialSentences.map(s => safeToStr(s))
      ].filter(Boolean);

      const uniqueWords = [...new Set(allTextItems)];

      // 过滤出未翻译的词汇
      const toTranslate = uniqueWords.filter(word => {
        const key = word.toLowerCase().trim();
        return !vocabDetailsMap[key] && !asyncMeanings[key] && !pendingTranslationsRef.current.has(key);
      });

      if (toTranslate.length === 0) return;

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
                // 只更新界面释义缓存，不写入生词本
                setAsyncMeanings(prev => ({
                  ...prev,
                  [key]: { meaning: mainTrans, phonetic: phone }
                }));
              }
            }
          } catch (err) {
            console.warn(`Failed to translate "${word}":`, err);
          } finally {
            pendingTranslationsRef.current.delete(key);
          }
        });
      });
    };

    translateExtractedItems();

    return () => {
      active = false;
    };
  }, [extractedWords, extractedPhrases, extractedSentences, materialWords, materialPhrases, materialSentences, vocabDetailsMap]);

  // 2. 加载词汇详情与监听 vocab-updated 事件的 useEffect
  useEffect(() => {
    if (extractedWords.length > 0 || materialWords.length > 0) {
      loadVocabDetails();
    }
    const handleUpdate = () => {
      loadVocabDetails();
    };
    window.addEventListener('vocab-updated', handleUpdate);
    return () => window.removeEventListener('vocab-updated', handleUpdate);
  }, [extractedWords, extractedPhrases, extractedSentences, materialWords, materialPhrases, materialSentences]);

  // 逐条收录生词/短语/句式，收录即补齐词汇矩阵（带 3 秒竞速超时，超时解耦转后台任务中心）
  const handleAddWordToVocab = async (
    text: string,
    isPhrase: boolean = false,
    isSentence: boolean = false,
    anchor: HTMLElement | null = null
  ) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    const cleanKey = cleanText.toLowerCase().trim();

    // 已收录且矩阵齐备则跳过；仅有自动翻译缓存的词条仍需补齐矩阵
    if (vocabDetailsMap[cleanKey]?.matrixReady) {
      showNotice('dashboard', `“${cleanText.slice(0, 20)}${cleanText.length > 20 ? '…' : ''}” 已在生词本中，信息已齐全`, 'info');
      return;
    }

    const result = await collectVocab({
      text: cleanText,
      isPhrase,
      isSentence,
      topic: theme,
      source: 'Material Upload',
      payload: {
        meaning: asyncMeanings[cleanKey]?.meaning || '',
        phonetic: asyncMeanings[cleanKey]?.phonetic || '',
      },
      anchor,
    });

    if (result === 'collected') loadVocabDetails();
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
          setBriefingTab('longform');

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
          showNotice('dashboard', '暂无今日长文，请点击「查询/生成今日长文」生成', 'info');
        }
      } catch (e) {
        if (active) {
          showNotice('dashboard', '读取今日长文失败，请稍后重试或重新生成', 'error');
        }
      }
    };

    fetchPersistedArticle();

    return () => {
      active = false;
    };
  }, [genre, cefrLevel, duration, theme, intelSource]);


  const handleAutoGenerate = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    const handoffAnchor = (e?.currentTarget as HTMLElement) || null;
    setIsAutoGenerating(true);
    setIsBackgroundGenerating(false);
    playScan();
    showNotice('dashboard', '正在查找现成材料，或准备生成…', 'info');
    try {
      const {
        fetchExactArticleIfExists,
        startEnglishMasteryExtraction,
        waitEnglishMasteryExtraction,
        withDailyExtractTimeout,
        DAILY_EXTRACT_RACE_MS,
      } = await import('../../../../services/difyAPI');

      // 1. 先查：优先校验数据库中是否存在匹配当前多维度组合的已生成长文
      const exactRes = await fetchExactArticleIfExists({
        userId: getAppUserId(),
        genre,
        cefrLevel,
        duration,
        topic: theme
      });

      if (exactRes.found && exactRes.data) {
        showNotice('dashboard', '已找到长文和词汇，直接加载，也可以重新生成', 'success');
        setBriefingTab('longform');
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

      // 未命中：用户主动点击后才生成（3 秒竞速，超时转入任务中心）
      showNotice('dashboard', '没有现成材料，开始生成…', 'info');

      const started = await startEnglishMasteryExtraction(theme, '', getAppUserId(), cefrLevel, genre, duration);

      if ((started as any).quotaExceeded) {
        showNotice(
          'dashboard',
          (started as any).message || '今天可收录的生词数量已满（不是生成失败）。请先点「重置今日」清空后再试',
          'error'
        );
        playError();
        setIsAutoGenerating(false);
        return;
      }

      const applyDisplayResult = (result: any) => {
        if (result.quota) {
          setQuotaStatus(result.quota);
        }
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

        const vocabSource = result.vocabSource as 'dify' | 'fallback' | 'empty' | undefined;
        const displayWordCount = (result.words || []).length;
        const displayPhraseCount = (result.phrases || []).length;
        const displaySentenceCount = (result.sentences || []).length;
        const hasDisplayVocab = displayWordCount + displayPhraseCount + displaySentenceCount > 0;

        playSuccess();
        setShowConfetti(true);

        if (vocabSource === 'empty' || !hasDisplayVocab) {
          showNotice('dashboard', '长文已生成，但未能从中整理出生词、短语或句型，请重试或换一批材料', 'error');
        } else {
          showNotice(
            'dashboard',
            `长文和生词已显示（${displayWordCount} 词 / ${displayPhraseCount} 短语 / ${displaySentenceCount} 句型），请逐条点「+ 收录」加入生词本`,
            'success'
          );
        }
      };

      // 无 taskId：同步结果（极少）——直接渲染
      if (!started.taskId) {
        applyDisplayResult(started);
        setIsAutoGenerating(false);
        return;
      }

      const waitPromise = waitEnglishMasteryExtraction(started.taskId);

      const race = await withDailyExtractTimeout(waitPromise, DAILY_EXTRACT_RACE_MS);
      if (race.isTimeout) {
        addTask({
          id: started.taskId,
          type: 'daily_extract',
          name: `长文生成: ${String(theme).slice(0, 24)} (${genre}/${cefrLevel}/${duration}m)`,
          status: 'running',
          progress: 20,
          logs: ['超过 3 秒未完成，已转入后台继续生成；完成后可再次查询命中缓存'],
        });
        startPolling?.(started.taskId);
        const handoffMsg = '生成较久，已转入后台，稍后可在【任务中心】查看';
        notifyBackgroundHandoff({
          anchor: handoffAnchor,
          message: handoffMsg,
          tone: 'info',
        });
        // 有锚点时就近浮层已提示，避免再弹同文案角标
        if (!handoffAnchor) showNotice('dashboard', handoffMsg, 'info');
        setIsBackgroundGenerating(true);
        setIsAutoGenerating(false);
        // 超时后继续等待：完成后自动回填 Dashboard，避免结果被丢弃
        waitPromise
          .then((result) => {
            applyDisplayResult(result);
            setIsBackgroundGenerating(false);
          })
          .catch(() => {
            setIsBackgroundGenerating(false);
          });
        return;
      }

      if (!('result' in race)) {
        // 超时已在上面处理完，兜底 return
        return;
      }
      applyDisplayResult(race.result);
    } catch (e: any) {
      playError();
      console.error('生成今日长文失败:', e);
      showNotice('dashboard', '生成失败，请稍后重试', 'error');
    } finally {
      setIsAutoGenerating(false);
    }
  };

  const handleClearTodayAndReGenerate = async () => {
    setIsClearingAndReGenerating(true);
    playScan();
    showNotice('dashboard', '正在清空今日收录额度，并删除当前长文与音频…', 'info');

    try {
      const { clearTodayQuotaAndData } = await import('../../../../services/difyAPI');
      
      // 调用后端：清空配额/生词 + 删除当前账号今日 主题/题材/难度/时长 下的长文与音频
      await clearTodayQuotaAndData(getAppUserId(), {
        topic: theme,
        theme,
        genre,
        cefrLevel,
        duration,
      });
      
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
      
      showNotice('dashboard', '已清空，正在重新生成…', 'info');
      
      // 触发重新生成 (由于 handleAutoGenerate 内部调用了 setIsAutoGenerating，这里我们可以直接执行)
      // 为了确保 setIsClearingAndReGenerating 已经为 false, 我们在 handleAutoGenerate 之前或之后设为 false
      setIsClearingAndReGenerating(false);
      
      // 直接调用 handleAutoGenerate
      await handleAutoGenerate();
    } catch (e: any) {
      playError();
      console.error('清空后重新生成失败:', e);
      showNotice('dashboard', '清空后重新生成失败，请稍后重试', 'error');
      setIsClearingAndReGenerating(false);
    }
  };

  return (
    <>
      <div className="space-y-3 animate-[fadeIn_0.3s_ease-out] relative">
      {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
      
      {/* 战术使用指南 SOP — 默认收起的细条 */}
      <div className="card-sop px-3 py-2 flex flex-col gap-2 shrink-0 shadow-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between select-none text-left"
          onClick={() => setIsSopExpanded(!isSopExpanded)}
          aria-expanded={isSopExpanded}
        >
          <div className="flex items-center gap-2">
            <div className="bg-[var(--color-brand)] text-white p-1 rounded-md shadow-sm">
               <Target aria-hidden="true" className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <h5 className="eyebrow text-[var(--color-brand)]/80">使用说明</h5>
              <p className="text-[10px] text-[var(--color-ink-secondary)] font-medium">点击展开/收起模块使用说明</p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 px-2 py-0.5 rounded-md transition-colors text-xs font-bold" aria-hidden="true">
            {isSopExpanded ? '收起指南' : '展开指南'}
            {isSopExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        <SOPGuide isSopExpanded={isSopExpanded} />
      </div>

      {/* 均分布局：上/中两行对开等高，词汇库通栏 */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-stretch">
          <div className="lg:col-span-7 bg-white rounded-xl p-2.5 border border-slate-100 shadow-[0_4px_14px_rgba(0,0,0,0.012)] flex flex-col h-full min-h-[11rem]">
            <StrategicRoadmap
              stage={stage}
              handleTrackChange={handleTrackChange}
              masteredThemes={masteredThemes}
              practicedThemes={practicedThemes}
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
              setCustomThemes={setCustomThemes}
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
          isBackgroundGenerating={isBackgroundGenerating}
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
          <div
            role="status"
            aria-live="polite"
            className={`absolute right-0 top-12 z-20 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-lg border ${inlineNotice.tone === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : inlineNotice.tone === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-blue-500 text-white border-blue-400'}`}
          >
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
          briefingTab={briefingTab}
          setBriefingTab={setBriefingTab}
          materialArticle={materialArticle}
          materialSource={materialSource}
          materialWords={materialWords}
          materialPhrases={materialPhrases}
          materialSentences={materialSentences}
          setMaterialArticle={setMaterialArticle}
          setMaterialWords={setMaterialWords}
          setMaterialPhrases={setMaterialPhrases}
          setMaterialSentences={setMaterialSentences}
          vocabDetailsMap={vocabDetailsMap}
          asyncMeanings={asyncMeanings}
          handleAddWordToVocab={handleAddWordToVocab}
          fetchBilingualTranslation={fetchBilingualTranslation}
          isVocabCollecting={isVocabCollecting}
          isVocabQueued={isVocabQueued}
          isVocabCollectedLocal={isVocabCollectedLocal}
        />

        <MaterialUploader 
          topicHint={theme} 
          onExtractionSuccess={(data) => {
            if (data) {
              const sentences = (data as any).sentences || [];
              setMaterialArticle(data.article || '');
              setMaterialWords(data.words || []);
              setMaterialPhrases(data.phrases || []);
              setMaterialSentences(sentences);
              setMaterialSource('上传材料');
              setBriefingTab('material');
              localStorage.setItem('super_agent_material_article', data.article || '');
              localStorage.setItem('super_agent_material_words', JSON.stringify(data.words || []));
              localStorage.setItem('super_agent_material_phrases', JSON.stringify(data.phrases || []));
              localStorage.setItem('super_agent_material_sentences', JSON.stringify(sentences));
              localStorage.setItem('super_agent_material_source', '上传材料');

              showNotice('dashboard', '整理完成！请到「上传材料」标签查看生词、短语和句型，再逐条点「+ 收录」', 'success');
              playSuccess();
              
              const preferReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              window.scrollTo({ top: 300, behavior: preferReducedMotion ? 'auto' : 'smooth' });
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
        generatedArticle={briefingTab === 'material' ? materialArticle : generatedArticle}
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
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm overscroll-contain animate-[fadeIn_0.2s_ease-out]"
        >
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
                正在生成…（超过 3 秒将自动转入后台）
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
