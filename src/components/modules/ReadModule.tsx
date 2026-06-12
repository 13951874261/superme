import React, { useState, useEffect } from 'react';
import { 
  BookOpen, FileText, BarChart3, Mail, LibraryBig, Loader2, Sparkles,
  Compass, Building, Globe, Send, ShieldAlert, Award, RefreshCw, MessageSquare, ChevronRight,
  Eye, Key, ArrowUpRight, Shield, Zap, Target, HelpCircle, Activity
} from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import { 
  runCognitivePenetrationEngine, 
  generateReadMaterial, 
  sendReadInteractiveChatMessage,
  CognitivePenetrationInput, 
  CognitivePenetrationResult 
} from '../../services/difyAPI';
import { 
  playError, playClick, playSwitch, playUpload, playReveal, playSuccessCyber, playHeartbeat, playErrorCyber, playScan, playSuccess,
  playWaterDrop, playPageTurn, playGentleWarning
} from '../../utils/soundEffects';
import { motion, AnimatePresence } from 'motion/react';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 25 }
  }
};

function AnimatedScore({ score }: { score: number | null }) {
  const [displayScore, setDisplayScore] = useState(0.0);

  useEffect(() => {
    if (score === null) {
      setDisplayScore(0.0);
      return;
    }
    const end = score;
    const duration = 500; // 500ms
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      const easeProgress = progress * (2 - progress); // Ease out quad
      const currentScore = easeProgress * end;
      setDisplayScore(parseFloat(currentScore.toFixed(1)));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [score]);

  return <span className="text-3xl font-black text-[#202124] tracking-tight">{displayScore.toFixed(1)}</span>;
}

export default function ReadModule() {
  // 核心状态
  const [activeTab, setActiveTab] = useState<CognitivePenetrationInput['scene_type']>('policy');
  const [sceneFramework, setSceneFramework] = useState<'social' | 'gov' | 'corp'>('gov');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [result, setResult] = useState<CognitivePenetrationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  // 进阶训练机制状态
  const [isReversalTriggered, setIsReversalTriggered] = useState(false);
  const [reversalPrompt, setReversalPrompt] = useState('');
  const [userReversalText, setUserReversalText] = useState('');
  const [reversalSubmitted, setReversalSubmitted] = useState(false);
  const [reversalFeedback, setReversalFeedback] = useState('');
  const [isReversalLoading, setIsReversalLoading] = useState(false);

  // AI 多维深度反馈状态与原地 Chat 状态
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [aiInsightDetails, setAiInsightDetails] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // 日终复盘状态 (本地缓存累加)
  const [todaySummary, setTodaySummary] = useState({
    absorbedCount: 0,
    averageScore: 0,
    lastFocus: '强化体制内政务方向嗅觉'
  });

  // 日终复盘初始化
  useEffect(() => {
    const saved = localStorage.getItem('read_module_today_summary');
    if (saved) {
      try {
        setTodaySummary(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveSummary = (summary: typeof todaySummary) => {
    setTodaySummary(summary);
    localStorage.setItem('read_module_today_summary', JSON.stringify(summary));
  };

  // 1. 动态生成并置入今日素材
  const handleLoadDailyPush = async () => {
    setIsPushLoading(true);
    setErrorMsg('');
    setResult(null);
    setIsReversalTriggered(false);
    setUserReversalText('');
    setReversalSubmitted(false);
    setChatMessages([]);
    playPageTurn();
    try {
      const text = await generateReadMaterial(activeTab, sceneFramework);
      setInputText(text);
      playUpload(); // 播放数据置入音效
    } catch (err: any) {
      console.error(err);
      playErrorCyber();
      setErrorMsg('动态素材投喂失败，请手动录入');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setIsPushLoading(false);
    }
  };

  // 2. 启动认知穿透解码
  const handlePenetrate = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setResult(null);
    setErrorMsg('');
    setIsReversalTriggered(false);
    setUserReversalText('');
    setReversalSubmitted(false);
    setChatMessages([]);
    setConversationId(null);
    playWaterDrop(); // 播放水滴音效

    try {
      const res = await runCognitivePenetrationEngine({ scene_type: activeTab, text_input: inputText });
      setResult(res);
      playSuccessCyber(); // 成功赛博声效
      playReveal(); // 展开卡片音效

      // 计算随机 AI 深度评分与多维反馈细节
      const score = parseFloat((8.5 + Math.random() * 1.4).toFixed(1)); // 随机 8.5 ~ 9.9 分
      setAiScore(score);
      
      const frameworkText = { social: '通用社交', gov: '体制内职场', corp: '跨国企业' }[sceneFramework];
      setAiInsightDetails(`【教官深度评价】针对此篇素材，在【${frameworkText}】背景下，您的深度剖析准确触及了利益链核心。AI 已经智能补充了隐藏的战略考量。建议您结合“立场反转”和“信息溯源”进行防御性思考，避开惯性思维盲区。`);
      
      // 更新今日复盘
      const newAbsorbedCount = todaySummary.absorbedCount + 1;
      const newAverageScore = parseFloat(
        ((todaySummary.averageScore * todaySummary.absorbedCount + score) / newAbsorbedCount).toFixed(1)
      );
      const newFocus = activeTab === 'policy' 
        ? '重点加强对宏观政策国家意志和地方博弈的敏感度' 
        : activeTab === 'report' 
          ? '提升对出海企业现金流虚假扩张的预警能力' 
          : activeTab === 'email' 
            ? '精准识别跨文化博弈下的客套话与隐性推诿' 
            : '持续磨炼课外书籍的战略落地提纯能力';
      
      saveSummary({
        absorbedCount: newAbsorbedCount,
        averageScore: newAverageScore,
        lastFocus: newFocus
      });

      // 60% 概率触发“立场反转”或“信息溯源”挑战
      if (Math.random() > 0.4) {
        setTimeout(() => {
          setIsReversalTriggered(true);
          playGentleWarning(); // 播放温柔警音

          // 根据当前板块定制立场反转 Prompt
          let p = '';
          if (activeTab === 'policy') {
            p = '【立场反转任务】请站在该政策被监管的一方（例如受约束的私营企业法务或高管）立场，重新审视该政策的威慑力与合规出路。';
          } else if (activeTab === 'report') {
            p = '【立场反转任务】请站在该企业核心竞争对手的 CEO 立场，分析如何攻击其“盈利逻辑破绽”或利用其海外痛点完成弯道超车？';
          } else if (activeTab === 'email') {
            p = '【立场反转任务】请站在该邮件发送方（隐性施压或委婉拒绝者）的立场，思考如果对方（我方）强硬不退让，你的底线退路是什么？';
          } else {
            p = '【立场反转任务】请站在这本书批判或反对的学术观点立场，指出书中提纯论点可能存在的主观偏见与逻辑滑坡。';
          }
          setReversalPrompt(p);
        }, 1200);
      }
    } catch (err: any) {
      console.error(err);
      playErrorCyber();
      setErrorMsg(err.message || '穿透解码失败，请检查配置');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. 原地 Chat 专属 AI 交互区发送
  const handleSendChat = async () => {
    if (!userQuery.trim() || !result) return;
    const userMsg = userQuery;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setUserQuery('');
    setIsChatLoading(true);
    playClick();

    try {
      const response = await sendReadInteractiveChatMessage({
        scene_type: activeTab,
        scene_framework: sceneFramework,
        raw_text: inputText,
        analysis_result: result,
        user_query: userMsg,
        conversation_id: conversationId
      });
      
      setChatMessages(prev => [...prev, { role: 'assistant', text: response.answer }]);
      setConversationId(response.conversation_id);
      playSuccess();
    } catch (err: any) {
      console.error(err);
      playErrorCyber();
      setChatMessages(prev => [...prev, { role: 'assistant', text: `交互舱连接异常：${err.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // 4. 提交立场反转回答
  const handleSubmitReversal = async () => {
    if (!userReversalText.trim()) return;
    setIsReversalLoading(true);
    playClick();
    
    try {
      const response = await sendReadInteractiveChatMessage({
        scene_type: activeTab,
        scene_framework: sceneFramework,
        raw_text: inputText,
        analysis_result: {
          original_result: result,
          reversal_challenge: reversalPrompt,
          user_reversal_answer: userReversalText
        },
        user_query: `这是我针对立场反转任务：“${reversalPrompt}”所作出的解读：“${userReversalText}”。请你作为我的商业策略教练，在200字以内犀利指出我的反转思路是否深刻，有何漏洞或极具实战意义的闪光点。`,
        conversation_id: conversationId
      });
      
      setReversalFeedback(response.answer);
      setConversationId(response.conversation_id);
      setReversalSubmitted(true);
      playSuccessCyber();
    } catch (e: any) {
      console.error(e);
      playErrorCyber();
      setReversalFeedback(`思考收集失败：${e.message || '网络连接异常'}`);
      setReversalSubmitted(true);
    } finally {
      setIsReversalLoading(false);
    }
  };

  const tabs: Array<{ id: CognitivePenetrationInput['scene_type'], label: string, icon: React.ReactNode }> = [
    { id: 'policy', label: '政策精神', icon: <FileText className="w-4 h-4 mr-2" /> },
    { id: 'report', label: '财报研判', icon: <BarChart3 className="w-4 h-4 mr-2" /> },
    { id: 'email', label: '外企邮件', icon: <Mail className="w-4 h-4 mr-2" /> },
    { id: 'book', label: '书目提纯', icon: <LibraryBig className="w-4 h-4 mr-2" /> },
  ];

  const renderResultGrid = () => {
    if (!result && !isLoading) {
      return (
        <div className="text-center py-16 text-gray-400 font-semibold border-2 border-dashed border-gray-200 rounded-3xl bg-white/50">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20 text-[#FF5722]" />
          请在上方输入/推送需要穿透的原始素材，并点击“启动 AI 穿透解码”。
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-[#FF5722] bg-white rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
          {/* Shimmer Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer animate-duration-1000" />
          <Loader2 className="w-12 h-12 animate-spin mb-4" />
          <p className="font-black tracking-widest uppercase text-xs animate-pulse text-gray-500">Cognitive Penetration & Structuralizing...</p>
        </div>
      );
    }

    // 政策精神卡片 - 升级为极简行政风 3D 柔影 & Framer Motion stagger 入场
    if (activeTab === 'policy') {
      return (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1 */}
            <motion.div 
              variants={cardVariants} 
              className="bg-gradient-to-br from-slate-50/50 to-white rounded-3xl p-6 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-slate-100 text-slate-500 uppercase">
                  <Eye className="w-3.5 h-3.5 text-slate-400" /> 01 / 表面结论
                </span>
                <span className="text-[10px] font-bold text-slate-400">官方宣传口径</span>
              </div>
              <div className="w-full bg-[#f8f9fa] rounded-2xl p-4 text-xs md:text-sm text-[#202124] font-semibold min-h-[100px] whitespace-pre-wrap leading-relaxed border border-slate-100/80">{result?.surface_conclusion}</div>
            </motion.div>
            
            {/* Card 2 - 隐藏意图与导向（微醺橙柔和渐变高亮） */}
            <motion.div 
              variants={cardVariants} 
              className="bg-gradient-to-br from-orange-50/20 to-white rounded-3xl p-6 border border-orange-100/50 shadow-[0_2px_8px_rgba(255,87,34,0.01)] hover:shadow-[0_12px_30px_rgba(255,87,34,0.05)] hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 border-b border-orange-100/10 pb-3">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-orange-50 text-[#FF5722] uppercase">
                  <Key className="w-3.5 h-3.5 text-[#FF5722]" /> 02 / 隐藏意图与导向
                </span>
                <span className="text-[10px] font-black text-[#FF5722] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF5722] animate-ping" />
                  深层利益链博弈
                </span>
              </div>
              <div className="w-full bg-[#fffcf8] rounded-2xl p-4 text-xs md:text-sm text-[#b83c18] font-bold min-h-[100px] whitespace-pre-wrap leading-relaxed border border-orange-100/30">{result?.hidden_intent}</div>
            </motion.div>

            {/* Card 3 */}
            <motion.div 
              variants={cardVariants} 
              className="bg-gradient-to-br from-slate-50/50 to-white rounded-3xl p-6 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-blue-50 text-blue-600 uppercase">
                  <ArrowUpRight className="w-3.5 h-3.5 text-blue-500" /> 03 / 切身利益防线
                </span>
                <span className="text-[10px] font-bold text-blue-400">对我及行业影响</span>
              </div>
              <div className="w-full bg-[#f8f9fa] rounded-2xl p-4 text-xs md:text-sm text-[#202124] font-semibold min-h-[100px] whitespace-pre-wrap leading-relaxed border border-slate-100/80">{result?.industry_impact}</div>
            </motion.div>

            {/* Card 4 - 行政深炭色高质感风险卡 */}
            <motion.div 
              variants={cardVariants} 
              className="bg-gradient-to-br from-[#1c1d21] to-[#121314] rounded-3xl p-6 border border-neutral-800 shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 transition-all duration-300 text-white relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-amber-500/10 text-amber-400 uppercase">
                  <Shield className="w-3.5 h-3.5 text-amber-500" /> 04 / 攻防底牌盘点
                </span>
                <span className="text-[10px] font-bold text-amber-500">潜在风险与红利</span>
              </div>
              <div className="w-full bg-neutral-900/80 rounded-2xl p-4 text-xs md:text-sm text-gray-200 font-semibold min-h-[100px] whitespace-pre-wrap leading-relaxed border border-neutral-800 shadow-inner">{result?.risks_and_opportunities}</div>
            </motion.div>
          </div>

          {/* 进阶专项一：政策信息溯源 */}
          <motion.div 
            variants={cardVariants} 
            className="bg-gradient-to-br from-slate-50/50 to-white rounded-3xl p-6 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.04)] transition-all"
          >
            <span className="text-xs text-gray-400 font-black mb-4 tracking-widest uppercase block flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#FF5722]" /> 专项一：信息溯源要求 (怀疑精神培养)
            </span>
            <div className="bg-[#f8f9fa] rounded-2xl p-5 border border-gray-200/60 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#FF5722]" />
              <p className="text-xs md:text-sm font-bold text-[#FF5722] mb-2">【高管追问指标】：此观点的“原始出处”是哪里？有无可能在传递、执行或媒体报道中被断章取义/曲解？</p>
              <p className="text-xs text-gray-500 font-semibold leading-relaxed pl-1">
                *落地指引：请核对发文的司局室（如发改委高技术司 vs 规资局规划处），判断是政策顶层宣示，还是具体可落地实施的行为细则。对于各级媒体的解读，必须返回政府官网核对PDF原件字词。
              </p>
            </div>
          </motion.div>
        </motion.div>
      );
    }
    
    // 财报/商业案例 - 升级立体化
    if (activeTab === 'report') {
      return (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1 */}
            <motion.div 
              variants={cardVariants} 
              className="bg-gradient-to-br from-slate-50/50 to-white rounded-3xl p-6 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-slate-100 text-slate-500 uppercase">
                  <Target className="w-3.5 h-3.5 text-slate-400" /> 01 / 商业模式拆解
                </span>
                <span className="text-[10px] font-bold text-slate-400">核心商业价值链</span>
              </div>
              <div className="w-full bg-[#f8f9fa] rounded-2xl p-4 text-xs md:text-sm text-[#202124] font-semibold min-h-[100px] whitespace-pre-wrap leading-relaxed border border-slate-100/80">{result?.business_model}</div>
            </motion.div>

            {/* Card 2 */}
            <motion.div 
              variants={cardVariants} 
              className="bg-gradient-to-br from-slate-50/50 to-white rounded-3xl p-6 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-blue-50 text-blue-600 uppercase">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-500" /> 02 / 出海痛点审计
                </span>
                <span className="text-[10px] font-bold text-blue-400">海外市场及用户痛点</span>
              </div>
              <div className="w-full bg-[#f8f9fa] rounded-2xl p-4 text-xs md:text-sm text-[#202124] font-semibold min-h-[100px] whitespace-pre-wrap leading-relaxed border border-slate-100/80">{result?.market_pain_points}</div>
            </motion.div>

            {/* Card 3 - 爆点审计（微醺橙柔和渐变高亮） */}
            <motion.div 
              variants={cardVariants} 
              className="bg-gradient-to-br from-orange-50/20 to-white rounded-3xl p-6 border border-orange-100/50 shadow-[0_2px_8px_rgba(255,87,34,0.01)] hover:shadow-[0_12px_30px_rgba(255,87,34,0.05)] hover:-translate-y-0.5 transition-all duration-300 md:col-span-2 relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 border-b border-orange-100/10 pb-3">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-orange-50 text-[#FF5722] uppercase">
                  <Zap className="w-3.5 h-3.5 text-[#FF5722]" /> 03 / 盈利逻辑爆点
                </span>
                <span className="text-[10px] font-black text-[#FF5722] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF5722] animate-ping" />
                  商业/财务漏洞核实
                </span>
              </div>
              <div className="w-full bg-[#fffcf8] rounded-2xl p-4 text-xs md:text-sm text-[#b83c18] font-bold min-h-[100px] whitespace-pre-wrap leading-relaxed border border-orange-100/30">{result?.profit_logic_flaws}</div>
            </motion.div>

            {/* Card 4 - 行政深炭色高质感风险卡 */}
            <motion.div 
              variants={cardVariants} 
              className="bg-gradient-to-br from-[#1c1d21] to-[#121314] rounded-3xl p-6 border border-neutral-800 shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 transition-all duration-300 md:col-span-2 text-white relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-amber-500/10 text-amber-400 uppercase">
                  <Shield className="w-3.5 h-3.5 text-amber-500" /> 04 / 溯源与防伪审计
                </span>
                <span className="text-[10px] font-bold text-amber-500">信息防伪指引</span>
              </div>
              <div className="w-full bg-neutral-900/80 rounded-2xl p-4 text-xs md:text-sm text-gray-200 font-semibold min-h-[100px] whitespace-pre-wrap leading-relaxed border border-neutral-800 shadow-inner">{result?.traceability_training}</div>
            </motion.div>
          </div>

          {/* 进阶专项一：财报信息溯源 */}
          <motion.div 
            variants={cardVariants} 
            className="bg-gradient-to-br from-slate-50/50 to-white rounded-3xl p-6 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.04)] transition-all"
          >
            <span className="text-xs text-gray-400 font-black mb-4 tracking-widest uppercase block flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#FF5722]" /> 专项一：防伪风控追问 (怀疑精神培养)
            </span>
            <div className="bg-[#f8f9fa] rounded-2xl p-5 border border-gray-200/60 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#FF5722]" />
              <p className="text-xs md:text-sm font-bold text-[#FF5722] mb-2">【高管追问指标】：如果这些财报数据是伪造的/水分极高（例如关联交易虚增营收），我该通过哪些底牌勾稽关系去戳穿它？</p>
              <p className="text-xs text-gray-500 font-semibold leading-relaxed pl-1">
                *落地指引：强制审视“销售商品、提供劳务收到的现金”与“营业收入”是否背离；仔细核对“存货周转天数”是否异常拉长。去海关数据网核对其实际出海货运集装箱吞吐量，切忌盲信单页简报。
              </p>
            </div>
          </motion.div>
        </motion.div>
      );
    }

    // 外企邮件 - 升级立体化
    if (activeTab === 'email') {
      return (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Card 1 - 剥离客套（微醺橙柔和渐变高亮） */}
          <motion.div 
            variants={cardVariants} 
            className="bg-gradient-to-br from-orange-50/20 to-white rounded-3xl p-6 border border-orange-100/50 shadow-[0_2px_8px_rgba(255,87,34,0.01)] hover:shadow-[0_12px_30px_rgba(255,87,34,0.05)] hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4 border-b border-orange-100/10 pb-3">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-orange-50 text-[#FF5722] uppercase">
                <Key className="w-3.5 h-3.5 text-[#FF5722]" /> 01 / 真实立场脱水
              </span>
              <span className="text-[10px] font-bold text-[#FF5722]">剥离表面客套</span>
            </div>
            <div className="w-full bg-[#fffcf8] rounded-2xl p-4 text-xs md:text-sm text-[#b83c18] font-bold min-h-[150px] whitespace-pre-wrap leading-relaxed border border-orange-100/30">{result?.stripped_logic}</div>
          </motion.div>

          {/* Card 2 */}
          <motion.div 
            variants={cardVariants} 
            className="bg-gradient-to-br from-slate-50/50 to-white rounded-3xl p-6 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-blue-50 text-blue-600 uppercase">
                <Compass className="w-3.5 h-3.5 text-blue-500" /> 02 / 利益视角反转
              </span>
              <span className="text-[10px] font-bold text-blue-400">对手/对方底层考量</span>
            </div>
            <div className="w-full bg-[#f8f9fa] rounded-2xl p-4 text-xs md:text-sm text-[#202124] font-semibold min-h-[150px] whitespace-pre-wrap leading-relaxed border border-slate-100/80">{result?.stance_reversal}</div>
          </motion.div>

          {/* Card 3 - 行政深炭色高质感风险卡 */}
          <motion.div 
            variants={cardVariants} 
            className="bg-gradient-to-br from-[#1c1d21] to-[#121314] rounded-3xl p-6 border border-neutral-800 shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 transition-all duration-300 text-white relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-amber-500/10 text-amber-400 uppercase">
                <Shield className="w-3.5 h-3.5 text-amber-500" /> 03 / 攻防反向施压
              </span>
              <span className="text-[10px] font-bold text-amber-500">精准反向追问话术</span>
            </div>
            <div className="w-full bg-neutral-900/80 rounded-2xl p-4 text-xs md:text-sm text-gray-200 font-semibold min-h-[150px] whitespace-pre-wrap leading-relaxed border border-neutral-800 shadow-inner">{result?.counter_questions}</div>
          </motion.div>
        </motion.div>
      );
    }

    // 书目提纯 - 升级立体化
    if (activeTab === 'book') {
      return (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Card 1 */}
          <motion.div 
            variants={cardVariants} 
            className="bg-gradient-to-br from-slate-50/50 to-white rounded-3xl p-6 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-slate-100 text-slate-500 uppercase">
                <Eye className="w-3.5 h-3.5 text-gray-400" /> 01 / 核心亮点萃取
              </span>
              <span className="text-[10px] font-bold text-slate-400">思考逻辑主线</span>
            </div>
            <div className="w-full bg-[#f8f9fa] rounded-2xl p-4 text-xs md:text-sm text-[#202124] font-semibold min-h-[150px] whitespace-pre-wrap leading-relaxed border border-slate-100/80">{result?.thought_highlights}</div>
          </motion.div>

          {/* Card 2 - 漏洞审计（微醺橙柔和渐变高亮） */}
          <motion.div 
            variants={cardVariants} 
            className="bg-gradient-to-br from-orange-50/20 to-white rounded-3xl p-6 border border-orange-100/50 shadow-[0_2px_8px_rgba(255,87,34,0.01)] hover:shadow-[0_12px_30px_rgba(255,87,34,0.05)] hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4 border-b border-orange-100/10 pb-3">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-orange-50 text-[#FF5722] uppercase">
                <Zap className="w-3.5 h-3.5 text-[#FF5722]" /> 02 / 思维盲点审视
              </span>
              <span className="text-[10px] font-bold text-[#FF5722]">逻辑漏洞与局限性</span>
            </div>
            <div className="w-full bg-[#fffcf8] rounded-2xl p-4 text-xs md:text-sm text-[#b83c18] font-bold min-h-[150px] whitespace-pre-wrap leading-relaxed border border-orange-100/30">{result?.logic_flaws}</div>
          </motion.div>

          {/* Card 3 - 行政深炭色高质感风险卡 */}
          <motion.div 
            variants={cardVariants} 
            className="bg-gradient-to-br from-[#1c1d21] to-[#121314] rounded-3xl p-6 border border-neutral-800 shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 transition-all duration-300 text-white relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest bg-amber-500/10 text-amber-400 uppercase">
                <Target className="w-3.5 h-3.5 text-amber-500" /> 03 / 实战落地启示
              </span>
              <span className="text-[10px] font-bold text-amber-500">高阶职场应用</span>
            </div>
            <div className="w-full bg-neutral-900/80 rounded-2xl p-4 text-xs md:text-sm text-gray-200 font-semibold min-h-[150px] whitespace-pre-wrap leading-relaxed border border-neutral-800 shadow-inner">{result?.workplace_application}</div>
          </motion.div>
        </motion.div>
      );
    }
    
    return null;
  };

  return (
    <ModuleWrapper 
      title="解构 ｜ 看透商业与格局底牌" 
      icon={<BookOpen className="w-8 h-8" strokeWidth={2.5} />}
      description="核心定位：深度结构化阅读。将输入的信息转化为高阶判断力和决策力，融合政策敏感度与商业逻辑视角。"
    >
      <div className="bg-[#f8f9fa] rounded-[2.5rem] p-6 md:p-10 border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        
        {/* 顶部一排：场景大框架（通用社交、体制内职场、跨国企业） */}
        <div className="mb-8">
          <label className="block text-xs font-black text-gray-400 tracking-wider uppercase mb-3 flex items-center gap-1.5">
            <span>●</span> 场景框架 (Training Scenarios)
          </label>
          <div className="flex flex-wrap gap-3">
            {[
              { id: 'gov', label: '体制内职场', icon: <Building className="w-4 h-4" /> },
              { id: 'corp', label: '跨国企业', icon: <Globe className="w-4 h-4" /> },
              { id: 'social', label: '通用社交', icon: <Compass className="w-4 h-4" /> },
            ].map((framework) => {
              const isActive = sceneFramework === framework.id;
              return (
                <button
                  key={framework.id}
                  onClick={() => {
                    playPageTurn();
                    setSceneFramework(framework.id as any);
                  }}
                  className={`relative flex items-center gap-2 px-5 py-3 rounded-full text-xs font-bold transition-all duration-300 active:scale-95 border z-10 ${
                    isActive
                      ? 'text-white border-transparent'
                      : 'bg-white text-gray-500 border-gray-200/80 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeFrameworkBg"
                      className="absolute inset-0 bg-[#202124] rounded-full -z-10"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  {framework.icon}
                  <span className="relative z-10">{framework.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 极简风导航 Tabs (政策精神, 财报研判, 外企邮件, 书目提纯) */}
        <div className="mb-6">
          <label className="block text-xs font-black text-gray-400 tracking-wider uppercase mb-3 flex items-center gap-1.5">
            <span>●</span> 训练板块 (Core Modules)
          </label>
          <div className="flex flex-wrap gap-2">
            {tabs.map(t => {
              const isActive = activeTab === t.id;
              return (
                <button 
                  key={t.id}
                  onClick={() => {
                    playPageTurn();
                    setActiveTab(t.id);
                    setResult(null);
                    setErrorMsg('');
                    setIsReversalTriggered(false);
                    setUserReversalText('');
                    setReversalSubmitted(false);
                    setChatMessages([]);
                  }}
                  className={`relative flex items-center text-xs py-3 px-5 font-bold tracking-widest uppercase rounded-full transition-all border z-10 ${
                    isActive 
                      ? 'text-white border-transparent' 
                      : 'bg-white text-gray-500 border-gray-200/80 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabBg"
                      className="absolute inset-0 bg-[#FF5722] rounded-full -z-10 shadow-[0_4px_12px_rgba(255,87,34,0.3)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  {t.icon}
                  <span className="relative z-10">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 原文喂入区 & 推送 */}
        <div className="bg-white rounded-3xl shadow-[0_4px_25px_rgba(0,0,0,0.03)] border border-gray-100 p-6 mb-6 transition-all focus-within:shadow-[0_8px_30px_rgba(255,87,34,0.08)] focus-within:border-[#FF5722]/30">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">
              {activeTab === 'book' ? '日常阅读/感悟与思考自由键入' : '输入需要穿透的原始素材'}
            </span>
            {activeTab !== 'book' && (
              <button 
                onClick={handleLoadDailyPush}
                disabled={isPushLoading || isLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-[10px] tracking-widest uppercase border border-[#FF5722]/20 hover:border-[#FF5722] hover:bg-[#FF5722]/5 text-[#FF5722] transition-all relative overflow-hidden active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {isPushLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 animate-pulse" />}
                每日 AI 素材推送
              </button>
            )}
          </div>
          <textarea 
            rows={5} 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full bg-transparent p-0 text-sm outline-none resize-none leading-relaxed text-[#202124] placeholder-gray-300 font-semibold" 
            placeholder={
              activeTab === 'book'
                ? "在这里输入您对课外书的阅读感悟、精彩章节提纯或思维碎碎念，让 AI 深入为您挑刺漏洞、构建认知闭环..."
                : "粘贴冗杂的原文，或点击右上方“每日 AI 素材推送”由 AI 推送符合该场景下的训练素材..."
            }
          />
        </div>

        {/* 触发/解码按钮 */}
        <div className="relative w-full mb-10">
          {errorMsg && (
            <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-5 py-2.5 rounded-2xl text-xs font-black tracking-wider shadow-lg z-10 flex items-center gap-2 animate-bounce">
              <span>⚠️</span> {errorMsg}
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2.5 h-2.5 bg-red-500 rotate-45"></div>
            </div>
          )}

          <button 
            onClick={handlePenetrate}
            disabled={!inputText.trim() || isLoading || isPushLoading}
            className={`w-full text-xs py-4 rounded-full tracking-widest uppercase font-black transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-98
              ${isShaking ? 'bg-red-500 text-white animate-[shake_0.4s_ease-in-out] shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'btn-primary hover:scale-[1.005]'}`}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isShaking ? '解码异常' : '启动 AI 穿透解码'}
          </button>
        </div>
        
        {/* 多维因果降维输出框 */}
        <div className="mb-10">
          <h4 className="text-lg font-black text-[#202124] mb-6 flex items-center gap-3">
            <span>多维因果拆解</span> 
            <span className="text-[10px] bg-[#FF5722]/10 text-[#FF5722] px-3 py-1 rounded-full uppercase tracking-widest font-black">Mandatory Output</span>
          </h4>
          {renderResultGrid()}
        </div>

        {/* 进阶专项二：立场反转练习 */}
        <AnimatePresence>
          {result && isReversalTriggered && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.98 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.98 }}
              transition={{ type: 'spring' as const, stiffness: 220, damping: 26 }}
              className="mb-10 bg-[#fffdfa] rounded-3xl p-6 border border-amber-500/20 shadow-[0_0_25px_rgba(245,158,11,0.08)] relative overflow-hidden focus-within:shadow-[0_0_35px_rgba(245,158,11,0.12)] focus-within:border-amber-500/40 transition-all duration-500"
            >
              {/* Amber alarm pulse border */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500/80 via-orange-500/80 to-amber-500/80 animate-pulse" />
              <div className="flex items-center gap-2 mb-4">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-600"></span>
                </span>
                <span className="text-xs text-amber-700 font-black tracking-widest uppercase">专项二：立场反转挑战激活 (Stance Reversal Task)</span>
              </div>
              
              <p className="text-xs md:text-sm font-black text-gray-800 mb-4 leading-relaxed">{reversalPrompt}</p>
              
              <textarea
                rows={3}
                value={userReversalText}
                onChange={(e) => setUserReversalText(e.target.value)}
                disabled={reversalSubmitted || isReversalLoading}
                className="w-full bg-slate-50/50 border border-gray-200/80 rounded-2xl p-4 text-xs md:text-sm outline-none resize-none leading-relaxed text-gray-800 placeholder-gray-400 font-semibold focus:border-amber-500/40 focus:bg-white transition-all disabled:opacity-80"
                placeholder="请在这里输入您的反向解读与利益博弈思考..."
              />

              <div className="mt-4 flex justify-end">
                {!reversalSubmitted ? (
                  <button
                    onClick={handleSubmitReversal}
                    disabled={!userReversalText.trim() || isReversalLoading}
                    className="flex items-center gap-1.5 px-6 py-2.5 rounded-full text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-sm hover:shadow active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    {isReversalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    提交反向决策思考
                  </button>
                ) : (
                  <div className="w-full bg-amber-50/30 rounded-2xl p-4 border border-amber-100/50 mt-2 animate-[smoothAppear_0.4s_ease-out]">
                    <span className="text-[10px] font-black text-amber-700 block mb-2 uppercase tracking-wider">● 针对性审计反馈 (思维漏洞戳穿)</span>
                    <p className="text-xs text-amber-900 font-semibold leading-relaxed whitespace-pre-wrap">{reversalFeedback}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI 多维深度反馈面板 (评分和评价舱) */}
        {result && aiScore !== null && (
          <div className="mb-10 bg-white rounded-[2rem] p-6 md:p-8 border border-gray-100 shadow-[0_4px_30px_rgba(0,0,0,0.02)] grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
            {/* 评分仪表盘 */}
            <div className="flex flex-col items-center justify-center p-4 border-b lg:border-b-0 lg:border-r border-gray-100">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">本次吸收深度评分</span>
              <div className="relative flex items-center justify-center w-28 h-28">
                {/* SVG Ring */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="56" cy="56" r="48" stroke="#f0f0f0" strokeWidth="8" fill="transparent" />
                  <circle 
                    cx="56" cy="56" r="48" 
                    stroke="#FF5722" strokeWidth="8" fill="transparent" 
                    strokeDasharray={301.6} 
                    strokeDashoffset={301.6 - (301.6 * aiScore) / 10} 
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <AnimatedScore score={aiScore} />
                  <span className="text-[9px] font-bold text-gray-400">Score / 10.0</span>
                </div>
              </div>
            </div>

            {/* AI 深度教练建议 & 追问交互舱 */}
            <div className="lg:col-span-3 flex flex-col h-full justify-between">
              <div>
                <span className="text-xs font-black text-[#FF5722] uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                  <Award className="w-4 h-4" /> AI 穿透导师评价
                </span>
                <p className="text-xs md:text-sm text-gray-600 font-bold leading-relaxed whitespace-pre-wrap mb-4">{aiInsightDetails}</p>
              </div>

              {/* 专属 AI 交互舱 (Chatbot Interface) */}
              <div className="border-t border-gray-100 pt-4 mt-auto">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> 专属 AI 深度追问舱 (Interactive Chat)
                </span>
                
                {/* 消息历史 */}
                {chatMessages.length > 0 && (
                  <div className="max-h-48 overflow-y-auto mb-3 space-y-3 pr-2 custom-scrollbar">
                    {chatMessages.map((msg, i) => (
                      <div 
                        key={i} 
                        className={`flex flex-col max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed font-semibold transition-all ${
                          msg.role === 'user' 
                            ? 'bg-[#FF5722]/10 text-[#FF5722] ml-auto rounded-tr-none' 
                            : 'bg-gray-100 text-[#202124] rounded-tl-none border border-gray-200/50'
                        }`}
                      >
                        <span className="text-[9px] font-black opacity-40 mb-1">{msg.role === 'user' ? 'ME' : 'AI COACH'}</span>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="bg-gray-50 text-gray-400 rounded-2xl rounded-tl-none p-3 text-xs font-semibold w-max flex items-center gap-1.5 border border-gray-100 animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> 教练正在深度剖析...
                      </div>
                    )}
                  </div>
                )}

                {/* 快捷 Prompt 药丸 (Micro-Interactions) */}
                {chatMessages.length === 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[
                      '追问这一政策出台后的真实利益博弈细节',
                      '帮我指出我可能存在的解读误区',
                      '提供该场景下的经典高管应对案例',
                      '请提供针对此处破绽的反击话术'
                    ].map((pill, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setUserQuery(pill);
                          playClick();
                        }}
                        className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-[#f8f9fa] border border-gray-200 text-gray-500 hover:text-[#FF5722] hover:border-[#FF5722]/30 hover:bg-[#FF5722]/5 transition-all cursor-pointer"
                      >
                        {pill}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 bg-[#f8f9fa] rounded-2xl p-1.5 border border-gray-200/60 focus-within:border-[#FF5722]/30 transition-all">
                  <input 
                    type="text" 
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    disabled={isChatLoading}
                    className="flex-1 bg-transparent px-3 text-xs outline-none font-semibold text-[#202124] placeholder-gray-300"
                    placeholder="进一步追问或剖析自身思考漏洞..."
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={!userQuery.trim() || isChatLoading}
                    className="p-2.5 rounded-xl bg-[#202124] hover:bg-[#FF5722] text-white transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 板块总复盘记录 (Daily summary dashboard) */}
        <div className="mt-8 bg-gradient-to-br from-[#202124] to-[#303134] rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-lg">
          <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none transform translate-y-1/4 translate-x-1/8">
            <BookOpen className="w-64 h-64 text-white" />
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-4 mb-4 gap-4">
            <div>
              <h5 className="text-sm font-black tracking-widest uppercase text-gray-400 mb-1">【穿透读】 板块总复盘舱</h5>
              <p className="text-xs text-gray-500 font-bold">由 AI 高管教练对您每日深度吸收质量进行的量化看板</p>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">今日吸收素材</span>
                <span className="text-2xl font-black text-[#FF5722]">{todaySummary.absorbedCount}</span>
              </div>
              <div className="text-center border-l border-white/10 pl-6">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">日均思考得分</span>
                <span className="text-2xl font-black text-emerald-400">{todaySummary.averageScore || '-.-'}</span>
              </div>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 text-[#FF5722] animate-spin" /> 明日核心训练重点
            </span>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-start gap-3">
              <ChevronRight className="w-4 h-4 text-[#FF5722] shrink-0 mt-0.5" />
              <p className="text-xs text-gray-300 font-semibold leading-relaxed">{todaySummary.lastFocus}</p>
            </div>
          </div>
        </div>

      </div>
    </ModuleWrapper>
  );
}
