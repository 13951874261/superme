import React, { useState, useEffect } from 'react';
import { 
  Brain, Swords, ShieldAlert, Zap, Loader2, Sparkles, Plus, Trash2, 
  Layers, AlertCircle, CheckCircle, HelpCircle, Trophy, UserCheck, Flame, Compass, X
} from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
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

  // 切换参会人选择
  const toggleParticipant = (id: string) => {
    playAudioEffect('tactic');
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

  // 初始化音效 (声)
  const playAudioEffect = (type: 'scan' | 'success' | 'fail' | 'click' | 'tactic') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      
      if (type === 'scan') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start();
        osc.stop(now + 0.15);
      } else if (type === 'click') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.setValueAtTime(800, now + 0.04);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start();
        osc.stop(now + 0.04);
      } else if (type === 'tactic') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start();
        osc.stop(now + 0.08);
      } else if (type === 'success') {
        // C major ascending triad sweep
        const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + idx * 0.06);
          gain.gain.setValueAtTime(0.1, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.35);
        });
      } else if (type === 'fail') {
        // Descending dissonant synth tone
        const freqs = [311.13, 277.18, 220.0, 146.83]; // Eb4, C#4, A3, D3
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, now + idx * 0.05);
          osc.frequency.exponentialRampToValueAtTime(f * 0.6, now + idx * 0.05 + 0.4);
          gain.gain.setValueAtTime(0.06, now + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.5);
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.5);
        });
      }
    } catch (e) {
      console.log('Audio not supported', e);
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
    playAudioEffect('click');
    setCaseText(c.description);
    setSelectedModel(c.model);
    setSelectedTactics(c.defaultTactics);
  };

  // 手动添加原型档案
  const handleAddProto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProtoName.trim()) return;
    playAudioEffect('click');
    try {
      await upsertPersonalPrototype({
        name: newProtoName,
        type: newProtoType,
        description: newProtoDesc
      });
      setNewProtoName('');
      setNewProtoDesc('');
      fetchPrototypes();
    } catch (err) {
      console.error(err);
    }
  };

  // 删除原型档案
  const handleDeleteProto = async (id: string) => {
    playAudioEffect('click');
    try {
      await deletePersonalPrototype(id);
      fetchPrototypes();
    } catch (err) {
      console.error(err);
    }
  };

  // 切换战术标签
  const toggleTactic = (t: string) => {
    playAudioEffect('tactic');
    if (selectedTactics.includes(t)) {
      setSelectedTactics(selectedTactics.filter(x => x !== t));
    } else {
      setSelectedTactics([...selectedTactics, t]);
    }
  };

  // 执行核心博弈模拟推演
  const handleStartSimulation = async () => {
    if (!caseText.trim() || !userAnswer.trim()) return;
    setIsLoading(true);
    setResult(null);
    
    // 启动声光电“电”动效
    setAnimateBorder(true);
    
    // 开始声学循环扫射
    playAudioEffect('scan');
    const scanInterval = setInterval(() => playAudioEffect('scan'), 1000);

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

      const inputs: GameTheoryAnalyzeInput = {
        scene_type: activeEnv,
        game_model: selectedModel,
        case_text: enrichedCaseText,
        user_answer: userAnswer,
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
        playAudioEffect('success');
      } else {
        setAlertType('fail');
        playAudioEffect('fail');
      }
      setShowAlert(true);
      
      // 自动刷新人性原型档案列表
      fetchPrototypes();
    } catch (err: any) {
      clearInterval(scanInterval);
      clearInterval(stepInterval);
      setAnimateBorder(false);
      playAudioEffect('fail');
      alert(err.message || '推演引擎出现异常，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  // 环境过滤预设案例
  const filteredPresets = PRESET_CASES.filter(c => c.env === activeEnv);

  const downwardTactics = ['恩威并施', '制衡术', '分而治之', '边缘化'];
  const upwardTactics = ['借势上位', '构建联盟', '信息垄断', '软对抗'];

  return (
    <ModuleWrapper 
      title="驭心 ｜ 高管层博弈系统" 
      icon={<Brain className="w-8 h-8 text-indigo-400" strokeWidth={2.5} />}
      description="核心定位：不仅是读文字，而是读结构、读政策背后的风向、读外企运作实质与漏洞。破阶到 0.01% 的战略决策底层操作系统。"
    >
      {/* 声光电高能动态弹窗 (Sound, Light, and Electricity Alert Modal) */}
      {showAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all animate-fade-in">
          <div className={`relative max-w-lg w-full rounded-[2.5rem] p-8 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden border ${
            alertType === 'success' 
              ? 'bg-slate-900/90 border-emerald-500/30 shadow-emerald-500/10' 
              : 'bg-slate-900/90 border-rose-500/30 shadow-rose-500/10'
          }`}>
            {/* 顶层激光扫射光条 (Electricity Effect) */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${
              alertType === 'success' ? 'from-emerald-400 via-cyan-400 to-emerald-400' : 'from-rose-400 via-amber-400 to-rose-400'
            } animate-[pulse_1.5s_infinite]`} />
            
            {/* 炫光背景球 */}
            <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 opacity-30 ${
              alertType === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
            }`} />

            <div className="flex flex-col items-center text-center relative z-10">
              {alertType === 'success' ? (
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)] animate-[bounce_1s_infinite]">
                  <Trophy className="w-10 h-10 text-emerald-400" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(244,63,94,0.2)] animate-[bounce_1s_infinite]">
                  <ShieldAlert className="w-10 h-10 text-rose-400" />
                </div>
              )}

              <h3 className={`text-2xl font-black tracking-wider mb-2 ${
                alertType === 'success' ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {alertType === 'success' ? '战略破局 ｜ 推演成功' : '遭受反噬 ｜ 推演预警'}
              </h3>
              
              <p className="text-gray-400 text-sm font-medium mb-6 leading-relaxed">
                {alertType === 'success' 
                  ? '您的对策逻辑推演完全自洽，已成功撕裂敌对派系的防线漏洞。人性档案库已同步录入该角色的死穴。'
                  : '您的对策触碰了重复博弈中的“冷酷惩罚”红线，可能导致对方鱼死网破。请仔细查看下方因果推演报告进行策略调整。'
                }
              </p>

              <div className="bg-slate-950/80 border border-white/5 rounded-2xl py-5 px-8 w-full mb-8 backdrop-blur-inner shadow-inner">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Deduction Strategy Score</span>
                <span className={`text-5xl font-black font-mono tracking-tighter ${
                  alertType === 'success' ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                }`}>
                  {result?.score ?? 0}
                </span>
              </div>

              <button 
                onClick={() => { playAudioEffect('click'); setShowAlert(false); }}
                className={`w-full py-4 rounded-full font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${
                  alertType === 'success' 
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:scale-[1.02]' 
                    : 'bg-rose-500 hover:bg-rose-600 text-white shadow-[0_4px_20px_rgba(244,63,94,0.3)] hover:scale-[1.02]'
                }`}
              >
                进入沙盘详阅推演报告 <CheckCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 核心 70/30 双面板折叠布局 (Spatial Folding Layout Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
        
        {/* 左面板 70%：高维博弈沙盘与因果链 (Deduction Dashboard) */}
        <div className="lg:col-span-7 space-y-6">
          <div className={`bg-white rounded-[2.5rem] p-6 md:p-8 shadow-sm transition-all duration-300 relative overflow-hidden ${
            animateBorder ? 'ring-4 ring-indigo-500/20 shadow-indigo-500/5' : ''
          }`}>
            {/* 顶层动态霓虹扫描条 (Electricity Effect) */}
            {isLoading && (
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-pulse" />
            )}

            {/* 环境与博弈模型控制器 */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between pb-6 mb-6 gap-4 border-b border-slate-100">
              <div className="flex bg-slate-100 p-1.5 rounded-full max-w-max">
                <button 
                  onClick={() => { playAudioEffect('click'); setActiveEnv('gov_struggle'); }}
                  className={`py-2 px-5 text-xs font-black tracking-wider rounded-full transition-all ${
                    activeEnv === 'gov_struggle' 
                      ? 'bg-slate-900 text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >体制内政治</button>
                <button 
                  onClick={() => { playAudioEffect('click'); setActiveEnv('corp_clash'); }}
                  className={`py-2 px-5 text-xs font-black tracking-wider rounded-full transition-all ${
                    activeEnv === 'corp_clash' 
                      ? 'bg-slate-900 text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >外企权斗局</button>
                <button 
                  onClick={() => { playAudioEffect('click'); setActiveEnv('upward_takeover'); }}
                  className={`py-2 px-5 text-xs font-black tracking-wider rounded-full transition-all ${
                    activeEnv === 'upward_takeover' 
                      ? 'bg-slate-900 text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >以下克上战</button>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Game Model:</span>
                <select 
                  value={selectedModel}
                  onChange={(e) => { playAudioEffect('click'); setSelectedModel(e.target.value as any); }}
                  className="border-none bg-slate-100 text-slate-700 rounded-full px-4 py-2 text-xs font-bold outline-none cursor-pointer hover:bg-slate-200 transition-colors"
                >
                  <option value="prisoner_dilemma">囚徒困境演化版</option>
                  <option value="pig_game">智猪潜藏博弈</option>
                  <option value="info_asymmetry">极度信息不对称</option>
                  <option value="cold_trigger">冷酷触发策略</option>
                </select>
              </div>
            </div>

            {/* 高能危机案例推送卡片 */}
            <div className="mb-6">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-2">尖锐斗争案例库 (Preset cases):</span>
              <div className="flex flex-wrap gap-2 mb-4">
                {filteredPresets.map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectPresetCase(c)}
                    className="bg-slate-50 hover:bg-indigo-50 border border-slate-200/60 hover:border-indigo-200 text-slate-600 hover:text-indigo-600 py-1.5 px-3 rounded-full text-xs font-medium transition-all flex items-center gap-1.5"
                  >
                    <Flame className="w-3 h-3 text-indigo-400" />
                    {c.title}
                  </button>
                ))}
              </div>

              <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-l-4 border-indigo-500 p-5 rounded-2xl relative">
                <h4 className="font-bold text-sm text-slate-800 mb-1 flex items-center gap-2">
                  <Swords className="w-4 h-4 text-indigo-500" /> 危机场景详情 (Crisis Detail)
                </h4>
                <textarea 
                  rows={4}
                  value={caseText}
                  onChange={(e) => setCaseText(e.target.value)}
                  className="w-full bg-transparent border-none text-xs text-slate-600 leading-relaxed font-medium placeholder-slate-400 outline-none resize-none"
                  placeholder="选择上方预设或手动输入你要演练的体制内、外企或以下克上高管权力斗争案例..."
                />
              </div>
            </div>

            {/* 战术工具箱 - 双向权力手段选择器 */}
            <div className="mb-6 bg-slate-50/60 rounded-3xl p-5 border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-3">权力手段装配箱 (Applied Tactics):</span>
              
              <div className="space-y-3">
                {/* 驭下手段 */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded uppercase tracking-wider">上级驭下</span>
                  {downwardTactics.map(t => (
                    <button
                      key={t}
                      onClick={() => toggleTactic(t)}
                      className={`text-xs py-1 px-3 rounded-full font-bold transition-all border ${
                        selectedTactics.includes(t) 
                          ? 'bg-slate-900 border-slate-900 text-white shadow-sm scale-105' 
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                      }`}
                    >{t}</button>
                  ))}
                </div>

                {/* 逆袭手段 */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider">以下克上</span>
                  {upwardTactics.map(t => (
                    <button
                      key={t}
                      onClick={() => toggleTactic(t)}
                      className={`text-xs py-1 px-3 rounded-full font-bold transition-all border ${
                        selectedTactics.includes(t) 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm scale-105' 
                          : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-400'
                      }`}
                    >{t}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* 关系人装配箱 - 选择参与博弈的已存对手性格原型 */}
            <div className="mb-6 bg-slate-50/60 rounded-3xl p-5 border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-3 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                关系人装配箱 (Participants Context):
              </span>
              
              {prototypes.length === 0 ? (
                <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                  暂无已收录的人性档案。您可在推演成功后自动收录或在右侧面板手动录入，随后在此将他们“装配”入会议或对峙现场。
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {prototypes.map(p => {
                    const isSelected = selectedProtoIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleParticipant(p.id)}
                        className={`text-xs py-1.5 px-3.5 rounded-full font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm scale-105'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-400 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
                        {p.name} ({p.type})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 决策陈述输入框 */}
            <div className="mb-6">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-2">你的决策与反制行动策略 (Your Action Strategy):</span>
              <div className="bg-slate-900 rounded-3xl p-1 shadow-inner focus-within:ring-2 focus-within:ring-indigo-500/30 transition-all">
                <textarea 
                  rows={6}
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full bg-transparent p-5 text-sm text-slate-100 outline-none resize-none leading-relaxed placeholder-slate-600 font-semibold"
                  placeholder="在此写出你在高管班子会或争端中打算采取的具体对策、话术、反制手段及利益分配方案..."
                />
              </div>
            </div>

            <button 
              onClick={handleStartSimulation}
              disabled={!caseText.trim() || !userAnswer.trim() || isLoading}
              className={`w-full py-5 rounded-full text-sm tracking-[0.25em] uppercase font-black transition-all flex items-center justify-center gap-2 ${
                isLoading 
                  ? 'bg-indigo-950 text-indigo-400 opacity-80 cursor-not-allowed' 
                  : 'bg-slate-900 hover:bg-slate-950 text-white shadow-lg shadow-slate-900/10 hover:shadow-indigo-500/10 hover:-translate-y-[1px]'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                  <span>{scanStep}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <span>启动 AI 高管董事会推演战</span>
                </>
              )}
            </button>
          </div>

          {/* 实时分析成果报告区 (Report Detail Area) */}
          {result && (
            <div className="bg-slate-50/60 border border-slate-200/60 rounded-[2.5rem] p-6 md:p-8 animate-fade-in space-y-6">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Compass className="w-5 h-5 text-indigo-500" /> 沙盘战略推演评估报告 (Simulation Report)
              </h3>

              {/* 三大支柱分析卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">01 / 利益结构研判</span>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold flex-1">{result.stakeholder_interests}</p>
                </div>
                <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">02 / 人性动机透视</span>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold flex-1">{result.motives_analysis}</p>
                </div>
                <div className="bg-white rounded-3xl p-5 border border-indigo-100 shadow-sm flex flex-col bg-indigo-50/10">
                  <span className="text-[10px] text-indigo-600 font-black uppercase tracking-wider mb-2">03 / 防线弱点死穴</span>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold flex-1">{result.weaknesses}</p>
                </div>
              </div>

              {/* 十重因果链条（5-10层推演） */}
              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-4">
                  长程因果传导链（10-Layer Causal Chain）
                </span>
                
                <div className="relative pl-6 border-l-2 border-slate-100 space-y-4">
                  {result.causal_chain && result.causal_chain.map((step, idx) => (
                    <div key={idx} className="relative group hover:pl-2 transition-all">
                      {/* 小圆点节点 */}
                      <span className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-4 border-white bg-slate-300 group-hover:bg-indigo-500 group-hover:scale-110 transition-all flex items-center justify-center shadow-sm" />
                      
                      <div className="flex items-start gap-3">
                        <span className="text-[9px] font-black font-mono bg-slate-100 border border-slate-200 text-slate-500 rounded px-1.5 py-0.5 shadow-sm">
                          L{idx + 1}
                        </span>
                        <p className="text-xs text-slate-600 font-semibold group-hover:text-slate-900 transition-colors leading-relaxed">
                          {step}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 人性原型归档 */}
              {result.prototype_archive && (
                <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 relative overflow-hidden border border-slate-800 shadow-xl">
                  {/* 装饰霓虹点 */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
                  
                  <div className="flex items-center justify-between mb-3 relative z-10">
                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">
                      对手人性归档分类 (Archived Prototype)
                    </span>
                    <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <UserCheck className="w-2.5 h-2.5" /> 已自动存库
                    </span>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center gap-4 relative z-10">
                    <div>
                      <h4 className="text-base font-black text-white">{result.prototype_archive.name}</h4>
                      <span className="text-[10px] bg-slate-800 text-indigo-300 px-2 py-0.5 rounded font-black mt-1 inline-block">
                        {result.prototype_archive.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium leading-relaxed flex-1 border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-4">
                      {result.prototype_archive.description}
                    </p>
                  </div>
                </div>
              )}

              {/* 导师建议 */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-5">
                <span className="text-[10px] text-amber-500 font-black uppercase tracking-wider block mb-2">
                  战略决策局盘点拨 (Strategic Counsel)
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                  {result.suggestion}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 右面板 30%：人性原型分类档案库 (Profiles Folder) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* 人性分类原型创建卡片 */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-500" /> 手动收录人性档案
            </h3>

            <form onSubmit={handleAddProto} className="space-y-4">
              <div>
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">姓名 / 角色 (Name)</label>
                <input 
                  type="text" 
                  value={newProtoName}
                  onChange={(e) => setNewProtoName(e.target.value)}
                  placeholder="如：James VP"
                  className="w-full bg-slate-50 border border-slate-200/60 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">人性弱点分类 (Type)</label>
                <select 
                  value={newProtoType}
                  onChange={(e) => setNewProtoType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/60 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="利益驱动型">利益驱动型</option>
                  <option value="恐惧驱动型">恐惧驱动型</option>
                  <option value="面子驱动型">面子驱动型</option>
                  <option value="安全感驱动型">安全感驱动型</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">特征与防范策略 (Description)</label>
                <textarea 
                  value={newProtoDesc}
                  onChange={(e) => setNewProtoDesc(e.target.value)}
                  placeholder="描述其软肋、最怕什么、如何通过利益或面子将其绑定..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200/60 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-black tracking-widest uppercase transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> 录入档案册
              </button>
            </form>
          </div>

          {/* 原型卡片折叠库 */}
          <div className="bg-slate-900 text-slate-100 rounded-[2.5rem] p-6 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
              <h3 className="text-xs font-black tracking-widest uppercase text-indigo-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" /> 人性分类档案库
              </h3>
              <span className="text-[10px] font-black font-mono bg-slate-800 px-2 py-0.5 rounded text-gray-400">
                {prototypes.length} PROTOS
              </span>
            </div>

            {prototypes.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-semibold leading-relaxed">
                <HelpCircle className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                推演成功后系统将自动<br />在此捕获并记录人性原型。
              </div>
            ) : (
              <div 
                className="space-y-3 pr-1 block w-full"
                style={{ maxHeight: '480px', overflowY: 'auto' }}
              >
                {prototypes.map(p => (
                  <div 
                    key={p.id}
                    className="group bg-slate-950/70 border border-white/5 hover:border-indigo-500/30 rounded-2xl p-4 transition-all duration-300 relative shadow-inner"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div>
                        <h4 className="text-xs font-black text-white">{p.name}</h4>
                        <span className="text-[9px] bg-slate-900 border border-white/5 text-indigo-300 font-bold px-1.5 py-0.2 rounded mt-0.5 inline-block">
                          {p.type}
                        </span>
                      </div>
                      
                      <button 
                        onClick={() => handleDeleteProto(p.id)}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-400 text-slate-600 transition-opacity p-0.5"
                        title="删除该档案"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-1">
                      {p.description || '暂无详细特征描述。'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </ModuleWrapper>
  );
}
