import React, { useState, useEffect } from 'react';
import { Lock, Zap, Loader2, Calendar, Trash2 } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import { playClick, playPageTurn, playWaterDrop } from '../../utils/soundEffects';
import { runWeeklyChatAnalysis } from '../../services/difyAPI';
import { saveNextWeekPushPlan, getNextWeekPushPlan } from '../../utils/reviewHelper';
import { getUserCurrentProfile } from '../../utils/profileHelper';

interface HistoryItem {
  id: string;
  date: string;
  userContent: string;
  aiAnalysis: string;
  directions: string[];
  nextWeekPreview: string;
}

const DIRECTION_OPTIONS = [
  { label: '人性博弈案例', value: 'humanGameCase' },
  { label: '英语学习主题', value: 'englishTopic' },
  { label: '高管斗争案例', value: 'executiveConflict' },
  { label: '驭人/博弈策略', value: 'manipulationStrategy' },
  { label: '顶层认知升维', value: 'cognitiveUpgrade' },
  { label: '晋升/跳槽建议', value: 'careerAdvice' },
];

export default function WeeklyChatModule() {
  const [content, setContent] = useState('');
  const [directions, setDirections] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<{
    analysis: string;
    nextWeekPreview: string;
  } | null>(null);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [globalProfile, setGlobalProfile] = useState('');
  const [hasPushPlan, setHasPushPlan] = useState(false);

  useEffect(() => {
    setGlobalProfile(getUserCurrentProfile() || '暂无特定短板设定 (系统正处于全面扫描状态)');
    setHasPushPlan(!!getNextWeekPushPlan());

    const enhanced = localStorage.getItem('superme_weekly_history_enhanced');
    const legacy = localStorage.getItem('super_agent_weekly_history');
    const raw = enhanced || legacy;
    if (raw) {
      try {
        setHistoryList(JSON.parse(raw));
      } catch (e) {
        console.error('解析历史沉淀失败:', e);
      }
    }

    const handleProfileChange = () => {
      setGlobalProfile(getUserCurrentProfile() || '暂无特定短板设定 (系统正处于全面扫描状态)');
    };
    const handleRebalance = () => setHasPushPlan(!!getNextWeekPushPlan());

    window.addEventListener('global-profile-changed', handleProfileChange);
    window.addEventListener('global-training-rebalance', handleRebalance);
    return () => {
      window.removeEventListener('global-profile-changed', handleProfileChange);
      window.removeEventListener('global-training-rebalance', handleRebalance);
    };
  }, []);

  const handleDirectionToggle = (val: string) => {
    playClick();
    setDirections((prev) =>
      prev.includes(val) ? prev.filter((d) => d !== val) : [...prev, val],
    );
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;

    playPageTurn();
    setIsLoading(true);
    setCurrentResult(null);

    try {
      const result = await runWeeklyChatAnalysis(content, directions);

      saveNextWeekPushPlan(result.nextWeekPush as Parameters<typeof saveNextWeekPushPlan>[0]);
      setHasPushPlan(true);

      const newHistory: HistoryItem = {
        id: Date.now().toString(),
        date: new Date().toLocaleString('zh-CN'),
        userContent: content,
        aiAnalysis: result.analysis,
        directions: [...directions],
        nextWeekPreview: result.nextWeekPreview,
      };

      const updated = [newHistory, ...historyList];
      setHistoryList(updated);
      localStorage.setItem('superme_weekly_history_enhanced', JSON.stringify(updated));
      setCurrentResult({
        analysis: result.analysis,
        nextWeekPreview: result.nextWeekPreview,
      });
      setContent('');
      playWaterDrop();
    } catch (e) {
      console.error('心智投喂分析失败:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    if (confirm('确认清空所有历史树洞沉淀吗？此操作不可逆。')) {
      playClick();
      setHistoryList([]);
      localStorage.removeItem('superme_weekly_history_enhanced');
      localStorage.removeItem('super_agent_weekly_history');
    }
  };

  return (
    <ModuleWrapper
      title="每周夜话与心智投喂"
      icon={<Lock className="w-8 h-8 text-zinc-700" strokeWidth={2.5} />}
      isOpen={true}
      description="四段式交互：投喂 → 定向勾选 → 启发研判 → 训练库进化预告"
    >
      <div className="space-y-6 max-w-4xl mx-auto py-4">
        {hasPushPlan && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-[11px] text-emerald-700 font-medium">
            下周个性化训练重组计划已生效，口语沙盘 / 驭心博弈 / 破局说将自动读取注入。
          </div>
        )}

        <div className="admin-card p-5 rounded-2xl">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
            当前全局进化能力短板
          </span>
          <p className="text-sm font-semibold text-zinc-800 mt-1">{globalProfile}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 space-y-4">
          <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <span>📥</span> 1. 心智投喂输入区
          </h3>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isLoading}
            className="w-full text-xs p-4 bg-zinc-50 border border-zinc-200 rounded-xl outline-none resize-none h-32 focus:ring-1 focus:ring-zinc-400"
            placeholder="自由倾吐本周读到的书、看到的职场博弈困局、高管利益纠葛、个人心智瓶颈等..."
          />
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 space-y-4">
          <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <span>🎯</span> 2. 定制方向勾选项
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {DIRECTION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`p-3 border rounded-xl flex items-center gap-2 cursor-pointer transition-all text-xs font-bold ${
                  directions.includes(opt.value)
                    ? 'border-zinc-950 bg-zinc-50 text-zinc-950'
                    : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={directions.includes(opt.value)}
                  onChange={() => handleDirectionToggle(opt.value)}
                  className="hidden"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !content.trim()}
            className="bg-zinc-950 hover:bg-zinc-900 text-white font-bold text-xs px-8 py-3.5 rounded-full tracking-widest cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                启发式研判中...
              </>
            ) : (
              '提交投喂并进化系统'
            )}
          </button>
        </div>

        {currentResult && (
          <div className="space-y-6">
            <div className="bg-zinc-950 text-zinc-100 p-6 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold tracking-widest text-zinc-400 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" /> 3. 大模型启发互动研判
              </h4>
              <p className="text-xs leading-relaxed text-zinc-300 font-medium whitespace-pre-line">
                {currentResult.analysis}
              </p>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-2">
                <span>📡</span> 4. 下周个性化训练定向重组预告
              </h4>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                {currentResult.nextWeekPreview}
              </p>
            </div>
          </div>
        )}

        {historyList.length > 0 && (
          <div className="admin-card rounded-3xl p-5 md:p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h4 className="text-sm font-bold text-zinc-800 tracking-wider">历史认知沉淀足迹</h4>
              <button
                type="button"
                onClick={clearHistory}
                className="text-zinc-400 hover:text-red-500 text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> 清空足迹
              </button>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {historyList.map((item) => (
                <div
                  key={item.id}
                  className="p-6 bg-zinc-50/50 rounded-2xl border border-zinc-100/80 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-zinc-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" /> {item.date}
                    </span>
                    {item.directions?.length > 0 && (
                      <span className="bg-zinc-200/60 text-zinc-700 px-3 py-1 rounded font-bold">
                        {item.directions.join(' · ')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 font-medium italic border-l-2 border-zinc-200 pl-4">
                    “{item.userContent}”
                  </p>
                  <div className="text-xs text-zinc-700 bg-white border border-zinc-100 p-4 rounded-xl leading-relaxed">
                    {item.aiAnalysis}
                  </div>
                  {item.nextWeekPreview && (
                    <p className="text-[10px] text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                      {item.nextWeekPreview}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModuleWrapper>
  );
}
