import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  FileText,
  Copy,
  Download,
  Users,
  Layers,
  Clock,
  ShieldCheck,
  Zap,
  ChevronRight,
  ArrowRight,
  BookOpen,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ScriptWorkshopDraft,
  ScriptReviewReport,
  ScriptCharacter,
  InfoAsymmetryItem
} from './ScriptWorkshopTypes';
import {
  evaluateScriptDraft,
  PRESET_BENCHMARK_SCRIPTS,
  countWords,
  estimateDurationMinutes
} from './scriptEvaluator';
import { playClick, playPageTurn, playGentleWarning } from '../../../utils/soundEffects';

interface ScriptWorkshopDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onImportToSession?: (draft: ScriptWorkshopDraft) => void;
}

export default function ScriptWorkshopDrawer({
  isOpen,
  onClose,
  onImportToSession
}: ScriptWorkshopDrawerProps) {
  // 当前剧本草稿
  const [draft, setDraft] = useState<ScriptWorkshopDraft>(PRESET_BENCHMARK_SCRIPTS[0]);
  // 活跃编辑标签 (setup: 角色动机与信息差 | script: 4阶段剧本台词 | review: AI审稿报告)
  const [activeTab, setActiveTab] = useState<'script' | 'setup' | 'review'>('script');
  // 活跃阶段 (1, 2, 3, 4)
  const [activePhaseIndex, setActivePhaseIndex] = useState<number>(0);
  // 审稿报告
  const [report, setReport] = useState<ScriptReviewReport>(() => evaluateScriptDraft(PRESET_BENCHMARK_SCRIPTS[0]));
  // 复制提示
  const [copied, setCopied] = useState(false);

  // 每次修改剧本内容时自动更新实时评估
  useEffect(() => {
    const r = evaluateScriptDraft(draft);
    setReport(r);
  }, [draft]);

  if (!isOpen) return null;

  const currentPhase = draft.phases[activePhaseIndex];
  const phaseWords = countWords(currentPhase.content);
  const totalWords = countWords(draft.phases.map(p => p.content).join(''));
  const estMinutes = estimateDurationMinutes(totalWords);

  // 载入标杆范例
  const handleLoadPreset = (index: number) => {
    playClick();
    setDraft(PRESET_BENCHMARK_SCRIPTS[index]);
    setActiveTab('script');
  };

  // 修改当前阶段内容
  const handlePhaseContentChange = (val: string) => {
    const nextPhases = [...draft.phases] as [any, any, any, any];
    nextPhases[activePhaseIndex] = {
      ...nextPhases[activePhaseIndex],
      content: val
    };
    setDraft({ ...draft, phases: nextPhases });
  };

  // 复制完整 Markdown 剧本
  const handleCopyMarkdown = () => {
    playClick();
    const fullText = `# ${draft.sceneTitle}\n\n> 场景摘要：${draft.sceneSummary}\n\n` +
      `## 角色设定\n` +
      draft.characters.map(c => `- **${c.name}**（${c.roleTitle}）：\n  * 表面诉求：${c.surfaceGoal}\n  * 隐藏底牌：${c.hiddenMotive}\n  * 利益红线：${c.redLine}`).join('\n') +
      `\n\n## 剧本正文 (8-10分钟标准)\n\n` +
      draft.phases.map(p => `### ${p.title} (${p.targetDuration} | 目标字数: ${p.targetWordsRange})\n\n${p.content}`).join('\n\n');

    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-5xl h-full bg-white shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden">
        
        {/* 顶部标题栏 */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-zinc-800 to-slate-900 text-white flex items-center justify-between border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white">8–10 分钟多人博弈剧本生产与质量校验工坊</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400 text-slate-950 uppercase tracking-wider">
                  SOP & TDD 标准
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                可控时长（2100-2600字 / 16-22轮） • 完整因果闭环 • 高策略强度对抗
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleLoadPreset(0)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-600 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              载入标杆范例
            </button>

            {onImportToSession && (
              <button
                onClick={() => {
                  playClick();
                  onImportToSession(draft);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                注入当前会话
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 顶部指标统计栏 */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600 font-medium">总字数：</span>
              <span className={`font-bold ${totalWords >= 2100 && totalWords <= 2600 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {totalWords} 字
              </span>
              <span className="text-slate-400">（约 {estMinutes} 分钟）</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600 font-medium">对话轮次：</span>
              <span className="font-bold text-slate-800">{report.totalRounds} 轮</span>
            </div>

            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600 font-medium">AI 审稿总评：</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${report.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                {report.score} 分 / {report.passed ? '达标通过' : '未达标需修复'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? '已复制！' : '复制标准剧本'}
            </button>
          </div>
        </div>

        {/* 主体三标签导航 */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => { playClick(); setActiveTab('script'); }}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'script'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            4 阶段剧本台词编辑器
          </button>

          <button
            onClick={() => { playClick(); setActiveTab('setup'); }}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'setup'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            角色隐秘动机 & 信息差矩阵
          </button>

          <button
            onClick={() => { playClick(); setActiveTab('review'); }}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer relative ${
              activeTab === 'review'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI 审稿与因果诊断报告
            {report.causalityScore.brokenLinks.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
            )}
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          
          {/* TAB 1: 4 阶段剧本台词编辑器 */}
          {activeTab === 'script' && (
            <div className="space-y-4">
              {/* 阶段选择胶囊 */}
              <div className="grid grid-cols-4 gap-2">
                {draft.phases.map((phase, idx) => {
                  const pWords = countWords(phase.content);
                  const isCurrent = activePhaseIndex === idx;
                  return (
                    <button
                      key={phase.phaseId}
                      onClick={() => { playClick(); setActivePhaseIndex(idx); }}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        isCurrent
                          ? 'bg-white border-amber-500 shadow-md ring-1 ring-amber-400'
                          : 'bg-white/70 border-slate-200 hover:bg-white text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className={isCurrent ? 'text-amber-600' : 'text-slate-700'}>
                          阶段 {phase.phaseId}
                        </span>
                        <span className="text-[10px] text-slate-400">{phase.targetDuration}</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-800 mt-1 truncate">
                        {phase.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1.5 flex items-center justify-between">
                        <span>{pWords} 字</span>
                        <span className="text-[10px] text-slate-400">目标 {phase.targetWordsRange}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 当前阶段编辑器 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <span>{currentPhase.title}</span>
                      <span className="text-xs font-normal text-slate-500">
                        （建议时长：{currentPhase.targetDuration} / 目标字数：{currentPhase.targetWordsRange}）
                      </span>
                    </h3>
                  </div>
                  <div className="text-xs text-slate-500">
                    当前字数：<span className="font-bold text-amber-600">{phaseWords}</span> 字
                  </div>
                </div>

                <textarea
                  value={currentPhase.content}
                  onChange={(e) => handlePhaseContentChange(e.target.value)}
                  placeholder="请输入该阶段的角色对白与动作描写..."
                  rows={14}
                  className="w-full text-xs font-mono text-slate-800 bg-slate-50/50 border border-slate-200 rounded-xl p-3.5 focus:bg-white focus:border-amber-500 focus:outline-none transition leading-relaxed resize-y"
                />

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-400">
                    💡 提示：每一轮对话需标明角色名称与心理/动作（如：**林锐**（冷笑）：...）
                  </span>
                  <div className="flex gap-2">
                    {activePhaseIndex > 0 && (
                      <button
                        onClick={() => { playClick(); setActivePhaseIndex(activePhaseIndex - 1); }}
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                      >
                        上一阶段
                      </button>
                    )}
                    {activePhaseIndex < 3 ? (
                      <button
                        onClick={() => { playClick(); setActivePhaseIndex(activePhaseIndex + 1); }}
                        className="px-3 py-1.5 text-xs rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-sm transition cursor-pointer"
                      >
                        下一阶段
                      </button>
                    ) : (
                      <button
                        onClick={() => { playClick(); setActiveTab('review'); }}
                        className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition cursor-pointer"
                      >
                        查看 AI 审稿报告
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 角色隐秘动机 & 信息差矩阵 */}
          {activeTab === 'setup' && (
            <div className="space-y-6">
              {/* 角色卡片 */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-500" />
                  3–4 位核心博弈角色隐秘动机表
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {draft.characters.map((char) => (
                    <div key={char.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-bold text-sm text-slate-900">{char.name}</span>
                        <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-medium">
                          {char.roleTitle}
                        </span>
                      </div>
                      <div className="text-xs space-y-1 text-slate-600">
                        <div><strong className="text-slate-800">表层诉求：</strong>{char.surfaceGoal}</div>
                        <div><strong className="text-red-700">隐秘底牌：</strong>{char.hiddenMotive}</div>
                        <div><strong className="text-amber-700">绝对红线：</strong>{char.redLine}</div>
                        <div><strong className="text-emerald-700">胜利条件：</strong>{char.winCondition}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 信息差矩阵 */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-500" />
                  信息不对称与陷阱矩阵
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {draft.infoMatrix.map((info) => (
                    <div key={info.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-slate-800">{info.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          info.type === 'public' ? 'bg-blue-100 text-blue-700' :
                          info.type === 'exclusive' ? 'bg-amber-100 text-amber-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {info.type === 'public' ? '公认事实' : info.type === 'exclusive' ? `独占机密 (${info.owner})` : '假诱导陷阱'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{info.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI 审稿与因果诊断报告 */}
          {activeTab === 'review' && (
            <div className="space-y-5">
              
              {/* 总分卡片 */}
              <div className={`p-5 rounded-2xl border flex items-center justify-between shadow-xs ${
                report.passed ? 'bg-emerald-50/70 border-emerald-200' : 'bg-red-50/70 border-red-200'
              }`}>
                <div>
                  <span className="text-xs font-semibold text-slate-500">综合质量评估</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-4xl font-extrabold ${report.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                      {report.score}
                    </span>
                    <span className="text-sm text-slate-500">/ 100 分</span>
                    <span className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      report.passed ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
                    }`}>
                      {report.passed ? '达标通过' : '未达标需修复'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5">
                    {report.passed
                      ? '该剧本时长控制精准、伏笔因果自洽闭环，具备高强度的博弈对抗快感。'
                      : '检测到部分因果链断裂或时长配比偏差，请根据下方诊断逐项修复。'}
                  </p>
                </div>

                <div className="text-right text-xs text-slate-500 space-y-1">
                  <div>时长控制得分：<strong className="text-slate-800">{report.durationScore.score}/30</strong></div>
                  <div>因果闭环得分：<strong className="text-slate-800">{report.causalityScore.score}/40</strong></div>
                  <div>策略强度得分：<strong className="text-slate-800">{report.strategyScore.score}/30</strong></div>
                </div>
              </div>

              {/* 维度一：时长与节奏诊断 */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-500" />
                  维度一：时长与 4 阶段节奏控制 ({report.durationScore.score} / 30 分)
                </h4>
                <ul className="text-xs text-slate-600 space-y-1 pl-4 list-disc">
                  {report.durationScore.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>

              {/* 维度二：因果闭环与漏洞定位 */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                    维度二：因果闭环与契诃夫之枪校验 ({report.causalityScore.score} / 40 分)
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">
                    漏洞数：{report.causalityScore.brokenLinks.length}
                  </span>
                </h4>

                <ul className="text-xs text-slate-600 space-y-1 pl-4 list-disc">
                  {report.causalityScore.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>

                {report.causalityScore.brokenLinks.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      因果断裂与逻辑漏洞逐句定位：
                    </span>
                    {report.causalityScore.brokenLinks.map((item, i) => (
                      <div key={i} className="p-3 bg-red-50/60 border border-red-200 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-red-800">
                            [阶段 {item.phaseId}] {item.issueType}
                          </span>
                          <span className="text-[10px] text-red-500 font-mono">{item.quoteText}</span>
                        </div>
                        <p className="text-red-700">{item.description}</p>
                        <p className="text-slate-600 text-[11px]"><strong className="text-slate-800">修复建议：</strong>{item.suggestion}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 维度三：策略强度与博弈亮点 */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-slate-500" />
                  维度三：策略对抗深度与亮点 ({report.strategyScore.score} / 30 分)
                </h4>
                <ul className="text-xs text-slate-600 space-y-1 pl-4 list-disc">
                  {report.strategyScore.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
