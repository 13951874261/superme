import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { learnGet, learnSet, learnRemove } from '../../../../utils/learnLocal';
import { checkThemeMastery, getTrainingSessionByDate, upsertTrainingSession, setThemeFocus, markEmailComplete, listCustomThemes, getMasteredThemes, getThemeStayStats, CustomTheme, ThemeStayStats } from '../../../../services/trainingAPI';
import { runWordEnrichment } from '../../../../services/difyAPI';
import { syncUserTheme, fetchUserTheme } from '../../../../services/dailyPackAPI';
import { applyCurrentTheme } from '../../../../utils/currentTheme';
import { ComparisonResult } from '../../../../types/listening';
import { LongAudio } from '../../../../services/listeningAPI';

export type EnglishTab = 'dashboard' | 'vocab' | 'listen' | 'oral' | 'write' | 'impromptu';

export const BUSINESS_THEMES = [
  { value: '商务谈判：让步与施压', label: '商务谈判：让步与施压' },
  { value: '危机公关：外媒答疑', label: '危机公关：外媒答疑' },
  { value: '项目汇报：跨国董事会', label: '项目汇报：跨国董事会' },
  { value: '商务破冰：高管Small Talk', label: '商务破冰：高管Small Talk' },
  { value: '会议主持：跨文化控场', label: '会议主持：跨文化控场' },
  { value: '跨部门协调：资源争夺', label: '跨部门协调：资源争夺' },
  { value: '绩效反馈：员工评估', label: '绩效反馈：员工评估' },
  { value: '商业路演：投资人汇报', label: '商业路演：投资人汇报' },
  { value: '供应商审计：合规谈判', label: '供应商审计：合规谈判' },
  { value: '组织重组：人事沟通', label: '组织重组：人事沟通' },
];

export const GENERAL_THEMES = [
  { value: '跨文化社交：艺术展交流', label: '跨文化社交：艺术展交流' },
  { value: '应急沟通：海外就医', label: '应急沟通：海外就医' },
  { value: '文化破冰：外企晚宴', label: '文化破冰：外企晚宴' },
  { value: '中日韩三方会议：跨文化卟局', label: '中日韩三方会议：跨文化卟局' },
  { value: '娱乐审美：艺术讲述', label: '娱乐审美：艺术讲述' },
  { value: '中东商务：跨文化禁忌', label: '中东商务：跨文化禁忌' },
];

// 全场景主题 = 政务10场景 + 日常6场景
export const ALL_THEMES = [...BUSINESS_THEMES, ...GENERAL_THEMES];

// 轨道模式：政务轨道只显示政务场景，全场景轨道显示所有场景
export type StageTrack = 'business' | 'all';
export const getThemeOptions = (track: StageTrack) => track === 'business' ? BUSINESS_THEMES : ALL_THEMES;

export function localTrainingDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function deriveL3MasteryScore(raw: any): number {
  const L3 = String(raw.L3_Strategic_Position || raw.L3 || raw.l3_strategic_position || '').trim();
  const m = L3.match(/(?:评分|分数|score|rating)[：:\s]*(\d+(?:\.\d+)?)/i);
  if (m) return Math.min(10, Math.max(0, Number(m[1])));
  if (L3.length >= 120) return 8.5;
  if (L3.length >= 60) return 8;
  if (L3.length >= 30) return 7;
  return 6;
}

interface EnglishContextType {
  // Global
  activeTab: EnglishTab;
  setActiveTab: React.Dispatch<React.SetStateAction<EnglishTab>>;
  stage: StageTrack;
  setStage: React.Dispatch<React.SetStateAction<StageTrack>>;
  theme: string;
  setTheme: React.Dispatch<React.SetStateAction<string>>;
  masteryData: { isMastered: boolean; oralCount: number; maxWriteScore: number; emailCompleted: boolean; _isInitial?: boolean };
  setMasteryData: React.Dispatch<React.SetStateAction<{ isMastered: boolean; oralCount: number; maxWriteScore: number; emailCompleted: boolean; _isInitial?: boolean }>>;
  themeSwitchError: React.ReactNode | null;
  setThemeSwitchError: React.Dispatch<React.SetStateAction<React.ReactNode | null>>;
  sessionId: string | null;
  todaySession: any | null;
  stayStats: ThemeStayStats | null;
  refreshStayStats: (force?: boolean) => Promise<void>;
  refreshTodaySession: () => Promise<void>;
  englishShellActive: boolean;
  setEnglishShellActive: React.Dispatch<React.SetStateAction<boolean>>;
  inlineNotice: { text: string; tone: 'success' | 'error' | 'info' } | null;
  noticeAnchor: 'review' | 'oral' | 'listen' | 'eval' | 'dashboard' | null;
  showNotice: (anchor: 'review' | 'oral' | 'listen' | 'eval' | 'dashboard', text: string, tone: 'success' | 'error' | 'info') => void;
  hideNotice: () => void;
  showMasteryOverlay: boolean;
  setShowMasteryOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  masteredThemes: string[];
  setMasteredThemes: React.Dispatch<React.SetStateAction<string[]>>;
  practicedThemes: string[];
  setPracticedThemes: React.Dispatch<React.SetStateAction<string[]>>;
  impromptuPassed: boolean;
  setImpromptuPassed: React.Dispatch<React.SetStateAction<boolean>>;
  markEmailComplete: (theme: string) => Promise<void>;

  // Dashboard
  pronunciationNotes: string;
  setPronunciationNotes: React.Dispatch<React.SetStateAction<string>>;
  grammarNotes: string;
  setGrammarNotes: React.Dispatch<React.SetStateAction<string>>;

  // Vocab
  vocabZone: 'business' | 'general';
  setVocabZone: React.Dispatch<React.SetStateAction<'business' | 'general'>>;
  dueWords: any[];
  setDueWords: React.Dispatch<React.SetStateAction<any[]>>;
  currentWordIdx: number;
  setCurrentWordIdx: React.Dispatch<React.SetStateAction<number>>;
  sentenceInput: string;
  setSentenceInput: React.Dispatch<React.SetStateAction<string>>;
  isEvaluating: boolean;
  setIsEvaluating: React.Dispatch<React.SetStateAction<boolean>>;
  evalResult: { feedback: string; quality: number } | null;
  setEvalResult: React.Dispatch<React.SetStateAction<{ feedback: string; quality: number } | null>>;
  loadingDueWords: boolean;
  setLoadingDueWords: React.Dispatch<React.SetStateAction<boolean>>;

  // Listen
  listenMaterialTheme: string;
  setListenMaterialTheme: React.Dispatch<React.SetStateAction<string>>;
  listenMaterial: string;
  setListenMaterial: React.Dispatch<React.SetStateAction<string>>;
  listenAudioUrl: string | null;
  setListenAudioUrl: React.Dispatch<React.SetStateAction<string | null>>;
  isListenMaterialLoading: boolean;
  setIsListenMaterialLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isTextVisible: boolean;
  setIsTextVisible: React.Dispatch<React.SetStateAction<boolean>>;
  isListenLoading: boolean;
  setIsListenLoading: React.Dispatch<React.SetStateAction<boolean>>;
  listenResult: ComparisonResult | null;
  setListenResult: React.Dispatch<React.SetStateAction<ComparisonResult | null>>;
  listenInput: string;
  setListenInput: React.Dispatch<React.SetStateAction<string>>;
  longAudios: LongAudio[];
  setLongAudios: React.Dispatch<React.SetStateAction<LongAudio[]>>;
  selectedLongAudioId: string | null;
  setSelectedLongAudioId: React.Dispatch<React.SetStateAction<string | null>>;
  currentSegmentIndex: number;
  setCurrentSegmentIndex: React.Dispatch<React.SetStateAction<number>>;
  loopEnabled: boolean;
  setLoopEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  longAudioMode: boolean;
  setLongAudioMode: React.Dispatch<React.SetStateAction<boolean>>;
  segmentDrafts: Record<number, string>;
  setSegmentDrafts: React.Dispatch<React.SetStateAction<Record<number, string>>>;

  // Write
  writingText: string;
  setWritingText: React.Dispatch<React.SetStateAction<string>>;
  writeIntent: string;
  setWriteIntent: React.Dispatch<React.SetStateAction<string>>;
  isReviewing: boolean;
  setIsReviewing: React.Dispatch<React.SetStateAction<boolean>>;
  reviewResult: any;
  setReviewResult: React.Dispatch<React.SetStateAction<any>>;
  customThemes: CustomTheme[];
  setCustomThemes: React.Dispatch<React.SetStateAction<CustomTheme[]>>;
  refreshCustomThemes: () => Promise<void>;
  pendingSentenceDebt: string | null;
  setPendingSentenceDebt: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface ThemeCtxType {
  stage: StageTrack;
  setStage: React.Dispatch<React.SetStateAction<StageTrack>>;
  theme: string;
  setTheme: React.Dispatch<React.SetStateAction<string>>;
  masteryData: { isMastered: boolean; oralCount: number; maxWriteScore: number; emailCompleted: boolean; _isInitial?: boolean };
  setMasteryData: React.Dispatch<React.SetStateAction<{ isMastered: boolean; oralCount: number; maxWriteScore: number; emailCompleted: boolean; _isInitial?: boolean }>>;
  themeSwitchError: React.ReactNode | null;
  setThemeSwitchError: React.Dispatch<React.SetStateAction<React.ReactNode | null>>;
  showMasteryOverlay: boolean;
  setShowMasteryOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  masteredThemes: string[];
  setMasteredThemes: React.Dispatch<React.SetStateAction<string[]>>;
  practicedThemes: string[];
  setPracticedThemes: React.Dispatch<React.SetStateAction<string[]>>;
  impromptuPassed: boolean;
  setImpromptuPassed: React.Dispatch<React.SetStateAction<boolean>>;
  markEmailComplete: (theme: string) => Promise<void>;
  customThemes: CustomTheme[];
  setCustomThemes: React.Dispatch<React.SetStateAction<CustomTheme[]>>;
  refreshCustomThemes: () => Promise<void>;
  pendingSentenceDebt: string | null;
  setPendingSentenceDebt: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface VocabCtxType {
  vocabZone: 'business' | 'general';
  setVocabZone: React.Dispatch<React.SetStateAction<'business' | 'general'>>;
  dueWords: any[];
  setDueWords: React.Dispatch<React.SetStateAction<any[]>>;
  currentWordIdx: number;
  setCurrentWordIdx: React.Dispatch<React.SetStateAction<number>>;
  sentenceInput: string;
  setSentenceInput: React.Dispatch<React.SetStateAction<string>>;
  isEvaluating: boolean;
  setIsEvaluating: React.Dispatch<React.SetStateAction<boolean>>;
  evalResult: { feedback: string; quality: number } | null;
  setEvalResult: React.Dispatch<React.SetStateAction<{ feedback: string; quality: number } | null>>;
  loadingDueWords: boolean;
  setLoadingDueWords: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface MediaCtxType {
  listenMaterialTheme: string;
  setListenMaterialTheme: React.Dispatch<React.SetStateAction<string>>;
  listenMaterial: string;
  setListenMaterial: React.Dispatch<React.SetStateAction<string>>;
  listenAudioUrl: string | null;
  setListenAudioUrl: React.Dispatch<React.SetStateAction<string | null>>;
  isListenMaterialLoading: boolean;
  setIsListenMaterialLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isTextVisible: boolean;
  setIsTextVisible: React.Dispatch<React.SetStateAction<boolean>>;
  isListenLoading: boolean;
  setIsListenLoading: React.Dispatch<React.SetStateAction<boolean>>;
  listenResult: ComparisonResult | null;
  setListenResult: React.Dispatch<React.SetStateAction<ComparisonResult | null>>;
  listenInput: string;
  setListenInput: React.Dispatch<React.SetStateAction<string>>;
  longAudios: LongAudio[];
  setLongAudios: React.Dispatch<React.SetStateAction<LongAudio[]>>;
  selectedLongAudioId: string | null;
  setSelectedLongAudioId: React.Dispatch<React.SetStateAction<string | null>>;
  currentSegmentIndex: number;
  setCurrentSegmentIndex: React.Dispatch<React.SetStateAction<number>>;
  loopEnabled: boolean;
  setLoopEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  longAudioMode: boolean;
  setLongAudioMode: React.Dispatch<React.SetStateAction<boolean>>;
  segmentDrafts: Record<number, string>;
  setSegmentDrafts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  writingText: string;
  setWritingText: React.Dispatch<React.SetStateAction<string>>;
  writeIntent: string;
  setWriteIntent: React.Dispatch<React.SetStateAction<string>>;
  isReviewing: boolean;
  setIsReviewing: React.Dispatch<React.SetStateAction<boolean>>;
  reviewResult: any;
  setReviewResult: React.Dispatch<React.SetStateAction<any>>;
}

const EnglishContext = createContext<EnglishContextType | undefined>(undefined);
const ThemeCtx = createContext<ThemeCtxType | undefined>(undefined);
const VocabCtx = createContext<VocabCtxType | undefined>(undefined);
const MediaCtx = createContext<MediaCtxType | undefined>(undefined);

export function EnglishProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<EnglishTab>('dashboard');
  const [stage, setStage] = useState<StageTrack>(() => {
    return (learnGet('english_stage') as StageTrack) || 'business';
  });
  const [theme, setTheme] = useState(() => {
    return learnGet('english_theme') || BUSINESS_THEMES[0].value;
  });
  const themeHydratedRef = useRef(false);
  const [masteryData, setMasteryData] = useState({ isMastered: false, oralCount: 0, maxWriteScore: 0, emailCompleted: false, _isInitial: true });
  useEffect(() => {
    (window as any).__setMasteryData = setMasteryData;
  }, [setMasteryData]);
  const [themeSwitchError, setThemeSwitchError] = useState<React.ReactNode | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [todaySession, setTodaySession] = useState<any | null>(null);
  const [stayStats, setStayStats] = useState<ThemeStayStats | null>(null);
  const [englishShellActive, setEnglishShellActive] = useState(true);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const themeSyncTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchUserTheme()
      .then((serverTheme) => {
        if (cancelled || !serverTheme) return;
        themeHydratedRef.current = true;
        setTheme(serverTheme);
        applyCurrentTheme(serverTheme);
      })
      .catch((err) => {
        console.warn('[EnglishContext] fetchUserTheme failed:', err);
        themeHydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [pendingSentenceDebt, setPendingSentenceDebt] = useState<string | null>(() => {
    return learnGet('super_agent_pending_debt') || null;
  });

  useEffect(() => {
    if (pendingSentenceDebt) {
      learnSet('super_agent_pending_debt', pendingSentenceDebt);
    } else {
      learnRemove('super_agent_pending_debt');
    }
  }, [pendingSentenceDebt]);

  const refreshCustomThemes = async () => {
    try {
      const res = await listCustomThemes();
      if (res.success && Array.isArray(res.themes)) {
        setCustomThemes(res.themes);
      }
    } catch (err) {
      console.error('Failed to load custom themes:', err);
    }
  };

  // 延迟加载自定义主题（避免页面初始请求过载）
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshCustomThemes();
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // 加载后端历史通关主题列表（用于路线图等真实进度，延迟执行避免初始请求过载）
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await getMasteredThemes();
          if (!cancelled && res.success) {
            if (Array.isArray(res.masteredThemes)) {
              setMasteredThemes(res.masteredThemes);
            }
            if (Array.isArray(res.practicedThemes)) {
              setPracticedThemes(res.practicedThemes);
            }
          }
        } catch {
          // ignore — road map still works with local data
        }
      })();
    }, 1200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  useEffect(() => {
    learnSet('english_stage', stage);
  }, [stage]);

  useEffect(() => {
    learnSet('english_theme', theme);
    if (!themeHydratedRef.current) return;
    if (themeSyncTimerRef.current) window.clearTimeout(themeSyncTimerRef.current);
    themeSyncTimerRef.current = window.setTimeout(() => {
      // 静默自动向后台登记当前用户的 user_id 与 theme 绑定关系
      void syncUserTheme(theme)
        .then((row) => {
          applyCurrentTheme(row.theme || theme);
        })
        .catch((err) => {
          console.warn('[EnglishContext] theme sync failed:', err);
        });
    }, 300);
    return () => {
      if (themeSyncTimerRef.current) window.clearTimeout(themeSyncTimerRef.current);
    };
  }, [theme]);

  
  const [inlineNotice, setInlineNotice] = useState<{ text: string; tone: 'success' | 'error' | 'info' } | null>(null);
  const [noticeAnchor, setNoticeAnchor] = useState<'review' | 'oral' | 'listen' | 'eval' | 'dashboard' | null>(null);
  const noticeTimeoutId = useRef<number | null>(null);

  const [showMasteryOverlay, setShowMasteryOverlay] = useState(false);
  const [masteredThemes, setMasteredThemes] = useState<string[]>([]);
  const [practicedThemes, setPracticedThemes] = useState<string[]>([]);
  const [impromptuPassed, setImpromptuPassed] = useState(false);
  const [vocabZone, setVocabZone] = useState<'business' | 'general'>('business');

  const prevMasteryStatusRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    // 忽略组件挂载时的无意义默认占位数据
    if (masteryData._isInitial) return;

    const isMastered = masteryData.oralCount >= 10 && masteryData.maxWriteScore >= 8 && masteryData.emailCompleted;
    const prev = prevMasteryStatusRef.current[theme];

    // 方案B核心：严格捕捉状态的瞬间跃迁
    // 只有当该主题之前被系统明确鉴定为【未达标】(false)，而【现在达标】(true)时，才触发勋章！
    // 刚进页面第一次拿到远端数据时（哪怕已满分），prev 是 undefined，绝不会触发弹窗。
    if (prev === false && isMastered === true) {
      if (!masteredThemes.includes(theme)) {
        setShowMasteryOverlay(true);
        setMasteredThemes(prevThemes => [...prevThemes, theme]);
      }
    }

    // 无论如何，将当前的真实状态记录到状态机中
    prevMasteryStatusRef.current[theme] = isMastered;
  }, [masteryData, theme]);

  const showNotice = (anchor: 'review' | 'oral' | 'listen' | 'eval' | 'dashboard', text: string, tone: 'success' | 'error' | 'info') => {
    setNoticeAnchor(anchor);
    setInlineNotice({ text, tone });
    if (noticeTimeoutId.current) window.clearTimeout(noticeTimeoutId.current);
    noticeTimeoutId.current = window.setTimeout(() => {
      setInlineNotice(null);
      setNoticeAnchor(null);
    }, 4000);
  };

  const hideNotice = () => {
    setInlineNotice(null);
    setNoticeAnchor(null);
  };

  const [pronunciationNotes, setPronunciationNotes] = useState('');
  const [grammarNotes, setGrammarNotes] = useState('');

  const [dueWords, setDueWords] = useState<any[]>([]);
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [sentenceInput, setSentenceInput] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<{ feedback: string; quality: number } | null>(null);
  const [loadingDueWords, setLoadingDueWords] = useState(false);

  const [listenMaterialTheme, setListenMaterialTheme] = useState<string>('');
  const [listenMaterial, setListenMaterial] = useState('');
  const [listenAudioUrl, setListenAudioUrl] = useState<string | null>(null);
  const [isListenMaterialLoading, setIsListenMaterialLoading] = useState(false);
  const [isTextVisible, setIsTextVisible] = useState(false);
  const [isListenLoading, setIsListenLoading] = useState(false);
  const [listenResult, setListenResult] = useState<ComparisonResult | null>(null);
  const [listenInput, setListenInput] = useState('');
  const [longAudios, setLongAudios] = useState<LongAudio[]>([]);
  const [selectedLongAudioId, setSelectedLongAudioId] = useState<string | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState<number>(0);
  const [loopEnabled, setLoopEnabled] = useState<boolean>(false);
  const [longAudioMode, setLongAudioMode] = useState<boolean>(false);
  const [segmentDrafts, setSegmentDrafts] = useState<Record<number, string>>({});

  const [writingText, setWritingText] = useState('');
  const [writeIntent, setWriteIntent] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<any>(null);

  // Global Effects — mastery poll only while English shell is visible
  useEffect(() => {
    if (!englishShellActive) return undefined;

    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      checkThemeMastery(theme)
        .then((res) => {
          if (res.success) {
            setMasteryData({
              isMastered: true, /* 彻底解除限制，强制标记为已通关 */
              oralCount: res.oralCount,
              maxWriteScore: res.maxWriteScore,
              emailCompleted: res.emailCompleted,
              _isInitial: false,
            });
          }
        })
        .catch(() => {});
    };
    refresh();
    const id = window.setInterval(refresh, 45000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [theme, englishShellActive]);

  const STAY_STATS_TTL_MS = 60_000;
  const stayStatsCacheRef = useRef<{ theme: string; at: number; data: ThemeStayStats | null }>({
    theme: '',
    at: 0,
    data: null,
  });
  const stayStatsInflightRef = useRef<Promise<void> | null>(null);

  const refreshStayStats = useCallback(async (force = false) => {
    if (!theme) return;
    const now = Date.now();
    const cached = stayStatsCacheRef.current;
    if (
      !force
      && cached.theme === theme
      && cached.data
      && now - cached.at < STAY_STATS_TTL_MS
    ) {
      setStayStats(cached.data);
      return;
    }
    if (stayStatsInflightRef.current) {
      await stayStatsInflightRef.current;
      return;
    }
    const pending = (async () => {
      try {
        const data = await getThemeStayStats(theme);
        stayStatsCacheRef.current = { theme, at: Date.now(), data };
        setStayStats(data);
      } catch (err) {
        console.error('Failed to load theme stay stats:', err);
      }
    })().finally(() => {
      stayStatsInflightRef.current = null;
    });
    stayStatsInflightRef.current = pending;
    await pending;
  }, [theme]);

  const refreshTodaySession = useCallback(async () => {
    const td = localTrainingDate();
    try {
      const detail = await getTrainingSessionByDate({ trainingDate: td });
      setTodaySession(detail.session ?? null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshStayStats();
    }, 600);
    return () => clearTimeout(timer);
  }, [theme, refreshStayStats]);

  useEffect(() => {
    const handleUpdate = () => {
      void refreshStayStats(true);
    };
    window.addEventListener('vocab-updated', handleUpdate);
    return () => window.removeEventListener('vocab-updated', handleUpdate);
  }, [refreshStayStats]);

  useEffect(() => {
    let cancelled = false;
    const td = localTrainingDate();
    void (async () => {
      try {
        const up = await upsertTrainingSession({ trainingDate: td });
        if (cancelled) return;
        setSessionId(up.sessionId);
        const detail = await getTrainingSessionByDate({ trainingDate: td });
        const ex = detail.session?.extra_json;
        let parsed: Record<string, unknown> = {};
        try {
          parsed = typeof ex === 'string' ? JSON.parse(ex || '{}') : (ex || {});
        } catch { parsed = {}; }
        const ef = (parsed.englishFoundation as Record<string, unknown>) || {};
        if (cancelled) return;
        setTodaySession(detail.session ?? null);
        if (typeof ef.pronunciationNotes === 'string') setPronunciationNotes(ef.pronunciationNotes);
        if (typeof ef.grammarNotes === 'string') setGrammarNotes(ef.grammarNotes);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!sessionId) return undefined;
    const t = window.setTimeout(() => {
      void upsertTrainingSession({
        trainingDate: localTrainingDate(),
        extraJson: {
          englishFoundation: {
            pronunciationNotes,
            grammarNotes,
            lastSavedAt: Date.now(),
          },
        },
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [pronunciationNotes, grammarNotes, sessionId]);

  useEffect(() => {
    if (!themeHydratedRef.current) return;
    const timer = setTimeout(() => {
      void setThemeFocus({ theme }).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [theme]);

  const handleMarkEmailComplete = async (t: string) => {
    await markEmailComplete({ theme: t }).catch(() => {});
    const res = await checkThemeMastery(t).catch(() => null);
    if (res?.success) {
      setMasteryData(prev => ({
        ...prev,
        emailCompleted: res.emailCompleted,
        isMastered: res.isMastered,
      }));
    }
  };

  const themeValue = React.useMemo<ThemeCtxType>(() => ({
    stage, setStage,
    theme, setTheme,
    masteryData, setMasteryData,
    themeSwitchError, setThemeSwitchError,
    showMasteryOverlay, setShowMasteryOverlay,
    masteredThemes, setMasteredThemes,
    practicedThemes, setPracticedThemes,
    impromptuPassed, setImpromptuPassed,
    markEmailComplete: handleMarkEmailComplete,
    customThemes, setCustomThemes,
    refreshCustomThemes,
    pendingSentenceDebt, setPendingSentenceDebt,
  }), [
    stage, theme, masteryData, themeSwitchError, showMasteryOverlay,
    masteredThemes, practicedThemes, impromptuPassed, customThemes, pendingSentenceDebt
  ]);

  const vocabValue = React.useMemo<VocabCtxType>(() => ({
    vocabZone, setVocabZone,
    dueWords, setDueWords,
    currentWordIdx, setCurrentWordIdx,
    sentenceInput, setSentenceInput,
    isEvaluating, setIsEvaluating,
    evalResult, setEvalResult,
    loadingDueWords, setLoadingDueWords,
  }), [
    vocabZone, dueWords, currentWordIdx, sentenceInput,
    isEvaluating, evalResult, loadingDueWords
  ]);

  const mediaValue = React.useMemo<MediaCtxType>(() => ({
    listenMaterialTheme, setListenMaterialTheme,
    listenMaterial, setListenMaterial,
    listenAudioUrl, setListenAudioUrl,
    isListenMaterialLoading, setIsListenMaterialLoading,
    isTextVisible, setIsTextVisible,
    isListenLoading, setIsListenLoading,
    listenResult, setListenResult,
    listenInput, setListenInput,
    longAudios, setLongAudios,
    selectedLongAudioId, setSelectedLongAudioId,
    currentSegmentIndex, setCurrentSegmentIndex,
    loopEnabled, setLoopEnabled,
    longAudioMode, setLongAudioMode,
    segmentDrafts, setSegmentDrafts,
    writingText, setWritingText,
    writeIntent, setWriteIntent,
    isReviewing, setIsReviewing,
    reviewResult, setReviewResult,
  }), [
    listenMaterialTheme, listenMaterial, listenAudioUrl,
    isListenMaterialLoading, isTextVisible, isListenLoading,
    listenResult, listenInput, longAudios, selectedLongAudioId,
    currentSegmentIndex, loopEnabled, longAudioMode, segmentDrafts,
    writingText, writeIntent, isReviewing, reviewResult
  ]);

  const legacyValue = React.useMemo<EnglishContextType>(() => ({
    activeTab, setActiveTab,
    sessionId,
    todaySession,
    stayStats,
    refreshStayStats,
    refreshTodaySession,
    englishShellActive,
    setEnglishShellActive,
    inlineNotice, noticeAnchor, showNotice, hideNotice,
    pronunciationNotes, setPronunciationNotes,
    grammarNotes, setGrammarNotes,
    ...themeValue,
    ...vocabValue,
    ...mediaValue,
  }), [
    activeTab, sessionId, todaySession, stayStats, refreshStayStats, refreshTodaySession,
    englishShellActive, inlineNotice, noticeAnchor,
    pronunciationNotes, grammarNotes,
    themeValue, vocabValue, mediaValue
  ]);

  return (
    <ThemeCtx.Provider value={themeValue}>
      <VocabCtx.Provider value={vocabValue}>
        <MediaCtx.Provider value={mediaValue}>
          <EnglishContext.Provider value={legacyValue}>
            {children}
          </EnglishContext.Provider>
        </MediaCtx.Provider>
      </VocabCtx.Provider>
    </ThemeCtx.Provider>
  );
}

export function useEnglishContext() {
  const context = useContext(EnglishContext);
  if (context === undefined) {
    throw new Error('useEnglishContext must be used within an EnglishProvider');
  }
  return context;
}

export function useThemeMastery() {
  const context = useContext(ThemeCtx);
  if (context === undefined) {
    throw new Error('useThemeMastery must be used within an EnglishProvider');
  }
  return context;
}

export function useVocabState() {
  const context = useContext(VocabCtx);
  if (context === undefined) {
    throw new Error('useVocabState must be used within an EnglishProvider');
  }
  return context;
}

export function useMediaState() {
  const context = useContext(MediaCtx);
  if (context === undefined) {
    throw new Error('useMediaState must be used within an EnglishProvider');
  }
  return context;
}
