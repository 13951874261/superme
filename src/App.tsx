import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import TextHighlighter from './components/TextHighlighter';
import RightPanel from './components/RightPanel';
import { getTodayDateDot } from './utils/date';
import { EnglishProvider, useEnglishContext } from './components/modules/english/context/EnglishContext';
import { TaskProvider } from './components/TaskContext';

// 定义八大核心模块的类型
export type ModuleType = 'listen' | 'speak' | 'read' | 'write' | 'english' | 'entertainment' | 'gametheory' | 'weekly';

function AppContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayDateDot()); 
  
  // 当前专注的训练模块，默认聚焦您的核心诉求：英语
  const [activeModule, setActiveModule] = useState<ModuleType>('english');

  // 70/30 黄金空间折叠布局状态
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'assistant' | 'context'>('assistant');
  const [highlightedWordData, setHighlightedWordData] = useState<any>(null);

  const { masteryData } = useEnglishContext();

  const [isInterceptorEnabled, setIsInterceptorEnabled] = useState(
    localStorage.getItem('super_agent_global_interceptor') !== 'false'
  );

  useEffect(() => {
    const handleSettingsChange = () => {
      setIsInterceptorEnabled(localStorage.getItem('super_agent_global_interceptor') !== 'false');
    };
    window.addEventListener('global-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('global-settings-changed', handleSettingsChange);
  }, []);

  const isLocked = isInterceptorEnabled && !masteryData._isInitial && (masteryData.oralCount < 10 || masteryData.maxWriteScore < 8);

  // 当触发控制论强制锁定且当前不在英语引擎时，强行重定向至英语引擎
  useEffect(() => {
    if (isLocked && activeModule !== 'english') {
      setActiveModule('english');
    }
  }, [isLocked, activeModule]);

  useEffect(() => {
    // 监听全局事件，用于呼出右侧面板
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        if (customEvent.detail.open !== undefined) {
          setIsRightPanelOpen(customEvent.detail.open);
        }
        if (customEvent.detail.tab) {
          setRightPanelTab(customEvent.detail.tab);
        }
        if (customEvent.detail.wordData !== undefined) {
          setHighlightedWordData(customEvent.detail.wordData);
        }
      }
    };

    window.addEventListener('toggle-right-panel', handleToggle);
    return () => window.removeEventListener('toggle-right-panel', handleToggle);
  }, []);

  return (
    <div className="bg-[#F8F9FA] text-gray-900 h-screen overflow-hidden flex font-sans selection:bg-[#FF5722]/20 selection:text-[#FF5722] relative w-full">
      <TextHighlighter />
      
      {/* 黄金折叠主视界 (70% 或 100% 宽度平滑缩进) */}
      <div 
        className={`h-screen flex overflow-hidden transition-all duration-500 ease-in-out shrink-0 ${
          isRightPanelOpen ? 'w-[70vw]' : 'w-full'
        }`}
      >
        <Sidebar 
          isOpen={isSidebarOpen} 
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
        />
        <MainContent 
          selectedDate={selectedDate} 
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          isLocked={isLocked}
        />
      </div>

      {/* 右侧上下文及 AI 助手面板 (30% 宽度，收放微缩) */}
      <RightPanel 
        isOpen={isRightPanelOpen}
        onClose={() => setIsRightPanelOpen(false)}
        activeTab={rightPanelTab}
        setActiveTab={setRightPanelTab}
        wordData={highlightedWordData}
      />
    </div>
  );
}

export default function App() {
  return (
    <EnglishProvider>
      <TaskProvider>
        <AppContent />
      </TaskProvider>
    </EnglishProvider>
  );
}
