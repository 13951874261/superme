import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { fetchInsightFeedback, fetchDynamicInsightScenario } from '../../services/difyAPI';

const CATEGORIES = ['体制内', '外企', '通用逻辑'] as const;
type CategoryType = typeof CATEGORIES[number];

export default function ListenModule() {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('体制内');
  const [currentScenario, setCurrentScenario] = useState<string>('');
  const [isLoadingScenario, setIsLoadingScenario] = useState(false);

  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 动态获取题目的函数
  const loadNewScenario = useCallback(async (category: CategoryType) => {
    setIsLoadingScenario(true);
    setCurrentScenario(''); // 清空当前题目，准备显示 loading
    setFeedback(null); // 清空上次的解析
    setUserInput('');
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

  const handleSubmit = async () => {
    if (!userInput.trim()) return;
    
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const resultData = await fetchInsightFeedback({
        scenario_text: currentScenario,
        user_analysis: userInput
      });
      setFeedback(resultData);
    } catch (error) {
      console.error(error);
      setFeedback(`### ⚠️ 解析失败\n与导师系统连接中断，请检查网络。\n\n**详情**: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 p-4 animate-fade-in-up max-w-7xl mx-auto">
      {/* 左侧：情报与作答区 (明亮极简风) */}
      <div className="flex-1 bg-white shadow-xl rounded-2xl p-8 flex flex-col border border-gray-100 relative overflow-hidden">
        {/* 背景光晕装饰 */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50 -z-10 pointer-events-none transform translate-x-1/3 -translate-y-1/3"></div>
        
        <h2 className="text-2xl font-black mb-8 text-slate-800 flex items-center tracking-tight">
          <span className="bg-blue-600 text-white p-2 rounded-xl mr-3 shadow-md shadow-blue-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
          </span>
          人性解码与破绽识别沙盘
        </h2>
        
        {/* 场景分类卡片 (档案袋选项卡) */}
        <div className="flex space-x-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveCategory(tab)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                activeCategory === tab 
                  ? 'bg-slate-800 text-white shadow-lg shadow-slate-300 transform scale-105' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* 动态考题区 */}
        <div className="flex-none bg-slate-50 border-l-4 border-indigo-500 p-5 mb-6 text-gray-800 rounded-r-xl shadow-sm relative min-h-[140px]">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-xs text-indigo-600 uppercase tracking-widest flex items-center">
              <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2 animate-pulse"></span>
              拦截到的目标对话
            </span>
            <button 
              onClick={() => loadNewScenario(activeCategory)}
              disabled={isLoadingScenario}
              className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 mr-1 ${isLoadingScenario ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              请求新情报
            </button>
          </div>
          
          {isLoadingScenario ? (
            <div className="space-y-3 mt-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-5/6"></div>
              <div className="h-4 bg-slate-200 rounded w-full"></div>
              <div className="h-4 bg-slate-200 rounded w-2/3"></div>
            </div>
          ) : (
            <p className="text-base leading-relaxed font-medium text-slate-700 animate-fade-in-up whitespace-pre-wrap">
              {currentScenario}
            </p>
          )}
        </div>

        {/* 沉浸式作答区 */}
        <div className="flex flex-col flex-1 relative group mt-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1 transition-colors group-focus-within:text-blue-500">您的侧写笔记</label>
          <textarea
            className="flex-1 w-full bg-transparent border-0 border-b-2 border-slate-200 p-2 focus:ring-0 focus:border-blue-600 outline-none resize-none text-base text-slate-800 transition-colors"
            placeholder="敏锐地指出对方的弦外之音或逻辑破绽..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
          />
        </div>
        
        <button 
          className="mt-6 w-full bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-200 transition-all duration-300 disabled:bg-slate-300 disabled:cursor-not-allowed font-bold flex justify-center items-center text-sm tracking-wide"
          onClick={handleSubmit}
          disabled={isSubmitting || !userInput.trim() || isLoadingScenario}
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              建立多维侧写矩阵中...
            </>
          ) : '提交审判'}
        </button>
      </div>

      {/* 右侧：导师审判区 (极夜暗黑风 + Typography) */}
      <div className="flex-1 bg-slate-900 shadow-2xl rounded-2xl p-8 overflow-y-auto border border-slate-800 relative custom-scrollbar">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md pb-4 pt-1 border-b border-slate-800 mb-6 z-10 flex items-center justify-between">
           <h3 className="text-lg font-black text-blue-400 tracking-wider flex items-center">
             <span className="bg-slate-800 p-1.5 rounded-lg mr-3 text-blue-500 shadow-inner">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
             </span>
             大师评卷系统
           </h3>
           {isSubmitting && <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
        </div>

        {feedback ? (
          <div className="prose prose-sm prose-invert prose-blue max-w-none animate-fade-in-up prose-headings:text-blue-300 prose-a:text-blue-400 hover:prose-a:text-blue-300 prose-strong:text-blue-100">
            <ReactMarkdown>{feedback}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[calc(100%-80px)] text-slate-500 opacity-60">
            {isSubmitting ? (
              <div className="space-y-6 flex flex-col items-center">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 border-t-2 border-blue-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-2 border-r-2 border-red-500 rounded-full animate-spin" style={{ animationDirection: 'reverse' }}></div>
                  <div className="absolute inset-4 border-b-2 border-indigo-500 rounded-full animate-spin"></div>
                </div>
                <p className="font-mono text-xs tracking-widest text-blue-400 uppercase animate-pulse">Scanning Flaws...</p>
              </div>
            ) : (
              <>
                <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <p className="font-medium tracking-wide">等待数据接入，系统静默中...</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
