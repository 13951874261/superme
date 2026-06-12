import React, { useState, useRef, useEffect } from 'react';
import { useEnglishContext, deriveL3MasteryScore } from '../context/EnglishContext';
import SpeakButton from '../../../SpeakButton';
import Confetti from '../../../Confetti';
import { runEnglishWriteReview } from '../../../../services/difyAPI';
import { createTrainingAttempt, submitTrainingFeedback, checkThemeMastery } from '../../../../services/trainingAPI';
import { playClick, playSuccess, playError, playScan, playPageTurn } from '../../../../utils/soundEffects';
import { Copy, Check, Upload, Trash2, BookOpen, Layers, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// 五大高管写作训练模块定义
const WRITE_MODULES = [
  { 
    id: 'gov_write', 
    label: '体制内公文写作', 
    desc: '政府汇报、部门公文、调研报告三级纵深批改', 
    placeholder: '在此起草您的公文、汇报或调研报告草案...' 
  },
  { 
    id: 'biz_proposal', 
    label: '高阶商务与提案', 
    desc: '向上请示、跨部门协调、外企信函、隐性施压或出海商业提案', 
    placeholder: '在此起草您的商务信函或提案草案...' 
  },
  { 
    id: 'limit_challenge', 
    label: '字数极限挑战', 
    desc: '字数压缩（200/100/50字）或充分延展论点训练', 
    placeholder: '在此粘贴您的长篇段落或核心论点，进行压缩或延展训练...' 
  },
  { 
    id: 'personal_brand', 
    label: '个人品牌与提炼', 
    desc: '日常行政工作经验转化为大型国企/出海企业急需的可迁移高商业价值提案', 
    placeholder: '在此输入您的工作背景或项目履历，由 AI 指导提炼个人核心商业价值...' 
  },
  { 
    id: 'essay_reflection', 
    label: '随笔与思辨闭环', 
    desc: '职场随笔或认知感悟的深度逻辑与思维方向诊断', 
    placeholder: '在此撰写您的职场随笔或认知感悟...' 
  }
];

function isL1Perfect(l1Text: string): boolean {
  if (!l1Text) return false;
  const lower = l1Text.toLowerCase();
  return !lower.includes('error') && !lower.includes('mistake') && !lower.includes('incorrect') &&
    !l1Text.includes('错误') && !l1Text.includes('不对') && !l1Text.includes('有问题') &&
    !l1Text.includes('incorrect') && !l1Text.includes('grammar error');
}

const ReviewCard = ({ title, content, isLoading, color = 'text-zinc-500', isDark = false, optimized = '', onAdopt, onCopy }: any) => (
  <div className={`rounded-2xl p-5 border transition-all duration-300 shadow-sm ${isDark ? 'bg-zinc-900 text-zinc-100 border-zinc-800 shadow-zinc-950/20' : 'bg-white border-zinc-100 hover:shadow-md'}`}>
    <h5 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? 'text-amber-500' : color}`}>
      {title}
    </h5>
    {isLoading ? (
      <p className="text-xs text-zinc-400 italic animate-pulse">Dify 正在审阅中...</p>
    ) : content ? (
      <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-650'}`}>{content}</p>
    ) : (
      <p className="text-xs text-zinc-400 italic">等待提交分析...</p>
    )}
    {isDark && optimized && (
      <div className="mt-4 pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h5 className="text-[10px] font-black uppercase tracking-widest text-amber-500">
            AI 高管示范文本 (Optimized Version)
          </h5>
          <SpeakButton text={optimized} title="播放示范文本" />
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed italic mb-4">{optimized}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { playClick(); onCopy(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-750 hover:text-white transition-all cursor-pointer shadow-sm"
          >
            <Copy className="w-3 h-3" />
            复制范文
          </button>
          <button
            onClick={() => { playClick(); onAdopt(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-650 hover:bg-amber-600 text-white transition-all cursor-pointer shadow-sm"
          >
            <Check className="w-3 h-3" />
            一键采纳
          </button>
        </div>
      </div>
    )}
  </div>
);

export default function WriteTab() {
  const {
    theme,
    sessionId,
    setMasteryData,
    markEmailComplete,
    writingText, setWritingText,
    writeIntent, setWriteIntent,
    isReviewing, setIsReviewing,
    reviewResult, setReviewResult,
    inlineNotice, noticeAnchor, showNotice
  } = useEnglishContext();

  const [activeModule, setActiveModule] = useState<string>('gov_write');
  const [benchmarkText, setBenchmarkText] = useState<string>(() => localStorage.getItem('write_benchmark_text') || '');
  const [limitChallengeType, setLimitChallengeType] = useState<'compress_200' | 'compress_100' | 'compress_50' | 'expand'>('compress_100');
  
  // 每日复盘数据
  const [dailyFeedback, setDailyFeedback] = useState<{ coreIssues: string[]; nextFocus: string[] }>(() => {
    const cached = localStorage.getItem('write_daily_feedback');
    return cached ? JSON.parse(cached) : { coreIssues: [], nextFocus: [] };
  });

  const [isGeneratingChallenge, setIsGeneratingChallenge] = useState(false);
  const [challengeText, setChallengeText] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 监听主题切换，清空当前输入
  useEffect(() => {
    setChallengeText('');
    setWritingText('');
    setWriteIntent('');
    setReviewResult(null);
  }, [theme, setWritingText, setWriteIntent, setReviewResult]);

  // 对标文本自动保存
  const handleBenchmarkChange = (val: string) => {
    setBenchmarkText(val);
    localStorage.setItem('write_benchmark_text', val);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      handleBenchmarkChange(text);
      playPageTurn();
      showNotice('review', '对标优秀文本读取成功', 'success');
    };
    reader.readAsText(file);
  };

  const clearBenchmark = () => {
    playClick();
    handleBenchmarkChange('');
  };

  const generateChallenge = async () => {
    setIsGeneratingChallenge(true);
    playScan();
    try {
      const { runListenMaterialGenerator } = await import('../../../../services/difyAPI');
      const moduleName = WRITE_MODULES.find(m => m.id === activeModule)?.label || theme;
      const promptTheme = `【任务生成模式】请针对主题“${theme}” and 写作训练维度“${moduleName}”，生成一封极具突破性、需要高管站位来破局回复的商业邮件或公文写作任务。只输出任务正文。`;
      const result = await runListenMaterialGenerator(promptTheme);
      setChallengeText(result);
      setWriteIntent(`回应此 ${moduleName} 挑战任务，妥善解决其中关于 ${theme} 的问题`);
      playSuccess();
    } catch (e) {
      playError();
      showNotice('review', '生成任务失败', 'error');
    } finally {
      setIsGeneratingChallenge(false);
    }
  };

  const handleReview = async () => {
    if (!writingText) {
      playError();
      showNotice('review', '请输入您的草稿', 'error');
      return;
    }
    setIsReviewing(true);
    playScan();
    showNotice('review', '提交战略审阅中...', 'info');

    // 智能在前台拼装 mail_intent 参数，指导 AI 的批阅重点与对标审查
    const moduleLabel = WRITE_MODULES.find(m => m.id === activeModule)?.label;
    const finalIntent = `
【训练模块】: ${moduleLabel}
【写作意图】: ${writeIntent || '无特定意图'}
${activeModule === 'limit_challenge' ? `【极限挑战参数】: ${limitChallengeType === 'expand' ? '充分延展论点' : `压缩至 ${limitChallengeType.split('_')[1]} 字`}` : ''}
${benchmarkText ? `【对标卓越文本】:\n${benchmarkText}\n(请将用户的草稿与上述卓越文本的格式、站位、分寸进行找差与对比，并在 L2/L3 中详细指出)` : ''}
`.trim();

    try {
      const raw = (await runEnglishWriteReview(writingText, finalIntent, theme)) as any;
      const normalized = {
        L1: String(raw.L1_Grammar || raw.L1 || ''),
        L2: String(raw.L2_Business_Tone || raw.L2 || ''),
        L3: String(raw.L3_Strategic_Position || raw.L3 || ''),
        optimized_version: String(raw.optimized_version || ''),
      };
      setReviewResult(normalized);
      showNotice('review', '审阅完成', 'success');

      // 从 L2/L3 反馈中动态提取“今日核心问题”与“明日提升重点”
      const issues: string[] = [];
      const focuses: string[] = [];
      const lines = (normalized.L2 + '\n' + normalized.L3).split('\n');
      for (const line of lines) {
        const clean = line.trim().replace(/^[-*#\d.]\s*/, '');
        if (!clean || clean.length < 5) continue;
        if ((clean.includes('问题') || clean.includes('不足') || clean.includes('缺陷')) && issues.length < 2) {
          issues.push(clean);
        } else if ((clean.includes('建议') || clean.includes('提升') || clean.includes('重点') || clean.includes('改用')) && focuses.length < 2) {
          focuses.push(clean);
        }
      }
      
      // 兜底复盘数据
      const feedbackData = {
        coreIssues: issues.length ? issues : [`草稿在“${moduleLabel}”规范下的表述细度或站位高度与对标要求仍有偏离。`],
        nextFocus: focuses.length ? focuses : [`建议参考左侧卓越文本的典型句式和分寸感，进行精准句法移植。`]
      };
      setDailyFeedback(feedbackData);
      localStorage.setItem('write_daily_feedback', JSON.stringify(feedbackData));

      const l3Score = deriveL3MasteryScore({ ...raw, ...normalized });
      if (sessionId) {
        const att = await createTrainingAttempt({
          sessionId,
          userId: 'default-user',
          moduleType: 'write',
          sceneType: theme,
          caseText: writingText.slice(0, 4000),
          userAnswer: {
            writeLevel: 'L3',
            theme,
            mailIntent: finalIntent.slice(0, 2000),
          },
          durationSeconds: 0,
          score: l3Score,
        });
        await submitTrainingFeedback({
          attemptId: att.attemptId,
          userId: 'default-user',
          decomposition: { L1: normalized.L1, L2: normalized.L2 },
          logicAnalysis: { L3: normalized.L3, writeLevel: 'L3' },
          strengths: `文治板块【${moduleLabel}】已提交评估`,
          weaknesses: feedbackData.coreIssues.join('；'),
          nextFocus: feedbackData.nextFocus.join('；'),
          score: l3Score,
          rawResponse: JSON.stringify(raw).slice(0, 12000),
        });
      }
      
      if (l3Score >= 8) {
        playSuccess(); // 翻纸屑声与纸张翻页声结合
        setShowConfetti(true);
      } else {
        playPageTurn();
      }

      if (isL1Perfect(normalized.L1)) {
        await markEmailComplete(theme);
      }

      checkThemeMastery(theme)
        .then((res) => {
          if (res.success) {
            setMasteryData({
              isMastered: res.isMastered,
              oralCount: res.oralCount,
              maxWriteScore: res.maxWriteScore,
              emailCompleted: res.emailCompleted,
            });
          }
        })
        .catch(() => {});
    } catch (error) {
      playError();
      showNotice('review', '审阅失败，请检查网络', 'error');
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
      
      {/* 顶部微投影 SOP 说明区 */}
      <div className="bg-zinc-50 border border-zinc-200/60 rounded-2xl p-5 flex items-start gap-4 shadow-sm transition-all duration-300">
        <div className="bg-zinc-900 text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-sm">
           <Zap className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-zinc-800 mb-1">决策文治与价值提炼系统 // Tactical SOP</h5>
          <p className="text-xs text-zinc-500 font-medium leading-relaxed">
            请遵循此写作闭环：左侧导入对标文本与行文指南，中栏起草应对场景进行极限演练，右侧获得高管级三维反馈并完成每日复盘。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        <AnimatePresence>
          {inlineNotice && noticeAnchor === 'review' && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`absolute left-1/2 -translate-x-1/2 -top-3 z-20 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-md border transition-all duration-350 ${inlineNotice.tone === 'success' ? 'bg-zinc-900 text-zinc-100 border-zinc-800' : inlineNotice.tone === 'error' ? 'bg-red-950 text-red-200 border-red-900' : 'bg-zinc-800 text-white border-zinc-700'}`}
            >
              {inlineNotice.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. 左栏：规范与对标区 */}
        <div className="lg:col-span-3 flex flex-col gap-5 h-[80vh] overflow-y-auto pr-1">
          {/* 对标文本上传/输入区 */}
          <div className="bg-zinc-50 border border-zinc-200/80 rounded-[2rem] p-5 shadow-sm flex flex-col gap-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-750 border-b border-zinc-200 pb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> 对标优秀文本
            </h4>
            <p className="text-[10px] text-zinc-455 leading-normal">
              粘贴或上传您认同的体制公文、大厂高管或外企信函文本。AI 将评估您的草稿与其在笔法与格局上的落差。
            </p>
            <div className="relative">
              <textarea
                value={benchmarkText}
                onChange={(e) => handleBenchmarkChange(e.target.value)}
                placeholder="在此粘贴您的对标样本段落..."
                className="w-full h-32 bg-white border border-zinc-200 rounded-xl p-3 text-xs text-zinc-700 outline-none focus:border-zinc-400 placeholder-zinc-350 transition-colors shadow-inner resize-none leading-relaxed"
              />
              {benchmarkText && (
                <button
                  onClick={clearBenchmark}
                  className="absolute bottom-2.5 right-2.5 p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 rounded-lg hover:text-red-650 transition-all cursor-pointer border border-zinc-200"
                  title="清空对标文本"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            <label className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-dashed border border-zinc-300 hover:border-zinc-500 text-[10px] font-bold text-zinc-650 hover:bg-white transition-all cursor-pointer shadow-sm">
              <Upload className="w-3.5 h-3.5" />
              <span>导入对标文档 (.txt)</span>
              <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {/* 行文规范指南 */}
          <div className="bg-white border border-zinc-150 rounded-[2rem] p-5 shadow-sm flex-1 flex flex-col min-h-[250px]">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-755 border-b border-zinc-100 pb-2">
              Writing SOP // 行文战术锦囊
            </h4>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 pt-2">
              <div className="bg-zinc-50/70 p-3.5 rounded-xl border border-zinc-200/50">
                <h5 className="text-[9px] font-black text-zinc-805 mb-1 uppercase tracking-widest">1. 破冰与站位 (Opening Position)</h5>
                <p className="text-[10px] text-zinc-505 leading-normal">起手直奔主题，避免琐碎客套。应以：“本提案旨在回应双方对于...”或“针对近期政策变动，我们建议...”切入。</p>
              </div>
              <div className="bg-zinc-50/70 p-3.5 rounded-xl border border-zinc-200/50">
                <h5 className="text-[9px] font-black text-zinc-805 mb-1 uppercase tracking-widest">2. 分寸与抗压 (Assertive Tone)</h5>
                <p className="text-[10px] text-zinc-505 leading-normal">在委婉拒绝或施压时，多使用中性的被动语态及情态动词淡化主观性。例如：“考虑到目前的政策契合度，该方案暂难直接推进。”</p>
              </div>
              <div className="bg-zinc-50/70 p-3.5 rounded-xl border border-zinc-200/50">
                <h5 className="text-[9px] font-black text-zinc-805 mb-1 uppercase tracking-widest">3. 字数挑战法则 (Concise Writing)</h5>
                <p className="text-[10px] text-zinc-505 leading-normal">高管阅读极度推崇“结论先行”。将次要叙述性信息极度压缩，仅保留“现状-诊断-建议方案”核心脉络。</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 中栏：纵深批阅与训练区 */}
        <div className="lg:col-span-6 bg-white rounded-[2rem] p-6 border border-zinc-150 shadow-md flex flex-col h-[80vh]">
          {/* 五大模块切换 TAB */}
          <div className="grid grid-cols-5 bg-zinc-100 p-1.5 rounded-2xl mb-4 shrink-0 shadow-inner">
            {WRITE_MODULES.map((mod) => (
              <button
                key={mod.id}
                onClick={() => { playClick(); setActiveModule(mod.id); }}
                className={`py-2 px-1 text-[10px] font-black tracking-wider text-center rounded-xl transition-all cursor-pointer ${activeModule === mod.id ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50/50'}`}
              >
                {mod.label.replace('写作', '')}
              </button>
            ))}
          </div>

          {/* 模块描述信息 */}
          <div className="mb-4 shrink-0 flex items-center justify-between border-b border-zinc-100 pb-2">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">当前维度：</span>
              <span className="text-xs font-bold text-zinc-700">{WRITE_MODULES.find(m => m.id === activeModule)?.desc}</span>
            </div>
            <button
              onClick={() => { playClick(); generateChallenge(); }}
              disabled={isGeneratingChallenge}
              className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 text-white transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isGeneratingChallenge ? '正在生成...' : '获取AI挑战任务'}
            </button>
          </div>

          {/* 任务卡展示：仅在有挑战任务时显示 */}
          {challengeText && (
            <div className="bg-zinc-900 text-zinc-300 rounded-xl mb-4 border border-zinc-800 overflow-hidden shrink-0 shadow-inner">
              <div className="p-4 max-h-[120px] overflow-y-auto">
                <div className="flex items-center justify-between mb-1.5 border-b border-zinc-800 pb-1.5">
                  <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
                    <Layers className="w-3 h-3" /> 突发刁钻场景任务
                  </span>
                  <button
                    onClick={() => { playClick(); setChallengeText(''); }}
                    className="text-[9px] font-black text-zinc-500 hover:text-zinc-300 cursor-pointer uppercase tracking-widest transition-colors"
                  >
                    重置
                  </button>
                </div>
                <p className="text-xs font-medium leading-relaxed text-zinc-350">{challengeText}</p>
              </div>
            </div>
          )}

          {/* 字数极限挑战维度独占的配置栏 */}
          {activeModule === 'limit_challenge' && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-zinc-50 border border-zinc-200/70 rounded-xl shrink-0">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">字数规则：</span>
              <div className="flex items-center gap-2 flex-1">
                {([
                  { id: 'compress_50', label: '压缩至50字' },
                  { id: 'compress_100', label: '压缩至100字' },
                  { id: 'compress_200', label: '压缩至200字' },
                  { id: 'expand', label: '论点充分展开' }
                ] as const).map((type) => (
                  <button
                    key={type.id}
                    onClick={() => { playClick(); setLimitChallengeType(type.id); }}
                    className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all border cursor-pointer ${limitChallengeType === type.id ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' : 'bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50'}`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 意图输入 */}
          <div className="mb-3 shrink-0">
            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block">写作意图与指示 / Core Intent</label>
            <input
              type="text"
              value={writeIntent}
              onChange={(e) => setWriteIntent(e.target.value)}
              placeholder="明确您的写作意图（如：委婉拒绝、极限向上请示、对齐上级某政策等）"
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-xs text-zinc-800 outline-none focus:border-zinc-400 placeholder-zinc-350 transition-colors shadow-inner"
            />
          </div>

          <h4 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2.5 shrink-0 flex items-center gap-1">
            Drafting Zone // 决策起草区
          </h4>

          {/* 文本草稿起草区 */}
          <textarea
            ref={textareaRef}
            value={writingText}
            onChange={(e) => setWritingText(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 focus:border-zinc-400 rounded-2xl px-5 py-4 text-xs text-zinc-800 outline-none resize-none leading-relaxed flex-1 shadow-inner placeholder-zinc-300 min-h-0 transition-colors"
            placeholder={WRITE_MODULES.find(m => m.id === activeModule)?.placeholder}
            style={{ height: 'calc(100% - 150px)' }}
          />

          {/* 审阅触发按钮 */}
          <div className="mt-4 shrink-0">
            <button
              onClick={() => { playClick(); handleReview(); }}
              disabled={isReviewing || !writingText}
              className="bg-zinc-900 text-white w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-950 transition-colors disabled:opacity-50 shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isReviewing ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                  <span>AI 正在审阅与风格对标中...</span>
                </>
              ) : (
                '提交三维战略审阅 (Submit Strategy Review)'
              )}
            </button>
          </div>
        </div>

        {/* 3. 右栏：反馈与每日复盘 */}
        <div className="lg:col-span-3 flex flex-col gap-4 h-[80vh] overflow-y-auto pr-1">
          {/* L1 基础审阅 */}
          <ReviewCard title="L1 语法与合规" content={reviewResult?.L1} isLoading={isReviewing} />
          
          {/* L2 商务/政务分寸 */}
          <ReviewCard title="L2 逻辑与分寸" content={reviewResult?.L2} isLoading={isReviewing} color="text-amber-600" />
          
          {/* L3 高管战略站位与重写示范 */}
          <ReviewCard
            title="L3 战略站位示范"
            content={reviewResult?.L3}
            isLoading={isReviewing}
            isDark
            optimized={reviewResult?.optimized_version}
            onAdopt={() => {
              if (reviewResult?.optimized_version) {
                setWritingText(reviewResult.optimized_version);
                showNotice('review', '采纳改写方案成功', 'success');
                playSuccess();
              }
            }}
            onCopy={async () => {
              if (reviewResult?.optimized_version) {
                try {
                  await navigator.clipboard.writeText(reviewResult.optimized_version);
                  showNotice('review', '改写方案已复制到剪贴板', 'success');
                  playSuccess();
                } catch (err) {
                  playError();
                  showNotice('review', '复制失败', 'error');
                }
              }
            }}
          />

          {/* 新增：闭环复盘 (Daily Feedback Loop) */}
          <div className="bg-zinc-50 border border-zinc-200 shadow-sm rounded-2xl p-5 flex flex-col gap-3">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-755 border-b border-zinc-200 pb-2 flex items-center gap-1">
              <span>🔄</span> 闭环复盘与跟踪
            </h5>
            {isReviewing ? (
              <p className="text-[10px] text-zinc-400 italic">正在生成复盘要点...</p>
            ) : dailyFeedback.coreIssues.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <h6 className="text-[9px] font-bold text-red-750 mb-1 uppercase tracking-wider">今日写作核心问题 // Key Issues</h6>
                  <ul className="list-disc pl-3.5 space-y-1">
                    {dailyFeedback.coreIssues.map((issue, idx) => (
                      <li key={idx} className="text-[10px] text-zinc-650 leading-relaxed">{issue}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h6 className="text-[9px] font-bold text-zinc-750 mb-1 uppercase tracking-wider">明日写作提升重点 // Next Steps</h6>
                  <ul className="list-disc pl-3.5 space-y-1">
                    {dailyFeedback.nextFocus.map((focus, idx) => (
                      <li key={idx} className="text-[10px] text-zinc-650 leading-relaxed">{focus}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-zinc-400 italic">完成审阅后，系统在此沉淀今日的复盘与明日提升指南。</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
