import React, { useState } from 'react';
import { BookOpen, FileText, BarChart3, Mail, LibraryBig } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';

export default function ReadModule() {
  const [activeTab, setActiveTab] = useState<'policy'|'business'|'email'|'books'>('policy');

  return (
    <ModuleWrapper 
      title="解构 ｜ 看透商业与格局底牌" 
      icon={<BookOpen className="w-8 h-8" strokeWidth={2.5} />}
      description="核心定位：不仅是读文字，而是读结构、读政策背后的风向、读外企运作实质。"
    >
      <div className="bg-[#f8f9fa] rounded-[2.5rem] p-8 md:p-12">
        {/* 极简风导航 Pills */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button 
            onClick={() => setActiveTab('policy')}
            className={`flex items-center text-xs py-3 px-5 font-bold tracking-widest uppercase rounded-full transition-all shadow-sm ${activeTab === 'policy' ? 'bg-[#FF5722] text-white shadow-md scale-105' : 'bg-white text-gray-500 hover:text-[#202124]'}`}
          ><FileText className="w-4 h-4 mr-2" /> 政策精神</button>
          
          <button 
            onClick={() => setActiveTab('business')}
            className={`flex items-center text-xs py-3 px-5 font-bold tracking-widest uppercase rounded-full transition-all shadow-sm ${activeTab === 'business' ? 'bg-[#FF5722] text-white shadow-md scale-105' : 'bg-white text-gray-500 hover:text-[#202124]'}`}
          ><BarChart3 className="w-4 h-4 mr-2" /> 财报研判</button>
          
          <button 
            onClick={() => setActiveTab('email')}
            className={`flex items-center text-xs py-3 px-5 font-bold tracking-widest uppercase rounded-full transition-all shadow-sm ${activeTab === 'email' ? 'bg-[#FF5722] text-white shadow-md scale-105' : 'bg-white text-gray-500 hover:text-[#202124]'}`}
          ><Mail className="w-4 h-4 mr-2" /> 越级邮件</button>

          <button 
            onClick={() => setActiveTab('books')}
            className={`flex items-center text-xs py-3 px-5 font-bold tracking-widest uppercase rounded-full transition-all shadow-sm ${activeTab === 'books' ? 'bg-[#FF5722] text-white shadow-md scale-105' : 'bg-white text-gray-500 hover:text-[#202124]'}`}
          ><LibraryBig className="w-4 h-4 mr-2" /> 书目提纯</button>
        </div>

        {/* 原文喂入区（大面积纯白留白） */}
        <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-2 mb-10 transition-all focus-within:shadow-[0_8px_30px_rgba(255,87,34,0.1)]">
           <textarea rows={3} className="w-full bg-transparent p-6 text-base outline-none resize-none leading-relaxed text-[#202124] placeholder-gray-300 font-medium" placeholder="粘贴冗杂的原文...让系统为你剃除杂音。"></textarea>
        </div>
        
        {/* 四宫格因果降维输出框 (Material Card Grid) */}
        <div>
          <h4 className="text-xl font-black text-[#202124] mb-6 flex items-center">
            多维因果拆解 
            <span className="ml-4 text-[10px] bg-[#FF5722]/10 text-[#FF5722] px-3 py-1.5 rounded-full uppercase tracking-widest font-bold">Mandatory Output</span>
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
               <span className="text-xs text-gray-400 font-bold mb-3 tracking-widest uppercase">01 / 表面字义与基础结论</span>
               <textarea rows={3} className="w-full bg-[#f8f9fa] rounded-2xl p-4 text-sm outline-none resize-none text-[#202124] font-medium" placeholder="写下明面的要求..."/>
             </div>
             <div className="bg-white rounded-3xl p-6 shadow-[0_4px_12px_rgba(255,87,34,0.05)] border border-[#FF5722]/10 flex flex-col hover:shadow-[0_8px_20px_rgba(255,87,34,0.1)] transition-shadow">
               <span className="text-xs text-[#FF5722] font-black mb-3 tracking-widest uppercase">02 / 隐藏导向与真实受益人</span>
               <textarea rows={3} className="w-full bg-[#fff3e0] rounded-2xl p-4 text-sm outline-none resize-none text-[#d84315] font-bold placeholder-[#ffab91]" placeholder="撕开伪装，谁是最大受益方？"/>
             </div>
             <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
               <span className="text-xs text-gray-400 font-bold mb-3 tracking-widest uppercase">03 / 行业波及推演</span>
               <textarea rows={3} className="w-full bg-[#f8f9fa] rounded-2xl p-4 text-sm outline-none resize-none text-[#202124] font-medium" placeholder="预测三个月内的涟漪效应..."/>
             </div>
             <div className="bg-[#202124] rounded-3xl p-6 shadow-lg flex flex-col transition-shadow">
               <span className="text-xs text-gray-400 font-bold mb-3 tracking-widest uppercase">04 / 灾难级红线与红利</span>
               <textarea rows={3} className="w-full bg-[#303134] rounded-2xl p-4 text-sm outline-none resize-none text-white font-medium placeholder-gray-500" placeholder="哪些底线绝不可碰？哪里有巨大的权力真空可以占领？"/>
             </div>
          </div>
        </div>
        
        <button className="w-full btn-primary text-base py-5 rounded-full tracking-widest uppercase font-black mt-10 hover:scale-[1.01] transition-transform">
          封存深度推演视角 
        </button>
      </div>
    </ModuleWrapper>
  );
}
