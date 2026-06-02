import React, { useState, useRef } from 'react';
import { PenTool, ChevronDown, BookOpen, AlertTriangle, ShieldCheck, Activity, Zap, FileText, CheckCircle2, Sparkles } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';

export default function WriteModule() {
  const [taskType, setTaskType] = useState('document_correction');
  const [originalText, setOriginalText] = useState('');
  const [additionalParams, setAdditionalParams] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [result, setResult] = useState<any>(null);

  // 原生 AudioContext 生成具有科技感的音效 (声)
  const playSound = (type: 'scan' | 'success') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'scan') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {
      console.log("Audio not supported");
    }
  };

  const handleAnalyze = async () => {
    if (!originalText.trim()) return;
    
    setIsProcessing(true);
    setResult(null);
    setScanStep(0);
    
    playSound('scan');
    const intervalId = setInterval(() => playSound('scan'), 800);

    const steps = [
      "初始化决策文治核心引擎...",
      "正在执行浅层合规与格式特征提取...",
      "正在深入剖析逻辑架构与因果链条...",
      "重组深层商业价值与政治站位...",
      "正在生成高维重构方案..."
    ];
    
    let stepIdx = 0;
    const stepInterval = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) setScanStep(stepIdx);
    }, 1200);

    try {
      const response = await fetch(`${import.meta.env.VITE_DIFY_API_BASE_URL}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_DIFY_WRITE_GOVERNANCE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: {
            task_type: taskType,
            original_text: originalText,
            additional_params: additionalParams
          },
          response_mode: "blocking",
          user: "user-write-gov"
        })
      });

      const data = await response.json();
      
      if (data && data.data && data.data.outputs && data.data.outputs.analysis_result) {
         try {
            const parsed = JSON.parse(data.data.outputs.analysis_result);
            setResult(parsed);
            playSound('success');
         } catch(e) {
            setResult({ raw: data.data.outputs.analysis_result });
            playSound('success');
         }
      } else {
         throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error(error);
      setResult({ error: "系统分析失败，请检查网络或 API Key。" });
    } finally {
      clearInterval(intervalId);
      clearInterval(stepInterval);
      setIsProcessing(false);
    }
  };

  const renderResult = () => {
    if (!result) return null;
    if (result.error) return (
      <div className="mt-8 animate-[fade-in_0.5s_ease-out] flex items-center gap-3 bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-600 p-5 rounded-2xl shadow-sm">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <span className="font-medium text-sm">{result.error}</span>
      </div>
    );

    if (taskType === 'document_correction') {
      return (
        <div className="space-y-6 mt-10 animate-[fade-in_0.5s_ease-out]">
           {/* Level 1 */}
           <div className="relative group">
             <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-slate-50 rounded-[2rem] transform transition-transform group-hover:scale-[1.01]" />
             <div className="relative bg-white/60 backdrop-blur-md border border-white/80 rounded-[2rem] p-7 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
               <div className="flex items-center text-slate-700 font-bold tracking-widest mb-4 text-xs uppercase">
                  <span className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center mr-3 text-[10px] font-black shadow-inner">L1</span>
                  浅层扫描 / 格式与合规
               </div>
               <p className="text-slate-600 text-[15px] leading-relaxed whitespace-pre-wrap pl-11">{result.level_1}</p>
             </div>
           </div>

           {/* Level 2 */}
           <div className="relative group">
             <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-amber-50 rounded-[2rem] transform transition-transform group-hover:scale-[1.01]" />
             <div className="relative bg-white/60 backdrop-blur-md border border-orange-100/50 rounded-[2rem] p-7 shadow-[0_4px_20px_rgba(255,138,101,0.05)]">
               <div className="flex items-center text-orange-600 font-bold tracking-widest mb-4 text-xs uppercase">
                  <span className="w-8 h-8 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center mr-3 text-[10px] font-black shadow-inner">L2</span>
                  中层透视 / 逻辑与结构
               </div>
               <p className="text-orange-900/80 text-[15px] leading-relaxed whitespace-pre-wrap pl-11">{result.level_2}</p>
             </div>
           </div>

           {/* Level 3 */}
           <div className="relative group">
             <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-[2rem] transform transition-transform group-hover:scale-[1.01] shadow-2xl" />
             <div className="relative rounded-[2rem] p-7 overflow-hidden border border-slate-700/50">
               {/* 装饰光效 */}
               <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-500/20 to-rose-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />
               <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-[60px] translate-y-1/3 -translate-x-1/3" />
               
               <div className="flex items-center text-white font-bold tracking-widest mb-5 text-xs uppercase relative z-10">
                  <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-rose-500 flex items-center justify-center mr-3 text-[10px] font-black shadow-[0_0_15px_rgba(249,115,22,0.5)]">L3</span>
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">深层重构 / 战略与政治站位</span>
               </div>
               
               <div className="relative z-10 pl-11">
                 <div className="absolute left-[26px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-orange-500 to-rose-500 rounded-full opacity-80" />
                 <p className="text-slate-300 text-[15px] leading-relaxed whitespace-pre-wrap">
                   {result.level_3}
                 </p>
               </div>
             </div>
           </div>
        </div>
      );
    }

    if (taskType === 'business_writing') {
      return (
        <div className="space-y-6 mt-10 animate-[fade-in_0.5s_ease-out]">
           <div className="relative rounded-[2rem] p-[2px] bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 shadow-xl">
             <div className="bg-slate-900 rounded-[calc(2rem-2px)] p-7 h-full relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
               <h4 className="text-[11px] font-black tracking-[0.2em] text-orange-400 uppercase mb-4 flex items-center">
                 <Zap className="w-4 h-4 mr-2 text-orange-500"/> 
                 极限压缩输出 (Compressed)
               </h4>
               <p className="text-white/90 text-[15px] leading-relaxed whitespace-pre-wrap pl-6 relative">
                 <span className="absolute left-0 top-1 bottom-1 w-1 bg-gradient-to-b from-orange-500 to-rose-500 rounded-full" />
                 {result.compressed_text}
               </p>
             </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-white/60 backdrop-blur-xl border border-slate-200/60 rounded-[2rem] p-7 shadow-sm hover:shadow-md transition-shadow">
                <h4 className="text-[11px] font-black text-slate-500 mb-3 uppercase tracking-[0.2em] flex items-center">
                  <Activity className="w-3.5 h-3.5 mr-2" />
                  语体分寸点评
                </h4>
                <p className="text-slate-700 text-[14px] leading-relaxed">{result.tone_evaluation}</p>
             </div>
             <div className="bg-gradient-to-br from-orange-50/80 to-rose-50/80 backdrop-blur-xl border border-orange-100 rounded-[2rem] p-7 shadow-sm hover:shadow-md transition-shadow">
                <h4 className="text-[11px] font-black text-orange-600 mb-3 uppercase tracking-[0.2em] flex items-center">
                  <Sparkles className="w-3.5 h-3.5 mr-2" />
                  核心技巧点拨
                </h4>
                <p className="text-orange-900/80 text-[14px] leading-relaxed">{result.skill_point}</p>
             </div>
           </div>
        </div>
      );
    }

    if (taskType === 'value_proposal') {
      return (
        <div className="space-y-6 mt-10 animate-[fade-in_0.5s_ease-out]">
           <div className="relative overflow-hidden bg-red-50/50 backdrop-blur-sm border border-red-100 rounded-[2rem] p-7">
             <div className="absolute top-0 right-0 w-24 h-24 bg-red-200/20 rounded-full blur-2xl" />
             <h4 className="text-[11px] font-black tracking-[0.2em] text-red-500 uppercase mb-3 flex items-center">
               <AlertTriangle className="w-4 h-4 mr-2"/> 
               纯行政视角局限
             </h4>
             <p className="text-red-900/80 text-[15px] leading-relaxed pl-6 relative">
               <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-red-200 rounded-full" />
               {result.admin_flaws}
             </p>
           </div>
           
           <div className="bg-slate-900 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden border border-slate-800">
             <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-[60px]" />
             
             <h4 className="text-[11px] font-black tracking-[0.2em] text-emerald-400 uppercase mb-5 flex items-center">
               <ShieldCheck className="w-4 h-4 mr-2"/> 
               商业价值提炼 (Value Extraction)
             </h4>
             <p className="text-slate-300 text-[15px] leading-relaxed border-l-2 border-emerald-500/50 pl-5 mb-8">
               {result.value_extraction}
             </p>
             
             <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent mb-8" />
             
             <h4 className="text-[11px] font-black tracking-[0.2em] text-white/80 uppercase mb-5 flex items-center">
               <FileText className="w-4 h-4 mr-2 text-slate-400"/>
               高阶业务型提案范本
             </h4>
             <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl">
               <p className="text-slate-300 text-[15px] leading-relaxed whitespace-pre-wrap">
                 {result.business_proposal}
               </p>
             </div>
           </div>
        </div>
      );
    }

    // Fallback for raw text
    return <div className="mt-8 bg-slate-50 border border-slate-200 p-6 rounded-[2rem] text-sm whitespace-pre-wrap text-slate-600">{result.raw || JSON.stringify(result, null, 2)}</div>;
  };

  return (
    <ModuleWrapper 
      title="立言 ｜ 决策文治与价值提炼" 
      icon={<PenTool className="w-8 h-8" strokeWidth={2.5} />}
      description="打破行政局限，实现三级纵深批改与商业价值转化引擎。"
    >
      <style>{`
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          50% { transform: translateY(400px); }
          100% { transform: translateY(-100%); }
        }
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      {/* Cyberpunk Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl animate-[fade-in_0.3s_ease-out]">
          <div className="relative w-full max-w-lg bg-slate-900 border border-orange-500/30 rounded-[2.5rem] p-12 overflow-hidden shadow-[0_0_100px_rgba(249,115,22,0.15)]">
            <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent shadow-[0_0_30px_#f97316] animate-[scanline_2.5s_ease-in-out_infinite]" />
            
            <div className="flex flex-col items-center justify-center text-center relative z-10">
              <div className="relative mb-10">
                <div className="absolute inset-0 bg-orange-500 blur-2xl opacity-20 animate-pulse" />
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center border border-orange-500/30 relative">
                  <Activity className="w-10 h-10 text-orange-500 animate-pulse" />
                </div>
              </div>
              
              <h3 className="text-xl font-black text-white mb-6 tracking-[0.3em] uppercase bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-rose-400">
                Deep Analysis
              </h3>
              
              <div className="h-10 flex items-center justify-center px-6 py-2 bg-slate-800/50 rounded-full border border-slate-700">
                <p className="text-orange-400/90 font-mono text-[13px] tracking-wider">
                  &gt; {["初始化决策文治引擎...", "提取浅层合规特征...", "重组逻辑链条与因果网...", "注入深层商业视角与战略维度...", "生成全息重构方案..."][scanStep]}
                  <span className="animate-pulse ml-2 inline-block w-1.5 h-3.5 bg-orange-500 align-middle"></span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-0">
        
        {/* Left Panel: Configuration */}
        <aside className="lg:col-span-4 flex flex-col gap-5">
          <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            <h4 className="text-[10px] font-black tracking-[0.25em] text-orange-500 uppercase flex items-center mb-8 relative z-10">
              <Activity className="w-3.5 h-3.5 mr-3" />
              Engine Config
            </h4>
            
            <div className="space-y-8 relative z-10">
              <div>
                <label className="block text-[11px] text-slate-400 uppercase tracking-widest mb-4 font-bold">Analysis Mode</label>
                <div className="space-y-3">
                  {[
                    { id: 'document_correction', label: '三级纵深批阅', icon: <ShieldCheck className="w-4 h-4"/>, desc: '排版 / 逻辑 / 战略' },
                    { id: 'business_writing', label: '商务行文与压缩', icon: <FileText className="w-4 h-4"/>, desc: '语体点评 / 极限压缩' },
                    { id: 'value_proposal', label: '业务提案与包装', icon: <Zap className="w-4 h-4"/>, desc: '去行政化 / 商业赋能' }
                  ].map(mode => {
                    const isActive = taskType === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => setTaskType(mode.id)}
                        className={`w-full flex items-center p-4 rounded-[1.5rem] transition-all duration-300 border ${
                          isActive 
                            ? 'bg-gradient-to-r from-orange-500/10 to-rose-500/10 border-orange-500/30 shadow-inner' 
                            : 'bg-slate-800/50 border-transparent text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 transition-colors ${
                          isActive ? 'bg-orange-500/20 text-orange-500' : 'bg-slate-700/50 text-slate-500'
                        }`}>
                          {mode.icon}
                        </div>
                        <div className="text-left">
                          <div className={`text-sm font-bold tracking-wide mb-1 transition-colors ${isActive ? 'text-white' : 'text-slate-300'}`}>{mode.label}</div>
                          <div className={`text-[10px] uppercase tracking-wider ${isActive ? 'text-orange-400/80' : 'text-slate-500'}`}>{mode.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {taskType === 'business_writing' && (
                <div className="animate-[fade-in_0.3s_ease-out] bg-slate-800/50 p-5 rounded-[1.5rem] border border-slate-700/50">
                  <label className="block text-[10px] text-orange-400 uppercase tracking-widest mb-3 font-bold flex items-center">
                    <Zap className="w-3 h-3 mr-2" />
                    极限约束参数 (选填)
                  </label>
                  <input 
                    type="text" 
                    value={additionalParams}
                    onChange={(e) => setAdditionalParams(e.target.value)}
                    placeholder="e.g. 极限压缩至 50 字..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3.5 text-sm text-white focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all placeholder-slate-600"
                  />
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Right Panel: Editor & Results */}
        <section className="lg:col-span-8 flex flex-col">
          <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-8 md:p-10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-white flex-1">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <div className="flex items-center">
                <div className="w-2 h-6 bg-gradient-to-b from-orange-500 to-rose-500 rounded-full mr-4" />
                <label className="text-xs font-black text-slate-800 tracking-[0.2em] uppercase">战略起草控制台</label>
              </div>
              <span className="flex items-center text-[10px] bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full font-bold border border-emerald-100 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                Dify Engine Ready
              </span>
            </div>
            
            <div className="relative group mb-8">
              <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-slate-100/50 rounded-[2rem] transform transition-transform group-focus-within:scale-[1.01]" />
              <textarea 
                value={originalText}
                onChange={(e) => setOriginalText(e.target.value)}
                rows={8} 
                className="relative w-full bg-transparent p-7 text-[15px] outline-none resize-none leading-relaxed text-slate-700 placeholder-slate-400 font-medium transition-all" 
                placeholder="在此输入您的草稿：无论是需要纵深透视的体制内公文，还是亟待提炼商业价值的行政邮件..."
              />
            </div>
            
            <button 
              onClick={handleAnalyze}
              disabled={isProcessing || !originalText.trim()}
              className="group relative w-full overflow-hidden rounded-full disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-600 via-rose-500 to-orange-600 bg-[length:200%_auto] animate-[gradient_3s_ease_infinite] transition-opacity group-hover:opacity-90" />
              <div className="relative flex items-center justify-center text-white text-sm py-4.5 tracking-[0.25em] uppercase font-black transition-transform group-hover:scale-[1.02]">
                <Activity className="w-4 h-4 mr-3" />
                启动全息分析引擎
              </div>
            </button>

            {/* Dynamic Results Area */}
            {renderResult()}
          </div>
        </section>
      </div>
    </ModuleWrapper>
  );
}
