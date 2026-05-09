import React from 'react';
import { MessageCircle, Mic } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';

export default function EnglishModule() {
  return (
    <ModuleWrapper 
      title="英语技能 ｜ 场景闭环打磨" 
      icon={<MessageCircle className="w-5 h-5" strokeWidth={1.5} />}
      isOpen={true}
      description="核心战略：6个月商务专精突破 → 12个月涵盖全场景表达交流。"
    >
      <div className="space-y-8">
        {/* 自定义学习规则器 */}
        <div className="bg-stone-50/50 border border-stone-200/60 rounded-xl p-8 hover:shadow-sm transition-all duration-300">
          <div className="flex justify-between items-center mb-8">
            <h4 className="font-serif text-stone-900 text-sm flex items-center tracking-wide">
              <svg className="w-4 h-4 mr-2 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              阶段目标与规则设定 (Native Speaker 计划)
            </h4>
            <span className="text-[9px] bg-stone-800 text-stone-50 px-2.5 py-1.5 rounded-md font-medium uppercase tracking-widest shadow-sm">Rule Active</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs mb-8">
            <label className="flex items-center space-x-3 cursor-pointer bg-white p-4 rounded-lg border border-stone-200/60 hover:border-stone-300 hover:shadow-sm transition-all duration-300">
              <input type="radio" name="engPhase" defaultChecked className="text-stone-800 focus:ring-stone-500 w-3.5 h-3.5 accent-stone-800" />
              <span className="text-stone-800 font-medium tracking-wide">0-6个月：政务商务职场</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer bg-white p-4 rounded-lg border border-stone-200/60 hover:border-stone-300 hover:shadow-sm transition-all duration-300">
              <input type="radio" name="engPhase" className="text-stone-800 focus:ring-stone-500 w-3.5 h-3.5 accent-stone-800" />
              <span className="text-stone-800 font-medium tracking-wide">6-12个月：拓展生活全场景</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer bg-white p-4 rounded-lg border border-stone-200/60 hover:border-stone-300 hover:shadow-sm transition-all duration-300">
              <input type="checkbox" defaultChecked className="text-stone-800 focus:ring-stone-500 rounded w-3.5 h-3.5 accent-stone-800" />
              <span className="text-stone-800 font-medium tracking-wide">开启：刻意挑破绽/施压模式</span>
            </label>
          </div>
          <div className="flex flex-col md:flex-row md:items-center text-xs bg-white p-5 rounded-lg border border-stone-200/60 space-y-4 md:space-y-0 shadow-sm">
            <span className="font-medium text-stone-800 mr-5 tracking-wide">多角色交互模拟:</span>
            <select className="border border-stone-200/60 rounded-md p-2.5 focus:outline-none focus:ring-4 focus:ring-stone-100 focus:border-stone-300 bg-stone-50/50 text-stone-800 font-medium w-full md:w-72 tracking-wide transition-all duration-300">
              <option>外籍高管 (偏效率与黑话)</option>
              <option>海外客户 (偏利益谈判)</option>
              <option>政府官员 (偏合规与严谨)</option>
              <option>刁钻面试官 (偏压迫与抗压)</option>
            </select>
            <span className="md:ml-8 text-stone-500 italic tracking-wide font-serif">“要求AI必须充分掌握单场景后再推送下一个”</span>
          </div>
        </div>

        {/* 听/说/写实战交互 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="bg-white p-8 rounded-xl border border-stone-200/60 flex flex-col shadow-sm hover:shadow-md transition-all duration-300">
            <h4 className="text-xs font-medium text-stone-800 mb-5 flex justify-between tracking-wide">
              今日强绑定素材 (听/读)
              <span className="text-stone-500 text-[10px] uppercase tracking-widest">商务场景</span>
            </h4>
            <p className="text-sm font-medium text-stone-900 bg-stone-50/50 p-6 rounded-lg border border-stone-200/60 leading-relaxed italic font-serif">"We are willing to make a <strong className="text-stone-900 underline decoration-stone-300 underline-offset-4 cursor-help" title="n. 让步">concession</strong> on price, provided you can <strong className="text-stone-900 underline decoration-stone-300 underline-offset-4 cursor-help" title="v. 促进">facilitate</strong> a faster payment cycle."</p>
            <p className="text-xs text-stone-500 mt-5 flex-1 tracking-wide leading-relaxed">包含听力范例、句式拆解与破绽识别专有词汇推送。</p>
            <button className="mt-5 btn-secondary text-[10px] py-3 rounded-lg tracking-widest uppercase font-medium">一键同步至生词本</button>
          </div>
          <div className="flex flex-col">
            <label className="flex justify-between items-center text-xs font-medium text-stone-800 mb-4 tracking-wide">
              实时交互演练区 (口语/书面)
              <button className="btn-secondary flex items-center px-4 py-2 rounded-lg tracking-widest uppercase text-[10px] font-medium">
                <Mic className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />发音/对话测试
              </button>
            </label>
            <textarea rows={4} className="w-full bg-stone-50/50 border border-stone-200/60 rounded-xl p-5 text-sm focus:bg-white focus:ring-4 focus:ring-stone-100 focus:border-stone-300 flex-1 outline-none transition-all duration-300 resize-none leading-relaxed text-stone-800 placeholder-stone-400" placeholder="在此输入信函或进行角色模拟对话。系统将实时纠错，并批阅破绽..."></textarea>
            <button className="mt-5 w-full btn-primary text-stone-50 text-xs py-4 rounded-xl tracking-widest uppercase font-medium">发送给AI考官</button>
          </div>
        </div>
      </div>
    </ModuleWrapper>
  );
}
