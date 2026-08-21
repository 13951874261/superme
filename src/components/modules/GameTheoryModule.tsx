import React, { useState, useEffect, useRef, startTransition } from 'react';
import { 
  Brain, Swords, ShieldAlert, Zap, Loader2, Sparkles, Plus, Trash2, 
  Layers, AlertCircle, CheckCircle, HelpCircle, Trophy, UserCheck, Flame, Compass, X, BookOpen, Users,
  ChevronDown, History, Upload, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ModuleWrapper from './ModuleWrapper';
import { playClick, playPageTurn, playGentleWarning } from '../../utils/soundEffects';
import { 
  runGameTheoryAnalysis, 
  getPersonalPrototypes, 
  upsertPersonalPrototype, 
  deletePersonalPrototype,
  GameTheoryAnalyzeInput, 
  PersonalPrototype,
  runCognitiveAscension,
  CognitiveAscensionResult,
  getGameTheoryHistory,
  getGameTheoryHistoryDetail,
  GameTheoryHistoryItem,
  TacticItem,
  pushGameTheoryCase,
} from '../../services/difyAPI';
import TacticsPanel from './GameTheory/TacticsPanel';
import GameTheorySessionPanel from './GameTheory/GameTheorySessionPanel';
import ToneCorrectionTable from './GameTheory/ToneCorrectionTable';
import { getNextWeekPushPlan, type TrainingRebalancePlan } from '../../utils/reviewHelper';
import { getAppUserId } from '../../utils/profileHelper';
import { useTask } from '../TaskContext';
import { notifyBackgroundHandoff } from '../../utils/backgroundHandoff';
import { consumeGameTheorySessionFocus, GT_NAV_SESSION_EVENT } from '../../utils/gtFocusTab';
import { evaluateCasePushQuality } from '../../utils/gtCaseQuality';

function knowledgeTaskLogs(reminder?: string): string[] {
  return reminder
    ? [reminder, '任务已提交，请在任务中心查看进度']
    : ['任务已提交，请在任务中心查看进度'];
}

// 预设高维博弈案例库
interface PresetCase {
  id: string;
  title: string;
  env: 'gov_struggle' | 'corp_clash' | 'upward_takeover';
  model: 'prisoner_dilemma' | 'pig_game' | 'info_asymmetry' | 'cold_trigger';
  description: string;
  defaultTactics: string[];
}

const PRESET_CASES: PresetCase[] = [
  {
    id: 'gov-1',
    title: '被稀释权力的常务副局长',
    env: 'gov_struggle',
    model: 'prisoner_dilemma',
    description: '前任局长调离后，新局长空降并带了心腹入驻。你在局里任常务副局长，分管核心的人事与财务。新局长通过多次临时扩大会议，试图将你分管的人事决定权稀释给分管副局长（他的心腹），以此将你架空。下周一将召开班子会议讨论财务和干部任命。',
    defaultTactics: ['制衡术', '软对抗']
  },
  {
    id: 'gov-2',
    title: '派系夹缝中的合规审查',
    env: 'gov_struggle',
    model: 'info_asymmetry',
    description: '你分管合规与风控部门，两位实力雄厚的副总经理（派系首脑A与B）在重大项目审批上发生严重冲突。A副总向你施压要求立刻通过审批，B副总暗示该项目存在财务合规漏洞，通过将面临审计责任。若你站队任何一方都将成为牺牲品。',
    defaultTactics: ['制衡术', '信息垄断']
  },
  {
    id: 'corp-1',
    title: '甩锅大区VP的会场狙击',
    env: 'corp_clash',
    model: 'pig_game',
    description: '跨国区域VP在明知道供应链延迟是由他心腹部门造成的状况下，在董事会上却通过极度专业的合规词汇，试图将预算超标的第一罪责隐性转移到你的大区头上。此刻会议离轮到你发言还有最后十分钟。',
    defaultTactics: ['构建联盟', '软对抗']
  },
  {
    id: 'corp-2',
    title: '核心资产重组被夺功',
    env: 'corp_clash',
    model: 'cold_trigger',
    description: '你带领团队开发了最核心的云端交易引擎，并实现盈利。海外总部新任亚太区总裁试图将你的团队与另外一个绩效极差的心腹团队合并，并将新团队的实际控制权交予他的旧部，名义上称“优化资源配置协同”。',
    defaultTactics: ['借势上位', '信息垄断']
  },
  {
    id: 'upward-1',
    title: '直属总监的压制与边缘化',
    env: 'upward_takeover',
    model: 'info_asymmetry',
    description: '你的直属总监业务能力低下，但极度多疑，屡次在向CEO汇报时抢夺你的项目成果，并剥夺你参加重要跨部门会议的资格。你手握核心系统开发文档与独占供应链渠道，但没有CEO直接汇报的渠道。',
    defaultTactics: ['借势上位', '构建联盟', '信息垄断']
  }
];

// 对抗推演对手预设
interface SimPresetOpponent {
  id: 'vp' | 'vice-gm' | 'director';
  name: string;
  type: string;
  env: 'gov_struggle' | 'corp_clash' | 'upward_takeover';
  model: 'prisoner_dilemma' | 'pig_game' | 'info_asymmetry' | 'cold_trigger';
  dilemma: string;
}

const SIM_OPPONENTS: SimPresetOpponent[] = [
  {
    id: 'vp',
    name: '空降的改革派 VP',
    type: '空降夺权型',
    env: 'corp_clash',
    model: 'prisoner_dilemma',
    dilemma: '新上任 of VP 在大会上公开指出，你负责的业务流程存在严重隐患，准备绕过你直接指派其亲信接管核心模块，且不断以‘合规和转型’施压，这实际上是利益冲突与制度架空博弈。你将如何反制？'
  },
  {
    id: 'vice-gm',
    name: '任人唯亲的常务副总',
    type: '安全感驱动型',
    env: 'gov_struggle',
    model: 'pig_game',
    dilemma: '常务副总在资源分配中明显偏向其旧部，并将原本属于你团队的重要预算砍掉大半，同时私下通过‘谈心’拉拢你的核心骨干成员，对其许以重利，试图分化打压你。你将如何应对？'
  },
  {
    id: 'director',
    name: '多疑的总监',
    type: '多疑多虑型',
    env: 'upward_takeover',
    model: 'info_asymmetry',
    dilemma: '直属总监极度缺乏安全感，对你的工作细节事事过问，在汇报中把你的研究成果包装成其本人的战略思考，同时在跨部门会议中故意屏蔽关键背景信息，让你在毫不知情的情况下承担未知的跨部门协调风险。你该如何破局？'
  }
];

export default function GameTheoryModule() {
  const [activeTab, setActiveTab] = useState<'cases' | 'tactics' | 'simulation' | 'session' | 'ascension' | 'history'>('cases');
  const [mountedTabs, setMountedTabs] = useState<Set<'cases' | 'tactics' | 'simulation' | 'session' | 'ascension' | 'history'>>(
    () => new Set(['cases'])
  );
  const { tasks, addTask, setIsOpen: setTaskCenterOpen } = useTask();
  const [knowledgeHint, setKnowledgeHint] = useState('');
  const [linkedGameKnowledge, setLinkedGameKnowledge] = useState<Array<{ sourceType?: string; sourceRef?: { sourceId?: string } }>>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/knowledge-vault/linked?userId=${encodeURIComponent(getAppUserId())}&module=game_theory`)
      .then((res) => res.json())
      .then((list) => {
        if (cancelled) return;
        const rows = Array.isArray(list) ? list : [];
        setLinkedGameKnowledge(rows);
        const n = rows.length;
        const used = Math.min(n, 5);
        setKnowledgeHint(
          n > 0
            ? `已同步 ${n} 条博弈知识，本次训练将自动引用 ${used} 条`
            : '尚未同步博弈知识，本次训练不注入资料抽屉内容'
        );
      })
      .catch(() => {
        if (!cancelled) {
          setLinkedGameKnowledge([]);
          setKnowledgeHint('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  
  // 顶层认知升维训练状态
  const [ascEvent, setAscEvent] = useState('');
  const [ascLayers, setAscLayers] = useState<string[]>(['', '', '', '', '']);
  const [ascDimension, setAscDimension] = useState<'history' | 'structure' | 'self'>('structure');
  const [ascLoading, setAscLoading] = useState(false);
  const [ascResult, setAscResult] = useState<CognitiveAscensionResult | null>(null);
  const [ascError, setAscError] = useState<string | null>(null);
  const [showSuccessBadge, setShowSuccessBadge] = useState(false);

  const triggerSuccessAnimation = () => {
    setShowSuccessBadge(true);
    setTimeout(() => setShowSuccessBadge(false), 2500);
  };

  const handleAscensionSubmit = async () => {
    if (!ascEvent.trim() || ascLayers.some(l => !l.trim())) {
      playGentleWarning();
      setAscError('???????????????????????');
      return;
    }
    setAscError(null);
    setAscLoading(true);
    setAscResult(null);
    playClick();
    try {
      const r = await runCognitiveAscension({
        event_text: ascEvent,
        layers: ascLayers.map((why, i) => ({ level: i + 1, why })),
        dimension: ascDimension,
      });
      setAscResult(r);
      if (r.is_passed) {
        playPageTurn();
        triggerSuccessAnimation();
      } else {
        playGentleWarning();
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const sysMsg = `【系统异常】${errMsg}`;
      console.error('升维提交失败:', errMsg);
      setAscResult({
        is_passed: false,
        depth_score: 0,
        layer_feedback: [],
        ultimate_law: '',
        suggestion: sysMsg,
      });
      alert(sysMsg);
      playGentleWarning();
    } finally {
      setAscLoading(false);
    }
  };

  const [activeEnv, setActiveEnv] = useState<'gov_struggle' | 'corp_clash' | 'upward_takeover'>('corp_clash');
  const [extraCases, setExtraCases] = useState<PresetCase[]>([]);
  const [lastGoodCase, setLastGoodCase] = useState<PresetCase | null>(null);
  const [casePushLoading, setCasePushLoading] = useState(false);
  const casePushLoadingRef = useRef(false);
  const [casePushQuality, setCasePushQuality] = useState<{
    quality: 'ok' | 'below_standard';
    quality_note?: string;
  } | null>(null);
  const [selectedModel, setSelectedModel] = useState<GameTheoryAnalyzeInput['game_model']>('pig_game');
  const [caseText, setCaseText] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedTactics, setSelectedTactics] = useState<string[]>([]);
  
  // 原型与记录状态
  const [prototypes, setPrototypes] = useState<PersonalPrototype[]>([]);
  const [selectedProtoIds, setSelectedProtoIds] = useState<string[]>([]);
  const [newProtoName, setNewProtoName] = useState('');
  const [newProtoType, setNewProtoType] = useState('利益驱动型');
  const [newProtoDesc, setNewProtoDesc] = useState('');

  // 驭人术手段库状态
  const [tactics, setTactics] = useState<TacticItem[]>([]);
  const [loadingTactics, setLoadingTactics] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  // 强制四维度拆解表单状态
  const [stakeholderInterests, setStakeholderInterests] = useState('');
  const [motivesAnalysis, setMotivesAnalysis] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [keyPoints, setKeyPoints] = useState('');

  // 切换参会人选择
  const toggleParticipant = (id: string) => {
    playClick();
    if (selectedProtoIds.includes(id)) {
      setSelectedProtoIds(selectedProtoIds.filter(x => x !== id));
    } else {
      setSelectedProtoIds([...selectedProtoIds, id]);
    }
  };
  
  // 推演运行状态（异步提交，结果以对局历史为准）
  const [isLoading, setIsLoading] = useState(false);
  const [submitNotice, setSubmitNotice] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [pendingCaseTaskId, setPendingCaseTaskId] = useState<string | null>(null);
  const [animateBorder, setAnimateBorder] = useState(false);

  // Simulation 对战沙盘状态
  const [simOpponentId, setSimOpponentId] = useState<string>('vp');
  const [simCustomName, setSimCustomName] = useState('');
  const [simCustomType, setSimCustomType] = useState('利益驱动型');
  const [simCustomModel, setSimCustomModel] = useState<GameTheoryAnalyzeInput['game_model']>('prisoner_dilemma');
  const [simCustomDilemma, setSimCustomDilemma] = useState('');
  const [simAnswer, setSimAnswer] = useState('');
  const [simSelectedTactics, setSimSelectedTactics] = useState<string[]>([]);
  const [simLoading, setSimLoading] = useState(false);
  const [simSubmitNotice, setSimSubmitNotice] = useState('');
  const [simSubmitError, setSimSubmitError] = useState('');
  const [pendingSimTaskId, setPendingSimTaskId] = useState<string | null>(null);
  const [simAnimateBorder, setSimAnimateBorder] = useState(false);
  const [simFormExpanded, setSimFormExpanded] = useState(false);

  // 对局历史
  const [historyItems, setHistoryItems] = useState<GameTheoryHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [highlightHistoryId, setHighlightHistoryId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<GameTheoryHistoryItem | null>(null);

  const focusHistoryEntry = (historyId: string) => {
    setActiveTab('history');
    setHighlightHistoryId(historyId);
    setExpandedHistoryId(historyId);
    playPageTurn();
    setTimeout(() => setHighlightHistoryId((cur) => (cur === historyId ? null : cur)), 5000);
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const items = await getGameTheoryHistory();
      setHistoryItems(items);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpponentChange = (id: string) => {
    playClick();
    setSimOpponentId(id);
    setSimSubmitNotice('');
    setSimSubmitError('');
    setSimAnswer('');
    setSimSelectedTactics([]);

    if (id === 'custom') {
      setSimCustomName('');
      setSimCustomType('利益驱动型');
      setSimCustomModel('prisoner_dilemma');
      setSimCustomDilemma('');
      return;
    }

    const prototype = prototypes.find((item) => item.id === id);
    if (prototype) {
      setSimCustomName(prototype.name);
      setSimCustomType(prototype.type || '利益驱动型');
      setSimCustomModel('prisoner_dilemma');
      setSimCustomDilemma(
        `【对手性格特征】：${prototype.description || '暂无描述'}\n【对立博弈场景】：`
      );
    }
  };

  const handleStartSimPlay = async () => {
    let name = '';
    let type = '';
    let model: GameTheoryAnalyzeInput['game_model'] = 'prisoner_dilemma';
    let dilemma = '';
    let env: GameTheoryAnalyzeInput['scene_type'] = 'corp_clash';

    const isPresetOpponent = SIM_OPPONENTS.some((opp) => opp.id === simOpponentId);
    if (isPresetOpponent) {
      const opp = SIM_OPPONENTS.find(o => o.id === simOpponentId);
      if (!opp) return;
      name = opp.name;
      type = opp.type;
      model = opp.model;
      dilemma = opp.dilemma;
      env = opp.env;
    } else {
      if (!simCustomName.trim() || !simCustomDilemma.trim()) return;
      name = simCustomName;
      type = simCustomType;
      model = simCustomModel;
      dilemma = simCustomDilemma;
      env = 'corp_clash';
    }

    if (!simAnswer.trim()) return;

    setSimLoading(true);
    setSimSubmitNotice('');
    setSimSubmitError('');
    setSimAnimateBorder(true);
    playClick();

    try {
      const caseTextFormatted = `【博弈对手姓名 / Name】: ${name}\n【人性分类 / Weakness Type】: ${type}\n【博弈局势描述 / Dilemma Detail】:\n${dilemma}`;
      const fullAnswer = `【玩家应对策略】：\n${simAnswer}`;
      
      const inputs: GameTheoryAnalyzeInput & { source_type: 'simulation'; title: string } = {
        scene_type: env,
        game_model: model,
        case_text: caseTextFormatted,
        user_answer: fullAnswer,
        applied_tactics: simSelectedTactics.join(', '),
        source_type: 'simulation',
        title: name,
      };

      const { taskId, knowledgeReminder } = await runGameTheoryAnalysis(inputs);
      addTask({
        id: taskId,
        type: 'game_theory',
        name: `人机对战: ${name.slice(0, 40)}`,
        status: 'running',
        progress: 10,
        logs: knowledgeTaskLogs(knowledgeReminder),
      });
      setPendingSimTaskId(taskId);
      const simHandoff = knowledgeReminder
        ? `已提交后台。${knowledgeReminder}。请到任务中心查看进度；完成后将自动进入「对局历史」。`
        : '已提交后台。请到任务中心查看进度；完成后将自动进入「对局历史」。';
      setSimSubmitNotice(simHandoff);
      notifyBackgroundHandoff({ message: simHandoff, tone: 'info' });
      setSimFormExpanded(true);
      setSimAnimateBorder(false);
      playPageTurn();
    } catch (err: any) {
      setSimAnimateBorder(false);
      playGentleWarning();
      console.error('对决失败:', err);
      setSimSubmitError('对决失败，请稍后再试');
    } finally {
      setSimLoading(false);
    }
  };

  // 加载人性原型档案
  useEffect(() => {
    fetchPrototypes();
  }, []);

  // 深链 / 任务完成后聚焦对局历史
  useEffect(() => {
    const applyFocusFromStorage = () => {
      const id = sessionStorage.getItem('gt_focus_history_id');
      if (!id) return;
      sessionStorage.removeItem('gt_focus_history_id');
      focusHistoryEntry(id);
      void loadHistory().then(() => {
        getGameTheoryHistoryDetail(id)
          .then((item) => setExpandedDetail(item))
          .catch(() => {});
      });
    };
    applyFocusFromStorage();
    const onNav = () => applyFocusFromStorage();
    window.addEventListener('navigate-game-theory-history', onNav);
    return () => window.removeEventListener('navigate-game-theory-history', onNav);
  }, []);

  // Speak P1 入口：聚焦多人群体博弈会话 Tab
  useEffect(() => {
    const applySessionFocus = () => {
      if (consumeGameTheorySessionFocus()) {
        setActiveTab('session');
        setMountedTabs((prev) => {
          if (prev.has('session')) return prev;
          const next = new Set(prev);
          next.add('session');
          return next;
        });
      }
    };
    applySessionFocus();
    const onNav = () => applySessionFocus();
    window.addEventListener(GT_NAV_SESSION_EVENT, onNav);
    return () => window.removeEventListener(GT_NAV_SESSION_EVENT, onNav);
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      void loadHistory();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!expandedHistoryId) {
      setExpandedDetail(null);
      return;
    }
    getGameTheoryHistoryDetail(expandedHistoryId)
      .then((item) => setExpandedDetail(item))
      .catch(() => setExpandedDetail(null));
  }, [expandedHistoryId]);

  // 监听本模块提交的博弈任务完成
  useEffect(() => {
    const watch = (taskId: string | null, clear: () => void) => {
      if (!taskId) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.status === 'completed' && task.result?.historyId) {
        clear();
        fetchPrototypes();
        focusHistoryEntry(task.result.historyId);
        void loadHistory();
        if (task.result.historyId) {
          getGameTheoryHistoryDetail(task.result.historyId)
            .then((item) => {
              setExpandedDetail(item);
              if (item.full_result?.is_success) triggerSuccessAnimation();
              else playGentleWarning();
            })
            .catch(() => {});
        }
      } else if (task.status === 'failed') {
        clear();
        playGentleWarning();
        const msg = task.error || '博弈研判失败';
        if (taskId === pendingCaseTaskId) setSubmitError(msg);
        if (taskId === pendingSimTaskId) setSimSubmitError(msg);
      }
    };
    watch(pendingCaseTaskId, () => {
      setPendingCaseTaskId(null);
      setSubmitNotice('');
    });
    watch(pendingSimTaskId, () => {
      setPendingSimTaskId(null);
      setSimSubmitNotice('');
    });
  }, [tasks, pendingCaseTaskId, pendingSimTaskId]);

  // 心智投喂重组：注入驭心博弈定制案例
  useEffect(() => {
    const applyRebalance = (plan: TrainingRebalancePlan | null) => {
      const topics = plan?.yuxinGameTheory;
      if (topics?.length) {
        setCaseText(topics[0]);
        setActiveEnv('corp_clash');
        setActiveTab('cases');
      }
    };

    applyRebalance(getNextWeekPushPlan());

    const handler = (e: Event) => {
      const plan = (e as CustomEvent<TrainingRebalancePlan>).detail || getNextWeekPushPlan();
      applyRebalance(plan);
    };
    window.addEventListener('global-training-rebalance', handler);
    return () => window.removeEventListener('global-training-rebalance', handler);
  }, []);

  const fetchPrototypes = async () => {
    try {
      const data = await getPersonalPrototypes();
      setPrototypes(data);
      const validIds = data.map(p => p.id);
      setSelectedProtoIds(prev => prev.filter(id => validIds.includes(id)));
    } catch (err) {
      console.error('获取人性原型列表失败:', err);
    }
  };

  // 处理案例选中（短预设自动触发同类推送，合格稿直接选用）
  const selectPresetCase = (c: PresetCase) => {
    playClick();
    const q = evaluateCasePushQuality({
      background: c.description,
      incomplete_info: c.description.includes('【未知信息】') ? c.description.split('【未知信息】')[1]?.split('【决策点】')[0] : '',
      decision_point: c.description.includes('【决策点】') ? c.description.split('【决策点】')[1] : '',
    });

    if (q.quality === 'ok') {
      setCaseText(c.description);
      setLastGoodCase(c);
      setSelectedModel(c.model);
      setSelectedTactics(c.defaultTactics);
      setCasePushQuality({ quality: 'ok' });
    } else {
      // 预设过简时禁止作为正文，触发推送详实尖锐案例
      setCasePushQuality({
        quality: 'below_standard',
        quality_note: '该预设案例过简，正在为您换取同类深度尖锐案例...',
      });
      void refreshPushedCase({ isAuto: false });
      return;
    }
    // 清空四个拆解维度，强制重新研判
    setStakeholderInterests('');
    setMotivesAnalysis('');
    setWeaknesses('');
    setKeyPoints('');
  };

  const refreshPushedCase = async (options?: { isAuto?: boolean; targetEnv?: typeof activeEnv }) => {
    const isAuto = options?.isAuto ?? false;
    const currentEnv = options?.targetEnv ?? activeEnv;
    if (casePushLoadingRef.current) return;
    casePushLoadingRef.current = true;
    setCasePushLoading(true);
    if (!isAuto) {
      playClick();
    }
    const envPool = [...PRESET_CASES, ...extraCases].filter((item) => item.env === currentEnv);
    const currentId = envPool.find((item) => item.description === caseText)?.id;

    try {
      const excludeIds = [
        ...(currentId ? [currentId] : []),
        ...extraCases.filter((item) => item.env === currentEnv).map((item) => item.id),
      ];
      const pushed = await pushGameTheoryCase({ env: currentEnv, excludeIds });
      const q = pushed.quality
        ? { quality: pushed.quality, quality_note: pushed.quality_note }
        : evaluateCasePushQuality(pushed);

      if (q.quality === 'ok') {
        const mapped: PresetCase = {
          id: pushed.id,
          title: pushed.title,
          env: currentEnv,
          model: selectedModel,
          description: `${pushed.background}\n\n【未知信息】${pushed.incomplete_info}\n\n【决策点】${pushed.decision_point}`,
          defaultTactics: [],
        };
        setExtraCases((prev) => [mapped, ...prev.filter((item) => item.id !== mapped.id)]);
        setCaseText(mapped.description);
        setLastGoodCase(mapped);
        setCasePushQuality({ quality: 'ok' });
        setSelectedTactics([]);
        setStakeholderInterests('');
        setMotivesAnalysis('');
        setWeaknesses('');
        setKeyPoints('');
        if (!isAuto) playPageTurn();
      } else {
        // GT-CASE-02: 拒收机制 —— 不合格不进主文案，保留上一篇合格稿；无合格稿则清空正文并提示
        setCasePushQuality({
          quality: 'below_standard',
          quality_note: q.quality_note || '推送案例未达尖锐与详实标准，请再次点击「换一条」',
        });
        if (!lastGoodCase) {
          setCaseText('');
        }
        if (!isAuto) {
          playGentleWarning();
          alert('新案例质量未达标，已保留当前可用案例，请再点「换一条」');
        }
      }
    } catch (e) {
      console.warn('[Game Theory Case Push] 异常:', e);
      if (!lastGoodCase) {
        setCaseText('');
        setCasePushQuality({
          quality: 'below_standard',
          quality_note: '推送案例网络异常，请点击「换一条」重试',
        });
      }
      if (!isAuto) {
        playGentleWarning();
        alert('获取案例失败，请再点「换一条」');
      }
    } finally {
      casePushLoadingRef.current = false;
      setCasePushLoading(false);
    }
  };

  // 每次进入或切回案例研判 Tab，或切换博弈环境时，自动再推并替换主文案
  useEffect(() => {
    if (activeTab === 'cases') {
      void refreshPushedCase({ isAuto: true });
    }
  }, [activeTab, activeEnv]);

  // 手动添加原型档案
  const handleAddProto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProtoName.trim()) return;
    playClick();
    try {
      await upsertPersonalPrototype({
        name: newProtoName,
        type: newProtoType,
        description: newProtoDesc
      });
      setNewProtoName('');
      setNewProtoDesc('');
      
      // 成功录入时播放翻页声并触发 SuccessBadge
      playPageTurn();
      triggerSuccessAnimation();

      fetchPrototypes();
    } catch (err) {
      console.error('录入人性档案失败:', err);
      playGentleWarning();
      console.error('录入失败:', err);
      alert('录入失败，请稍后重试');
    }
  };

  // 删除原型档案
  const handleDeleteProto = async (id: string) => {
    playClick();
    try {
      await deletePersonalPrototype(id);
      fetchPrototypes();
    } catch (err) {
      console.error(err);
    }
  };

  // 切换战术标签
  const toggleTactic = (t: string) => {
    playClick();
    if (selectedTactics.includes(t)) {
      setSelectedTactics(selectedTactics.filter(x => x !== t));
    } else {
      setSelectedTactics([...selectedTactics, t]);
    }
  };

  // 执行核心博弈模拟推演（异步 → 任务中心 → 对局历史）
  const handleStartSimulation = async () => {
    if (!caseText.trim() || casePushQuality?.quality !== 'ok' || !stakeholderInterests.trim() || !motivesAnalysis.trim() || !weaknesses.trim() || !keyPoints.trim()) {
      if (casePushQuality?.quality !== 'ok') {
        playGentleWarning();
        alert('当前案例质量未达标，请先点「换一条」后再提交');
      }
      return;
    }
    setIsLoading(true);
    setSubmitNotice('');
    setSubmitError('');
    setAnimateBorder(true);
    playClick();

    try {
      let enrichedCaseText = caseText;
      if (selectedProtoIds.length > 0) {
        const mappedProfileIds = new Set(
          linkedGameKnowledge
            .filter((item) => item?.sourceType === 'from_profile')
            .map((item) => item?.sourceRef?.sourceId || '')
            .filter(Boolean)
        );
        const selectedProtos = prototypes.filter(
          (p) => selectedProtoIds.includes(p.id) && !mappedProfileIds.has(p.id)
        );
        if (selectedProtos.length > 0) {
          const profilesString = selectedProtos
            .map((p, idx) => `${idx + 1}. [${p.name}] (分类: ${p.type}) - 特征: ${p.description || '暂无特征描述。'}`)
            .join('\n');
          enrichedCaseText = `【参会博弈对手特征 / Participant Profiles】:\n${profilesString}\n\n【危机场景详情 / Crisis Detail】:\n${caseText}`;
        }
      }

      const fullAnswer = `① 利益结构分析：\n${stakeholderInterests}\n\n② 善/恶动机透视：\n${motivesAnalysis}\n\n③ 对方权力弱点：\n${weaknesses}\n\n④ 博弈关键节点：\n${keyPoints}`;
      const titleHint = caseText.trim().slice(0, 40) || '案例研判';

      const inputs: GameTheoryAnalyzeInput & { source_type: 'case_analysis'; title: string } = {
        scene_type: activeEnv,
        game_model: selectedModel,
        case_text: enrichedCaseText,
        user_answer: fullAnswer,
        applied_tactics: selectedTactics.join(', '),
        source_type: 'case_analysis',
        title: titleHint,
      };

      const { taskId, knowledgeReminder } = await runGameTheoryAnalysis(inputs);
      addTask({
        id: taskId,
        type: 'game_theory',
        name: `博弈研判: ${titleHint}`,
        status: 'running',
        progress: 10,
        logs: knowledgeTaskLogs(knowledgeReminder),
      });
      setPendingCaseTaskId(taskId);
      const caseHandoff = knowledgeReminder
        ? `已提交后台。${knowledgeReminder}。请到任务中心查看进度；完成后将自动进入「对局历史」。`
        : '已提交后台。请到任务中心查看进度；完成后将自动进入「对局历史」。';
      setSubmitNotice(caseHandoff);
      notifyBackgroundHandoff({ message: caseHandoff, tone: 'info' });
      setAnimateBorder(false);
      playPageTurn();
    } catch (err: any) {
      setAnimateBorder(false);
      playGentleWarning();
      console.error('推演失败:', err);
      setSubmitError('推演失败，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  // 环境过滤预设案例
  const filteredPresets = [...PRESET_CASES, ...extraCases].filter(c => c.env === activeEnv);

  const downwardTactics = ['恩威并施', '制衡术', '分而治之', '边缘化'];
  const upwardTactics = ['借势上位', '构建联盟', '信息垄断', '软对抗'];

  // 环境切换函数
  const handleEnvChange = (newEnv: typeof activeEnv) => {
    playClick();
    setActiveEnv(newEnv);
    void refreshPushedCase({ isAuto: false, targetEnv: newEnv });
  };

  // Tab 切换函数
  const handleTabChange = (tab: typeof activeTab) => {
    playPageTurn();
    startTransition(() => {
      setActiveTab(tab);
      setMountedTabs((prev) => {
        if (prev.has(tab)) return prev;
        const next = new Set(prev);
        next.add(tab);
        return next;
      });
    });
  };

  const renderGtTab = (id: typeof activeTab, node: React.ReactNode) => {
    if (!mountedTabs.has(id)) return null;
    return (
      <div key={id} hidden={activeTab !== id}>
        {node}
      </div>
    );
  };

  return (
    <ModuleWrapper 
      title="驭心 ｜ 高管层博弈系统" 
      icon={<Brain className="w-8 h-8 text-zinc-700" strokeWidth={2} />}
      description="核心定位：不仅是读文字，而是读结构、读政策背后的风向、读外企运作实质与漏洞。破阶到 0.01% 的战略决策底层操作系统。"
    >
      {/* 战略评估弹窗已改用右侧 30% Context Sheet */}

      {/* Tab 导航区域 */}
      <div className="flex border border-slate-100 mb-6 bg-white p-1 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.02)] overflow-x-auto">
        {([
          { id: 'cases', name: '高管斗争案例研判' },
          { id: 'tactics', name: '驭人术与人性档案' },
          { id: 'simulation', name: '人机对战练习' },
          { id: 'session', name: '多人群体博弈会话' },
          { id: 'history', name: '对局历史' },
          { id: 'ascension', name: '顶层认知升维' }
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex-1 py-2 px-6 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/50'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {knowledgeHint && (activeTab === 'cases' || activeTab === 'simulation' || activeTab === 'ascension') && (
        <p className="mb-4 text-[11px] text-zinc-500 leading-relaxed">{knowledgeHint}</p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* TAB 1: 真实高管斗争案例库 */}
          {renderGtTab('cases', (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">
              <div className="lg:col-span-10">
                <div className="grid grid-cols-1 md:grid-cols-10 gap-6 items-start">
                  
                  {/* 左面板 30%：环境与案例选择 */}
                  <div className="md:col-span-3 space-y-6">
                    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_6px_20px_rgba(0,0,0,0.015)]">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-3">博弈环境选择 (Environments)</span>
                      
                      <div className="flex flex-col gap-1.5 mb-6">
                        {([
                          { id: 'gov_struggle', name: '体制内政治' },
                          { id: 'corp_clash', name: '外企权斗局' },
                          { id: 'upward_takeover', name: '以下克上战' }
                        ] as const).map(env => (
                          <button 
                            key={env.id}
                            onClick={() => handleEnvChange(env.id)}
                            className={`w-full text-left py-2.5 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-between ${
                              activeEnv === env.id 
                                ? 'bg-zinc-900 text-white shadow-sm' 
                                : 'bg-zinc-50 border border-zinc-200/40 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                            }`}
                          >
                            {env.name}
                            <span className={`w-1.5 h-1.5 rounded-full ${activeEnv === env.id ? 'bg-white' : 'bg-zinc-300'}`} />
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">斗争案例选择 (Preset Cases)</span>
                        <button
                          type="button"
                          onClick={() => { void refreshPushedCase(); }}
                          disabled={casePushLoading}
                          className="text-[10px] font-bold text-zinc-500 hover:text-zinc-800 cursor-pointer disabled:opacity-50"
                        >
                          {casePushLoading ? '推送中...' : '换一条'}
                        </button>
                      </div>
                      <div className="space-y-2">
                        {filteredPresets.map(c => {
                          const isSelected = caseText === c.description;
                          return (
                            <button
                              key={c.id}
                              onClick={() => selectPresetCase(c)}
                              className={`w-full text-left p-3 rounded-xl border text-xs font-medium transition-all flex flex-col gap-1 cursor-pointer ${
                                isSelected
                                  ? 'bg-zinc-50 border-zinc-400 text-zinc-950 font-semibold'
                                  : 'bg-white border-zinc-200/60 text-zinc-600 hover:border-zinc-300'
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                {c.title}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 右面板 70%：高维博弈沙盘研判 */}
                  <div className="md:col-span-7 space-y-6">
                    <div className={`bg-white rounded-3xl p-5 md:p-6 border border-slate-100 shadow-[0_12px_35px_rgba(0,0,0,0.02)] transition-all duration-300 relative ${
                      animateBorder ? 'ring-2 ring-zinc-300' : ''
                    }`}>
                      {isLoading && (
                        <div className="absolute inset-x-0 top-0 h-0.5 bg-zinc-300 animate-pulse" />
                      )}

                      {/* 案例详情与模型 */}
                      <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100">
                        <h4 className="font-bold text-sm text-zinc-800 flex items-center gap-2">
                          <Swords className="w-4 h-4 text-zinc-600" /> 危机场景详情与练习准备
                        </h4>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">博弈模型:</span>
                          <select 
                            value={selectedModel}
                            onChange={(e) => { playClick(); setSelectedModel(e.target.value as any); }}
                            className="border border-zinc-200 bg-zinc-50 text-zinc-700 rounded-full px-3 py-1 text-[10px] font-bold outline-none cursor-pointer hover:bg-zinc-100"
                            disabled={isLoading}
                          >
                            <option value="prisoner_dilemma">囚徒困境演化版</option>
                            <option value="pig_game">智猪潜藏博弈</option>
                            <option value="info_asymmetry">极度信息不对称</option>
                            <option value="cold_trigger">冷酷触发策略</option>
                          </select>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl mb-5">
                        {casePushQuality?.quality === 'below_standard' && (
                          <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900 leading-relaxed">
                            {casePushQuality.quality_note || '案例质量未达标，请点击「换一条」'}
                          </div>
                        )}
                        <textarea 
                          rows={3}
                          value={caseText}
                          onChange={(e) => setCaseText(e.target.value)}
                          className="w-full bg-transparent border-none text-xs text-zinc-600 leading-relaxed font-medium placeholder-zinc-400 outline-none resize-none"
                          placeholder={
                            casePushLoading
                              ? '正在为您推送详实尖锐的高管斗争案例，请稍候...'
                              : !caseText && casePushQuality?.quality === 'below_standard'
                              ? '未获取到合格的尖锐案例。请点击左上方「换一条」重新获取，或在此手动输入详实案例...'
                              : '请从左侧点击「换一条」获取详实尖锐的高管权力斗争案例，或在此处直接编辑、手动输入你要演练的案例详情...'
                          }
                          disabled={isLoading}
                        />
                      </div>

                      {/* 关系人装配箱 - 选择参与博弈的已存对手性格原型 */}
                      <div className="mb-6 bg-zinc-50/50 rounded-xl p-4 border border-zinc-100">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-2.5 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-zinc-500" />
                          关系人装配箱 (Participants Context):
                        </span>
                        
                        {prototypes.length === 0 ? (
                          <p className="text-[10px] text-zinc-400 font-semibold leading-relaxed">
                            暂无已收录的人性档案。您可在“驭人术与人性档案”选项卡中手动录入，随后在此将他们“装配”入会议对峙现场。
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {prototypes.map(p => {
                              const isSelected = selectedProtoIds.includes(p.id);
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => toggleParticipant(p.id)}
                                  disabled={isLoading}
                                  className={`text-[10px] py-1 px-3 rounded-full font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                                    isSelected
                                      ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm scale-102'
                                      : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:bg-zinc-50'
                                  }`}
                                >
                                  <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-zinc-300'}`} />
                                  {p.name} ({p.type})
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* 强制四维度拆解表单 */}
                      <div className="space-y-4 mb-6">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block border-b border-zinc-100 pb-2">
                          局势四维拆解表单
                        </span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-zinc-600 font-bold block mb-1">① 利益结构分析 (Stakeholder Interests)</label>
                            <textarea
                              rows={3}
                              value={stakeholderInterests}
                              onChange={(e) => setStakeholderInterests(e.target.value)}
                              placeholder="分析局中各方的核心利益、诉求、联盟结构及潜在的冲突点..."
                              className="w-full bg-zinc-50/50 border border-zinc-200 focus:border-zinc-400 rounded-xl p-3 text-xs outline-none resize-none leading-relaxed font-medium"
                              disabled={isLoading}
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-zinc-600 font-bold block mb-1">② 善/恶动机透视 (Motives Analysis)</label>
                            <textarea
                              rows={3}
                              value={motivesAnalysis}
                              onChange={(e) => setMotivesAnalysis(e.target.value)}
                              placeholder="透视对方的行为动机：是利益驱使、安全感缺失，还是面子/恐惧作祟？"
                              className="w-full bg-zinc-50/50 border border-zinc-200 focus:border-zinc-400 rounded-xl p-3 text-xs outline-none resize-none leading-relaxed font-medium"
                              disabled={isLoading}
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-zinc-600 font-bold block mb-1">③ 对方权力弱点 (Power Weaknesses)</label>
                            <textarea
                              rows={3}
                              value={weaknesses}
                              onChange={(e) => setWeaknesses(e.target.value)}
                              placeholder="找出对方在规章制度、信息流、汇报链或核心团队中的软肋死穴..."
                              className="w-full bg-zinc-50/50 border border-zinc-200 focus:border-zinc-400 rounded-xl p-3 text-xs outline-none resize-none leading-relaxed font-medium"
                              disabled={isLoading}
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-zinc-600 font-bold block mb-1">④ 博弈关键节点 (Key Decision Points)</label>
                            <textarea
                              rows={3}
                              value={keyPoints}
                              onChange={(e) => setKeyPoints(e.target.value)}
                              placeholder="明确定策、话术、反制手段及你的具体应对与利益分配的底线动作..."
                              className="w-full bg-zinc-50/50 border border-zinc-200 focus:border-zinc-400 rounded-xl p-3 text-xs outline-none resize-none leading-relaxed font-medium"
                              disabled={isLoading}
                            />
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={handleStartSimulation}
                        disabled={!caseText.trim() || casePushQuality?.quality !== 'ok' || !stakeholderInterests.trim() || !motivesAnalysis.trim() || !weaknesses.trim() || !keyPoints.trim() || isLoading}
                        className={`w-full py-4 rounded-full text-xs tracking-widest uppercase font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          isLoading || casePushQuality?.quality !== 'ok' || !caseText.trim()
                            ? 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed' 
                            : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm hover:scale-[1.01]'
                        }`}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                            <span>提交中...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-zinc-400" />
                            <span>提交四维研判并启动董事会推演</span>
                          </>
                        )}
                      </button>

                      {(isLoading || submitNotice || submitError) && (
                        <div
                          className={`mt-4 rounded-2xl border px-4 py-3.5 text-xs leading-relaxed ${
                            submitError
                              ? 'border-red-200 bg-red-50/80 text-red-800'
                              : 'border-zinc-200 bg-zinc-50 text-zinc-700'
                          }`}
                          role={submitError ? 'alert' : 'status'}
                        >
                          <div className="flex items-start gap-3">
                            {isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin shrink-0 mt-0.5 text-zinc-500" />
                            ) : submitError ? (
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                            ) : (
                              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-zinc-600" />
                            )}
                            <div className="min-w-0 flex-1 space-y-2">
                              <p className="font-semibold">
                                {isLoading
                                  ? '正在提交到任务中心…'
                                  : submitError || submitNotice}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {!isLoading && !submitError && (
                                  <button
                                    type="button"
                                    onClick={() => { playClick(); setTaskCenterOpen(true); }}
                                    className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-[10px] font-bold cursor-pointer hover:bg-zinc-800"
                                  >
                                    打开任务中心
                                  </button>
                                )}
                                {submitError && (
                                  <button
                                    type="button"
                                    onClick={() => { playClick(); setSubmitError(''); handleStartSimulation(); }}
                                    className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-[10px] font-bold cursor-pointer hover:bg-zinc-800"
                                  >
                                    重试
                                  </button>
                                )}
                                {(submitNotice || submitError) && !isLoading && (
                                  <button
                                    type="button"
                                    onClick={() => { playClick(); setSubmitNotice(''); setSubmitError(''); }}
                                    className="px-3 py-1.5 rounded-full border border-zinc-200 text-zinc-600 text-[10px] font-bold cursor-pointer hover:bg-white"
                                  >
                                    关闭
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* TAB 2: 驭人术与人性档案 */}
          {renderGtTab('tactics', (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
              {/* 左面板 60%：手段工具箱 */}
              <div className="lg:col-span-6">
                <TacticsPanel
                  selectedTactics={selectedTactics}
                  onToggleTactic={(name) => {
                    playClick();
                    setSelectedTactics(prev =>
                      prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
                    );
                  }}
                />
              </div>

              {/* 右面板 40%：人性档案库录入及列表 */}
              <div className="lg:col-span-4 space-y-6">
                {/* 录入新卡片 */}
                <div className="bg-white rounded-[2rem] p-6 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] border border-zinc-200/80">
                  <h3 className="text-xs font-bold text-zinc-900 mb-4 flex items-center gap-2 uppercase tracking-widest">
                    <Plus className="w-4 h-4 text-zinc-500" /> 登记人性特征原型
                  </h3>

                  <form onSubmit={handleAddProto} className="space-y-4">
                    <div>
                      <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">关系人姓名 / 代称 (Name)</label>
                      <input 
                        type="text" 
                        value={newProtoName}
                        onChange={(e) => setNewProtoName(e.target.value)}
                        placeholder="例如：James VP 或 财务总监A"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:border-zinc-400 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">人性弱点分类 (Type)</label>
                      <select 
                        value={newProtoType}
                        onChange={(e) => setNewProtoType(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 px-3 text-xs font-semibold outline-none focus:border-zinc-400 transition-colors cursor-pointer"
                      >
                        <option value="利益驱动型">利益驱动型</option>
                        <option value="恐惧驱动型">恐惧驱动型</option>
                        <option value="面子驱动型">面子驱动型</option>
                        <option value="安全感驱动型">安全感驱动型</option>
                        <option value="多疑多虑型">多疑多虑型</option>
                        <option value="规避责任型">规避责任型</option>
                        <option value="空降夺权型">空降夺权型</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">性格及支配方式描述 (Description)</label>
                      <textarea 
                        value={newProtoDesc}
                        onChange={(e) => setNewProtoDesc(e.target.value)}
                        placeholder="描述其权力的硬伤、死穴，以及如何利用其本性进行博弈制衡或拉拢..."
                        rows={3}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:border-zinc-400 transition-colors resize-none leading-relaxed"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold tracking-widest uppercase transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> 录入人性档案册
                    </button>
                  </form>
                </div>

                {/* 已存人性分类档案库 */}
                <div className="bg-zinc-900 text-zinc-100 rounded-[2rem] p-6 border border-zinc-800 shadow-md">
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800">
                    <h3 className="text-xs font-bold tracking-widest uppercase text-zinc-300 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-zinc-500" /> 人性特征档案库
                    </h3>
                    <span className="text-[10px] font-bold font-mono bg-zinc-800 px-2.5 py-0.5 rounded text-zinc-400">
                      {prototypes.length} PROTOS
                    </span>
                  </div>

                  {prototypes.length === 0 ? (
                    <div className="text-center py-12 text-xs text-zinc-500 font-semibold leading-relaxed">
                      <HelpCircle className="w-6 h-6 mx-auto mb-2 text-zinc-600" />
                      当前人性档案库为空。<br />请在上方手动登记，或在“高管案例研判”推演成功后由系统自动捕获存库。
                    </div>
                  ) : (
                    <div 
                      className="space-y-3 pr-1 block w-full h-auto"
                    >
                      {prototypes.map(p => (
                        <div 
                          key={p.id}
                          className="group bg-zinc-950/40 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-4 transition-all duration-300 relative shadow-inner"
                        >
                          <div className="flex items-start justify-between mb-1.5">
                            <div>
                              <h4 className="text-xs font-bold text-white">{p.name}</h4>
                              <span className="text-[9px] bg-zinc-800 text-zinc-300 font-bold px-1.5 py-0.5 rounded mt-1.5 inline-block">
                                {p.type}
                              </span>
                            </div>
                            
                            <button 
                              onClick={() => handleDeleteProto(p.id)}
                              className="opacity-0 group-hover:opacity-100 hover:text-zinc-300 text-zinc-600 transition-opacity p-0.5 cursor-pointer"
                              title="删除该档案"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          <p className="text-[10px] text-zinc-400 font-medium leading-relaxed mt-1">
                            {p.description || '暂无详细特征描述。'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* TAB 3: 博弈论实操推演（人机对战） */}
          {renderGtTab('simulation', (() => {
            const simShowResultStage = simLoading || !!simSubmitNotice || !!simSubmitError;
            const simShowForm = !simShowResultStage || simFormExpanded || simLoading || !!simSubmitError || !!simSubmitNotice;
            const isPresetOpponent = SIM_OPPONENTS.some((opp) => opp.id === simOpponentId);
            const simOpponentLabel = isPresetOpponent
              ? (SIM_OPPONENTS.find(o => o.id === simOpponentId)?.name || '')
              : (simCustomName.trim() || '自定义对手');
            const simModelKey = isPresetOpponent
              ? (SIM_OPPONENTS.find(o => o.id === simOpponentId)?.model || 'prisoner_dilemma')
              : simCustomModel;
            const simModelLabel =
              simModelKey === 'prisoner_dilemma' ? '囚徒困境演化版' :
              simModelKey === 'pig_game' ? '智猪潜藏博弈' :
              simModelKey === 'info_asymmetry' ? '极度信息不对称' : '冷酷触发策略';
            const simTacticsLabel = simSelectedTactics.length > 0
              ? simSelectedTactics.join(' · ')
              : '未勾选对策';

            const simFormBlock = (
              <div className="grid grid-cols-1 md:grid-cols-10 gap-6 items-start">
                {/* 左面板：对手与博弈模型选择 */}
                <div className="md:col-span-3 space-y-6">
                  <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_6px_20px_rgba(0,0,0,0.015)]">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-3">博弈对手选择 (Opponent Selection)</span>
                    
                    <div className="flex flex-col gap-1.5 mb-6">
                      {SIM_OPPONENTS.map(opp => (
                        <button
                          key={opp.id}
                          onClick={() => handleOpponentChange(opp.id)}
                          className={`w-full text-left py-2.5 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-between ${
                            simOpponentId === opp.id 
                              ? 'bg-zinc-900 text-white shadow-sm' 
                              : 'bg-zinc-50 border border-zinc-200/40 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                          }`}
                        >
                          {opp.name}
                          <span className="text-[9px] opacity-75 font-normal">({opp.type})</span>
                        </button>
                      ))}
                      
                      {prototypes.length > 0 && (
                        <>
                          <div className="border-t border-zinc-100 my-2" />
                          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block px-1">已有人性档案</span>
                          {prototypes.map((prototype) => (
                            <button
                              key={prototype.id}
                              onClick={() => handleOpponentChange(prototype.id)}
                              className={`w-full text-left py-2.5 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-between ${
                                simOpponentId === prototype.id
                                  ? 'bg-zinc-900 text-white shadow-sm'
                                  : 'bg-zinc-50 border border-zinc-200/40 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                              }`}
                            >
                              <span className="min-w-0 truncate">{prototype.name}</span>
                              <span className="text-[9px] opacity-75 font-normal shrink-0 ml-2">({prototype.type || '自定义'})</span>
                            </button>
                          ))}
                        </>
                      )}

                      <button
                        onClick={() => handleOpponentChange('custom')}
                        className={`w-full text-left py-2.5 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-between ${
                          simOpponentId === 'custom' 
                            ? 'bg-zinc-900 text-white shadow-sm' 
                            : 'bg-zinc-50 border border-zinc-200/40 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                        }`}
                      >
                        自定义博弈对手...
                        <span className="text-[9px] opacity-75 font-normal">(自定义设定)</span>
                      </button>
                    </div>

                    {!isPresetOpponent && (
                      <div className="space-y-4 pt-4 border-t border-zinc-100">
                        {prototypes.length > 0 && (
                          <div>
                            <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">从人性档案库装配</label>
                            <select
                              onChange={(e) => {
                                const proto = prototypes.find(p => p.id === e.target.value);
                                if (proto) {
                                  playClick();
                                  setSimCustomName(proto.name);
                                  setSimCustomType(proto.type);
                                  if (proto.description) {
                                    setSimCustomDilemma(`对手性格：${proto.description}\n对决危机场景：`);
                                  }
                                }
                              }}
                              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:border-zinc-400"
                            >
                              <option value="">-- 选择已有档案原型 --</option>
                              {prototypes.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div>
                          <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">对手姓名 / 职位</label>
                          <input
                            type="text"
                            value={simCustomName}
                            onChange={(e) => setSimCustomName(e.target.value)}
                            placeholder="如：VP James"
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:border-zinc-400"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">人性弱点分类</label>
                          <select
                            value={simCustomType}
                            onChange={(e) => setSimCustomType(e.target.value)}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:border-zinc-400 cursor-pointer"
                          >
                            <option value="利益驱动型">利益驱动型</option>
                            <option value="恐惧驱动型">恐惧驱动型</option>
                            <option value="面子驱动型">面子驱动型</option>
                            <option value="安全感驱动型">安全感驱动型</option>
                            <option value="多疑多虑型">多疑多虑型</option>
                            <option value="规避责任型">规避责任型</option>
                            <option value="空降夺权型">空降夺权型</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">选择博弈模型</label>
                          <select
                            value={simCustomModel}
                            onChange={(e) => setSimCustomModel(e.target.value as any)}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:border-zinc-400 cursor-pointer"
                          >
                            <option value="prisoner_dilemma">囚徒困境演化版</option>
                            <option value="pig_game">智猪潜藏博弈</option>
                            <option value="info_asymmetry">极度信息不对称</option>
                            <option value="cold_trigger">冷酷触发策略</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {isPresetOpponent && (
                      <div className="pt-4 border-t border-zinc-100 space-y-2">
                        <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block">已选对手特征</span>
                        <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 text-[10px] space-y-1.5">
                          <div><span className="text-zinc-400 font-semibold">弱点原型：</span><span className="font-bold text-zinc-700">{SIM_OPPONENTS.find(o => o.id === simOpponentId)?.type}</span></div>
                          <div><span className="text-zinc-400 font-semibold">推荐模型：</span><span className="font-bold text-zinc-700">{simModelLabel}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 右面板：博弈局势与反制策略录入 */}
                <div className="md:col-span-7 space-y-6">
                  <div className={`bg-white rounded-3xl p-5 md:p-6 border border-slate-100 shadow-[0_12px_35px_rgba(0,0,0,0.02)] transition-all duration-300 relative ${
                    simAnimateBorder ? 'ring-2 ring-zinc-300' : ''
                  }`}>
                    {simLoading && (
                      <div className="absolute inset-x-0 top-0 h-0.5 bg-zinc-300 animate-pulse" />
                    )}

                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100">
                      <h4 className="font-bold text-sm text-zinc-800 flex items-center gap-2">
                        <Swords className="w-4 h-4 text-zinc-600" /> 对手施压情境与策略对抗
                      </h4>
                    </div>

                    <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl mb-5">
                      <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1.5">对手施压情境 (Opponent Crisis Scenario)</span>
                      {isPresetOpponent ? (
                        <p className="text-xs text-zinc-600 leading-relaxed font-semibold">
                          {SIM_OPPONENTS.find(o => o.id === simOpponentId)?.dilemma}
                        </p>
                      ) : (
                        <textarea
                          rows={3}
                          value={simCustomDilemma}
                          onChange={(e) => setSimCustomDilemma(e.target.value)}
                          placeholder="请手写设定该对手对你施加的权力危机、刁难场景或对立博弈详情..."
                          className="w-full bg-transparent border-none text-xs text-zinc-600 leading-relaxed font-medium placeholder-zinc-400 outline-none resize-none"
                          disabled={simLoading}
                        />
                      )}
                    </div>

                    <div className="mb-6 bg-zinc-50/50 rounded-xl p-4 border border-zinc-100">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-2.5">
                        反制对策勾选 (Select Tactics):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {['借势上位', '构建联盟', '信息垄断', '软对抗', '制衡术', '分而治之', '恩威并施', '边缘化'].map(t => {
                          const isSelected = simSelectedTactics.includes(t);
                          return (
                            <button
                              key={t}
                              onClick={() => {
                                playClick();
                                setSimSelectedTactics(prev =>
                                  prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                                );
                              }}
                              disabled={simLoading}
                              className={`text-[10px] py-1 px-3 rounded-full font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm'
                                  : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:bg-zinc-50'
                              }`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2 mb-6">
                      <label className="text-[10px] text-zinc-600 font-bold block">我的反制对策行动案 (My Tactical Strategy)</label>
                      <textarea
                        rows={4}
                        value={simAnswer}
                        onChange={(e) => setSimAnswer(e.target.value)}
                        placeholder="例如：“在会前私下与合规总监取得利益对齐，拉拢常务副总的心腹，在对立会议上抛出无可置辩的客观单据，并不直接表态，把球踢回给对方……”"
                        className="w-full bg-zinc-50/50 border border-zinc-200 focus:border-zinc-400 rounded-xl p-4 text-xs outline-none resize-none leading-relaxed font-medium font-semibold"
                        disabled={simLoading}
                      />
                    </div>

                    <button
                      onClick={handleStartSimPlay}
                      disabled={simLoading || !simAnswer.trim() || (!isPresetOpponent && (!simCustomName.trim() || !simCustomDilemma.trim()))}
                      className={`w-full py-4 rounded-xl text-xs tracking-widest uppercase font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        simLoading
                          ? 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm hover:scale-[1.01]'
                      }`}
                    >
                      {simLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                          <span>提交中...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-zinc-400" />
                          <span>启动人机博弈对决推演</span>
                        </>
                      )}
                    </button>

                    {(simLoading || simSubmitNotice || simSubmitError) && (
                      <div
                        className={`mt-4 rounded-2xl border px-4 py-3.5 text-xs leading-relaxed ${
                          simSubmitError
                            ? 'border-red-200 bg-red-50/80 text-red-800'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-700'
                        }`}
                        role={simSubmitError ? 'alert' : 'status'}
                      >
                        <div className="flex items-start gap-3">
                          {simLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin shrink-0 mt-0.5 text-zinc-500" />
                          ) : simSubmitError ? (
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                          ) : (
                            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-zinc-600" />
                          )}
                          <div className="min-w-0 flex-1 space-y-2">
                            <p className="font-semibold">
                              {simLoading
                                ? '正在提交到任务中心…'
                                : simSubmitError || simSubmitNotice}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {!simLoading && !simSubmitError && (
                                <button
                                  type="button"
                                  onClick={() => { playClick(); setTaskCenterOpen(true); }}
                                  className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-[10px] font-bold cursor-pointer hover:bg-zinc-800"
                                >
                                  打开任务中心
                                </button>
                              )}
                              {simSubmitError && (
                                <button
                                  type="button"
                                  onClick={() => { playClick(); setSimSubmitError(''); handleStartSimPlay(); }}
                                  className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-[10px] font-bold cursor-pointer hover:bg-zinc-800"
                                >
                                  重试
                                </button>
                              )}
                              {(simSubmitNotice || simSubmitError) && !simLoading && (
                                <button
                                  type="button"
                                  onClick={() => { playClick(); setSimSubmitNotice(''); setSimSubmitError(''); }}
                                  className="px-3 py-1.5 rounded-full border border-zinc-200 text-zinc-600 text-[10px] font-bold cursor-pointer hover:bg-white"
                                >
                                  关闭
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );

            return (
              <div className="space-y-6">
                {simShowResultStage && (
                  <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] overflow-hidden">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 md:px-5">
                      <div className="min-w-0 space-y-1">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block">实操对决评估</span>
                        <p className="text-xs text-zinc-800 font-semibold truncate">
                          {simOpponentLabel}
                          <span className="text-zinc-400 font-medium"> · {simModelLabel} · {simTacticsLabel}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => { playClick(); setSimFormExpanded(v => !v); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${simFormExpanded ? 'rotate-180' : ''}`} />
                          {simFormExpanded ? '收起录入' : '展开录入'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {simShowForm && (
                    <motion.div
                      key="sim-form"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      {simFormBlock}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })())}

          {renderGtTab('session', (
            <GameTheorySessionPanel />
          ))}

          {/* TAB: 对局历史 */}
          {renderGtTab('history', (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-zinc-600" /> 我的对局历史
                </h3>
                <button
                  type="button"
                  onClick={() => { playClick(); void loadHistory(); }}
                  className="text-[10px] font-bold text-zinc-500 hover:text-zinc-800 cursor-pointer"
                >
                  刷新
                </button>
              </div>
              {historyLoading ? (
                <div className="py-16 text-center text-xs text-zinc-400 font-bold">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> 加载中...
                </div>
              ) : historyItems.length === 0 ? (
                <div className="py-16 text-center text-xs text-zinc-400 font-medium border border-dashed border-zinc-200 rounded-2xl">
                  暂无对局记录。完成案例研判或人机对战后将自动归档到此处。
                </div>
              ) : (
                <div className="space-y-3">
                  {historyItems.map((item) => {
                    const highlighted = highlightHistoryId === item.id;
                    const expanded = expandedHistoryId === item.id;
                    const chainPreview = (item.causal_chain || []).slice(0, 2);
                    const suggestionPreview = (item.suggestion || '').slice(0, 40);
                    return (
                      <div
                        key={item.id}
                        id={`gt-history-${item.id}`}
                        className={`rounded-2xl border p-4 transition-all ${
                          highlighted
                            ? 'border-zinc-900 bg-zinc-50 ring-2 ring-zinc-300'
                            : 'border-zinc-200 bg-white'
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full text-left cursor-pointer"
                          onClick={() => {
                            playClick();
                            setExpandedHistoryId(expanded ? null : item.id);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                                  {item.source_type === 'simulation' ? '人机对战' : '案例研判'}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-mono">
                                  {new Date(item.created_at).toLocaleString()}
                                </span>
                              </div>
                              <h4 className="text-xs font-bold text-zinc-900 truncate">{item.title}</h4>
                              <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-semibold">
                                <span>分数 {item.score}</span>
                                <span>{item.is_success ? '破局' : '未破局'}</span>
                              </div>
                              {suggestionPreview && (
                                <p className="text-[11px] text-zinc-600 leading-relaxed">{suggestionPreview}{(item.suggestion || '').length > 40 ? '…' : ''}</p>
                              )}
                              {chainPreview.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                  {chainPreview.map((step, idx) => (
                                    <li key={idx} className="text-[10px] text-zinc-500 leading-relaxed">
                                      L{idx + 1}: {step}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                          </div>
                        </button>
                        {expanded && expandedDetail && expandedDetail.id === item.id && expandedDetail.full_result && (
                          <div className="mt-4 pt-4 border-t border-zinc-100 space-y-3">
                            <div className="rounded-xl p-4 bg-zinc-50 border border-zinc-100 text-center">
                              <p className="text-sm font-bold text-zinc-900 mb-1">
                                {expandedDetail.full_result.is_success ? '战略破局 ｜ 推演成功' : '遭受反噬 ｜ 推演预警'}
                              </p>
                              <p className="text-2xl font-black font-mono text-zinc-800">{expandedDetail.full_result.score}</p>
                            </div>
                            {expandedDetail.full_result.quality === 'below_standard' && (
                              <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-800 leading-relaxed">
                                {expandedDetail.full_result.quality_note || '研判内容未达要求，请完善后再试'}
                              </div>
                            )}
                            {item.source_type === 'simulation' ? (
                              <>
                                {expandedDetail.full_result.interest_chain && (
                                  <div className="bg-zinc-50/50 rounded-xl p-3 border border-zinc-100">
                                    <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">利益链</span>
                                    <p className="text-xs text-zinc-600 leading-relaxed">{expandedDetail.full_result.interest_chain}</p>
                                  </div>
                                )}
                                {expandedDetail.full_result.emotion_motives && (
                                  <div className="bg-zinc-50/50 rounded-xl p-3 border border-zinc-100">
                                    <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">情绪动机</span>
                                    <p className="text-xs text-zinc-600 leading-relaxed">{expandedDetail.full_result.emotion_motives}</p>
                                  </div>
                                )}
                                {Array.isArray(expandedDetail.full_result.strategy_guidance) && expandedDetail.full_result.strategy_guidance.length > 0 && (
                                  <div className="bg-zinc-50/50 rounded-xl p-3 border border-zinc-100">
                                    <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-2">博弈策略示例</span>
                                    <ul className="space-y-1.5">
                                      {expandedDetail.full_result.strategy_guidance.map((guide, gIdx) => (
                                        <li key={gIdx} className="text-xs text-zinc-600 leading-relaxed flex items-start gap-1.5">
                                          <span className="font-mono text-[10px] text-zinc-400 font-semibold shrink-0 mt-0.5">{gIdx + 1}.</span>
                                          <span>{guide}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </>
                            ) : (expandedDetail.full_result.interest_chain
                              || expandedDetail.full_result.emotion_motives
                              || expandedDetail.full_result.actionable_strategy
                              || expandedDetail.full_result.script_examples) ? (
                              <>
                                <div className="bg-zinc-50/50 rounded-xl p-3 border border-zinc-100">
                                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">利益链</span>
                                  <p className="text-xs text-zinc-600 leading-relaxed">{expandedDetail.full_result.interest_chain}</p>
                                </div>
                                <div className="bg-zinc-50/50 rounded-xl p-3 border border-zinc-100">
                                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">情绪动机</span>
                                  <p className="text-xs text-zinc-600 leading-relaxed">{expandedDetail.full_result.emotion_motives}</p>
                                </div>
                                <div className="bg-zinc-50/50 rounded-xl p-3 border border-zinc-100">
                                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">可执行策略</span>
                                  <p className="text-xs text-zinc-600 leading-relaxed">{expandedDetail.full_result.actionable_strategy}</p>
                                </div>
                                <div className="bg-zinc-50/50 rounded-xl p-3 border border-zinc-100">
                                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">话术示例</span>
                                  <p className="text-xs text-zinc-600 leading-relaxed">{expandedDetail.full_result.script_examples}</p>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="bg-zinc-50/50 rounded-xl p-3 border border-zinc-100">
                                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">利益结构</span>
                                  <p className="text-xs text-zinc-600 leading-relaxed">{expandedDetail.full_result.stakeholder_interests}</p>
                                </div>
                                <div className="bg-zinc-50/50 rounded-xl p-3 border border-zinc-100">
                                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">动机透视</span>
                                  <p className="text-xs text-zinc-600 leading-relaxed">{expandedDetail.full_result.motives_analysis}</p>
                                </div>
                                <div className="bg-zinc-50/50 rounded-xl p-3 border border-zinc-100">
                                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">权力弱点</span>
                                  <p className="text-xs text-zinc-600 leading-relaxed">{expandedDetail.full_result.weaknesses}</p>
                                </div>
                              </>
                            )}
                            <div className="bg-white rounded-xl p-3 border border-zinc-100">
                              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-2">因果传导链</span>
                              <div className="space-y-2">
                                {(expandedDetail.full_result.causal_chain || []).map((step, idx) => (
                                  <p key={idx} className="text-[11px] text-zinc-600 leading-relaxed">
                                    <span className="font-mono text-[9px] text-zinc-400 mr-1">L{idx + 1}</span>
                                    {step}
                                  </p>
                                ))}
                              </div>
                            </div>
                            <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-3">
                              <span className="text-[9px] text-zinc-800 font-bold uppercase tracking-wider block mb-1">建议</span>
                              <p className="text-xs text-zinc-700 leading-relaxed font-semibold">{expandedDetail.full_result.suggestion}</p>
                            </div>
                            {(expandedDetail.full_result.tone_corrections?.length ?? 0) > 0 && (
                              <ToneCorrectionTable
                                items={expandedDetail.full_result.tone_corrections || []}
                                repaired={Boolean(expandedDetail.full_result.tone_corrections_repaired)}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {renderGtTab('ascension', (

            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
              {/* 左 70%：5 层纵深因果链 */}
              <div className="lg:col-span-7 space-y-5">
                <div className="bg-white border border-zinc-200/80 rounded-[2rem] p-6 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)]">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-3">1. 录入待推演的管理事件 (Crisis Event Input)</span>
                  <textarea
                    value={ascEvent}
                    onChange={e => setAscEvent(e.target.value)}
                    placeholder="录入一个待穿透的管理事件 / 高管博弈现象（例如：新任外企VP在会议上将供应链延迟的责任隐性甩锅给我的团队…）"
                    className="w-full h-24 bg-zinc-50/50 border border-zinc-200 rounded-2xl p-4 text-xs text-zinc-800 shadow-inner focus:border-zinc-400 outline-none resize-none leading-relaxed"
                    disabled={ascLoading}
                  />
                </div>

                <div className="space-y-3">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block pl-2">2. 强制 5 层因果链推演 (Why-Why-Why Deduction)</span>
                  {ascLayers.map((val, i) => (
                    <div key={i}
                      className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] transition-all hover:shadow-md"
                      style={{ marginLeft: `${i * 12}px` }}  /* 纵深层叠错位 */
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Why · 第 {i + 1} 层穿透</span>
                      <input
                        value={val}
                        onChange={e => {
                          const n = [...ascLayers];
                          n[i] = e.target.value;
                          setAscLayers(n);
                        }}
                        placeholder={['表象之下的直接动因（为什么发生了这件事？）', '背后的结构性矛盾（为什么原体系没有拦截它？）', '历史周期与路径依赖（为什么这个机制会长期演化至此？）', '深层利益格局（谁在以此获利？核心利益同盟是什么？）', '终极规律 / 不可逆趋势（该现象背后的底线决定性趋势？）'][i]}
                        className="w-full mt-2 bg-transparent border-b border-zinc-100 py-1.5 text-xs text-zinc-800 outline-none focus:border-zinc-400"
                        disabled={ascLoading}
                      />
                    </div>
                  ))}
                </div>

                {ascError && (
                  <div className="w-full p-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{ascError}</span>
                  </div>
                )}
                <button 
                  onClick={handleAscensionSubmit} 
                  disabled={ascLoading || !ascEvent.trim() || ascLayers.some(l => !l.trim())}
                  className="w-full py-4 rounded-full text-xs tracking-widest uppercase font-bold bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm hover:scale-[1.01] transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {ascLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                      <span>纵深升维研判中…</span>
                    </>
                  ) : (
                    <>
                      <Compass className="w-4 h-4 text-zinc-400" />
                      <span>提交五层因果链并启动升维研判</span>
                    </>
                  )}
                </button>
              </div>

              {/* 右 30%：穿透维度 + 研判成果 */}
              <div className="lg:col-span-3 space-y-6">
                {/* 维度选择 */}
                <div className="bg-white rounded-[2rem] p-6 border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)]">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-4">选择自省与穿透维度 (Analysis Dimension)</span>
                  
                  <div className="flex flex-col gap-2">
                    {([
                      { id: 'structure', name: '穿透结构 (Structural)', desc: '剖析制度缺陷与流程孤岛' },
                      { id: 'history', name: '穿透历史 (Historical)', desc: '剖析路径依赖与演进周期' },
                      { id: 'self', name: '穿透自我 (Self-reflective)', desc: '剖析个人认知盲区与心智障壁' }
                    ] as const).map(dim => (
                      <button
                        key={dim.id}
                        onClick={() => { playClick(); setAscDimension(dim.id); }}
                        disabled={ascLoading}
                        className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                          ascDimension === dim.id
                            ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm'
                            : 'bg-zinc-50 border-zinc-200/40 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                        }`}
                      >
                        <span className="text-xs font-bold">{dim.name}</span>
                        <span className={`text-[9px] ${ascDimension === dim.id ? 'text-zinc-300' : 'text-zinc-400'}`}>{dim.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 研判成果展示 */}
                {ascResult && (
                  <div className="space-y-4 animate-fade-in text-left">
                    {/* 分数与达标状态 */}
                    <div className="bg-white rounded-[2rem] p-6 border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-2">认知纵深评估得分</span>
                      <div className="text-5xl font-black font-mono tracking-tighter text-zinc-800 mb-2">
                        {ascResult.depth_score}
                      </div>
                      <span className={`inline-block text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                        ascResult.is_passed
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                      }`}>
                        {ascResult.is_passed ? '✓ 认知升维解锁' : '✗ 纵深不足·未能解锁'}
                      </span>
                    </div>

                    {/* 逐层研判 */}
                    <div className="bg-white rounded-[2rem] p-5 border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] space-y-3">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-1">逐层研判明细 (Verdict details)</span>
                      <div className="space-y-3.5">
                        {ascResult.layer_feedback && ascResult.layer_feedback.map((item, idx) => (
                          <div key={idx} className="border-b border-zinc-100 pb-2.5 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">L{item.level} 穿透</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                item.verdict === '合格' || item.verdict === '优秀'
                                  ? 'bg-zinc-50 border border-zinc-200 text-zinc-700'
                                  : 'bg-zinc-100 text-zinc-500'
                              }`}>
                                {item.verdict}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-600 leading-relaxed font-medium">
                              <span className="text-zinc-400 font-bold">研判缝隙: </span>{item.gap || '无'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 终极规律 */}
                    {ascResult.ultimate_law && (
                      <div className="bg-zinc-900 text-zinc-100 rounded-[2rem] p-6 border border-zinc-800 shadow-md">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-2">AI 萃取的终极规律</span>
                        <p className="text-xs text-zinc-300 font-medium leading-relaxed italic">
                          “{ascResult.ultimate_law}”
                        </p>
                      </div>
                    )}

                    {/* 导师建议 */}
                    {ascResult.suggestion && (
                      <div className="bg-zinc-100 border border-zinc-200/80 rounded-[2rem] p-5">
                        <span className="text-[10px] text-zinc-800 font-bold uppercase tracking-wider block mb-2">升维自省建议 (Strategic Advice)</span>
                        <p className="text-xs text-zinc-700 leading-relaxed font-semibold">
                          {ascResult.suggestion}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showSuccessBadge && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[3000] flex items-center gap-3 bg-zinc-900 border border-zinc-800 text-white px-6 py-3.5 rounded-full shadow-2xl"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-zinc-950 font-black text-xs">✓</div>
            <span className="text-xs font-black uppercase tracking-widest text-zinc-100">博弈达成 (Game Theory Mastered)</span>
          </motion.div>
        )}
      </AnimatePresence>
    </ModuleWrapper>
  );
}
