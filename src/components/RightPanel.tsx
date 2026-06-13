import React, { useState, useEffect } from 'react';
import { X, BrainCircuit, Globe, BookOpen, Volume2, ShieldCheck, HelpCircle, Check } from 'lucide-react';
import SpeakButton from './SpeakButton';
import { getUserCurrentProfile, saveUserCurrentProfile } from '../utils/profileHelper';

interface RightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'assistant' | 'context';
  setActiveTab: (tab: 'assistant' | 'context') => void;
  wordData: any;
}

export default function RightPanel({ isOpen, onClose, activeTab, setActiveTab, wordData }: RightPanelProps) {
  const [profile, setProfile] = useState(() => getUserCurrentProfile());
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const handleProfileChange = () => {
      setProfile(getUserCurrentProfile());
    };
    window.addEventListener('global-profile-changed', handleProfileChange);
    return () => window.removeEventListener('global-profile-changed', handleProfileChange);
  }, []);
  return (
    <aside
      className={`h-screen border-l border-gray-200 bg-[#FAF9F6] flex flex-col transition-all duration-500 ease-in-out shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-[99] ${
        isOpen ? 'w-[30vw] min-w-[350px] opacity-100' : 'w-0 opacity-0 overflow-hidden pointer-events-none'
      }`}
    >
      {/* 头部 Tab 区域 */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('assistant')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition ${
              activeTab === 'assistant'
                ? 'bg-[#202124] text-white'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            全局 AI 助手
          </button>
          <button
            onClick={() => setActiveTab('context')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition ${
              activeTab === 'context'
                ? 'bg-[#202124] text-white'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            情报解密舱
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative flex items-center">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="h-8 px-3 rounded-full border border-gray-150 bg-white/70 backdrop-blur-md shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-650 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              <span>画像: {profile || '默认'}</span>
            </button>

            {showProfileMenu && (
              <>
                <div 
                  className="fixed inset-0 z-[998]" 
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-[999] w-48 bg-white/90 backdrop-blur-lg border border-gray-100 rounded-2xl shadow-xl p-1.5 animate-[fadeIn_0.1s_ease-out]">
                  {[
                    { label: '英国 (UK)', value: '英国 (UK)', desc: '英式拼写及口音标准' },
                    { label: '美国 (US)', value: '美国 (US)', desc: '美式拼写及口音标准' },
                    { label: '未设定 (默认)', value: '', desc: '不进行特定倾向限制' }
                  ].map((item) => (
                    <button
                      key={item.value}
                      onClick={() => {
                        saveUserCurrentProfile(item.value);
                        setShowProfileMenu(false);
                      }}
                      className={`w-full flex flex-col items-start p-2 rounded-xl text-left transition hover:bg-slate-50 cursor-pointer ${
                        profile === item.value ? 'bg-indigo-50/50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                          {item.label}
                        </span>
                        {profile === item.value && <Check className="w-3 h-3 text-indigo-600" />}
                      </div>
                      <span className="text-[8px] text-gray-400 font-medium mt-0.5">
                        {item.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-[#FF5722] transition"
            title="收起分析舱"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-white">
        {activeTab === 'assistant' ? (
          /* 全局 AI 助手 (Dify chatbot) */
          <div className="w-full h-full relative">
            <iframe
              src="https://dify.234124123.xyz/chatbot/Gz2zXRlfsAr5jYgC"
              className="w-full h-full border-none"
              allow="microphone"
            />
          </div>
        ) : (
          /* 情报解密舱 (上下文词汇详情) */
          <div className="p-5 space-y-6">
            {!wordData ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400 px-4">
                <BookOpen className="w-12 h-12 mb-3 text-gray-300 stroke-[1.5]" />
                <div className="font-bold text-xs uppercase tracking-widest text-gray-600 mb-1">
                  情报解密就绪
                </div>
                <p className="text-[11px] leading-relaxed max-w-[240px]">
                  在左侧主工作区选中任意英文商务词汇，系统将自动连接 Dify 调取深层商业洞察并在此呈现。
                </p>
              </div>
            ) : (
              <div className="space-y-5 animate-[fadeIn_0.3s_ease]">
                {/* 词条头部 */}
                <div className="bg-[#FF5722]/5 border border-[#FF5722]/10 rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#FF5722]/10 to-transparent rounded-bl-full"></div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-black uppercase tracking-widest bg-[#FF5722] text-white px-2 py-0.5 rounded">
                      已解密
                    </span>
                    <span className="text-[9px] font-bold text-gray-400">
                      来源: {wordData.source || '划词截获'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                        {wordData.word}
                      </h2>
                      {wordData.phonetic && (
                        <span className="text-xs text-gray-400 font-mono">
                          /{wordData.phonetic}/
                        </span>
                      )}
                    </div>
                    <SpeakButton
                      text={wordData.word}
                      className="w-9 h-9 bg-white border border-gray-100 text-gray-600 shadow-sm"
                    />
                  </div>
                </div>

                {/* 核心释义 */}
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-1 h-3 bg-[#FF5722] rounded-full"></span>
                    核心释义
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs text-gray-800 leading-relaxed font-semibold">
                    {wordData.meaning || '未获取到释义。'}
                  </div>
                </div>

                {/* 英文定义 */}
                {wordData.definition_en && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
                        English Definition
                      </span>
                      <SpeakButton text={wordData.definition_en} className="w-6 h-6 border-none bg-transparent hover:bg-slate-100" iconClassName="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-white border border-gray-100 rounded-xl p-4 text-xs text-gray-600 leading-relaxed font-medium">
                      {wordData.definition_en}
                    </div>
                  </div>
                )}

                {/* 商务注解 */}
                {wordData.business_note && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1 h-3 bg-purple-500 rounded-full"></span>
                        Business Context / 商务注解
                      </span>
                      <SpeakButton text={wordData.business_note} className="w-6 h-6 border-none bg-transparent hover:bg-slate-100" iconClassName="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-purple-50/50 border border-purple-100/50 text-[#d84315] rounded-xl p-4 text-xs leading-relaxed italic font-medium">
                      {wordData.business_note}
                    </div>
                  </div>
                )}

                {/* 应用场景例句 */}
                {wordData.examples && wordData.examples.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-1 h-3 bg-[#FF5722] rounded-full"></span>
                      Usage Scenarios / 应用场景
                    </div>
                    <div className="space-y-2">
                      {wordData.examples.map((ex: string, index: number) => (
                        <div
                          key={index}
                          className="bg-slate-50 border border-slate-100/70 p-3.5 rounded-xl text-xs text-gray-600 leading-relaxed relative pl-6 pr-10 font-medium"
                        >
                          <span className="absolute left-2.5 top-4 w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                          {ex}
                          <SpeakButton
                            text={ex}
                            className="absolute right-2 top-2 w-6 h-6 border-none bg-transparent hover:bg-slate-200"
                            iconClassName="w-3.5 h-3.5"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 安全状态提醒 */}
                <div className="pt-4 border-t border-gray-100 flex items-center gap-2 text-[10px] text-gray-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  已加密并存入全场景弹药库
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
