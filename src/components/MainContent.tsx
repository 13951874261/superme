import React, { useState, useEffect, useCallback, useMemo, memo, startTransition } from 'react';
import Header from './Header';
import EnglishModule from './modules/EnglishModule';
import DailyWakeupModule from './modules/DailyWakeupModule';
import WeeklyChatModule from './modules/WeeklyChatModule';
import SummaryArea from './SummaryArea';
import { ModuleType } from '../App';
import { Lock, Headphones, Mic, BookOpen, PenTool, Globe, Wine, Brain } from 'lucide-react';
import { useEnglishContext } from './modules/english/context/EnglishContext';
import { playClick, playPageTurn } from '../utils/soundEffects';
import { isModulePaused } from '../utils/reviewHelper';
import ModuleSkeleton from './modules/ModuleSkeleton';
import { startL0Timer } from '../utils/perfSlaTelemetry';

const ListenModule = React.lazy(() => import('./modules/ListenModule'));
const SpeakModule = React.lazy(() => import('./modules/SpeakModule'));
const ReadModule = React.lazy(() => import('./modules/ReadModule'));
const WriteModule = React.lazy(() => import('./modules/WriteModule'));
const EntertainmentModule = React.lazy(() => import('./modules/EntertainmentModule'));
const GameTheoryModule = React.lazy(() => import('./modules/GameTheoryModule'));

// 静态常量抽离至组件外部，杜绝每次 render 重新分配内存
const TABS = [
  { id: 'english', label: '英语引擎', icon: <Globe className="w-4 h-4" /> },
  { id: 'listen', label: '洞察(听)', icon: <Headphones className="w-4 h-4" /> },
  { id: 'speak', label: '破局(说)', icon: <Mic className="w-4 h-4" /> },
  { id: 'read', label: '穿透(读)', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'write', label: '文治(写)', icon: <PenTool className="w-4 h-4" /> },
  { id: 'gametheory', label: '驭心博弈', icon: <Brain className="w-4 h-4" /> },
  { id: 'entertainment', label: '高阶审美', icon: <Wine className="w-4 h-4" /> },
] as const;

interface MainContentProps {
  selectedDate: string;
  activeModule: ModuleType;
  setActiveModule: (m: ModuleType) => void;
  isLocked: boolean;
  onLockTrigger?: () => void;
}

function MainContentComponent({ 
  selectedDate, 
  activeModule, 
  setActiveModule, 
  isLocked,
  onLockTrigger
}: MainContentProps) {
  const { setEnglishShellActive } = useEnglishContext();

  const [bgEnabled, setBgEnabled] = useState(
    localStorage.getItem('super_agent_bg_enabled') !== 'false'
  );

  useEffect(() => {
    setEnglishShellActive(activeModule === 'english');
  }, [activeModule, setEnglishShellActive]);

  useEffect(() => {
    const handleSettingsChange = () => {
      setBgEnabled(localStorage.getItem('super_agent_bg_enabled') !== 'false');
    };
    window.addEventListener('global-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('global-settings-changed', handleSettingsChange);
  }, []);

  const handleTabClick = useCallback((tabId: ModuleType) => {
    const endTimer = startL0Timer(`TopTab Switch -> ${tabId}`);
    if (isModulePaused(tabId)) {
      playClick();
      alert('根据复盘战术调度，该模块已暂时挂起。请先完成当前主攻方向的训练。');
      endTimer();
      return;
    }
    if (isLocked && tabId !== 'english') {
      if (onLockTrigger) onLockTrigger();
      endTimer();
    } else {
      if (activeModule !== tabId) {
        playClick();
        playPageTurn();
      }
      startTransition(() => {
        setActiveModule(tabId);
        endTimer();
      });
    }
  }, [isLocked, activeModule, onLockTrigger, setActiveModule]);

  // 英语壳 keep-alive：离开顶栏时隐藏不卸载，避免 flaw-vocab / stay-stats 重复请求
  const activeModuleNode = useMemo(() => (
    <>
      <div className="space-y-4" hidden={activeModule !== 'english'}>
        <DailyWakeupModule />
        <EnglishModule />
      </div>
      {activeModule === 'listen' && (
        <React.Suspense fallback={<ModuleSkeleton />}>
          <ListenModule selectedDate={selectedDate} />
        </React.Suspense>
      )}
      {activeModule === 'speak' && (
        <React.Suspense fallback={<ModuleSkeleton />}>
          <SpeakModule setActiveModule={setActiveModule} />
        </React.Suspense>
      )}
      {activeModule === 'read' && (
        <React.Suspense fallback={<ModuleSkeleton />}>
          <ReadModule />
        </React.Suspense>
      )}
      {activeModule === 'write' && (
        <React.Suspense fallback={<ModuleSkeleton />}>
          <WriteModule />
        </React.Suspense>
      )}
      {activeModule === 'gametheory' && (
        <React.Suspense fallback={<ModuleSkeleton />}>
          <GameTheoryModule />
        </React.Suspense>
      )}
      {activeModule === 'entertainment' && (
        <React.Suspense fallback={<ModuleSkeleton />}>
          <EntertainmentModule />
        </React.Suspense>
      )}
      {activeModule === 'weekly' && <WeeklyChatModule />}
    </>
  ), [activeModule, selectedDate, setActiveModule]);

  return (
    <main id="main-content" className={`flex-1 flex flex-col h-screen overflow-y-auto relative scroll-smooth font-sans transition-colors duration-300 transform-gpu ${bgEnabled ? 'bg-transparent' : 'bg-[#F8F9FA]'}`}>
      <Header />
      
      <div className="px-4 md:px-6 lg:px-8 mx-auto w-full max-w-[1600px] pt-2 pb-16 flex flex-col min-h-full">
        
        {/* 顶部 Tab 导航 (The Execution 调度器) */}
        <div className="mb-3 flex flex-wrap justify-between gap-1.5 border-b border-slate-200/60 pb-2">
          {TABS.map(tab => {
            const isTabLocked = (isLocked && tab.id !== 'english') || isModulePaused(tab.id);
            const isActive = activeModule === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id as ModuleType)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-t-lg font-bold text-sm transition-all duration-200 cursor-pointer active:scale-95 active:translate-y-[1px] relative ${
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
          {activeModuleNode}
        </div>

        {/* 专属隔离：康奈尔底部笔记区 (The Summary) */}
        <div className="mt-8 w-full relative">
          <SummaryArea selectedDate={selectedDate} />
        </div>
      </div>

    </main>
  );
}

const MainContent = memo(MainContentComponent);
export default MainContent;
