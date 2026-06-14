import React, { useState, useEffect } from 'react';
import { Lock, Sparkles, Zap, Loader2, Calendar, Trash2 } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import { playClick, playPageTurn, playWaterDrop } from '../../utils/soundEffects';
import { runWeeklyCognitiveAnalysis } from '../../services/difyAPI';
import { saveUserCurrentProfile, getUserCurrentProfile, appendUserProfileFactor } from '../../utils/profileHelper';

interface HistoryItem {
  id: string;
  date: string;
  userContent: string;
  aiAnalysis: string;
  factors: string;
}

export default function WeeklyChatModule() {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<{ analysis: string; shortDebilitatingFactors: string } | null>(null);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [globalProfile, setGlobalProfile] = useState('');

  // 初始化加载历史足迹与画像
  useEffect(() => {
    setGlobalProfile(getUserCurrentProfile() || '暂无特定短板设定 (系统正处于全面扫描状态)');
    
    const localHistory = localStorage.getItem('super_agent_weekly_history');
    if (localHistory) {
      try {
        setHistoryList(JSON.parse(localHistory));
      } catch (e) {
        console.error('解析历史沉淀失败:', e);
      }
    }
    
    const handleProfileChange = () => {
      setGlobalProfile(getUserCurrentProfile() || '暂无特定短板设定 (系统正处于全面扫描状态)');
    };
    window.addEventListener('global-profile-changed', handleProfileChange);
    return () => window.removeEventListener('global-profile-changed', handleProfileChange);
  }, []);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    // 播放纸张翻页声（代表封存入库）
    playPageTurn();
    setIsLoading(true);
    setCurrentResult(null);

    try {
      const result = await runWeeklyCognitiveAnalysis(content);
      
      // 更新用户的全局能力短板（画像进化 - 增量追加）
      appendUserProfileFactor(result.shortDebilitatingFactors);
      
      const newHistory: HistoryItem = {
        id: Date.now().toString(),
        date: new Date().toLocaleString('zh-CN', { 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        }),
        userContent: content,
        aiAnalysis: result.analysis,
        factors: result.shortDebilitatingFactors
      };
      
      const updatedList = [newHistory, ...historyList];
      setHistoryList(updatedList);
      localStorage.setItem('super_agent_weekly_history', JSON.stringify(updatedList));
      
      setCurrentResult(result);
      setContent('');
      
      // 成功后播放水滴确认音效
      playWaterDrop();
    } catch (e) {
      console.error('认知树洞分析失败:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    if (confirm('确认清空所有历史树洞沉淀吗？此操作不可逆。')) {
      playClick();
      setHistoryList([]);
      localStorage.removeItem('super_agent_weekly_history');
    }
  };

  return (
    <ModuleWrapper 
      title="深渊 ｜ 潜意识树洞与进化中枢" 
      icon={<Lock className="w-8 h-8 text-zinc-700" strokeWidth={2.5} />}
      isOpen={true}
      description="核心定位：专属私人智囊舱，动态进化调整的核心大脑枢纽。"
    >
      <div className="space-y-8 max-w-5xl mx-auto py-4">
        
        {/* 全局画像进化卡片（Zinc极简高管风） */}
        <div className="admin-card p-6 md:p-8 rounded-[2rem] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-widest">
              当前全局进化能力短板 (Global Profile)
            </span>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-zinc-500 animate-pulse" />
              <p className="text-sm font-semibold text-zinc-800 tracking-wide">{globalProfile}</p>
            </div>
          </div>
          <div>
            <span className="inline-block bg-zinc-100 text-zinc-600 text-[10px] px-3.5 py-1.5 rounded-full font-bold tracking-wider">
              私密本地沙盒
            </span>
          </div>
        </div>

        {/* 主输入面板 */}
        <div className="admin-card p-8 md:p-12 rounded-[2.5rem] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-5">
            <div>
              <h4 className="text-base font-bold text-zinc-800 tracking-wider">本周私密沉淀舱</h4>
              <p className="text-xs text-zinc-400 mt-1">彻底卸下防备，倾吐您在本周面临的决策冲突、暗流涌动或心智困局</p>
            </div>
            <span className="text-zinc-400 text-[10px] font-bold self-start sm:self-center tracking-wider">
              字数建议：50 - 500 字
            </span>
          </div>

          <textarea 
            rows={6} 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isLoading}
            className="w-full bg-zinc-50/50 border border-zinc-200/80 rounded-2xl p-6 text-sm font-medium outline-none focus:ring-1 focus:ring-zinc-400 focus:bg-white transition-all resize-none leading-relaxed text-zinc-800 placeholder-zinc-400" 
            placeholder="在此倾吐本周遭遇的博弈、对局势的隐忧或认知上的瓶颈。我将以绝对忠诚、绝对智慧的同谋者身份，为您剖析人性深处的逻辑并进化全局策略..."
          />

          <div className="flex justify-end pt-2">
            <button 
              onClick={handleSubmit}
              disabled={isLoading || !content.trim()}
              className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold px-8 py-3.5 rounded-full text-xs transition-all tracking-widest uppercase disabled:bg-zinc-100 disabled:text-zinc-300 flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  研判中...
                </>
              ) : (
                '固化本周数据并沉睡系统'
              )}
            </button>
          </div>
        </div>

        {/* 当前研判展现区 */}
        {currentResult && (
          <div className="bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-[2.5rem] p-8 md:p-10 shadow-md space-y-5 animate-fade-in">
            <div className="flex items-center gap-3 pb-4 border-b border-zinc-800">
              <Zap className="w-4 h-4 text-zinc-400" />
              <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">
                神经突触演化分析 / 下周进化指令
              </h4>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed font-medium">
              {currentResult.analysis}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-3 text-xs text-zinc-400">
              <span className="font-semibold">画像更新关键字：</span>
              <span className="text-zinc-900 font-bold bg-white px-3 py-1 rounded-md text-[11px] tracking-wide shadow-sm">
                {currentResult.shortDebilitatingFactors}
              </span>
            </div>
          </div>
        )}

        {/* 历史记录足迹 */}
        {historyList.length > 0 && (
          <div className="admin-card rounded-[2.5rem] p-8 md:p-10 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h4 className="text-sm font-bold text-zinc-800 tracking-wider">历史认知沉淀足迹</h4>
              <button 
                onClick={clearHistory}
                className="text-zinc-400 hover:text-red-500 text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> 清空足迹
              </button>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {historyList.map((item) => (
                <div key={item.id} className="p-6 bg-zinc-50/50 rounded-2xl border border-zinc-100/80 space-y-4 hover:border-zinc-200 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-zinc-400 font-bold">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {item.date}</span>
                    <span className="bg-zinc-200/60 text-zinc-700 px-3 py-1 rounded font-bold">{item.factors}</span>
                  </div>
                  <p className="text-xs text-zinc-500 font-medium italic border-l-2 border-zinc-200 pl-4">
                    “{item.userContent}”
                  </p>
                  <div className="text-xs text-zinc-700 bg-white border border-zinc-100 p-4 rounded-xl leading-relaxed shadow-sm">
                    <span className="font-bold text-zinc-800 text-[10px] block mb-1.5 uppercase tracking-wider">
                      AI 研判结论
                    </span>
                    {item.aiAnalysis}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModuleWrapper>
  );
}

