import React, { useState } from 'react';
import { Globe, Mic, Volume2, CheckCircle2, AlertTriangle } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import MaterialUploader from '../MaterialUploader';

export default function EnglishModule() {
  const [stage, setStage] = useState<'0-6' | '6-12'>('0-6');
  const [theme, setTheme] = useState('商务谈判：让步与施压');
  const [isMastered, setIsMastered] = useState(false);

  return (
    <ModuleWrapper 
      title="英语战略 ｜ 跨文化信任构建" 
      icon={<Globe className="w-8 h-8" strokeWidth={2.5} />}
      description="核心定位：不仅是交流，而是用英语构建信任、影响他人并主导跨国谈判。当前阶段必须达成硬性通关标准方可解锁下行主题。"
    >
      <div className="space-y-8">

        {/* ── 模块内设置面板（与顶层Tab导航无关，仅控制本模块内的视图） ── */}
        <div className="bg-[#f8f9fa] rounded-2xl p-4 border border-gray-200 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">模块内设置 ▸</span>

          {/* 阶段选择 */}
          <div className="flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
            <button
              onClick={(e) => { e.stopPropagation(); setStage('0-6'); }}
              className={`px-4 py-1.5 text-[11px] font-black tracking-wider rounded-lg transition-all ${stage === '0-6' ? 'bg-[#202124] text-white shadow' : 'text-gray-400 hover:text-[#202124]'}`}
            >0-6月：政商务攻坚</button>
            <button
              onClick={(e) => { e.stopPropagation(); setStage('6-12'); }}
              className={`px-4 py-1.5 text-[11px] font-black tracking-wider rounded-lg transition-all ${stage === '6-12' ? 'bg-[#202124] text-white shadow' : 'text-gray-400 hover:text-[#202124]'}`}
            >6-12月：全场景延伸</button>
          </div>

          {/* 主题选择 */}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-white border border-gray-200 text-[#202124] text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-[#FF5722] transition-colors"
          >
            <option>商务谈判：让步与施压</option>
            <option>危机公关：外媒答疑</option>
            <option>项目汇报：跨国董事会</option>
          </select>

          {/* 通关打卡 */}
          <button
            onClick={(e) => { e.stopPropagation(); setIsMastered(!isMastered); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black tracking-widest uppercase transition-all shrink-0 ${isMastered ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
            title="标记为已掌握，解锁下一关"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isMastered ? '已通关' : '标记通关'}
          </button>
        </div>

        {/* 基础唤醒区 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-[#202124] rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-[#FF5722]/20 rounded-full blur-2xl"></div>
            <h4 className="text-xs font-black uppercase tracking-widest text-[#FF5722] mb-4">基础唤醒打卡</h4>
            <p className="text-sm font-medium text-gray-300 mb-4 leading-relaxed">前1个月基建：每日10分钟连读纠音与核心商务语法（被动/虚拟）重构。</p>
            <textarea rows={2} className="w-full bg-white/10 border border-gray-700 rounded-xl p-3 text-xs text-white placeholder-gray-500 outline-none resize-none mb-3" placeholder="记录今日纠音成果或语法复健..."></textarea>
            <button
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-[#FF5722] text-white text-xs font-black py-3 rounded-xl uppercase tracking-widest hover:bg-[#E64A19] transition"
            >同步至数据舱</button>
          </div>

          <div className="md:col-span-2">
            <MaterialUploader topicHint={`英语专项解析：${theme}`} />
          </div>
        </div>

        {/* 高阶实战演练舱 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* 左侧：精听泛听矩阵 */}
          <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-sm font-black text-[#202124] uppercase tracking-widest flex items-center">
                <Volume2 className="w-5 h-5 mr-3 text-[#FF5722]" /> 精听泛听矩阵
              </h4>
              <div className="flex gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 p-1 rounded-lg">
                <span className="px-2 py-1 rounded bg-white text-[#202124] shadow-sm cursor-pointer select-none">1.0x</span>
                <span className="px-2 py-1 rounded hover:bg-white cursor-pointer select-none">1.2x</span>
                <span className="px-2 py-1 rounded hover:bg-white cursor-pointer select-none">1.5x</span>
              </div>
            </div>
            
            <div className="bg-[#f8f9fa] rounded-2xl p-6 mb-6 flex-1 border border-gray-100 relative group">
              <div className="absolute inset-0 backdrop-blur-sm bg-white/30 z-10 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity duration-500 rounded-2xl pointer-events-none">
                <span className="bg-[#202124] text-white text-xs font-bold px-4 py-2 rounded-full flex items-center shadow-lg">
                  <Volume2 className="w-4 h-4 mr-2" /> 悬浮解开盲听文本
                </span>
              </div>
              <p className="text-sm text-gray-700 leading-8 font-serif italic">
                "Our current supply chain topology lacks the <span className="bg-yellow-100 text-yellow-800 font-bold px-1 rounded">redundancy</span> required to absorb macroeconomic shocks. Therefore, an immediate pivot to <span className="bg-yellow-100 text-yellow-800 font-bold px-1 rounded">near-shoring</span> is non-negotiable."
              </p>
            </div>
            
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex-1 border border-[#202124] text-[#202124] hover:bg-[#202124] hover:text-white py-3 rounded-full text-xs font-black tracking-widest uppercase transition-colors"
            >
              提纯破绽词句入库
            </button>
          </div>

          {/* 右侧：多角色口语圆桌推演 */}
          <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-sm font-black text-[#202124] uppercase tracking-widest flex items-center">
                <Mic className="w-5 h-5 mr-3 text-[#1a73e8]" /> 跨文化多角色沙盘
              </h4>
              <span className="text-[10px] bg-red-50 text-red-600 px-3 py-1 rounded-full font-black uppercase tracking-widest animate-pulse border border-red-100">
                Hostile Env
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-black text-xs shrink-0">CEO</div>
                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm text-sm text-gray-700 relative">
                  <AlertTriangle className="absolute -top-2 -right-2 w-5 h-5 text-amber-500 fill-amber-100" title="隐含逻辑破绽：无数据支撑" />
                  "The budget overrun is unacceptable. We need a 20% cut across the board immediately, no exceptions."
                </div>
              </div>
              
              <div className="flex items-start gap-4 flex-row-reverse">
                <div className="w-10 h-10 rounded-full bg-[#FF5722]/10 border border-[#FF5722]/20 flex items-center justify-center text-[#FF5722] font-black text-xs shrink-0">You</div>
                <div className="w-full relative">
                  <textarea 
                    rows={3}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-white p-4 rounded-2xl rounded-tr-none border-2 border-blue-200 focus:border-[#FF5722] outline-none text-sm text-[#202124] resize-none shadow-inner transition-colors"
                    placeholder="识别对方以偏概全的漏洞。分化阵营，录入你的反驳与提问..."
                  />
                  <button 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-3 bottom-3 p-2 bg-[#f8f9fa] rounded-full text-gray-400 hover:text-[#FF5722] hover:bg-gray-100 transition-colors"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <button className="w-full bg-[#1a73e8] hover:bg-blue-700 text-white py-4 rounded-full text-xs font-black tracking-widest uppercase transition-shadow shadow-[0_4px_14px_rgba(26,115,232,0.3)]">
              提交高阶回合裁决
            </button>
          </div>

        </div>
      </div>
    </ModuleWrapper>
  );
}
