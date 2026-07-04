import React, { useState } from 'react';
import { X, Sparkles, Send, Award, Target, Flame, AlertCircle } from 'lucide-react';
import { runBiweeklyReviewAnalysis } from '../../services/difyAPI';
import { appendUserProfileFactor } from '../../utils/profileHelper';
import { setLastReviewDate, saveReviewToHistory } from '../../utils/reviewHelper';

interface BiweeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  isForce?: boolean;
}

export default function BiweeklyReviewModal({ isOpen, onClose, isForce = false }: BiweeklyReviewModalProps) {
  const [answers, setAnswers] = useState({
    practicalTest: '',
    goalAlignment: '',
    weaknessScan: '',
    tacticalDispatch: '',
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!answers.practicalTest || !answers.goalAlignment || !answers.weaknessScan || !answers.tacticalDispatch) {
      alert('请完整填写四个维度的自省指标。');
      return;
    }
    setLoading(true);
    try {
      const res = await runBiweeklyReviewAnalysis(answers);
      appendUserProfileFactor(res.shortDebilitatingFactors);
      saveReviewToHistory(answers, res.shortDebilitatingFactors);
      setLastReviewDate(Date.now());

      setTimeout(() => {
        setLoading(false);
        onClose();
      }, 3000);
    } catch (e) {
      console.error(e);
      setLoading(false);
      alert('提交失败，请重试');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden border border-zinc-200 shadow-2xl animate-scale-up">
        <div className="bg-zinc-950 text-white p-6 flex justify-between items-center relative">
          <div>
            <span className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase">刻意练习 · 纠偏航向</span>
            <h3 className="text-lg font-black tracking-wider flex items-center gap-2 mt-1">
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
              专属复盘与弱点扫描
            </h3>
          </div>
          {!isForce && (
            <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
          {isForce && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs font-semibold leading-relaxed">
                您已超过17天未进行系统复盘。为了保障自适应训练的精准度，系统已进入阻断状态，必须完成复盘后方可解锁全部训练功能。
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-zinc-500" />
                1. 实战检验比对 (过去两周什么帮助最大？什么几乎没用？)
              </label>
              <textarea
                value={answers.practicalTest}
                onChange={(e) => setAnswers({ ...answers, practicalTest: e.target.value })}
                className="w-full text-xs p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-1 focus:ring-zinc-950 resize-none h-20"
                placeholder="例如：驭心博弈模块在本周跨部门会议中提供的话术特别管用；但由于目标调整，高阶审美本周暂无使用场景..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-zinc-500" />
                2. 目标动态校准 (工作/跳槽目标有无微调？训练内容是否需增减？)
              </label>
              <textarea
                value={answers.goalAlignment}
                onChange={(e) => setAnswers({ ...answers, goalAlignment: e.target.value })}
                className="w-full text-xs p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-1 focus:ring-zinc-950 resize-none h-20"
                placeholder="例如：准备在年底向外企高管层跃迁，需要显著增加跨文化谈判的口语和写作训练比重..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-zinc-500" />
                3. 短板瓶颈扫描 (当前哪个能力短板正成为实际的晋升/跳槽瓶颈？)
              </label>
              <textarea
                value={answers.weaknessScan}
                onChange={(e) => setAnswers({ ...answers, weaknessScan: e.target.value })}
                className="w-full text-xs p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-1 focus:ring-zinc-950 resize-none h-20"
                placeholder="例如：即兴表达时逻辑框架容易散乱，面对上级质询时不够沉稳专业..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-2 mb-2">
                <Send className="w-4 h-4 text-zinc-500" />
                4. 战术火力调度 (下两周是否需要挂起不紧急板块，集中火力击穿最痛短板？)
              </label>
              <textarea
                value={answers.tacticalDispatch}
                onChange={(e) => setAnswers({ ...answers, tacticalDispatch: e.target.value })}
                className="w-full text-xs p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-1 focus:ring-zinc-950 resize-none h-20"
                placeholder="例如：建议挂起高阶审美板块，将所有练习额度全部调整给口语沙盘与破局说..."
              />
            </div>
          </div>
        </div>

        <div className="bg-zinc-50 p-6 border-t border-zinc-100 flex justify-between items-center">
          <span className="text-[10px] text-zinc-400 font-medium">数据存储：本地沙箱绝对隐私</span>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-zinc-950 hover:bg-zinc-900 text-white font-bold text-xs px-6 py-3 rounded-full flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            {loading ? '神经突触动态纠偏中...' : '提交并修正系统画像'}
          </button>
        </div>
      </div>
    </div>
  );
}
