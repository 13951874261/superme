import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Download, 
  BookOpen, 
  Upload, 
  Link, 
  FileText, 
  Loader2, 
  Play, 
  Pause, 
  RotateCcw, 
  Mic, 
  MicOff, 
  CheckCircle2, 
  Sparkles, 
  RefreshCw, 
  Zap, 
  Award, 
  MessageSquare,
  Flame,
  User,
  Sliders,
  Check,
  Send
} from 'lucide-react';
import { runSpeakInfluenceEngine, transcribeAudioWithWhisper } from '../../services/difyAPI';
import { playSuccessCyber, playErrorCyber, playHeartbeat } from '../../utils/soundEffects';
import Confetti from '../Confetti';

interface TheoryItem {
  title: string;
  key: string;
  template: string;
  context: string;
  details: string[];
}

const THEORIES: TheoryItem[] = [
  {
    title: '1. 金字塔结构 (结论先行 - 重稳妥)',
    key: 'pyramid',
    template: '结论前置 + 核心支柱 + 事实依据',
    context: '最适用于体制内汇报、向上沟通或正式文书。讲求逻辑严密、不拖泥带水，给领导掌控感。',
    details: [
      '结论前置：开门见山，30秒内说出核心观点。例如：\"我建议立刻启动B方案。\"',
      '核心支柱：分层次支撑结论，通常不超过3点。例如：\"第一，能规避合规风险；第二，预算节省20%；第三，技术成熟度高。\"',
      '事实依据：调用客观数据或过往案例进行微观支撑，避免空洞说辞。'
    ]
  },
  {
    title: '2. 因果逻辑结构 (直述价值 - 重效率)',
    key: 'cause-effect',
    template: '背景成因 + 直接影响 + 策略价值',
    context: '最适用于跨国企业(外企)、高节奏商务谈判或项目协调。用客观链条推动决策，用价值而非关系说服。',
    details: [
      '背景成因：描述现状中的核心变化。例如：\"由于外籍客户对交付标准提高了30%。\"',
      '直接影响：因果链条严密推演。例如：\"如果我们不增加人手，将直接导致首期交付延期3周，危及后续合同。\"',
      '策略价值：直接量化汇报价值。例如：\"现申请增派2名专家，成本增加5%，但可保全后续120万欧元的订单。\"'
    ]
  },
  {
    title: '3. SCQA结构 (情境故事 - 重说服)',
    key: 'scqa',
    template: '情境 (S) + 冲突 (C) + 问题 (Q) + 回答 (A)',
    context: '适用于中短篇演讲、即兴公开发言或需要调动受众共情的场景。通过制造冲突引发关注。',
    details: [
      'S (Situation): 引入人人都认同的背景现状。\"过去一年我们新用户增长了50%。\"',
      'C (Conflict): 引入瓶颈或突发挑战。\"但我们的流失率同时上升了40%，拉新变成了筛沙子。\"',
      'Q (Question): 提炼出当前最需要解决的核心问题。\"怎样才能低成本锁住这批新用户？\"',
      'A (Answer): 给出你的创新解法。\"我们需要上线会员留存双轨计划。\"'
    ]
  },
  {
    title: '4. PREP结构 (黄金即兴 - 重响应)',
    key: 'prep',
    template: '观点 (P) + 原因 (R) + 实例 (E) + 观点 (P)',
    context: '最适用于突发提问、即兴插话或短小对话。培养“张口就有逻辑”的肌肉记忆，避免临场张结结巴巴。',
    details: [
      'Point (观点): 清晰、肯定地给出核心态度。\"我赞成缩短研发周期。\"',
      'Reason (原因): 给出支持这个态度的一条强逻辑线。\"因为竞品下个月就要发布同类更新，我们必须抢占身位。\"',
      'Example (实例): 提供一个具体且有说服力的微观事实。\"去年A项目迟到两周上线，导致直接流失了30%的种子用户。\"',
      'Point (观点): 再次强调观点，首尾呼应。\"所以，首期精简上线是当前最优解。\"'
    ]
  }
];

const SCENARIOS = [
  { id: 'gov', label: '体制内职场', desc: '注重稳健、结论前置、严防越界、用语委婉探讨' },
  { id: 'mnc', label: '跨国企业 (外企)', desc: '注重效率、因果清晰、直述商业价值、用语专业直接' },
  { id: 'social', label: '通用社交', desc: '注重情感链接、利益共存、幽默风趣、化解冲突' }
];

const DIMENSIONS = {
  types: ['长短演讲', '即兴发言', '汇报', '对话式', '团体谈判', '面试答辩', '礼仪表达', '无领导讨论'],
  purposes: ['信息传达', '说服', '娱乐', '情感', '操纵'],
  roles: ['向上/权威', '向下', '平级', '对外', '私下'],
  structures: ['金字塔逻辑', '因果逻辑', '时间逻辑', '问题-解决逻辑', '对比逻辑'],
  transparencies: ['坦诚', '委婉', '误导', '隐形', '沉默'],
  logics: ['推理式', '辩证式', '经验式', '情绪化']
};

interface MaterialItem {
  id: string;
  name: string;
  content: string;
  extractedTopic?: string;
  createdAt: string;
}

export default function SpeakModule() {
  const [activeTab, setActiveTab] = useState<'structural' | 'impromptu' | 'counter' | 'promotion'>('structural');
  const [selectedScenario, setSelectedScenario] = useState('mnc');
  const [expandedTheories, setExpandedTheories] = useState<Record<string, boolean>>({ pyramid: true });
  
  const [dimType, setDimType] = useState('即兴发言');
  const [dimPurpose, setDimPurpose] = useState('说服');
  const [dimRole, setDimRole] = useState('向上/权威');
  const [dimStructure, setDimStructure] = useState('因果逻辑');
  const [dimTransparency, setDimTransparency] = useState('坦诚');
  const [dimLogic, setDimLogic] = useState('推理式');

  const [promptTopic, setPromptTopic] = useState('跨国企业年中预算会：项目预算突然被削减30%，如何在2分钟内说服美籍副总裁恢复资金？');
  
  const [timeLimit, setTimeLimit] = useState(120);
  const [timeLeft, setTimeLeft] = useState(120);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [materials, setMaterials] = useState<MaterialItem[]>([
    {
      id: 'm1',
      name: '《麦肯锡结构化表达课》.txt',
      content: '结构化表达的核心是结论先行，自上而下。要把最核心的商业利益放在开头，然后以因果逻辑展开支撑...',
      extractedTopic: '如何向大中华区总裁汇报第二季度供应链危机？',
      createdAt: '2026-06-11'
    }
  ]);
  const [uploadUrl, setUploadUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputMode, setInputMode] = useState<'mild' | 'aggressive'>('mild');
  const [mildInput, setMildInput] = useState('');
  const [aggressiveInput, setAggressiveInput] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [evalResult, setEvalResult] = useState<{
    totalScore: number;
    logicScore: number;
    expressionScore: number;
    critique: string;
    frameworkAnalysis: string;
    revisedVersion: string;
    suggestions: string[];
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const [interactiveChat, setInteractiveChat] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [dailyReview, setDailyReview] = useState<{
    shortage: string;
    harvest: string;
    tomorrowFocus: string;
  } | null>(null);

  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 11 && prev > 1) {
            playHeartbeat();
          }
          if (prev <= 1) {
            setIsTimerRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
            playErrorCyber();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, timeLeft]);

  const resetTimer = () => {
    setIsTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(timeLimit);
  };

  const handleTimeLimitChange = (secs: number) => {
    setTimeLimit(secs);
    setTimeLeft(secs);
    setIsTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const toggleTheory = (key: string) => {
    setExpandedTheories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const exportTheories = () => {
    const textContent = THEORIES.map(t => {
      return `【${t.title}】\n模板：${t.template}\n适用场景：${t.context}\n具体指南：\n${t.details.map(d => `- ${d}`).join('\n')}`;
    }).join('\n\n====================\n\n');

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '破局表达高阶理论指南.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateAITopic = () => {
    const rType = DIMENSIONS.types[Math.floor(Math.random() * DIMENSIONS.types.length)];
    const rPurpose = DIMENSIONS.purposes[Math.floor(Math.random() * DIMENSIONS.purposes.length)];
    const rRole = DIMENSIONS.roles[Math.floor(Math.random() * DIMENSIONS.roles.length)];
    const rStructure = DIMENSIONS.structures[Math.floor(Math.random() * DIMENSIONS.structures.length)];
    const rTransparency = DIMENSIONS.transparencies[Math.floor(Math.random() * DIMENSIONS.transparencies.length)];
    const rLogic = DIMENSIONS.logics[Math.floor(Math.random() * DIMENSIONS.logics.length)];

    setDimType(rType);
    setDimPurpose(rPurpose);
    setDimRole(rRole);
    setDimStructure(rStructure);
    setDimTransparency(rTransparency);
    setDimLogic(rLogic);

    const scenarioText = SCENARIOS.find(s => s.id === selectedScenario)?.label || '职场';

    const topics: Record<string, string[]> = {
      mnc: [
        `作为[${rRole}]，在外企紧急重组会上，利用[${rStructure}]向管理层做一轮[${rType}]，旨在[${rPurpose}]对方同意保留你团队的核心技术资产。要求表达透明度为[${rTransparency}]，并偏向[${rLogic}]阐述。`,
        `作为[${rRole}]，外企跨国合并冲突中，面对美籍总监的激烈质疑，利用[${rStructure}]即兴说服对方维持现有研发投入比例。`,
        `外企晋升答辩挑战：用因果价值链条，针对高管提出的‘行政团队价值难量化’破绽进行完美说服。`
      ],
      gov: [
        `作为[${rRole}]，在体制内半年度总结会上，针对临时提问，使用[${rStructure}]和委婉的分寸，向处长阐述某合规改造项目的阶段性延期。要求确保立场[${rRole}]和高说服力。`,
        `体制内向上汇报突发风险：由于外协供货迟滞，如何用金字塔逻辑在不推卸责任的前提下申请宽限3天。`,
        `体制内跨部门协调：平级单位推诿责任，如何在联席会议上委婉而清晰地指出对方的进度漏洞。`
      ],
      social: [
        `作为[${rRole}]，在高端行业交流酒会上，面对同行对你商业模式的打探，进行[${rTransparency}]的客套隐形表达，利用[${rStructure}]既展现专业度又保护核心机密。`,
        `非正式饭局说服：如何委婉拒绝一位老同学的项目入股请求，同时不伤害彼此的信任基础。`,
        `即兴化解尴尬：在行业沙龙上被主持人推介评价某个竞品的优劣，用辩证的推理式逻辑进行得体作答。`
      ]
    };

    const sceneTopics = topics[selectedScenario] || topics.mnc;
    const selectedTopic = sceneTopics[Math.floor(Math.random() * sceneTopics.length)];
    setPromptTopic(selectedTopic);
    resetTimer();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        try {
          setIsUploading(true);
          const text = await transcribeAudioWithWhisper(audioBlob);
          if (inputMode === 'mild') {
            setMildInput(prev => prev ? prev + ' ' + text : text);
          } else {
            setAggressiveInput(prev => prev ? prev + ' ' + text : text);
          }
        } catch (err) {
          console.error('语音转写失败:', err);
        } finally {
          setIsUploading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('获取麦克风失败:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    const file = files[0];
    
    setTimeout(() => {
      const newMaterial: MaterialItem = {
        id: 'm_' + Date.now(),
        name: file.name,
        content: `这是从《${file.name}》中提取的核心内容...`,
        extractedTopic: `针对《${file.name}》中提出的痛点，如何进行高阶说服？`,
        createdAt: new Date().toISOString().split('T')[0]
      };
      setMaterials(prev => [newMaterial, ...prev]);
      setIsUploading(false);
      playSuccessCyber();
    }, 1500);
  };

  const handleUrlSubmit = () => {
    if (!uploadUrl) return;
    setIsUploading(true);
    
    setTimeout(() => {
      const name = uploadUrl.replace('https://', '').replace('http://', '').split('/')[0] + ' 提纯素材';
      const newMaterial: MaterialItem = {
        id: 'm_' + Date.now(),
        name: name,
        content: `从网址 ${uploadUrl} 中成功提纯的关于组织协调和危机公关的核心理论...`,
        extractedTopic: `在跨部门资源争夺中，如何化解来自同级部门的推诿？`,
        createdAt: new Date().toISOString().split('T')[0]
      };
      setMaterials(prev => [newMaterial, ...prev]);
      setUploadUrl('');
      setIsUploading(false);
      playSuccessCyber();
    }, 1500);
  };

  const evaluateSpeech = async () => {
    const currentInput = inputMode === 'mild' ? mildInput : aggressiveInput;
    if (!currentInput) {
      playErrorCyber();
      return;
    }

    setIsLoadingFeedback(true);
    setEvalResult(null);
    setInteractiveChat([]);

    const combinedInput = `【温和版回应】：\n${mildInput || '（未输入）'}\n\n【强硬版回应】：\n${aggressiveInput || '（未输入）'}`;

    try {
      const fullScenario = `[三大场景:${selectedScenario === 'mnc' ? '外企跨国环境' : selectedScenario === 'gov' ? '体制内公务环境' : '通用社交商务饭局'}] \n主题：${promptTopic} \n表达维度：类型-${dimType}, 目的-${dimPurpose}, 角色-${dimRole}, 结构-${dimStructure}, 透明度-${dimTransparency}, 逻辑-${dimLogic}`;

      const res = await runSpeakInfluenceEngine({
        training_mode: activeTab === 'structural' ? '结构化表达' : activeTab === 'impromptu' ? '即兴发言' : '精准提问',
        scenario: fullScenario,
        user_role: dimRole,
        target_audience: '评估委员会/受众',
        user_input: combinedInput
      });

      const rawScore = res.score || 75;
      const logicScore = Math.min(5, Number((rawScore * 0.05).toFixed(1)));
      const expressionScore = Math.min(5, Number(((rawScore - (logicScore * 20)) * 0.05).toFixed(1)) || 3.8);
      const totalScore = Number((logicScore + expressionScore).toFixed(1));

      const suggestions = [
        '在使用金字塔结构时，确保第一句话就是动作或结论，切忌铺垫过长',
        '向上沟通需要展现可控度，建议将"我们尽力配合"改为"我们将在X月X日交付第一阶段"',
        '外企场景中少用抽象形容词，多用量化指标及商业闭环利益'
      ];

      setEvalResult({
        totalScore,
        logicScore,
        expressionScore,
        critique: res.critique || '表达较为完整，但在分寸和逻辑链条的连贯性上仍有改进空间。',
        frameworkAnalysis: res.framework_analysis || '建议在开头直接点明利益捆绑，随后分三点展开事实支撑。',
        revisedVersion: res.revised_version || '重新设计的完美说辞：关于项目预算，我建议...',
        suggestions
      });

      setDailyReview({
        shortage: activeTab === 'impromptu' ? '即兴发言时结论后置，铺垫过长，容易丧失听众关注' : '双版本切换时强硬版过于情绪化，缺乏因果数据支撑',
        harvest: '熟练掌握了“因果清晰+直述价值”的外企因果表达框架，有效提升说服力',
        tomorrowFocus: '重点练习体制内委婉反驳话术，设计针对性破绽提问'
      });

      if (totalScore >= 8) {
        playSuccessCyber();
        setShowConfetti(true);
      } else {
        playErrorCyber();
      }

    } catch (error) {
      console.error(error);
      playErrorCyber();
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMsg = chatInput;
    setInteractiveChat(prev => [...prev, { sender: 'user', text: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);

    setTimeout(() => {
      let aiReply = '';
      if (userMsg.includes('分寸') || userMsg.includes('委婉')) {
        aiReply = '关于分寸度，体制内强调“职责守位”。建议您使用“委婉探讨”话术：“处长，关于这个节点，我有一点不成熟的思考，不知道从合规角度看是否稳妥...”，这样把评判权交还给领导，同时输出了专业思考。';
      } else if (userMsg.includes('强硬') || userMsg.includes('温和')) {
        aiReply = '在当前外企权力和利益结构下，强硬并不是指情绪化，而是指“规则与价值的坚守”。你可以说：“按照SOP，削减这部分预算将直接触发A类服务停摆，我们需要共同承担由此产生的业务违约金。”这种客观的强硬比主观情绪更具威力。';
      } else {
        aiReply = '很好的切入点。在实际表达中，您可以尝试将“我方困难”转换为“对方的风险与收益”。通过重塑逻辑，让听众觉得采纳您的方案是他们在规避风险，而非给您资源。';
      }
      setInteractiveChat(prev => [...prev, { sender: 'ai', text: aiReply }]);
      setIsChatLoading(false);
      playSuccessCyber();
    }, 1200);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 gap-8 p-1 text-slate-800 relative">
      {showConfetti && <Confetti duration={4000} onComplete={() => setShowConfetti(false)} />}
      
      <section className="lg:col-span-5 flex flex-col space-y-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600 animate-pulse" />
              <h3 className="text-base font-black text-slate-900 tracking-tight">理论推送与表达框架</h3>
            </div>
            <button 
              onClick={exportTheories}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 transition-all border border-slate-100"
              title="导出全部指南为TXT"
            >
              <Download className="w-3.5 h-3.5" /> 导出TXT
            </button>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {THEORIES.map((theory) => {
              const isOpen = !!expandedTheories[theory.key];
              return (
                <div key={theory.key} className="border border-slate-100 rounded-2xl overflow-hidden transition-all duration-300">
                  <button
                    onClick={() => toggleTheory(theory.key)}
                    className="w-full flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="text-left">
                      <div className="text-xs font-black text-slate-800">{theory.title}</div>
                      <div className="text-[10px] text-indigo-600 font-bold font-mono mt-0.5">{theory.template}</div>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>

                  {isOpen && (
                    <div className="p-4 bg-white space-y-3 border-t border-slate-100 animate-[fadeIn_0.2s_ease-out]">
                      <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
                        {theory.context}
                      </p>
                      <div className="space-y-2 pt-2 border-t border-dashed border-slate-100">
                        {theory.details.map((detail, idx) => (
                          <div key={idx} className="flex gap-2 text-xs text-slate-700">
                            <span className="text-indigo-500 font-bold font-mono">•</span>
                            <span className="leading-relaxed">{detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)] p-6 flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-black text-slate-900 tracking-tight">表达素材提纯底座</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            上传PDF书籍或网址，由AI提取核心事实或痛点，自动定制为高难度说服表达背景。
          </p>

          <div className="space-y-3 mb-6">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-4 transition-all hover:bg-indigo-50/10 group cursor-pointer"
              >
                <FileText className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 mb-1 transition-colors" />
                <span className="text-[11px] font-bold text-slate-600 group-hover:text-slate-800">上传PDF/文档</span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".pdf,.txt,.doc,.docx"
                  className="hidden" 
                />
              </button>

              <div className="flex flex-col border border-slate-200 rounded-2xl p-3 bg-slate-50/50 justify-between">
                <div className="flex items-center gap-1 mb-1">
                  <Link className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">导入网址链接</span>
                </div>
                <input
                  type="text"
                  placeholder="https://..."
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-500 focus:outline-none mb-2"
                />
                <button
                  onClick={handleUrlSubmit}
                  disabled={!uploadUrl || isUploading}
                  className="w-full bg-slate-900 hover:bg-indigo-600 text-white text-[10px] font-black tracking-wider uppercase py-1.5 rounded-lg transition-all"
                >
                  提取提纯
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[260px] min-h-[180px]">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">已提纯素材 ({materials.length})</div>
            {isUploading ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
                <span className="text-xs">AI 正在提纯素材，结构化分析中...</span>
              </div>
            ) : materials.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">暂无上传素材，请在上方添加</div>
            ) : (
              materials.map((m) => (
                <div
                  key={m.id}
                  onClick={() => m.extractedTopic && setPromptTopic(m.extractedTopic)}
                  className="p-4 bg-slate-50 hover:bg-indigo-50/30 rounded-2xl border border-slate-100 transition-all cursor-pointer group hover:border-indigo-200"
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{m.name}</span>
                    <span className="text-[9px] font-mono text-slate-400">{m.createdAt}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed truncate mb-2">{m.content}</p>
                  {m.extractedTopic && (
                    <div className="bg-white/60 p-2 rounded-xl border border-dashed border-indigo-100 text-[10px] text-indigo-600 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 flex-shrink-0 animate-pulse" />
                      <span className="font-semibold truncate">生成题目：{m.extractedTopic}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="lg:col-span-7 flex flex-col space-y-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)] p-6">
          <div className="flex border-b border-slate-100 pb-3 mb-6 overflow-x-auto gap-2">
            {[
              { id: 'structural', label: '结构化逻辑表达', icon: <Sliders className="w-4 h-4" /> },
              { id: 'impromptu', label: '即兴发言响应', icon: <Flame className="w-4 h-4" /> },
              { id: 'counter', label: '破绽提问与反击', icon: <User className="w-4 h-4" /> },
              { id: 'promotion', label: '晋升/跳槽价值表达', icon: <Award className="w-4 h-4" /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  generateAITopic();
                }}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {SCENARIOS.map((scen) => (
              <button
                key={scen.id}
                onClick={() => {
                  setSelectedScenario(scen.id);
                  generateAITopic();
                }}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  selectedScenario === scen.id 
                    ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-500/10' 
                    : 'bg-white border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className={`text-xs font-black ${selectedScenario === scen.id ? 'text-indigo-700' : 'text-slate-800'}`}>
                  {scen.label}
                </div>
                <div className="text-[9px] text-slate-400 leading-tight mt-1 line-clamp-1">
                  {scen.desc}
                </div>
              </button>
            ))}
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 mb-6 grid grid-cols-2 sm:grid-cols-3 gap-3 border border-slate-100">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">表达类型</label>
              <select 
                value={dimType} 
                onChange={(e) => setDimType(e.target.value)}
                className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none"
              >
                {DIMENSIONS.types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">沟通目的</label>
              <select 
                value={dimPurpose} 
                onChange={(e) => setDimPurpose(e.target.value)}
                className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none"
              >
                {DIMENSIONS.purposes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">受众角色</label>
              <select 
                value={dimRole} 
                onChange={(e) => setDimRole(e.target.value)}
                className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none"
              >
                {DIMENSIONS.roles.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">逻辑结构</label>
              <select 
                value={dimStructure} 
                onChange={(e) => setDimStructure(e.target.value)}
                className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none"
              >
                {DIMENSIONS.structures.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">意图透明度</label>
              <select 
                value={dimTransparency} 
                onChange={(e) => setDimTransparency(e.target.value)}
                className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none"
              >
                {DIMENSIONS.transparencies.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">思考逻辑</label>
              <select 
                value={dimLogic} 
                onChange={(e) => setDimLogic(e.target.value)}
                className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none"
              >
                {DIMENSIONS.logics.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-indigo-900/5 p-5 rounded-2xl border border-indigo-100 relative mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">AI 推送即兴场景</span>
              <button 
                onClick={generateAITopic}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> 换一题
              </button>
            </div>
            <p className="text-xs font-black text-slate-800 leading-relaxed">{promptTopic}</p>
          </div>

          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isTimerRunning ? 'bg-amber-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">倒计时控制</div>
                <div className="text-lg font-black font-mono text-slate-800 flex items-center gap-1.5">
                  <span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                  {timeLeft <= 10 && timeLeft > 0 && (
                    <span className="text-rose-500 text-xs animate-ping font-sans">⚠️ 紧张!</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-1.5">
              {[60, 120, 180].map(s => (
                <button
                  key={s}
                  onClick={() => handleTimeLimitChange(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                    timeLimit === s 
                      ? 'bg-slate-900 text-white' 
                      : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {s}s
                </button>
              ))}
              <button 
                onClick={resetTimer}
                className="p-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all"
                title="重置倒计时"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-black text-slate-900 tracking-tight">双版本对比挑战</h3>
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setInputMode('mild')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  inputMode === 'mild' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                温和版
              </button>
              <button
                onClick={() => setInputMode('aggressive')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  inputMode === 'aggressive' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                强硬版
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-4">
            {inputMode === 'mild' 
              ? '【温和版】目标：采取含蓄委婉的态度，把意图包裹在客套中，避免正面冲突。' 
              : '【强硬版】目标：采取直接肯定的态度，直述商业利益与规则，表明底线。'}
          </p>

          <div className="relative mb-4">
            <textarea
              rows={4}
              placeholder={inputMode === 'mild' ? "请输入或录制温和版回应..." : "请输入或录制强硬版回应..."}
              value={inputMode === 'mild' ? mildInput : aggressiveInput}
              onChange={(e) => inputMode === 'mild' ? setMildInput(e.target.value) : setAggressiveInput(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50/30"
            />
            
            <div className="absolute right-4 bottom-4 flex items-center gap-2">
              {isRecording ? (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md animate-pulse"
                >
                  <MicOff className="w-3.5 h-3.5" /> 停止录音
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  <Mic className="w-3.5 h-3.5" /> 语音录入
                </button>
              )}
            </div>
          </div>

          <button
            onClick={evaluateSpeech}
            disabled={isLoadingFeedback || (!mildInput && !aggressiveInput)}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black tracking-widest text-xs uppercase rounded-2xl transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50"
          >
            {isLoadingFeedback ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                正在智能重构与拆解...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                提交教练深度评估
              </>
            )}
          </button>
        </div>

        {evalResult && (
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-[0_15px_40px_rgba(16,185,129,0.05)] p-6 relative overflow-hidden transition-all duration-500 animate-[fadeIn_0.5s_ease-out]">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-400 via-teal-500 to-indigo-500 animate-pulse"></div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div>
                <h3 className="text-base font-black text-slate-900">教练深度剖析与双版本权衡</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">多维对比评估体系已就绪</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-emerald-50 border border-emerald-250/50 rounded-2xl p-2 px-3 text-right">
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">逻辑战力</span>
                  <span className="text-base font-black text-emerald-700 font-mono">{evalResult.logicScore} / 5</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-250/50 rounded-2xl p-2 px-3 text-right">
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">表达分寸</span>
                  <span className="text-base font-black text-emerald-700 font-mono">{evalResult.expressionScore} / 5</span>
                </div>
                <div className="bg-indigo-600 text-white rounded-2xl p-2 px-4 text-center shadow-lg shadow-indigo-600/10">
                  <span className="text-[9px] font-black uppercase tracking-widest block opacity-80">总得分</span>
                  <span className="text-lg font-black font-mono">{evalResult.totalScore} <span className="text-xs font-normal">/ 10</span></span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {[
                { label: '地域文化适配', score: '适配', color: 'text-indigo-600 bg-indigo-50' },
                { label: '角色立场定位', score: '精准', color: 'text-emerald-600 bg-emerald-50' },
                { label: '逻辑框架完整度', score: '极佳', color: 'text-amber-600 bg-amber-50' },
                { label: '语调停顿留白', score: '良好', color: 'text-teal-600 bg-teal-50' },
                { label: '词汇精准度', score: '极佳', color: 'text-rose-600 bg-rose-50' },
                { label: '事实数据调用', score: '尚可', color: 'text-purple-600 bg-purple-50' }
              ].map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500">{item.label}</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.color}`}>{item.score}</span>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-black text-rose-600 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-3.5 bg-rose-500 rounded-full inline-block"></span>
                  破绽与失分点 (Critique)
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed bg-rose-50/30 p-4 rounded-2xl border border-rose-100">
                  {evalResult.critique}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-black text-indigo-600 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full inline-block"></span>
                  高维表达重构 (Framework Analysis)
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100">
                  {evalResult.frameworkAnalysis}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-black text-emerald-600 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-3.5 bg-emerald-500 rounded-full inline-block"></span>
                  满分实战话术 (Golden Script)
                </h4>
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 relative">
                  <p className="text-slate-800 text-xs font-medium leading-relaxed font-serif italic">
                    "{evalResult.revisedVersion}"
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-1.5 mb-3">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-black text-slate-800">漏洞靶向追问 (与AI深入探讨)</span>
                </div>
                
                {interactiveChat.length > 0 && (
                  <div className="space-y-3 mb-4 max-h-[180px] overflow-y-auto pr-1">
                    {interactiveChat.map((msg, index) => (
                      <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                          msg.sender === 'user' 
                            ? 'bg-indigo-600 text-white rounded-br-none' 
                            : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="针对失分点、分寸度拿捏向AI教练追问 (如: '如何委婉指出处长逻辑漏洞?建议那些改进')"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={isChatLoading || !chatInput.trim()}
                    className="p-2 bg-slate-950 text-white rounded-xl hover:bg-indigo-600 transition-colors flex items-center justify-center disabled:opacity-50"
                  >
                    {isChatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {dailyReview && (
                <div className="mt-8 border-t border-slate-200 pt-6">
                  <h4 className="text-xs font-black text-slate-900 mb-4 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    今日训练复盘与明日迭代重点
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-rose-50/30 border border-rose-100 rounded-2xl p-4">
                      <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">今日逻辑短板</div>
                      <div className="text-xs text-slate-700 leading-relaxed font-medium">{dailyReview.shortage}</div>
                    </div>
                    <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4">
                      <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">今日表达收获</div>
                      <div className="text-xs text-slate-700 leading-relaxed font-medium">{dailyReview.harvest}</div>
                    </div>
                    <div className="bg-indigo-50/30 border border-indigo-100 rounded-2xl p-4">
                      <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">明日迭代重点</div>
                      <div className="text-xs text-slate-700 leading-relaxed font-medium">{dailyReview.tomorrowFocus}</div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </section>
    </div>
  );
}
