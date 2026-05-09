import React from 'react';

export default function Header() {
  return (
    <header className="sticky top-0 backdrop-blur-2xl bg-[#F9F9F8]/80 px-10 py-8 flex flex-col md:flex-row justify-between items-start md:items-end z-50 stagger-1 border-b border-stone-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.02)] transition-all duration-500">
      <div className="mb-6 md:mb-0">
        <h1 className="text-2xl md:text-3xl font-serif font-medium text-stone-900 flex items-center tracking-wide">
          今日核心训练
          <span className="ml-5 px-3 py-1 text-[9px] font-sans font-medium bg-white/80 text-stone-600 rounded-full flex items-center tracking-widest uppercase border border-stone-200/60 shadow-sm backdrop-blur-md">
            <span className="w-1.5 h-1.5 bg-stone-400 rounded-full mr-2 animate-pulse"></span>
            云端同步就绪
          </span>
        </h1>
        <p className="text-xs text-stone-500 mt-3 font-sans tracking-widest uppercase">
          AI 做专业，你做领导；AI 做事务，你做人心；AI 做逻辑，你做格局。
        </p>
      </div>
      
      <div className="w-full md:w-80">
        <div className="flex justify-between items-end text-[10px] mb-3 font-medium text-stone-400 tracking-widest uppercase">
          <span>当日 / 本周 训练完成度</span>
          <span className="text-stone-900 font-serif text-xl leading-none">45%</span>
        </div>
        <div className="w-full bg-stone-200/50 rounded-full h-[3px] overflow-hidden">
          <div className="bg-stone-900 h-[3px] rounded-full transition-all duration-1000 ease-out" style={{ width: '45%' }}></div>
        </div>
      </div>
    </header>
  );
}
