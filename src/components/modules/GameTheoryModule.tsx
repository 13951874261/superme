import React, { useState } from 'react';
import { Brain, Swords, ShieldAlert } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';

export default function GameTheoryModule() {
  const [activeEnv, setActiveEnv] = useState<'体制内'|'外企'|'无界商战'>('体制内');

  return (
    <ModuleWrapper 
      title="驭心 ｜ 高管层博弈系统" 
      icon={<Brain className="w-8 h-8" strokeWidth={2.5} />}
      description="板块定位：职场权力博弈 + 博弈论落地 + 以下克上/上驭下的系统心法。破阶到0.01%的关键。"
    >
      <div className="bg-[#f8f9fa] rounded-[2.5rem] p-8 md:p-12">
        {/* 环境与模型重型分发器 */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-12 gap-6 pb-8 border-b border-gray-200">
          <div className="flex bg-white p-2 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.02)] max-w-max">
            <button 
              onClick={() => setActiveEnv('体制内')}
              className={`py-3 px-8 text-xs font-black tracking-widest uppercase rounded-full transition-all ${activeEnv === '体制内' ? 'bg-[#202124] text-white shadow-md scale-105' : 'text-gray-400 hover:text-[#202124]'}`}
            >体制内政治</button>
            <button 
              onClick={() => setActiveEnv('外企')}
              className={`py-3 px-8 text-xs font-black tracking-widest uppercase rounded-full transition-all ${activeEnv === '外企' ? 'bg-[#FF5722] text-white shadow-md scale-105' : 'text-gray-400 hover:text-[#FF5722]'}`}
            >外企权斗局</button>
          </div>
          
          <select className="border-none bg-white rounded-full px-8 py-4 text-xs text-[#202124] font-black tracking-widest uppercase shadow-[0_4px_12px_rgba(0,0,0,0.03)] outline-none focus:ring-4 focus:ring-[#FF5722]/10 cursor-pointer">
            <option>核心模型：囚徒困境演化版</option>
            <option>核心模型：智猪潜藏博弈</option>
            <option>核心模型：极度信息不对称</option>
            <option>核心模型：冷酷触发策略</option>
          </select>
        </div>

        {/* 高张力推演案卷 */}
        <div className="bg-white border-l-8 border-[#FF5722] p-8 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.03)] mb-10 transform -rotate-1 hover:rotate-0 transition-transform duration-500">
           <h4 className="font-sans text-xl font-black mb-4 text-[#202124] uppercase tracking-wide">危机靶标：被做局的业绩黑锅</h4>
           <p className="text-gray-500 font-medium leading-relaxed">
             跨国区域VP在明知道供应链延迟是由他嫡系部门造成的状况下，在董事会上却通过极度专业的“合规延展词汇”，试图将预算超标的第一罪责隐性转移到你的大区头上。此刻会议离轮到你发言还有最后十分钟。
           </p>
        </div>

        {/* 绝杀·双层对立推演盘 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
           {/* 左：向上的控制剥夺 */}
           <div className="flex flex-col bg-white rounded-[2rem] overflow-hidden shadow-[0_2px_15px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_35px_rgba(0,0,0,0.08)] transition-shadow">
             <div className="p-8 border-b border-gray-100 flex items-center justify-between">
               <span className="text-sm font-black text-[#202124] tracking-widest uppercase flex items-center">
                 <Swords className="w-5 h-5 mr-3 text-[#FF5722]" /> 向上夺权与剥离
               </span>
             </div>
             <textarea rows={6} className="w-full bg-transparent p-8 text-base outline-none resize-none leading-relaxed text-[#202124] placeholder-gray-300 font-medium flex-1" placeholder="填入你打算如何用更高的权力层级压制他？如何立刻将他的心腹推到聚光灯下烤？绝不被动挨打..."></textarea>
           </div>

           {/* 右：魅黑的反向防御 */}
           <div className="flex flex-col bg-[#202124] rounded-[2rem] overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.2)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-shadow">
             <div className="p-8 border-b border-gray-800 flex items-center justify-between">
               <span className="text-sm font-black text-white tracking-widest uppercase flex items-center">
                 <ShieldAlert className="w-5 h-5 mr-3 text-[#FF5722]" /> 破釜底线 / 鱼死网破之筹码
               </span>
             </div>
             <textarea rows={6} className="w-full bg-transparent p-8 text-base outline-none resize-none leading-relaxed text-gray-200 placeholder-gray-600 font-medium flex-1" placeholder="永远备好底线。如果他在会场一举发难，你手中能够让他瞬间下不了台的反向核按钮是什么？"></textarea>
           </div>
        </div>

        <button className="w-full bg-[#FF5722] hover:bg-[#E64A19] text-white py-6 rounded-full text-lg tracking-[0.2em] uppercase font-black hover:-translate-y-1 shadow-[0_10px_20px_rgba(255,87,34,0.3)] transition-all">
          启动 AI 董事会高阶模拟推演战
        </button>
      </div>
    </ModuleWrapper>
  );
}
