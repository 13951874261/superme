import React, { useState } from 'react';
import { PenTool, ChevronDown } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';

export default function WriteModule() {
  const [expandedLevel, setExpandedLevel] = useState<number | null>(3);

  return (
    <ModuleWrapper 
      title="立言 ｜ 高维决策文治" 
      icon={<PenTool className="w-8 h-8" strokeWidth={2.5} />}
      description="核心定位：掌握向上管理的文字艺术与商务交流规范，由浅入深的三级突破。"
    >
      <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-[0_2px_40px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <label className="text-xs font-black text-gray-400 tracking-widest uppercase">战略行文起草台</label>
          <select className="text-sm border-none bg-[#f8f9fa] rounded-full px-6 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF5722] text-[#202124] tracking-widest uppercase shadow-sm font-bold cursor-pointer hover:bg-gray-100 transition-colors">
            <option>体制内高层公文</option>
            <option>跨国合规/法务信函</option>
            <option>最高光述职纲要</option>
            <option>私人哲思</option>
          </select>
        </div>
        
        {/* 核心草稿区 (净化无框) */}
        <textarea 
          rows={6} 
          className="w-full bg-[#f8f9fa] rounded-3xl p-8 text-base outline-none resize-none leading-relaxed text-[#202124] placeholder-gray-400 font-medium focus:bg-white focus:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all mb-8" 
          placeholder="起草你的决策指令。每一个措辞的分寸，都在暴露你的真实段位..."
        ></textarea>
        
        <button className="w-full btn-primary text-base py-5 rounded-full tracking-widest uppercase font-black hover:-translate-y-1 transition-transform mb-12">
          开启三层阶梯纵深批阅
        </button>

        {/* 极简无框风琴展板 */}
        <div className="space-y-4">
           {/* 第一层：浅 */}
           <div className={`rounded-3xl transition-all duration-500 overflow-hidden ${expandedLevel === 1 ? 'bg-[#f8f9fa] shadow-inner' : 'bg-white border border-gray-100 hover:border-gray-200'}`}>
             <button 
               onClick={() => setExpandedLevel(expandedLevel === 1 ? null : 1)}
               className="w-full flex items-center justify-between p-6 text-[#202124]"
             >
               <span className="text-sm font-black tracking-widest uppercase flex items-center">
                 <span className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center mr-4 text-xs">L1</span>
                 合规底线与基础措辞
               </span>
               <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${expandedLevel === 1 ? 'rotate-180 text-[#FF5722]' : ''}`} />
             </button>
             {expandedLevel === 1 && (
               <div className="px-6 pb-6 pt-2 text-sm text-gray-600 leading-relaxed font-medium">
                 您在行文中使用的“我觉得”、“但是”带有明显的学生思维。在外企函件中，请强制替换为硬性的“基于数据评估结论”以及“However”。
               </div>
             )}
           </div>

           {/* 第二层：中 */}
           <div className={`rounded-3xl transition-all duration-500 overflow-hidden ${expandedLevel === 2 ? 'bg-[#fff3e0] shadow-inner' : 'bg-white border border-gray-100 hover:border-gray-200'}`}>
             <button 
               onClick={() => setExpandedLevel(expandedLevel === 2 ? null : 2)}
               className="w-full flex items-center justify-between p-6 text-[#202124]"
             >
               <span className="text-sm font-black tracking-widest uppercase flex items-center">
                 <span className="w-8 h-8 rounded-full bg-[#FF5722]/20 text-[#FF5722] flex items-center justify-center mr-4 text-xs">L2</span>
                 说服闭环与漏洞修补
               </span>
               <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${expandedLevel === 2 ? 'rotate-180 text-[#FF5722]' : ''}`} />
             </button>
             {expandedLevel === 2 && (
               <div className="px-6 pb-6 pt-2 text-sm text-[#d84315] leading-relaxed font-bold">
                 方案极度缺乏因果支撑。上层不仅看创意，更看重“若失败，底线在哪”。这封述职信没有呈现任何财务或政治风险兜底方案。
               </div>
             )}
           </div>

           {/* 第三层：深 */}
           <div className={`rounded-3xl transition-all duration-500 overflow-hidden ${expandedLevel === 3 ? 'bg-[#202124] shadow-[0_10px_30px_rgba(0,0,0,0.15)]' : 'bg-[#202124] opacity-90 hover:opacity-100'}`}>
             <button 
               onClick={() => setExpandedLevel(expandedLevel === 3 ? null : 3)}
               className="w-full flex items-center justify-between p-6 text-white"
             >
               <span className="text-sm font-black tracking-widest uppercase flex items-center">
                 <span className="w-8 h-8 rounded-full bg-white text-[#202124] flex items-center justify-center mr-4 text-xs">L3</span>
                 最高统御视角与利益切割隔离
               </span>
               <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${expandedLevel === 3 ? 'rotate-180 text-white' : ''}`} />
             </button>
             {expandedLevel === 3 && (
               <div className="px-6 pb-6 pt-2 text-sm text-gray-300 leading-relaxed font-medium">
                 <p className="border-l-4 border-[#FF5722] pl-4 py-1 bg-black/20 rounded-r-lg">
                   <strong>致命盲区锁定：</strong>这封公文的政治站位大错特错。您将所有关键责任前置揽到自己部门身上。在外企或高层机关，一旦合规出事，这就是白纸黑字的替罪羊背书。<br/><br/>
                   <span className="text-white">高阶修改建议：通过使用“联动多部门共同复议”的泛指被动语态，建立权力缓冲垫，将功劳私有化，将风险公摊化。</span>
                 </p>
               </div>
             )}
           </div>
        </div>

      </div>
    </ModuleWrapper>
  );
}
