import React, { useEffect, useState, memo } from 'react';
import { Sparkles, Send, Bot, PenLine, AlertCircle, Target, Loader2, Zap, ChevronRight } from 'lucide-react';
import { getUserCurrentProfile, appendUserProfileFactor, ingestUserMemory, runMemoryDreaming } from '../utils/profileHelper';
import { useBiweeklyReviewTrigger } from '../hooks/useBiweeklyReviewTrigger';
import ProfileEditModal from './ProfileEditModal';
import {
  getLastReviewDate,
  getReviewHistory,
  getNextWeekPushPlan,
  saveNextWeekPushPlan,
  GLOBAL_DIRECTION_OPTIONS,
  appendWeeklyChatHistory,
} from '../utils/reviewHelper';
import { runWeeklyChatEnhanced } from '../services/difyAPI';
import { playClick, playWaterDrop } from '../utils/soundEffects';

interface SummaryAreaProps {
  selectedDate: string;
}

function daysSinceLastReview(): number {
  const last = getLastReviewDate();
  return Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
}

function SummaryAreaComponent({ selectedDate }: SummaryAreaProps) {

  const { shouldShowCard, shouldForceModal } = useBiweeklyReviewTrigger();
  const [profile, setProfile] = useState('');
  const [latestReview, setLatestReview] = useState<{ factors?: string; date?: string } | null>(null);
  const [daysSince, setDaysSince] = useState(0);

  const [content, setContent] = useState('');
  const [directions, setDirections] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatResult, setChatResult] = useState<{ analysis: string; nextWeekPreview: string } | null>(null);
  const [hasPushPlan, setHasPushPlan] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const profilePreviewThreshold = 180;
  const showProfileExpand = profile.length > profilePreviewThreshold;

  const refreshReviewState = () => {
    setProfile(getUserCurrentProfile() || '系统全面扫描中');
    setDaysSince(daysSinceLastReview());
    const history = getReviewHistory();
    setLatestReview(history[0] || null);
    setHasPushPlan(!!getNextWeekPushPlan());
  };

  useEffect(() => {
    refreshReviewState();
    const onProfile = () => refreshReviewState();
    const onReviewDate = () => refreshReviewState();
    const onRebalance = () => refreshReviewState();
    window.addEventListener('global-profile-changed', onProfile);
    window.addEventListener('superme-review-date-changed', onReviewDate);
    window.addEventListener('global-training-rebalance', onRebalance);
    return () => {
      window.removeEventListener('global-profile-changed', onProfile);
      window.removeEventListener('superme-review-date-changed', onReviewDate);
      window.removeEventListener('global-training-rebalance', onRebalance);
    };
  }, [selectedDate]);

  const handleDirectionToggle = (val: string) => {
    playClick();
    setDirections((prev) =>
      prev.includes(val) ? prev.filter((d) => d !== val) : [...prev, val],
    );
  };

  const handleWeeklySubmit = async () => {
    if (!content.trim()) return;
    setIsLoading(true);
    setChatResult(null);
    try {
      const result = await runWeeklyChatEnhanced(content, directions);
      appendUserProfileFactor(result.profileFactors);
      saveNextWeekPushPlan(result.nextWeekPush as Parameters<typeof saveNextWeekPushPlan>[0]);
      appendWeeklyChatHistory({
        id: Date.now().toString(),
        date: new Date().toLocaleString('zh-CN'),
        userContent: content,
        aiAnalysis: result.analysis,
        directions: [...directions],
        nextWeekPreview: result.nextWeekPreview,
      });
      void ingestUserMemory({
        source: 'weekly_chat_summary',
        profileDelta: result.profileFactors,
        turn: {
          role: 'user',
          text: content.slice(0, 1000),
          session_id: `weekly_${Date.now()}`,
        },
        sessionSummary: {
          summary: result.analysis.slice(0, 300),
          title: '周聊摘要',
          preview: result.nextWeekPreview,
          directions,
        },
        promoteToEpisode: true,
      }).then(() => runMemoryDreaming());
      setChatResult({ analysis: result.analysis, nextWeekPreview: result.nextWeekPreview });
      setContent('');
      setHasPushPlan(true);
      playWaterDrop();
    } catch (e) {
      console.error('心智投喂失败:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const openBiweeklyReview = () => {
    playClick();
    window.dispatchEvent(new Event('open-biweekly-review'));
  };

  const openProfileModal = () => {
    playClick();
    setShowProfileModal(true);
  };

  return (
    <div className="w-full relative px-2 mb-20">
      <div className="absolute -top-3.5 left-10 bg-[#FF5722]/5 border border-[#FF5722]/20 px-4 py-1 text-[10px] font-black tracking-[0.2em] text-[#FF5722] uppercase z-10 shadow-sm rounded-full backdrop-blur-md">
        Cornell Summary Area
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border border-slate-100/80 rounded-3xl p-6 md:p-8 hover:border-[#FF5722]/20 transition-all duration-300 shadow-[0_12px_35px_rgba(0,0,0,0.015)] bg-white relative">

        {/* 左半区：两周期专属复盘 */}
        <div className="flex flex-col border-b md:border-b-0 md:border-r border-gray-100 md:pr-12 md:pb-0 pb-10">
          <h3 className="font-black text-[#202124] mb-4 flex items-center text-xl tracking-tight">
            <Bot className="w-5 h-5 mr-3 text-[#FF5722]" strokeWidth={2.5} />
            专属复盘与弱点扫描
          </h3>
          <p className="text-[11px] text-gray-400 mb-4 font-bold tracking-[0.1em] uppercase">
            两周期强制评估 / 四维度结构化自省 / 画像纠偏
          </p>

          {(shouldShowCard || shouldForceModal) && (
            <div className={`mb-4 p-3 rounded-xl border text-[11px] font-semibold flex items-start gap-2 ${
              shouldForceModal
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {shouldForceModal
                  ? '已超过17天未复盘，系统已阻断训练，请立即完成弱点扫描。'
                  : `距离上次复盘已 ${daysSince} 天，复盘纠偏窗口已开启。`}
              </span>
            </div>
          )}

          <div className="flex-1 bg-slate-50/70 rounded-xl p-5 text-sm text-gray-700 leading-relaxed font-medium min-h-[160px] border border-slate-100 shadow-inner space-y-3">
            <div className="flex items-center text-[#FF5722] text-xs font-black font-mono tracking-widest">
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              距上次复盘 {daysSince} 天
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  当前全局短板画像
                </span>
                <button
                  type="button"
                  onClick={openProfileModal}
                  className="text-[10px] font-bold text-zinc-500 hover:text-[#FF5722] transition-colors cursor-pointer"
                >
                  {showProfileExpand ? '查看全部' : '编辑'}
                </button>
              </div>
              <div className="relative">
                <p
                  className={`text-gray-700 text-xs leading-relaxed ${
                    showProfileExpand ? 'max-h-[120px] overflow-hidden' : ''
                  }`}
                >
                  {profile}
                </p>
                {showProfileExpand && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-50/95 to-transparent" />
                )}
              </div>
              {showProfileExpand && (
                <button
                  type="button"
                  onClick={openProfileModal}
                  className="mt-2 inline-flex items-center gap-0.5 text-[10px] font-bold text-[#FF5722] hover:text-[#E64A19] transition-colors cursor-pointer"
                >
                  查看全部
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
            {latestReview && (latestReview.profileUpdateFactors || latestReview.factors) && (
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                  最近一次复盘提取
                </span>
                <p className="text-xs text-zinc-800 bg-white px-3 py-2 rounded-lg border border-slate-100">
                  {latestReview.profileUpdateFactors || latestReview.factors}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={openBiweeklyReview}
            className="mt-4 w-full bg-zinc-950 hover:bg-[#FF5722] text-white py-3 rounded-xl text-xs font-black tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Target className="w-4 h-4" />
            {shouldForceModal ? '立即完成阻断式弱点扫描' : '开启四维度专属复盘'}
          </button>
        </div>

        {/* 右半区：心智投喂四段式（紧凑版） */}
        <div className="flex flex-col md:pl-4">
          <h3 className="font-black text-[#202124] mb-4 flex items-center text-xl tracking-tight">
            <PenLine className="w-5 h-5 mr-3 text-[#FF5722]" strokeWidth={2.5} />
            每周夜话与学习输入
          </h3>
          <p className="text-[11px] text-gray-400 mb-3 font-bold tracking-[0.1em] uppercase">
            学习输入 / 定向勾选 / 启发分析 / 训练调整
          </p>

          {hasPushPlan && (
            <p className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-3 font-medium">
              下周训练重组计划已生效，口语练习 / 博弈训练 / 表达训练将自动读取。
            </p>
          )}

          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isLoading}
            className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-xs text-gray-800 focus:bg-white focus:outline-none focus:border-[#FF5722]/40 mb-3 resize-none leading-relaxed placeholder-gray-400 font-medium"
            placeholder="倾吐本周职场博弈困局、高管利益纠葛、心智瓶颈..."
          />

          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {GLOBAL_DIRECTION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleDirectionToggle(opt.value)}
                className={`text-[10px] font-bold py-1.5 px-2 rounded-lg border transition-all cursor-pointer ${
                  directions.includes(opt.value)
                    ? 'border-zinc-900 bg-zinc-50 text-zinc-900'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {chatResult && (
            <div className="mb-3 space-y-2">
              <div className="bg-zinc-900 text-zinc-200 rounded-xl p-3 text-[11px] leading-relaxed">
                <span className="text-amber-400 font-bold flex items-center gap-1 mb-1">
                  <Zap className="w-3 h-3" /> 启发研判
                </span>
                {chatResult.analysis}
              </div>
              <div className="bg-emerald-50 text-emerald-700 rounded-xl p-3 text-[10px] leading-relaxed border border-emerald-100">
                {chatResult.nextWeekPreview}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleWeeklySubmit}
            disabled={isLoading || !content.trim()}
            className="w-full mt-auto bg-[#202124] hover:bg-[#FF5722] text-white py-3.5 rounded-xl text-xs font-black tracking-widest flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                正在分析中…
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" strokeWidth={2.5} />
                提交输入并更新训练计划
              </>
            )}
          </button>
        </div>
      </div>

      <ProfileEditModal
        isOpen={showProfileModal}
        profile={profile}
        onClose={() => setShowProfileModal(false)}
        onSaved={refreshReviewState}
      />
    </div>
  );
}

const SummaryArea = memo(SummaryAreaComponent);
export default SummaryArea;

