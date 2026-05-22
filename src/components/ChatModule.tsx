import React from 'react';
import { BrainCircuit, Zap, ShieldCheck } from 'lucide-react';

export default function ChatModule() {
  const handleOpenAssistant = () => {
    window.dispatchEvent(new CustomEvent('toggle-right-panel', {
      detail: { open: true, tab: 'assistant' }
    }));
  };

  return (
    <div className="bg-white rounded-[1.5rem] p-5 flex flex-col shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100 mb-6 shrink-0 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#FF5722]/5 to-transparent rounded-bl-full -z-0"></div>
      
      <h3 className="text-xs font-black text-[#202124] uppercase tracking-widest flex items-center mb-4 relative z-10">
        <BrainCircuit className="w-4 h-4 mr-2 text-[#FF5722]" strokeWidth={2.5} />
        全局对话舱状态
      </h3>
      
      <div className="space-y-3 mb-6 relative z-10">
        <div className="flex items-center text-[11px] text-gray-500">
           <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 animate-pulse"></div>
           多模型 (Claude Sonnet 4.6 等) 已连接就绪
        </div>
        <div className="flex items-center text-[11px] text-gray-500">
           <ShieldCheck className="w-3.5 h-3.5 text-blue-500 mr-1.5" />
           当前对话记忆已通过加密固化
        </div>
        <div className="text-[10px] text-gray-400 leading-relaxed bg-gray-50 p-2.5 rounded-lg border border-gray-100">
          由于多模型联合分析经常输出长段“思考过程”，为保证极佳的阅读排版，系统将调度右侧 30% 黄金视界展示。
        </div>
      </div>

      <button 
        onClick={handleOpenAssistant}
        className="mt-auto w-full bg-[#202124] text-white py-3.5 rounded-xl text-xs font-bold tracking-widest hover:bg-[#FF5722] hover:shadow-[0_4px_16px_rgba(255,87,34,0.3)] transition-all ease-out duration-300 flex justify-center items-center group/btn relative overflow-hidden"
      >
        <span className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 ease-in-out"></span>
        <Zap className="w-4 h-4 mr-2 group-hover/btn:scale-125 group-hover/btn:text-yellow-300 transition-all" />
        呼出独立对话大屏
      </button>
    </div>
  );
}
