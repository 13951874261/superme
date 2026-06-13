import React, { useState, useEffect } from 'react';
import { 
  Wine, Compass, Flame, Trophy, CheckCircle2, AlertTriangle, 
  BookOpen, RotateCcw, HelpCircle, FileText, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import ModuleWrapper from './ModuleWrapper';
import { playClick, playSuccess, playError } from '../../utils/soundEffects';

// ---------------- 1. 深度情境数据库 (社交场合与高端审美) ----------------
interface Scenario {
  id: string;
  category: 'social' | 'aesthetics';
  title: string;
  type: string;
  desc: string;
  icon: React.ReactNode;
  rules: string;       // 场合规则与潜规则
  temper: string;      // 角色分寸拿捏
  dialogue: string;    // 高阶话术范例
  traps: string;       // 避坑指南
  practice: string;    // 线下实践路径
}

const SCENARIOS: Scenario[] = [
  {
    id: 'wine-table',
    category: 'social',
    title: '政商务饭局与敬酒分寸',
    type: '政商社交礼仪',
    desc: '主客敬酒顺位、敬酒祝词禁忌与防线应对',
    icon: <Wine size={18} />,
    rules: '主陪右侧为第一贵宾，左侧为第二贵宾。敬酒必须由主陪主导开始，不可僭越喧宾夺主。多人敬酒时，遵循尊卑长幼顺序。',
    temper: '克制、谦逊。身体微前倾，杯口必须低于对方杯口1-2厘米。目光真诚注视对方双眼，切忌东张西望。',
    dialogue: '“张局，今天非常荣幸能向您学习。这杯酒我敬您，感谢您一直以来对我们工作的支持，我干了，您随意，保重身体。”',
    traps: '隔人敬酒、跨桌强行灌酒、祝词冗长油腻、在主宾未动筷前抢先举杯。',
    practice: '在下一次部门聚餐中，主动承担倒茶倒酒的角色，观察并练习低杯口敬酒的物理时机。'
  },
  {
    id: 'tea-ceremony',
    category: 'social',
    title: '体制内茶席与茶礼社交',
    type: '体制内规范',
    desc: '扣指礼深层含义、茶席分寸与隐秘心理表达',
    icon: <Compass size={18} />,
    rules: '茶满欺人（七分茶三分情）。扣指礼分为单指（晚辈对长辈）、双指并拢（平辈）和三指齐叩（长辈对晚辈）。',
    temper: '安详静谧，动作轻缓。主人续茶时，应立刻行扣指礼回敬，表示对席间谈话的专注与尊重。',
    dialogue: '“赵处，这道老白茶茶气温和，正适合咱们今天清静交流，您尝尝看。”',
    traps: '大口鲸吞、杯中茶水已冷却仍不倾倒、主人倒茶时视而不见毫无礼貌动作。',
    practice: '找一家传统茶室，观察茶艺师或长官如何通过摆弄茶具控制谈话的节奏。'
  },
  {
    id: 'cigar-wine',
    category: 'social',
    title: '红酒与雪茄品鉴礼仪',
    type: '高端商务',
    desc: '红酒醒酒与捏杯分寸、雪茄吸食礼仪与避坑指南',
    icon: <Flame size={18} />,
    rules: '红酒需手持杯脚或杯底，避免体温影响酒温。雪茄不吸入肺，用喷枪均匀点燃，切忌用力吹气或主动弹灰。',
    temper: '松弛优雅。红酒讲究“观色、摇杯、闻香、品味”的克制节奏。雪茄讲究静置自然熄灭。',
    dialogue: '“这支波尔多带着淡淡的橡木桶与香草气味，单宁细腻，醒酒时间刚刚好，各位请。”',
    traps: '像喝啤酒一样端杯、抽雪茄频繁弹灰、将未抽完的雪茄像香烟般在烟灰缸内按灭。',
    practice: '购买一支红酒，在家中练习摇杯与持杯的正确姿势，感受酒液挂杯的物理视觉。'
  },
  {
    id: 'golf-business',
    category: 'social',
    title: '高尔夫与马术轻商务',
    type: '高端商务',
    desc: '高尔夫礼仪、球场规则、打球中分寸与避坑指南',
    icon: <Trophy size={18} />,
    rules: '发球台前绝对保持安静，切勿站在他人视线内或击球线上。注意保护草皮，打完球需主动填沙复原。',
    temper: '绅士、自律、情绪稳定。即使击球失误也绝不在场上发脾气或表现得焦躁不安。',
    dialogue: '“好球！李总这杆弹道真漂亮，核心力量控制得太到位了。”',
    traps: '在他人准备挥杆时聊天或走动、为了面子瞒报杆数、打球节奏拖沓阻碍后方球队。',
    practice: '去练习场录制自己的挥杆视频，重点训练稳定、沉稳的身体平衡感与站姿。'
  },
  {
    id: 'opera-music',
    category: 'aesthetics',
    title: '古典音乐与歌剧鉴赏',
    type: '跨文化审美',
    desc: '核心美学逻辑、阶层审美偏好与谈资转化',
    icon: <BookOpen size={18} />,
    rules: '乐章之间绝对不能鼓掌，需在整首交响乐彻底结束、指挥双手放下后方能鼓掌致意。',
    temper: '专注、内敛。着装端庄，提前十五分钟入场，静享音乐厅的声学空间。',
    dialogue: '“贝多芬这部交响曲的第二乐章有着极强的德奥古典理性，那种深沉的命运张力确实令人动容。”',
    traps: '乐章间乱鼓掌、演奏中看手机或发出噪音、不懂装懂胡乱评价作曲家细节。',
    practice: '在网上完整聆听一首马勒或莫扎特的经典交响乐，重点辨识不同乐章间的衔接点。'
  },
  {
    id: 'chinese-art',
    category: 'aesthetics',
    title: '中式雅集（香道/花道/书法）',
    type: '中式审美偏好',
    desc: '香道花道美学逻辑、政务偏好与日常谈吐融入',
    icon: <Compass size={18} />,
    rules: '品香时使用“闻香”而非“嗅香”，以手拢香气入鼻。书法注重气韵连贯与中锋用笔。',
    temper: '静心、闲雅。追求“虚静”境界，在茶香字画中表现出超然脱俗的定力。',
    dialogue: '“这炉沉香气韵清甜幽远，极具禅意，正适合咱们静心写几笔小楷。”',
    traps: '动作毛躁、对香炉深呼吸狂嗅、对大师作品进行外行的结构化批判。',
    practice: '购买一套简易的印香或线香工具，睡前练习一次打香篆，训练指尖细微力量的控制与心境沉淀。'
  }
];

// ---------------- 2. 21点博弈类型定义 ----------------
interface Card {
  suit: string;
  value: string;
  score: number;
}

export default function EntertainmentModule() {
  // 核心导航状态
  const [activeTab, setActiveTab] = useState<'manners' | 'aesthetics' | 'blackjack' | 'reflection'>('manners');
  
  // 情境研判状态
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [response, setResponse] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [difyFeedback, setDifyFeedback] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scanStep, setScanStep] = useState(0);

  // 21点对抗博弈状态
  const [chips, setChips] = useState(10000);
  const [bet, setBet] = useState(500);
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [gameStatus, setGameStatus] = useState<'betting' | 'playing' | 'dealerTurn' | 'resolved'>('betting');
  const [gameResult, setGameResult] = useState<string>('');
  const [blackjackCoaching, setBlackjackCoaching] = useState<string>('');

  // 每日复盘状态
  const [reflectionInput, setReflectionInput] = useState('');
  const [reflectionResult, setReflectionResult] = useState<any>(null);

  // ---------------- 3. 音效集成 ----------------
  const triggerClick = () => {
    playClick();
  };

  const triggerSuccess = () => {
    playSuccess();
  };

  const triggerWarning = () => {
    playError();
  };

  // ---------------- 4. Dify 量化研判 ----------------
  const getDifySceneCategory = (id: string) => {
    const mapping: Record<string, string> = {
      'wine-table': '政商务饭局与敬酒',
      'tea-ceremony': '茶席与茶礼社交',
      'cigar-wine': '红酒与雪茄品鉴',
      'golf-business': '高引夫轻商务', // Wait, 'golf-business': '高尔夫轻商务'
      'opera-music': '跨文化宴请(西方)',
      'chinese-art': '茶席与茶礼社交'
    };
    // Make sure we type it correctly as '高尔夫轻商务'
    mapping['golf-business'] = '高尔夫轻商务';
    return mapping[id] || '政商务饭局与敬酒';
  };

  const handleAnalyze = async () => {
    if (!response.trim() || !selectedScenario) return;
    
    setIsVerifying(true);
    setDifyFeedback(null);
    setScanStep(0);
    
    triggerClick();
    const stepInterval = setInterval(() => {
      setScanStep(prev => (prev + 1) % 4);
    }, 800);

    try {
      const apiKey = import.meta.env.VITE_DIFY_HIGH_AESTHETICS_KEY;
      const apiBaseUrl = import.meta.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
      
      const res = await fetch(`${apiBaseUrl}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: {
            scene_category: getDifySceneCategory(selectedScenario.id),
            user_response: response,
            user_current_profile: localStorage.getItem('user_current_profile') || localStorage.getItem('User_Current_Profile') || ''
          },
          response_mode: "blocking",
          user: "aesthetic_user_01"
        })
      });

      const data = await res.json();
      
      if (data && data.data && data.data.outputs && data.data.outputs.json_result) {
        let rawOutput = data.data.outputs.json_result;
        if (typeof rawOutput === 'string') {
          rawOutput = rawOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        const parsedOutputs = typeof rawOutput === 'object' ? rawOutput : JSON.parse(rawOutput); 
        setDifyFeedback(parsedOutputs);
        setIsModalOpen(true);

        if (parsedOutputs.is_passed) {
          triggerSuccess();
          // 行政风香槟金洒花
          confetti({
            particleCount: 60,
            spread: 50,
            origin: { y: 0.7 },
            colors: ['#D4AF37', '#C0C0C0', '#F5F5F5', '#E6E6FA']
          });
        } else {
          triggerWarning();
        }
      } else {
        throw new Error("工作流响应格式不符合预期");
      }
    } catch (e) {
      console.error("研判系统异常:", e);
      triggerWarning();
      alert("研判系统异常：连接 Dify 服务失败，请检查网络连接或 API 配置。");
    } finally {
      clearInterval(stepInterval);
      setIsVerifying(false);
    }
  };

  // ---------------- 5. 21点博弈逻辑实现 ----------------
  const initDeck = () => {
    const suits = ['♠', '♥', '♣', '♦'];
    const values = [
      { v: '2', s: 2 }, { v: '3', s: 3 }, { v: '4', s: 4 }, { v: '5', s: 5 },
      { v: '6', s: 6 }, { v: '7', s: 7 }, { v: '8', s: 8 }, { v: '9', s: 9 },
      { v: '10', s: 10 }, { v: 'J', s: 10 }, { v: 'Q', s: 10 }, { v: 'K', s: 10 },
      { v: 'A', s: 11 }
    ];
    let newDeck: Card[] = [];
    for (const suit of suits) {
      for (const val of values) {
        newDeck.push({ suit, value: val.v, score: val.s });
      }
    }
    // 洗牌
    for (let i = newDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
  };

  const getHandScore = (hand: Card[]) => {
    let score = hand.reduce((sum, c) => sum + c.score, 0);
    let aces = hand.filter(c => c.value === 'A').length;
    while (score > 21 && aces > 0) {
      score -= 10;
      aces -= 1;
    }
    return score;
  };

  const handleStartGame = () => {
    if (chips < bet) {
      triggerWarning();
      alert("余额不足，系统已为您自动重置筹码。");
      setChips(10000);
      return;
    }
    triggerSuccess();
    const currentDeck = initDeck();
    const p1 = currentDeck.pop()!;
    const d1 = currentDeck.pop()!;
    const p2 = currentDeck.pop()!;
    const d2 = currentDeck.pop()!;

    setPlayerHand([p1, p2]);
    setDealerHand([d1, d2]);
    setDeck(currentDeck);
    setGameStatus('playing');
    setGameResult('');
    setBlackjackCoaching('');
  };

  const handleHit = () => {
    triggerClick();
    const currentDeck = [...deck];
    const card = currentDeck.pop()!;
    const nextHand = [...playerHand, card];
    setPlayerHand(nextHand);
    setDeck(currentDeck);

    if (getHandScore(nextHand) > 21) {
      resolveGame(nextHand, dealerHand, 'player_busted');
    }
  };

  const handleStand = () => {
    triggerClick();
    setGameStatus('dealerTurn');
  };

  // 监控庄家要牌回合
  useEffect(() => {
    if (gameStatus === 'dealerTurn') {
      const timer = setTimeout(() => {
        const dScore = getHandScore(dealerHand);
        const pScore = getHandScore(playerHand);
        if (dScore < 17) {
          const currentDeck = [...deck];
          const card = currentDeck.pop()!;
          setDealerHand([...dealerHand, card]);
          setDeck(currentDeck);
          triggerClick();
        } else {
          // 庄家停牌，判定结果
          if (dScore > 21) {
            resolveGame(playerHand, dealerHand, 'dealer_busted');
          } else if (dScore > pScore) {
            resolveGame(playerHand, dealerHand, 'dealer_won');
          } else if (dScore < pScore) {
            resolveGame(playerHand, dealerHand, 'player_won');
          } else {
            resolveGame(playerHand, dealerHand, 'push');
          }
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [gameStatus, dealerHand]);

  const resolveGame = (pHand: Card[], dHand: Card[], outcome: string) => {
    const pScore = getHandScore(pHand);
    const dScore = getHandScore(dHand);
    let finalChips = chips;
    let resultMsg = '';

    if (outcome === 'player_busted') {
      finalChips -= bet;
      resultMsg = '您爆牌了，庄家获胜。';
      triggerWarning();
    } else if (outcome === 'dealer_busted') {
      finalChips += bet;
      resultMsg = '庄家爆牌，您赢了！';
      triggerSuccess();
      confetti({ particleCount: 30, colors: ['#D4AF37', '#C0C0C0'] });
    } else if (outcome === 'player_won') {
      finalChips += bet;
      resultMsg = '比牌获胜，您赢了！';
      triggerSuccess();
      confetti({ particleCount: 30, colors: ['#D4AF37', '#C0C0C0'] });
    } else if (outcome === 'dealer_won') {
      finalChips -= bet;
      resultMsg = '庄家点数更大，您输了。';
      triggerWarning();
    } else if (outcome === 'push') {
      resultMsg = '平局，退回筹码。';
      triggerClick();
    }

    setChips(finalChips);
    setGameResult(resultMsg);
    setGameStatus('resolved');

    // AI 博弈教练复盘点评 (基于概率与策略定力)
    generateCoaching(pScore, dScore, outcome, dHand[0].score);
  };

  const generateCoaching = (pScore: number, dScore: number, outcome: string, dealerUpCardScore: number) => {
    let coach = '';
    if (outcome === 'player_busted') {
      coach = '【控制力复盘】：您最终爆牌。当手牌到达硬12~16点且庄家明牌较弱时，庄家本身极易爆牌，此时冒进要牌是不理性的决策。';
    } else if (pScore <= 16 && dealerUpCardScore >= 7 && outcome === 'dealer_won') {
      coach = '【风险点剖析】：面对庄家大明牌，您在点数偏低时选择保守停牌。数学上虽无可厚非，但商务决策如同此局：当对手明牌极强时，保守停牌等于被动认输，必须敢于冒适当风险博弈。';
    } else if (outcome === 'player_won' || outcome === 'dealer_busted') {
      coach = '【成功力复盘】：决策果断。在点数占优或庄家暴留下爆牌面（明牌4/5/6）时稳健停牌，成功将决策压力转移至庄家，体现了出色的控局定力。';
    } else {
      coach = '【大局观】：平稳的决策节奏。在期望值不明显时维持防线，这是高管决策中控制回撤风险的核心思路。';
    }
    setBlackjackCoaching(coach);
  };

  // ---------------- 6. 每日复盘总结 ----------------
  const handleGenerateReflection = () => {
    if (!reflectionInput.trim()) return;
    triggerSuccess();
    setReflectionResult({
      gain: "今日在线上对【政商务饭局与敬酒】及【古典音乐鉴赏】情境进行了研判，初步摸清了“杯口低于长官”这一潜规则的物理时机，同时在智力博弈对抗中体验了期望值防线。阶层隐性竞争力的核心正是在这些细微克制处显露。",
      focus: "明日重点训练【中式雅集】的香道微力量控制，并在德州/21点博弈中继续锤炼控制下注回撤的心理定力。"
    });
  };

  // ---------------- 7. 主视图渲染 ----------------
  return (
    <ModuleWrapper 
      title="高阶审美 & 社交隐性竞争力" 
      icon={<Wine className="w-8 h-8 text-zinc-700" strokeWidth={2.5} />}
      description="顶级商务礼仪、跨文化审美认知升维与高端圈层智力博弈对抗系统。旨在打造严肃、克制、极具秩序感的阶层跃迁训练场。"
    >
      {/* 头部微投影行政风选项卡 */}
      <div className="flex border-b border-zinc-200 mb-8 bg-white/50 p-1.5 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <button 
          onClick={() => { triggerClick(); setActiveTab('manners'); setSelectedScenario(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'manners' 
              ? 'bg-zinc-900 text-white shadow-sm' 
              : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/50'
          }`}
        >
          <Wine size={14} />
          顶级政商社交训练
        </button>
        <button 
          onClick={() => { triggerClick(); setActiveTab('aesthetics'); setSelectedScenario(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'aesthetics' 
              ? 'bg-zinc-900 text-white shadow-sm' 
              : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/50'
          }`}
        >
          <BookOpen size={14} />
          高端审美与气质修炼
        </button>
        <button 
          onClick={() => { triggerClick(); setActiveTab('blackjack'); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'blackjack' 
              ? 'bg-zinc-900 text-white shadow-sm' 
              : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/50'
          }`}
        >
          <Trophy size={14} />
          智力博弈与实战对抗
        </button>
        <button 
          onClick={() => { triggerClick(); setActiveTab('reflection'); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'reflection' 
              ? 'bg-zinc-900 text-white shadow-sm' 
              : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/50'
          }`}
        >
          <FileText size={14} />
          交互复盘与定制反馈
        </button>
      </div>

      <AnimatePresence mode="wait">
        {/* 模块一与模块二：社交场合与高端审美情境训练 */}
        {(activeTab === 'manners' || activeTab === 'aesthetics') && (
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* 左侧 60%：场景推送卡片列表 */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-col mb-2">
                <h3 className="text-sm font-bold text-zinc-800 tracking-wide">
                  {activeTab === 'manners' ? "每日推送：商务政务高频社交场景" : "阶层辨识度：高级审美认知升维"}
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">请选中下方场景进入模拟研判或升维解析</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SCENARIOS.filter(s => s.category === (activeTab === 'manners' ? 'social' : 'aesthetics')).map((scenario) => {
                  const isActive = selectedScenario?.id === scenario.id;
                  return (
                    <div 
                      key={scenario.id}
                      onClick={() => { triggerClick(); setSelectedScenario(scenario); setResponse(''); }}
                      className={`p-5 rounded-xl cursor-pointer border transition-all duration-300 flex flex-col gap-4 relative ${
                        isActive 
                          ? 'border-zinc-800 bg-zinc-50/80 shadow-[0_4px_16px_rgba(0,0,0,0.06)]' 
                          : 'border-zinc-200/80 bg-white hover:border-zinc-400 hover:bg-zinc-50/50 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className={`p-2 rounded-lg ${isActive ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                          {scenario.icon}
                        </div>
                        <span className="text-[9px] font-mono tracking-wider px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded border border-zinc-200/40">
                          {scenario.type}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-zinc-800">{scenario.title}</h4>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{scenario.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 右侧 50%：场景详情实战分析 */}
            <div className="lg:col-span-5">
              {selectedScenario ? (
                <div className="bg-white border border-zinc-200/80 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-5">
                  <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-800"></div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">实操要点剖析</label>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div>
                      <span className="text-zinc-400 block mb-0.5">① 场合规则与潜规则</span>
                      <p className="text-zinc-800 leading-relaxed font-medium bg-zinc-50 p-2.5 rounded-lg border border-zinc-100">{selectedScenario.rules}</p>
                    </div>

                    <div>
                      <span className="text-zinc-400 block mb-0.5">② 角色分寸拿捏</span>
                      <p className="text-zinc-800 leading-relaxed font-medium bg-zinc-50 p-2.5 rounded-lg border border-zinc-100">{selectedScenario.temper}</p>
                    </div>

                    <div>
                      <span className="text-zinc-400 block mb-0.5">③ 适配高阶话术</span>
                      <p className="text-zinc-800 font-mono leading-relaxed bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 italic">{selectedScenario.dialogue}</p>
                    </div>

                    <div>
                      <span className="text-rose-500 font-bold block mb-0.5">④ 避坑指南（绝对禁忌）</span>
                      <p className="text-rose-700 leading-relaxed font-medium bg-rose-50/50 p-2.5 rounded-lg border border-rose-100">{selectedScenario.traps}</p>
                    </div>

                    <div>
                      <span className="text-zinc-400 block mb-0.5">⑤ 线下强化微训练</span>
                      <p className="text-zinc-800 leading-relaxed font-medium bg-zinc-50 p-2.5 rounded-lg border border-zinc-100">{selectedScenario.practice}</p>
                    </div>
                  </div>

                  {/* 模拟输入区 */}
                  <div className="pt-2 border-t border-zinc-100 space-y-3">
                    <span className="text-xs text-zinc-600 font-bold block">在此模拟输入您的应对招数/敬酒词进行 AI 量化评估：</span>
                    <textarea 
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      rows={4}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs leading-relaxed text-zinc-800 placeholder-zinc-400 focus:bg-white focus:border-zinc-800 outline-none resize-none transition-all"
                      placeholder="例：“张局，非常高兴今天能和您坐在一起...”"
                    />
                    <button 
                      onClick={handleAnalyze}
                      disabled={isVerifying || !response.trim()}
                      className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs py-3 px-4 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      提交社交指数量化研判
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-80 border border-dashed border-zinc-200 rounded-xl text-center p-6 bg-white/50 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <Wine className="w-8 h-8 text-zinc-300 mb-3 animate-pulse" />
                  <p className="text-xs text-zinc-400">请先在左侧选择一个要修炼的情境</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* 模块三：智力博弈与对抗系统 (Blackjack 21点) */}
        {activeTab === 'blackjack' && (
          <motion.div 
            key="blackjack"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* 左侧 60%：21点游戏实战操作区 */}
            <div className="lg:col-span-7 bg-white border border-zinc-200/80 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between min-h-[450px]">
              <div>
                <div className="flex justify-between items-center mb-6 border-b border-zinc-100 pb-3">
                  <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-widest">圈层对垒：Blackjack 21点实战</h3>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-zinc-500">筹码: <strong className="text-zinc-800 font-bold">{chips}</strong></span>
                    <span className="text-zinc-500">当前注: 
                      <input 
                        type="number" 
                        value={bet}
                        onChange={(e) => setBet(Math.max(100, parseInt(e.target.value) || 0))}
                        disabled={gameStatus === 'playing' || gameStatus === 'dealerTurn'}
                        className="w-16 ml-1 px-1 py-0.5 border border-zinc-200 rounded text-center text-zinc-800 font-bold bg-zinc-50 focus:bg-white outline-none"
                      />
                    </span>
                  </div>
                </div>

                {gameStatus === 'betting' ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                    <Trophy className="w-12 h-12 text-zinc-300" />
                    <div>
                      <h4 className="text-xs font-bold text-zinc-800">理性决策与抗压性演练</h4>
                      <p className="text-[11px] text-zinc-400 mt-1 max-w-sm">在不确定性规则下判断期望风险。庄家在17点前必须继续要牌。点击开始发牌。</p>
                    </div>
                    <button 
                      onClick={handleStartGame}
                      className="bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs py-2.5 px-6 rounded-lg transition-all"
                    >
                      下注并开始发牌
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8 py-4">
                    {/* 庄家手牌 */}
                    <div className="space-y-2">
                      <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                        庄家手牌 {gameStatus === 'playing' ? '(明牌)' : `(得分: ${getHandScore(dealerHand)})`}
                      </div>
                      <div className="flex gap-3">
                        {dealerHand.map((card, idx) => (
                          <div 
                            key={idx} 
                            className="w-14 h-20 bg-zinc-50 border border-zinc-200 rounded-lg flex flex-col justify-between p-2 shadow-sm"
                          >
                            <span className={`text-xs font-bold ${['♥','♦'].includes(card.suit) ? 'text-rose-600' : 'text-zinc-800'}`}>
                              {gameStatus === 'playing' && idx === 1 ? '?' : card.value}
                            </span>
                            <span className={`text-lg self-center ${['♥','♦'].includes(card.suit) ? 'text-rose-600' : 'text-zinc-600'}`}>
                              {gameStatus === 'playing' && idx === 1 ? '░' : card.suit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 玩家手牌 */}
                    <div className="space-y-2">
                      <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                        您的手牌 (得分: {getHandScore(playerHand)})
                      </div>
                      <div className="flex gap-3">
                        {playerHand.map((card, idx) => (
                          <div 
                            key={idx} 
                            className="w-14 h-20 bg-white border border-zinc-200 rounded-lg flex flex-col justify-between p-2 shadow-sm"
                          >
                            <span className={`text-xs font-bold ${['♥','♦'].includes(card.suit) ? 'text-rose-600' : 'text-zinc-800'}`}>
                              {card.value}
                            </span>
                            <span className={`text-lg self-center ${['♥','♦'].includes(card.suit) ? 'text-rose-600' : 'text-zinc-600'}`}>
                              {card.suit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {gameStatus === 'playing' && (
                <div className="flex gap-4 border-t border-zinc-100 pt-4">
                  <button 
                    onClick={handleHit}
                    className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs py-3 px-4 rounded-lg transition-all"
                  >
                    要牌 (Hit)
                  </button>
                  <button 
                    onClick={handleStand}
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs py-3 px-4 rounded-lg transition-all"
                  >
                    停牌 (Stand)
                  </button>
                </div>
              )}

              {gameStatus === 'resolved' && (
                <div className="border-t border-zinc-100 pt-4 space-y-4">
                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold text-zinc-800 flex justify-between items-center">
                    <span>结果: {gameResult}</span>
                    <button 
                      onClick={() => setGameStatus('betting')}
                      className="text-zinc-500 hover:text-zinc-800 text-[11px] flex items-center gap-1 font-semibold"
                    >
                      <RotateCcw size={12} /> 再来一局
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 右侧 40%：AI博弈研判复盘与定力分析 */}
            <div className="lg:col-span-5">
              <div className="bg-white border border-zinc-200/80 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] h-full flex flex-col justify-between min-h-[450px]">
                <div className="space-y-4 animate-[fadeIn_0.5s_ease-out]">
                  <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                    <ShieldAlert className="w-4 h-4 text-zinc-700" />
                    <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">博弈定力AI复盘</label>
                  </div>

                  {blackjackCoaching ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg text-xs leading-relaxed text-zinc-700">
                        {blackjackCoaching}
                      </div>
                      <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg text-[11px] text-zinc-500 space-y-2">
                        <span className="font-bold text-zinc-700 block">💡 阶层博弈论要旨：</span>
                        <p>1. <strong>不要凭直觉下注</strong>。高层决策者只相信数学期望，拒绝赌徒心理。</p>
                        <p>2. <strong>防守即是进攻</strong>。在庄家明牌软弱时，将压力彻底抛给系统（庄家），让时间成为盟友。</p>
                        <p>3. <strong>风险敞口控制</strong>。在己方没有至少 55% 期望优势时，绝不随意放大下注筹码或双倍敞口。</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 border border-dashed border-zinc-200 rounded-xl text-center p-4">
                      <HelpCircle className="w-6 h-6 text-zinc-300 mb-2" />
                      <p className="text-xs text-zinc-400">进行一局对抗后，AI 决策教练将在此复盘您的风险偏好与定力表现</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 模块四：交互复盘与定制反馈 */}
        {activeTab === 'reflection' && (
          <motion.div 
            key="reflection"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <div className="bg-white border border-zinc-200/80 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
              <div className="flex flex-col border-b border-zinc-100 pb-3">
                <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-widest">每日社交/审美感悟备忘录</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">记录今日真实线下社交的得失、审美感悟与体会，系统将量化生成复盘报告。</p>
              </div>

              <textarea 
                value={reflectionInput}
                onChange={(e) => setReflectionInput(e.target.value)}
                rows={5}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-xs leading-relaxed text-zinc-800 placeholder-zinc-400 focus:bg-white focus:border-zinc-800 outline-none resize-none transition-all"
                placeholder="在此输入您的实践心得。例如：今日在行政接待中，对方递茶时我用双指轻叩桌面以示感谢，对方会心一笑，沟通氛围确实柔和不少..."
              />

              <button 
                onClick={handleGenerateReflection}
                disabled={!reflectionInput.trim()}
                className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs py-2.5 px-6 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                生成今日社交/审美收获复盘
              </button>
            </div>

            {reflectionResult && (
              <motion.div 
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <div className="bg-white border border-zinc-200/80 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-zinc-900" />
                  <h4 className="text-xs font-bold text-zinc-800 mb-2">⭐ 今日社交/审美收获</h4>
                  <p className="text-xs leading-relaxed text-zinc-600">{reflectionResult.gain}</p>
                </div>
                <div className="bg-white border border-zinc-200/80 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-zinc-900" />
                  <h4 className="text-xs font-bold text-zinc-800 mb-2">🎯 明日高阶娱乐重点</h4>
                  <p className="text-xs leading-relaxed text-zinc-600">{reflectionResult.focus}</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 研判中状态覆盖遮罩 (行政极简风) */}
      {isVerifying && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/20 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-white border border-zinc-200 rounded-xl p-8 shadow-xl mx-4 text-center space-y-6">
            <div className="flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-800 tracking-[0.2em] uppercase">AESTHETICS ENGINE</h3>
              <p className="text-[11px] text-zinc-400 font-mono mt-1">&gt; {["初始化审美引擎...", "检索跨文化礼仪库...", "评估决策分寸...", "生成研判结果..."][scanStep]}</p>
            </div>
          </div>
        </div>
      )}

      {/* 研判结果超级克制弹窗 (行政极简风) */}
      {isModalOpen && difyFeedback && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-zinc-950/45 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md bg-white border border-zinc-200 rounded-xl p-8 shadow-2xl space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${
                difyFeedback.is_passed 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                  : 'bg-rose-50 border-rose-200 text-rose-600'
              }`}>
                {difyFeedback.is_passed ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-800 tracking-wide">
                  {difyFeedback.is_passed ? "体面过关 (Passed)" : "触碰禁忌 (Failed)"}
                </h3>
                <span className="text-[9px] text-zinc-400 font-mono tracking-widest mt-0.5 block">SOCIAL INTELLIGENCE VERDICT</span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200/60 rounded-lg px-4 py-2.5 text-xs">
              <span className="text-zinc-500 font-medium">决策得分：</span>
              <span className="font-bold text-zinc-800 font-mono text-sm">{difyFeedback.score} / 10</span>
            </div>

            <div className="bg-zinc-50 border border-zinc-200/60 rounded-lg p-4 text-xs leading-relaxed text-zinc-600">
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">避坑指南与解读</h4>
              <p>{difyFeedback.feedback}</p>
            </div>

            <button
              onClick={() => { triggerClick(); setIsModalOpen(false); }}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs py-3 px-4 rounded-lg transition-all"
            >
              {difyFeedback.is_passed ? "收入社交智库" : "重构应对策略"}
            </button>
          </div>
        </div>
      )}
    </ModuleWrapper>
  );
}
