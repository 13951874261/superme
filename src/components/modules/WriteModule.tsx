import React, { useState } from 'react';
import { PenTool, ChevronDown, BookOpen, AlertTriangle, ShieldCheck } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';

// 静态跨文化指导库数据
const GUIDANCE_LIBRARY = [
  {
    id: 'compliance',
    title: '《外企跨国合规函件指南》',
    icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
    content: '1. 责任隔离：使用被动语态描述客观问题 (e.g., "It has been observed that..." 而非 "We made a mistake")。\n2. 方案前置：外企高层不看过程，起首第一段必须包含 Bottom Line (底线数据) 和 Solution (解决方案)。\n3. 抄送礼仪：CC 列表中层级最高者决定了行文的最高涉密级别，慎用 BCC。'
  },
  {
    id: 'minefields',
    title: '《欧美非三地沟通雷区》',
    icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
    content: '【美企】极度结果导向，忌讳冗长的中式寒暄，直接切入核心商业价值。\n【欧企(英/德/法)】注重程序正义与 ESG，委婉但极度较真，忌讳侵略性施压，多用 "Would it be possible..."\n【中东/非洲】关系先于业务。必须先建立私人层面的 Respect (尊重)，忌讳在邮件中直接用法律条款施压。'
  }
];

export default function WriteModule() {
  const [expandedLevel, setExpandedLevel] = useState<number | null>(3);
  const [openGuide, setOpenGuide] = useState<string | null>('compliance');

  return (
    <ModuleWrapper 
      title="立言 ｜ 高维决策文治" 
      icon={<PenTool className="w-8 h-8" strokeWidth={2.5} />}
      description="左翼引入跨文化红线指南，右翼进行三级纵深批阅，彻底隔离政治与合规风险。"
    >
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* 左翼：静态跨文化指导抽屉面板 */}
        <aside className="xl:col-span-4 flex flex-col gap-4">
          <div className="bg-[#202124] text-white rounded-[2rem] p-6 shadow-lg">
            <h4 className="text-xs font-black tracking-widest uppercase flex items-center mb-6 text-[#FF5722]">
              <BookOpen className="w-4 h-4 mr-2" />
              Cross-Cultural Guidance
            </h4>
            <div className="space-y-4">
              {GUIDANCE_LIBRARY.map((guide) => (
                <div key={guide.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all">
                  <button 
                    onClick={() => setOpenGuide(openGuide === guide.id ? null : guide.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/10 transition-colors"
                  >
                    <span className="text-sm font-bold flex items-center gap-2">
                      {guide.icon} {guide.title}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openGuide === guide.id ? 'rotate-180 text-white' : ''}`} />
                  </button>
                  {openGuide === guide.id && (
                    <div className="p-4 pt-0 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-medium border-t border-white/5 mt-2">
                      {guide.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* 右翼：核心草稿与批阅区 */}
        <section className="xl:col-span-8 bg-white rounded-[2.5rem] p-8 shadow-[0_2px_40px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <label className="text-xs font-black text-gray-400 tracking-widest uppercase">战略行文起草台</label>
            <select className="text-xs border border-gray-200 bg-[#f8f9fa] rounded-full px-4 py-2 outline-none focus:border-[#FF5722] text-[#202124] font-bold cursor-pointer">
              <option>跨国合规/法务信函</option>
              <option>外企高管越级汇报</option>
              <option>危机公关对外声明</option>
            </select>
          </div>
          
          <textarea 
            rows={8} 
            className="w-full bg-[#f8f9fa] rounded-3xl p-6 text-sm outline-none resize-none leading-relaxed text-[#202124] placeholder-gray-400 font-medium focus:bg-white focus:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all mb-6 border border-transparent focus:border-[#FF5722]/30" 
            placeholder="结合左侧跨文化指南，起草您的英文决策指令..."
          ></textarea>
          
          <button className="w-full btn-primary text-sm py-4 rounded-full tracking-widest uppercase font-black hover:-translate-y-1 transition-transform mb-8 shadow-lg">
            开启三层阶梯纵深批阅
          </button>

          {/* 极简无框风琴展板 (完整保留原有 L1/L2/L3 代码) */}
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
                  您在行文中使用的"我觉得"、"但是"带有明显的学生思维。在外企函件中，请强制替换为硬性的"基于数据评估结论"以及"However"。
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
                  方案极度缺乏因果支撑。上层不仅看创意，更看重"若失败，底线在哪"。这封述职信没有呈现任何财务或政治风险兜底方案。
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
                    <span className="text-white">高阶修改建议：通过使用"联动多部门共同复议"的泛指被动语态，建立权力缓冲垫，将功劳私有化，将风险公摊化。</span>
                  </p>
                </div>
              )}
            </div>
          </div>

        </section>

      </div>
    </ModuleWrapper>
  );
}
