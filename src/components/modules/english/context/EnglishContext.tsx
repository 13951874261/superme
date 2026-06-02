import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { checkThemeMastery, getTrainingSessionByDate, upsertTrainingSession, setThemeFocus, markEmailComplete } from '../../../../services/trainingAPI';
import { runWordEnrichment } from '../../../../services/difyAPI';
import { ComparisonResult } from '../../../../types/listening';

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

export const getThemeOptions = (stage: '0-6' | '6-12') => stage === '0-6' ? BUSINESS_THEMES : GENERAL_THEMES;

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
  stage: '0-6' | '6-12';
  setStage: React.Dispatch<React.SetStateAction<'0-6' | '6-12'>>;
  theme: string;
  setTheme: React.Dispatch<React.SetStateAction<string>>;
  masteryData: { isMastered: boolean; oralCount: number; maxWriteScore: number; emailCompleted: boolean; _isInitial?: boolean };
  setMasteryData: React.Dispatch<React.SetStateAction<{ isMastered: boolean; oralCount: number; maxWriteScore: number; emailCompleted: boolean; _isInitial?: boolean }>>;
  themeSwitchError: string | null;
  setThemeSwitchError: React.Dispatch<React.SetStateAction<string | null>>;
  sessionId: string | null;
  inlineNotice: { text: string; tone: 'success' | 'error' | 'info' } | null;
  noticeAnchor: 'review' | 'oral' | 'listen' | 'eval' | 'dashboard' | null;
  showNotice: (anchor: 'review' | 'oral' | 'listen' | 'eval' | 'dashboard', text: string, tone: 'success' | 'error' | 'info') => void;
  hideNotice: () => void;
  showMasteryOverlay: boolean;
  setShowMasteryOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  masteredThemes: string[];
  setMasteredThemes: React.Dispatch<React.SetStateAction<string[]>>;
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

  // Write
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

export function EnglishProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<EnglishTab>('dashboard');
  const [stage, setStage] = useState<'0-6' | '6-12'>(() => {
    return (localStorage.getItem('english_stage') as '0-6' | '6-12') || '0-6';
  });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('english_theme') || BUSINESS_THEMES[0].value;
  });
  const [masteryData, setMasteryData] = useState({ isMastered: false, oralCount: 0, maxWriteScore: 0, emailCompleted: false, _isInitial: true });
  const [themeSwitchError, setThemeSwitchError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('english_stage', stage);
  }, [stage]);

  useEffect(() => {
    localStorage.setItem('english_theme', theme);
  }, [theme]);

  
  const [inlineNotice, setInlineNotice] = useState<{ text: string; tone: 'success' | 'error' | 'info' } | null>(null);
  const [noticeAnchor, setNoticeAnchor] = useState<'review' | 'oral' | 'listen' | 'eval' | 'dashboard' | null>(null);
  const noticeTimeoutId = useRef<number | null>(null);

  const [showMasteryOverlay, setShowMasteryOverlay] = useState(false);
  const [masteredThemes, setMasteredThemes] = useState<string[]>([]);
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

  const [writingText, setWritingText] = useState('');
  const [writeIntent, setWriteIntent] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<any>(null);

  // Global Effects
  useEffect(() => {
    const refresh = () => {
      checkThemeMastery(theme)
        .then((res) => {
          if (res.success) {
            setMasteryData({
              isMastered: res.isMastered,
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
    return () => clearInterval(id);
  }, [theme]);

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
    void setThemeFocus({ theme }).catch(() => {});
  }, []);

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

  return (
    <EnglishContext.Provider
      value={{
        activeTab, setActiveTab,
        stage, setStage,
        theme, setTheme,
        masteryData, setMasteryData,
        themeSwitchError, setThemeSwitchError,
        sessionId,
        inlineNotice, noticeAnchor, showNotice, hideNotice,
        showMasteryOverlay, setShowMasteryOverlay,
        masteredThemes, setMasteredThemes,
        impromptuPassed, setImpromptuPassed,
        markEmailComplete: handleMarkEmailComplete,
        pronunciationNotes, setPronunciationNotes,
        grammarNotes, setGrammarNotes,
        vocabZone, setVocabZone,
        dueWords, setDueWords,
        currentWordIdx, setCurrentWordIdx,
        sentenceInput, setSentenceInput,
        isEvaluating, setIsEvaluating,
        evalResult, setEvalResult,
        loadingDueWords, setLoadingDueWords,
        listenMaterialTheme, setListenMaterialTheme,
        listenMaterial, setListenMaterial,
        listenAudioUrl, setListenAudioUrl,
        isListenMaterialLoading, setIsListenMaterialLoading,
        isTextVisible, setIsTextVisible,
        isListenLoading, setIsListenLoading,
        listenResult, setListenResult,
        listenInput, setListenInput,
        writingText, setWritingText,
        writeIntent, setWriteIntent,
        isReviewing, setIsReviewing,
        reviewResult, setReviewResult,
      }}
    >
      {children}
    </EnglishContext.Provider>
  );
}

export function useEnglishContext() {
  const context = useContext(EnglishContext);
  if (context === undefined) {
    throw new Error('useEnglishContext must be used within an EnglishProvider');
  }
  return context;
}
