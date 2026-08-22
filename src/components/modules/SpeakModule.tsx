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
  Users,
  Sliders,
  Check,
  Send,
  Copy,
  X
} from 'lucide-react';
import { runSpeakInfluenceEngine, transcribeAudioWithWhisper, runSpeakCritiqueChat } from '../../services/difyAPI';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

const TRANSCRIBING_PROMPTS = [
  '🎙️ 正在读取并识别录音音轨...',
  '🤖 语音识别成功，大模型润色纠错中...',
  '✨ 正在梳理最佳口语表达版本...'
];
import { playSuccessCyber, playErrorCyber, playHeartbeat, playClick, playPageTurn, playWaterDrop } from '../../utils/soundEffects';
import Confetti from '../Confetti';
import SpeakButton from '../SpeakButton';
import { getUserCurrentProfile } from '../../utils/profileHelper';
import { motion, AnimatePresence } from 'motion/react';
import { useTask } from '../TaskContext';
import { notifyBackgroundHandoff } from '../../utils/backgroundHandoff';
import type { SpeakInfluenceResult, SpeakFlaw } from '../../services/difyAPI';
import type { ModuleType } from '../../App';
import { requestGameTheorySessionFocus } from '../../utils/gtFocusTab';

function knowledgeTaskLogs(reminder?: string): string[] {
  return reminder
    ? [reminder, '任务已提交，请在任务中心查看进度']
    : ['任务已提交，请在任务中心查看进度'];
}


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
      '直接影响：因果链条严密分析。例如：\"如果我们不增加人手，将直接导致首期交付延期3周，危及后续合同。\"',
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
    context: '最适用于突发提问、即兴插话或短小对话。培养“张口就有逻辑”的表达习惯，避免临场张结结巴巴。',
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
  { id: 'social', label: '通用社交', desc: '注重情感链接、利益共存、幽默风趣、化解冲突' },
  { id: 'custom', label: '自定义场景', desc: '输入您想演练的具体人际博弈、商务谈判或日常对话主题' }
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

type SpeakModuleProps = {
  setActiveModule?: (m: ModuleType) => void;
};

export default function SpeakModule({ setActiveModule }: SpeakModuleProps = {}) {
  const { tasks, addTask, setIsOpen: setTaskCenterOpen } = useTask();
  const [activeTab, setActiveTab] = useState<'structural' | 'impromptu' | 'counter' | 'promotion'>('structural');
  const [selectedScenario, setSelectedScenario] = useState('mnc');
  const [expandedTheories, setExpandedTheories] = useState<Record<string, boolean>>({ pyramid: true });
  const [showContextSheet, setShowContextSheet] = useState(false);
  const [isCyberLocked, setIsCyberLocked] = useState(false);
  
  const [dimType, setDimType] = useState('即兴发言');
  const [dimPurpose, setDimPurpose] = useState('说服');
  const [dimRole, setDimRole] = useState('向上/权威');
  const [dimStructure, setDimStructure] = useState('因果逻辑');
  const [dimTransparency, setDimTransparency] = useState('坦诚');
  const [dimLogic, setDimLogic] = useState('推理式');

  const [promptTopic, setPromptTopic] = useState('跨国企业年中预算会：项目预算突然被削减30%，如何在2分钟内说服美籍副总裁恢复资金？');
  const [matchedFactor, setMatchedFactor] = useState('');
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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribingTextIndex, setTranscribingTextIndex] = useState(0);

  const overlayRef = useRef<HTMLDivElement>(null);
  const waveContainerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isTranscribing) {
      setTranscribingTextIndex(0);
      timer = setInterval(() => {
        setTranscribingTextIndex(prev => (prev + 1) % TRANSCRIBING_PROMPTS.length);
      }, 2000);
    } else {
      setTranscribingTextIndex(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isTranscribing]);

  useGSAP(() => {
    if (isTranscribing && waveContainerRef.current) {
      const bars = waveContainerRef.current.querySelectorAll('.wave-bar');
      if (bars.length > 0) {
        gsap.killTweensOf(bars);
        gsap.to(bars, {
          scaleY: 2.2,
          duration: 0.55,
          repeat: -1,
          yoyo: true,
          ease: 'power1.inOut',
          stagger: {
            each: 0.12,
            from: 'center'
          }
        });
      }
    }
  }, [isTranscribing]);

  useGSAP(() => {
    if (isTranscribing && textRef.current) {
      gsap.killTweensOf(textRef.current);
      gsap.fromTo(textRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }
  }, [transcribingTextIndex, isTranscribing]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputMode, setInputMode] = useState<'mild' | 'aggressive'>('mild');
  const [mildInput, setMildInput] = useState('');
  const [aggressiveInput, setAggressiveInput] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const recognitionTextRef = useRef<string>('');
  const recordingStartTimeRef = useRef<number>(0);

  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [speakSubmitNotice, setSpeakSubmitNotice] = useState('');
  const [pendingSpeakTaskId, setPendingSpeakTaskId] = useState<string | null>(null);
  const [evalResult, setEvalResult] = useState<{
    totalScore: number;
    logicScore: number;
    expressionScore: number;
    critique: string;
    frameworkAnalysis: string;
    revisedVersion: string;
    suggestions: string[];
    flaws?: SpeakFlaw[];
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const [interactiveChat, setInteractiveChat] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [dailyReview, setDailyReview] = useState<{
    shortage: string;
    harvest: string;
    tomorrowFocus: string;
  } | null>(null);

  // 同步锁定与面板展示状态
  useEffect(() => {
    if (evalResult) {
      setIsCyberLocked(evalResult.totalScore < 8);
      setShowContextSheet(true);
    } else {
      setIsCyberLocked(false);
      setShowContextSheet(false);
    }
  }, [evalResult]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [interactiveChat]);

  // 智能空白处点击判定逻辑
  const handleOutsideClick = (e: React.MouseEvent) => {
    if (!showContextSheet) return;
    const target = e.target as HTMLElement;
    if (target.closest('.speak-context-drawer') || target.closest('[data-drawer-root]')) {
      return;
    }
    
    // 如果存在选中的文本，不收起面板（方便划词）
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
      return;
    }

    const isInteractive = target.closest(
      'button, a, input, textarea, select, [role="button"], .interactive, .cursor-pointer'
    ) !== null;
    
    if (!isInteractive) {
      setShowContextSheet(false);
    }
  };

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

  useEffect(() => {
    const checkProfile = () => {
      const profile = getUserCurrentProfile();
      const keywords = ['直属总监', '总监', '压制', '退缩', '汇报', '口语分寸', '分寸感'];
      let foundKeyword = '';
      if (profile) {
        for (const kw of keywords) {
          if (profile.includes(kw)) {
            foundKeyword = kw;
            break;
          }
        }
      }
      if (foundKeyword) {
        setMatchedFactor(foundKeyword);
        // 如果当前题目是初始题目，则进行初始化重写
        setPromptTopic(prev => {
          if (prev.includes('预算突然被削减30%') || prev.startsWith('针对短板【')) {
            if (foundKeyword.includes('总监') || foundKeyword.includes('压制')) {
              return `针对短板【${foundKeyword}】进化演练：在外企高管或直属总监的当面强力压制下，如何作为下属，利用【因果逻辑】进行【即兴发言】以从容应对，实现说服对方并挽回话语权？`;
            } else if (foundKeyword.includes('退缩')) {
              return `针对短板【${foundKeyword}】进化演练：在面临高压博弈时克服防御性退缩，作为下属，以坦诚的立场，使用【因果逻辑】坚决表明立场，达成说服对方目的。`;
            } else {
              return `针对短板【${foundKeyword}】进化演练：作为下属在正式汇报中，如何拿捏委婉的分寸，运用【金字塔逻辑】，在不引起对方反感的前提下委婉说服对方？`;
            }
          }
          return prev;
        });
      } else {
        setMatchedFactor('');
      }
    };

    checkProfile();

    window.addEventListener('global-profile-changed', checkProfile);
    return () => {
      window.removeEventListener('global-profile-changed', checkProfile);
    };
  }, []);

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
    link.download = '表达高阶理论指南.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateAITopic = (forcedScenario?: string) => {
    const activeScenario = forcedScenario || selectedScenario;

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

    if (activeScenario === 'custom') {
      resetTimer();
      return;
    }

    const profile = getUserCurrentProfile();
    const keywords = ['直属总监', '总监', '压制', '退缩', '汇报', '口语分寸', '分寸感'];
    let foundKeyword = '';
    if (profile) {
      for (const kw of keywords) {
        if (profile.includes(kw)) {
          foundKeyword = kw;
          break;
        }
      }
    }

    if (foundKeyword) {
      setMatchedFactor(foundKeyword);
      let targetedTopic = '';
      if (foundKeyword.includes('总监') || foundKeyword.includes('压制')) {
        targetedTopic = `针对短板【${foundKeyword}】进化演练：在外企高管或直属总监的当面强力压制下，如何作为[${rRole}]，利用[${rStructure}]在[${rType}]中从容应对，实现[${rPurpose}]并挽回话语权？`;
      } else if (foundKeyword.includes('退缩')) {
        targetedTopic = `针对短板【${foundKeyword}】进化演练：在面临高压博弈时克服防御性退缩，作为[${rRole}]，以[${rTransparency}]的立场，使用[${rStructure}]坚决表明立场，达成[${rPurpose}]目的。`;
      } else if (foundKeyword.includes('分寸') || foundKeyword.includes('口语')) {
        targetedTopic = `针对短板【${foundKeyword}】进化演练：作为[${rRole}]在正式[${rType}]中，如何拿捏委婉的分寸，运用[${rStructure}]逻辑，在不引起对方反感的前提下委婉说服对方？`;
      } else {
        targetedTopic = `针对短板【${foundKeyword}】进化演练：面对高难度沟通挑战，作为[${rRole}]利用[${rStructure}]在[${rType}]中进行[${rLogic}]阐述，克服该短板以达成[${rPurpose}]。`;
      }
      setPromptTopic(targetedTopic);
    } else {
      setMatchedFactor('');
      const topics: Record<string, string[]> = {
        mnc: [
          `作为[${rRole}]，在外企紧急重组会上，利用[${rStructure}]向管理层做一轮[${rType}]，旨在[${rPurpose}]对方同意保留你团队的核心技术资产。要求表达透明度为[${rTransparency}]，并偏向[${rLogic}]阐述。`,
          `作为[${rRole}]，外企跨国合并冲突中，面对美籍总监的激烈质疑，利用[${rStructure}]即兴说服对方维持现有研发投入比例。`,
          `外企晋升答辩挑战：用因果价值链条，针对高管提出的‘行政团队价值难量化’破绽进行完美说服。`
        ],
        gov: [
          `作为[${rRole}]，在体制内半年度总结会上，针对临时提问，使用[${rStructure}]和委婉的分寸，向处长阐述某合规改造项目的阶段性延期。要求确保立场[${rRole}]和高说服力。`,
          `体制内向上汇报突发风险：由于外协供货迟滞，如何用金字态逻辑在不推卸责任的前提下申请宽限3天。`,
          `体制内跨部门协调：平级单位推诿责任，如何在联席会议上委婉而清晰地指出对方的进度漏洞。`
        ],
        social: [
          `作为[${rRole}]，在高端行业交流酒会上，面对同行对你商业模式的打探，进行[${rTransparency}]的客套隐形表达，利用[${rStructure}]既展现专业度又保护核心机密。`,
          `非正式饭局说服：如何委婉拒绝一位老同学的项目入股请求，同时不伤害彼此的信任基础。`,
          `即兴化解尴尬：在行业沙龙上被主持人推介评价某个竞品的优劣，用辩证的推理式逻辑进行得体作答。`
        ]
      };

      const sceneTopics = topics[activeScenario] || topics.mnc;
      if (sceneTopics.length > 0) {
        const historyKey = `speak_topic_history_${activeScenario}`;
        let history: string[] = [];
        try {
          history = JSON.parse(localStorage.getItem(historyKey) || '[]');
        } catch (e) {
          history = [];
        }

        let pool = sceneTopics.filter((t) => !history.includes(t));
        if (pool.length === 0) {
          pool = sceneTopics;
          localStorage.setItem(historyKey, '[]');
          history = [];
        }

        const selectedTopic = pool[Math.floor(Math.random() * pool.length)];
        const newHistory = [...history, selectedTopic].slice(-3);
        localStorage.setItem(historyKey, JSON.stringify(newHistory));
        setPromptTopic(selectedTopic);
      }
    }
    resetTimer();
  };


  const startRecording = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      return;
    }
    recordingStartTimeRef.current = Date.now();
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
          setIsTranscribing(true);
          const text = await transcribeAudioWithWhisper(audioBlob);
          if (inputMode === 'mild') {
            setMildInput(prev => prev ? prev + ' ' + text : text);
          } else {
            setAggressiveInput(prev => prev ? prev + ' ' + text : text);
          }
        } catch (err) {
          console.error('语音转译失败:', err);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('获取麦克风失败:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
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
      const name = uploadUrl.replace('https://', '').replace('http://', '').split('/')[0] + ' 学习素材';
      const newMaterial: MaterialItem = {
        id: 'm_' + Date.now(),
        name: name,
        content: `从网址 ${uploadUrl} 中整理出的关于组织协调和危机公关的核心理论...`,
        extractedTopic: `在跨部门资源争夺中，如何化解来自同级部门的推诿？`,
        createdAt: new Date().toISOString().split('T')[0]
      };
      setMaterials(prev => [newMaterial, ...prev]);
      setUploadUrl('');
      setIsUploading(false);
      playSuccessCyber();
    }, 1500);
  };

  const applySpeakEngineResult = (res: SpeakInfluenceResult, isMock = false, isGoldenScript = false) => {
    let logicScore: number, expressionScore: number, totalScore: number;
    if (isMock) {
      if (isGoldenScript) {
        totalScore = 9.2;
        logicScore = 4.6;
        expressionScore = 4.6;
      } else {
        totalScore = 6.7;
        logicScore = 3.2;
        expressionScore = 3.5;
      }
    } else {
      const rawScore = res.score || 75;
      logicScore = Math.min(5, Number((rawScore * 0.05).toFixed(1)));
      expressionScore = Math.min(5, Number(((rawScore - (logicScore * 20)) * 0.05).toFixed(1)) || 3.8);
      totalScore = Number((logicScore + expressionScore).toFixed(1));
    }

    const suggestions = [
      '在使用金字塔结构时，确保第一句话就是动作或结论，切忌铺垫过长',
      '向上沟通需要展现可控度，建议将"我们尽力配合"改为"我们将在X月X日交付第一阶段"',
      '外企场景中少用抽象形容词，多用量化指标及商业闭环利益'
    ];

    const defaultFlaws: SpeakFlaw[] = [
      {
        id: 'f1',
        title: '空泛承诺',
        detail: '「尽快看看」「问题不大」缺少时间表、责任人和风险预案，领导无法决策。',
        dimension: 'logic'
      },
      {
        id: 'f2',
        title: '分寸过轻',
        detail: '对领导使用过于口语化的表述，缺少请教姿态，容易被理解为推诿。',
        dimension: 'expression'
      }
    ];

    const normalizedFlaws: SpeakFlaw[] = (Array.isArray(res.flaws) && res.flaws.length > 0)
      ? res.flaws
      : defaultFlaws;

    setEvalResult({
      totalScore,
      logicScore,
      expressionScore,
      critique: isMock && !isGoldenScript
        ? '表达逻辑较为薄弱，缺乏具体事实和数据支撑，且用语过于情绪化，不符合外企高节奏效率沟通的要求。'
        : (res.critique || '表达较为完整，但在分寸和逻辑链条的连贯性上仍有改进空间。'),
      frameworkAnalysis: isMock && !isGoldenScript
        ? '建议使用因果逻辑框架：直陈预算削减的业务影响（如服务中断、合同违约金），并给出替代方案。'
        : (res.framework_analysis || '建议在开头直接点明利益捆绑，随后分三点展开事实支撑。'),
      revisedVersion: res.revised_version || '重新设计的完美说辞：关于项目预算，我建议...',
      suggestions,
      flaws: normalizedFlaws
    });

    setDailyReview({
      shortage: activeTab === 'impromptu' ? '即兴发言时结论后置，铺垫过长，容易丧失听众关注' : '双版本切换时强硬版过于情绪化，缺乏因果数据支撑',
      harvest: '熟练掌握了“因果清晰+直述价值”的外企因果表达框架，有效提升说服力',
      tomorrowFocus: '重点练习体制内委婉反驳话术，设计针对性破绽提问'
    });

    playPageTurn();
    if (totalScore >= 8) {
      playSuccessCyber();
      setShowConfetti(true);
    } else {
      playErrorCyber();
    }
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
    setSpeakSubmitNotice('');

    const combinedInput = `【温和版回应】：\n${mildInput || '（未输入）'}\n\n【强硬版回应】：\n${aggressiveInput || '（未输入）'}`;

    try {
      const fullScenario = `[三大场景:${selectedScenario === 'mnc' ? '外企跨国环境' : selectedScenario === 'gov' ? '体制内公务环境' : '通用社交商务饭局'}] \n主题：${promptTopic} \n表达维度：类型-${dimType}, 目的-${dimPurpose}, 角色-${dimRole}, 结构-${dimStructure}, 透明度-${dimTransparency}, 逻辑-${dimLogic}`;

      const isMock = window.location.search.includes('mock=true') || (window as any).__MOCK_EVALUATION__;
      const isGoldenScript = isMock && (currentInput.includes('Based on the current alignment') || currentInput.includes('Tier-A servers'));

      if (isMock) {
        applySpeakEngineResult({
          score: isGoldenScript ? 92 : 67,
          critique: isGoldenScript
            ? 'Based on the current alignment, cutting 30% budget will trigger a service disruption on Tier-A servers, resulting in a contract penalty of $50k. To secure our Q3 revenue projection, we propose two mitigation options...'
            : '表达逻辑较为薄弱，缺乏具体事实和数据支撑，且用语过于情绪化，不符合外企高节奏效率沟通的要求。',
          framework_analysis: isGoldenScript
            ? '采用了完美的因果逻辑，直述商业价值和风险，非常出色。'
            : '建议使用因果逻辑框架：直陈预算削减 of 业务影响（如服务中断、合同违约金），并给出替代方案。',
          revised_version: 'Based on the current alignment, cutting 30% budget will trigger a service disruption on Tier-A servers, resulting in a contract penalty of $50k. To secure our Q3 revenue projection, we propose two mitigation options...'
        }, true, isGoldenScript);
        return;
      }

      const { taskId, knowledgeReminder } = await runSpeakInfluenceEngine({
        training_mode: activeTab === 'structural' ? '结构化表达' : activeTab === 'impromptu' ? '即兴发言' : '精准提问',
        scenario: fullScenario,
        user_role: dimRole,
        target_audience: '评估委员会/受众',
        user_input: combinedInput
      });
      addTask({
        id: taskId,
        type: 'speak',
        name: `说评估: ${(activeTab === 'structural' ? '结构化表达' : activeTab === 'impromptu' ? '即兴发言' : '精准提问')}`,
        status: 'running',
        progress: 10,
        logs: knowledgeTaskLogs(knowledgeReminder),
      });
      setPendingSpeakTaskId(taskId);
      const speakHandoff = knowledgeReminder
        ? `已提交后台。${knowledgeReminder}。请到任务中心查看进度。`
        : '已提交后台。请到任务中心查看进度。';
      setSpeakSubmitNotice(speakHandoff);
      notifyBackgroundHandoff({ message: speakHandoff, tone: 'info' });
    } catch (error) {
      console.error(error);
      playErrorCyber();
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  useEffect(() => {
    const raw = sessionStorage.getItem('speak_influence_result');
    if (!raw) return;
    sessionStorage.removeItem('speak_influence_result');
    try {
      const parsed = JSON.parse(raw) as SpeakInfluenceResult;
      if (parsed && typeof parsed === 'object') {
        applySpeakEngineResult(parsed);
      }
    } catch {
      /* ignore broken payload */
    }
  }, []);

  useEffect(() => {
    if (!pendingSpeakTaskId) return;
    const task = tasks.find((item) => item.id === pendingSpeakTaskId);
    if (!task) return;
    if (task.status === 'completed' && task.result) {
      setPendingSpeakTaskId(null);
      setSpeakSubmitNotice('');
      applySpeakEngineResult({
        score: Number(task.result.score) || 0,
        critique: task.result.critique || '',
        framework_analysis: task.result.framework_analysis || '',
        revised_version: task.result.revised_version || '',
        flaws: Array.isArray(task.result.flaws) ? task.result.flaws : undefined,
      });
    } else if (task.status === 'failed') {
      setPendingSpeakTaskId(null);
      setSpeakSubmitNotice(task.error || '说评估任务失败');
      playErrorCyber();
    }
  }, [tasks, pendingSpeakTaskId]);

  const handleFlawCardClick = (flaw: SpeakFlaw) => {
    const query = `请针对这条失分点展开，并给出一句可直接说出口的改写：【${flaw.title}】${flaw.detail}`;
    sendChatMessage(query);
  };

  const handleLogicDimensionClick = () => {
    if (!evalResult) return;
    const query = `请针对「逻辑战力 ${evalResult.logicScore}/5」说明失分原因，并给出下一次开口的 2 条改法。`;
    sendChatMessage(query);
  };

  const handleExpressionDimensionClick = () => {
    if (!evalResult) return;
    const query = `请针对「表达分寸 ${evalResult.expressionScore}/5」说明失分原因，并给出更得体的 2 句替换。`;
    sendChatMessage(query);
  };

  const sendChatMessage = async (customQuery?: string) => {
    const queryToSend = (typeof customQuery === 'string' ? customQuery : chatInput).trim();
    if (!queryToSend || isChatLoading) return;
    
    const userMsg = queryToSend;
    if (!customQuery) {
      setChatInput('');
    }
    setInteractiveChat(prev => [...prev, { sender: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      const isMock = window.location.search.includes('mock=true') || (window as any).__MOCK_EVALUATION__;
      const reply = await runSpeakCritiqueChat({
        query: userMsg,
        evalSnapshot: evalResult ? {
          totalScore: evalResult.totalScore,
          logicScore: evalResult.logicScore,
          expressionScore: evalResult.expressionScore,
          critique: evalResult.critique,
          flaws: evalResult.flaws,
          revisedVersion: evalResult.revisedVersion,
          userInputExcerpt: inputMode === 'mild' ? mildInput : aggressiveInput,
          scenarioExcerpt: `[场景:${selectedScenario}] ${promptTopic}`
        } : undefined,
        messages: interactiveChat,
        mock: isMock
      });

      setInteractiveChat(prev => [...prev, { sender: 'ai', text: reply }]);
      playSuccessCyber();
    } catch (err: any) {
      console.error('追问失败:', err);
      setInteractiveChat(prev => [
        ...prev, 
        { sender: 'ai', text: `追问失败：${err.message || '网络异常，请稍后重试'}` }
      ]);
      playErrorCyber();
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div 
      className="relative flex min-h-screen w-full gap-6 overflow-hidden text-slate-800"
      onClick={handleOutsideClick}
    >
      {showConfetti && <Confetti duration={4000} onComplete={() => setShowConfetti(false)} />}
      
      {/* Left Workspace */}
      <div className={`transition-all duration-500 ease-in-out grid grid-cols-1 lg:grid-cols-12 gap-8 shrink-0 ${showContextSheet ? 'w-[70%]' : 'w-full'}`}>
      
      <section className="lg:col-span-5 flex flex-col space-y-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600 animate-pulse" />
              <h3 className="text-base font-black text-slate-900 tracking-tight">理论推送与表达框架</h3>
            </div>
            <button 
              onClick={exportTheories}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-[var(--color-brand)] bg-slate-50 hover:bg-slate-50 transition-all border border-slate-100"
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
            <h3 className="text-base font-black text-slate-900 tracking-tight">表达素材整理</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            上传PDF书籍或网址，由AI提取核心事实或痛点，自动定制为高难度说服表达背景。
          </p>

          <div className="space-y-3 mb-6">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-[var(--color-brand)] rounded-2xl p-4 transition-all hover:bg-slate-50/10 group cursor-pointer"
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
                  className="w-full bg-slate-900 hover:bg-[var(--color-brand)] text-white text-[10px] font-black tracking-wider uppercase py-1.5 rounded-lg transition-all"
                >
                  整理素材
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[260px] min-h-[180px]">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">已整理素材 ({materials.length})</div>
            {isUploading ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
                <span className="text-xs">正在整理素材…</span>
              </div>
            ) : materials.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">暂无上传素材，请在上方添加</div>
            ) : (
              materials.map((m) => (
                <div
                  key={m.id}
                  onClick={() => m.extractedTopic && setPromptTopic(m.extractedTopic)}
                  className="p-4 bg-slate-50 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all cursor-pointer group hover:border-[var(--color-border)]"
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-[var(--color-brand)] transition-colors">{m.name}</span>
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
          {matchedFactor && (
            <div className="mb-6 bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
              <Sparkles className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0 animate-pulse" />
              <div className="space-y-1">
                <span className="text-[10px] text-amber-700 font-bold block uppercase tracking-widest">
                  高管级进化提示 ｜ Executive Evolution
                </span>
                <p className="text-xs font-semibold text-amber-800 leading-relaxed">
                  能力进化针对性推送中：已检测到您的树洞短板（{getUserCurrentProfile()}），已自动调高相关高难度博弈关卡的出现权重。
                </p>
              </div>
            </div>
          )}
          <div className="mb-4 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-slate-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-800">进入场景博弈会话</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                多轮 1VS1/多人博弈，结束后再出阶层与利益全景分析
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                playClick();
                requestGameTheorySessionFocus();
                if (setActiveModule) {
                  setActiveModule('gametheory');
                } else {
                  console.warn('[SpeakModule] setActiveModule 未传入，已写入 gt_focus_tab');
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-4 py-2.5 shadow-sm whitespace-nowrap"
            >
              <Users className="w-4 h-4" />
              进入场景博弈会话
            </button>
          </div>

          <div className="flex border-b border-slate-100 pb-3 mb-6 overflow-x-auto gap-2">

            {[
              { id: 'structural', label: '结构化逻辑表达', icon: <Sliders className="w-4 h-4" /> },
              { id: 'impromptu', label: '即兴发言响应', icon: <Flame className="w-4 h-4" /> },
              { id: 'counter', label: '漏洞提问与反击', icon: <User className="w-4 h-4" /> },
              { id: 'promotion', label: '晋升/跳槽价值表达', icon: <Award className="w-4 h-4" /> }
            ].map(tab => (
              <button
                key={tab.id}
                disabled={isCyberLocked && activeTab !== tab.id}
                onClick={() => {
                  if (isCyberLocked) return;
                  setActiveTab(tab.id as any);
                  generateAITopic();
                }}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                  isCyberLocked && activeTab !== tab.id ? 'opacity-50 cursor-not-allowed' : ''
                } ${
                  activeTab === tab.id 
                    ? 'bg-[var(--color-brand)] text-white shadow-md' 
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {SCENARIOS.map((scen) => (
              <button
                key={scen.id}
                onClick={() => {
                  setSelectedScenario(scen.id);
                  if (scen.id === 'custom') {
                    setPromptTopic('日常 1VS1 闲聊对话：在轻松的环境下探讨周末野营或日常生活方案，我需要向 AI 陈述建议并获得针对性社交表达修饰。');
                    setMatchedFactor('');
                    generateAITopic(scen.id);
                  } else {
                    generateAITopic(scen.id);
                  }
                }}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  selectedScenario === scen.id 
                    ? 'bg-slate-50 border-[var(--color-border)] ring-2 ring-[var(--color-brand)]/10' 
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

          <div className="bg-slate-50 p-5 rounded-2xl border border-[var(--color-border)] relative mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                {selectedScenario === 'custom' ? '自定义演练场景' : 'AI 推送即兴场景'}
              </span>
              {selectedScenario === 'custom' && (
                <span className="text-[9px] bg-indigo-50 text-indigo-600 font-black px-1.5 py-0.5 rounded border border-indigo-150 animate-pulse ml-2 mr-auto">
                  自定义编辑模式
                </span>
              )}
              <button 
                onClick={() => generateAITopic()}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> {selectedScenario === 'custom' ? '刷新维度' : '换一题'}
              </button>
            </div>
            {selectedScenario === 'custom' ? (
              <textarea
                rows={2}
                value={promptTopic}
                onChange={(e) => setPromptTopic(e.target.value)}
                className="w-full text-xs font-black text-slate-800 bg-white border border-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none"
                placeholder="请输入您的自定义演练场景与角色背景..."
              />
            ) : (
              <p className="text-xs font-black text-slate-800 leading-relaxed">{promptTopic}</p>
            )}
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
                    <span className="text-rose-500 text-xs animate-ping font-sans">[紧张]</span>
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
          {evalResult && !showContextSheet && (
          <button
            onClick={() => { setShowContextSheet(true); }}
            className="mt-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>展开审阅报告 (Expand Review Report)</span>
          </button>
        )}
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
              className={`w-full rounded-2xl border p-4 text-sm focus:outline-none bg-slate-50/30 transition-all duration-300 ${
                isCyberLocked
                  ? 'border-rose-500 focus:border-rose-650 shadow-[0_0_10px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/20 focus:ring-rose-500'
                  : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500'
              }`}
            />
            
            <div className="absolute right-4 bottom-4 flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (isRecording) {
                    stopRecording();
                  } else {
                    startRecording();
                  }
                }}
                disabled={isUploading || isTranscribing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer ${
                  isRecording
                    ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-900 hover:bg-[var(--color-brand)] text-white'
                }`}
              >
                {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                {isRecording ? '停止录音' : '语音录入'}
              </button>
            </div>

            {/* Transcribing Loading Overlay */}
            <AnimatePresence>
              {isTranscribing && (
                <motion.div
                  ref={overlayRef}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white/90 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center z-20 border border-indigo-100"
                >
                  <div ref={waveContainerRef} className="flex items-center gap-1.5 justify-center mb-3">
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full wave-bar origin-center" />
                    <div className="w-1.5 h-10 bg-indigo-400 rounded-full wave-bar origin-center" />
                    <div className="w-1.5 h-14 bg-violet-600 rounded-full wave-bar origin-center" />
                    <div className="w-1.5 h-10 bg-indigo-400 rounded-full wave-bar origin-center" />
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full wave-bar origin-center" />
                  </div>
                  
                  <div className="text-center px-4">
                    <div 
                      ref={textRef} 
                      className="text-xs font-black text-indigo-900 tracking-wide select-none"
                    >
                      {TRANSCRIBING_PROMPTS[transcribingTextIndex]}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {isCyberLocked && evalResult && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-700 text-xs font-bold animate-pulse flex items-center gap-2">
              <span className="text-sm">🔒</span>
              <div>
                表达逻辑得分 {evalResult.totalScore} 未达标（要求 8 分）。已锁定当前模块，请根据右侧建议修改草稿，或在右侧点击“一键采纳”AI重构方案后重新提交。
              </div>
            </div>
          )}

          {speakSubmitNotice && (
            <p className="mb-3 text-[11px] text-zinc-500 leading-relaxed">{speakSubmitNotice}</p>
          )}
          <button
            onClick={evaluateSpeech}
            disabled={isLoadingFeedback || isTranscribing || !!pendingSpeakTaskId || (!mildInput && !aggressiveInput)}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-black tracking-widest text-xs uppercase rounded-2xl transition-all shadow-md shadow-[var(--color-brand)]/10 disabled:opacity-50"
          >
            {isLoadingFeedback || pendingSpeakTaskId ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {pendingSpeakTaskId ? '任务中心处理中…' : '正在提交到任务中心…'}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                提交教练深度评估
              </>
            )}
          </button>
          {speakSubmitNotice && (
            <button
              type="button"
              onClick={() => { playClick(); setTaskCenterOpen(true); }}
              className="mt-2 w-full py-2 rounded-xl bg-zinc-900 text-white text-[10px] font-bold cursor-pointer hover:bg-zinc-800"
            >
              打开任务中心
            </button>
          )}
        </div>
      </section>
    </div>

    <AnimatePresence>
      {showContextSheet && evalResult && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 w-[32%] min-w-[360px] max-w-[500px] bg-slate-50 border-l border-slate-200 h-full shadow-2xl flex flex-col z-50 transform-gpu will-change-transform speak-context-drawer"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 固定头部与关闭按钮 (shrink-0) */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
            <span className="text-xs font-black text-slate-700 uppercase tracking-widest">教练深度评估</span>
            <button
              onClick={() => setShowContextSheet(false)}
              className="text-slate-400 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 中部独立可滚动内容区域 (flex-1 min-h-0 overflow-y-auto) */}
          <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-6">
            <div className="bg-white rounded-3xl border border-emerald-100 shadow-[0_15px_40px_rgba(16,185,129,0.05)] p-6 relative overflow-hidden transition-all duration-500 animate-[fadeIn_0.5s_ease-out]">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-400 via-teal-500 to-indigo-500 animate-pulse"></div>

              <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 mb-6">
                <div>
                  <h3 className="text-base font-black text-slate-900">教练深度剖析</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">点击下方维度或失分点卡片可直接发起针对性追问</p>
                </div>
                <div className="flex flex-col gap-2">
                  <div 
                    onClick={handleLogicDimensionClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleLogicDimensionClick()}
                    className="bg-emerald-50 hover:bg-emerald-100/60 border border-emerald-250/50 rounded-2xl p-2 px-3 text-right cursor-pointer transition-all duration-200 group flex items-center justify-between"
                  >
                    <span className="text-[9px] font-bold text-emerald-600 group-hover:text-emerald-700 underline decoration-dotted">点击追问维度 ›</span>
                    <div>
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">逻辑战力</span>
                      <span className="text-base font-black text-emerald-700 font-mono">{evalResult.logicScore} / 5</span>
                    </div>
                  </div>
                  <div 
                    onClick={handleExpressionDimensionClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleExpressionDimensionClick()}
                    className="bg-emerald-50 hover:bg-emerald-100/60 border border-emerald-250/50 rounded-2xl p-2 px-3 text-right cursor-pointer transition-all duration-200 group flex items-center justify-between"
                  >
                    <span className="text-[9px] font-bold text-emerald-600 group-hover:text-emerald-700 underline decoration-dotted">点击追问维度 ›</span>
                    <div>
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">表达分寸</span>
                      <span className="text-base font-black text-emerald-700 font-mono">{evalResult.expressionScore} / 5</span>
                    </div>
                  </div>
                  <div className="bg-[var(--color-brand)] text-white rounded-2xl p-2 px-4 text-center shadow-lg shadow-[var(--color-brand)]/10">
                    <span className="text-[9px] font-black uppercase tracking-widest block opacity-80">总得分</span>
                    <span className="text-lg font-black font-mono">{evalResult.totalScore} / 10</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 mb-6">
                {[
                  { label: '地域文化适配', score: '适配', color: 'text-[var(--color-brand)] bg-slate-50' },
                  { label: '角色立场定位', score: '精准', color: 'text-emerald-600 bg-emerald-50' },
                  { label: '逻辑框架完整', score: '极佳', color: 'text-amber-600 bg-amber-50' },
                  { label: '语调停顿留白', score: '良好', color: 'text-teal-600 bg-teal-50' },
                  { label: '词汇精准度', score: '极佳', color: 'text-rose-600 bg-rose-50' },
                  { label: '事实数据调用', score: '尚可', color: 'text-[var(--color-accent)] bg-[var(--color-accent)]/10' }
                ].map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500">{item.label}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.color}`}>{item.score}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-6">
                {/* 破绽与失分点 */}
                <div>
                  <h4 className="text-xs font-black text-rose-600 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-3.5 bg-rose-500 rounded-full inline-block"></span>
                    问题与失分点
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed bg-rose-50/30 p-4 rounded-2xl border border-rose-100 mb-3">
                    {evalResult.critique}
                  </p>

                  {/* 结构化失分点卡片 */}
                  {evalResult.flaws && evalResult.flaws.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        失分点细化（点击卡片自动追问）
                      </div>
                      {evalResult.flaws.map((flaw, idx) => (
                        <div
                          key={flaw.id || idx}
                          onClick={() => handleFlawCardClick(flaw)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleFlawCardClick(flaw);
                            }
                          }}
                          className="p-3 bg-white hover:bg-rose-50/60 border border-rose-150 rounded-2xl cursor-pointer transition-all duration-200 shadow-sm hover:shadow hover:border-rose-300 group"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-black text-rose-700 group-hover:text-rose-800 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              {flaw.title}
                            </span>
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 uppercase">
                              {flaw.dimension === 'logic' ? '逻辑' : flaw.dimension === 'expression' ? '表达' : '综合'} · 点击追问
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed group-hover:text-slate-800">
                            {flaw.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 高维表达重构 */}
                <div>
                  <h4 className="text-xs font-black text-indigo-600 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-3.5 bg-[var(--color-brand)] rounded-full inline-block"></span>
                    高维表达重构 (Framework Analysis)
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-[var(--color-border)]">
                    {evalResult.frameworkAnalysis}
                  </p>
                </div>

                {/* 满分实战话术 */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h4 className="text-xs font-black text-emerald-600 flex items-center gap-1.5">
                      <span className="w-1.5 h-3.5 bg-emerald-500 rounded-full inline-block"></span>
                      满分实战话术 (Golden Script)
                    </h4>
                    <SpeakButton text={evalResult.revisedVersion} title="播放实战话术" />
                  </div>
                  <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 relative">
                    <p className="text-slate-800 text-xs font-medium leading-relaxed font-serif italic mb-4">
                      "{evalResult.revisedVersion}"
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          playClick();
                          try {
                            await navigator.clipboard.writeText(evalResult.revisedVersion);
                            playSuccessCyber();
                          } catch (err) {
                            playErrorCyber();
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-350 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all cursor-pointer shadow-sm"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        复制范文
                      </button>
                      <button
                        onClick={() => {
                          playClick();
                          playWaterDrop();
                          if (inputMode === 'mild') {
                            setMildInput(evalResult.revisedVersion);
                          } else {
                            setAggressiveInput(evalResult.revisedVersion);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-650 hover:bg-emerald-600 text-white transition-all cursor-pointer shadow-sm animate-pulse"
                      >
                        <Check className="w-3.5 h-3.5" />
                        一键采纳
                      </button>
                    </div>
                  </div>
                </div>

                {/* 今日复盘 */}
                {dailyReview && (
                  <div className="mt-8 border-t border-slate-200 pt-6">
                    <h4 className="text-xs font-black text-slate-900 mb-4 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      今日训练复盘与明日迭代重点
                    </h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="bg-rose-50/30 border border-rose-100 rounded-2xl p-4">
                        <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">今日逻辑短板</div>
                        <div className="text-xs text-slate-700 leading-relaxed font-medium">{dailyReview.shortage}</div>
                      </div>
                      <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4">
                        <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">今日表达收获</div>
                        <div className="text-xs text-slate-700 leading-relaxed font-medium">{dailyReview.harvest}</div>
                      </div>
                      <div className="bg-slate-50 border border-[var(--color-border)] rounded-2xl p-4">
                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">明日迭代重点</div>
                        <div className="text-xs text-slate-700 leading-relaxed font-medium">{dailyReview.tomorrowFocus}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 底部钉底追问区 (shrink-0) */}
          <div className="shrink-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-1.5 mb-2.5">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-black text-slate-800">漏洞靶向追问 (与AI深入探讨)</span>
            </div>

            {interactiveChat.length > 0 && (
              <div className="space-y-2 mb-3 max-h-[160px] overflow-y-auto pr-1">
                {interactiveChat.map((msg, index) => (
                  <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[88%] rounded-2xl p-2.5 text-xs leading-relaxed ${
                      msg.sender === 'user' 
                        ? 'bg-[var(--color-brand)] text-white rounded-br-none shadow-sm' 
                        : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="针对失分点或分寸度向AI教练追问..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                disabled={isChatLoading}
                className="flex-1 text-xs rounded-xl border border-slate-200 px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50"
              />
              <button
                onClick={() => sendChatMessage()}
                disabled={isChatLoading || !chatInput.trim()}
                className="p-2 bg-slate-950 text-white rounded-xl hover:bg-[var(--color-brand)] transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer"
              >
                {isChatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
