import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { submitBreakthrough, type ParsedAiResponse } from '../../../services/difyAPI';
import { checkThemeMastery } from '../../../services/trainingAPI';
import {
  playSuccess,
  playError,
  playSceneSwitch,
  playReveal,
} from '../../../utils/soundEffects';
import { getAppUserId } from '../../../utils/profileHelper';
import {
  getNextWeekPushPlan,
  applyDifficultyAdjustment,
  getRebalanceHintMessage,
  type TrainingRebalancePlan,
} from '../../../utils/reviewHelper';
import type {
  BreakthroughRecord,
  BreakthroughType,
  MessageItem,
  SceneEntry,
  SessionMemory,
  WeaknessLogEntry,
} from './types';
import { SCENE_DATABASE, THEME_TO_SCENE_MAP } from './scenes';
import {
  applyCustomBackground,
  buildDailyScene,
  DAILY_SCENE_ID,
  shouldShowNegotiationControls,
  type SandboxMode,
} from './sandboxMode';
import {
  prepareDailyExpressionReviewRequest,
  requestExpressionReview,
  type ExpressionReview,
} from './expressionReview';
import {
  getSpeakerStyle,
  safeText,
  parseBranchList,
  getScenePartyCount,
  saveWriteContext,
} from './utils';
import { useOralTextSelection } from './useOralTextSelection';
import { useOralRecording } from './useOralRecording';
import { processOralAiResponse } from './processOralAiResponse';
import { useOralDialogue } from './useOralDialogue';

export interface UseOralWarRoomSessionOptions {
  embedded?: boolean;
  active?: boolean;
  sceneTheme?: string;
  sessionId?: string | null;
  userId?: string;
  onOralRoundLogged?: () => void;
  onNavigateWrite?: () => void;
}

export function useOralWarRoomSession({
  embedded = false,
  active = true,
  sceneTheme = '',
  sessionId = null,
  userId = getAppUserId(),
  onOralRoundLogged,
  onNavigateWrite,
}: UseOralWarRoomSessionOptions) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lastNotice, setLastNotice] = useState('练习已就绪，AI 角色即将开场。');
  const bottomRef = useRef<HTMLDivElement>(null);

  const [combatPoints, setCombatPoints] = useState(() => Number(localStorage.getItem('oral_combat_points') || '0'));
  const [showGoldGlow, setShowGoldGlow] = useState(false);
  const [isLoopholePlanted, setIsLoopholePlanted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [briefCollapsed, setBriefCollapsed] = useState(true);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  const [activeTierFilter, setActiveTierFilter] = useState<'全部' | '初阶' | '高阶' | '跨文化' | '定制'>('全部');
  const [activeLevelFilter, setActiveLevelFilter] = useState<'全部' | '4' | '5'>('全部');
  const [activeRoleCountFilter, setActiveRoleCountFilter] = useState<'全部' | '三方' | '四方+'>('全部');
  const [sceneTransitionKey, setSceneTransitionKey] = useState(0);
  const [showIntelDetails, setShowIntelDetails] = useState(false);
  const [latestFeedback, setLatestFeedback] = useState<ParsedAiResponse | null>(null);
  const [flawTemplates, setFlawTemplates] = useState<string[]>([]);
  const [currentFlawType, setCurrentFlawType] = useState('');
  const [currentFlawClaim, setCurrentFlawClaim] = useState('');
  const [currentDifficulty, setCurrentDifficulty] = useState<number | null>(null);
  const sceneInitRef = useRef<string | null>(null);
  const openingAbortRef = useRef<AbortController | null>(null);
  const [showControlCard, setShowControlCard] = useState(false);
  const [isInputLocked, setIsInputLocked] = useState(false);
  const [writeCompleted, setWriteCompleted] = useState(false);

  const [currentTarget, setCurrentTarget] = useState('');
  const [breakthroughRecords, setBreakthroughRecords] = useState<BreakthroughRecord[]>([]);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [activeContextTab, setActiveContextTab] = useState<'relations' | 'breakthroughs' | 'notes'>('relations');
  const [sessionNotes, setSessionNotes] = useState('');
  const [improvElapsed, setImprovElapsed] = useState(0);
  const [improvActive, setImprovActive] = useState(false);
  const [sandboxMode, setSandboxMode] = useState<SandboxMode>('negotiation');
  const [expressionReview, setExpressionReview] = useState<ExpressionReview | null>(null);
  const [expressionReviewStatus, setExpressionReviewStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [expressionReviewError, setExpressionReviewError] = useState<string | null>(null);
  const [customBackground, setCustomBackground] = useState('');
  const [customBackgroundEnabled, setCustomBackgroundEnabled] = useState(false);
  const [sessionMemory, setSessionMemory] = useState<SessionMemory>(() => {
    try {
      const saved = localStorage.getItem('superme_session_memory');
      return saved ? JSON.parse(saved) : {
        weaknesses: [],
        lastSceneId: '',
        oralCount: 0,
        avgLogicScore: 0,
        avgCulturalScore: 0,
      };
    } catch {
      return { weaknesses: [], lastSceneId: '', oralCount: 0, avgLogicScore: 0, avgCulturalScore: 0 };
    }
  });

  useEffect(() => {
    localStorage.setItem('superme_session_memory', JSON.stringify(sessionMemory));
  }, [sessionMemory]);

  useEffect(() => {
    if (!sceneTheme) return;
    checkThemeMastery(sceneTheme, userId)
      .then((res) => {
        if (res.success) {
          setWriteCompleted(res.emailCompleted || res.maxWriteScore >= 8);
        }
      })
      .catch(() => {});
  }, [sceneTheme, userId]);

  const appendWeaknessToMemory = useCallback((flaw: string) => {
    const trimmed = flaw.trim();
    if (!trimmed || trimmed === '未识别到破绽') return;
    setSessionMemory((prev) => {
      if (prev.weaknesses.includes(trimmed)) return prev;
      return { ...prev, weaknesses: [...prev.weaknesses, trimmed].slice(-20) };
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('oral_combat_points', String(combatPoints));
  }, [combatPoints]);

  const [weaknessLog, setWeaknessLog] = useState<WeaknessLogEntry[]>(() => {
    try {
      const logs = localStorage.getItem('user_weakness_log');
      return logs ? JSON.parse(logs) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleXpUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.xp === 'number') {
        setCombatPoints(customEvent.detail.xp);
      }
    };
    window.addEventListener('xp-updated', handleXpUpdated);
    return () => window.removeEventListener('xp-updated', handleXpUpdated);
  }, []);

  useEffect(() => {
    const handleWeaknessUpdated = () => {
      try {
        const logs = localStorage.getItem('user_weakness_log');
        if (logs) setWeaknessLog(JSON.parse(logs));
      } catch { /* ignore */ }
    };
    window.addEventListener('weakness-updated', handleWeaknessUpdated);
    return () => window.removeEventListener('weakness-updated', handleWeaknessUpdated);
  }, []);

  const [activeSceneId, setActiveSceneId] = useState(() => {
    if (embedded && sceneTheme) {
      return THEME_TO_SCENE_MAP[sceneTheme] || 'dynamic-scene';
    }
    return 'scene-1';
  });

  const [rebalancePush, setRebalancePush] = useState<TrainingRebalancePlan | null>(() => getNextWeekPushPlan());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TrainingRebalancePlan>).detail;
      const plan = detail || getNextWeekPushPlan();
      setRebalancePush(plan);
      if (plan?.oralSandbox?.scenario) {
        setActiveSceneId('rebalance-scene');
        setMessages([]);
        setConversationId(null);
        setLastNotice(`🔄 ${getRebalanceHintMessage()}`);
      }
    };
    window.addEventListener('global-training-rebalance', handler);
    return () => window.removeEventListener('global-training-rebalance', handler);
  }, []);

  useEffect(() => {
    if (rebalancePush?.oralSandbox?.scenario && activeSceneId === 'scene-1' && !embedded) {
      setActiveSceneId('rebalance-scene');
    }
  }, [rebalancePush, activeSceneId, embedded]);

  const activeScene = useMemo((): SceneEntry => {
    if (sandboxMode === 'daily' || activeSceneId === DAILY_SCENE_ID) {
      return applyCustomBackground(buildDailyScene(customBackground), customBackground, 'daily');
    }
    const pushScene = rebalancePush?.oralSandbox;
    let base: SceneEntry | undefined;
    if (activeSceneId === 'rebalance-scene' && pushScene?.scenario) {
      const baseLevel = pushScene.difficulty || 5;
      base = {
        id: 'rebalance-scene',
        title: pushScene.scenario,
        shortTitle: pushScene.scenario.slice(0, 24),
        tier: '定制',
        level: applyDifficultyAdjustment(baseLevel, 'oralSandbox') as 4 | 5,
        desc: pushScene.focus || pushScene.scenario,
        roleList: pushScene.roles || '我 + 业务助攻 + 施压方 + 关键决策人',
        allies: [{ name: '业务助攻', label: '盟友', desc: '配合推进议程' }],
        blockers: [{ name: '施压方', label: '阻力', desc: '抛出尖锐质询' }],
        neutrals: [{ name: '关键决策人', label: '中立', desc: '观察临场表现' }],
        conflicts: [pushScene.focus || pushScene.scenario],
        culturalContext: '心智投喂重组场景：聚焦本周投喂的核心博弈议题。',
        openingLine: 'Based on your recent strategic focus, let us address the core tension directly. What is your opening position?',
      };
    } else if (activeSceneId === 'dynamic-scene') {
      base = {
        id: 'dynamic-scene',
        title: `当前场景：${sceneTheme}`,
        shortTitle: sceneTheme.split('：')[1] || sceneTheme,
        tier: '高阶',
        level: 4,
        desc: `围绕主题【${sceneTheme}】进行口语练习。`,
        roleList: `我 + 业务助攻 + 施压方 + 关键决策人`,
        allies: [{ name: '业务助攻', label: '盟友', desc: '尝试推进流程' }],
        blockers: [{ name: '施压方', label: '阻力', desc: '抛出尖锐问题' }],
        neutrals: [{ name: '关键决策人', label: '中立', desc: '观察您的表现' }],
        conflicts: [sceneTheme.split('：')[0] || sceneTheme],
        culturalContext: '根据当前跨文化主题，精准把握商务分寸与情感张力。',
        openingLine: 'We need to address the core issue before this meeting runs over time. What is your position?',
      };
    } else {
      base = SCENE_DATABASE.find(s => s.id === activeSceneId);
    }
    const scene = base ?? SCENE_DATABASE[0];
    return customBackgroundEnabled
      ? applyCustomBackground(scene, customBackground, 'negotiation')
      : scene;
  }, [activeSceneId, sceneTheme, rebalancePush, sandboxMode, customBackground, customBackgroundEnabled]);

  const {
    breakthroughMenu,
    setBreakthroughMenu,
    highlightedWord,
    highlightPos,
    isAddingWord,
    addWordResult,
    handleDialogueMouseUp,
    handleAddHighlightedWord,
    dismissVocabPopup,
  } = useOralTextSelection(activeScene, activeSceneId, sceneTheme);

  const handleSendWithTextRef = useRef<(text: string) => void>(() => {});
  const {
    isRecording,
    recordingTime,
    speechSupported,
    speechChecked,
    micError,
    startRecording,
    stopRecordingAndSend,
    clearPendingText,
  } = useOralRecording(isSending, setInputText, (text) => handleSendWithTextRef.current(text));

  const processAiResponse = useCallback((parsed: ParsedAiResponse | null, content: string, wasLoopholeActive: boolean) => {
    return processOralAiResponse({
      activeSceneTitle: activeScene.title,
      flawTemplates,
      appendWeaknessToMemory,
      setCurrentDifficulty,
      setLatestFeedback,
      setFeedbackExpanded,
      setCombatPoints,
      setWeaknessLog,
      setShowGoldGlow,
      setShowConfetti,
      setLastNotice,
      setFlawTemplates,
      setCurrentFlawType,
      setCurrentFlawClaim,
      setShowControlCard,
      setIsInputLocked,
      setIsLoopholePlanted,
      ignoreFlaws: sandboxMode === 'daily',
    }, parsed, content, wasLoopholeActive);
  }, [activeScene.title, flawTemplates, appendWeaknessToMemory, sandboxMode]);

  const { initiateSceneDialogue, handleSendWithText, handleSend } = useOralDialogue({
    userId,
    sessionId,
    sceneTheme,
    activeScene,
    activeSceneId,
    messages,
    setMessages,
    isSending,
    setIsSending,
    conversationId,
    setConversationId,
    isInputLocked,
    currentTarget,
    setCurrentTarget,
    isLoopholePlanted,
    improvActive,
    setImprovActive,
    setImprovElapsed,
    sessionMemory,
    setSessionMemory,
    setLastNotice,
    setCurrentDifficulty,
    setInputText,
    inputText,
    clearPendingText,
    processAiResponse,
    onOralRoundLogged,
    bottomRef,
    sandboxMode,
    customBackground: customBackgroundEnabled || sandboxMode === 'daily' ? customBackground : '',
    openingAbortRef,
  });

  handleSendWithTextRef.current = handleSendWithText;

  useEffect(() => {
    const notesKey = `superme_session_notes_${activeSceneId}`;
    setSessionNotes(localStorage.getItem(notesKey) || '');
  }, [activeSceneId]);

  useEffect(() => {
    if (embedded && sceneTheme) {
      const nextId = THEME_TO_SCENE_MAP[sceneTheme] || 'dynamic-scene';
      if (nextId !== activeSceneId) {
        setActiveSceneId(nextId);
        setMessages([]);
        setConversationId(null);
        setIsLoopholePlanted(false);
        setLastNotice(`已切换练习场景。进入：${sceneTheme}`);
      }
    }
  }, [embedded, sceneTheme, activeSceneId]);

  const resetBattleState = useCallback((sceneId: string) => {
    playSceneSwitch();
    setActiveSceneId(sceneId);
    setSceneTransitionKey(k => k + 1);
    setMessages([]);
    setConversationId(null);
    setIsLoopholePlanted(false);
    setFlawTemplates([]);
    setCurrentFlawType('');
    setCurrentFlawClaim('');
    setLatestFeedback(null);
    setFeedbackExpanded(false);
    setCurrentDifficulty(null);
    setBreakthroughRecords([]);
    setBreakthroughMenu(null);
    setCurrentTarget('');
    setImprovElapsed(0);
    setImprovActive(false);
    setShowControlCard(false);
    setIsInputLocked(false);
    setExpressionReview(null);
    setExpressionReviewStatus('idle');
    setExpressionReviewError(null);
    setSessionMemory(prev => ({
      ...prev,
      lastSceneId: sceneId === DAILY_SCENE_ID ? prev.lastSceneId : sceneId,
    }));
    sceneInitRef.current = sceneId;
  }, [setBreakthroughMenu]);

  const handleEndDailyExpressionReview = useCallback(async () => {
    const prepared = prepareDailyExpressionReviewRequest(sandboxMode, messages);
    if (!prepared) return;
    setExpressionReviewStatus('loading');
    setExpressionReviewError(null);
    setLastNotice('正在生成表达复盘…');
    try {
      const result = await requestExpressionReview(prepared.utterances, userId || getAppUserId());
      if (result.status === 'parse_miss') {
        setExpressionReview(null);
        setExpressionReviewStatus('error');
        setExpressionReviewError('复盘结果格式不符，请重试结束并复盘');
        setLastNotice('⚠️ 复盘结果格式不符，请重试');
        return;
      }
      setExpressionReview(result.review);
      setExpressionReviewStatus('ready');
      setIsInputLocked(true);
      setLastNotice(result.review.issues.length
        ? `表达复盘完成：共 ${result.review.issues.length} 条疏漏/样例`
        : '表达复盘完成：本场未检出明显疏漏');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '表达复盘失败';
      setExpressionReviewStatus('error');
      setExpressionReviewError(msg);
      setLastNotice(`⚠️ ${msg}`);
    }
  }, [sandboxMode, messages, userId, setIsInputLocked]);

  const handleSceneSelect = (sceneId: string) => {
    const scene = SCENE_DATABASE.find(s => s.id === sceneId);
    if (!scene) return;
    if (sandboxMode === 'daily') setSandboxMode('negotiation');
    resetBattleState(sceneId);
    setLastNotice(`已重置练习场景。进入：${scene.shortTitle}`);
    void initiateSceneDialogue(scene, 'negotiation');
  };

  const handleSandboxModeChange = (mode: SandboxMode) => {
    if (mode === sandboxMode) return;
    setSandboxMode(mode);
    if (mode === 'daily') setCustomBackgroundEnabled(true);
    if (mode === 'daily') {
      const scene = applyCustomBackground(buildDailyScene(customBackground), customBackground, 'daily');
      resetBattleState(DAILY_SCENE_ID);
      setLastNotice('已切换至日常演练。可填写自定义背景后继续对话。');
      void initiateSceneDialogue(scene, 'daily');
      return;
    }
    const fallbackId = sessionMemory.lastSceneId && sessionMemory.lastSceneId !== DAILY_SCENE_ID
      ? sessionMemory.lastSceneId
      : 'scene-1';
    const scene = SCENE_DATABASE.find(s => s.id === fallbackId) || SCENE_DATABASE[0];
    resetBattleState(scene.id);
    setLastNotice(`已切换至谈判练习。进入：${scene.shortTitle}`);
    void initiateSceneDialogue(scene, 'negotiation');
  };

  const handleBreakthroughSubmit = useCallback(async (type: BreakthroughType, selectedText: string, messageId: string) => {
    const targetMsg = messages.find(m => m.id === messageId);
    const flawPoint = safeText(targetMsg?.parsed?.flaw_point);
    const result = await submitBreakthrough(messageId, type, selectedText, {
      conversationId,
      flawPoint,
      sceneTitle: activeScene.shortTitle,
    });

    const record: BreakthroughRecord = {
      id: `bt-${Date.now()}`,
      text: selectedText,
      type,
      correct: result.correct,
      timestamp: Date.now(),
      messageId,
    };
    setBreakthroughRecords(prev => [...prev, record]);
    setBreakthroughMenu(null);
    window.getSelection()?.removeAllRanges();

    if (result.correct) {
      setCombatPoints(prev => prev + 30);
      playSuccess();
      setLastNotice('漏洞标记正确！+30 XP。请用英语发起针对性提问。');
      setIsLoopholePlanted(true);
      setShowControlCard(false);
      setIsInputLocked(false);
      setActiveContextTab('breakthroughs');
      if (!isContextPanelOpen) {
        playReveal();
        setIsContextPanelOpen(true);
      }
    } else {
      playError();
      setLastNotice(result.feedback || '漏洞类型不匹配，请重新划词标记。');
    }
  }, [messages, conversationId, activeScene.shortTitle, isContextPanelOpen]);

  const sceneRoleSwitcherItems = useMemo(() => {
    return [...activeScene.allies, ...activeScene.blockers, ...activeScene.neutrals].map(r => ({
      name: r.name,
      label: r.label,
      desc: r.desc,
      avatarColor: r.label.includes('盟') || r.label.includes('友')
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : r.label.includes('阻') || r.label.includes('敌')
          ? 'bg-red-100 text-red-700 border-red-200'
          : 'bg-slate-100 text-slate-600 border-slate-200',
    }));
  }, [activeScene]);

  const handleTargetChange = useCallback((roleName: string) => {
    setCurrentTarget(roleName);
    if (roleName) {
      setInputText(prev => {
        const stripped = prev.replace(/^@\S+\s*/, '');
        return `@${roleName} ${stripped}`.trimEnd() + (stripped ? ' ' : ' ');
      });
    }
  }, []);

  useEffect(() => {
    if (active === false) openingAbortRef.current?.abort();
  }, [active]);

  useEffect(() => {
    if (active === false) return;
    if (sceneInitRef.current === activeSceneId) return;
    sceneInitRef.current = activeSceneId;
    void initiateSceneDialogue(activeScene);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSceneId, active]);

  const handleRetryOpening = useCallback(() => {
    sceneInitRef.current = activeSceneId;
    void initiateSceneDialogue(activeScene, undefined, { backfill: true });
  }, [activeSceneId, activeScene, initiateSceneDialogue]);

  const latestExchange = useMemo(() => {
    const aiMessages = messages.filter(m => m.role === 'ai');
    const userMessages = messages.filter(m => m.role === 'user');
    const lastAi = aiMessages[aiMessages.length - 1];
    const lastUser = userMessages[userMessages.length - 1];
    const lastParsed = lastAi?.parsed ?? null;
    const jointPressure = lastParsed ? safeText(lastParsed.joint_pressure) : '';
    const hiddenIntent = lastParsed ? safeText(lastParsed.hidden_intent) : '';
    const branchSuggestions = lastParsed ? parseBranchList(lastParsed.branch_suggestions) : [];
    const culturalSignal = lastParsed ? safeText(lastParsed.cultural_signal) : '';
    const aiSpeaker = lastParsed ? safeText(lastParsed.current_speaker) : '';
    const speakerStyle = aiSpeaker ? getSpeakerStyle(aiSpeaker, activeScene) : 'neutral';
    const isAllyAssist = speakerStyle === 'ally' && /协助|support|hint|暗中|backing|cover|nudge|signal/i.test(hiddenIntent);
    const stanceHistory = aiMessages
      .filter(m => m.parsed?.role_address)
      .map(m => ({
        speaker: safeText(m.parsed?.current_speaker),
        address: safeText(m.parsed?.role_address),
      }))
      .slice(-4);
    return {
      aiDialogue: lastParsed ? safeText(lastParsed.dialogue) : '',
      aiSpeaker,
      roleAddress: lastParsed ? safeText(lastParsed.role_address) : '',
      userText: lastUser?.content || '',
      turnCount: messages.length,
      jointPressure,
      hiddenIntent,
      branchSuggestions,
      culturalSignal,
      speakerStyle,
      isAllyAssist,
      stanceHistory,
      isOpeningTurn: aiMessages.length <= 1 && !lastUser,
    };
  }, [messages, activeScene]);

  const filteredScenes = useMemo(() => {
    return SCENE_DATABASE.filter(s => {
      if (activeTierFilter !== '全部' && s.tier !== activeTierFilter) return false;
      if (activeLevelFilter !== '全部' && s.level !== Number(activeLevelFilter)) return false;
      const partyCount = getScenePartyCount(s);
      if (activeRoleCountFilter === '三方' && partyCount !== 3) return false;
      if (activeRoleCountFilter === '四方+' && partyCount < 4) return false;
      return true;
    });
  }, [activeTierFilter, activeLevelFilter, activeRoleCountFilter]);

  const sceneDifficultyStats = useMemo(() => {
    const base = SCENE_DATABASE.filter(s => activeTierFilter === '全部' || s.tier === activeTierFilter);
    const level4 = base.filter(s => s.level === 4).length;
    const level5 = base.filter(s => s.level === 5).length;
    const total = level4 + level5 || 1;
    return { level4, level5, total, level4Pct: Math.round((level4 / total) * 100), level5Pct: Math.round((level5 / total) * 100) };
  }, [activeTierFilter]);

  const handleNavigateWrite = useCallback(() => {
    saveWriteContext({
      sceneId: activeSceneId,
      sceneTitle: activeScene.shortTitle,
      theme: sceneTheme,
      conflicts: activeScene.conflicts,
      culturalContext: activeScene.culturalContext,
    });
    onNavigateWrite?.();
  }, [activeSceneId, activeScene, sceneTheme, onNavigateWrite]);

  return {
    embedded,
    showConfetti,
    setShowConfetti,
    activeTierFilter,
    setActiveTierFilter,
    activeLevelFilter,
    setActiveLevelFilter,
    activeRoleCountFilter,
    setActiveRoleCountFilter,
    filteredScenes,
    sceneDifficultyStats,
    sceneTransitionKey,
    isContextPanelOpen,
    setIsContextPanelOpen,
    activeScene,
    activeSceneId,
    currentDifficulty,
    latestExchange,
    latestFeedback,
    handleSceneSelect,
    handleRetryOpening,
    sandboxMode,
    handleSandboxModeChange,
    handleEndDailyExpressionReview,
    expressionReview,
    expressionReviewStatus,
    expressionReviewError,
    showDailyExpressionDebrief: sandboxMode === 'daily',
    customBackground,
    setCustomBackground,
    customBackgroundEnabled,
    setCustomBackgroundEnabled,
    showNegotiationControls: shouldShowNegotiationControls(sandboxMode),
    improvElapsed,
    improvActive,
    setImprovElapsed,
    setImprovActive,
    messages,
    briefCollapsed,
    setBriefCollapsed,
    showIntelDetails,
    setShowIntelDetails,
    showGoldGlow,
    combatPoints,
    writeCompleted,
    handleDialogueMouseUp,
    weaknessLog,
    bottomRef,
    feedbackExpanded,
    setFeedbackExpanded,
    setInputText,
    lastNotice,
    isLoopholePlanted,
    currentFlawType,
    currentFlawClaim,
    flawTemplates,
    showControlCard: sandboxMode === 'daily' ? false : showControlCard,
    setShowControlCard,
    setIsInputLocked,
    sceneRoleSwitcherItems,
    currentTarget,
    handleTargetChange,
    isRecording,
    recordingTime,
    inputText,
    handleSend,
    isInputLocked,
    speechSupported,
    speechChecked,
    micError,
    startRecording,
    stopRecordingAndSend,
    handleNavigateWrite,
    breakthroughRecords,
    sessionNotes,
    setSessionNotes,
    activeContextTab,
    setActiveContextTab,
    highlightedWord,
    highlightPos,
    isAddingWord,
    addWordResult,
    handleAddHighlightedWord,
    breakthroughMenu,
    setBreakthroughMenu,
    handleBreakthroughSubmit,
    isSending,
    dismissVocabPopup,
  };
}
