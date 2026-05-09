import React from 'react';
import { Wine } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';

export default function EntertainmentModule() {
  return (
    <ModuleWrapper 
      title="娱乐 ｜ 高端社交 + 阶层审美" 
      icon={<Wine className="w-5 h-5" strokeWidth={1.5} />}
      description="核心定位：高端社交技能与隐形阶层审美的修缮池。不是消磨时间，那是修炼格局。"
    >
      <div className="flex space-x-3 mb-5">
        <span className="px-4 py-2 bg-white text-stone-700 text-[10px] font-medium tracking-widest uppercase rounded-lg border border-stone-200/60 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer">红酒/雪茄礼仪</span>
        <span className="px-4 py-2 bg-white text-stone-700 text-[10px] font-medium tracking-widest uppercase rounded-lg border border-stone-200/60 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer">中式茶席</span>
      </div>
      <textarea rows={4} className="w-full bg-stone-50/50 border border-stone-200/60 rounded-xl p-5 text-sm focus:bg-white focus:ring-4 focus:ring-stone-100 focus:border-stone-300 outline-none transition-all duration-300 resize-none leading-relaxed text-stone-800 placeholder-stone-400" placeholder="记录社交实战复盘或技能强化途径执行情况..."></textarea>
      <button className="mt-5 w-full btn-primary text-stone-50 text-xs py-4 rounded-xl tracking-widest uppercase font-medium">保存沉淀</button>
    </ModuleWrapper>
  );
}
