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
  PersonalPrototype 
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

export default function GameTheoryModule() {
  const [activeTab, setActiveTab] = useState<'cases' | 'tactics' | 'simulation' | 'ascension'>('cases');
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
  
  // 声光电弹框状态
  const [showAlert, setShowAlert] = useState(false);
  const [alertType, setAlertType] = useState<'success' | 'fail'>('success');
  const [animateBorder, setAnimateBorder] = useState(false);

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

      // 根据分析结果触发对应的声光电弹窗
      if (res.is_success) {
        setAlertType('success');
        playPageTurn();
        confetti({
          particleCount: 60,
          spread: 50,
          origin: { y: 0.6 },
          colors: ['#f4f4f5', '#e4e4e7', '#d4d4d8', '#ffffff'] // Zinc冷灰色调碎屑
        });
      } else {
        setAlertType('fail');
        playGentleWarning();
      }
      setShowAlert(true);
      
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
      {/* 声光电高能动态弹窗 - 已改造为极简高端行政风微投影卡片 */}
      {showAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm transition-all">
          <div className="relative max-w-lg w-full rounded-[2rem] p-8 md:p-10 border border-zinc-200/80 bg-white shadow-[0_12px_40px_-6px_rgba(9,9,11,0.08)] overflow-hidden">
            <div className="flex flex-col items-center text-center relative z-10">
              {alertType === 'success' ? (
                <div className="w-16 h-16 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-6 shadow-sm">
                  <Trophy className="w-8 h-8 text-zinc-700" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-6 shadow-sm">
                  <ShieldAlert className="w-8 h-8 text-zinc-600" />
                </div>
              )}

              <h3 className="text-xl font-bold tracking-wider mb-2 text-zinc-900">
                {alertType === 'success' ? '战略破局 ｜ 推演成功' : '遭受反噬 ｜ 推演预警'}
              </h3>
              
              <p className="text-zinc-500 text-xs font-medium mb-6 leading-relaxed">
                {alertType === 'success' 
                  ? '您的对策逻辑推演完全自洽，已成功撕裂敌对派系的防线漏洞。人性档案库已同步录入该角色的死穴。'
                  : '您的对策触碰了重复博弈中的“冷酷惩罚”红线，可能导致对方鱼死网破。请仔细查看下方因果推演报告进行策略调整。'
                }
              </p>

              <div className="bg-zinc-50 border border-zinc-100 rounded-2xl py-4 px-8 w-full mb-6 shadow-sm">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-1">Deduction Strategy Score</span>
                <span className="text-5xl font-black font-mono tracking-tighter text-zinc-800">
                  {result?.score ?? 0}
                </span>
                    {/* TAB 1: 真实高管斗争案例库 */}
          {activeTab === 'cases' && (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
              {/* 左面板 30%：环境与案例选择 */}
              <div className="lg:col-span-3 space-y-6">
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
              <div className="lg:col-span-7 space-y-6">
                <div className={`bg-white rounded-[2rem] p-6 md:p-8 border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] transition-all duration-300 relative overflow-hidden ${
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
                          className="w-full bg-zinc-50/50 border border-zinc-200 focus:border-zinc-400 rounded-xl p-3 text-xs outline-none resize-none leading-relaxed"
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
                          className="w-full bg-zinc-50/50 border border-zinc-200 focus:border-zinc-400 rounded-xl p-3 text-xs outline-none resize-none leading-relaxed"
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
                          className="w-full bg-zinc-50/50 border border-zinc-200 focus:border-zinc-400 rounded-xl p-3 text-xs outline-none resize-none leading-relaxed"
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
                          className="w-full bg-zinc-50/50 border border-zinc-200 focus:border-zinc-400 rounded-xl p-3 text-xs outline-none resize-none leading-relaxed"
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

                {/* 实时分析成果报告区 */}
                {result && (
                  <div className="bg-zinc-50/50 border border-zinc-200/80 rounded-[2rem] p-6 md:p-8 space-y-6 animate-fade-in">
                    <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                      <Compass className="w-4 h-4 text-zinc-600" /> 沙盘战略推演评估报告 (Simulation Report)
                    </h3>

                    {/* 三大支柱分析卡片 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white rounded-2xl p-5 border border-zinc-200/60 shadow-sm flex flex-col">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-2">01 / 利益结构研判</span>
                        <p className="text-xs text-zinc-600 leading-relaxed font-medium flex-1">{result.stakeholder_interests}</p>
                      </div>
                      <div className="bg-white rounded-2xl p-5 border border-zinc-200/60 shadow-sm flex flex-col">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-2">02 / 人性动机透视</span>
                        <p className="text-xs text-zinc-600 leading-relaxed font-medium flex-1">{result.motives_analysis}</p>
                      </div>
                      <div className="bg-white rounded-2xl p-5 border border-zinc-200/60 shadow-sm flex flex-col">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">03 / 防线弱点死穴</span>
                        <p className="text-xs text-zinc-600 leading-relaxed font-medium flex-1">{result.weaknesses}</p>
                      </div>
                    </div>

                    {/* 十重因果链条 */}
                    <div className="bg-white rounded-2xl p-6 border border-zinc-200/60 shadow-sm">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-4">
                        长程因果传导链（10-Layer Causal Chain）
                      </span>
                      
                      <div className="relative pl-6 border-l border-zinc-200 space-y-4">
                        {result.causal_chain && result.causal_chain.map((step, idx) => (
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
                      className="space-y-3 pr-1 block w-full"
                      style={{ maxHeight: '420px', overflowY: 'auto' }}
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

          {/* TAB 3: 博弈实操推演（后续开发占位） */}
          {activeTab === 'simulation' && (
            <div className="bg-white rounded-[2rem] p-8 border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] text-center py-16">
              <Brain className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
              <h3 className="text-base font-bold text-zinc-800 mb-2">博弈论实操推演（人机对战）</h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                在该模块中，您将扮演己方角色，并在下拉菜单中挑选如“空降的改革派 VP”、“多疑的总监”等对手，与 AI 自动匹配模拟对峙，推演长程因果与退路分寸。
              </p>
              <div className="mt-6 inline-block bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2 text-[10px] font-bold text-zinc-500">
                下一阶段开发中...
              </div>
            </div>
          )}

          {/* TAB 4: 顶层认知升维（后续开发占位） */}
          {activeTab === 'ascension' && (
            <div className="bg-white rounded-[2rem] p-8 border border-zinc-200/80 shadow-[0_4px_20px_-4px_rgba(9,9,11,0.04)] text-center py-16">
              <BookOpen className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
              <h3 className="text-base font-bold text-zinc-800 mb-2">顶层认知升维训练</h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                强制进行 5 层纵深的因果链推演（Why-Why-Why 练习），辅以“穿透历史”、“穿透结构”、“穿透自我”等战略自省维度，锻造决策战略家大脑。
              </p>
              <div className="mt-6 inline-block bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2 text-[10px] font-bold text-zinc-500">
                下一阶段开发中...
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </ModuleWrapper>
  );
}
