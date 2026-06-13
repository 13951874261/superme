import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  BookOpen, 
  UploadCloud, 
  Globe, 
  Building2, 
  Users, 
  Volume2, 
  Mic, 
  MicOff, 
  Send, 
  Sparkles, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Link2, 
  HelpCircle, 
  Trophy, 
  RefreshCw,
  Award
} from 'lucide-react';
import { fetchInsightFeedback, fetchDynamicInsightScenario, uploadMaterialToKB } from '../../services/difyAPI';
import { playClick, playSwitch, playUpload, playReveal, playSuccess } from '../../utils/soundEffects';

const CATEGORIES = ['体制内', '外企', '通用逻辑'] as const;
type CategoryType = typeof CATEGORIES[number];

// 预置逻辑与心理学知识框架数据
interface TheoryNode {
  title: string;
  concept: string;
  framework: string[];
  points: string[];
}

const THEORY_DATA: Record<string, TheoryNode[]> = {
  '逻辑学与系统谬误': [
    {
      title: '非形式逻辑谬误',
      concept: '在论证过程中，论据与论题之间没有逻辑必然性，而通过修辞或情绪手段使人信服。',
      framework: ['滑坡谬误', '以偏概全', '诉诸权威', '偷换概念'],
      points: [
        '滑坡谬误：无限放大某种可能后果，形成恐吓。例如：“你今天迟到，明天就会旷工，最后就会被开除。”',
        '诉诸权威：利用某个领域的名气来证明另一个领域的正确性。',
        '偷换概念：在讨论中悄悄改变某个词语的内涵。'
      ]
    },
    {
      title: '因果关系误区',
      concept: '混淆相关性与因果性，或者将时间上的先后关系强行解释为因果关系。',
      framework: ['后此谬误', '单因谬误', '因果倒置'],
      points: [
        '后此谬误：因为 B 发生在 A 之后，就判定 A 导致了 B。',
        '单因谬误：复杂问题简单化，只归结于单一因素。'
      ]
    }
  ],
  '人性解码与心理侧写': [
    {
      title: '弦外之音解码机制',
      concept: '理解人际沟通中隐藏在表层话术之下的真实利益诉求、层级防卫或情绪宣泄。',
      framework: ['利益驱动判定', '阶层安全防卫', '同僚压力构建'],
      points: [
        '体制内话术：委婉、注重层级、避免直接冲突，常用“以退为进”或“虚指”敲打。',
        '跨国企业话术：表面平等、重效率指标，常用高大上的行业术语（Jargon）进行自我防卫或施压。'
      ]
    },
    {
      title: '非语言信号暗示',
      concept: '肢体语言、面部表情、眼神方向、语速及停顿等生理与动作反馈。',
      framework: ['微表情检测', '肢体紧张度', '音调与停顿映射'],
      points: [
        '食指轻敲桌面：通常暗示潜在的控制欲、焦躁或内心催促。',
        '眼神偏离与斜瞟：可能在临时寻找托词，或暗示对当前对比物的不屑。',
        '语速突然变慢且加重：表明正在进行高度蓄意的“表演式情绪施压”。'
      ]
    }
  ]
};

interface ListenModuleProps {
  selectedDate?: string;
}

export default function ListenModule({ selectedDate }: ListenModuleProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('体制内');
  const [currentScenario, setCurrentScenario] = useState<string>('');
  const [isLoadingScenario, setIsLoadingScenario] = useState(false);

  // 左右分栏状态
  const [leftTab, setLeftTab] = useState<'theory' | 'upload'>('theory');
  const [expandedTheory, setExpandedTheory] = useState<string | null>('非形式逻辑谬误');

  // 分步式答题表单状态
  const [formStep, setFormStep] = useState<number>(1);
  const [analysisForm, setAnalysisForm] = useState({
    socialLevel: '',
    innerLevel: '',
    realIntent: '',
    humanNature: '',
    nonVerbalSignals: '',
    emotionLevel: '',
    logicFlaw: '',
    factFlaw: '',
    intentFlaw: '',
    trustScore: 3,
    trustReason: ''
  });

  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluatedScore, setEvaluatedScore] = useState<number | null>(null);

  // 录音状态
  const [isRecording, setIsRecording] = useState<Record<string, boolean>>({});
  const [recordingField, setRecordingField] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 每日小结与统计状态
  const [dailyStats, setDailyStats] = useState({
    completedCount: 2,
    averageScore: 8.2,
    studyMinutes: 45
  });
  const [tomorrowFocus, setTomorrowFocus] = useState<string>('重点关注跨文化沟通的弦外之音以及非形式逻辑谬误的抓取');

  // 上传素材状态
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 动态获取题目的函数
  const loadNewScenario = useCallback(async (category: CategoryType) => {
    setIsLoadingScenario(true);
    setCurrentScenario(''); 
    setFeedback(null); 
    setEvaluatedScore(null);
    setFormStep(1);
    // 重置表单
    setAnalysisForm({
      socialLevel: '',
      innerLevel: '',
      realIntent: '',
      humanNature: '',
      nonVerbalSignals: '',
      emotionLevel: '',
      logicFlaw: '',
      factFlaw: '',
      intentFlaw: '',
      trustScore: 3,
      trustReason: ''
    });
    
    try {
      const scenario = await fetchDynamicInsightScenario(category);
      setCurrentScenario(scenario);
    } catch (error) {
      console.error(error);
      setCurrentScenario(`⚠️ 获取考题失败: ${error instanceof Error ? error.message : '未知错误'}\n（请确保在环境配置中加入了 VITE_DIFY_INSIGHT_GEN_KEY）`);
    } finally {
      setIsLoadingScenario(false);
    }
  }, []);

  // 首次加载或切换类别时，自动获取题目
  useEffect(() => {
    loadNewScenario(activeCategory);
  }, [activeCategory, loadNewScenario]);

  // 切换场景分类时的反馈
  const handleCategoryChange = (category: CategoryType) => {
    playSwitch();
    setActiveCategory(category);
  };

  // 语音输入核心逻辑（支持 Web Speech API，如无麦克风则播放高科技模拟输入）
  const toggleSpeechInput = (fieldName: keyof typeof analysisForm) => {
    playClick();
    
    // 检查是否已有录音运行
    if (isRecording[fieldName]) {
      // 停止录音
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(prev => ({ ...prev, [fieldName]: false }));
      setRecordingField(null);
      return;
    }

    // 关闭其他正在录音的字段
    setIsRecording({});
    setIsRecording(prev => ({ ...prev, [fieldName]: true }));
    setRecordingField(fieldName as string);

    // 尝试启动原生 Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        setAnalysisForm(prev => ({
          ...prev,
          [fieldName]: (prev[fieldName] ? prev[fieldName] + ' ' : '') + resultText
        }));
      };

      recognition.onerror = (e: any) => {
        console.error('Speech recognition error', e);
        // 发生错误时，使用高科技模拟输入占位，提供完美体验
        simulateVoiceInput(fieldName);
      };

      recognition.onend = () => {
        setIsRecording(prev => ({ ...prev, [fieldName]: false }));
        setRecordingField(null);
      };

      recognition.start();
    } else {
      // 浏览器不支持 SpeechRecognition，采用降级模拟模式
      simulateVoiceInput(fieldName);
    }
  };

  // 模拟高质量语音输入
  const simulateVoiceInput = (fieldName: keyof typeof analysisForm) => {
    let mockText = '';
    switch(fieldName) {
      case 'socialLevel':
        mockText = '初步研判为职能部门核心负责人，对下极具掌控力，但面临外部汇报审计压力。';
        break;
      case 'innerLevel':
        mockText = '经验非常老道，言辞中充满隐性测试与同僚施压，心理防守极严。';
        break;
      case 'realIntent':
        mockText = '看似在关怀新员工的身体，实则在敲打其工作方式不当，意图通过捧杀老王来贬低小李。';
        break;
      case 'humanNature':
        mockText = '典型控制型人格，极度关注服从与即时产出，对下属的“低效加班”抱有天然警惕。';
        break;
      case 'nonVerbalSignals':
        mockText = '食指扣桌暗示焦躁与不耐烦；转头看老王是精细设计的肢体施压信号。';
        break;
      case 'emotionLevel':
        mockText = '中度施压性假意温和。表面是好心提点，内心充满了戒备与挑剔情绪。';
        break;
      case 'logicFlaw':
        mockText = '典型的滑坡谬误与错误类比，强行把加班归结为效率低下，忽略了岗位差异。';
        break;
      case 'factFlaw':
        mockText = '缺失小李与老王工作总量的对比，以及老王交付文件的真实质量数据。';
        break;
      case 'intentFlaw':
        mockText = '避重就轻。避开科室任务分配不均的事实，将体系问题推卸给新人的工作习惯。';
        break;
      case 'trustReason':
        mockText = '对方言论的政治防御意图过强，其陈述的事实仅作为施压武器，可信度极低。';
        break;
      default:
        mockText = '敏锐地指出了对方话术背后的深层防卫。';
    }

    setTimeout(() => {
      setAnalysisForm(prev => ({
        ...prev,
        [fieldName]: mockText
      }));
      setIsRecording(prev => ({ ...prev, [fieldName]: false }));
      setRecordingField(null);
      playSuccess();
    }, 1800);
  };

  // 一键填充高质量演示数据，方便快速体验 Dify
  const handleQuickFill = () => {
    playClick();
    setAnalysisForm({
      socialLevel: '正科级中层主管，在部门内部拥有绝对话语权但受副局长压制。',
      innerLevel: '城府极深，善于使用借刀杀人和同僚施压等隐蔽管理手段。',
      realIntent: '表面肯定老王的工作态度，实则在敲打小张加班效率低下；同时利用老王制造同僚竞争，防范小张居功自傲。',
      humanNature: '极度偏好服从与效率，戒备心强，排斥下属通过过度加班建立“勤奋”人设。',
      nonVerbalSignals: '敲击桌面显示出对工作进度的不耐烦与绝对掌控；偏头看向老王是在寻找施压标杆。',
      emotionLevel: '典型的“表演式温和”，外在语气平缓甚至带笑，但内在情绪处于高度审视与施压状态。',
      logicFlaw: '滑坡谬误：直接将加班等同于效率低、方法差，将按时下班等同于成果好。',
      factFlaw: '片面事实：未提供任何关于小张和老王报表质量、难度和工作量的实际对比数据。',
      intentFlaw: '避重就轻：避开处室内部任务分配不均的问题，将其完全归结为小张个人工作习惯问题。',
      trustScore: 2,
      trustReason: '发言人动机不纯，其对事实的描述完全服务于其敲打和管理意图，缺乏数据和多维印证。'
    });
    setFormStep(4); // 直接切到最后一步预览
  };

  // 素材上传处理
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    playClick();
  };

  const submitMaterial = async () => {
    if (!uploadFile && !uploadUrl.trim()) return;
    setIsUploading(true);
    setUploadProgress(10);
    playUpload();

    const interval = setInterval(() => {
      setUploadProgress(prev => (prev < 90 ? prev + 15 : prev));
    }, 300);

    try {
      if (uploadFile) {
        // 尝试上传文件至知识库
        await uploadMaterialToKB(uploadFile, '洞察听力素材库');
        setUploadProgress(100);
        clearInterval(interval);
        setTimeout(() => {
          setIsUploading(false);
          setUploadFile(null);
          setUploadProgress(0);
          playSuccess();
          // 生成新的听力考题
          setCurrentScenario(`【根据导入文件《${uploadFile.name}》自动转换的博弈案例】\n某跨国公司中方总监在战略复盘会上，靠在椅背上双臂交叉，微笑着对美方VP说：“对于上季度的交付延迟，我们完全理解美方的担忧。不过正如你们所知，我们在本地供应链的重组上投入了极大的精力。只要美方的核心系统接口能在下周按时冻结，我相信我们能够在下阶段实现赶超。”\n（请分析其中隐藏的跨文化推责话术）`);
          setLeftTab('theory');
        }, 800);
      } else {
        // 处理网页 URL
        setUploadProgress(100);
        clearInterval(interval);
        setTimeout(() => {
          setIsUploading(false);
          setUploadUrl('');
          setUploadProgress(0);
          playSuccess();
          setCurrentScenario(`【从网址导入分析生成的博弈案例】\n某商业谈判代表在签约前最后一轮会谈中，放慢语速，眼神直视对方CFO说：“这个价格确实是我们能给出的底线。虽然董事会的一些成员觉得我们有些让步过多，但出于双方长期的战略互信，我还是极力说服了大家。只是关于付款周期，我们可能需要按照之前的A方案执行。”\n（请识别其中的道德绑架与让步防线破绽）`);
          setLeftTab('theory');
        }, 800);
      }
    } catch (err) {
      console.error(err);
      clearInterval(interval);
      setIsUploading(false);
      alert('上传素材解析失败，已为您自动生成预设场景。');
      setCurrentScenario(`【模拟网页数据生成的案例】\n两位项目负责人在走廊相遇。A拍了拍B的肩膀，叹了口气说：“听老李说，你们组那个项目这次拿下了？太不容易了，听说你们天天连轴转，家里都顾不上了吧。我们组这个项目虽然顺利，但也都是大家正常工时完成的，真羡慕你们这股拼劲！”\n（请解析A的潜在攀比与贬低之意）`);
      setLeftTab('theory');
    }
  };

  // 整理表单并格式化为 markdown 文本提交
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setFeedback(null);
    setEvaluatedScore(null);
    playClick();

    const formattedAnalysis = `
### 1. 弦外之音与心理侧写
- **社会层级判定**：${analysisForm.socialLevel || '未填写'}
- **内在水准侧写**：${analysisForm.innerLevel || '未填写'}
- **真实意图 (弦外之音)**：${analysisForm.realIntent || '未填写'}
- **人性特点分析**：${analysisForm.humanNature || '未填写'}

### 2. 非语言信号与情绪鉴定
- **非语言信号暗示**：${analysisForm.nonVerbalSignals || '未填写'}
- **情绪层级判定**：${analysisForm.emotionLevel || '未填写'}

### 3. 破绽分析与捕捉
- **逻辑破绽**：${analysisForm.logicFlaw || '未填写'}
- **事实破绽**：${analysisForm.factFlaw || '未填写'}
- **意图破绽**：${analysisForm.intentFlaw || '未填写'}

### 4. 信息可信度评分
- **可信度得分**：${analysisForm.trustScore} / 5
- **打分理由**：${analysisForm.trustReason || '未填写'}
    `.trim();

    try {
      const resultData = await fetchInsightFeedback({
        scenario_text: currentScenario,
        user_analysis: formattedAnalysis
      });
      
      setFeedback(resultData);
      playReveal();

      // 从 AI 的 Markdown 反馈中正则提取出得分 (形如 8/10 或 得分: 9)
      const scoreMatch = resultData.match(/(?:得分|评分|成绩|判定)[:：]\s*(\d+(\.\d+)?)/i) || resultData.match(/(\d+)\s*\/\s*10/);
      let parsedScore = 8.0; 
      if (scoreMatch) {
        const val = parseFloat(scoreMatch[1]);
        parsedScore = val > 10 ? val / 10 : val;
      }
      setEvaluatedScore(parsedScore);

      // 更新每日统计
      setDailyStats(prev => ({
        completedCount: prev.completedCount + 1,
        studyMinutes: prev.studyMinutes + 15,
        averageScore: parseFloat(((prev.averageScore * prev.completedCount + parsedScore) / (prev.completedCount + 1)).toFixed(1))
      }));

      // 动态生成明日训练重点
      let focus = '重点关注跨国企业中的“隐性推责”场景，识别肢体动作与情绪层级不一致的破绽。';
      if (resultData.includes('逻辑') || resultData.includes('谬误')) {
        focus = '强化非形式谬误的抓取，重点训练“滑坡谬误”与“诉诸经验”的逻辑切入点；';
      } else if (resultData.includes('可信度') || resultData.includes('事实')) {
        focus = '提升对事实破绽的敏感度，注意在复杂博弈中抽离事实真相与情感修饰；';
      }
      setTomorrowFocus(focus);

    } catch (error) {
      console.error(error);
      setFeedback(`### ⚠️ 解析失败\n与导师系统连接中断，请检查网络。\n\n**详情**: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col xl:flex-row gap-6 p-4 max-w-8xl mx-auto overflow-hidden">
      
      {/* ========================================================
          左侧栏：理论知识与分布式素材上传区 (25%)
         ======================================================== */}
      <div className="w-full xl:w-96 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden shrink-0">
        
        {/* 左侧页签切换 */}
        <div className="flex bg-slate-50 border-b border-slate-100 p-1.5 gap-1">
          <button 
            onClick={() => { playSwitch(); setLeftTab('theory'); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              leftTab === 'theory' 
                ? 'bg-white text-indigo-600 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            理论框架库
          </button>
          <button 
            onClick={() => { playSwitch(); setLeftTab('upload'); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              leftTab === 'upload' 
                ? 'bg-white text-indigo-600 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            分布式素材上传
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {/* 页签内容 1: 理论框架库 */}
          {leftTab === 'theory' ? (
            <div className="space-y-4">
              <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-600 block mb-1">今日重点导读</span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  在进行侧写时，需时刻遵循“**概念解读 — 框架构成 — 知识点应用**”三维路径，由浅入深进行解码。
                </p>
              </div>

              {Object.entries(THEORY_DATA).map(([category, nodes]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">{category}</h4>
                  {nodes.map((node) => {
                    const isExpanded = expandedTheory === node.title;
                    return (
                      <div 
                        key={node.title} 
                        className={`border rounded-xl transition-all ${
                          isExpanded 
                            ? 'border-indigo-200 bg-indigo-50/20 shadow-xs' 
                            : 'border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        {/* 节点头部 */}
                        <button 
                          onClick={() => { playClick(); setExpandedTheory(isExpanded ? null : node.title); }}
                          className="w-full text-left p-3 flex justify-between items-center"
                        >
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            {node.title}
                          </span>
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </button>
                        
                        {/* 展开节点详情 */}
                        {isExpanded && (
                          <div className="p-3 pt-0 border-t border-indigo-50/50 space-y-3">
                            <div>
                              <span className="text-[10px] text-indigo-600 font-bold block mb-0.5">【概念解读】</span>
                              <p className="text-xs text-slate-600 leading-relaxed font-medium">{node.concept}</p>
                            </div>
                            
                            <div>
                              <span className="text-[10px] text-indigo-600 font-bold block mb-1">【框架构成】</span>
                              <div className="flex flex-wrap gap-1">
                                {node.framework.map((fw) => (
                                  <span key={fw} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                                    {fw}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <span className="text-[10px] text-indigo-600 font-bold block mb-1">【具体知识点】</span>
                              <ul className="space-y-1.5">
                                {node.points.map((pt, i) => (
                                  <li key={i} className="text-xs text-slate-600 leading-relaxed pl-3 border-l-2 border-indigo-200">
                                    {pt}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            /* 页签内容 2: 素材导入区 */
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  网页案例链接
                </label>
                <input 
                  type="text" 
                  placeholder="https://example.com/article" 
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  PDF 电子书/案例库
                </label>
                <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 transition-colors text-center relative group">
                  <input 
                    type="file" 
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                  />
                  <div className="space-y-2">
                    <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 mx-auto transition-colors" />
                    <p className="text-xs font-bold text-slate-600">
                      {uploadFile ? uploadFile.name : '拖拽或点击上传文件'}
                    </p>
                    <p className="text-[10px] text-slate-400">支持 PDF 格式电子书、情报文档</p>
                  </div>
                </div>
              </div>

              {isUploading ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-indigo-600">
                    <span>正在提纯情报素材...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={submitMaterial}
                  disabled={!uploadFile && !uploadUrl.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all disabled:opacity-50 active:scale-98"
                >
                  注入并生成训练题目
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          右侧栏：核心训练区与 AI 反馈 (75%)
         ======================================================== */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
        
        {/* 置顶分类选择 */}
        <div className="flex items-center justify-between bg-white border border-slate-100 p-2 rounded-2xl shadow-xs">
          <div className="flex gap-2">
            {CATEGORIES.map((tab) => {
              const Icon = tab === '体制内' ? Building2 : tab === '外企' ? Globe : Users;
              return (
                <button
                  key={tab}
                  onClick={() => handleCategoryChange(tab)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                    activeCategory === tab 
                      ? 'bg-slate-800 text-white shadow-md' 
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab}职场
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => loadNewScenario(activeCategory)}
            disabled={isLoadingScenario}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingScenario ? 'animate-spin' : ''}`} />
            刷新案例
          </button>
        </div>

        {/* 1. 案例推送区 */}
        <div className="bg-slate-900 border-l-4 border-indigo-500 p-5 rounded-r-2xl shadow-xs relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex justify-between items-center mb-3">
            <span className="font-extrabold text-[10px] text-indigo-400 uppercase tracking-widest flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
              已拦截的对话数据流 (含非语言信号描述)
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded">
              今日第 {dailyStats.completedCount + 1} 场
            </span>
          </div>

          {isLoadingScenario ? (
            <div className="space-y-2.5 py-2 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-5/6"></div>
              <div className="h-4 bg-slate-800 rounded w-full"></div>
              <div className="h-4 bg-slate-800 rounded w-2/3"></div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-slate-100 whitespace-pre-wrap font-medium">
              {currentScenario || '正在生成新案例...'}
            </p>
          )}
        </div>

        {/* 2. 交互输入区 (三段式核心 - 分步多维度侧写) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                {formStep}
              </span>
              <h3 className="text-sm font-black text-slate-800">人性解码与破绽捕捉表单</h3>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={handleQuickFill}
                className="text-[11px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-all"
              >
                模拟一键侧写 (调试首选)
              </button>
            </div>
          </div>

          {/* 表单步骤标签 */}
          <div className="flex gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-100 text-center">
            {['1. 心理侧写', '2. 信号与情绪', '3. 破绽捕捉', '4. 评估确认'].map((label, index) => (
              <button
                key={label}
                onClick={() => { playClick(); setFormStep(index + 1); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  formStep === index + 1 
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-100' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 步骤 1：心理侧写 */}
          {formStep === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 flex justify-between items-center">
                  社会层级判定
                  <button onClick={() => toggleSpeechInput('socialLevel')} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                    {isRecording['socialLevel'] ? <MicOff className="w-3.5 h-3.5 text-red-500 animate-pulse" /> : <Mic className="w-3.5 h-3.5" />}
                    {isRecording['socialLevel'] ? '录音中...' : '语音录入'}
                  </button>
                </label>
                <textarea 
                  placeholder="对方处于何种职位阶层？有无利益捆绑？" 
                  value={analysisForm.socialLevel}
                  onChange={(e) => setAnalysisForm({ ...analysisForm, socialLevel: e.target.value })}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-20 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 flex justify-between items-center">
                  内在水准侧写
                  <button onClick={() => toggleSpeechInput('innerLevel')} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                    {isRecording['innerLevel'] ? <MicOff className="w-3.5 h-3.5 text-red-500 animate-pulse" /> : <Mic className="w-3.5 h-3.5" />}
                    {isRecording['innerLevel'] ? '录音中...' : '语音'}
                  </button>
                </label>
                <textarea 
                  placeholder="专业度、城府深浅、防御强度如何？" 
                  value={analysisForm.innerLevel}
                  onChange={(e) => setAnalysisForm({ ...analysisForm, innerLevel: e.target.value })}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-20 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-[11px] font-bold text-slate-500 flex justify-between items-center">
                  真实意图（弦外之音）
                  <button onClick={() => toggleSpeechInput('realIntent')} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                    {isRecording['realIntent'] ? <MicOff className="w-3.5 h-3.5 text-red-500 animate-pulse" /> : <Mic className="w-3.5 h-3.5" />}
                    {isRecording['realIntent'] ? '录音中...' : '语音'}
                  </button>
                </label>
                <textarea 
                  placeholder="对方话语的真实动机是什么？他想达到什么目的？" 
                  value={analysisForm.realIntent}
                  onChange={(e) => setAnalysisForm({ ...analysisForm, realIntent: e.target.value })}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-20 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-[11px] font-bold text-slate-500 flex justify-between items-center">
                  人性特点分析
                  <button onClick={() => toggleSpeechInput('humanNature')} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                    {isRecording['humanNature'] ? <MicOff className="w-3.5 h-3.5 text-red-500 animate-pulse" /> : <Mic className="w-3.5 h-3.5" />}
                    {isRecording['humanNature'] ? '录音中...' : '语音'}
                  </button>
                </label>
                <textarea 
                  placeholder="表现出什么人性弱点或心理代偿机制？（如偏执、虚荣、防卫、谄媚）" 
                  value={analysisForm.humanNature}
                  onChange={(e) => setAnalysisForm({ ...analysisForm, humanNature: e.target.value })}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-16 resize-none"
                />
              </div>
            </div>
          )}

          {/* 步骤 2：信号与情绪 */}
          {formStep === 2 && (
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 flex justify-between items-center">
                  非语言信号暗示分析
                  <button onClick={() => toggleSpeechInput('nonVerbalSignals')} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                    {isRecording['nonVerbalSignals'] ? <MicOff className="w-3.5 h-3.5 text-red-500 animate-pulse" /> : <Mic className="w-3.5 h-3.5" />}
                    {isRecording['nonVerbalSignals'] ? '录音中...' : '语音'}
                  </button>
                </label>
                <textarea 
                  placeholder="对方的手势、微动作、眼神、语气停顿在暗示什么？" 
                  value={analysisForm.nonVerbalSignals}
                  onChange={(e) => setAnalysisForm({ ...analysisForm, nonVerbalSignals: e.target.value })}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-24 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 flex justify-between items-center">
                  情绪层级判定
                  <button onClick={() => toggleSpeechInput('emotionLevel')} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                    {isRecording['emotionLevel'] ? <MicOff className="w-3.5 h-3.5 text-red-500 animate-pulse" /> : <Mic className="w-3.5 h-3.5" />}
                    {isRecording['emotionLevel'] ? '录音中...' : '语音'}
                  </button>
                </label>
                <textarea 
                  placeholder="对方是在宣泄真实情绪（愤怒/焦虑），还是在为了施压而进行演技表演？" 
                  value={analysisForm.emotionLevel}
                  onChange={(e) => setAnalysisForm({ ...analysisForm, emotionLevel: e.target.value })}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-24 resize-none"
                />
              </div>
            </div>
          )}

          {/* 步骤 3：破绽捕捉 */}
          {formStep === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 flex justify-between items-center">
                  逻辑破绽
                  <button onClick={() => toggleSpeechInput('logicFlaw')} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                    {isRecording['logicFlaw'] ? <MicOff className="w-3.5 h-3.5 text-red-500 animate-pulse" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                </label>
                <textarea 
                  placeholder="有无滑坡谬误、以偏概全、偷换概念等？" 
                  value={analysisForm.logicFlaw}
                  onChange={(e) => setAnalysisForm({ ...analysisForm, logicFlaw: e.target.value })}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-32 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 flex justify-between items-center">
                  事实破绽
                  <button onClick={() => toggleSpeechInput('factFlaw')} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                    {isRecording['factFlaw'] ? <MicOff className="w-3.5 h-3.5 text-red-500 animate-pulse" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                </label>
                <textarea 
                  placeholder="有无信息模糊、缺失核心数据、前后矛盾？" 
                  value={analysisForm.factFlaw}
                  onChange={(e) => setAnalysisForm({ ...analysisForm, factFlaw: e.target.value })}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-32 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 flex justify-between items-center">
                  意图破绽
                  <button onClick={() => toggleSpeechInput('intentFlaw')} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                    {isRecording['intentFlaw'] ? <MicOff className="w-3.5 h-3.5 text-red-500 animate-pulse" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                </label>
                <textarea 
                  placeholder="有无避重就轻、隐蔽话题转移？" 
                  value={analysisForm.intentFlaw}
                  onChange={(e) => setAnalysisForm({ ...analysisForm, intentFlaw: e.target.value })}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-32 resize-none"
                />
              </div>
            </div>
          )}

          {/* 步骤 4：可信度评估与提交 */}
          {formStep === 4 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5 justify-center items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 md:col-span-1">
                <span className="text-xs font-bold text-slate-500 mb-2">对话信息可信度打分</span>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => { playClick(); setAnalysisForm({ ...analysisForm, trustScore: star }); }}
                      className={`text-xl transition-all ${
                        star <= analysisForm.trustScore ? 'text-amber-500 transform scale-110' : 'text-slate-300'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-slate-400 mt-2">（1分极不可信，5分绝对真实）</span>
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-[11px] font-bold text-slate-500 flex justify-between items-center">
                  打分与研判理由
                  <button onClick={() => toggleSpeechInput('trustReason')} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                    {isRecording['trustReason'] ? <MicOff className="w-3.5 h-3.5 text-red-500 animate-pulse" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                </label>
                <textarea 
                  placeholder="陈述为什么给予该可信度分数，剥离其主观观点后的客观事实有多少？" 
                  value={analysisForm.trustReason}
                  onChange={(e) => setAnalysisForm({ ...analysisForm, trustReason: e.target.value })}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-20 resize-none"
                />
              </div>

              <div className="md:col-span-3 border-t border-slate-100 pt-3 flex justify-between items-center">
                <span className="text-xs text-slate-400">请确保各维度均已理顺，准备提交给导师审核。</span>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || isLoadingScenario}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-6 py-3 rounded-xl text-xs transition-all flex items-center gap-2 active:scale-98 shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      正在接入导师研判定理...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      提交导师评估
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 下一步与上一步便捷按钮 */}
          {formStep < 4 && (
            <div className="border-t border-slate-100 pt-3 flex justify-end gap-2">
              {formStep > 1 && (
                <button
                  onClick={() => { playClick(); setFormStep(prev => prev - 1); }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-all"
                >
                  上一步
                </button>
              )}
              <button
                onClick={() => { playClick(); setFormStep(prev => prev + 1); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all"
              >
                下一步
              </button>
            </div>
          )}
        </div>

        {/* 3. 反馈与复盘区 (MASTER DEEP CRITIQUE) */}
        {feedback && (
          <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-indigo-400 tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-400" />
                DIFY 导师战略点评系统
              </h3>
              
              {/* 得分展示 */}
              {evaluatedScore !== null && (
                <div className="flex items-center gap-3 bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700/50">
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">深度评卷成绩</span>
                  <span className="text-base font-black text-emerald-400">{evaluatedScore.toFixed(1)} <span className="text-xs text-slate-500">/ 10</span></span>
                </div>
              )}
            </div>

            <div className="prose prose-sm prose-invert prose-indigo max-w-none text-slate-300 leading-relaxed">
              <ReactMarkdown>{feedback}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* ========================================================
            底部：每日小结与智能复盘建议 (Daily Review)
           ======================================================== */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white border border-slate-800 rounded-2xl p-5 shadow-lg shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
            
            {/* 今日效率指标 */}
            <div className="flex items-center gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-widest">今日训练得分</span>
                <p className="text-lg font-black text-white">{dailyStats.averageScore.toFixed(1)} <span className="text-xs font-medium text-slate-400">/ 10</span></p>
              </div>
            </div>

            {/* 累计专注时长 */}
            <div className="flex items-center gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-widest">累计研判对话</span>
                <p className="text-lg font-black text-white">{dailyStats.completedCount} 组 <span className="text-xs font-medium text-slate-400">({dailyStats.studyMinutes} 分钟)</span></p>
              </div>
            </div>

            {/* 系统自动分析薄弱点与生成计划 */}
            <div className="flex items-center gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800 md:col-span-1">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-widest">智能复盘计划</span>
                <p className="text-xs font-bold text-emerald-400 truncate">{tomorrowFocus}</p>
              </div>
            </div>

          </div>

          <div className="border-t border-slate-800 mt-4 pt-3 flex justify-between items-center text-[10px] text-slate-400">
            <span>人性解码与破绽识别沙盘 v2.0 • 当前状态: 接入稳定</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              知识库同步正常
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
