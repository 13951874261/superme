import React from 'react';
import { Target, TrendingUp } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 backdrop-blur-3xl bg-white/90 px-10 py-8 flex flex-col xl:flex-row justify-between items-start xl:items-center z-50 border-b border-gray-100 shadow-[0_4px_30px_rgba(0,0,0,0.02)] transition-all">
      <div className="mb-6 xl:mb-0">
        <h1 className="text-2xl md:text-3xl font-serif font-black text-[#202124] flex items-center tracking-wide">
          B·AI 高管数字沙盘
          <span className="ml-5 px-3 py-1 text-[9px] font-sans font-bold bg-[#FF5722]/10 text-[#FF5722] rounded-full flex items-center tracking-widest uppercase border border-[#FF5722]/20">
            <span className="w-1.5 h-1.5 bg-[#FF5722] rounded-full mr-2 animate-pulse"></span>
            沉浸式专注模式
          </span>
        </h1>
        <p className="text-xs text-gray-500 mt-3 font-sans tracking-widest uppercase">
          AI 做专业，你做领导；AI 做事务，你做人心；AI 做逻辑，你做格局。
        </p>
      </div>
      
      {/* 职业航标轴 (Career Roadmap) */}
      <div className="flex flex-col items-end">
        <div className="flex items-center text-xs font-black tracking-widest text-gray-400 uppercase mb-3">
          <span className="text-gray-300">2020 科员</span>
          <TrendingUp className="w-3 h-3 mx-2 text-gray-300" />
          <span className="text-[#202124]">2026 支行副行长</span>
          <TrendingUp className="w-3 h-3 mx-2 text-[#FF5722]" />
          <span className="text-[#FF5722] flex items-center bg-[#FF5722]/10 px-2 py-1 rounded">
            <Target className="w-3 h-3 mr-1" /> 2027 跨国大区 VP
          </span>
        </div>
        
        {/* 全局进度条 */}
        <div className="w-full xl:w-80 flex items-center gap-3">
          <div className="w-full bg-gray-100 rounded-full h-[4px] overflow-hidden">
            <div className="bg-[#202124] h-[4px] rounded-full transition-all duration-1000 ease-out" style={{ width: '45%' }}></div>
          </div>
          <span className="text-[#202124] font-black text-sm">45%</span>
        </div>
      </div>
    </header>
  );
}
