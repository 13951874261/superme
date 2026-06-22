import React, { useState, useEffect } from 'react';
import Header from './Header';
import ListenModule from './modules/ListenModule';
import SpeakModule from './modules/SpeakModule';
import ReadModule from './modules/ReadModule';
import WriteModule from './modules/WriteModule';
import EnglishModule from './modules/EnglishModule';
import DailyWakeupModule from './modules/DailyWakeupModule';
import EntertainmentModule from './modules/EntertainmentModule';
import GameTheoryModule from './modules/GameTheoryModule';
import WeeklyChatModule from './modules/WeeklyChatModule';
import SummaryArea from './SummaryArea';
import { ModuleType } from '../App';
import { Lock, Headphones, Mic, BookOpen, PenTool, Globe, Wine, Brain } from 'lucide-react';
import { useEnglishContext } from './modules/english/context/EnglishContext';
import { playClick, playPageTurn } from '../utils/soundEffects';

interface MainContentProps {
  selectedDate: string;
  activeModule: ModuleType;
  setActiveModule: (m: ModuleType) => void;
  isLocked: boolean;
  onLockTrigger?: () => void;
}

export default function MainContent({ 
  selectedDate, 
  activeModule, 
  setActiveModule, 
  isLocked,
  onLockTrigger
}: MainContentProps) {
  const { theme, masteryData } = useEnglishContext();

  const [bgEnabled, setBgEnabled] = useState(
    localStorage.getItem('super_agent_bg_enabled') !== 'false'
  );

  useEffect(() => {
    const handleSettingsChange = () => {
      setBgEnabled(localStorage.getItem('super_agent_bg_enabled') !== 'false');
    };
    window.addEventListener('global-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('global-settings-changed', handleSettingsChange);
  }, []);

  // 定义金属质感的导航选项卡
  const TABS = [
    { id: 'english', label: '英语引擎', icon: <Globe className="w-4 h-4" /> },
    { id: 'listen', label: '洞察(听)', icon: <Headphones className="w-4 h-4" /> },
    { id: 'speak', label: '破局(说)', icon: <Mic className="w-4 h-4" /> },
    { id: 'read', label: '穿透(读)', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'write', label: '文治(写)', icon: <PenTool className="w-4 h-4" /> },
    { id: 'gametheory', label: '驭心博弈', icon: <Brain className="w-4 h-4" /> },
    { id: 'entertainment', label: '高阶审美', icon: <Wine className="w-4 h-4" /> },
  ] as const;

  // 渲染当前选中的模块 (专注模式)
  const renderActiveModule = () => {
    switch (activeModule) {
      case 'english': return (
        <div className="space-y-10">
          <DailyWakeupModule />
          <EnglishModule />
        </div>
      );
      case 'listen': return <ListenModule selectedDate={selectedDate} />;
      case 'speak': return <SpeakModule />;
      case 'read': return <ReadModule />;
      case 'write': return <WriteModule />;
      case 'gametheory': return <GameTheoryModule />;
      case 'entertainment': return <EntertainmentModule />;
      case 'weekly': return <WeeklyChatModule />;
      default: return <EnglishModule />;
    }
  };

  const handleTabClick = (tabId: ModuleType) => {
    if (isLocked && tabId !== 'english') {
      if (onLockTrigger) onLockTrigger();
    } else {
      if (activeModule !== tabId) {
        playClick();
        playPageTurn();
      }
      setActiveModule(tabId);
    }
  };


  return (
    <main id="main-content" className={`flex-1 flex flex-col h-screen overflow-y-auto relative scroll-smooth font-sans transition-colors duration-300 ${bgEnabled ? 'bg-[#F8F9FA]/40 backdrop-blur-sm' : 'bg-[#F8F9FA]'}`}>
      <Header />
      
      <div className="px-5 md:px-8 lg:px-12 mx-auto w-full max-w-[1600px] pt-8 pb-24 flex flex-col min-h-full">
        
        {/* 顶部 Tab 导航 (The Execution 调度器) */}
        <div className="mb-6 flex flex-wrap gap-2.5 border-b border-slate-200/60 pb-3">
          {TABS.map(tab => {
            const isTabLocked = isLocked && tab.id !== 'english';
            const isActive = activeModule === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id as ModuleType)}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-t-xl font-bold text-sm transition-all duration-200 cursor-pointer active:scale-95 active:translate-y-[1px] relative ${
                  isActive
                    ? 'bg-white text-[var(--color-ink-primary)] border-t-2 border-[var(--color-brand)] shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-10'
                    : isTabLocked
                    ? 'bg-transparent text-[var(--color-ink-muted)] opacity-50 hover:text-red-400 cursor-not-allowed'
                    : 'bg-transparent text-[var(--color-ink-secondary)] hover:text-[var(--color-ink-primary)] hover:bg-white/50'
                }`}
              >
                {isTabLocked ? <Lock className="w-3.5 h-3.5 text-gray-300" /> : tab.icon}
                {tab.label}
                {isTabLocked && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 专注模式：单模块渲染区 */}
        <div className="flex-1 w-full animate-[fadeIn_0.5s_ease-out]">
          {renderActiveModule()}
        </div>

        {/* 专属隔离：康奈尔底部笔记区 (The Summary) */}
        <div className="mt-16 w-full relative">
          <SummaryArea selectedDate={selectedDate} />
        </div>
      </div>

    </main>
  );
}
