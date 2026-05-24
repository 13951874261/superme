import React, { useState } from 'react';
import { Wine, Globe, Compass, Flame, Trophy, CheckCircle2, AlertTriangle, Activity, RefreshCw } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';

export default function EntertainmentModule() {
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [difyFeedback, setDifyFeedback] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 场景库配置（映射业务需求）
  const scenarios = [
    { title: "政商务饭局与敬酒", icon: <Wine size={20} />, type: "体制内规范", desc: "主客敬酒顺位、敬酒祝词禁忌与防线应对" },
    { title: "茶席与茶礼社交", icon: <Compass size={20} />, type: "体制内规范", desc: "扣指礼深层含义、茶席分寸与隐秘心理表达" },
    { title: "红酒与雪茄品鉴", icon: <Flame size={20} />, type: "高端商务", desc: "红酒醒酒与捏杯分寸、雪茄吸食礼仪与避坑指南" },
    { title: "跨文化宴请(西方)", icon: <Globe size={20} />, type: "跨文化界限", desc: "西餐刀叉礼仪、桌位尊卑与跨文化禁忌应对" },
    { title: "跨文化宴请(中东东南亚)", icon: <Globe size={20} />, type: "跨文化界限", desc: "手部与餐具使用规范、宗教与文化避坑指南" },
    { title: "高尔夫轻商务", icon: <Trophy size={20} />, type: "高端商务", desc: "高尔夫礼仪、球场规则、打球中分寸与避坑指南" },
  ];

  // “声光电”音频触发器 - 原生 Web Audio API 合成奢华动感音效
  const playSound = (type: 'scan' | 'success' | 'alert') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const currentTime = audioCtx.currentTime;

      if (type === 'scan') {
        // 科幻雷达扫描声：快速的高频短促脉冲
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, currentTime + 0.15);
        
        gainNode.gain.setValueAtTime(0.04, currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.15);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(currentTime + 0.15);
      } else if (type === 'success') {
        // 体面过关：清脆的水晶钟琴三和弦 (C5, E5, G5, C6) 顺次播放
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, currentTime + idx * 0.08);
          
          gainNode.gain.setValueAtTime(0, currentTime + idx * 0.08);
          gainNode.gain.linearRampToValueAtTime(0.12, currentTime + idx * 0.08 + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + idx * 0.08 + 0.5);
          
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          
          osc.start(currentTime + idx * 0.08);
          osc.stop(currentTime + idx * 0.08 + 0.5);
        });
      } else if (type === 'alert') {
        // 触碰禁忌：重低音警报音效加高频刺耳警示
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNode1 = audioCtx.createGain();
        const gainNode2 = audioCtx.createGain();
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(120, currentTime);
        osc1.frequency.linearRampToValueAtTime(80, currentTime + 0.4);
        
        gainNode1.gain.setValueAtTime(0.15, currentTime);
        gainNode1.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.4);
        
        osc1.connect(gainNode1);
        gainNode1.connect(audioCtx.destination);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(800, currentTime);
        osc2.frequency.linearRampToValueAtTime(400, currentTime + 0.4);
        
        gainNode2.gain.setValueAtTime(0.08, currentTime);
        gainNode2.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.4);
        
        osc2.connect(gainNode2);
        gainNode2.connect(audioCtx.destination);
        
        osc1.start();
        osc2.start();
        osc1.stop(currentTime + 0.4);
        osc2.stop(currentTime + 0.4);
      }
    } catch (e) {
      console.warn("Web Audio not supported:", e);
    }
  };

  const handleAnalyze = async () => {
    if (!response.trim() || !activeTask) return;
    
    setIsVerifying(true);
    setDifyFeedback(null);
    setScanStep(0);
    
    playSound('scan');
    const intervalId = setInterval(() => playSound('scan'), 800);

    const stepInterval = setInterval(() => {
      setScanStep(prev => (prev + 1) % 5);
    }, 1000);

    try {
      const apiKey = import.meta.env.VITE_DIFY_HIGH_AESTHETICS_KEY;
      const apiBaseUrl = import.meta.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
      
      const res = await fetch(`${apiBaseUrl}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: {
            scene_category: activeTask,
            user_response: response
          },
          response_mode: "blocking",
          user: "aesthetic_user_01"
        })
      });

      const data = await res.json();
      
      if (data && data.data && data.data.outputs && data.data.outputs.json_result) {
        let rawOutput = data.data.outputs.json_result;
        // 清理潜在的大括号包裹杂质
        if (typeof rawOutput === 'string') {
          rawOutput = rawOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        
        const parsedOutputs = typeof rawOutput === 'object' ? rawOutput : JSON.parse(rawOutput); 
        setDifyFeedback(parsedOutputs);
        setIsModalOpen(true);

        if (parsedOutputs.is_passed) {
          playSound('success');
        } else {
          playSound('alert');
        }
      } else {
        throw new Error("工作流响应格式不符合预期");
      }
    } catch (e) {
      console.error("研判系统异常:", e);
      const fallbackFeedback = {
        feedback: "系统链接中断，已启用本地离线研判拦截。请确保在社交场域移步攀谈，避免隔人或隔座隔桌敬酒；对于红酒及雪茄，宜手捏杯底避免影响酒温。礼仪不仅是形式，更是对他人的尊重。",
        score: 6,
        is_passed: false
      };
      setDifyFeedback(fallbackFeedback);
      setIsModalOpen(true);
      playSound('alert');
    } finally {
      clearInterval(intervalId);
      clearInterval(stepInterval);
      setIsVerifying(false);
    }
  };

  return (
    <ModuleWrapper 
      title="娱乐 ｜ 高阶审美与阶层软实力" 
      icon={<Wine className="w-8 h-8" strokeWidth={2.5} />}
      description="核心定位：高端社交技能与隐形阶层审美的修缮池。以极致的分寸掌控力，将社交打造为强力的跃迁资本。"
    >
      <style>{`
        @keyframes scanline-y {
          0% { transform: translateY(-100%); }
          50% { transform: translateY(450px); }
          100% { transform: translateY(-100%); }
        }
        @keyframes angle-rotate {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes modal-scale {
          0% { opacity: 0; transform: scale(0.9) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes border-glow-run {
          0% { border-color: rgba(99, 102, 241, 0.2); }
          50% { border-color: rgba(99, 102, 241, 0.6); }
          100% { border-color: rgba(99, 102, 241, 0.2); }
        }
        @keyframes radar-pulse-wave {
          0% { transform: scale(0.95); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      {/* Dify 专家分析系统覆盖遮罩 */}
      {isVerifying && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-xl">
          <div className="relative w-full max-w-lg bg-zinc-900 border border-indigo-500/30 rounded-[2.5rem] p-12 overflow-hidden shadow-[0_0_100px_rgba(99,102,241,0.15)] mx-4">
            <div className="absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_30px_#6366f1] animate-[scanline-y_3s_ease-in-out_infinite]" />
            
            <div className="flex flex-col items-center justify-center text-center relative z-10">
              <div className="relative mb-10">
                <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse" />
                <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center border border-indigo-500/30 relative">
                  <Activity className="w-10 h-10 text-indigo-500 animate-pulse" />
                </div>
              </div>
              
              <h3 className="text-xl font-black text-white mb-6 tracking-[0.3em] uppercase bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400">
                AESTHETICS ENGINE
              </h3>
              
              <div className="h-12 flex items-center justify-center px-6 py-2 bg-zinc-800/50 rounded-full border border-zinc-700">
                <p className="text-indigo-400 font-mono text-[13px] tracking-wider">
                  &gt; {["初始化高阶审美引擎...", "读取社交实景上下文...", "检索跨文化礼仪库...", "评估决策站位与阶层分寸...", "生成研判评分与避坑指南..."][scanStep]}
                  <span className="animate-pulse ml-2 inline-block w-1.5 h-3.5 bg-indigo-500 align-middle"></span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 主面板容器：奢华暗色沙盘舱 */}
      <div className="w-full bg-[#0B0D13] text-zinc-100 rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-zinc-800/80 overflow-hidden relative">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
          {/* 左侧 70% 场景矩阵 */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h3 className="text-lg font-bold text-white tracking-wide">社交与跨文化美学情境</h3>
                <p className="text-xs text-zinc-500 mt-1">选择对应场域进入推演，系统将结合 Dify 引擎分析您的社交站位与避坑水平</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scenarios.map((scenario) => {
                const isActive = activeTask === scenario.title;
                return (
                  <div 
                    key={scenario.title}
                    onClick={() => {
                      setActiveTask(scenario.title);
                      setResponse("");
                    }}
                    className={`p-5 rounded-2xl cursor-pointer border transition-all duration-300 flex flex-col gap-4 relative group ${
                      isActive 
                        ? 'border-indigo-500/50 bg-indigo-950/20 shadow-[0_0_30px_rgba(99,102,241,0.15)]' 
                        : 'border-zinc-800/60 bg-zinc-900/20 hover:border-zinc-700 hover:bg-zinc-900/40'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className={`p-2.5 rounded-xl transition-colors ${isActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700'}`}>
                        {scenario.icon}
                      </div>
                      <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 bg-zinc-800/60 text-zinc-500 rounded border border-zinc-700/30">
                        {scenario.type}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">{scenario.title}</h4>
                      <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{scenario.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右侧 30% 实景推演面板 */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="h-full bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 rounded-3xl p-6 flex flex-col justify-between min-h-[350px]">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                  <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">实景研判控制台</label>
                </div>

                {activeTask ? (
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-indigo-400 font-bold block mb-1">当前情境：</span>
                      <span className="text-sm text-zinc-200 font-medium block">{activeTask}</span>
                    </div>
                    
                    <div className="relative">
                      <textarea 
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        rows={7}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs leading-relaxed text-zinc-200 placeholder-zinc-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none resize-none transition-all"
                        placeholder="在此输入您的应对招数、开场话术、敬酒祝词或举措逻辑。切记阶层分寸感，避开低级雷区..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 border border-dashed border-zinc-800 rounded-2xl text-center p-4">
                    <Wine className="w-8 h-8 text-zinc-700 mb-2 animate-bounce" />
                    <p className="text-xs text-zinc-500">请先在左侧选择一个要推演的跨文化/政商务情境</p>
                  </div>
                )}
              </div>

              <button 
                onClick={handleAnalyze}
                disabled={isVerifying || !activeTask || !response.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3.5 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none mt-4"
              >
                启动社交指数量化研判
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* “声光电”超级华丽研判弹窗 (Modal) */}
      {isModalOpen && difyFeedback && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 backdrop-blur-xl p-4">
          <div 
            className={`relative w-full max-w-lg rounded-[2.5rem] p-[2px] shadow-2xl animate-[modal-scale_0.4s_ease-out] ${
              difyFeedback.is_passed 
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 shadow-[0_0_60px_rgba(16,185,129,0.25)]' 
                : 'bg-gradient-to-r from-rose-500 via-red-400 to-rose-500 shadow-[0_0_60px_rgba(244,63,94,0.25)]'
            }`}
          >
            {/* 渐变流转大光斑背景 (光) */}
            <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
              <div className={`absolute -top-32 -left-32 w-64 h-64 rounded-full blur-[80px] opacity-40 animate-pulse ${
                difyFeedback.is_passed ? 'bg-emerald-500' : 'bg-rose-500'
              }`} />
              <div className={`absolute -bottom-32 -right-32 w-64 h-64 rounded-full blur-[80px] opacity-30 animate-pulse ${
                difyFeedback.is_passed ? 'bg-teal-500' : 'bg-red-500'
              }`} />
            </div>

            <div className="bg-zinc-950 text-zinc-100 rounded-[calc(2.5rem-2px)] p-8 md:p-10 relative z-10 overflow-hidden">
              {/* 头部状态与电波纹 */}
              <div className="flex flex-col items-center text-center mb-8 relative">
                <div className="relative mb-5">
                  {/* 雷达波纹动画 (电) */}
                  <div className={`absolute inset-0 rounded-full animate-[radar-pulse-wave_2s_infinite] border ${
                    difyFeedback.is_passed ? 'border-emerald-500' : 'border-rose-500'
                  }`} />
                  <div className={`absolute inset-0 rounded-full animate-[radar-pulse-wave_2s_infinite_0.7s] border ${
                    difyFeedback.is_passed ? 'border-teal-500' : 'border-red-500'
                  }`} />
                  
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center border relative z-10 shadow-inner ${
                    difyFeedback.is_passed 
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400' 
                      : 'bg-rose-950/60 border-rose-500/50 text-rose-400'
                  }`}>
                    {difyFeedback.is_passed ? <CheckCircle2 className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
                  </div>
                </div>

                <h3 className={`text-xl font-black tracking-[0.2em] uppercase ${
                  difyFeedback.is_passed ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {difyFeedback.is_passed ? "体面过关 (Passed)" : "触碰禁忌 (Failed)"}
                </h3>
                <span className="text-[10px] text-zinc-500 font-mono tracking-widest mt-1">SOCIAL INTELLIGENCE VERDICT</span>
              </div>

              {/* 分数显示 (光) */}
              <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800/80 rounded-2xl px-6 py-4 mb-6">
                <span className="text-xs font-bold text-zinc-400">综合决策得分：</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-black font-mono tracking-tighter ${
                    difyFeedback.is_passed ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                  }`}>
                    {difyFeedback.score}
                  </span>
                  <span className="text-zinc-600 text-xs">/ 10</span>
                </div>
              </div>

              {/* 点评与避坑指南 (电) */}
              <div className="relative bg-zinc-900/30 border border-zinc-800 rounded-2xl p-5 mb-8">
                <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full bg-gradient-to-b from-indigo-500 to-violet-500" />
                <h4 className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-2">避坑指南与阶层解读</h4>
                <p className="text-xs md:text-sm text-zinc-300 leading-relaxed font-medium">
                  {difyFeedback.feedback}
                </p>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className={`w-full font-bold text-xs py-4 px-6 rounded-xl transition-all tracking-wider text-center cursor-pointer ${
                    difyFeedback.is_passed
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                  }`}
                >
                  {difyFeedback.is_passed ? "收入社交智库" : "重构应对策略"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ModuleWrapper>
  );
}
