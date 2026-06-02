import React, { useState } from 'react';
import { BookOpen, FileText, BarChart3, Mail, LibraryBig, Loader2, Sparkles } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import { runCognitivePenetrationEngine, CognitivePenetrationInput, CognitivePenetrationResult } from '../../services/difyAPI';
import { playError } from '../../utils/soundEffects';

export default function ReadModule() {
  const [activeTab, setActiveTab] = useState<CognitivePenetrationInput['scene_type']>('policy');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CognitivePenetrationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  const handlePenetrate = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setResult(null);
    setErrorMsg('');
    try {
      const res = await runCognitivePenetrationEngine({ scene_type: activeTab, text_input: inputText });
      setResult(res);
    } catch (err: any) {
      console.error(err);
      playError();
      setErrorMsg(err.message || '穿透解码失败，请检查网络或后端服务');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setTimeout(() => setErrorMsg(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const renderResultGrid = () => {
    if (!result && !isLoading) {
      return (
        <div className="text-center py-10 text-gray-400 font-medium">
          请在上方输入需要穿透的原始素材，并点击“启动 AI 穿透解码”。
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-[#FF5722]">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="font-bold tracking-widest uppercase text-sm">Cognitive Penetration in Progress...</p>
        </div>
      );
    }

    if (activeTab === 'policy') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Card 1 */}
           <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
             <span className="text-xs text-gray-400 font-bold mb-3 tracking-widest uppercase">01 / 表面结论</span>
             <div className="w-full bg-[#f8f9fa] rounded-2xl p-4 text-sm text-[#202124] font-medium min-h-[100px] whitespace-pre-wrap">{result?.surface_conclusion}</div>
           </div>
           {/* Card 2 */}
           <div className="bg-white rounded-3xl p-6 shadow-[0_4px_12px_rgba(255,87,34,0.05)] border border-[#FF5722]/10 flex flex-col hover:shadow-[0_8px_20px_rgba(255,87,34,0.1)] transition-shadow">
             <span className="text-xs text-[#FF5722] font-black mb-3 tracking-widest uppercase">02 / 隐藏意图与导向</span>
             <div className="w-full bg-[#fff3e0] rounded-2xl p-4 text-sm text-[#d84315] font-bold min-h-[100px] whitespace-pre-wrap">{result?.hidden_intent}</div>
           </div>
           {/* Card 3 */}
           <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
             <span className="text-xs text-gray-400 font-bold mb-3 tracking-widest uppercase">03 / 对行业工作的影响</span>
             <div className="w-full bg-[#f8f9fa] rounded-2xl p-4 text-sm text-[#202124] font-medium min-h-[100px] whitespace-pre-wrap">{result?.industry_impact}</div>
           </div>
           {/* Card 4 */}
           <div className="bg-[#202124] rounded-3xl p-6 shadow-lg flex flex-col transition-shadow">
             <span className="text-xs text-gray-400 font-bold mb-3 tracking-widest uppercase">04 / 潜在风险与红利</span>
             <div className="w-full bg-[#303134] rounded-2xl p-4 text-sm text-white font-medium min-h-[100px] whitespace-pre-wrap">{result?.risks_and_opportunities}</div>
           </div>
        </div>
      );
    }
    
    if (activeTab === 'report') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
             <span className="text-xs text-gray-400 font-bold mb-3 tracking-widest uppercase">01 / 核心商业模式分析</span>
             <div className="w-full bg-[#f8f9fa] rounded-2xl p-4 text-sm text-[#202124] font-medium min-h-[100px] whitespace-pre-wrap">{result?.business_model}</div>
           </div>
           <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
             <span className="text-xs text-gray-400 font-bold mb-3 tracking-widest uppercase">02 / 海外市场/用户痛点</span>
             <div className="w-full bg-[#f8f9fa] rounded-2xl p-4 text-sm text-[#202124] font-medium min-h-[100px] whitespace-pre-wrap">{result?.market_pain_points}</div>
           </div>
           <div className="bg-white rounded-3xl p-6 shadow-[0_4px_12px_rgba(255,87,34,0.05)] border border-[#FF5722]/10 flex flex-col hover:shadow-[0_8px_20px_rgba(255,87,34,0.1)] transition-shadow md:col-span-2">
             <span className="text-xs text-[#FF5722] font-black mb-3 tracking-widest uppercase">03 / 盈利逻辑破绽</span>
             <div className="w-full bg-[#fff3e0] rounded-2xl p-4 text-sm text-[#d84315] font-bold min-h-[100px] whitespace-pre-wrap">{result?.profit_logic_flaws}</div>
           </div>
           <div className="bg-[#202124] rounded-3xl p-6 shadow-lg flex flex-col transition-shadow md:col-span-2">
             <span className="text-xs text-gray-400 font-bold mb-3 tracking-widest uppercase">04 / 信息溯源训练 (防伪指引)</span>
             <div className="w-full bg-[#303134] rounded-2xl p-4 text-sm text-white font-medium min-h-[100px] whitespace-pre-wrap">{result?.traceability_training}</div>
           </div>
        </div>
      );
    }

    if (activeTab === 'email') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white rounded-3xl p-6 shadow-[0_4px_12px_rgba(255,87,34,0.05)] border border-[#FF5722]/10 flex flex-col hover:shadow-[0_8px_20px_rgba(255,87,34,0.1)] transition-shadow">
             <span className="text-xs text-[#FF5722] font-black mb-3 tracking-widest uppercase">01 / 剥离真实立场与因果</span>
             <div className="w-full bg-[#fff3e0] rounded-2xl p-4 text-sm text-[#d84315] font-bold min-h-[150px] whitespace-pre-wrap">{result?.stripped_logic}</div>
           </div>
           <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
             <span className="text-xs text-gray-400 font-bold mb-3 tracking-widest uppercase">02 / 立场反转练习</span>
             <div className="w-full bg-[#f8f9fa] rounded-2xl p-4 text-sm text-[#202124] font-medium min-h-[150px] whitespace-pre-wrap">{result?.stance_reversal}</div>
           </div>
           <div className="bg-[#202124] rounded-3xl p-6 shadow-lg flex flex-col transition-shadow">
             <span className="text-xs text-gray-400 font-bold mb-3 tracking-widest uppercase">03 / 精准反向追问</span>
             <div className="w-full bg-[#303134] rounded-2xl p-4 text-sm text-white font-medium min-h-[150px] whitespace-pre-wrap">{result?.counter_questions}</div>
           </div>
        </div>
      );
    }

    if (activeTab === 'book') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
             <span className="text-xs text-gray-400 font-bold mb-3 tracking-widest uppercase">01 / 思考亮点提炼</span>
             <div className="w-full bg-[#f8f9fa] rounded-2xl p-4 text-sm text-[#202124] font-medium min-h-[150px] whitespace-pre-wrap">{result?.thought_highlights}</div>
           </div>
           <div className="bg-white rounded-3xl p-6 shadow-[0_4px_12px_rgba(255,87,34,0.05)] border border-[#FF5722]/10 flex flex-col hover:shadow-[0_8px_20px_rgba(255,87,34,0.1)] transition-shadow">
             <span className="text-xs text-[#FF5722] font-black mb-3 tracking-widest uppercase">02 / 逻辑漏洞 / 局限性</span>
             <div className="w-full bg-[#fff3e0] rounded-2xl p-4 text-sm text-[#d84315] font-bold min-h-[150px] whitespace-pre-wrap">{result?.logic_flaws}</div>
           </div>
           <div className="bg-[#202124] rounded-3xl p-6 shadow-lg flex flex-col transition-shadow">
             <span className="text-xs text-gray-400 font-bold mb-3 tracking-widest uppercase">03 / 高阶职场应用启示</span>
             <div className="w-full bg-[#303134] rounded-2xl p-4 text-sm text-white font-medium min-h-[150px] whitespace-pre-wrap">{result?.workplace_application}</div>
           </div>
        </div>
      );
    }
    
    return null;
  };

  const tabs: Array<{ id: CognitivePenetrationInput['scene_type'], label: string, icon: React.ReactNode }> = [
    { id: 'policy', label: '政策精神', icon: <FileText className="w-4 h-4 mr-2" /> },
    { id: 'report', label: '财报研判', icon: <BarChart3 className="w-4 h-4 mr-2" /> },
    { id: 'email', label: '外企邮件', icon: <Mail className="w-4 h-4 mr-2" /> },
    { id: 'book', label: '书目提纯', icon: <LibraryBig className="w-4 h-4 mr-2" /> },
  ];

  return (
    <ModuleWrapper 
      title="解构 ｜ 看透商业与格局底牌" 
      icon={<BookOpen className="w-8 h-8" strokeWidth={2.5} />}
      description="核心定位：不仅是读文字，而是读结构、读政策背后的风向、读外企运作实质与漏洞。"
    >
      <div className="bg-[#f8f9fa] rounded-[2.5rem] p-8 md:p-12">
        {/* 极简风导航 Pills */}
        <div className="flex flex-wrap gap-3 mb-8">
          {tabs.map(t => (
            <button 
              key={t.id}
              onClick={() => { setActiveTab(t.id); setResult(null); }}
              className={`flex items-center text-xs py-3 px-5 font-bold tracking-widest uppercase rounded-full transition-all shadow-sm ${activeTab === t.id ? 'bg-[#FF5722] text-white shadow-md scale-105' : 'bg-white text-gray-500 hover:text-[#202124]'}`}
            >{t.icon} {t.label}</button>
          ))}
        </div>

        {/* 原文喂入区（大面积纯白留白） */}
        <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-2 mb-6 transition-all focus-within:shadow-[0_8px_30px_rgba(255,87,34,0.1)]">
           <textarea 
             rows={5} 
             value={inputText}
             onChange={(e) => setInputText(e.target.value)}
             className="w-full bg-transparent p-6 text-base outline-none resize-none leading-relaxed text-[#202124] placeholder-gray-300 font-medium" 
             placeholder="粘贴冗杂的原文...让系统为你剃除杂音。"
           />
        </div>

        <div className="relative w-full mb-10">
          {/* 报错气泡悬浮 */}
          {errorMsg && (
            <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-5 py-2.5 rounded-xl text-sm font-black tracking-wider shadow-lg z-10 flex items-center gap-2 animate-bounce">
              <span>⚠️</span> {errorMsg}
              {/* 小箭头 */}
              <div className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-red-500 rotate-45"></div>
            </div>
          )}

          <button 
            onClick={handlePenetrate}
            disabled={!inputText.trim() || isLoading}
            className={`w-full text-base py-4 rounded-full tracking-widest uppercase font-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 
              ${isShaking ? 'bg-red-500 text-white animate-[shake_0.4s_ease-in-out] shadow-[0_0_20px_rgba(239,68,68,0.6)]' : 'btn-primary hover:scale-[1.01]'}`}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {isShaking ? '解码异常' : '启动 AI 穿透解码'}
          </button>
        </div>
        
        {/* 四宫格因果降维输出框 (Material Card Grid) */}
        <div>
          <h4 className="text-xl font-black text-[#202124] mb-6 flex items-center">
            多维因果拆解 
            <span className="ml-4 text-[10px] bg-[#FF5722]/10 text-[#FF5722] px-3 py-1.5 rounded-full uppercase tracking-widest font-bold">Mandatory Output</span>
          </h4>
          
          {renderResultGrid()}
          
        </div>
      </div>
    </ModuleWrapper>
  );
}
