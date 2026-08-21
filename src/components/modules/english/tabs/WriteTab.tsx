import React, { useState, useRef, useEffect } from 'react';
import { useEnglishContext, deriveL3MasteryScore } from '../context/EnglishContext';
import SpeakButton from '../../../SpeakButton';
import Confetti from '../../../Confetti';
import { runEnglishWriteReview, runWriteGovernanceReview, WriteGovernanceResult } from '../../../../services/difyAPI';
import { extractListenMaterialTaskId, pollTaskResultContent, resolveListenMaterialText } from '../../../../services/listenMaterialResult';
import { createTrainingAttempt, submitTrainingFeedback, checkThemeMastery } from '../../../../services/trainingAPI';
import { getAppUserId } from '../../../../utils/profileHelper';
import { playClick, playSuccess, playError, playScan, playPageTurn } from '../../../../utils/soundEffects';
import { consumeWriteContext } from '../../oralWarRoom/utils';
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
    label: '随笔与思辨练习', 
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
  <div className={`rounded-2xl p-5 border transition-[background-color,border-color,box-shadow] duration-300 shadow-sm ${isDark ? 'bg-zinc-900 text-zinc-100 border-zinc-800 shadow-zinc-950/20' : 'bg-white border-zinc-100 hover:shadow-md'}`}>
    <h5 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? 'text-amber-500' : color}`}>
      {title}
    </h5>
    {isLoading ? (
      <p className="text-xs text-zinc-400 italic animate-pulse">正在审阅中…</p>
    ) : content ? (
      <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-650'}`}>{content}</p>
    ) : (
      <p className="text-xs text-zinc-400 italic">等待提交分析…</p>
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-750 hover:text-white transition-colors cursor-pointer shadow-sm"
          >
            <Copy className="w-3 h-3" />
            复制范文
          </button>
          <button
            onClick={() => { playClick(); onAdopt(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-650 hover:bg-amber-600 text-white transition-colors cursor-pointer shadow-sm"
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

  // 控制论锁定与右侧面板展示状态
  const [isCyberLocked, setIsCyberLocked] = useState(false);
  const [showContextSheet, setShowContextSheet] = useState(false);

  // 同步锁定与面板状态
  useEffect(() => {
    if (reviewResult) {
      const score = deriveL3MasteryScore(reviewResult);
      setIsCyberLocked(score < 8);
      setShowContextSheet(true);
    } else {
      setIsCyberLocked(false);
      setShowContextSheet(false);
    }
  }, [reviewResult]);

  // 智能空白处点击判定逻辑
  const handleOutsideClick = (e: React.MouseEvent) => {
    if (!showContextSheet) return;
    
    // 如果存在选中的文本，不收起面板（方便划词）
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
      return;
    }

    const target = e.target as HTMLElement;
    const isInteractive = target.closest(
      'button, a, input, textarea, select, [role="button"], .interactive, .cursor-pointer'
    ) !== null;
    
    if (!isInteractive) {
      setShowContextSheet(false);
    }
  };

  // 从多角色沙盘跳转时预填书面闭环上下文
  const [oralWriteContext, setOralWriteContext] = useState<{ sceneTitle: string; conflicts: string[] } | null>(null);

  useEffect(() => {
    const ctx = consumeWriteContext();
    if (!ctx?.sceneTitle) return;
    setActiveModule('biz_proposal');
    setOralWriteContext({ sceneTitle: ctx.sceneTitle, conflicts: ctx.conflicts || [] });
    const conflictLine = (ctx.conflicts || []).join(' / ');
    setWriteIntent(
      `【书面练习 · ${ctx.sceneTitle}】\n`
      + `核心冲突：${conflictLine || '见上文练习推演'}\n`
      + `跨文化背景：${ctx.culturalContext || ''}\n\n`
      + '请撰写一封高阶商务信函/邮件，回应上述多角色博弈情境。要求：语法严谨、逻辑闭环、分寸得体，无破绽。',
    );
    playPageTurn();
    showNotice('review', `已载入练习场景「${ctx.sceneTitle}」，请完成书面练习`, 'success');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听主题切换，清空当前输入
  useEffect(() => {
    setChallengeText('');
    setWritingText('');
    setWriteIntent('');
    setReviewResult(null);
    setOralWriteContext(null);
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
      showNotice('review', '参考范文已加载', 'success');
    };
    reader.readAsText(file);
  };

  const clearBenchmark = () => {
    playClick();
    handleBenchmarkChange('');
  };

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    let timer: number | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        window.clearTimeout(timer);
      }
    }
  };

  const generateChallenge = async () => {
    setIsGeneratingChallenge(true);
    playScan();
    try {
      const { runListenMaterialGenerator } = await import('../../../../services/difyAPI');
      const moduleName = WRITE_MODULES.find(m => m.id === activeModule)?.label || theme;
      const promptTheme = `【任务生成模式】请针对主题“${theme}” and 写作训练维度“${moduleName}”，生成一封极具突破性、需要高管站位来破局回复的商业邮件或公文写作任务。只输出任务正文。`;
      const result = await runListenMaterialGenerator(promptTheme, 'meeting', 'B2', 'short');
      const immediate = resolveListenMaterialText(result);
      if (immediate) {
        setChallengeText(immediate);
      } else {
        const taskId = extractListenMaterialTaskId(result);
        if (!taskId) throw new Error('未返回写作任务正文');
        const polled = await pollTaskResultContent(taskId);
        setChallengeText(polled);
      }
      setWriteIntent(`回应此 ${moduleName} 挑战任务，妥善解决其中关于 ${theme} 的问题`);
      playSuccess();
    } catch (e) {
      playError();
      showNotice('review', '生成失败，请稍后重试', 'error');
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
    showNotice('review', '提交审阅中...', 'info');

    // 智能在前台拼装 mail_intent 参数，指导 AI 的批阅重点与对标审查
    const moduleLabel = WRITE_MODULES.find(m => m.id === activeModule)?.label;
    const finalIntent = `
【训练模块】: ${moduleLabel}
【写作意图】: ${writeIntent || '无特定意图'}
${activeModule === 'limit_challenge' ? `【极限挑战参数】: ${limitChallengeType === 'expand' ? '充分延展论点' : `压缩至 ${limitChallengeType.split('_')[1]} 字`}` : ''}
${benchmarkText
  ? `【参考对标文本（可选）】:\n${benchmarkText}\n(如适用，请参考其格式、站位与分寸进行对比分析，并在 L2/L3 中指出差异)`
  : `【提示】: 当前未提供对标文本，请直接按通用高级商务/政商写作标准完成三级审阅与改写建议。`
}
`.trim();

    try {
      // 【Write Governance 集成】根据模块类型选择 Governance 或通用评测
      let governanceResult: WriteGovernanceResult | null = null;
      if (activeModule === 'gov_write') {
        // 体制内公文写作 → 走 Governance 文治系统
        try {
          governanceResult = await withTimeout(runWriteGovernanceReview({
            taskType: 'document_correction',
            originalText: writingText,
            additionalParams: [
              writeIntent || '',
              benchmarkText
                ? `【参考对标文本（可选）】:\n${benchmarkText}`
                : '【提示】: 未提供对标文本，请按通用高级政商/公文标准直接完成三级批改与重构建议。',
            ].filter(Boolean).join('\n'),
          }), 45000, '治理审阅超时');
        } catch (govErr) {
          console.warn('[WriteGovernance] Governance 调用失败，降级到通用评测:', govErr);
        }
      }

      const raw = governanceResult
        ? {
            L1: governanceResult.level_1 || '',
            L2: governanceResult.level_2 || '',
            L3: governanceResult.level_3 || '',
            optimized_version: (() => {
              try {
                const parsed = governanceResult.rawJson ? JSON.parse(governanceResult.rawJson) : {};
                return String(parsed.optimized_version || '');
              } catch {
                return '';
              }
            })(),
          }
        : (await withTimeout(
            runEnglishWriteReview(writingText, finalIntent, theme),
            45000,
            '写作审阅超时'
          )) as any;
      const normalized = {
        L1: String(raw.L1_Grammar || raw.L1 || ''),
        L2: String(raw.L2_Business_Tone || raw.L2 || ''),
        L3: String(raw.L3_Strategic_Position || raw.L3 || ''),
        optimized_version: String(raw.optimized_version || ''),
      };
      setReviewResult(normalized);
      showNotice('review', governanceResult?.knowledgeReminder ? `审阅完成。${governanceResult.knowledgeReminder}` : '审阅完成', 'success');

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
        coreIssues: issues.length ? issues : [
          benchmarkText
            ? `草稿在“${moduleLabel}”规范下的表述细度或站位高度与对标要求仍有偏离。`
            : `草稿在“${moduleLabel}”规范下的格式合规、逻辑条理或战略站位仍有提升空间。`
        ],
        nextFocus: focuses.length ? focuses : [
          benchmarkText
            ? `建议参考左侧卓越文本的典型句式和分寸感，进行精准句法移植。`
            : `建议按通用高级商务/政商写作标准，优先修正结构层次与关键措辞分寸。`
        ]
      };
      setDailyFeedback(feedbackData);
      localStorage.setItem('write_daily_feedback', JSON.stringify(feedbackData));

      const l3Score = deriveL3MasteryScore({ ...raw, ...normalized });
      if (sessionId) {
        const att = await createTrainingAttempt({
          sessionId,
          userId: getAppUserId(),
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
        try {
          await submitTrainingFeedback({
            attemptId: att.attemptId,
            userId: getAppUserId(),
            decomposition: { L1: normalized.L1, L2: normalized.L2 },
            logicAnalysis: { L3: normalized.L3, writeLevel: 'L3' },
            strengths: `文治板块【${moduleLabel}】已提交评估`,
            weaknesses: feedbackData.coreIssues.join('；'),
            nextFocus: feedbackData.nextFocus.join('；'),
            score: l3Score,
            rawResponse: JSON.stringify(raw).slice(0, 12000),
          });
        } catch (persistErr) {
          console.warn('[WriteReview] 反馈持久化失败:', persistErr);
        }
      }

      // 【Write Governance 集成】将 Governance 结果也持久化
      if (governanceResult) {
        try {
          const att2 = await createTrainingAttempt({
            sessionId,
            userId: getAppUserId(),
            moduleType: 'write',
            sceneType: theme,
            caseText: writingText.slice(0, 4000),
            userAnswer: {
              writeLevel: 'Governance',
              theme,
              mailIntent: JSON.stringify(governanceResult).slice(0, 5000),
            },
            durationSeconds: 0,
            score: 10, // Governance 不打分，用 10 表示完成
            resultJson: JSON.stringify(governanceResult).slice(0, 12000),
          });
        } catch (gErr) {
          console.warn('[WriteGovernance] 持久化 Governance 结果失败:', gErr);
        }
      }

      if (l3Score >= 8) {
        playSuccess(); // 翻纸屑声与纸张翻页声结合
        setShowConfetti(true);
      } else {
        playPageTurn();
      }

      if (isL1Perfect(normalized.L1)) {
        try {
          await markEmailComplete(theme);
        } catch (markErr) {
          console.warn('[WriteReview] 完成标记失败:', markErr);
        }
      }

      void checkThemeMastery(theme)
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
      console.error('审阅失败:', error);
      showNotice('review', '审阅失败，请检查网络后重试', 'error');
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

      {oralWriteContext && (
        <div className="bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-xl px-4 py-3 flex items-start gap-3 shadow-[var(--shadow-sm)]">
          <BookOpen className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-ink-muted)]">书面练习</p>
            <p className="text-xs font-bold text-[var(--color-ink-primary)] mt-0.5">{oralWriteContext.sceneTitle}</p>
            {oralWriteContext.conflicts.length > 0 && (
              <p className="text-[10px] text-[var(--color-ink-secondary)] mt-1">
                冲突：{oralWriteContext.conflicts.join(' · ')}
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* 顶部微投影 SOP 说明区：精简为单行，收缩高度 */}
      <div className="bg-white border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
        <div className="bg-zinc-900 text-white p-1.5 rounded-lg shrink-0 shadow-sm">
           <Zap className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-xs font-bold text-zinc-800">决策文治与价值提炼系统 // Tactical SOP</h5>
          <p className="text-[11px] text-zinc-400 font-medium">
            左侧可导入对标文本与指南（不填也可审阅），中栏起草进行极限演练，右侧获取高管级三维反馈。
          </p>
        </div>
      </div>

      <div className="relative flex min-h-[450px] h-auto w-full gap-6" onClick={handleOutsideClick}>
        <AnimatePresence>
          {inlineNotice && noticeAnchor === 'review' && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              role="status" aria-live="polite" className={`absolute left-1/2 -translate-x-1/2 -top-3 z-30 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-md border transition-[opacity,transform] duration-300 ${inlineNotice.tone === 'success' ? 'bg-zinc-900 text-zinc-100 border-zinc-800' : inlineNotice.tone === 'error' ? 'bg-red-950 text-red-200 border-red-900' : 'bg-zinc-800 text-white border-zinc-700'}`}
            >
              {inlineNotice.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 左侧工作区：当右侧面板打开时占 70% 宽度，否则占 100% 宽度 */}
        <div className={`transition-[width] duration-500 ease-in-out flex gap-6 h-auto ${showContextSheet ? 'w-[70%]' : 'w-full'}`}>
          {/* 1. 左栏：规范与对标区 */}
          <div className="w-[30%] min-w-[260px] flex flex-col gap-4 h-auto pr-1 shrink-0">
            {/* 对标文本上传/输入区 */}
            <div className="bg-white border border-slate-100/85 rounded-2xl p-4 shadow-[0_6px_20px_rgba(0,0,0,0.015)] flex flex-col gap-3">
              <h4 className="text-[11px] font-bold text-zinc-700 border-b border-zinc-100 pb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#FF5722]" /> 对标文本（可选）
              </h4>
              <p className="text-[10px] text-zinc-455 leading-normal">
                选填。有对标文本时，AI 会参考其格式、站位与分寸做对比；不填则按通用高级商务/政商标准直接审阅。
              </p>
              <div className="relative">
                <textarea
                  id="write-benchmark-input"
                  value={benchmarkText}
                  onChange={(e) => handleBenchmarkChange(e.target.value)}
                  aria-label="对标文本"
                  placeholder="选填：粘贴对标样本段落…"
                  className="w-full h-32 bg-white border border-zinc-200 rounded-xl p-3 text-xs text-zinc-700 outline-none focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-300 placeholder-zinc-350 transition-[border-color,box-shadow] shadow-inner resize-none leading-relaxed"
                />
                {benchmarkText && (
                  <button
                    type="button"
                    onClick={clearBenchmark}
                    aria-label="清空对标文本"
                    className="absolute bottom-2.5 right-2.5 p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 rounded-lg hover:text-red-650 transition-colors cursor-pointer border border-zinc-200"
                    title="清空对标文本"
                  >
                    <Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              
              <label className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-dashed border border-zinc-300 hover:border-zinc-500 text-[10px] font-bold text-zinc-650 hover:bg-white transition-colors cursor-pointer shadow-sm">
                <Upload className="w-3.5 h-3.5" />
                <span>导入对标文档（可选，.txt）</span>
                <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            {/* 行文规范指南 */}
            <div className="bg-white border border-slate-100/85 rounded-2xl p-4 shadow-[0_6px_20px_rgba(0,0,0,0.015)] flex-1 flex flex-col min-h-[250px]">
              <h4 className="text-[11px] font-bold text-zinc-700 border-b border-zinc-100 pb-1.5">
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
          <div className="flex-1 bg-white border border-slate-100/90 shadow-[0_12px_35px_rgba(0,0,0,0.02)] rounded-3xl p-5 md:p-6 flex flex-col h-auto min-w-0">
            {/* 五大模块切换 TAB */}
            <div className="grid grid-cols-5 bg-[#f8f9fa] border border-slate-200/50 p-1 rounded-xl mb-4 shrink-0 shadow-inner">
              {WRITE_MODULES.map((mod) => {
                const isActive = activeModule === mod.id;
                const isLocked = isCyberLocked && !isActive;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    aria-pressed={isActive}
                    disabled={isLocked}
                    onClick={() => {
                      if (isLocked) {
                        playError();
                        return;
                      }
                      playClick();
                      setActiveModule(mod.id);
                    }}
                    className={`py-2 px-1 text-[10px] font-black tracking-wider text-center rounded-xl transition-colors ${
                      isLocked
                        ? 'text-zinc-400 opacity-60 cursor-not-allowed'
                        : isActive
                          ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200 cursor-pointer'
                          : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50/50 cursor-pointer'
                    }`}
                  >
                    {isLocked ? `🔒 ${mod.label.replace('写作', '')}` : mod.label.replace('写作', '')}
                  </button>
                );
              })}
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
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 text-white transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isGeneratingChallenge ? '正在生成…' : '获取AI挑战任务'}
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
                  <p className="text-xs font-medium leading-relaxed text-zinc-350">{typeof challengeText === 'string' ? challengeText : ''}</p>
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
                      type="button"
                      aria-pressed={limitChallengeType === type.id}
                      className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-colors border cursor-pointer ${limitChallengeType === type.id ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' : 'bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50'}`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 意图输入 */}
            <div className="mb-3 shrink-0">
              <label htmlFor="write-intent-input" className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block">写作意图与指示 / Core Intent</label>
              <input
                id="write-intent-input"
                type="text"
                value={writeIntent}
                onChange={(e) => setWriteIntent(e.target.value)}
                placeholder="明确您的写作意图（如：委婉拒绝、极限向上请示、对齐上级某政策等）"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-xs text-zinc-800 outline-none focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-300 placeholder-zinc-350 transition-[border-color,box-shadow] shadow-inner"
              />
            </div>

            <h4 className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2.5 shrink-0 flex items-center gap-1">
              Drafting Zone // 决策起草区
            </h4>

            {/* 文本草稿起草区 */}
            <textarea
              id="write-draft-input"
              ref={textareaRef}
              value={writingText}
              onChange={(e) => setWritingText(e.target.value)}
              aria-label="决策起草区"
              className={`w-full bg-zinc-50 border rounded-2xl px-5 py-4 text-xs text-zinc-800 outline-none resize-none leading-relaxed flex-1 shadow-inner placeholder-zinc-300 min-h-0 transition-[border-color,box-shadow] duration-300 ${
                isCyberLocked
                  ? 'border-red-500 focus-visible:border-red-650 shadow-[0_0_10px_rgba(239,68,68,0.15)] ring-1 ring-red-500/20'
                  : 'border-zinc-200 focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-300'
              }`}
              placeholder={WRITE_MODULES.find(m => m.id === activeModule)?.placeholder}
              style={{ minHeight: '300px' }}
            />

            {isCyberLocked && (
              <div className="mt-3 p-3.5 bg-red-50 border border-red-200/80 rounded-xl text-red-700 text-xs font-bold animate-pulse flex items-center gap-2">
                <span className="text-sm">🔒</span>
                <div>
                  表达逻辑得分 {deriveL3MasteryScore(reviewResult)} 未达标（要求 8 分）。已锁定当前模块，请根据右侧建议修改草稿，或在右侧点击“一键采纳”AI重构方案后重新提交。
                </div>
              </div>
            )}

            {/* 审阅触发按钮 */}
            <div className="mt-4 shrink-0 flex flex-col gap-2">
              <button
                onClick={() => { playClick(); handleReview(); }}
                disabled={isReviewing || !writingText}
                className="bg-zinc-900 text-white w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-950 transition-colors disabled:opacity-50 shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isReviewing ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                    <span>AI 正在审阅中…</span>
                  </>
                ) : (
                  '提交三维战略审阅 (Submit Strategy Review)'
                )}
              </button>

              {reviewResult && !showContextSheet && (
                <button
                  onClick={() => { playClick(); setShowContextSheet(true); }}
                  className="bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 text-zinc-800 w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>展开审阅报告 (Expand Review Report)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 右侧 30%：动态滑出 Context Sheet 面板 */}
        <AnimatePresence>
          {showContextSheet && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-[30%] bg-zinc-50 border-l border-zinc-200 h-auto p-5 shadow-2xl flex flex-col gap-4 shrink-0 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ① 浅层：格式与措辞合规 */}
              <ReviewCard title="① 浅层：格式与措辞合规" content={reviewResult?.L1} isLoading={isReviewing} />
              
              {/* ② 中层：逻辑结构与条理 */}
              <ReviewCard title="② 中层：逻辑结构与条理" content={reviewResult?.L2} isLoading={isReviewing} color="text-amber-600" />
              
              {/* ③ 深层：政治站位与领导思维 */}
              <ReviewCard
                title="③ 深层：政治站位与领导思维"
                content={reviewResult?.L3}
                isLoading={isReviewing}
                isDark
                optimized={reviewResult?.optimized_version}
                onAdopt={() => {
                  if (reviewResult?.optimized_version) {
                    setWritingText(reviewResult.optimized_version);
                    showNotice('review', '已采纳，正在重新评分…', 'info');
                    playSuccess();
                    // 采纳后自动重新触发 L3 评分
                    setTimeout(() => {
                      setWriteIntent(prev => `${prev || ''} [已采纳AI优化版本]`);
                      handleReview();
                    }, 300);
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

              {/* 闭环复盘 (Daily Feedback Loop) */}
              <div className="bg-white border border-zinc-200 shadow-sm rounded-2xl p-5 flex flex-col gap-3">
                <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-755 border-b border-zinc-200 pb-2 flex items-center gap-1">
                  <span>🔄</span> 练习复盘与跟踪
                </h5>
                {isReviewing ? (
                  <p className="text-[10px] text-zinc-400 italic">正在生成复盘要点…</p>
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
