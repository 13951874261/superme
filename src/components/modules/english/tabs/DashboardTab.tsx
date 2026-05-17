import React, { useState } from 'react';
import { Target, AlertTriangle, CheckCircle2, Clock, Loader2, Zap } from 'lucide-react';
import { useEnglishContext, getThemeOptions } from '../context/EnglishContext';
import PronunciationTrainer from '../../PronunciationTrainer';
import GrammarPolishTrainer from '../../GrammarPolishTrainer';
import MaterialUploader from '../../../MaterialUploader';
import Confetti from '../../../Confetti';
import { playSuccess, playError, playScan } from '../../../../utils/soundEffects';
import { checkThemeMastery, setThemeFocus } from '../../../../services/trainingAPI';

export default function DashboardTab() {
  const {
    stage, setStage,
    theme, setTheme,
    masteryData,
    themeSwitchError, setThemeSwitchError,
    pronunciationNotes, setPronunciationNotes,
    grammarNotes, setGrammarNotes,
    inlineNotice, noticeAnchor, setActiveTab
  } = useEnglishContext();

  const handleStageChange = (newStage: '0-6' | '6-12') => {
    setStage(newStage);
    const options = getThemeOptions(newStage);
    if (!options.find(o => o.value === theme)) {
      setThemeSwitchError(null);
      setTheme(options[0].value);
    }
  };

  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleAutoGenerate = async () => {
    setIsAutoGenerating(true);
    playScan();
    showNotice('dashboard', '正在呼叫 AI 撰写长文...', 'info');
    try {
      const { runListenMaterialGenerator, triggerEnglishMasteryExtraction } = await import('../../../../services/difyAPI');
      const script = await runListenMaterialGenerator(theme);
      showNotice('dashboard', '长文撰写完毕，正在提纯词汇...', 'info');
      await triggerEnglishMasteryExtraction(theme, script, 'default-user');
      showNotice('dashboard', '提取完成！今日弹药已入库', 'success');
      playSuccess();
      setShowConfetti(true);
      window.dispatchEvent(new Event('vocab-updated'));
      setTimeout(() => setActiveTab('vocab'), 1500);
    } catch (e: any) {
      playError();
      showNotice('dashboard', `提取失败: ${e.message}`, 'error');
    } finally {
      setIsAutoGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease-out] relative">
      {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
      
      {/* 战术使用指南 SOP */}
      <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-5 flex items-start gap-4 shrink-0 shadow-sm">
        <div className="bg-purple-500 text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-sm">
           <Target className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-purple-900 mb-2.5">战术使用指南 // Tactical SOP</h5>
          <div className="text-[13px] text-purple-800/90 leading-relaxed font-medium flex flex-col gap-1.5">
            <div><span className="font-black text-purple-600 mr-2">操作说明：</span>在上方选择战略阶段与闭环主题，在下方一键“生成今日长文并提纯”获取语料弹药。</div>
            <div><span className="font-black text-purple-600 mr-2">功能亮点：</span>硬核“通关锁”机制——口语不练满 10 轮、邮件拿不到 8 分，阵地将被强制死锁。</div>
            <div><span className="font-black text-purple-600 mr-2">生态定位：</span>【全局中枢】它设定的 Theme 将统治后续所有模块的场景；它抽取的弹药将直接输送至 Vocab 矩阵。</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col md:flex-row gap-8">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest font-black text-[#FF5722] mb-3">战略阶段 (Stage)</span>
          <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100">
            <button onClick={(e) => { e.stopPropagation(); handleStageChange('0-6'); }} className={`px-5 py-2.5 text-xs font-black tracking-widest uppercase rounded-lg transition-all ${stage === '0-6' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400 hover:text-[#202124]'}`}>0-6个月: 政商务</button>
            <button onClick={(e) => { e.stopPropagation(); handleStageChange('6-12'); }} className={`px-5 py-2.5 text-xs font-black tracking-widest uppercase rounded-lg transition-all ${stage === '6-12' ? 'bg-white text-[#202124] shadow-sm' : 'text-gray-400 hover:text-[#202124]'}`}>6-12个月: 全场景</button>
          </div>
        </div>
        <div className="flex flex-col flex-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-3">当前闭环主题 (Theme Gateway)</span>

          {themeSwitchError && (
            <div className="flex items-start gap-3 mb-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 animate-[fadeIn_0.2s_ease-out]">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
              <div className="flex-1">
                <p className="text-[11px] font-black uppercase tracking-widest text-red-600 mb-1">🚫 跨国高管拦截指令</p>
                <p className="text-xs font-medium leading-relaxed whitespace-pre-line">{themeSwitchError}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setThemeSwitchError(null); }}
                className="text-red-400 hover:text-red-600 text-lg leading-none font-bold shrink-0"
              >×</button>
            </div>
          )}

          <div className="flex items-center gap-3">
            <select
              value={theme}
              onChange={async (e) => {
                const target = e.target;
                const next = target.value;
                if (next === theme) return;
                setThemeSwitchError(null);
                try {
                  const m = await checkThemeMastery(theme);
                  if (!m.isMastered) {
                    target.value = theme;
                    setThemeSwitchError(
                      `当前阵地【${theme}】尚未被攻克！\n\n当前战绩：\n• 沉浸式口语沙盘：${m.oralCount}/10 轮\n• L3 书面评估最高分：${m.maxWriteScore}/10 分（及格线: 8分）\n\n请把当前阵地打透再拔营。`
                    );
                    return;
                  }
                  setTheme(next);
                  await setThemeFocus({ theme: next }).catch(() => {});
                } catch {
                  target.value = theme;
                  setThemeSwitchError('后端服务暂时不可访问，无法校验通关状态。\n请确认 super-agent-vocab.service 已启动（/api/theme/check-mastery）。');
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-[#f8f9fa] border border-gray-200 text-[#202124] text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-[#FF5722]"
            >
              {getThemeOptions(stage).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div
              className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all whitespace-nowrap border ${
                masteryData.isMastered
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}
            >
              {masteryData.isMastered ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              <span className="text-xs font-black uppercase tracking-widest">
                {masteryData.isMastered ? '已通关 (解锁下沉)' : '未达标 (强制锁定)'}
              </span>
            </div>
          </div>
          {!masteryData.isMastered && (
            <div className="text-[10px] text-gray-500 font-medium mt-2">
              当前通关进度：口语对抗 {masteryData.oralCount}/10 轮 | L3 书面最高分 {masteryData.maxWriteScore}/8 分
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#202124] rounded-[2rem] p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF5722]/10 rounded-full blur-3xl pointer-events-none"></div>
        <h4 className="text-sm font-black uppercase tracking-widest text-[#FF5722] mb-6 flex items-center">
          <Clock className="w-5 h-5 mr-3" /> 基础唤醒追踪 (Foundation)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-2 flex-shrink-0">发音纠正 (10min/Day)</span>
            <div className="flex-1 min-h-0">
              <PronunciationTrainer 
                initialNotes={pronunciationNotes} 
                onNotesChange={setPronunciationNotes} 
                userId="default-user" 
              />
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-2 flex-shrink-0">核心语法复健 (8-10个核心点)</span>
            <div className="flex-1 min-h-0">
              <GrammarPolishTrainer 
                initialNotes={grammarNotes} 
                onNotesChange={setGrammarNotes} 
                userId="default-user" 
              />
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="flex justify-between items-center mb-6">
          <h4 className="text-sm font-black uppercase tracking-widest text-[#202124] flex items-center">
            <Target className="w-5 h-5 mr-3 text-[#FF5722]" /> 弹药补给库 (Arsenal)
          </h4>
          <button 
            onClick={handleAutoGenerate} 
            disabled={isAutoGenerating} 
            className="flex items-center bg-[#202124] text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#FF5722] transition-colors disabled:opacity-50 cursor-pointer shadow-lg"
          >
            {isAutoGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> AI 执行中...</> : <><Zap className="w-4 h-4 mr-2 text-amber-400"/> AI 自动生成今日长文并提纯</>}
          </button>
        </div>
        
        {inlineNotice && noticeAnchor === 'dashboard' && (
          <div className={`absolute right-0 top-16 z-20 rounded-xl px-4 py-2 text-[11px] font-black tracking-widest uppercase shadow-lg border ${inlineNotice.tone === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : inlineNotice.tone === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-blue-500 text-white border-blue-400'}`}>
            {inlineNotice.text}
          </div>
        )}
        
        <MaterialUploader topicHint={theme} onExtractionSuccess={() => setActiveTab('vocab')} />
      </div>
    </div>
  );
}
