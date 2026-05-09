import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { BrainCircuit, Zap, X, Activity, ShieldCheck } from 'lucide-react';

export default function ChatModule() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      {/* 原有位置（左侧边栏）显示内容：精简为仪表盘状态展示和一个核心呼出按钮 */}
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
            由于多模型联合分析经常输出长段“思考过程”，为保证极佳的阅读排版，系统将调度宽屏独立视界进行展示。
          </div>
        </div>

        <button 
          onClick={() => setIsDrawerOpen(true)}
          className="mt-auto w-full bg-[#202124] text-white py-3.5 rounded-xl text-xs font-bold tracking-widest hover:bg-[#FF5722] hover:shadow-[0_4px_16px_rgba(255,87,34,0.3)] transition-all ease-out duration-300 flex justify-center items-center group/btn relative overflow-hidden"
        >
          <span className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 ease-in-out"></span>
          <Zap className="w-4 h-4 mr-2 group-hover/btn:scale-125 group-hover/btn:text-yellow-300 transition-all" />
          呼出独立对话大屏
        </button>
      </div>

      {/* 联动页面：居右弹出的沉浸式对话抽屉 (Iframe Modal) */}
      {/* 保证 z-index 在最上层，铺满屏幕或局部悬浮。通过 Portal 脱离侧边栏流，避免被溢出隐藏切割 */}
      {typeof document !== 'undefined' && createPortal(
        <div 
          className={`fixed inset-0 z-[100] flex justify-end transition-all duration-500 ease-in-out ${
            isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* 背景毛玻璃遮罩层，点击关闭 */}
          <div 
            className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-500 ${isDrawerOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => setIsDrawerOpen(false)}
          ></div>
          
          {/* 右侧滑出的抽屉面板（预设宽度 800px / 40vw 等度量），兼容大尺寸 */}
          <div 
            className={`relative w-[65vw] max-w-[900px] min-w-[500px] h-full bg-[#f8f9fa] shadow-[-10px_0_40px_rgba(0,0,0,0.15)] transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col ${
              isDrawerOpen ? 'translate-x-0' : 'translate-x-[100%]'
            }`}
          >
            {/* 左侧突出的悬浮关闭按钮 */}
            <button 
              onClick={() => setIsDrawerOpen(false)}
              className="absolute -left-14 top-8 bg-white/90 backdrop-blur p-3 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.1)] text-gray-500 hover:text-[#FF5722] hover:scale-110 transition-all border border-gray-100 border-r-0 rounded-r-none"
            >
              <X className="w-6 h-6" strokeWidth={2.5} />
            </button>

            {/* 顶部标题装饰 */}
            <div className="h-4 bg-gradient-to-r from-[#FF5722] to-amber-500 w-full shrink-0"></div>

            {/* Dify iframe 嵌入区 */}
            <div className="flex-1 w-full bg-white relative">
              <iframe
                src={`${typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:'}//dify.234124123.xyz/chatbot/Gz2zXRlfsAr5jYgC`}
                className="w-full h-full border-none"
                style={{ minHeight: '700px' }}
                allow="microphone"
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
