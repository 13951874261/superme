import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Volume2, Globe } from 'lucide-react';
import { VOICE_OPTIONS } from '../config/voices';
import { speakEnglish } from './SpeakButton';

export default function Header() {
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem('super_agent_default_voice') || 'en-GB-LibbyNeural';
  });
  const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
  const [activeVoiceTab, setActiveVoiceTab] = useState<'all' | 'US' | 'UK' | 'other'>('all');

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

      {/* 全局声线控制（Global Voice Selector） */}
      <div className="relative inline-block text-left mb-6 xl:mb-0 xl:mx-8 shrink-0">
        <button
          type="button"
          onClick={() => setShowVoiceDropdown(!showVoiceDropdown)}
          className="flex items-center gap-2 bg-white border border-gray-200 text-[#202124] text-xs font-bold rounded-xl px-4 py-2.5 outline-none focus:border-[#FF5722] cursor-pointer shadow-sm hover:bg-gray-50 transition-colors border-t-2 border-t-indigo-500"
          title="设置全局发音人"
        >
          <Volume2 className="w-4 h-4 text-[#FF5722]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">全局声线 (Voice):</span>
          <span className="font-black text-slate-800">
            {(() => {
              const matched = VOICE_OPTIONS.find(v => v.id === selectedVoice);
              return matched ? `${matched.flag} ${matched.name}` : '🇬🇧 Libby';
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
                className="text-gray-400 hover:text-gray-600 text-[11px] font-bold cursor-pointer"
              >
                关闭
              </button>
            </div>

            {/* Dropdown Tabs */}
            <div className="flex border-b border-gray-100 bg-gray-50/50 px-2 py-1">
              {(['all', 'US', 'UK', 'other'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveVoiceTab(tab)}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    activeVoiceTab === tab
                      ? 'bg-white text-indigo-650 shadow-sm'
                      : 'text-gray-400 hover:text-gray-655'
                  }`}
                >
                  {tab === 'all' ? '全部' : tab === 'US' ? '🇺🇸 美音' : tab === 'UK' ? '🇬🇧 英音' : '🌐 其他'}
                </button>
              ))}
            </div>

            {/* Voice List */}
            <div className="max-h-72 overflow-y-auto p-2 space-y-1" style={{ scrollbarWidth: 'thin' }}>
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
                          : 'bg-transparent border-transparent hover:bg-gray-50 text-slate-705'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{voice.flag}</span>
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
                      <span className="text-[9px] font-bold block leading-none px-1">▶ 试听</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
