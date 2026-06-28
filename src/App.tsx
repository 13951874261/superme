import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import TextHighlighter from './components/TextHighlighter';
import RightPanel from './components/RightPanel';
import GlobalTaskCenter from './components/GlobalTaskCenter';
import { getTodayDateDot } from './utils/date';
import { EnglishProvider, useEnglishContext } from './components/modules/english/context/EnglishContext';
import { TaskProvider } from './components/TaskContext';
import { playError } from './utils/soundEffects';
import CyberneticLockModal from './components/CyberneticLockModal';
import { GLOBAL_SPRING } from './utils/motion';
import LoginPage from './components/LoginPage';
import BackgroundOverlay from './components/BackgroundOverlay';
import { HelpCircle, X } from 'lucide-react';
import GlobalSettingsPanel from './components/GlobalSettingsPanel';
import { ToastProvider } from './components/Toast';
import {
  loadDifyChatbotEmbed,
  refreshDifyChatbotContext,
} from './utils/difyChatbot';

// 定义八大核心模块的类型
export type ModuleType = 'listen' | 'speak' | 'read' | 'write' | 'english' | 'entertainment' | 'gametheory' | 'weekly';

function AppContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const toggleChatbot = () => {
    if (!isChatOpen) {
      refreshDifyChatbotContext();
    }

    const dify = window.difyChatbot;
    if (dify) {
      if (isChatOpen) {
        if (typeof dify.close === 'function') {
          dify.close();
        } else {
          document.getElementById('dify-chatbot-bubble-button')?.click();
        }
        setIsChatOpen(false);
      } else {
        if (typeof dify.open === 'function') {
          dify.open();
        } else {
          document.getElementById('dify-chatbot-bubble-button')?.click();
        }
        setIsChatOpen(true);
      }
    } else {
      const bubbleBtn = document.getElementById('dify-chatbot-bubble-button');
      if (bubbleBtn) {
        bubbleBtn.click();
        setIsChatOpen(!isChatOpen);
      }
    }
  };


  const [selectedDate, setSelectedDate] = useState(getTodayDateDot()); 
  
  // 当前专注的训练模块，默认聚焦您的核心诉求：英语
  const [activeModule, setActiveModule] = useState<ModuleType>('english');

  // 70/30 黄金空间折叠布局状态
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'assistant' | 'context'>('assistant');
  const [highlightedWordData, setHighlightedWordData] = useState<any>(null);

  const { theme, masteryData, pendingSentenceDebt, setActiveTab } = useEnglishContext();
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);

  const [bgEnabled, setBgEnabled] = useState(
    localStorage.getItem('super_agent_bg_enabled') !== 'false'
  );

  useEffect(() => {
    loadDifyChatbotEmbed();
  }, []);

  useEffect(() => {
    const handleProfileChange = () => {
      refreshDifyChatbotContext();
    };
    window.addEventListener('global-profile-changed', handleProfileChange);
    return () => window.removeEventListener('global-profile-changed', handleProfileChange);
  }, []);

  useEffect(() => {
    const handleSettingsChange = () => {
      setBgEnabled(localStorage.getItem('super_agent_bg_enabled') !== 'false');
    };
    window.addEventListener('global-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('global-settings-changed', handleSettingsChange);
  }, []);

  const handleLockTrigger = () => {
    playError();
    setIsLockModalOpen(true);
  };

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

  const isLocked = (isInterceptorEnabled && !masteryData._isInitial && (
    masteryData.oralCount < 10 ||
    masteryData.maxWriteScore < 8 ||
    !masteryData.emailCompleted
  )) || !!pendingSentenceDebt;

  // 当触发控制论强制锁定且当前不在英语引擎时，强行重定向至英语引擎
  // 如果是因为债务被锁定，还要确保切回 vocab tab
  useEffect(() => {
    if (isLocked && activeModule !== 'english') {
      setActiveModule('english');
    }
    if (pendingSentenceDebt && activeModule === 'english') {
      setActiveTab('vocab');
    }
  }, [isLocked, activeModule, pendingSentenceDebt, setActiveTab]);

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
    <div className={`text-gray-900 h-screen overflow-hidden flex font-sans selection:bg-[#FF5722]/20 selection:text-[#FF5722] relative w-full transition-colors duration-300 ${bgEnabled ? 'bg-transparent' : 'bg-[#F8F9FA]'}`}>
      <ToastProvider />
      
      {/* 词汇债务横幅 */}
      <AnimatePresence>
        {pendingSentenceDebt && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 w-full z-50 bg-[#FF5722] text-white px-4 py-2 flex items-center justify-center gap-2 text-xs font-bold shadow-md shadow-[#FF5722]/20 tracking-wider"
          >
            <span className="animate-pulse">⚠️</span>
            <span>词汇债务警告：您尚未完成 [ {pendingSentenceDebt} ] 的造句闭环，沙盘/写作权限已暂时锁定。</span>
          </motion.div>
        )}
      </AnimatePresence>

      <BackgroundOverlay />
      <TextHighlighter />
      
      {/* 黄金折叠主视界 (70% 或 100% 宽度平滑缩进) */}
      <motion.div 
        layout
        onClick={handleLeftAreaClick}
        animate={{ width: isRightPanelOpen ? '70vw' : '100vw' }}
        transition={GLOBAL_SPRING}
        className="h-screen flex overflow-hidden shrink-0"
      >
        <Sidebar 
          isOpen={isSidebarOpen} 
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          isLocked={isLocked}
          onLockTrigger={handleLockTrigger}
        />
        <MainContent 
          selectedDate={selectedDate} 
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          isLocked={isLocked}
          onLockTrigger={handleLockTrigger}
        />
      </motion.div>

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
      <GlobalSettingsPanel />

      {/* 控制论闭环警示弹窗 */}
      <CyberneticLockModal
        isOpen={isLockModalOpen}
        onClose={() => setIsLockModalOpen(false)}
        theme={theme}
        oralCount={masteryData.oralCount}
        maxWriteScore={masteryData.maxWriteScore}
        emailCompleted={masteryData.emailCompleted}
        pendingSentenceDebt={pendingSentenceDebt}
      />

      {/* 项目答疑右下角悬浮按钮 */}
      <motion.div
        className="fixed bottom-6 right-20 z-50"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: 'spring', stiffness: 260, damping: 20 }}
      >
        <button
          onClick={toggleChatbot}
          className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all duration-300 cursor-pointer font-bold text-xs tracking-wider border select-none ${
            isChatOpen
              ? 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-950 hover:shadow-zinc-950/20'
              : 'bg-white text-emerald-700 border-emerald-100 hover:bg-emerald-50 hover:border-emerald-300 hover:shadow-emerald-600/10'
          }`}
        >
          {isChatOpen ? (
            <>
              <X className="w-4 h-4" />
              <span>关闭答疑</span>
            </>
          ) : (
            <>
              <HelpCircle className="w-4 h-4" />
              <span>答疑</span>
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <EnglishProvider>
      <TaskProvider>
        <AnimatePresence mode="wait">
          {!isAuthenticated ? (
            <LoginPage key="login-page" onUnlock={() => setIsAuthenticated(true)} />
          ) : (
            <AppContent key="app-content" />
          )}
        </AnimatePresence>
      </TaskProvider>
    </EnglishProvider>
  );
}
