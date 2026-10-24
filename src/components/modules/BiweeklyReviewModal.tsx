import React, { useState } from 'react';
import { X, Sparkles, Send, Award, Target, Flame, AlertCircle, CheckCircle2 } from 'lucide-react';
import { runBiweeklyReviewAnalysis } from '../../services/difyAPI';
import { ingestUserMemory, runMemoryDreaming } from '../../utils/profileHelper';
import { useBiweeklyReviewTrigger } from '../../hooks/useBiweeklyReviewTrigger';
import {
  setLastReviewDate,
  saveReviewRecord,
  getReviewRoundNumber,
  recordDifficultyIncrease,
  setPausedModules,
  saveNextWeekPushPlan,
  type TrainingRebalancePlan,
} from '../../utils/reviewHelper';
import { showError, showWarning } from '../Toast';

interface BiweeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  isForce?: boolean;
}

function QuestionField({
  icon,
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-zinc-700 flex items-center gap-2">
        {icon} {label}
      </label>
      <p className="text-[10px] text-zinc-400 font-medium ml-6">{hint}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-1 focus:ring-zinc-950 resize-none h-20"
        placeholder={placeholder}
      />
    </div>
  );
}

export default function BiweeklyReviewModal({ isOpen, onClose, isForce = false }: BiweeklyReviewModalProps) {
  const { daysSinceReview } = useBiweeklyReviewTrigger();
  const [answers, setAnswers] = useState({
    practicalTest: '',
    goalAlignment: '',
    weaknessScan: '',
    tacticalDispatch: '',
  });
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [resultFactors, setResultFactors] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!answers.practicalTest || !answers.goalAlignment || !answers.weaknessScan || !answers.tacticalDispatch) {
      showWarning('请完整填写四个维度的自省指标。');
      return;
    }
    setLoading(true);
    try {
      const res = await runBiweeklyReviewAnalysis(answers);

      void ingestUserMemory({
        source: 'biweekly_review',
        profileDelta: res.shortDebilitatingFactors,
        episode: {
          practicalTest: answers.practicalTest.slice(0, 120),
          weaknessScan: answers.weaknessScan.slice(0, 120),
          tacticalDispatch: answers.tacticalDispatch.slice(0, 120),
        },
      }).then(() => runMemoryDreaming());

      saveReviewRecord({
        id: Date.now().toString(),
        date: new Date().toISOString(),
        roundNumber: getReviewRoundNumber() + 1,
        answers,
        extractedWeaknesses: res.shortDebilitatingFactors.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean),
        profileUpdateFactors: res.shortDebilitatingFactors,
        trainingAdjustment: res.trainingAdjustment || {
          pauseModules: [],
          intensifyModules: [],
          newFocusAreas: [],
          difficultyIncrease: {},
        },
      });

      if (res.difficultyAdjustment) {
        for (const [module, increase] of Object.entries(res.difficultyAdjustment)) {
          if (typeof increase === 'number' && increase > 0) {
            recordDifficultyIncrease(module, increase);
          }
        }
      }

      if (res.trainingAdjustment?.pauseModules?.length) {
        setPausedModules(res.trainingAdjustment.pauseModules);
      }
      if (res.trainingAdjustment?.intensifyModules?.length) {
        const plan: TrainingRebalancePlan = {
          generalFocus: res.trainingAdjustment.intensifyModules,
        };
        saveNextWeekPushPlan(plan);
      }

      setResultFactors(res.shortDebilitatingFactors);
      setLastReviewDate(Date.now());
      setCompleted(true);

      setTimeout(() => {
        setLoading(false);
        setCompleted(false);
        window.dispatchEvent(new Event('global-profile-changed'));
        window.dispatchEvent(new Event('dify-context-refresh-needed'));
        window.dispatchEvent(new Event('superme-review-date-changed'));
        onClose();
      }, 3000);
    } catch (e) {
      console.error(e);
      setLoading(false);
      showError('提交失败，请重试');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden border border-zinc-200 shadow-2xl animate-scale-up">
        <div className="bg-zinc-950 text-white p-6 flex justify-between items-center relative">
          <div>
            <span className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase">
              刻意练习 · 纠偏航向 · 第{getReviewRoundNumber() + 1}轮
            </span>
            <h3 className="text-lg font-black tracking-wider flex items-center gap-2 mt-1">
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
              专属复盘与弱点扫描
            </h3>
          </div>
          {!isForce && (
            <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
          {isForce && !completed && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs font-semibold leading-relaxed">
                您已超过 {daysSinceReview} 天未进行系统复盘。为保障自适应训练的精准度，系统已进入阻断状态，必须完成复盘后方可解锁全部训练功能。
              </div>
            </div>
          )}

          {completed ? (
            <div className="text-center py-12 space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
              <h4 className="text-lg font-bold text-zinc-900">复盘数据已固化</h4>
              <p className="text-xs text-zinc-500">
                画像已更新: <span className="font-bold text-zinc-700">{resultFactors}</span>
              </p>
              <p className="text-[10px] text-zinc-400">系统将自动重组下周训练方案...</p>
            </div>
          ) : (
            <div className="space-y-5">
              <QuestionField
                icon={<Award className="w-4 h-4 text-zinc-500" />}
                label="1. 实战检验比对"
                hint="过去两周哪个板块帮助最大？哪个几乎没用？"
                value={answers.practicalTest}
                onChange={(v) => setAnswers({ ...answers, practicalTest: v })}
                placeholder="例如：博弈训练模块在本周跨部门会议中提供的话术特别管用..."
              />
              <QuestionField
                icon={<Target className="w-4 h-4 text-zinc-500" />}
                label="2. 目标动态校准"
                hint="工作/跳槽目标有无微调？训练内容是否需增减？"
                value={answers.goalAlignment}
                onChange={(v) => setAnswers({ ...answers, goalAlignment: v })}
                placeholder="例如：准备在年底向外企高管层跃迁，需要显著增加跨文化谈判训练..."
              />
              <QuestionField
                icon={<Flame className="w-4 h-4 text-zinc-500" />}
                label="3. 短板瓶颈扫描"
                hint="当前哪个能力短板正成为实际的晋升/跳槽瓶颈？"
                value={answers.weaknessScan}
                onChange={(v) => setAnswers({ ...answers, weaknessScan: v })}
                placeholder="例如：即兴表达时逻辑框架容易散乱..."
              />
              <QuestionField
                icon={<Send className="w-4 h-4 text-zinc-500" />}
                label="4. 训练重点调整"
                hint="下两周是否需要挂起不紧急板块，集中精力攻克最痛短板？"
                value={answers.tacticalDispatch}
                onChange={(v) => setAnswers({ ...answers, tacticalDispatch: v })}
                placeholder="例如：建议挂起高阶审美板块，将所有练习额度调整给口语练习..."
              />
            </div>
          )}
        </div>

        {!completed && (
          <div className="bg-zinc-50 p-6 border-t border-zinc-100 flex justify-between items-center">
            <span className="text-[10px] text-zinc-400 font-medium">数据仅保存在本机，更注重隐私</span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="bg-zinc-950 hover:bg-zinc-900 text-white font-bold text-xs px-6 py-3 rounded-full flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {loading ? '正在根据复盘调整画像…' : '提交并更新学习画像'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
