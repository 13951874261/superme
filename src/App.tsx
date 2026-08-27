import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import TextHighlighter from './components/TextHighlighter';
import RightPanel from './components/RightPanel';
import GlobalTaskCenter from './components/GlobalTaskCenter';
import { getTodayDateDot } from './utils/date';
import { EnglishProvider, useEnglishContext, useThemeMastery } from './components/modules/english/context/EnglishContext';
import { TaskProvider } from './components/TaskContext';
import { playError } from './utils/soundEffects';
import CyberneticLockModal from './components/CyberneticLockModal';
import { GLOBAL_SPRING } from './utils/motion';
import LoginPage from './components/LoginPage';
import BackgroundOverlay from './components/BackgroundOverlay';
import { HelpCircle, X } from 'lucide-react';
import GlobalSettingsPanel from './components/GlobalSettingsPanel';
import { ToastProvider } from './components/Toast';
import { NearHandoffHost } from './components/NearHandoffNotice';
import BiweeklyReviewModal from './components/modules/BiweeklyReviewModal';
import { useBiweeklyReviewTrigger } from './hooks/useBiweeklyReviewTrigger';
import {
  loadDifyChatbotEmbed,
  prepareDifyAssistantIframe,
  refreshDifyChatbotContext,
  rotateEmbedSessionOnPageLoad,
  rotateEmbedSessionOnRouteChange,
} from './utils/difyChatbot';
import {
  getAppUserId,
  isProfileStale,
  loadUserProfileFromServer,
  recordUserLoginPing,
} from './utils/profileHelper';

// 定义八大核心模块的类型
export type ModuleType = 'listen' | 'speak' | 'read' | 'write' | 'english' | 'entertainment' | 'gametheory' | 'weekly';

function AppContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const toggleChatbot = useCallback(() => {
    setIsChatOpen(prev => {
      const nextState = !prev;
      if (!prev) {
        loadDifyChatbotEmbed();
        void loadUserProfileFromServer().then(() => refreshDifyChatbotContext());
      }
      const dify = window.difyChatbot;
      if (dify) {
        if (prev) {
          if (typeof dify.close === 'function') {
            dify.close();
          } else {
            document.getElementById('dify-chatbot-bubble-button')?.click();
          }
        } else {
          if (typeof dify.open === 'function') {
            dify.open();
          } else {
            document.getElementById('dify-chatbot-bubble-button')?.click();
          }
        }
      } else {
        const bubbleBtn = document.getElementById('dify-chatbot-bubble-button');
        if (bubbleBtn) {
          bubbleBtn.click();
        }
      }
      return nextState;
    });
  }, []);

  const [selectedDate, setSelectedDate] = useState(getTodayDateDot()); 
  
  // 当前专注的训练模块，默认聚焦您的核心诉求：英语
  const [activeModule, setActiveModule] = useState<ModuleType>('english');

  // 70/30 黄金空间折叠布局状态
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'assistant' | 'context'>('assistant');
  const [highlightedWordData, setHighlightedWordData] = useState<any>(null);

  const { setActiveTab } = useEnglishContext();
  const { theme, masteryData, pendingSentenceDebt } = useThemeMastery();
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const { shouldForceModal } = useBiweeklyReviewTrigger();
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const [bgEnabled, setBgEnabled] = useState(
    localStorage.getItem('super_agent_bg_enabled') !== 'false'
  );

  useEffect(() => {
    rotateEmbedSessionOnPageLoad();
    // ponytail: 启动时即开始构建 iframe URL 并缓存，panel 打开时直接命中
    void prepareDifyAssistantIframe();

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const runEmbed = () => loadDifyChatbotEmbed();
    if (typeof requestIdleCallback === 'function') {
      idleId = requestIdleCallback(runEmbed, { timeout: 1500 });
    } else {
      timeoutId = setTimeout(runEmbed, 500);
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible' && isProfileStale()) {
        void loadUserProfileFromServer();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (idleId !== undefined && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    const openReview = () => setIsReviewOpen(true);
    window.addEventListener('open-biweekly-review', openReview);
    return () => window.removeEventListener('open-biweekly-review', openReview);
  }, []);

  useEffect(() => {
    const refreshChatbot = () => refreshDifyChatbotContext();
    window.addEventListener('dify-context-refresh-needed', refreshChatbot);
    return () => window.removeEventListener('dify-context-refresh-needed', refreshChatbot);
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

  const handleLockTrigger = useCallback(() => {
    playError();
    if (shouldForceModal) {
      setIsReviewOpen(true);
      return;
    }
    setIsLockModalOpen(true);
  }, [shouldForceModal]);


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

  const isLocked = !!pendingSentenceDebt || shouldForceModal;

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

  // 切换模块时，轮换 Dify 会话隔离命名空间，规避 404 会话已删除报错
  useEffect(() => {
    rotateEmbedSessionOnRouteChange();
  }, [activeModule]);

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

  // 任务中心 → 博弈对局历史深链
  useEffect(() => {
    const handleNavHistory = (e: Event) => {
      const customEvent = e as CustomEvent<{ historyId?: string }>;
      const historyId = customEvent.detail?.historyId;
      if (!historyId) return;
      sessionStorage.setItem('gt_focus_history_id', historyId);
      setActiveModule('gametheory');
    };
    window.addEventListener('navigate-game-theory-history', handleNavHistory);
    return () => window.removeEventListener('navigate-game-theory-history', handleNavHistory);
  }, []);

  useEffect(() => {
    const goListen = () => setActiveModule('listen');
    const goSpeak = () => setActiveModule('speak');
    const goDashboard = () => {
      if (activeModule !== 'english') setActiveModule('english');
      else setActiveTab('dashboard');
    };
    window.addEventListener('navigate-insight-listen', goListen);
    window.addEventListener('navigate-speak', goSpeak);
    window.addEventListener('open-uploaded-material', goDashboard);
    return () => {
      window.removeEventListener('navigate-insight-listen', goListen);
      window.removeEventListener('navigate-speak', goSpeak);
      window.removeEventListener('open-uploaded-material', goDashboard);
    };
  }, [activeModule]);

  /**
   * 智能判定并处理左侧空白区域的点击事件，实现 70/30 黄金折叠面板的“即刻收起”
   */
  const handleLeftAreaClick = useCallback((e: React.MouseEvent) => {
    if (!isRightPanelOpen) return;
    
    // 1. 如果存在活跃的文本选择（例如用户正在长按或双击文本进行划词翻译），则忽略，防止干扰划词体验
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
      return;
    }

    // 2. 检查点击的目标元素是否为交互式控件，或是这些控件的子元素
    const target = e.target as HTMLElement;
    const isInteractive = target.closest(
      'button, a, input, textarea, select, [role="button"], .interactive, .cursor-pointer'
    ) !== null;
    
    // 3. 若非上述交互式操作，判定为“点击空白处”，即刻收起右侧面板
    if (!isInteractive) {
      setIsRightPanelOpen(false);
    }
  }, [isRightPanelOpen]);

  const handleCloseRightPanel = useCallback(() => {
    setIsRightPanelOpen(false);
    // 通知沉浸式阅读层收回右侧让位（ImmersiveReader z-[9999] 遮罩）
    window.dispatchEvent(new CustomEvent('toggle-right-panel', {
      detail: { open: false },
    }));
  }, []);

  return (
    <div className={`text-gray-900 h-screen overflow-hidden flex font-sans selection:bg-[#FF5722]/20 selection:text-[#FF5722] relative w-full transition-colors duration-300 ${bgEnabled ? 'bg-transparent' : 'bg-[#F8F9FA]'}`}>
      <ToastProvider />
      <NearHandoffHost />
      
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
      
      {/* 主视界：flex-1 自适应，右侧面板固定 400px，避免 70vw + 400px 溢出视口 */}
      <div
        onClick={handleLeftAreaClick}
        className={`h-screen flex overflow-hidden min-w-0 ${isRightPanelOpen ? 'flex-1' : 'w-full flex-1'}`}
      >
        <Sidebar 
          isOpen={isSidebarOpen} 
          toggleSidebar={toggleSidebar} 
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
      </div>

      {/* 右侧上下文及 AI 助手面板 (30% 宽度，收放微缩) */}
      <RightPanel 
        isOpen={isRightPanelOpen}
        onClose={handleCloseRightPanel}
        activeTab={rightPanelTab}
        setActiveTab={setRightPanelTab}
        wordData={highlightedWordData}
      />


      {/* 全局任务中心抽屉：渲染在 App 根级别，独立于 main-content */}
      <GlobalTaskCenter />
      <GlobalSettingsPanel />

      {/* 控制论闭环警示弹窗 */}
      <CyberneticLockModal
        isOpen={isLockModalOpen && !shouldForceModal}
        onClose={() => setIsLockModalOpen(false)}
        theme={theme}
        oralCount={masteryData.oralCount}
        maxWriteScore={masteryData.maxWriteScore}
        emailCompleted={masteryData.emailCompleted}
        pendingSentenceDebt={pendingSentenceDebt}
      />

      <BiweeklyReviewModal
        isOpen={shouldForceModal || isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        isForce={shouldForceModal}
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

  // One-shot login ping when authenticated (covers paths that skip LoginPage / initializeUserSession)
  useEffect(() => {
    if (!isAuthenticated) return;
    const userId = getAppUserId();
    void recordUserLoginPing(userId).catch((error) => {
      console.warn(`[App] login ping failed for userId=${userId}:`, error);
    });
  }, [isAuthenticated]);

  return (
    <AnimatePresence mode="wait">
      {!isAuthenticated ? (
        <LoginPage key="login-page" onUnlock={() => setIsAuthenticated(true)} />
      ) : (
        <React.Fragment key="app-shell">
          <EnglishProvider>
            <TaskProvider>
              <AppContent />
            </TaskProvider>
          </EnglishProvider>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
