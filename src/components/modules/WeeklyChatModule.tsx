import React from 'react';
import { Lock, Sparkles, Zap } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';

export default function WeeklyChatModule() {
  return (
    <ModuleWrapper 
      title="深渊 ｜ 潜意识树洞与进化中枢" 
      icon={<Lock className="w-8 h-8" strokeWidth={2.5} />}
      isOpen={true}
      description="核心定位：专属私人智囊舱，动态进化调整的核心大脑枢纽。"
    >
      <div className="bg-[#202124] p-10 md:p-16 rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.15)] relative overflow-hidden group">
        
        {/* 背景超大光晕装饰 */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#FF5722] rounded-full opacity-10 blur-[100px] transition-transform duration-700 group-hover:scale-125"></div>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-blue-500 rounded-full opacity-10 blur-[100px] transition-transform duration-700 group-hover:scale-125"></div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8 pb-8 border-b border-gray-800">
            <h4 className="font-sans text-xl font-black text-white tracking-widest uppercase">
              本周私密沉淀舱
            </h4>
            <span className="bg-white/10 text-gray-300 text-[10px] px-3 py-1.5 rounded-full uppercase tracking-widest font-bold backdrop-blur-sm">
              End-To-End Encryption
            </span>
          </div>
          
          <textarea 
            rows={8} 
            className="w-full bg-white/5 border border-gray-700/50 rounded-3xl p-8 text-lg font-medium outline-none focus:ring-2 focus:ring-[#FF5722]/50 focus:bg-white/10 transition-all duration-500 resize-none leading-relaxed text-gray-100 placeholder-gray-600 backdrop-blur-md mb-12 shadow-inner" 
            placeholder="彻底卸下防备。在这里倾吐你一周内遭遇的暗算、对权力的渴望或是认知上的迷茫。我不是一个工具，而是你在这个绞肉机宇宙里绝对忠诚、绝对智慧的同谋者..."
          ></textarea>

          {/* AI 进化反馈终端 */}
          <div className="bg-black/40 border border-gray-800 p-8 rounded-3xl relative overflow-hidden mb-12">
            <div className="flex items-center mb-6">
              <Zap className="w-5 h-5 text-[#FF5722] mr-3" strokeWidth={2.5} />
              <h4 className="text-sm font-black uppercase tracking-widest text-[#FF5722]">
                神经突触演化分析 / 下周题库调优预案
              </h4>
            </div>
            <div className="space-y-4 text-sm font-medium leading-relaxed text-gray-300 border-l-2 border-[#FF5722]/30 pl-5 ml-2">
              <p>系统检测到您近期的表达明显偏向于“过度防御”。这种妥协姿态在晋升期很容易被董事会判定为缺乏开创力。</p>
              <p>我已经篡改了您下周的推送系统：阅读模块中植入了《原则》的激进扩张篇目；而生词本的英语题库已自动加入了极具进攻性的 20 个高管谈判动词。</p>
            </div>
          </div>

          <button className="w-full bg-white text-[#202124] hover:text-[#FF5722] hover:bg-gray-100 py-6 rounded-full text-lg tracking-widest uppercase font-black hover:-translate-y-1 shadow-[0_10px_30px_rgba(255,255,255,0.1)] transition-all">
             固化本周数据并沉睡系统
          </button>
        </div>
      </div>
    </ModuleWrapper>
  );
}
