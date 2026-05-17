import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { checkThemeMastery, getTrainingSessionByDate, upsertTrainingSession, setThemeFocus } from '../../../../services/trainingAPI';
import { runWordEnrichment } from '../../../../services/difyAPI';
import { ComparisonResult } from '../../../../types/listening';

export type EnglishTab = 'dashboard' | 'vocab' | 'listen' | 'oral' | 'write';

export const BUSINESS_THEMES = [
  { value: '商务谈判：让步与施压', label: '商务谈判：让步与施压 (Day 4/10)' },
  { value: '危机公关：外媒答疑', label: '危机公关：外媒答疑 (Day 1/10)' },
  { value: '项目汇报：跨国董事会', label: '项目汇报：跨国董事会 (Day 1/10)' },
];

export const GENERAL_THEMES = [
  { value: '跨文化社交：艺术展交流', label: '跨文化社交：艺术展交流 (Day 1/7)' },
  { value: '应急沟通：海外就医', label: '应急沟通：海外就医 (Day 1/7)' },
  { value: '文化破冰：外企晚宴', label: '文化破冰：外企晚宴 (Day 1/7)' },
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
  masteryData: { isMastered: boolean; oralCount: number; maxWriteScore: number };
  setMasteryData: React.Dispatch<React.SetStateAction<{ isMastered: boolean; oralCount: number; maxWriteScore: number }>>;
  themeSwitchError: string | null;
  setThemeSwitchError: React.Dispatch<React.SetStateAction<string | null>>;
  sessionId: string | null;
  inlineNotice: { text: string; tone: 'success' | 'error' | 'info' } | null;
  noticeAnchor: 'review' | 'oral' | 'listen' | 'eval' | 'dashboard' | null;
  showNotice: (anchor: 'review' | 'oral' | 'listen' | 'eval' | 'dashboard', text: string, tone: 'success' | 'error' | 'info') => void;
  hideNotice: () => void;
  showMasteryOverlay: boolean;
  setShowMasteryOverlay: React.Dispatch<React.SetStateAction<boolean>>;

  // Dashboard
  pronunciationNotes: string;
  setPronunciationNotes: React.Dispatch<React.SetStateAction<string>>;
  grammarNotes: string;
  setGrammarNotes: React.Dispatch<React.SetStateAction<string>>;

  // Vocab
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
  const [stage, setStage] = useState<'0-6' | '6-12'>('0-6');
  const [theme, setTheme] = useState(BUSINESS_THEMES[0].value);
  const [masteryData, setMasteryData] = useState({ isMastered: false, oralCount: 0, maxWriteScore: 0 });
  const [themeSwitchError, setThemeSwitchError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const [inlineNotice, setInlineNotice] = useState<{ text: string; tone: 'success' | 'error' | 'info' } | null>(null);
  const [noticeAnchor, setNoticeAnchor] = useState<'review' | 'oral' | 'listen' | 'eval' | 'dashboard' | null>(null);
  const noticeTimeoutId = useRef<number | null>(null);

  const [showMasteryOverlay, setShowMasteryOverlay] = useState(false);

  useEffect(() => {
    const isMastered = masteryData.oralCount >= 10 && masteryData.maxWriteScore >= 8;
    const storageKey = `super_agent_mastered_overlay_${theme}`;
    if (isMastered && !localStorage.getItem(storageKey)) {
      setShowMasteryOverlay(true);
      localStorage.setItem(storageKey, '1');
    }
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
        pronunciationNotes, setPronunciationNotes,
        grammarNotes, setGrammarNotes,
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
