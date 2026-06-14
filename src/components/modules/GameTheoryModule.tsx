import React, { useState, useEffect } from 'react';
import { 
  Brain, Swords, ShieldAlert, Zap, Loader2, Sparkles, Plus, Trash2, 
  Layers, AlertCircle, CheckCircle, HelpCircle, Trophy, UserCheck, Flame, Compass, X, BookOpen, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import ModuleWrapper from './ModuleWrapper';
import { playClick, playPageTurn, playGentleWarning } from '../../utils/soundEffects';
import { 
  runGameTheoryAnalysis, 
  getPersonalPrototypes, 
  upsertPersonalPrototype, 
  deletePersonalPrototype,
  GameTheoryAnalyzeInput, 
  GameTheoryAnalyzeResult, 
  PersonalPrototype,
  runCognitiveAscension,
  CognitiveAscensionResult
} from '../../services/difyAPI';

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
  const [activeTab, setActiveTab] = useState<'cases' | 'tactics' | 'simulation' | 'ascension'>('cases');
  
  // 顶层认知升维训练状态
  const [ascEvent, setAscEvent] = useState('');
  const [ascLayers, setAscLayers] = useState<string[]>(['', '', '', '', '']);
  const [ascDimension, setAscDimension] = useState<'history' | 'structure' | 'self'>('structure');
  const [ascLoading, setAscLoading] = useState(false);
  const [ascResult, setAscResult] = useState<CognitiveAscensionResult | null>(null);

  const handleAscensionSubmit = async () => {
    if (!ascEvent.trim() || ascLayers.some(l => !l.trim())) {
      playGentleWarning();
      return;
    }
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
        confetti({
          particleCount: 50,
          spread: 45,
          origin: { y: 0.6 },
          colors: ['#f4f4f5', '#e4e4e7', '#d4d4d8', '#fff']
        });
      } else {
        playGentleWarning();
      }
    } catch (e) {
      console.error(e);
      playGentleWarning();
    } finally {
      setAscLoading(false);
    }
  };

  const [activeEnv, setActiveEnv] = useState<'gov_struggle' | 'corp_clash' | 'upward_takeover'>('corp_clash');
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
  
  // 推演运行状态
  const [isLoading, setIsLoading] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [result, setResult] = useState<GameTheoryAnalyzeResult | null>(null);
  const [animateBorder, setAnimateBorder] = useState(false);

  // Simulation 对战沙盘状态
  const [simOpponentId, setSimOpponentId] = useState<'vp' | 'vice-gm' | 'director' | 'custom'>('vp');
  const [simCustomName, setSimCustomName] = useState('');
  const [simCustomType, setSimCustomType] = useState('利益驱动型');
  const [simCustomModel, setSimCustomModel] = useState<GameTheoryAnalyzeInput['game_model']>('prisoner_dilemma');
  const [simCustomDilemma, setSimCustomDilemma] = useState('');
  const [simAnswer, setSimAnswer] = useState('');
  const [simSelectedTactics, setSimSelectedTactics] = useState<string[]>([]);
  const [simLoading, setSimLoading] = useState(false);
  const [simScanStep, setSimScanStep] = useState('');
  const [simResult, setSimResult] = useState<GameTheoryAnalyzeResult | null>(null);
  const [simAnimateBorder, setSimAnimateBorder] = useState(false);

  const handleOpponentChange = (id: typeof simOpponentId) => {
    playClick();
    setSimOpponentId(id);
    setSimResult(null);
    setSimAnswer('');
    setSimSelectedTactics([]);
    if (id !== 'custom') {
      const opp = SIM_OPPONENTS.find(o => o.id === id);
      if (opp) {
        setSimSelectedTactics([]);
      }
    } else {
      setSimCustomName('');
      setSimCustomType('利益驱动型');
      setSimCustomModel('prisoner_dilemma');
      setSimCustomDilemma('');
    }
  };

  const handleStartSimPlay = async () => {
    let name = '';
    let type = '';
    let model: GameTheoryAnalyzeInput['game_model'] = 'prisoner_dilemma';
    let dilemma = '';
    let env: GameTheoryAnalyzeInput['scene_type'] = 'corp_clash';

    if (simOpponentId !== 'custom') {
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
    setSimResult(null);
    setSimAnimateBorder(true);

    playClick();
    const scanInterval = setInterval(() => playClick(), 1000);

    const steps = [
      '⚡ 接入驭心实操推演对战舱...',
      `⚡ 模拟与对手 [${name}] (${type}) 利益博弈...`,
      `⚡ 判定模型 [${model}] 触发条件...`,
      '⚡ 计算 10 重长程对局因果演化...',
      '⚡ 导出人机对决最终胜负评估中...'
    ];

    let currentStep = 0;
    setSimScanStep(steps[0]);
    const stepInterval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setSimScanStep(steps[currentStep]);
      }
    }, 1200);

    try {
      const caseTextFormatted = `【博弈对手姓名 / Name】: ${name}\n【人性分类 / Weakness Type】: ${type}\n【博弈局势描述 / Dilemma Detail】:\n${dilemma}`;
      const fullAnswer = `【玩家应对策略】：\n${simAnswer}`;
      
      const inputs: GameTheoryAnalyzeInput = {
        scene_type: env,
        game_model: model,
        case_text: caseTextFormatted,
        user_answer: fullAnswer,
        applied_tactics: simSelectedTactics.join(', ')
      };

      const res = await runGameTheoryAnalysis(inputs);
      
      clearInterval(scanInterval);
      clearInterval(stepInterval);
      setSimResult(res);
      setSimAnimateBorder(false);

      if (res.is_success) {
        playPageTurn();
        confetti({
          particleCount: 60,
          spread: 50,
          origin: { y: 0.6 },
          colors: ['#f4f4f5', '#e4e4e7', '#d4d4d8', '#ffffff']
        });
      } else {
        playGentleWarning();
      }
      
      fetchPrototypes();
    } catch (err: any) {
      clearInterval(scanInterval);
      clearInterval(stepInterval);
      setSimAnimateBorder(false);
      playGentleWarning();
      alert(err.message || '对决推演失败，请稍后再试');
    } finally {
      setSimLoading(false);
    }
  };

  // 加载人性原型档案
  useEffect(() => {
    fetchPrototypes();
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

  // 处理案例选中
  const selectPresetCase = (c: PresetCase) => {
    playClick();
    setCaseText(c.description);
    setSelectedModel(c.model);
    setSelectedTactics(c.defaultTactics);
    // 清空四个拆解维度，强制重新研判
    setStakeholderInterests('');
    setMotivesAnalysis('');
    setWeaknesses('');
    setKeyPoints('');
  };

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
      
      // 成功录入时播放翻页声并喷洒 Confetti 极简纸屑
      playPageTurn();
      confetti({
        particleCount: 50,
        spread: 45,
        origin: { y: 0.6 },
        colors: ['#f4f4f5', '#e4e4e7', '#d4d4d8', '#ffffff']
      });

      fetchPrototypes();
    } catch (err) {
      console.error(err);
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

  // 执行核心博弈模拟推演
  const handleStartSimulation = async () => {
    if (!caseText.trim() || !stakeholderInterests.trim() || !motivesAnalysis.trim() || !weaknesses.trim() || !keyPoints.trim()) return;
    setIsLoading(true);
    setResult(null);
    
    // 启动声光电“电”动效
    setAnimateBorder(true);
    
    // 开始声学循环扫射 (极简水滴声)
    playClick();
    const scanInterval = setInterval(() => playClick(), 1000);

    const steps = [
      '⚡ 接入驭心博弈高阶数据库...',
      '⚡ 拆解涉事各方核心利益网络...',
      '⚡ 解析对手人性弱点防御线...',
      '⚡ 启动 10 重长程因果传导链推演...',
      '⚡ 生成权力格局重组评定中...'
    ];

    let currentStep = 0;
    setScanStep(steps[0]);
    const stepInterval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setScanStep(steps[currentStep]);
      }
    }, 1200);

    try {
      // 组装参会关系人动态上下文作为危机场景的背景输入
      let enrichedCaseText = caseText;
      if (selectedProtoIds.length > 0) {
        const selectedProtos = prototypes.filter(p => selectedProtoIds.includes(p.id));
        const profilesString = selectedProtos
          .map((p, idx) => `${idx + 1}. [${p.name}] (分类: ${p.type}) - 特征: ${p.description || '暂无特征描述。'}`)
          .join('\n');
        
        enrichedCaseText = `【参会博弈对手特征 / Participant Profiles】:\n${profilesString}\n\n【危机场景详情 / Crisis Detail】:\n${caseText}`;
      }

      const fullAnswer = `① 利益结构分析：\n${stakeholderInterests}\n\n② 善/恶动机透视：\n${motivesAnalysis}\n\n③ 对方权力弱点：\n${weaknesses}\n\n④ 博弈关键节点：\n${keyPoints}`;

      const inputs: GameTheoryAnalyzeInput = {
        scene_type: activeEnv,
        game_model: selectedModel,
        case_text: enrichedCaseText,
        user_answer: fullAnswer,
        applied_tactics: selectedTactics.join(', ')
      };

      const res = await runGameTheoryAnalysis(inputs);
      
      clearInterval(scanInterval);
      clearInterval(stepInterval);
      
      setResult(res);
      setAnimateBorder(false);

      // 根据分析结果触发对应的声光电音效
      if (res.is_success) {
        playPageTurn();
        confetti({
          particleCount: 60,
          spread: 50,
          origin: { y: 0.6 },
          colors: ['#f4f4f5', '#e4e4e7', '#d4d4d8', '#ffffff'] // Zinc冷灰色调碎屑
        });
      } else {
        playGentleWarning();
      }
      
      // 自动刷新人性原型档案列表
      fetchPrototypes();
    } catch (err: any) {
      clearInterval(scanInterval);
      clearInterval(stepInterval);
      setAnimateBorder(false);
      playGentleWarning();
      alert(err.message || '推演引擎出现异常，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  // 环境过滤预设案例
  const filteredPresets = PRESET_CASES.filter(c => c.env === activeEnv);

  const downwardTactics = ['恩威并施', '制衡术', '分而治之', '边缘化'];
  const upwardTactics = ['借势上位', '构建联盟', '信息垄断', '软对抗'];

  // Tab 切换函数
  const handleTabChange = (tab: typeof activeTab) => {
    playPageTurn();
    setActiveTab(tab);
  };

  return (
    <ModuleWrapper 
      title="驭心 ｜ 高管层博弈系统" 
      icon={<Brain className="w-8 h-8 text-zinc-700" strokeWidth={2} />}
      description="核心定位：不仅是读文字，而是读结构、读政策背后的风向、读外企运作实质与漏洞。破阶到 0.01% 的战略决策底层操作系统。"
    >
      {/* 战略评估弹窗已改用右侧 30% Context Sheet */}

      {/* Tab 导航区域 */}
      <div className="flex border-b border-zinc-200/80 mb-8 overflow-x-auto">
        {([
          { id: 'cases', name: '高管斗争案例研判' },
          { id: 'tactics', name: '驭人术与人性档案' },
          { id: 'simulation', name: '人机对战沙盘' },
          { id: 'ascension', name: '顶层认知升维' }
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`py-3 px-6 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* TAB 1: 真实高管斗争案例库 */}
          {activeTab === 'cases' && (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">
              {/* 左侧主控工作区：展示 Context Sheet 时折叠为 7 列，否则为 10 列 */}
              <div className={`transition-all duration-300 lg:col-span-10 ${isLoading || result ? 'lg:col-span-7' : 'lg:col-span-10'}`}>
                <div className="grid grid-cols-1 md:grid-cols-10 gap-6 items-start">
                  
                  {/* 左面板 30%：环境与案例选择 */}
                  <div className="md:col-span-3 space-y-6">
                    <div className="bg-white rounded-[2rem] p-6 border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)]">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-3">博弈环境选择 (Environments)</span>
                      
                      <div className="flex flex-col gap-1.5 mb-6">
                        {([
                          { id: 'gov_struggle', name: '体制内政治' },
                          { id: 'corp_clash', name: '外企权斗局' },
                          { id: 'upward_takeover', name: '以下克上战' }
                        ] as const).map(env => (
                          <button 
                            key={env.id}
                            onClick={() => { playClick(); setActiveEnv(env.id); }}
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

                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-3">斗争案例选择 (Preset Cases)</span>
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
                    <div className={`bg-white rounded-[2rem] p-6 md:p-8 border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] transition-all duration-300 relative ${
                      animateBorder ? 'ring-2 ring-zinc-300' : ''
                    }`}>
                      {isLoading && (
                        <div className="absolute inset-x-0 top-0 h-0.5 bg-zinc-300 animate-pulse" />
                      )}

                      {/* 案例详情与模型 */}
                      <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100">
                        <h4 className="font-bold text-sm text-zinc-800 flex items-center gap-2">
                          <Swords className="w-4 h-4 text-zinc-600" /> 危机场景详情与沙盘装配
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

                      <div className="bg-zinc-50 border-l-2 border-zinc-500 p-4 rounded-xl mb-6">
                        <textarea 
                          rows={3}
                          value={caseText}
                          onChange={(e) => setCaseText(e.target.value)}
                          className="w-full bg-transparent border-none text-xs text-zinc-600 leading-relaxed font-medium placeholder-zinc-400 outline-none resize-none"
                          placeholder="请从左侧选择一个案例，或在此处直接编辑、手动输入你要演练的高管权力斗争案例详情..."
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
                          高层局势强制四维度拆解表单 (Forced Structural Analysis)
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
                        disabled={!caseText.trim() || !stakeholderInterests.trim() || !motivesAnalysis.trim() || !weaknesses.trim() || !keyPoints.trim() || isLoading}
                        className={`w-full py-4 rounded-full text-xs tracking-widest uppercase font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          isLoading 
                            ? 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed' 
                            : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm hover:scale-[1.01]'
                        }`}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                            <span>{scanStep}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-zinc-400" />
                            <span>提交四维研判并启动董事会推演</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 右侧 30% 上下文面板 (Context Sheet) */}
              <AnimatePresence>
                {(isLoading || result) && (
                  <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 50 }}
                    transition={{ duration: 0.3 }}
                    className="lg:col-span-3 space-y-6"
                  >
                    {/* Header with X Close Button to Clear Result */}
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">战略评估面板</span>
                      <button 
                        onClick={() => { playClick(); setResult(null); }}
                        className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer"
                        title="关闭评估"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Loading step tracker */}
                    {isLoading && (
                      <div className="bg-white rounded-[2rem] p-6 border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] text-center py-10">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-zinc-500 mb-3" />
                        <p className="text-xs text-zinc-600 font-bold">{scanStep}</p>
                      </div>
                    )}

                    {/* Results details */}
                    {result && (
                      <>
                        {/* 战略评估得分卡片 */}
                        <div className="rounded-[2rem] p-6 border border-zinc-200 text-center shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] bg-zinc-50">
                          {result.is_success ? (
                            <Trophy className="w-8 h-8 mx-auto text-zinc-700 mb-3 animate-bounce" />
                          ) : (
                            <ShieldAlert className="w-8 h-8 mx-auto text-zinc-600 mb-3" />
                          )}
                          <h4 className="text-sm font-bold text-zinc-900 mb-1">
                            {result.is_success ? '战略破局 ｜ 推演成功' : '遭受反噬 ｜ 推演预警'}
                          </h4>
                          <p className="text-zinc-500 text-[10px] font-medium mb-4 leading-relaxed">
                            {result.is_success 
                              ? '您的对策逻辑推演完全自洽，已成功撕裂敌对派系的防线漏洞。人性档案库已同步录入该角色的死穴。'
                              : '您的对策触碰了重复博弈中的“冷酷惩罚”红线，可能导致对方鱼死网破。请仔细查看下方因果推演报告进行策略调整。'
                            }
                          </p>
                          <div className="bg-white border border-zinc-100 rounded-xl py-3 px-6 shadow-inner">
                            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest block mb-0.5">Deduction Strategy Score</span>
                            <span className="text-3xl font-black font-mono tracking-tighter text-zinc-800">
                              {result.score}
                            </span>
                          </div>
                        </div>

                        {/* 详细评估报告 (垂直单列排布) */}
                        <div className="bg-white rounded-[2rem] p-6 border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] space-y-6">
                          <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                            <Compass className="w-4 h-4 text-zinc-600" /> 沙盘战略推演评估报告
                          </h3>

                          {/* 利益、动机、弱点 */}
                          <div className="space-y-4">
                            <div className="bg-zinc-50/50 rounded-xl p-4 border border-zinc-100 shadow-sm">
                              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">01 / 利益结构研判</span>
                              <p className="text-xs text-zinc-600 leading-relaxed font-medium">{result.stakeholder_interests}</p>
                            </div>
                            <div className="bg-zinc-50/50 rounded-xl p-4 border border-zinc-100 shadow-sm">
                              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">02 / 人性动机透视</span>
                              <p className="text-xs text-zinc-600 leading-relaxed font-medium">{result.motives_analysis}</p>
                            </div>
                            <div className="bg-zinc-50/50 rounded-xl p-4 border border-zinc-100 shadow-sm">
                              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">03 / 防线弱点死穴</span>
                              <p className="text-xs text-zinc-600 leading-relaxed font-medium">{result.weaknesses}</p>
                            </div>
                          </div>

                          {/* 十重因果链 */}
                          <div className="bg-white rounded-xl p-4 border border-zinc-100 shadow-inner">
                            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-3">
                              长程因果传导链 (10-Layer Chain)
                            </span>
                            
                            <div className="relative pl-4 border-l border-zinc-200 space-y-3">
                              {result.causal_chain && result.causal_chain.map((step, idx) => (
                                <div key={idx} className="relative group transition-all">
                                  <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full border border-white bg-zinc-300 group-hover:bg-zinc-950 transition-all shadow-sm" />
                                  <div className="flex items-start gap-2">
                                    <span className="text-[8px] font-bold font-mono bg-zinc-50 border border-zinc-200 text-zinc-500 rounded px-1 py-0.2 shadow-sm">
                                      L{idx + 1}
                                    </span>
                                    <p className="text-[11px] text-zinc-600 font-medium leading-relaxed">
                                      {step}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 对手人性归档 */}
                          {result.prototype_archive && (
                            <div className="bg-zinc-900 text-zinc-100 rounded-xl p-4 relative overflow-hidden border border-zinc-800 shadow-md">
                              <div className="flex items-center justify-between mb-2 relative z-10">
                                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
                                  对手人性归档分类
                                </span>
                                <span className="text-[8px] bg-zinc-800 border border-zinc-700 px-1.5 py-0.2 rounded font-bold text-zinc-300">
                                  已自动存库
                                </span>
                              </div>

                              <div className="relative z-10 space-y-1">
                                <h4 className="text-xs font-bold text-white">{result.prototype_archive.name}</h4>
                                <span className="text-[8px] bg-zinc-800 text-zinc-300 px-1.5 py-0.2 rounded font-bold inline-block">
                                  {result.prototype_archive.type}
                                </span>
                                <p className="text-[10px] text-zinc-400 font-medium leading-relaxed pt-1.5 border-t border-zinc-800/80">
                                  {result.prototype_archive.description}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* 导师建议 */}
                          <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-4">
                            <span className="text-[9px] text-zinc-800 font-bold uppercase tracking-wider block mb-1">
                              战略决策局盘点拨
                            </span>
                            <p className="text-xs text-zinc-700 leading-relaxed font-semibold">
                              {result.suggestion}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* TAB 2: 驭人术与人性档案 */}
          {activeTab === 'tactics' && (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
              {/* 左面板 60%：手段工具箱 */}
              <div className="lg:col-span-6 space-y-6">
                <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)]">
                  <h3 className="text-sm font-bold text-zinc-900 mb-6 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-zinc-600" /> 双向手段体系工具箱 (Tactics Toolkit)
                  </h3>

                  <div className="space-y-6">
                    {/* 上级驭下手段 */}
                    <div className="bg-zinc-50/50 border border-zinc-100 p-5 rounded-2xl">
                      <span className="text-[10px] bg-zinc-200 text-zinc-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-4 inline-block">
                        上级驭下手段
                      </span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        {downwardTactics.map(t => (
                          <div 
                            key={t}
                            onClick={() => {
                              playClick();
                              setSelectedTactics(prev => 
                                prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                              );
                            }}
                            className={`p-4 rounded-xl border transition-all cursor-pointer ${
                              selectedTactics.includes(t) 
                                ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' 
                                : 'bg-white border-zinc-200 text-zinc-800 hover:border-zinc-400'
                            }`}
                          >
                            <h4 className="text-xs font-bold mb-1 flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${selectedTactics.includes(t) ? 'bg-white' : 'bg-zinc-400'}`} />
                              {t}
                            </h4>
                            <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                              {t === '恩威并施' && '适时给予下属利益和资源，同时维持考核或问责的压力，使其产生敬畏之心。'}
                              {t === '制衡术' && '在两个或多个下属或部门之间制造合理的良性竞争或权利对抗，以防出现权力合谋或一方独大。'}
                              {t === '分而治之' && '隔离下属的信息沟通，打破其暗中建立的利益小同盟，分别进行管理和谈话。'}
                              {t === '边缘化' && '通过调整业务线、分管责任，收回核心资源，将不服从者逐步架空移出核心决策圈。'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 以下克上手段 */}
                    <div className="bg-zinc-50/50 border border-zinc-100 p-5 rounded-2xl">
                      <span className="text-[10px] bg-zinc-200 text-zinc-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-4 inline-block">
                        以下克上手段
                      </span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        {upwardTactics.map(t => (
                          <div 
                            key={t}
                            onClick={() => {
                              playClick();
                              setSelectedTactics(prev => 
                                prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                              );
                            }}
                            className={`p-4 rounded-xl border transition-all cursor-pointer ${
                              selectedTactics.includes(t) 
                                ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' 
                                : 'bg-white border-zinc-200 text-zinc-800 hover:border-zinc-400'
                            }`}
                          >
                            <h4 className="text-xs font-bold mb-1 flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${selectedTactics.includes(t) ? 'bg-white' : 'bg-zinc-400'}`} />
                              {t}
                            </h4>
                            <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                              {t === '借势上位' && '拉拢或利用外部更高层或总部总裁级的大人物（或风口机制），借用上层意志对直接主管施加无形制衡。'}
                              {t === '构建联盟' && '暗中横向联络其他被边缘化或受压迫的核心人员，组建信息互通与战术呼应的攻守同盟。'}
                              {t === '信息垄断' && '掌控唯一的关键业务细节、核心供应链关系或底层代码，使自己成为团队中无可替代的存在。'}
                              {t === '软对抗' && '不直接顶撞，而是通过效率降低、合规核查、汇报拖延等无破绽的制度化行为消极回击。'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
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
          )}

          {/* TAB 3: 博弈论实操推演（人机对战） */}
          {activeTab === 'simulation' && (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">
              {/* 左侧主控工作区：展示 Context Sheet 时折叠为 7 列，否则为 10 列 */}
              <div className={`transition-all duration-300 lg:col-span-10 ${simLoading || simResult ? 'lg:col-span-7' : 'lg:col-span-10'}`}>
                <div className="grid grid-cols-1 md:grid-cols-10 gap-6 items-start">
                  
                  {/* 左面板：对手与博弈模型选择 */}
                  <div className="md:col-span-3 space-y-6">
                    <div className="bg-white rounded-[2rem] p-6 border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)]">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-3">博弈对手选择 (Opponent Selection)</span>
                      
                      <div className="flex flex-col gap-1.5 mb-6">
                        {/* 预设对手按钮 */}
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
                        
                        {/* 自定义对手按钮 */}
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

                      {/* 自定义输入详情 */}
                      {simOpponentId === 'custom' && (
                        <div className="space-y-4 pt-4 border-t border-zinc-100">
                          {/* 快速装配下拉菜单 */}
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

                      {/* 内置对手信息卡片 */}
                      {simOpponentId !== 'custom' && (
                        <div className="pt-4 border-t border-zinc-100 space-y-2">
                          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block">已选对手特征</span>
                          <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 text-[10px] space-y-1.5">
                            <div><span className="text-zinc-400 font-semibold">弱点原型：</span><span className="font-bold text-zinc-700">{SIM_OPPONENTS.find(o => o.id === simOpponentId)?.type}</span></div>
                            <div><span className="text-zinc-400 font-semibold">推荐模型：</span><span className="font-bold text-zinc-700">{
                              SIM_OPPONENTS.find(o => o.id === simOpponentId)?.model === 'prisoner_dilemma' ? '囚徒困境演化版' :
                              SIM_OPPONENTS.find(o => o.id === simOpponentId)?.model === 'pig_game' ? '智猪潜藏博弈' :
                              SIM_OPPONENTS.find(o => o.id === simOpponentId)?.model === 'info_asymmetry' ? '极度信息不对称' : '冷酷触发策略'
                            }</span></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 右面板：博弈局势与反制策略录入 */}
                  <div className="md:col-span-7 space-y-6">
                    <div className={`bg-white rounded-[2rem] p-6 md:p-8 border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] transition-all duration-300 relative overflow-hidden ${
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

                      {/* 刁难情境/博弈局势展示与编辑 */}
                      <div className="bg-zinc-50 border-l-2 border-zinc-500 p-4 rounded-xl mb-6">
                        <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1.5">对手施压情境 (Opponent Crisis Scenario)</span>
                        {simOpponentId !== 'custom' ? (
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

                      {/* 勾选手段 */}
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

                      {/* 玩家应对方案录入 */}
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
                        disabled={simLoading || !simAnswer.trim() || (simOpponentId === 'custom' && (!simCustomName.trim() || !simCustomDilemma.trim()))}
                        className={`w-full py-4 rounded-full text-xs tracking-widest uppercase font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          simLoading
                            ? 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm hover:scale-[1.01]'
                        }`}
                      >
                        {simLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                            <span>{simScanStep}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-zinc-400" />
                            <span>启动人机博弈对决推演</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 右侧 30% 上下文面板 (Context Sheet) */}
              <AnimatePresence>
                {(simLoading || simResult) && (
                  <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 50 }}
                    transition={{ duration: 0.3 }}
                    className="lg:col-span-3 space-y-6"
                  >
                    {/* Header with X Close Button to Clear Result */}
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">实操对决评估</span>
                      <button 
                        onClick={() => { playClick(); setSimResult(null); }}
                        className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer"
                        title="关闭评估"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Loading status */}
                    {simLoading && (
                      <div className="bg-white rounded-[2rem] p-6 border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] text-center py-10">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-zinc-500 mb-3" />
                        <p className="text-xs text-zinc-600 font-bold">{simScanStep}</p>
                      </div>
                    )}

                    {/* Results details */}
                    {simResult && (
                      <>
                        {/* 战略评估得分卡片 */}
                        <div className="rounded-[2rem] p-6 border border-zinc-200 text-center shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] bg-zinc-50">
                          {simResult.is_success ? (
                            <Trophy className="w-8 h-8 mx-auto text-zinc-700 mb-3 animate-bounce" />
                          ) : (
                            <ShieldAlert className="w-8 h-8 mx-auto text-zinc-600 mb-3" />
                          )}
                          <h4 className="text-sm font-bold text-zinc-900 mb-1">
                            {simResult.is_success ? '战略破局 ｜ 对决成功' : '遭受反噬 ｜ 对决预警'}
                          </h4>
                          <p className="text-zinc-500 text-[10px] font-medium mb-4 leading-relaxed">
                            {simResult.is_success 
                              ? '您的人机对战策略成效卓越，成功化解对手攻势并占据博弈高位。'
                              : '您的方案被对手看穿并实施了强力反制，建议重新审视对手的人性特征缺陷与博弈边界。'
                            }
                          </p>
                          <div className="bg-white border border-zinc-100 rounded-xl py-3 px-6 shadow-inner">
                            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest block mb-0.5">Deduction Strategy Score</span>
                            <span className="text-3xl font-black font-mono tracking-tighter text-zinc-800">
                              {simResult.score}
                            </span>
                          </div>
                        </div>

                        {/* 详细评估报告 (垂直单列排布) */}
                        <div className="bg-white rounded-[2rem] p-6 border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] space-y-6">
                          <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                            <Compass className="w-4 h-4 text-zinc-600" /> 对局利益与人性推演报告
                          </h3>

                          {/* 利益、动机、弱点 */}
                          <div className="space-y-4">
                            <div className="bg-zinc-50/50 rounded-xl p-4 border border-zinc-100 shadow-sm">
                              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">01 / 利益结构研判</span>
                              <p className="text-xs text-zinc-600 leading-relaxed font-medium">{simResult.stakeholder_interests}</p>
                            </div>
                            <div className="bg-zinc-50/50 rounded-xl p-4 border border-zinc-100 shadow-sm">
                              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">02 / 人性动机透视</span>
                              <p className="text-xs text-zinc-600 leading-relaxed font-medium">{simResult.motives_analysis}</p>
                            </div>
                            <div className="bg-zinc-50/50 rounded-xl p-4 border border-zinc-100 shadow-sm">
                              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">03 / 对手防御漏洞</span>
                              <p className="text-xs text-zinc-600 leading-relaxed font-medium">{simResult.weaknesses}</p>
                            </div>
                          </div>

                          {/* 十重因果链 */}
                          <div className="bg-white rounded-xl p-4 border border-zinc-100 shadow-inner">
                            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-3">
                              长程因果传导链 (10-Layer Chain)
                            </span>
                            
                            <div className="relative pl-4 border-l border-zinc-200 space-y-3">
                              {simResult.causal_chain && simResult.causal_chain.map((step, idx) => (
                                <div key={idx} className="relative group transition-all">
                                  <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full border border-white bg-zinc-300 group-hover:bg-zinc-950 transition-all shadow-sm" />
                                  <div className="flex items-start gap-2">
                                    <span className="text-[8px] font-bold font-mono bg-zinc-50 border border-zinc-200 text-zinc-500 rounded px-1 py-0.2 shadow-sm">
                                      L{idx + 1}
                                    </span>
                                    <p className="text-[11px] text-zinc-600 font-medium leading-relaxed">
                                      {step}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 对手人性归档 */}
                          {simResult.prototype_archive && (
                            <div className="bg-zinc-900 text-zinc-100 rounded-xl p-4 relative overflow-hidden border border-zinc-800 shadow-md">
                              <div className="flex items-center justify-between mb-2 relative z-10">
                                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
                                  对手人性归档分类
                                </span>
                                <span className="text-[8px] bg-zinc-800 border border-zinc-700 px-1.5 py-0.2 rounded font-bold text-zinc-300">
                                  已自动存库
                                </span>
                              </div>

                              <div className="relative z-10 space-y-1">
                                <h4 className="text-xs font-bold text-white">{simResult.prototype_archive.name}</h4>
                                <span className="text-[8px] bg-zinc-800 text-zinc-300 px-1.5 py-0.2 rounded font-bold inline-block">
                                  {simResult.prototype_archive.type}
                                </span>
                                <p className="text-[10px] text-zinc-400 font-medium leading-relaxed pt-1.5 border-t border-zinc-800/80">
                                  {simResult.prototype_archive.description}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* 导师建议 */}
                          <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-4">
                            <span className="text-[9px] text-zinc-800 font-bold uppercase tracking-wider block mb-1">
                              战略对决局盘点拨
                            </span>
                            <p className="text-xs text-zinc-700 leading-relaxed font-semibold">
                              {simResult.suggestion}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* TAB 4: 顶层认知升维 */}
          {activeTab === 'ascension' && (
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
          )}
        </motion.div>
      </AnimatePresence>
    </ModuleWrapper>
  );
}
