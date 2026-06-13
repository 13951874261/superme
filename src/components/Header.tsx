import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Volume2, Globe, Loader2 } from 'lucide-react';
import { VOICE_OPTIONS } from '../config/voices';
import { speakEnglish } from './SpeakButton';
import { useTask } from './TaskContext';

export default function Header() {
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem('super_agent_default_voice') || 'en-GB-LibbyNeural';
  });
  const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
  const [activeVoiceTab, setActiveVoiceTab] = useState<'all' | 'US' | 'UK' | 'other'>('all');
  const { pendingCount, setIsOpen } = useTask();

  useEffect(() => {
    const handleStorageChange = () => {
      setSelectedVoice(localStorage.getItem('super_agent_default_voice') || 'en-GB-LibbyNeural');
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('global-voice-changed', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('global-voice-changed', handleStorageChange);
    };
  }, []);

  const handleSelectVoice = (voiceId: string) => {
    setSelectedVoice(voiceId);
    localStorage.setItem('super_agent_default_voice', voiceId);
    setShowVoiceDropdown(false);
    window.dispatchEvent(new Event('global-voice-changed'));
  };

  const handlePreviewVoice = async (e: React.MouseEvent, voiceId: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    const originalVoice = localStorage.getItem('super_agent_default_voice');
    localStorage.setItem('super_agent_default_voice', voiceId);
    await speakEnglish(`Hi! I am ${name}, presenting my accent for your learning.`, 0.95);
    if (originalVoice) {
      localStorage.setItem('super_agent_default_voice', originalVoice);
    } else {
      localStorage.removeItem('super_agent_default_voice');
    }
  };

  return (
    <header className="w-full max-w-[1400px] mx-auto px-6 py-4 sticky top-0 z-50">
      <div className="grid grid-cols-12 items-center gap-6 p-6 md:p-8 rounded-[2rem] border border-slate-200/50 bg-white/85 backdrop-blur-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.03)] min-h-[120px]">
        
        {/* 1. 左侧：品牌与叙事区 */}
        <div className="col-span-12 xl:col-span-3 flex flex-col justify-center">
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            B·AI <span className="font-normal text-slate-700 text-xl md:text-2xl">高管数字沙盘</span>
          </h1>
          <p className="text-[11px] text-slate-400 leading-normal mt-2 max-w-[32ch]">
            AI 做专业，你做领导；AI 做事务，你做人心；AI 做逻辑，你做格局。
          </p>
        </div>

        {/* 2. 中间：微操作台 */}
        <div className="col-span-12 xl:col-span-6 flex items-center justify-center gap-5 xl:gap-6 flex-wrap xl:flex-nowrap">
          {/* 专注模式 */}
          <button className="h-10 px-4 rounded-full border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all flex items-center gap-2 text-xs font-medium text-slate-600 whitespace-nowrap flex-shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            沉浸式专注模式
          </button>

          {/* 全局声线 (Voice Center) */}
          <div className="relative inline-block text-left flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowVoiceDropdown(!showVoiceDropdown)}
              className="h-10 px-4 rounded-full border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all flex items-center gap-2 text-xs font-medium text-slate-600 hover:border-blue-200 cursor-pointer whitespace-nowrap"
              title="设置全局发音人"
            >
              <Volume2 className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">全局声线 (Voice):</span>
              <span className="font-black text-slate-800 ml-1">
                {(() => {
                  const matched = VOICE_OPTIONS.find(v => v.id === selectedVoice);
                  return matched ? `${matched.name} (${matched.country})` : 'Libby (英国 (UK))';
                })()}
              </span>
            </button>

            {showVoiceDropdown && (
              <div className="absolute left-1/2 -translate-x-1/2 xl:left-auto xl:translate-x-0 xl:right-0 top-full mt-2.5 z-50 w-96 bg-white border border-gray-100 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.08)] overflow-hidden text-left animate-[fadeIn_0.15s_ease-out]">
                {/* Dropdown Header */}
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-500" />
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">声线控制中心 (Voice Center)</span>
                  </div>
                  <button
                    onClick={() => setShowVoiceDropdown(false)}
                    className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer font-bold"
                  >
                    关闭
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 bg-gray-50/50 p-1 gap-1">
                  {(['all', 'US', 'UK', 'other'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveVoiceTab(tab)}
                      className={`flex-1 text-center py-1.5 text-[10px] font-bold rounded-lg cursor-pointer transition-all ${
                        activeVoiceTab === tab
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-750'
                      }`}
                    >
                      {tab === 'all' ? '全部' : tab === 'US' ? '美音' : tab === 'UK' ? '英音' : '其他'}
                    </button>
                  ))}
                </div>

                {/* Voice List */}
                <div className="max-h-72 overflow-y-auto p-2.5 space-y-1">
                  {VOICE_OPTIONS.filter((voice) => {
                    if (activeVoiceTab === 'US') return voice.id.includes('en-US');
                    if (activeVoiceTab === 'UK') return voice.id.includes('en-GB');
                    if (activeVoiceTab === 'other') return !voice.id.includes('en-US') && !voice.id.includes('en-GB');
                    return true;
                  }).map((voice) => {
                    const isSelected = voice.id === selectedVoice;
                    return (
                      <div
                        key={voice.id}
                        onClick={() => handleSelectVoice(voice.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-indigo-50/70 border-indigo-100 text-indigo-750 font-bold shadow-sm'
                            : voice.highlight
                              ? 'bg-red-50/30 border-red-100/50 text-red-500 hover:bg-red-50/50 hover:border-red-100'
                              : 'bg-transparent border-transparent hover:bg-gray-50 text-slate-755'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <span className={`text-xs ${isSelected ? 'font-black' : 'font-semibold'} ${voice.highlight ? 'text-red-500 font-bold' : ''}`}>
                              {voice.name}
                              {voice.highlight && <span className="ml-1 text-[8px] bg-red-100 text-red-600 px-1 py-0.5 rounded uppercase font-black">Ana</span>}
                            </span>
                            <span className="text-[9px] text-gray-400 font-medium">
                              {voice.country} · {voice.gender === 'F' ? '女' : '男'}
                            </span>
                          </div>
                        </div>
                        
                        <button
                          onClick={(e) => handlePreviewVoice(e, voice.id, voice.name)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                              : 'bg-white border-gray-200 text-gray-400 hover:text-indigo-650 hover:border-indigo-200'
                          }`}
                          title="试听发音"
                        >
                          <span className="text-[9px] font-bold block leading-none px-1">试听</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 提纯任务中心 */}
          <div className="relative inline-block text-left flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="h-10 px-4 rounded-full border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all flex items-center gap-2 text-xs font-medium text-slate-600 hover:border-amber-200 cursor-pointer relative whitespace-nowrap"
              title="查看提纯任务中心"
            >
              <Loader2 className={`w-3.5 h-3.5 text-amber-500 ${pendingCount > 0 ? 'animate-spin' : ''}`} />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">提纯任务:</span>
              <span className="font-black text-slate-800 ml-1">
                {pendingCount > 0 ? `${pendingCount} 个进行中` : '查看队列'}
              </span>
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#FF5722] text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 3. 右侧：步进器演变轴 */}
        <div className="col-span-12 xl:col-span-3 flex flex-col gap-2 xl:pl-6 xl:border-l xl:border-slate-100">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono tracking-wider">
            <span>EVOLUTION TRACKER</span>
            <span className="text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">45% Completed</span>
          </div>
          
          {/* 进度条轨道容器：固定高度，确保圆点垂直居中 */}
          <div className="relative h-8 mt-1">
            {/* 进度背景条：跨越三个节点 */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-100 rounded-full z-0">
              <div className="h-full bg-gradient-to-r from-slate-400 to-indigo-500 rounded-full transition-all duration-1000 ease-out" style={{ width: '45%' }}></div>
            </div>

            {/* 节点轨道：均匀分布 */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-between items-start z-10 px-1">
              {/* 节点 1：2020 科员 (已达成) */}
              <div className="flex flex-col items-center w-16 -mt-1">
                <div className="w-3 h-3 rounded-full bg-slate-500 border-2 border-white shadow-sm"></div>
                <span className="text-[9px] text-slate-400 font-mono leading-none mt-1">2020</span>
                <span className="text-[10px] font-semibold text-slate-600 mt-0.5 whitespace-nowrap">科员</span>
              </div>

              {/* 节点 2：2026 支行副行长 (当前节点) */}
              <div className="flex flex-col items-center w-16 -mt-1">
                <div className="w-4 h-4 rounded-full bg-indigo-500 border-2 border-white shadow-md flex items-center justify-center relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <div className="w-1.5 h-1.5 rounded-full bg-white relative z-20"></div>
                </div>
                <span className="text-[9px] text-indigo-500 font-bold font-mono leading-none mt-1">2026</span>
                <span className="text-[10px] font-bold text-slate-800 mt-0.5 whitespace-nowrap">支行副行长</span>
              </div>

              {/* 节点 3：2027 跨国大区VP (未达成) */}
              <div className="flex flex-col items-center w-16 -mt-1 opacity-55">
                <div className="w-3 h-3 rounded-full bg-slate-200 border-2 border-white shadow-sm"></div>
                <span className="text-[9px] text-slate-400 font-mono leading-none mt-1">2027</span>
                <span className="text-[10px] font-semibold text-slate-500 mt-0.5 whitespace-nowrap">大区VP</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}