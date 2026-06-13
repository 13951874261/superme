import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import TextHighlighter from './components/TextHighlighter';
import RightPanel from './components/RightPanel';
import GlobalTaskCenter from './components/GlobalTaskCenter';
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

  /**
   * 智能判定并处理左侧空白区域的点击事件，实现 70/30 黄金折叠面板的“即刻收起”
   */
  const handleLeftAreaClick = (e: React.MouseEvent) => {
    if (!isRightPanelOpen) return;
    
    // 1. 如果存在活跃的文本选择（例如用户正在长按或双击文本进行划词翻译），则忽略，防止干扰划词体验
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
      return;
    }

    // 2. 检查点击的目标元素是否为交互式控件，或是这些控件的子元素
    // 包含：按钮、超链接、输入框、文本域、下拉选择框、具有按钮角色的组件，以及自定义 cursor-pointer/interactive 元素
    const target = e.target as HTMLElement;
    const isInteractive = target.closest(
      'button, a, input, textarea, select, [role="button"], .interactive, .cursor-pointer'
    ) !== null;
    
    // 3. 若非上述交互式操作，判定为“点击空白处”，即刻收起右侧面板
    if (!isInteractive) {
      setIsRightPanelOpen(false);
    }
  };

  return (
    <div className="bg-[#F8F9FA] text-gray-900 h-screen overflow-hidden flex font-sans selection:bg-[#FF5722]/20 selection:text-[#FF5722] relative w-full">
      <TextHighlighter />
      
      {/* 黄金折叠主视界 (70% 或 100% 宽度平滑缩进) */}
      <div 
        onClick={handleLeftAreaClick}
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

      {/* 全局任务中心抽屉：渲染在 App 根级别，独立于 main-content */}
      <GlobalTaskCenter />
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
