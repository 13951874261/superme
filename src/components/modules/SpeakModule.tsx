import React from 'react';
import { Mic, Activity, Globe } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';

export default function SpeakModule() {
  return (
    <ModuleWrapper 
      title="破局 ｜ 夺回对话主导权" 
      icon={<Mic className="w-8 h-8" strokeWidth={2.5} />}
      description="核心定位：结构化表达 + 极致分寸感 + 面试/述职场景价值变现。时间建议：每日 60 分钟。"
    >
      <div className="bg-[#f8f9fa] rounded-[2.5rem] p-8 md:p-12 mb-12">
        {/* Material 风格全屏宽体切换器 */}
        <div className="flex bg-white p-2 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.04)] mb-12 max-w-2xl">
          <button className="flex-1 py-3 px-6 bg-[#FF5722] text-white rounded-full text-sm font-bold tracking-widest uppercase shadow-md transition-transform hover:scale-105">跨国高管沟通</button>
          <button className="flex-1 py-3 px-6 text-gray-500 hover:text-[#202124] rounded-full text-sm font-bold tracking-widest uppercase transition-colors">东南亚代理商</button>
          <button className="flex-1 py-3 px-6 text-gray-500 hover:text-[#202124] rounded-full text-sm font-bold tracking-widest uppercase transition-colors flex items-center justify-center">
            <Activity className="w-4 h-4 mr-2" />述职战役
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* 左侧：巨型文字指引 */}
          <div className="col-span-1 lg:col-span-5 flex flex-col justify-center">
            <h3 className="text-2xl font-black text-[#202124] leading-tight mb-8">
              “这些员工福利对区域核心营收有什么贡献？”
            </h3>
            
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col">
              <span className="text-[#FF5722] font-black text-[10px] tracking-widest uppercase mb-4">美企文化分寸提示</span>
              <p className="text-[#5f6368] leading-relaxed font-medium">
                单刀直入。废弃国内的“人情背书”和“大局论调”。直接用硬性数值与合规免罚收益锚定他们的利益。
              </p>
            </div>
          </div>

          {/* 右侧：高度净化的录音/输入舱 */}
          <div className="col-span-1 lg:col-span-7 flex flex-col space-y-6">
            <div className="relative group">
              <textarea 
                rows={5} 
                className="w-full bg-white rounded-3xl p-8 text-base outline-none resize-none text-[#202124] placeholder-gray-400 font-medium shadow-[0_4px_12px_rgba(0,0,0,0.03)] focus:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all" 
                placeholder="录入你打算使用的绝杀发言...不要犹豫。"
              />
              <button className="absolute right-6 bottom-6 bg-[#f1f3f4] text-gray-600 p-4 rounded-full hover:bg-gray-200 hover:text-[#FF5722] transition-colors shadow-sm">
                <Mic className="w-6 h-6" strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex gap-4">
              <button className="flex-1 btn-primary py-5 rounded-full text-sm font-black tracking-widest uppercase">
                立即获取击穿力评分
              </button>
              <button className="px-8 btn-secondary py-5 rounded-full text-sm font-black tracking-widest uppercase shadow-sm hover:shadow-md transition-all border-none bg-white">
                模拟阻碍者再追问
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModuleWrapper>
  );
}
